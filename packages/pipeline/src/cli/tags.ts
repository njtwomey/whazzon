import { foldHarvests } from "../lib/fold.js";
import { resolveLocations } from "../lib/locations.js";

/**
 * The tag vocabulary already in use, and the near-duplicates creeping into it.
 *
 * Stage 2 is told to reuse existing tags rather than invent parallel ones, and
 * this is how it finds out what they are — without it, that instruction cannot
 * be followed and the vocabulary drifts into `family` / `family-friendly` /
 * `for-families`, which makes tag filtering useless.
 *
 *   npm run tags -- gb-bristol           vocabulary with counts, plus warnings
 *   npm run tags -- gb-bristol --list    bare slugs, for pasting into a prompt
 */

const { locations, rest } = resolveLocations();
const bare = rest.includes("--list");

/**
 * Collapse a tag to a rough concept, so obvious variants land together.
 * Deliberately crude: this flags candidates for a human, it does not merge
 * anything. Over-reporting is cheap; a silent duplicate is not.
 */
function conceptOf(tag: string): string {
  return tag
    .replace(/-/g, "")
    .replace(/^(the|a)/, "")
    .replace(/(friendly|orientated|oriented|based)$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(es|s)$/, "");
}

for (const locationId of locations) {
  const counts = new Map<string, number>();
  for (const source of foldHarvests(locationId).sources.values()) {
    for (const { event } of source.events) {
      for (const tag of event.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (bare) {
    console.log(sorted.map(([tag]) => tag).join(", "));
    continue;
  }

  console.log(
    `\n=== ${locationId} — ${sorted.length} tags across ${[...counts.values()].reduce((a, b) => a + b, 0)} uses ===\n`,
  );
  for (const [tag, count] of sorted) {
    console.log(`  ${String(count).padStart(4)}  ${tag}`);
  }

  const byConcept = new Map<string, string[]>();
  for (const [tag] of sorted) {
    const concept = conceptOf(tag);
    byConcept.set(concept, [...(byConcept.get(concept) ?? []), tag]);
  }
  const drifting = [...byConcept.values()].filter((group) => group.length > 1);

  if (drifting.length > 0) {
    console.log(`\n${drifting.length} possible duplicate(s) — pick one and correct the others:`);
    for (const group of drifting) {
      console.log(`  ${group.map((tag) => `${tag} (${counts.get(tag)})`).join("  ·  ")}`);
    }
  }

  const singletons = sorted.filter(([, count]) => count === 1);
  if (singletons.length > sorted.length / 2 && sorted.length > 10) {
    console.log(
      `\nwarn  ${singletons.length}/${sorted.length} tags are used exactly once.` +
        `\n      A vocabulary that is mostly singletons cannot be filtered on.`,
    );
  }
}
