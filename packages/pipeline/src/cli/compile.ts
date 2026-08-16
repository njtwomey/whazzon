import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadCatalogues } from "../lib/catalogue.js";
import { endDateOf, foldHarvests, sortDateOf, stateOf } from "../lib/fold.js";
import { loadLocation, resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
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
 *   npm run compile -- bristol-uk
 *   npm run compile -- bristol-uk --as-of 2026-08-16
 */

const { locations, rest } = resolveLocations();
const asOfArg = rest.includes("--as-of") ? rest[rest.indexOf("--as-of") + 1] : undefined;
const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error(`--as-of must be YYYY-MM-DD, got "${asOf}"`);
  process.exit(1);
}

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
        url: source.url,
        area: source.area,
        address: source.address,
        tags: source.tags,
        lastHarvest: folded?.lastHarvest,
        lastError: folded?.lastError,
      });

      for (const entry of folded?.events ?? []) {
        const event = entry.event;

        // Resolve where this actually happens. Most events omit `venue`
        // entirely and simply happen at their source.
        const hostId = event.venue?.sourceId;
        const host = hostId ? catalogueById.get(hostId) : undefined;
        const venueName = host?.source.name ?? event.venue?.name ?? source.name;
        const area = host?.source.area ?? event.venue?.area ?? source.area;
        const address = host?.source.address ?? event.venue?.address ?? source.address;

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
          state: stateOf(entry, folded?.lastHarvest, asOf),
          sortDate: sortDateOf(event.occurrence, asOf),
          endDate: endDateOf(event.occurrence),
          timesText: event.timesText,
          venueName,
          area,
          address,
          url: event.url,
          image: event.image,
          price: event.price,
          ageRestriction: event.ageRestriction,
          tags: event.tags,
          raw: event.raw,
          summary: event.summary,
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
        .join(", ")}${failing ? `, ${failing} failing` : ""}) -> ${rel(out)}`,
  );
}
