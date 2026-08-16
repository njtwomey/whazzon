/**
 * The contract between the pipeline and the app is `whazzon.snapshot/1`, and it
 * is defined once — in the pipeline's zod schema. Re-exporting the inferred
 * types here (type-only, so nothing is bundled) means a field added to the
 * snapshot cannot silently drift out of step with the UI: the build breaks.
 */
export type { Snapshot, SnapshotEvent } from "@pipeline/schema/snapshot";
export type { Occurrence } from "@pipeline/schema/harvest";

/** One entry in web/public/snapshots/index.json, written by `sync-web`. */
export interface LocationSummary {
  id: string;
  name: string;
  region: string;
  country: string;
  /** Published path of the location's hero image, relative to the app base. */
  imageUrl?: string;
  imageCredit?: string;
  asOf: string;
  eventCount: number;
  sourceCount: number;
  categoryCount: number;
  topCategories: string[];
}
