import { describe, expect, it } from "vitest";
import type { WhazzonEvent } from "../schema/harvest.js";
import { carryDescription, endDateOf, sortDateOf, stateOf } from "./fold.js";

function event(overrides: Partial<WhazzonEvent> = {}): WhazzonEvent {
  return {
    id: "abc",
    sourceId: "music/thekla",
    title: "A Gig",
    occurrence: { kind: "single", date: "2026-09-01" },
    status: "scheduled",
    tags: [],
    raw: "A line from the listings index.",
    summary: "A gig.",
    confidence: "high",
    ...overrides,
  } as WhazzonEvent;
}

describe("carrying a description forward", () => {
  it("keeps the one already read when the new observation has none", () => {
    // The common case: a weekly index-only run over a source whose event pages
    // were opened once. Losing them here would empty the detail view.
    const merged = carryDescription(event(), event({ description: "Three paragraphs from the event page." }));

    expect(merged.description).toBe("Three paragraphs from the event page.");
    expect(merged.raw).toBe("A line from the listings index.");
  });

  it("prefers the newer one when the page was read again", () => {
    const merged = carryDescription(event({ description: "Rewritten copy." }), event({ description: "Old copy." }));

    expect(merged.description).toBe("Rewritten copy.");
  });

  it("leaves the field absent when neither has one", () => {
    expect(carryDescription(event(), event()).description).toBeUndefined();
    expect(carryDescription(event(), undefined).description).toBeUndefined();
  });

  it("does not carry anything else forward", () => {
    // Only description is exempt. A corrected date or price is a real
    // correction and must replace what came before.
    const merged = carryDescription(
      event({ occurrence: { kind: "single", date: "2026-09-08" } }),
      event({ occurrence: { kind: "single", date: "2026-09-01" }, price: { free: true } }),
    );

    expect(merged.occurrence).toEqual({ kind: "single", date: "2026-09-08" });
    expect(merged.price).toBeUndefined();
  });
});

describe("dates derived from an occurrence", () => {
  it("has no end date for open-ended things", () => {
    expect(endDateOf({ kind: "ongoing", start: "2026-01-01" })).toBeUndefined();
    expect(endDateOf({ kind: "undated", note: "coming autumn" })).toBeUndefined();
  });

  it("sorts a start-less run from today, not the bottom of the list", () => {
    // "Until Thu 20 Aug" is already under way; falling to the end would bury it.
    expect(sortDateOf({ kind: "run", end: "2026-08-20" }, "2026-08-17")).toBe("2026-08-17");
    expect(sortDateOf({ kind: "run", start: "2026-09-01", end: "2026-10-01" }, "2026-08-17")).toBe("2026-09-01");
  });
});

describe("state", () => {
  const folded = (lastSeen: string) => ({ event: event(), firstSeen: "2026-08-01", lastSeen });

  it("is finished once the date has passed, whatever the log says", () => {
    expect(stateOf(folded("2026-08-16"), "2026-08-16", "2026-09-02")).toBe("finished");
  });

  it("is listed when the source's most recent run saw it", () => {
    expect(stateOf(folded("2026-08-17"), "2026-08-17", "2026-08-17")).toBe("listed");
  });

  it("is carried when the source was visited again and stopped mentioning it", () => {
    // The reason the fold exists: a venue that lists three months ahead drops a
    // show announced a year out, and it must not vanish from the site.
    expect(stateOf(folded("2026-08-16"), "2026-08-17", "2026-08-17")).toBe("carried");
  });
});
