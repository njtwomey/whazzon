import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * whazzon is multi-location. Everything below the top level is keyed by a
 * location id, so a second city is a new config file and a new data directory
 * rather than a fork of the project:
 *
 *   configs/bristol-uk.yaml                        the place
 *   data/bristol-uk/catalogue/<category>.yaml      stage 1
 *   data/bristol-uk/harvest/<date>/<category>.yaml stage 2
 *   data/bristol-uk/snapshot.json                  compiled for stage 3
 *
 * No path in the project may reach into another location's data.
 */

/** Repo root, found by walking up to the directory holding package.json. */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("could not locate repo root");
    dir = parent;
  }
  return dir;
}

export const paths = {
  root: () => repoRoot(),
  configsDir: () => join(repoRoot(), "configs"),
  config: (locationId: string) => join(repoRoot(), "configs", `${locationId}.yaml`),
  dataDir: () => join(repoRoot(), "data"),
  locationDir: (locationId: string) => join(repoRoot(), "data", locationId),
  catalogueDir: (locationId: string) => join(repoRoot(), "data", locationId, "catalogue"),
  harvestDir: (locationId: string) => join(repoRoot(), "data", locationId, "harvest"),
  /** One directory per run date, holding one file per category. */
  harvestRunDir: (locationId: string, date: string) => join(repoRoot(), "data", locationId, "harvest", date),
  harvestFile: (locationId: string, date: string, category: string) =>
    join(repoRoot(), "data", locationId, "harvest", date, `${category}.yaml`),
  snapshot: (locationId: string) => join(repoRoot(), "data", locationId, "snapshot.json"),
  promptsDir: () => join(repoRoot(), "prompts"),
};

/** All files under `dir` matching `ext`, recursively. Sorted, stable order. */
export function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, ext));
    } else if (entry.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

/** Path relative to the repo root, for readable log output. */
export function rel(path: string): string {
  return resolve(path).slice(repoRoot().length + 1);
}
