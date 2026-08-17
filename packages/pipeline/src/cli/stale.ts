import { harvestableSources, loadSources } from "../lib/catalogue.js";
import { foldHarvests } from "../lib/fold.js";
import { resolveLocations } from "../lib/locations.js";
import { CADENCE_DAYS } from "../schema/common.js";

/**
 * The stage 2 worklist: which sources are due a visit, given each one's
 * cadence and when it was last observed.
 *
 * This is what keeps stage 2 affordable. A full re-harvest of every source is
 * expensive; most of the catalogue does not change daily, and the cadence
 * field on each source is the judgement about how often it is worth looking.
 *
 *   npm run stale -- gb-bristol            due now, grouped by category
 *   npm run stale -- gb-bristol --all      every source with its last visit
 *   npm run stale -- gb-bristol --ids      bare ids, one per line, for scripting
 */

const { locations, rest } = resolveLocations();
const showAll = rest.includes("--all");
const idsOnly = rest.includes("--ids");

const today = new Date();

function daysSince(date: string): number {
  const then = new Date(`${date}T00:00:00Z`).getTime();
  return Math.floor((today.getTime() - then) / 86_400_000);
}

for (const locationId of locations) {
  const sources = harvestableSources(loadSources(locationId));
  const fold = foldHarvests(locationId);

  const rows = sources.map((source) => {
    const last = fold.sources.get(source.id)?.lastHarvest;
    const age = last ? daysSince(last) : undefined;
    const due = CADENCE_DAYS[source.cadence];
    return { source, last, age, due, stale: age === undefined || age >= due };
  });

  const stale = rows.filter((r) => r.stale);

  if (idsOnly) {
    for (const row of stale) console.log(row.source.id);
    continue;
  }

  console.log(`\n=== ${locationId} ===`);

  const shown = showAll ? rows : stale;
  const byCategory = new Map<string, typeof rows>();
  for (const row of shown) {
    const list = byCategory.get(row.source.category) ?? [];
    list.push(row);
    byCategory.set(row.source.category, list);
  }

  for (const [category, list] of [...byCategory].sort()) {
    console.log(`\n${category}`);
    for (const row of list) {
      const age = row.last === undefined ? "never harvested" : `${row.age}d ago (${row.last})`;
      console.log(
        `  ${row.stale ? "DUE " : "    "} ${row.source.id.padEnd(38)} ${row.source.cadence.padEnd(10)} ${age}`,
      );
    }
  }

  console.log(
    `\n${stale.length}/${rows.length} sources due` +
      (stale.length === rows.length ? " — nothing has been harvested yet" : ""),
  );
}
