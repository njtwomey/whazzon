import { createHash } from "node:crypto";
import type { Occurrence } from "../schema/harvest.js";

/**
 * Events get a deterministic id derived from their content, not a counter or
 * a random uuid. Re-harvesting the same listings page next week must produce
 * the same ids for the same events, or every refresh looks like a page full of
 * new events and dedup at compile time becomes guesswork.
 *
 * The id is deliberately built from the fields least likely to be re-worded
 * between scrapes: the source, a normalised title, and the anchor date.
 */
export function eventId(sourceId: string, title: string, occurrence: Occurrence): string {
  const key = [sourceId, normaliseTitle(title), anchorDate(occurrence)].join("|");
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 10);
  return `${sourceId}#${digest}`;
}

/**
 * Strip the decoration venues add and remove between weeks — "SOLD OUT",
 * presenter prefixes, punctuation, casing — so cosmetic edits do not fork the
 * identity of an event.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(sold out|cancelled|postponed|rescheduled|new date|extra date)\b/g, "")
    .replace(/\bpresents?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The single date that anchors an event's identity. */
export function anchorDate(occurrence: Occurrence): string {
  switch (occurrence.kind) {
    case "single":
      return occurrence.date;
    case "run":
      // A run with no stated start is identified by when it ends, which is the
      // only date the source gave us.
      return occurrence.start ?? `until:${occurrence.end}`;
    case "recurring":
      return occurrence.start ?? `recurring:${occurrence.pattern}`;
    case "ongoing":
      return occurrence.start ?? "ongoing";
    case "undated":
      return `undated:${occurrence.note}`;
  }
}
