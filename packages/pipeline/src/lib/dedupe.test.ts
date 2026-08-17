import { describe, expect, it } from "vitest";
import type { SnapshotEvent } from "../schema/snapshot.js";
import { annotateDuplicates, DUP_SCORE, duplicateScore, editDistance, normaliseTitle } from "./dedupe.js";

/**
 * The cases here are the ones that were measured on real data, not invented.
 * Each of the three parts of the key exists because dropping it merged something
 * it should not have, and the cinema case is the reason venue is in there at all.
 */

function event(partial: Partial<SnapshotEvent> & Pick<SnapshotEvent, "id" | "sourceId">): SnapshotEvent {
  return {
    sourceName: "A Source",
    category: "music",
    categoryLabel: "Music",
    title: "A Gig",
    occurrence: { kind: "single", date: "2026-09-01" },
    status: "scheduled",
    state: "listed",
    sortDate: "2026-09-01",
    tags: [],
    raw: "",
    summary: "",
    confidence: "high",
    firstSeen: "2026-08-17",
    lastSeen: "2026-08-17",
    ...partial,
  } as SnapshotEvent;
}

/** Every source is a venue unless the test says otherwise. */
const kinds =
  (map: Record<string, string> = {}) =>
  (id: string) =>
    map[id] ?? "venue";

describe("scoring a pair", () => {
  const at = (venueName: string | undefined, title = "A Gig", id = "x#1", sourceId = "s/x") =>
    event({ id, sourceId, title, venueName });

  it("is certain when title and venue both match exactly", () => {
    expect(duplicateScore(at("Cyprus Avenue"), at("Cyprus Avenue", "A Gig", "y#1", "s/y"))).toBe(DUP_SCORE.certain);
  });

  it("is likely when one venue name contains the other", () => {
    // Measured in Cork: one library arrived under three names in a single day.
    expect(duplicateScore(at("Cork City Library"), at("City Library, Grand Parade", "A Gig", "y#1", "s/y"))).toBe(
      DUP_SCORE.likely,
    );
  });

  it("scores zero when the venues are different places", () => {
    // The Toy Story rule. On one day all four Cork cinemas showed it; those are
    // four real screenings and no title similarity may override that.
    expect(
      duplicateScore(
        at("Omniplex Cork — Mahon Point", "Toy Story 5"),
        at("The Reel Picture Blackpool", "Toy Story 5", "y#1", "s/y"),
      ),
    ).toBe(0);
  });

  it("scores zero across different dates", () => {
    const a = event({ id: "a#1", sourceId: "s/x", title: "Storytime", sortDate: "2026-09-01" });
    const b = event({ id: "b#1", sourceId: "s/y", title: "Storytime", sortDate: "2026-09-08" });
    expect(duplicateScore(a, b)).toBe(0);
  });

  it("drops to weak when one row will not say where it is", () => {
    expect(duplicateScore(at("Cyprus Avenue"), at(undefined, "A Gig", "y#1", "s/y"))).toBe(DUP_SCORE.possible);
  });

  it("will not match a short title on a scrap of similarity", () => {
    expect(duplicateScore(at("Somewhere", "Quiz"), at("Somewhere", "Quiz Night", "y#1", "s/y"))).toBe(0);
  });

  it("matches a long title contained in a longer one", () => {
    const long = "Judy — The Songbook of Judy Garland";
    expect(duplicateScore(at("The Everyman", "Judy the songbook"), at("The Everyman", long, "y#1", "s/y"))).toBe(
      DUP_SCORE.probable,
    );
  });
});

describe("edit distance", () => {
  it("abandons early rather than computing a distance it cannot use", () => {
    // The bail-out is what makes scoring 1,600 rows affordable.
    expect(editDistance("abcdefghij", "zzzzzzzzzz", 3)).toBeGreaterThan(3);
    expect(editDistance("Witch Hunts", "Witch hunts", 2)).toBe(1);
  });
});

describe("normalising a title", () => {
  it("strips the decoration sources bolt on", () => {
    expect(normaliseTitle("SOLD OUT: The Room")).toBe(normaliseTitle("The Room"));
    expect(normaliseTitle("Kelly Moran — Tickets")).toBe(normaliseTitle("Kelly  Moran"));
  });
});

describe("annotating, not deleting", () => {
  const kinds =
    (map: Record<string, string> = {}) =>
    (id: string) =>
      map[id] ?? "venue";

  it("keeps every row and marks the copy", () => {
    const result = annotateDuplicates(
      [
        event({ id: "own#1", sourceId: "music/cyprus-avenue", title: "Seed Talks", venueName: "Cyprus Avenue" }),
        event({ id: "agg#1", sourceId: "citywide/proc", title: "Seed Talks", venueName: "Cyprus Avenue" }),
      ],
      kinds({ "citywide/proc": "aggregator" }),
    );

    // Nothing is removed — that is the whole design. A wrong guess costs a hidden
    // row the reader can get back, not a deleted one nobody knows was there.
    expect(result.events).toHaveLength(2);
    expect(result.marked).toBe(1);

    const own = result.events.find((e) => e.id === "own#1")!;
    const agg = result.events.find((e) => e.id === "agg#1")!;
    expect(own.duplicateOf).toBeUndefined();
    expect(own.alsoListedBy).toEqual(["citywide/proc"]);
    expect(agg.duplicateOf).toBe("own#1");
    expect(agg.duplicateScore).toBe(DUP_SCORE.certain);
  });

  it("makes the venue's own listing canonical, not the aggregator's", () => {
    const result = annotateDuplicates(
      [
        event({
          id: "agg#1",
          sourceId: "citywide/agg",
          title: "A Gig",
          venueName: "Coughlan's",
          image: "https://e/i.jpg",
        }),
        event({ id: "own#1", sourceId: "music/coughlans", title: "A Gig", venueName: "Coughlan's" }),
      ],
      kinds({ "citywide/agg": "aggregator" }),
    );

    const own = result.events.find((e) => e.id === "own#1")!;
    // Canonical for authority, not richness — the aggregator had the image...
    expect(own.duplicateOf).toBeUndefined();
    // ...and it comes across anyway, so hiding the duplicate loses nothing.
    expect(own.image).toBe("https://e/i.jpg");
  });

  it("unions tags and takes the earliest firstSeen onto the canonical row", () => {
    const result = annotateDuplicates(
      [
        event({
          id: "a#1",
          sourceId: "music/v",
          title: "A Gig",
          tags: ["indie"],
          firstSeen: "2026-08-17",
          lastSeen: "2026-08-17",
        }),
        event({
          id: "b#1",
          sourceId: "citywide/agg",
          title: "A Gig",
          tags: ["rock", "indie"],
          firstSeen: "2026-08-16",
          lastSeen: "2026-08-16",
        }),
      ],
      kinds({ "citywide/agg": "aggregator" }),
    );

    const canonical = result.events.find((e) => e.id === "a#1")!;
    expect(canonical.tags).toEqual(["indie", "rock"]);
    expect(canonical.firstSeen).toBe("2026-08-16");
    expect(canonical.lastSeen).toBe("2026-08-17");
  });

  it("leaves a lone listing untouched", () => {
    const only = event({ id: "a#1", sourceId: "music/v" });
    const result = annotateDuplicates([only], kinds());
    expect(result.events).toEqual([only]);
    expect(result.marked).toBe(0);
  });
});
