import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { eventId } from "../lib/eventId.js";
import { writeArtefact } from "../lib/files.js";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import { HarvestArtefact } from "../schema/harvest.js";
import { SchemaError } from "../schema/versioning.js";

/**
 * Fills in the `id` on any harvested event that lacks one.
 *
 * Event ids are a sha of source + normalised title + anchor date, which is not
 * something a human or an agent can compute while writing YAML. Stage 2 writes
 * observations without ids and runs this over the whole run directory; the
 * result is validated on write, so a malformed harvest is caught here rather
 * than three stages downstream.
 *
 * Idempotent: events that already have an id are left alone, so it is safe to
 * re-run as further categories land.
 *
 *   npm run assign-ids -- bristol-uk --date 2026-08-16
 *   npm run assign-ids -- bristol-uk --date 2026-08-16 --category music
 */

const { locations, rest } = resolveLocations();
const dateArg = rest.includes("--date") ? rest[rest.indexOf("--date") + 1] : undefined;
const categoryArg = rest.includes("--category") ? rest[rest.indexOf("--category") + 1] : undefined;
const date = dateArg ?? new Date().toISOString().slice(0, 10);

for (const locationId of locations) {
  const dir = paths.harvestRunDir(locationId, date);
  if (!existsSync(dir)) {
    console.error(`no harvest for ${date} — expected ${rel(dir)}`);
    process.exit(1);
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .filter((f) => !categoryArg || f === `${categoryArg}.yaml`)
    .sort();

  if (files.length === 0) {
    console.error(`no category files in ${rel(dir)}${categoryArg ? ` matching "${categoryArg}"` : ""}`);
    process.exit(1);
  }

  let total = 0;
  const failures: { path: string; issues: string[] }[] = [];

  for (const file of files) {
    const path = join(dir, file);
    const raw = parse(readFileSync(path, "utf8")) as {
      observations: { sourceId: string; events?: { id?: string; title: string; occurrence: unknown }[] }[];
    };

    let assigned = 0;
    for (const observation of raw.observations ?? []) {
      for (const event of observation.events ?? []) {
        if (event.id) continue;
        event.id = eventId(observation.sourceId, event.title, event.occurrence as never);
        assigned += 1;
      }
    }

    // Keep going after a bad file. A fan-out writes sixteen of these at once,
    // and stopping at the first fault means sixteen round trips to find them
    // all — one pass should show everything that needs fixing.
    try {
      writeArtefact(HarvestArtefact, path, raw as never);
      total += assigned;
      console.log(`  ok    ${rel(path)}: ${assigned} id(s)`);
    } catch (error) {
      const issues = error instanceof SchemaError ? error.issues : [String(error)];
      failures.push({ path: rel(path), issues });
      console.log(`  FAIL  ${rel(path)}: ${issues.length} problem(s)`);
    }
  }

  console.log(
    `\n${locationId} ${date}: assigned ${total} id(s) across ${files.length - failures.length}/${files.length} categories`,
  );

  if (failures.length > 0) {
    console.log(`\n${failures.length} file(s) did not validate — fix the data, not the schema:\n`);
    for (const failure of failures) {
      console.log(`  ${failure.path}`);
      for (const issue of failure.issues.slice(0, 20)) console.log(`    - ${issue}`);
      if (failure.issues.length > 20) console.log(`    ... and ${failure.issues.length - 20} more`);
      console.log("");
    }
    process.exitCode = 1;
  }
}
