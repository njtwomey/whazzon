import { z } from "zod";
import { Cadence, HttpUrl, PostalAddress, Slug, SourceId } from "./common.js";
import { defineArtefact } from "./versioning.js";

/**
 * Stage 1 output: who exists in this place. Slow-moving, human-curated.
 *
 * One file per category under data/catalogue/. A "source" is anything with a
 * URL worth crawling — usually a venue, but festivals, organisers and listings
 * sites are first-class too, because a lot of what happens in a city never
 * appears on any venue's own website.
 */

export const SourceKind = z.enum([
  /** A physical place with its own programme: Tobacco Factory Theatres. */
  "venue",
  /** Recurs on a calendar, may be venue-less: Bristol Harbour Festival. */
  "festival",
  /** Lists events across many venues: Headfirst, Visit Bristol. */
  "aggregator",
  /** Promoter or company that programmes into other people's venues. */
  "organiser",
  /** Official/institutional listing: council, library service. */
  "listing",
]);

export const SourceStatus = z.enum([
  /** Confirmed good: fetched successfully and reviewed by a human. */
  "active",
  /** Proposed by stage 1, not yet verified. New entries start here. */
  "provisional",
  /** Still exists but has not listed anything for a long time. */
  "dormant",
  /** Gone. Kept in the catalogue so it is not re-proposed every run. */
  "closed",
]);

const SourceV1 = z.strictObject({
  /** `<category>/<slug>`. Stable forever — this key joins every stage. */
  id: SourceId,
  name: z.string().min(1),
  category: Slug,
  kind: SourceKind,
  status: SourceStatus,

  /** The page that actually lists events — not the homepage, where possible. */
  url: HttpUrl,
  /** Front door, when it differs from the listings page. */
  homepage: HttpUrl.optional(),
  /** Logo or emblem shown on the card. */
  icon: HttpUrl.optional(),

  /** Neighbourhood, for filtering and for the "near me" story later. */
  area: z.string().optional(),
  /**
   * Physical location. Absent for sources that have none — aggregators,
   * city-wide festivals, touring companies — and often absent at first for
   * ones that do: stage 1 proposes sources from general knowledge, and stage 2
   * can fill this in from the venue's own page, which is authoritative.
   * Never guess an address to fill the field.
   */
  address: PostalAddress.optional(),
  /** Free-text tags used by the UI for secondary filtering. */
  tags: z.array(Slug).default([]),

  cadence: Cadence,

  /**
   * Injected verbatim into the stage 2 prompt for this source only. The
   * escape hatch that keeps prompt templates general: prefer adding a hint
   * here over forking a prompt.
   *
   *   "Books roughly a year ahead; capture the full forward horizon."
   *   "Listings are inside a JS calendar widget; look for the JSON-LD block."
   */
  hints: z.string().optional(),

  /** Why this source is in the catalogue, for the human reviewing it. */
  notes: z.string().optional(),

  /** Date this source entered the catalogue. */
  addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Date a human last confirmed the URL and programme are real. */
  verifiedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type Source = z.infer<typeof SourceV1>;

const CatalogueV1 = z
  .strictObject({
    schema: z.string(),
    category: Slug,
    label: z.string().min(1),
    description: z.string().optional(),
    sources: z.array(SourceV1),
  })
  .superRefine((cat, ctx) => {
    const seen = new Map<string, number>();
    cat.sources.forEach((source, i) => {
      if (source.category !== cat.category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sources", i, "category"],
          message: `is "${source.category}" but this file is the "${cat.category}" catalogue`,
        });
      }
      if (!source.id.startsWith(`${source.category}/`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sources", i, "id"],
          message: `must start with "${source.category}/" to match its category`,
        });
      }
      const previous = seen.get(source.id);
      if (previous !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sources", i, "id"],
          message: `duplicate id, already used by sources[${previous}]`,
        });
      }
      seen.set(source.id, i);
    });
  });

export type Catalogue = z.infer<typeof CatalogueV1>;

export const CatalogueArtefact = defineArtefact<Catalogue>({
  kind: "whazzon.catalogue",
  versions: { 1: CatalogueV1 },
  migrations: {},
  latest: CatalogueV1,
});
