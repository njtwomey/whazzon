import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel, walk } from "../lib/paths.js";
import { ARTEFACTS } from "../schema/index.js";
import { parseSchemaHeader } from "../schema/versioning.js";

/**
 * Rewrites every data file at the latest schema version, applying the
 * migration chain declared alongside each artefact.
 *
 * This is the tool that makes schema changes affordable: change a schema, add
 * a migration, run this once, review the diff. Files are only rewritten when
 * they are actually behind, so a no-op run produces an empty diff.
 *
 *   npm run migrate -- gb-bristol            report what would change
 *   npm run migrate -- gb-bristol --write    apply it
 *   npm run migrate -- --all --write         every location
 */

const { locations, rest } = resolveLocations();
const write = rest.includes("--write");

const files = locations.flatMap((locationId) => [
  paths.config(locationId),
  ...walk(paths.catalogueDir(locationId), ".yaml"),
  ...walk(paths.harvestDir(locationId), ".yaml"),
]);

let migrated = 0;
let current = 0;
let failed = 0;

for (const path of files) {
  let raw: unknown;
  try {
    raw = parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`ERROR ${rel(path)}: unreadable — ${(error as Error).message}`);
    failed += 1;
    continue;
  }

  let header;
  try {
    header = parseSchemaHeader((raw as Record<string, unknown>)?.schema);
  } catch (error) {
    console.error(`ERROR ${rel(path)}: ${(error as Error).message}`);
    failed += 1;
    continue;
  }

  const artefact = ARTEFACTS[header.kind];
  if (!artefact) {
    console.error(`ERROR ${rel(path)}: unknown artefact kind "${header.kind}"`);
    failed += 1;
    continue;
  }

  if (header.version === artefact.currentVersion) {
    current += 1;
    continue;
  }

  try {
    const result = artefact.parse(raw);
    migrated += 1;
    console.log(`${write ? "migrated" : "would migrate"} ${rel(path)}: v${result.fromVersion} -> v${result.toVersion}`);
    if (write) {
      const { schema, ...rest } = result.data as Record<string, unknown>;
      writeFileSync(
        path,
        stringify({ schema, ...rest }, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" }),
        "utf8",
      );
    }
  } catch (error) {
    console.error(`ERROR ${rel(path)}: migration failed — ${(error as Error).message}`);
    failed += 1;
  }
}

console.log(`\n${current} at current version, ${migrated} ${write ? "migrated" : "to migrate"}, ${failed} failed`);
if (migrated > 0 && !write) console.log(`re-run with --write to apply`);

process.exit(failed === 0 ? 0 : 1);
