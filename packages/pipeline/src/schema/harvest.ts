import { z } from "zod";
import {
  Confidence,
  Currency,
  HttpUrl,
  IsoDate,
  IsoDateTime,
  LocalTime,
  Markdown,
  PostalAddress,
  Slug,
  SourceId,
} from "./common.js";
import { defineArtefact } from "./versioning.js";

/**
 * Stage 2 output: what is on.
 *
 * One file per category per run:
 *
 *   data/<location>/harvest/<YYYY-MM-DD>/<category>.yaml
 *
 * Each holds one observation per source visited in that category. Files are
 * append-only log entries, never edited after writing — that is what lets
 * `fold.ts` rebuild the current picture from scratch at any time, and what
 * makes a partial run honest: if only twenty sources were due, only twenty
 * observations exist, and nothing has to be merged to say so.
 *
 * Splitting by category rather than by run is what makes the fan-out work. A
 * harvest runs one agent per category, and each writes its own file directly
 * instead of returning every event through the orchestrator's context. It also
 * means a category can be re-run on its own, and a failure in one loses
 * nothing from the others.
 *
 * The event schema below is the one that matters most. It is what an LLM
 * writes into, so it is strict enough to catch a sloppy extraction and loose
 * enough to represent a real listings page.
 */

/**
 * When something happens. A discriminated union rather than a nullable
 * start/end pair, because "one gig on Friday", "a play running for six weeks",
 * "every Tuesday", and "the permanent collection" are genuinely different
 * things, and flattening them into two date columns is what makes listings
 * sites render nonsense like a three-month concert.
 */
export const Occurrence = z.discriminatedUnion("kind", [
  /** A single sitting. The common case for gigs, screenings, talks. */
  z.strictObject({
    kind: z.literal("single"),
    date: IsoDate,
    /** Local start time as printed by the venue, when given. */
    startTime: LocalTime.optional(),
    endTime: LocalTime.optional(),
  }),

  /**
   * A continuous run ending on a known date: a play, a dated exhibition, a
   * festival. Individual performance times usually vary across the run, so
   * they belong in `timesText`, not here.
   *
   * `start` is optional because listings routinely say only "Until Thu 20 Aug"
   * for something already running. That is a complete fact, and requiring a
   * start would force an extractor to invent one — the exact failure this
   * schema exists to prevent. Absent start means "already under way".
   */
  z.strictObject({
    kind: z.literal("run"),
    start: IsoDate.optional(),
    end: IsoDate,
  }),

  /** Repeats on a pattern the listing describes in words. */
  z.strictObject({
    kind: z.literal("recurring"),
    /** Human description exactly as the source puts it: "every Tuesday". */
    pattern: z.string().min(1),
    start: IsoDate.optional(),
    end: IsoDate.optional(),
    startTime: LocalTime.optional(),
  }),

  /** Open-ended: permanent collections, long-run installations. */
  z.strictObject({
    kind: z.literal("ongoing"),
    start: IsoDate.optional(),
  }),

  /**
   * The listing is real but gives no usable date. Explicitly modelled so an
   * extractor never has to invent one to satisfy the schema — a guessed date
   * is far more damaging than a recorded absence.
   */
  z.strictObject({
    kind: z.literal("undated"),
    /** What the source said instead: "coming soon", "autumn 2026". */
    note: z.string().min(1),
  }),
]);

export type Occurrence = z.infer<typeof Occurrence>;

export const EventStatus = z.enum(["scheduled", "cancelled", "postponed", "sold-out", "rescheduled"]);

export const Price = z.strictObject({
  /** Whether entry is free. Set explicitly; do not infer from a zero price. */
  free: z.boolean(),
  /** Price string exactly as printed: "£12 / £9 concessions". */
  text: z.string().optional(),
  /** Cheapest and dearest ticket in major units, when parseable. */
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: Currency.optional(),
});

const EventV1 = z
  .strictObject({
    /**
     * Deterministic id derived from sourceId + title + first date. Stable
     * across harvests so the same event re-scraped next week is recognised
     * rather than duplicated. See lib/eventId.ts.
     */
    id: z.string().min(1),
    /** Catalogue source this came from. Joins back to stage 1. */
    sourceId: SourceId,

    title: z.string().min(1),
    /** The source's own sub-classification: "Live Music", "Matinee". */
    subcategory: z.string().optional(),

    occurrence: Occurrence,
    status: EventStatus,

    /**
     * Performance times across a run, verbatim: "Tue-Sat 7.30pm, Sat mat
     * 2.30pm". Kept as text because parsing it reliably is not worth the
     * wrong answers.
     */
    timesText: z.string().optional(),

    /**
     * Only set when the event happens somewhere other than the source that
     * listed it — an aggregator advertising a gig at a venue across town, a
     * festival programming into borrowed spaces, a touring company.
     *
     * OMIT IT when the event is at the source itself, which is the common
     * case. The source's name, area and address live in the catalogue, and
     * copying them onto every event would both bloat the log and let them go
     * stale the moment the catalogue is corrected. The compile step joins the
     * two and denormalises for the UI; the harvest log stays normalised.
     */
    venue: z
      .strictObject({
        /**
         * Preferred when the venue is itself catalogued: the id alone is
         * enough to resolve name, area and address at compile time.
         */
        sourceId: SourceId.optional(),
        /** For a place not in the catalogue — a warehouse, a park, a hall. */
        name: z.string().min(1).optional(),
        area: z.string().optional(),
        address: PostalAddress.optional(),
      })
      .refine(
        (v) => v.sourceId !== undefined || v.name !== undefined,
        "needs either a sourceId (catalogued venue) or a name (somewhere else)",
      )
      .optional(),

    /** Deep link to this event, not the listings page it was found on. */
    url: HttpUrl.optional(),
    /** Promotional image for the card. */
    image: HttpUrl.optional(),

    price: Price.optional(),
    ageRestriction: z.string().optional(),
    tags: z.array(Slug).default([]),

    /**
     * The listing text as extracted, in markdown, links and emphasis intact.
     * Never HTML — the web app renders markdown, so nothing scraped is ever
     * concatenated into the page as markup.
     */
    raw: Markdown,
    /** The model's own short description. What fills a card. */
    summary: Markdown,

    /**
     * How sure the extractor is that this row is correct. `low` means the
     * page was ambiguous — the UI can de-emphasise these rather than
     * discarding information.
     */
    confidence: Confidence,
  })
  .superRefine((event, ctx) => {
    const o = event.occurrence;
    if (o.kind === "run" && o.start && o.end < o.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["occurrence", "end"],
        message: `ends (${o.end}) before it starts (${o.start})`,
      });
    }
    if (o.kind === "recurring" && o.start && o.end && o.end < o.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["occurrence", "end"],
        message: `ends (${o.end}) before it starts (${o.start})`,
      });
    }
    if (event.price) {
      const { free, min, max } = event.price;
      if (free && (min ?? 0) > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price", "min"],
          message: `marked free but has a non-zero minimum price`,
        });
      }
      if (min !== undefined && max !== undefined && max < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price", "max"],
          message: `maximum (${max}) is below minimum (${min})`,
        });
      }
    }
  });

export type WhazzonEvent = z.infer<typeof EventV1>;

/** Outcome of the fetch itself, recorded whether or not it worked. */
const FetchResultV1 = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    url: HttpUrl,
    status: z.number().int(),
    /** Hash of the fetched text, to skip re-extraction when nothing changed. */
    contentHash: z.string().optional(),
  }),
  z.strictObject({
    ok: z.literal(false),
    url: HttpUrl,
    status: z.number().int().optional(),
    /**
     * Why it failed. A failed fetch is still recorded: a silent gap in the
     * data is worse than a recorded failure, because it looks identical to
     * "this venue has nothing on".
     */
    error: z.string().min(1),
  }),
]);

/** One source, visited once. The unit of work in a harvest run. */
const ObservationV1 = z
  .strictObject({
    sourceId: SourceId,
    fetch: FetchResultV1,
    events: z.array(EventV1).default([]),
    /** Anything the extractor wants the human reviewer to know. */
    notes: z.string().optional(),
  })
  .superRefine((observation, ctx) => {
    if (!observation.fetch.ok && observation.events.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["events"],
        message: `fetch failed but ${observation.events.length} events were recorded — events cannot come from a failed fetch`,
      });
    }
    const seen = new Map<string, number>();
    observation.events.forEach((event, i) => {
      if (event.sourceId !== observation.sourceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", i, "sourceId"],
          message: `is "${event.sourceId}" but this observation is of "${observation.sourceId}"`,
        });
      }
      const previous = seen.get(event.id);
      if (previous !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", i, "id"],
          message: `duplicate event id, already used by events[${previous}]`,
        });
      }
      seen.set(event.id, i);
    });
  });

export type Observation = z.infer<typeof ObservationV1>;

const HarvestRunV1 = z
  .strictObject({
    schema: z.string(),
    /** Which location this belongs to — carried so the file stands alone. */
    locationId: Slug,
    /** The run's date. Must match the containing directory. */
    date: IsoDate,
    /** The category harvested. Must match the filename. */
    category: Slug,
    harvestedAt: IsoDateTime,
    /** Prompt template and version used, so a bad batch can be traced. */
    prompt: z.strictObject({ name: z.string().min(1), version: z.string().min(1) }).optional(),
    /** Model that did the extraction, for the same reason. */
    model: z.string().optional(),
    observations: z.array(ObservationV1),
  })
  .superRefine((run, ctx) => {
    const seen = new Map<string, number>();
    run.observations.forEach((observation, i) => {
      const previous = seen.get(observation.sourceId);
      if (previous !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["observations", i, "sourceId"],
          message: `observed twice in one run, already at observations[${previous}]`,
        });
      }
      seen.set(observation.sourceId, i);
    });
    if (!run.harvestedAt.startsWith(run.date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["harvestedAt"],
        message: `is ${run.harvestedAt} but the run date is ${run.date}`,
      });
    }
    // A category file may only contain that category's sources. Without this a
    // fan-out could quietly write theatre results into the cinema file, and
    // nothing downstream would notice.
    run.observations.forEach((observation, i) => {
      if (!observation.sourceId.startsWith(`${run.category}/`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["observations", i, "sourceId"],
          message: `is not in the "${run.category}" category, but this is the ${run.category} file`,
        });
      }
    });
  });

export type HarvestRun = z.infer<typeof HarvestRunV1>;

export const HarvestArtefact = defineArtefact<HarvestRun>({
  kind: "whazzon.harvest",
  versions: { 1: HarvestRunV1 },
  migrations: {},
  latest: HarvestRunV1,
});
