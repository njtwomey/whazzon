import { describe, expect, it } from "vitest";
import type { SnapshotEvent } from "../schema/snapshot.js";
import { dedupeEvents, normaliseTitle, sameVenue } from "./dedupe.js";

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

describe("what counts as the same venue", () => {
  it("matches a name that contains the other", () => {
    // Measured in Cork: one library arrived under three names in one day.
    expect(sameVenue("Cork City Library", "City Library, Grand Parade")).toBe(true);
    expect(sameVenue("Cork Public Museum", "Cork Public Museum, Fitzgerald Park, Mardyke")).toBe(true);
  });

  it("keeps genuinely different venues apart", () => {
    expect(sameVenue("Omniplex Cork — Mahon Point", "The Reel Picture Blackpool")).toBe(false);
    expect(sameVenue("City Library, Grand Parade", "Douglas Library")).toBe(false);
  });

  it("will not match on a scrap", () => {
    // Without a floor on the shorter string, short names swallow unrelated ones —
    // and a wrong merge loses an event, where a missed merge only shows it twice.
    expect(sameVenue("The Pav", "The Pavilion Theatre and Gardens")).toBe(false);
  });
});

describe("normalising a title", () => {
  it("strips the decoration sources bolt on", () => {
    expect(normaliseTitle("SOLD OUT: The Room")).toBe(normaliseTitle("The Room"));
    expect(normaliseTitle("Kelly Moran — Tickets")).toBe(normaliseTitle("Kelly  Moran"));
  });
});

describe("collapsing duplicates", () => {
  it("merges the same event listed by two sources", () => {
    const result = dedupeEvents(
      [
        event({ id: "a#1", sourceId: "music/cyprus-avenue", title: "Seed Talks", venueName: "Cyprus Avenue" }),
        event({ id: "b#1", sourceId: "citywide/proc", title: "Seed Talks", venueName: "Cyprus Avenue" }),
      ],
      kinds({ "citywide/proc": "aggregator" }),
    );

    expect(result.events).toHaveLength(1);
    expect(result.merged).toBe(1);
    expect(result.events[0]!.sourceId).toBe("music/cyprus-avenue");
    expect(result.events[0]!.alsoListedBy).toEqual(["citywide/proc"]);
  });

  it("keeps one film showing at four cinemas as four events", () => {
    // The counter-example that forced venue into the key: on 2026-08-17 all four
    // of Cork's cinemas showed Toy Story 5. Merging on title and date would have
    // deleted three cinemas' listings.
    const cinemas = [
      "The Arc Cinema Cork",
      "Omniplex Cork — Mahon Point",
      "Reel Picture Ballincollig",
      "Reel Picture Blackpool",
    ];
    const result = dedupeEvents(
      cinemas.map((venueName, i) =>
        event({ id: `c${i}#1`, sourceId: `cinema/v${i}`, title: "Toy Story 5", venueName }),
      ),
      kinds(),
    );

    expect(result.events).toHaveLength(4);
    expect(result.merged).toBe(0);
  });

  it("keeps the same title on different dates apart", () => {
    const result = dedupeEvents(
      [
        event({ id: "a#1", sourceId: "s/x", title: "Storytime", sortDate: "2026-09-01" }),
        event({ id: "a#2", sourceId: "s/x", title: "Storytime", sortDate: "2026-09-08" }),
      ],
      kinds(),
    );

    expect(result.events).toHaveLength(2);
  });

  it("prefers the venue's own listing over an aggregator's", () => {
    const result = dedupeEvents(
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

    // Kept for authority, not for richness — the aggregator had the image.
    expect(result.events[0]!.sourceId).toBe("music/coughlans");
    // ...and the image comes across anyway, so the merged row beats both inputs.
    expect(result.events[0]!.image).toBe("https://e/i.jpg");
  });

  it("unions tags and takes the earliest firstSeen", () => {
    const result = dedupeEvents(
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

    expect(result.events[0]!.tags).toEqual(["indie", "rock"]);
    // firstSeen is what "what's new this week" is answered from, so the earliest
    // sighting across the group is the honest one.
    expect(result.events[0]!.firstSeen).toBe("2026-08-16");
    expect(result.events[0]!.lastSeen).toBe("2026-08-17");
  });

  it("is deterministic when nothing else separates two rows", () => {
    const rows = [
      event({ id: "z#1", sourceId: "a/one", title: "A Gig" }),
      event({ id: "a#1", sourceId: "a/two", title: "A Gig" }),
    ];
    const forwards = dedupeEvents(rows, kinds());
    const backwards = dedupeEvents([...rows].reverse(), kinds());

    expect(forwards.events[0]!.id).toBe(backwards.events[0]!.id);
  });

  it("leaves a single listing completely alone", () => {
    const only = event({ id: "a#1", sourceId: "music/v" });
    const result = dedupeEvents([only], kinds());

    expect(result.events).toEqual([only]);
    expect(result.events[0]!.alsoListedBy).toBeUndefined();
    expect(result.merged).toBe(0);
  });
});
