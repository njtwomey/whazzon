import { addDays, bucketOf } from "./format";
import type { SnapshotEvent } from "./types";

/**
 * The filtering itself: pure functions over events, with no React and no URL.
 * Kept separate from the `useFilters` hook so it can be tested directly — this
 * is the logic that decides what a person does and does not see, and it is
 * worth being sure about.
 */

export const SORT_OPTIONS = [
  { value: "date", label: "By date" },
  { value: "new", label: "Recently added" },
  { value: "venue", label: "By venue" },
] as const;

export type Sort = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Quick ranges, expressed against the snapshot's `asOf` date rather than the
 * browser clock — the data has an as-of date, and "next 7 days" has to mean
 * seven days from that, or the filter disagrees with what is on screen.
 */
export const DATE_PRESETS = [
  { label: "Next 7 days", days: 7 },
  { label: "Next 30 days", days: 30 },
  { label: "Next 3 months", days: 91 },
  { label: "Next year", days: 365 },
] as const;

export interface Filters {
  q: string;
  categories: string[];
  areas: string[];
  /** Event-level tags. Matches any selected tag, like the other facets. */
  tags: string[];
  /** Inclusive ISO date bounds. Absent means unbounded on that side. */
  from?: string;
  to?: string;
  /** Only things happening on the snapshot's as-of date. */
  onNow: boolean;
  sort: Sort;
  freeOnly: boolean;
  /** Events the source has stopped listing but which have not happened yet. */
  includeCarried: boolean;
  includeFinished: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  categories: [],
  areas: [],
  tags: [],
  onNow: false,
  sort: "date",
  freeOnly: false,
  includeCarried: true,
  includeFinished: false,
};

export function activeFilterCount(filters: Filters): number {
  let n = 0;
  if (filters.q) n += 1;
  n += filters.categories.length;
  n += filters.areas.length;
  n += filters.tags.length;
  if (filters.onNow) n += 1;
  if (filters.from || filters.to) n += 1;
  if (filters.freeOnly) n += 1;
  if (!filters.includeCarried) n += 1;
  if (filters.includeFinished) n += 1;
  return n;
}

/** Which preset, if any, the current range corresponds to. */
export function matchedPreset(filters: Filters, asOf: string): number | undefined {
  if (filters.from !== asOf || !filters.to) return undefined;
  return DATE_PRESETS.find((preset) => addDays(asOf, preset.days) === filters.to)?.days;
}

/**
 * Is this happening today?
 *
 * A run counts while it is under way, and a recurring or open-ended thing
 * counts because it is a live part of the city right now — a market that runs
 * every Sunday is on this week whether or not today is Sunday. Only genuinely
 * undated listings are excluded, because nothing can be said about them.
 */
export function isOnNow(event: SnapshotEvent, asOf: string): boolean {
  switch (event.occurrence.kind) {
    case "single":
      return event.occurrence.date === asOf;
    case "run":
      return (!event.occurrence.start || event.occurrence.start <= asOf) && event.occurrence.end >= asOf;
    case "recurring":
      return (
        (!event.occurrence.start || event.occurrence.start <= asOf) &&
        (!event.occurrence.end || event.occurrence.end >= asOf)
      );
    case "ongoing":
      return !event.occurrence.start || event.occurrence.start <= asOf;
    case "undated":
      return false;
  }
}

export function applyFilters(events: SnapshotEvent[], filters: Filters, asOf: string): SnapshotEvent[] {
  const needle = filters.q.trim().toLowerCase();

  const filtered = events.filter((event) => {
    if (event.state === "finished" && !filters.includeFinished) return false;
    if (event.state === "carried" && !filters.includeCarried) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(event.category)) return false;
    if (filters.areas.length > 0 && !(event.area && filters.areas.includes(event.area))) return false;
    if (filters.tags.length > 0 && !event.tags.some((tag) => filters.tags.includes(tag))) return false;
    if (filters.freeOnly && !event.price?.free) return false;
    if (filters.onNow && !isOnNow(event, asOf)) return false;

    if (filters.from || filters.to) {
      // Undated, ongoing and recurring events have no place on a timeline, so a
      // date window cannot include or exclude them honestly. They are kept:
      // hiding a weekly market because someone asked for "next 7 days" would be
      // wrong, since it *is* on in the next 7 days.
      if (bucketOf(event) === "dated") {
        const start = event.sortDate;
        const end = event.endDate ?? event.sortDate;
        // A range match is an overlap, not containment — a play running from
        // last month into next month is on during a window inside it.
        if (filters.to && start && start > filters.to) return false;
        if (filters.from && end && end < filters.from) return false;
      }
    } else if (!filters.includeFinished && event.endDate && event.endDate < asOf) {
      return false;
    }

    if (needle) {
      const haystack = `${event.title} ${event.venueName ?? ""} ${event.area ?? ""} ${event.summary}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });

  return sortEvents(filtered, filters.sort);
}

function sortEvents(events: SnapshotEvent[], sort: Sort): SnapshotEvent[] {
  const sorted = [...events];
  if (sort === "new") {
    sorted.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.title.localeCompare(b.title));
  } else if (sort === "venue") {
    sorted.sort(
      (a, b) =>
        (a.venueName ?? "").localeCompare(b.venueName ?? "") || (a.sortDate ?? "").localeCompare(b.sortDate ?? ""),
    );
  } else {
    sorted.sort((a, b) => {
      if (a.sortDate === b.sortDate) return a.title.localeCompare(b.title);
      if (!a.sortDate) return 1;
      if (!b.sortDate) return -1;
      return a.sortDate.localeCompare(b.sortDate);
    });
  }
  return sorted;
}
