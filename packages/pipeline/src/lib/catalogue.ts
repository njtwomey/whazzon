import { basename } from "node:path";
import { CatalogueArtefact, type Catalogue, type Source } from "../schema/catalogue.js";
import { readArtefact } from "./files.js";
import { paths, rel, walk } from "./paths.js";

export interface LoadedCatalogue {
  path: string;
  catalogue: Catalogue;
  migrated: boolean;
  fromVersion: number;
}

export function catalogueFiles(locationId: string): string[] {
  return walk(paths.catalogueDir(locationId), ".yaml");
}

/** Load every category file for a location. Throws on the first invalid one. */
export function loadCatalogues(locationId: string): LoadedCatalogue[] {
  return catalogueFiles(locationId).map((path) => {
    const result = readArtefact(CatalogueArtefact, path);
    const expected = basename(path, ".yaml");
    if (result.data.category !== expected) {
      throw new Error(`${rel(path)}: declares category "${result.data.category}" but the filename says "${expected}"`);
    }
    return {
      path,
      catalogue: result.data,
      migrated: result.migrated,
      fromVersion: result.fromVersion,
    };
  });
}

/** Every source across every category, in catalogue order. */
export function loadSources(locationId: string): Source[] {
  return loadCatalogues(locationId).flatMap((loaded) => loaded.catalogue.sources);
}

/** Sources stage 2 should actually visit. */
export function harvestableSources(sources: Source[]): Source[] {
  return sources.filter((s) => s.status === "active" || s.status === "provisional");
}
