import { describe, expect, it } from "vitest";
import {
  applyFilters,
  withState,
  DEFAULT_FILTERS,
  EMPTY_FACET,
  isOnNow,
  matchedPreset,
  stateOfValue,
  type Filters,
} from "./filter-events";
import type { SnapshotEvent } from "./types";

/**
 * Filtering decides what a person does and does not see, and the date logic in
 * particular has two decisions that are easy to get quietly wrong: a range is
 * an *overlap* rather than containment, and events with no place on a timeline
 * must not be silently dropped by a date filter.
 */

const ASOF = "2026-08-16";

function event(partial: Partial<SnapshotEvent> & Pick<SnapshotEvent, "id">): SnapshotEvent {
  return {
    sourceId: "theatre/x",
    sourceName: "A Venue",
    category: "theatre",
    categoryLabel: "Theatre",
    title: "Something",
    occurrence: { kind: "single", date: ASOF },
    status: "scheduled",
    state: "listed",
    tags: [],
    raw: "",
    summary: "",
    confidence: "high",
    firstSeen: ASOF,
    lastSeen: ASOF,
    ...partial,
  } as SnapshotEvent;
}

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch });
const ids = (events: SnapshotEvent[]) => events.map((e) => e.id).sort();

describe("date range filtering", () => {
  const gigInRange = event({
    id: "in",
    occurrence: { kind: "single", date: "2026-08-20" },
    sortDate: "2026-08-20",
    endDate: "2026-08-20",
  });
  const gigOutOfRange = event({
    id: "out",
    occurrence: { kind: "single", date: "2026-11-01" },
    sortDate: "2026-11-01",
    endDate: "2026-11-01",
  });
  const straddlingRun = event({
    id: "run",
    occurrence: { kind: "run", start: "2026-07-01", end: "2026-09-30" },
    sortDate: "2026-07-01",
    endDate: "2026-09-30",
  });

  it("keeps events inside the window and drops those after it", () => {
    const result = applyFilters([gigInRange, gigOutOfRange], filters({ from: ASOF, to: "2026-08-31" }), ASOF);
    expect(ids(result)).toEqual(["in"]);
  });

  it("matches a run that overlaps the window rather than one contained by it", () => {
    // A play that opened in July and closes in September is on during a week in
    // August. Containment would hide exactly the thing you were looking for.
    const result = applyFilters([straddlingRun], filters({ from: "2026-08-17", to: "2026-08-24" }), ASOF);
    expect(ids(result)).toEqual(["run"]);
  });

  it("drops a run that finished before the window", () => {
    const past = event({
      id: "past",
      occurrence: { kind: "run", start: "2026-01-01", end: "2026-02-01" },
      sortDate: "2026-01-01",
      endDate: "2026-02-01",
      state: "finished",
    });
    const result = applyFilters([past], filters({ from: ASOF, to: "2026-12-31", includeFinished: true }), ASOF);
    expect(result).toHaveLength(0);
  });

  it("never hides undated, recurring or ongoing events behind a date window", () => {
    const market = event({ id: "market", occurrence: { kind: "recurring", pattern: "Every Sunday" } });
    const collection = event({ id: "collection", occurrence: { kind: "ongoing" } });
    const tbc = event({ id: "tbc", occurrence: { kind: "undated", note: "autumn 2027" } });
    const result = applyFilters([market, collection, tbc], filters({ from: ASOF, to: "2026-08-17" }), ASOF);
    expect(ids(result)).toEqual(["collection", "market", "tbc"]);
  });

  it("recognises a preset range so the control can show its own label", () => {
    expect(matchedPreset(filters({ from: ASOF, to: "2026-08-23" }), ASOF)).toBe(7);
    expect(matchedPreset(filters({ from: "2026-08-18", to: "2026-08-23" }), ASOF)).toBeUndefined();
  });
});

describe("on now", () => {
  it("includes a run that is under way and excludes one that has not opened", () => {
    expect(isOnNow(event({ id: "a", occurrence: { kind: "run", start: "2026-08-01", end: "2026-09-01" } }), ASOF)).toBe(
      true,
    );
    expect(isOnNow(event({ id: "b", occurrence: { kind: "run", start: "2026-09-01", end: "2026-10-01" } }), ASOF)).toBe(
      false,
    );
  });

  it("includes recurring and open-ended things, excludes undated ones", () => {
    expect(isOnNow(event({ id: "c", occurrence: { kind: "recurring", pattern: "Every Sunday" } }), ASOF)).toBe(true);
    expect(isOnNow(event({ id: "d", occurrence: { kind: "ongoing" } }), ASOF)).toBe(true);
    expect(isOnNow(event({ id: "e", occurrence: { kind: "undated", note: "soon" } }), ASOF)).toBe(false);
  });
});

describe("tri-state facets", () => {
  const comedy = event({ id: "comedy", category: "comedy", tags: ["stand-up", "late-night"] });
  const cinema = event({ id: "cinema", category: "cinema", tags: ["arthouse"] });
  const theatre = event({ id: "theatre", category: "theatre", tags: ["drama"] });
  const all = [comedy, cinema, theatre];

  it("excludes a value, keeping everything else", () => {
    // The case this exists for: "anything that isn't cinema".
    const f = filters({ categories: { include: [], exclude: ["cinema"] } });
    expect(ids(applyFilters(all, f, ASOF))).toEqual(["comedy", "theatre"]);
  });

  it("lets exclusion win over inclusion", () => {
    // "comedy, but not late-night" must not return the late-night comedy.
    const f = filters({
      categories: { include: ["comedy"], exclude: [] },
      tags: { include: [], exclude: ["late-night"] },
    });
    expect(applyFilters(all, f, ASOF)).toHaveLength(0);
  });

  it("combines include on one facet with exclude on another", () => {
    const f = filters({
      categories: { include: ["comedy", "cinema"], exclude: [] },
      tags: { include: [], exclude: ["arthouse"] },
    });
    expect(ids(applyFilters(all, f, ASOF))).toEqual(["comedy"]);
  });

  it("reaches every state directly, in any order", () => {
    let facet = EMPTY_FACET;
    expect(stateOfValue(facet, "cinema")).toBe("off");
    facet = withState(facet, "cinema", "include");
    expect(stateOfValue(facet, "cinema")).toBe("include");
    // Straight from include to exclude, without passing through off.
    facet = withState(facet, "cinema", "exclude");
    expect(stateOfValue(facet, "cinema")).toBe("exclude");
    facet = withState(facet, "cinema", "off");
    expect(stateOfValue(facet, "cinema")).toBe("off");
  });

  it("never has a value in both lists at once", () => {
    const facet = withState(withState(EMPTY_FACET, "cinema", "include"), "cinema", "exclude");
    expect(facet.include).not.toContain("cinema");
    expect(facet.exclude).toEqual(["cinema"]);
  });
});

describe("facets", () => {
  const free = event({ id: "free", tags: ["free-entry", "family"], price: { free: true } });
  const paid = event({ id: "paid", tags: ["jazz"], price: { free: false, min: 12 } });

  it("matches any included tag, not all of them", () => {
    const f = filters({ tags: { include: ["jazz", "family"], exclude: [] } });
    expect(ids(applyFilters([free, paid], f, ASOF))).toEqual(["free", "paid"]);
  });

  it("filters to free events only when asked", () => {
    expect(ids(applyFilters([free, paid], filters({ price: "free" }), ASOF))).toEqual(["free"]);
  });

  it("filters to ticketed events, and does not assume unpriced events cost money", () => {
    const unknown = event({ id: "unknown" });
    const result = ids(applyFilters([free, paid, unknown], filters({ price: "paid" }), ASOF));
    expect(result).toEqual(["paid"]);
  });

  it("hides carried events when they are switched off", () => {
    const carried = event({ id: "carried", state: "carried" });
    expect(applyFilters([carried], filters({ includeCarried: false }), ASOF)).toHaveLength(0);
    expect(applyFilters([carried], filters(), ASOF)).toHaveLength(1);
  });
});

describe("narrowing by how good the listing is", () => {
  const linked = event({ id: "linked", url: "https://example.org/e/1" });
  const unlinked = event({ id: "unlinked" });
  const vague = event({ id: "vague", confidence: "low" });
  const middling = event({ id: "middling", confidence: "medium" });

  it("shows everything by default — these are opt-in", () => {
    // The whole point of the defaults: a scraped catalogue is imperfect, and
    // hiding the imperfect parts before anyone asks hides real events.
    expect(ids(applyFilters([linked, unlinked, vague, middling], filters(), ASOF)).sort()).toEqual([
      "linked",
      "middling",
      "unlinked",
      "vague",
    ]);
  });

  it("can drop events with no link of their own", () => {
    expect(ids(applyFilters([linked, unlinked], filters({ hasLink: true }), ASOF))).toEqual(["linked"]);
  });

  it("treats confidence as a floor, not an equality", () => {
    const all = [event({ id: "high" }), middling, vague];
    expect(ids(applyFilters(all, filters({ confidence: "medium" }), ASOF)).sort()).toEqual(["high", "middling"]);
    expect(ids(applyFilters(all, filters({ confidence: "high" }), ASOF))).toEqual(["high"]);
  });
});
