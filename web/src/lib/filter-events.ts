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

/**
 * Every list facet is tri-state per value: off, included, or excluded.
 *
 * "Anything that isn't cinema" is a question people genuinely ask, and
 * checkboxes cannot express it — ticking the other fifteen categories is not
 * the same answer, because it also drops everything uncategorised and has to be
 * redone whenever a category appears.
 */
export type TriState = "off" | "include" | "exclude";

export interface Facet {
  include: string[];
  exclude: string[];
}

export const EMPTY_FACET: Facet = { include: [], exclude: [] };

export function stateOfValue(facet: Facet, value: string): TriState {
  if (facet.include.includes(value)) return "include";
  if (facet.exclude.includes(value)) return "exclude";
  return "off";
}

/**
 * Put a value into a given state, removing it from the other list.
 *
 * A value can never be in both lists — the UI offers a + and a − and either
 * replaces the other, so the impossible combination is not representable.
 */
export function withState(facet: Facet, value: string, next: TriState): Facet {
  const include = facet.include.filter((v) => v !== value);
  const exclude = facet.exclude.filter((v) => v !== value);
  if (next === "include") return { include: [...include, value], exclude };
  if (next === "exclude") return { include, exclude: [...exclude, value] };
  return { include, exclude };
}

/** Pressing the button a value is already in clears it. */
export function toggleState(facet: Facet, value: string, pressed: TriState): Facet {
  return withState(facet, value, stateOfValue(facet, value) === pressed ? "off" : pressed);
}

export function facetCount(facet: Facet): number {
  return facet.include.length + facet.exclude.length;
}

/**
 * Does an event's values satisfy a facet?
 *
 * Exclusion wins over inclusion: an event matching both an included and an
 * excluded value is dropped. That is the intuitive reading — "comedy, but not
 * late-night" should not return the late-night comedy.
 */
export function facetPasses(values: (string | undefined)[], facet: Facet): boolean {
  const present = values.filter((v): v is string => Boolean(v));
  if (facet.exclude.some((v) => present.includes(v))) return false;
  if (facet.include.length > 0 && !facet.include.some((v) => present.includes(v))) return false;
  return true;
}

/** Labels are terse because these sit three-across in a 256px rail. */
export const PRICE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Ticketed" },
] as const;

export type PriceFilter = (typeof PRICE_OPTIONS)[number]["value"];

/**
 * The floor on how much the extractor trusted its own reading.
 *
 * `confidence` is the one field on an event that is about the *harvest* rather
 * than the event, and it is honest about a real problem: some listings are a
 * date buried in a sentence, and the row recorded from one is a guess. Showing
 * everything is still the default, because a medium-confidence listing is
 * usually a correct listing with an ambiguous time — but someone who has been
 * caught out by one wants a way to stop seeing them.
 */
export const CONFIDENCE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "medium", label: "Med+" },
  { value: "high", label: "High" },
] as const;

export type ConfidenceFilter = (typeof CONFIDENCE_OPTIONS)[number]["value"];

/** How much confidence each level carries, for comparing against the floor. */
const CONFIDENCE_RANK: Record<SnapshotEvent["confidence"], number> = { low: 0, medium: 1, high: 2 };
const CONFIDENCE_FLOOR: Record<ConfidenceFilter, number> = { any: 0, medium: 1, high: 2 };

/**
 * How eagerly to hide a listing another source already carried.
 *
 * `compile` scores duplicates rather than deleting them, so this is where the
 * line actually gets drawn — and it can move without recompiling. The middle
 * setting is the default because duplication genuinely dilutes the thing: seeing
 * one evening three times makes a listing feel like noise. But the aggregators
 * that produce most of the duplication are also the safety net for events no
 * venue site carries, so "all" has to stay reachable.
 */
export const DUPLICATE_OPTIONS = [
  { value: "all", label: "All", threshold: 2, hint: "show every listing, duplicates included" },
  { value: "exact", label: "Exact", threshold: 1, hint: "hide only an identical title at the same venue" },
  { value: "balanced", label: "Balanced", threshold: 0.65, hint: "also hide one title contained in another" },
  { value: "eager", label: "Eager", threshold: 0.3, hint: "hide anything that looks like a duplicate at all" },
] as const;

export type DuplicateFilter = (typeof DUPLICATE_OPTIONS)[number]["value"];

const DUPLICATE_THRESHOLD: Record<DuplicateFilter, number> = Object.fromEntries(
  DUPLICATE_OPTIONS.map((o) => [o.value, o.threshold]),
) as Record<DuplicateFilter, number>;

export interface Filters {
  q: string;
  categories: Facet;
  areas: Facet;
  /** Matched against `venueName`, which compile denormalises from the source. */
  venues: Facet;
  tags: Facet;
  /** Inclusive ISO date bounds. Absent means unbounded on that side. */
  from?: string;
  to?: string;
  /** Only things happening on the snapshot's as-of date. */
  onNow: boolean;
  sort: Sort;
  price: PriceFilter;
  /** Events the source has stopped listing but which have not happened yet. */
  includeCarried: boolean;
  includeFinished: boolean;
  /**
   * Only events that link somewhere. A listings index that prints a title and a
   * date but no href leaves nothing to click through to, which is a dead end if
   * what you want is to book.
   */
  hasLink: boolean;
  /** Lowest extractor confidence worth showing. */
  confidence: ConfidenceFilter;
  /** How eagerly to hide a listing another source already carried. */
  duplicates: DuplicateFilter;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  categories: EMPTY_FACET,
  areas: EMPTY_FACET,
  venues: EMPTY_FACET,
  tags: EMPTY_FACET,
  onNow: false,
  sort: "date",
  price: "any",
  includeCarried: true,
  includeFinished: false,
  hasLink: false,
  confidence: "any",
  duplicates: "balanced",
};

export function activeFilterCount(filters: Filters): number {
  let n = 0;
  if (filters.q) n += 1;
  n += facetCount(filters.categories);
  n += facetCount(filters.areas);
  n += facetCount(filters.venues);
  n += facetCount(filters.tags);
  if (filters.onNow) n += 1;
  if (filters.from || filters.to) n += 1;
  if (filters.price !== "any") n += 1;
  if (!filters.includeCarried) n += 1;
  if (filters.includeFinished) n += 1;
  if (filters.hasLink) n += 1;
  if (filters.confidence !== "any") n += 1;
  if (filters.duplicates !== "balanced") n += 1;
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

    if (!facetPasses([event.category], filters.categories)) return false;
    if (!facetPasses([event.area], filters.areas)) return false;
    if (!facetPasses([event.venueName], filters.venues)) return false;
    if (!facetPasses(event.tags, filters.tags)) return false;

    if (filters.price === "free" && !event.price?.free) return false;
    // "Ticketed" means known to cost money, not merely "not marked free" — an
    // event with no price information should not be asserted to be either.
    if (filters.price === "paid" && event.price?.free !== false) return false;
    if (filters.onNow && !isOnNow(event, asOf)) return false;

    // A scored duplicate, hidden at or above the chosen threshold. The canonical
    // row has already absorbed anything only the duplicate carried, so nothing
    // is lost by hiding it.
    if (event.duplicateScore !== undefined && event.duplicateScore >= DUPLICATE_THRESHOLD[filters.duplicates]) {
      return false;
    }

    if (filters.hasLink && !event.url) return false;
    if (CONFIDENCE_RANK[event.confidence] < CONFIDENCE_FLOOR[filters.confidence]) return false;

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
