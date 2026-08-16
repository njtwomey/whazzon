import { z } from "zod";

/**
 * Shared leaf types. Deliberately regex-based rather than using zod's dated
 * helpers, so the schemas do not shift under us when zod changes its API — a
 * schema definition that quietly changes meaning between library versions
 * would defeat the point of versioning the files.
 */

/** Lowercase kebab, no leading/trailing/double dashes. Used for ids. */
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case");

/** `<category>/<slug>` — the stable identity of a catalogue source. */
export const SourceId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be <category>/<slug> in lowercase kebab-case");

/** Calendar date, no time, no zone: 2026-08-16 */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date, YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)), "not a real date");

/** Instant, always UTC with Z: 2026-08-16T09:30:00Z */
export const IsoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, "must be a UTC ISO datetime ending in Z")
  .refine((s) => !Number.isNaN(Date.parse(s)), "not a real datetime");

/**
 * Local wall-clock time as printed by the venue: 19:30. Kept separate from
 * IsoDateTime because most listings give a local time with no date maths
 * attached, and inventing a UTC instant from it loses information.
 */
export const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour local time, HH:MM");

export const HttpUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), "must be an http(s) URL");

/**
 * Markdown, not HTML. Everything user-facing is stored as markdown and
 * rendered by the web app, so scraped rich text survives without ever
 * concatenating raw HTML into the page.
 */
export const Markdown = z.string();

/**
 * Where something physically is. Every field is optional because a real
 * catalogue is always partly incomplete — a festival has no street address, a
 * new venue may only have a postcode — but an address that is present must not
 * be empty, so at least one field is required.
 *
 * `postcode` is the highest-value field: in the UK it is enough on its own for
 * a map link, a directions link, and for grouping venues by area.
 */
export const PostalAddress = z
  .strictObject({
    /** Street line(s), e.g. "1 Canon's Road" or "Great Western Dockyard". */
    street: z.string().min(1).optional(),
    /** Neighbourhood or district, e.g. "Harbourside". */
    locality: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    postcode: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    /** Set only from a real geocode — never guessed from the postcode. */
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  })
  .refine((a) => Object.values(a).some((v) => v !== undefined), "address is present but empty — omit it instead")
  .refine((a) => (a.lat === undefined) === (a.lon === undefined), "lat and lon must be given together");

export type PostalAddress = z.infer<typeof PostalAddress>;

export const Currency = z.enum(["GBP", "EUR", "USD"]);

/**
 * How often stage 2 revisits a source. `daily` is expensive — reserve it for
 * sources that genuinely change that often.
 */
export const Cadence = z.enum(["daily", "weekly", "monthly", "quarterly"]);

export const CADENCE_DAYS: Record<z.infer<typeof Cadence>, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
};

/** Confidence an LLM stage attaches to what it produced. */
export const Confidence = z.enum(["high", "medium", "low"]);
