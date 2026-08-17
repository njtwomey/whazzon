import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadCatalogues } from "../lib/catalogue.js";
import { dedupeEvents } from "../lib/dedupe.js";
import { endDateOf, foldHarvests, sortDateOf, stateOf } from "../lib/fold.js";
import { loadLocation, resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import { primaryUrl } from "../lib/routes.js";
import type { Source } from "../schema/catalogue.js";
import { SnapshotArtefact, type SnapshotEvent } from "../schema/snapshot.js";

/**
 * Stage 2 -> stage 3 handover. Folds the harvest log into a single snapshot the
 * web app reads directly.
 *
 * This is where denormalisation happens, and nowhere else. The harvest log is
 * normalised — an event knows its source id and little more — because a copy
 * of a venue's address inside a thousand events goes stale the moment the
 * catalogue is corrected. Here the two are joined and flattened, so the UI can
 * draw a card without a lookup.
 *
 * Strictly deterministic: no network, no LLM, no randomness. Given the same
 * committed data and the same --as-of date it produces byte-identical output,
 * so a surprising diff in the snapshot always means the data changed.
 *
 *   npm run compile -- gb-bristol
 *   npm run compile -- gb-bristol --as-of 2026-08-16
 *   npm run compile -- gb-bristol --keep-finished 0     drop every past event
 */

const { locations, rest } = resolveLocations();
const asOfArg = rest.includes("--as-of") ? rest[rest.indexOf("--as-of") + 1] : undefined;
const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error(`--as-of must be YYYY-MM-DD, got "${asOf}"`);
  process.exit(1);
}

/**
 * How long a finished event stays in the snapshot before being left out.
 *
 * The harvest log grows for ever and most of it will eventually be in the past,
 * so shipping all of it to a browser is a bill that only goes up. But a hard cut
 * at today is worse than it sounds: "did I miss it?" is a real question, and the
 * fortnight just gone is the only part of the past anyone asks about.
 *
 * Nothing is deleted — the log is untouched and re-compiling with a longer
 * window brings it all back.
 */
const keepArg = rest.includes("--keep-finished") ? rest[rest.indexOf("--keep-finished") + 1] : undefined;
const keepFinishedDays = keepArg === undefined ? 14 : Number(keepArg);

if (!Number.isInteger(keepFinishedDays) || keepFinishedDays < 0) {
  console.error(`--keep-finished must be a whole number of days, got "${keepArg}"`);
  process.exit(1);
}

/** Date arithmetic on the given as-of, never on the clock — see above. */
function shiftDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

const finishedCutoff = shiftDays(asOf, -keepFinishedDays);

// The clock is read once, here, and only for the generatedAt stamp. Every
// decision about what has finished uses --as-of, so rebuilding an old snapshot
// reproduces it exactly.
const generatedAt = `${new Date().toISOString().slice(0, 19)}Z`;

for (const locationId of locations) {
  const location = loadLocation(locationId);
  const catalogues = loadCatalogues(locationId);
  const fold = foldHarvests(locationId);

  /** Every catalogued source, for resolving venue references. */
  const catalogueById = new Map<string, { source: Source; categoryLabel: string }>();
  for (const { catalogue } of catalogues) {
    for (const source of catalogue.sources) {
      catalogueById.set(source.id, { source, categoryLabel: catalogue.label });
    }
  }

  const events: SnapshotEvent[] = [];
  const sources: unknown[] = [];
  const categories: unknown[] = [];
  /** Finished longer ago than the window, and so left out of the snapshot. */
  let droppedFinished = 0;
  /** Undated, and no longer listed by a source we successfully read. */
  let droppedUndated = 0;

  for (const { catalogue } of catalogues) {
    let eventCount = 0;

    for (const source of catalogue.sources) {
      const folded = fold.sources.get(source.id);

      sources.push({
        id: source.id,
        name: source.name,
        category: source.category,
        kind: source.kind,
        status: source.status,
        // One link, not the routes: which endpoint a harvest reads is stage 2's
        // business, and an API URL under an event title would be a bug.
        url: primaryUrl(source),
        area: source.area,
        address: source.address,
        tags: source.tags,
        lastHarvest: folded?.lastHarvest,
        lastError: folded?.lastError,
      });

      for (const entry of folded?.events ?? []) {
        const event = entry.event;

        const state = stateOf(entry, folded?.lastHarvest, asOf);
        const end = endDateOf(event.occurrence);
        if (state === "finished" && end !== undefined && end < finishedCutoff) {
          droppedFinished += 1;
          continue;
        }

        /**
         * An undated event the source has stopped listing is dropped, where a
         * dated one would be carried.
         *
         * `carried` exists so a venue that lists three months ahead does not
         * lose a show announced a year out — the date is what makes that safe,
         * because the event eventually finishes and leaves. An undated event has
         * no date to pass, so it can never become `finished`: carried once,
         * carried for ever.
         *
         * That also mints ghosts. Event ids hash the anchor date, so a listing
         * recorded `undated` on Monday and dated on Tuesday is two ids, and the
         * undated one sits beside its dated twin indefinitely. Eighteen of those
         * appeared in the first re-harvest.
         *
         * Absence is the only signal an undated listing ever gives, so it is the
         * one we use — but only when the source was actually read. A failed
         * fetch says nothing about what the page holds, and must not retire a
         * whole venue's announcements.
         */
        if (state === "carried" && event.occurrence.kind === "undated" && folded?.lastError === undefined) {
          droppedUndated += 1;
          continue;
        }

        /**
         * Resolve where this actually happens. Most events omit `venue`
         * entirely and simply happen at their source.
         *
         * The `elsewhere` guard matters more than it looks. `venue` being set at
         * all is the harvester saying "not at the source" — so when it names a
         * venue we cannot resolve and gives no address, the honest answer is *no
         * address*, not the source's. Falling through to `source.address` there
         * published seven Crawford Art Gallery events at Emmet Place, a building
         * closed for redevelopment until 2028, when every one of them was
         * actually at a library or another venue across town.
         */
        const hostId = event.venue?.sourceId;
        const host = hostId ? catalogueById.get(hostId) : undefined;
        const elsewhere = event.venue !== undefined;
        const venueName = host?.source.name ?? event.venue?.name ?? source.name;
        const area = host?.source.area ?? event.venue?.area ?? (elsewhere ? undefined : source.area);
        const address = host?.source.address ?? event.venue?.address ?? (elsewhere ? undefined : source.address);

        events.push({
          id: event.id,
          sourceId: event.sourceId,
          sourceName: source.name,
          category: catalogue.category,
          categoryLabel: catalogue.label,
          subcategory: event.subcategory,
          title: event.title,
          occurrence: event.occurrence,
          status: event.status,
          state,
          sortDate: sortDateOf(event.occurrence, asOf),
          endDate: end,
          timesText: event.timesText,
          venueName,
          area,
          address,
          url: event.url,
          sourceUrl: primaryUrl(source),
          image: event.image,
          price: event.price,
          ageRestriction: event.ageRestriction,
          tags: event.tags,
          raw: event.raw,
          summary: event.summary,
          description: event.description,
          confidence: event.confidence,
          firstSeen: entry.firstSeen,
          lastSeen: entry.lastSeen,
        });
        eventCount += 1;
      }
    }

    categories.push({
      category: catalogue.category,
      label: catalogue.label,
      description: catalogue.description,
      sourceCount: catalogue.sources.length,
      eventCount,
    });
  }

  /**
   * Collapse the same event listed by several sources. Cork's first harvest put
   * 1,641 rows in front of a reader, 144 of which were another source's copy of a
   * row already there — the PROC guide and Pure Cork alone shared 131 ids.
   *
   * After the fold and before the sort: it needs `state` and `sortDate` resolved
   * to match on, and the sort has to run over what actually ships.
   */
  const deduped = dedupeEvents(events, (sourceId) => catalogueById.get(sourceId)?.source.kind);
  events.length = 0;
  events.push(...deduped.events);

  // Stable ordering, so a snapshot diff reflects data changes and nothing else.
  // Undated events sort last rather than being dropped.
  events.sort((a, b) => {
    if (a.sortDate === b.sortDate) return a.id.localeCompare(b.id);
    if (a.sortDate === undefined) return 1;
    if (b.sortDate === undefined) return -1;
    return a.sortDate.localeCompare(b.sortDate);
  });

  const snapshot = {
    schema: SnapshotArtefact.header,
    location: {
      id: location.id,
      name: location.name,
      region: location.region,
      country: location.country,
      timezone: location.timezone,
    },
    generatedAt,
    asOf,
    categories,
    sources,
    events,
  };

  // Validate on the way out: a malformed snapshot is far cheaper to catch here
  // than as a blank page in the browser.
  const checked = SnapshotArtefact.parse(snapshot);

  const out = paths.snapshot(locationId);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(checked.data, null, 2)}\n`, "utf8");

  const byState = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.state] = (acc[e.state] ?? 0) + 1;
    return acc;
  }, {});
  const failing = fold.sources.size ? [...fold.sources.values()].filter((s) => s.lastError).length : 0;

  console.log(
    `${locationId}: ${events.length} events from ${fold.sources.size} observed sources over ` +
      `${fold.runDates.length} run(s) ` +
      `(${Object.entries(byState)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ")}${failing ? `, ${failing} failing` : ""}) -> ${rel(out)}` +
      // Said out loud, because a snapshot that silently omits events reads as
      // a harvest that never found them.
      (droppedFinished
        ? `\n  ${droppedFinished} finished before ${finishedCutoff} left out (--keep-finished ${keepFinishedDays})`
        : "") +
      (droppedUndated ? `\n  ${droppedUndated} undated event(s) no longer listed left out` : "") +
      (deduped.merged
        ? `\n  ${deduped.merged} duplicate row(s) merged across ${deduped.groups} event(s) listed by more than one source`
        : ""),
  );
}
