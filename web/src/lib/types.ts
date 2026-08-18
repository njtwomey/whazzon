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
  /**
   * The city's own map banner, generated from its catalogue by `npm run banner`.
   * Optional: a location has one only once it has geocoded venues to plot.
   */
  bannerUrl?: string;
  /** The same map drawn dark. Absent for a location built before there was one. */
  bannerDarkUrl?: string;
  imageCredit?: string;
  asOf: string;
  eventCount: number;
  sourceCount: number;
  categoryCount: number;
  /**
   * Counted over the events in the snapshot rather than over the catalogue — a
   * catalogued venue with nothing listed is not somewhere you can go tonight.
   * Optional so an index written before these existed still parses.
   */
  venueCount?: number;
  areaCount?: number;
  tagCount?: number;
  topCategories: string[];
}
