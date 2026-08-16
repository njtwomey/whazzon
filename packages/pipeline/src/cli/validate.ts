import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";
import { readArtefact } from "../lib/files.js";
import { loadLocation, resolveLocations } from "../lib/locations.js";
import { paths, rel, walk } from "../lib/paths.js";
import { CatalogueArtefact } from "../schema/catalogue.js";
import { HarvestArtefact } from "../schema/harvest.js";
import type { Source } from "../schema/catalogue.js";
import type { VersionedArtefact } from "../schema/versioning.js";
import { SchemaError } from "../schema/versioning.js";

/**
 * Validates every committed data file against its schema, then runs the
 * cross-file checks no single-file schema can express (ids unique across
 * categories, harvests pointing at sources that exist).
 *
 * Run after any hand-edit. Exits non-zero on error so it can gate a build.
 *
 *   npm run validate                 the only configured location
 *   npm run validate -- bristol-uk
 *   npm run validate -- --all
 */

interface Problem {
  path: string;
  message: string;
  detail?: string[];
}

const errors: Problem[] = [];
const warnings: Problem[] = [];
const behind: string[] = [];

function check<T>(artefact: VersionedArtefact<T>, path: string): T | undefined {
  try {
    const result = readArtefact(artefact, path);
    if (result.migrated) {
      behind.push(`${rel(path)} (v${result.fromVersion} -> v${result.toVersion})`);
    }
    return result.data;
  } catch (error) {
    errors.push({
      path: rel(path),
      message: error instanceof Error ? error.message : String(error),
      detail: error instanceof SchemaError ? error.issues : undefined,
    });
    return undefined;
  }
}

const { locations } = resolveLocations();

for (const locationId of locations) {
  console.log(`\n=== ${locationId} ===`);

  try {
    loadLocation(locationId);
  } catch (error) {
    errors.push({
      path: rel(paths.config(locationId)),
      message: error instanceof Error ? error.message : String(error),
      detail: error instanceof SchemaError ? error.issues : undefined,
    });
    continue;
  }

  // --- catalogue ----------------------------------------------------------

  const sourcesById = new Map<string, string>();
  const sourcesByUrl = new Map<string, string>();
  const allSources: Source[] = [];

  const catalogueFiles = walk(paths.catalogueDir(locationId), ".yaml");
  if (catalogueFiles.length === 0) {
    warnings.push({
      path: rel(paths.catalogueDir(locationId)),
      message: "no catalogue files — run stage 1 to generate them",
    });
  }

  for (const path of catalogueFiles) {
    const catalogue = check(CatalogueArtefact, path);
    if (!catalogue) continue;

    const expected = basename(path, ".yaml");
    if (catalogue.category !== expected) {
      errors.push({
        path: rel(path),
        message: `declares category "${catalogue.category}" but the filename says "${expected}"`,
      });
    }

    for (const source of catalogue.sources) {
      allSources.push(source);

      const existing = sourcesById.get(source.id);
      if (existing) {
        errors.push({
          path: rel(path),
          message: `duplicate source id "${source.id}", already defined in ${existing}`,
        });
      } else {
        sourcesById.set(source.id, rel(path));
      }

      // Two catalogue entries pointing at one URL means stage 2 pays twice for
      // the same page and the site shows the same event under two venues.
      const url = source.url.replace(/\/$/, "");
      const owner = sourcesByUrl.get(url);
      if (owner && owner !== source.id) {
        warnings.push({
          path: rel(path),
          message: `"${source.id}" shares a URL with "${owner}" — one of them is probably redundant`,
        });
      } else {
        sourcesByUrl.set(url, source.id);
      }
    }
  }

  // --- harvest ------------------------------------------------------------

  const harvestFiles = walk(paths.harvestDir(locationId), ".yaml");
  let observations = 0;
  let events = 0;

  for (const path of harvestFiles) {
    const run = check(HarvestArtefact, path);
    if (!run) continue;

    observations += run.observations.length;
    events += run.observations.reduce((n, o) => n + o.events.length, 0);

    const category = basename(path, ".yaml");
    const day = basename(dirname(path));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      errors.push({
        path: rel(path),
        message: `harvest files live in a date directory: harvest/YYYY-MM-DD/<category>.yaml`,
      });
    } else if (run.date !== day) {
      errors.push({
        path: rel(path),
        message: `declares date "${run.date}" but the directory says "${day}"`,
      });
    }
    if (run.category !== category) {
      errors.push({
        path: rel(path),
        message: `declares category "${run.category}" but the filename says "${category}"`,
      });
    }

    if (run.locationId !== locationId) {
      errors.push({
        path: rel(path),
        message: `declares locationId "${run.locationId}" but sits under "${locationId}"`,
      });
    }

    for (const observation of run.observations) {
      if (!sourcesById.has(observation.sourceId)) {
        errors.push({
          path: rel(path),
          message: `observes "${observation.sourceId}", which is not in this location's catalogue`,
        });
      }
    }
  }

  const byStatus = new Map<string, number>();
  for (const source of allSources) {
    byStatus.set(source.status, (byStatus.get(source.status) ?? 0) + 1);
  }

  console.log(
    `${catalogueFiles.length} categories, ${allSources.length} sources` +
      (byStatus.size ? ` (${[...byStatus].map(([status, n]) => `${n} ${status}`).join(", ")})` : "") +
      `, ${harvestFiles.length} harvest file(s), ${observations} observations, ${events} events`,
  );
}

// --- report ---------------------------------------------------------------

console.log("");
for (const warning of warnings) {
  console.warn(`warn  ${warning.path}\n      ${warning.message}`);
}
for (const error of errors) {
  console.error(`ERROR ${error.path}\n      ${error.message}`);
  for (const line of error.detail ?? []) console.error(`        - ${line}`);
}

if (behind.length > 0) {
  console.log(`\n${behind.length} file(s) behind the current schema — run \`npm run migrate\`:`);
  for (const line of behind) console.log(`  ${line}`);
}

console.log(
  errors.length === 0
    ? `ok — ${warnings.length} warning(s)`
    : `FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`,
);

process.exit(errors.length === 0 ? 0 : 1);
