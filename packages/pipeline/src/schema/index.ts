import { CatalogueArtefact } from "./catalogue.js";
import { HarvestArtefact } from "./harvest.js";
import { LocationArtefact } from "./location.js";
import { SnapshotArtefact } from "./snapshot.js";
import type { VersionedArtefact } from "./versioning.js";

export * from "./common.js";
export * from "./versioning.js";
export * from "./location.js";
export * from "./catalogue.js";
export * from "./harvest.js";
export * from "./snapshot.js";

/**
 * Every artefact kind whazzon reads or writes. `validate` and `migrate` walk
 * this registry, so a new artefact kind becomes covered by both the moment it
 * is added here.
 */
export const ARTEFACTS: Record<string, VersionedArtefact<any>> = {
  [LocationArtefact.kind]: LocationArtefact,
  [CatalogueArtefact.kind]: CatalogueArtefact,
  [HarvestArtefact.kind]: HarvestArtefact,
  [SnapshotArtefact.kind]: SnapshotArtefact,
};
