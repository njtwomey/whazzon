import { z } from "zod";
import { HttpUrl, IsoDate, IsoDateTime, PostalAddress, Slug, SourceId } from "./common.js";
import { SourceKind, SourceStatus } from "./catalogue.js";
import { EventStatus, Occurrence, Price } from "./harvest.js";
import { Markdown } from "./common.js";
import { defineArtefact } from "./versioning.js";

/**
 * The compiled artefact stage 3 reads. Produced deterministically from the
 * catalogue and the harvest log — no network, no LLM — so it can always be
 * rebuilt from committed data.
 *
 * Deliberately denormalised: the web app should never have to join events back
 * to sources to draw a card. Everything a card needs is on the event.
 */

/**
 * Whether the source still lists an event, derived rather than stored.
 *
 *   listed    seen in this source's most recent harvest
 *   carried   seen before, absent from the latest harvest, date not yet passed
 *   finished  its date has passed
 *
 * `carried` is not the same as `status: cancelled` on the event: cancelled is
 * the venue telling us, carried is us inferring from silence. Most carries are
 * benign — a venue whose listings page only shows three months will drop a
 * show announced a year out, and it reappears later.
 */
export const EventState = z.enum(["listed", "carried", "finished"]);

const SnapshotEventV1 = z.strictObject({
  id: z.string().min(1),
  sourceId: SourceId,
  /** Denormalised from the catalogue so a card needs no lookup. */
  sourceName: z.string().min(1),
  category: Slug,
  categoryLabel: z.string().min(1),
  subcategory: z.string().optional(),

  title: z.string().min(1),
  occurrence: Occurrence,
  status: EventStatus,
  state: EventState,

  /**
   * The date this event is sorted and grouped by. For a run it is the start;
   * for undated and ongoing events it is absent, and the UI groups them
   * separately rather than pretending they belong on a timeline.
   */
  sortDate: IsoDate.optional(),
  /** Last day this event is relevant; absent when open-ended. */
  endDate: IsoDate.optional(),
  timesText: z.string().optional(),

  venueName: z.string().optional(),
  area: z.string().optional(),
  address: PostalAddress.optional(),

  url: HttpUrl.optional(),
  /**
   * The listing this event came from — the source's own `listings` route.
   *
   * The fallback for the very common case of an index that prints a title and a
   * date with nothing to click. Sending someone to the page that carried the
   * listing is a worse answer than the event's own page but a much better one
   * than a dead end, and it is honest: that page is where this came from.
   *
   * Optional only because a snapshot compiled before this field existed has no
   * value for it; `compile` always writes one.
   */
  sourceUrl: HttpUrl.optional(),
  image: HttpUrl.optional(),
  price: Price.optional(),
  ageRestriction: z.string().optional(),
  tags: z.array(Slug),

  raw: Markdown,
  summary: Markdown,
  /** The event's own page in full, where the harvest opened it. */
  description: Markdown.optional(),
  confidence: z.enum(["high", "medium", "low"]),

  /**
   * Other sources that listed this same event, when `compile` collapsed them.
   *
   * De-duplication is a presentation decision, so it happens on the way out and
   * never in the log — but the provenance has to survive it, or the snapshot
   * quietly claims one source knew something two did.
   */
  alsoListedBy: z.array(SourceId).optional(),

  /** Harvest date this event was first observed — the basis of "what's new". */
  firstSeen: IsoDate,
  /** Harvest date it was most recently observed. */
  lastSeen: IsoDate,
});

export type SnapshotEvent = z.infer<typeof SnapshotEventV1>;

const SnapshotCategoryV1 = z.strictObject({
  category: Slug,
  label: z.string().min(1),
  description: z.string().optional(),
  sourceCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
});

const SnapshotSourceV1 = z.strictObject({
  id: SourceId,
  name: z.string().min(1),
  category: Slug,
  kind: SourceKind,
  status: SourceStatus,
  url: HttpUrl,
  area: z.string().optional(),
  address: PostalAddress.optional(),
  tags: z.array(Slug),
  /** Most recent harvest date for this source, if it has ever been harvested. */
  lastHarvest: IsoDate.optional(),
  /** Set when the most recent harvest failed, so the UI can say so. */
  lastError: z.string().optional(),
});

const SnapshotV1 = z.strictObject({
  schema: z.string(),
  location: z.strictObject({
    id: Slug,
    name: z.string().min(1),
    region: z.string().min(1),
    country: z.string().min(1),
    timezone: z.string().min(1),
  }),
  generatedAt: IsoDateTime,
  /** The day the snapshot treats as "today" when deriving event state. */
  asOf: IsoDate,
  categories: z.array(SnapshotCategoryV1),
  sources: z.array(SnapshotSourceV1),
  events: z.array(SnapshotEventV1),
});

export type Snapshot = z.infer<typeof SnapshotV1>;

export const SnapshotArtefact = defineArtefact<Snapshot>({
  kind: "whazzon.snapshot",
  versions: { 1: SnapshotV1 },
  migrations: {},
  latest: SnapshotV1,
});
