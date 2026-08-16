import type { Occurrence, SnapshotEvent } from "./types";

/**
 * Turning the occurrence union into something a human reads.
 *
 * This is where the schema earns its keep. A one-night gig, a six-week play, a
 * weekly market and a permanent collection each need a different sentence, and
 * because they are different shapes in the data rather than nullable date
 * columns, the UI can simply switch on the kind instead of guessing.
 */

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

function parse(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatDay(date: string): string {
  return DAY.format(parse(date));
}

export function formatDate(date: string, withYear = false): string {
  return (withYear ? DAY_MONTH_YEAR : DAY_MONTH).format(parse(date));
}

export function formatMonth(date: string): string {
  return MONTH_YEAR.format(parse(date));
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The short form shown on a card's date block. */
export function occurrenceLabel(occurrence: Occurrence, asOf: string): string {
  switch (occurrence.kind) {
    case "single":
      return `${formatDay(occurrence.date)} ${formatDate(occurrence.date, !sameYear(occurrence.date, asOf))}`;
    case "run": {
      const started = !occurrence.start || occurrence.start <= asOf;
      // Once a run is under way, when it *ends* is the useful fact — "until 20
      // Oct" answers "can I still catch it?", which "1 Sep – 20 Oct" does not.
      if (started || !occurrence.start) {
        return `Until ${formatDate(occurrence.end, !sameYear(occurrence.end, asOf))}`;
      }
      return `${formatDate(occurrence.start)} – ${formatDate(occurrence.end, !sameYear(occurrence.end, asOf))}`;
    }
    case "recurring":
      return occurrence.pattern;
    case "ongoing":
      return "Ongoing";
    case "undated":
      return occurrence.note;
  }
}

function sameYear(a: string, b: string): boolean {
  return a.slice(0, 4) === b.slice(0, 4);
}

/** Time of day, when the source gave one. */
export function occurrenceTime(occurrence: Occurrence): string | undefined {
  switch (occurrence.kind) {
    case "single":
      return occurrence.endTime ? `${occurrence.startTime}–${occurrence.endTime}` : occurrence.startTime;
    case "recurring":
      return occurrence.startTime;
    default:
      return undefined;
  }
}

export function priceLabel(event: SnapshotEvent): string | undefined {
  if (!event.price) return undefined;
  if (event.price.free) return "Free";
  if (event.price.text) return event.price.text;
  if (event.price.min === undefined) return undefined;
  const symbol = event.price.currency === "EUR" ? "€" : event.price.currency === "USD" ? "$" : "£";
  if (event.price.max !== undefined && event.price.max !== event.price.min) {
    return `${symbol}${event.price.min}–${symbol}${event.price.max}`;
  }
  return `${symbol}${event.price.min}`;
}

/**
 * Which bucket an event belongs in. Dated events sit on a timeline; recurring,
 * ongoing and undated ones do not, and pretending otherwise is what makes
 * listings sites show a market as happening on one arbitrary Sunday.
 */
export type Bucket = "dated" | "regular" | "undated";

export function bucketOf(event: SnapshotEvent): Bucket {
  switch (event.occurrence.kind) {
    case "single":
    case "run":
      return "dated";
    case "recurring":
    case "ongoing":
      return "regular";
    case "undated":
      return "undated";
  }
}
