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

/**
 * What a route into a source is for. Order of preference for stage 2 is a
 * judgement it makes per source, not a ranking encoded here — but as a rule the
 * structured routes are both cheaper and richer than the page a human reads.
 */
export const RouteRole = z.enum([
  /** A page a person can read, listing what is on. Always at least one. */
  "listings",
  /** JSON/GraphQL endpoint behind the listings page. Often the whole diary in one fetch. */
  "api",
  /** RSS or Atom. */
  "feed",
  /** iCalendar. Dates without any parsing, and subscribable. */
  "ics",
  /** Ticketing platform holding dates the venue's own site does not print. */
  "booking",
]);

export type RouteRole = z.infer<typeof RouteRole>;

const Route = z.strictObject({
  role: RouteRole,
  url: HttpUrl,
  /**
   * How to use this route, where it is not obvious. Operational detail that
   * would otherwise end up in `hints` as prose:
   *
   *   "needs a browser user-agent"
   *   "?pageSize=250 returns the whole diary in one fetch"
   */
  note: z.string().min(1).optional(),
});

export type Route = z.infer<typeof Route>;

/**
 * Every way in to a source, in declared order.
 *
 * A single listings page — which is what almost every source is — stays a bare
 * string, so the 155 entries written before this existed are untouched and a
 * simple source never pays for a complexity it does not have:
 *
 *   url: https://www.tobaccofactorytheatres.com/whats-on/
 *
 * A source with more than one way in gets the list, and each route says what it
 * is for. The routes are alternatives, not steps — a harvest picks the one that
 * suits it and records which in `fetch.url`:
 *
 *   url:
 *     - role: listings
 *       url: https://www.stanneshouse.org/whats-on/
 *     - role: api
 *       url: https://www.stanneshouse.org/wp-json/tribe/events/v1/events
 *       note: whole diary with body text; needs a browser user-agent
 *
 * Widening a field so that every previously-valid file is still valid is the
 * additive case, so this edits `whazzon.catalogue/1` in place rather than
 * minting a v2. Nothing on disk needs migrating; readers go through
 * `lib/routes.ts`, which normalises both forms to the same array.
 */
const SourceUrl = z.union([
  HttpUrl,
  z
    .array(Route)
    .min(2, "a single route is written as a plain string, not a one-item list")
    .superRefine((routes, ctx) => {
      // Without this, `primaryUrl` could hand the web app a JSON endpoint as
      // the link under an event title.
      if (!routes.some((route) => route.role === "listings")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `at least one route must have role "listings" — it is where a person is sent`,
        });
      }
      const seen = new Set<string>();
      routes.forEach((route, i) => {
        const key = route.url.replace(/\/+$/, "").toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "url"],
            message: "duplicate route — the same URL is already listed above",
          });
        }
        seen.add(key);
      });
    }),
]);

const SourceV1 = z.strictObject({
  /** `<category>/<slug>`. Stable forever — this key joins every stage. */
  id: SourceId,
  name: z.string().min(1),
  category: Slug,
  kind: SourceKind,
  status: SourceStatus,

  /**
   * How to reach what this source lists. A plain URL, or a list of roled
   * routes — see `SourceUrl`. Read it through `routesOf`/`primaryUrl` rather
   * than touching it directly, so both forms are handled in one place.
   */
  url: SourceUrl,
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
