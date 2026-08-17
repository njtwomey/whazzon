import { existsSync, readFileSync } from "node:fs";
import { DUP_SCORE } from "../lib/dedupe.js";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import type { Snapshot, SnapshotEvent } from "../schema/snapshot.js";

/**
 * What the duplicate scoring decided — printed so it can be checked rather than
 * trusted.
 *
 * Every rule in `lib/dedupe.ts` is a guess about whether two strings mean the
 * same evening, and some are wrong. The only way to know which is to read the
 * titles side by side, so this prints each group with the canonical title and the
 * ones scored against it beneath. That is the before-and-after needed to confirm
 * a match was real — and since nothing is deleted, a bad score costs a hidden row
 * rather than a lost one.
 *
 *   npm run dupes -- ie-cork                  the ladder: what each threshold hides
 *   npm run dupes -- ie-cork --min 0.65       the groups at and above a score
 *   npm run dupes -- ie-cork --min 0.3 --differing   only where the titles differ
 */

const { locations, rest } = resolveLocations();
const minArg = rest.includes("--min") ? Number(rest[rest.indexOf("--min") + 1]) : undefined;
/** Identical titles need no eyeballing; the interesting groups are the fuzzy ones. */
const differing = rest.includes("--differing");

if (minArg !== undefined && !(minArg >= 0 && minArg <= 1)) {
  console.error(`--min must be between 0 and 1, got "${rest[rest.indexOf("--min") + 1]}"`);
  process.exit(1);
}

const BANDS: { label: string; min: number; blurb: string }[] = [
  { label: "certain", min: DUP_SCORE.certain, blurb: "same title, same venue" },
  { label: "likely", min: DUP_SCORE.likely, blurb: "same title, venue names contain each other" },
  { label: "probable", min: DUP_SCORE.probable, blurb: "one title inside the other" },
  { label: "possible", min: DUP_SCORE.possible, blurb: "titles a few characters apart" },
  { label: "weak", min: DUP_SCORE.weak, blurb: "titles close, one row does not say where" },
];

for (const locationId of locations) {
  const path = paths.snapshot(locationId);
  if (!existsSync(path)) {
    console.error(`${locationId}: no snapshot yet — run \`npm run compile -- ${locationId}\``);
    continue;
  }

  const snapshot = JSON.parse(readFileSync(path, "utf8")) as Snapshot;
  const byId = new Map(snapshot.events.map((e) => [e.id, e]));
  const dupes = snapshot.events.filter((e) => e.duplicateOf !== undefined);

  console.log(`\n=== ${locationId} ===`);
  console.log(`${snapshot.events.length} events in ${rel(path)}, ${dupes.length} scored as duplicates\n`);

  if (dupes.length === 0) continue;

  if (minArg === undefined) {
    console.log("what each threshold would hide:\n");
    for (const band of BANDS) {
      const hidden = dupes.filter((e) => (e.duplicateScore ?? 0) >= band.min);
      const fuzzy = hidden.filter((e) => byId.get(e.duplicateOf!)?.title.trim() !== e.title.trim()).length;
      console.log(
        `  >= ${band.min.toFixed(2)}  ${band.label.padEnd(9)} hides ${String(hidden.length).padStart(4)} row(s)` +
          `  (${String(fuzzy).padStart(3)} on titles that differ)   ${band.blurb}`,
      );
    }
    const kept = snapshot.events.length;
    console.log(
      `\n  of ${kept} events. Re-run with --min <score> to read the groups; --differing hides identical ones.`,
    );
    continue;
  }

  const shown = dupes
    .filter((e) => (e.duplicateScore ?? 0) >= minArg)
    .filter((e) => !differing || byId.get(e.duplicateOf!)?.title.trim() !== e.title.trim());

  // Group the duplicates under their canonical row so each cluster reads as one.
  const clusters = new Map<string, SnapshotEvent[]>();
  for (const event of shown) {
    const key = event.duplicateOf!;
    const list = clusters.get(key);
    if (list) list.push(event);
    else clusters.set(key, [event]);
  }

  console.log(`${shown.length} row(s) across ${clusters.size} event(s) at or above ${minArg}\n`);

  for (const [canonicalId, group] of clusters) {
    const canonical = byId.get(canonicalId);
    if (!canonical) continue;
    console.log(`${canonical.sortDate ?? "undated"}  ${canonical.venueName ?? "(no venue)"}`);
    console.log(`   keep       ${canonical.sourceId.padEnd(36)} ${canonical.title}`);
    for (const dup of group.sort((a, b) => (b.duplicateScore ?? 0) - (a.duplicateScore ?? 0))) {
      const identical = dup.title.trim() === canonical.title.trim();
      console.log(
        `   ${(dup.duplicateScore ?? 0).toFixed(2)} hide  ${dup.sourceId.padEnd(36)} ` +
          (identical ? "(identical title)" : dup.title),
      );
      if (dup.venueName && dup.venueName !== canonical.venueName) {
        console.log(`              ${" ".repeat(36)} at ${dup.venueName}`);
      }
    }
    console.log("");
  }
}
