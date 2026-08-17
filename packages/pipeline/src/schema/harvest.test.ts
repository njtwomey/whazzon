import { describe, expect, it } from "vitest";
import { eventId, normaliseTitle } from "../lib/eventId.js";
import { endDateOf, sortDateOf, stateOf } from "../lib/fold.js";
import { HarvestArtefact } from "./harvest.js";

/**
 * The event schema is the one an LLM writes into, so these tests are mostly
 * about what it *refuses*. A schema that accepts a sloppy extraction is worse
 * than no schema, because the bad row survives all the way to the page.
 */

const event = {
  id: "theatre/tobacco-factory#abc1234567",
  sourceId: "theatre/tobacco-factory",
  title: "Macbeth",
  occurrence: { kind: "run" as const, start: "2026-09-01", end: "2026-10-15" },
  status: "scheduled" as const,
  tags: [],
  raw: "**Macbeth** — a new production.",
  summary: "Shakespeare's tragedy, in the round.",
  confidence: "high" as const,
};

const run = (...observations: unknown[]) => ({
  schema: "whazzon.harvest/1",
  locationId: "gb-bristol",
  date: "2026-08-16",
  category: "theatre",
  harvestedAt: "2026-08-16T09:00:00Z",
  observations,
});

const okFetch = { ok: true as const, url: "https://tobaccofactorytheatres.com/whats-on/", status: 200 };

describe("harvest run schema", () => {
  it("accepts a well-formed run", () => {
    const result = HarvestArtefact.parse(run({ sourceId: "theatre/tobacco-factory", fetch: okFetch, events: [event] }));
    expect(result.data.observations[0]!.events).toHaveLength(1);
  });

  it("rejects a run whose timestamp disagrees with its date", () => {
    expect(() => HarvestArtefact.parse({ ...run(), harvestedAt: "2026-08-17T09:00:00Z" })).toThrow(
      /but the run date is/,
    );
  });

  it("rejects a source from another category", () => {
    // A fan-out writing theatre results into the cinema file would otherwise go
    // unnoticed, since every id would still resolve.
    expect(() =>
      HarvestArtefact.parse({
        ...run({ sourceId: "music/thekla", fetch: { ...okFetch }, events: [] }),
        category: "theatre",
      }),
    ).toThrow(/is not in the "theatre" category/);
  });

  it("rejects the same source observed twice in one run", () => {
    expect(() =>
      HarvestArtefact.parse(
        run(
          { sourceId: "theatre/tobacco-factory", fetch: okFetch, events: [] },
          { sourceId: "theatre/tobacco-factory", fetch: okFetch, events: [] },
        ),
      ),
    ).toThrow(/observed twice in one run/);
  });

  it("rejects a run that ends before it starts", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, occurrence: { kind: "run", start: "2026-10-15", end: "2026-09-01" } }],
        }),
      ),
    ).toThrow(/ends .* before it starts/);
  });

  it("rejects events attributed to a different source than the observation", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, sourceId: "music/thekla" }],
        }),
      ),
    ).toThrow(/but this observation is of/);
  });

  it("rejects events recorded against a failed fetch", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: { ok: false, url: "https://example.com/", error: "timeout" },
          events: [event],
        }),
      ),
    ).toThrow(/events cannot come from a failed fetch/);
  });

  it("accepts a failed fetch with no events — a recorded gap, not a silent one", () => {
    const result = HarvestArtefact.parse(
      run({
        sourceId: "theatre/tobacco-factory",
        fetch: { ok: false, url: "https://example.com/", error: "HTTP 503" },
        events: [],
      }),
    );
    expect(result.data.observations[0]!.fetch.ok).toBe(false);
  });

  it("rejects a venue block that identifies nothing", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, venue: { area: "Southville" } }],
        }),
      ),
    ).toThrow(/either a sourceId .* or a name/);
  });

  it("rejects a price that is free but non-zero", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, price: { free: true, min: 12 } }],
        }),
      ),
    ).toThrow(/marked free/);
  });

  it("requires an explicit note rather than an invented date when undated", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, occurrence: { kind: "undated" } }],
        }),
      ),
    ).toThrow();
  });

  it("rejects a local time masquerading as a datetime", () => {
    expect(() =>
      HarvestArtefact.parse(
        run({
          sourceId: "theatre/tobacco-factory",
          fetch: okFetch,
          events: [{ ...event, occurrence: { kind: "single", date: "2026-09-01", startTime: "7.30pm" } }],
        }),
      ),
    ).toThrow(/24-hour local time/);
  });
});

describe("event ids", () => {
  it("is stable across re-harvests of the same event", () => {
    const a = eventId("music/thekla", "IDLES", { kind: "single", date: "2026-09-01" });
    const b = eventId("music/thekla", "IDLES", { kind: "single", date: "2026-09-01" });
    expect(a).toBe(b);
  });

  it("survives the decoration venues add between weeks", () => {
    const plain = eventId("music/thekla", "IDLES", { kind: "single", date: "2026-09-01" });
    const decorated = eventId("music/thekla", "IDLES — SOLD OUT", { kind: "single", date: "2026-09-01" });
    expect(decorated).toBe(plain);
  });

  it("separates the same act on different nights", () => {
    const first = eventId("music/thekla", "IDLES", { kind: "single", date: "2026-09-01" });
    const second = eventId("music/thekla", "IDLES", { kind: "single", date: "2026-09-02" });
    expect(second).not.toBe(first);
  });

  it("normalises presenter noise out of titles", () => {
    expect(normaliseTitle("Bristol Beacon presents: The Band!")).toBe("bristol beacon the band");
  });
});

const ASOF = "2026-08-16";

describe("derived event state", () => {
  const folded = (lastSeen: string, occurrence: any) => ({
    event: { ...event, occurrence },
    firstSeen: "2026-08-01",
    lastSeen,
  });

  it("is listed when the newest run still shows it", () => {
    const f = folded("2026-08-16", { kind: "single", date: "2026-12-01" });
    expect(stateOf(f, "2026-08-16", "2026-08-16")).toBe("listed");
  });

  it("carries an event the source has stopped listing but which has not happened", () => {
    // The case this whole mechanism exists for: a show announced a year out,
    // dropped from a venue page that only looks three months ahead.
    const f = folded("2026-08-01", { kind: "single", date: "2027-07-01" });
    expect(stateOf(f, "2026-08-16", "2026-08-16")).toBe("carried");
  });

  it("finishes an event whose date has passed, even if still listed", () => {
    const f = folded("2026-08-16", { kind: "single", date: "2026-08-01" });
    expect(stateOf(f, "2026-08-16", "2026-08-16")).toBe("finished");
  });

  it("never finishes an open-ended event", () => {
    const f = folded("2026-08-01", { kind: "ongoing", start: "2020-01-01" });
    expect(stateOf(f, "2026-08-16", "2026-08-16")).toBe("carried");
    expect(endDateOf({ kind: "ongoing" })).toBeUndefined();
  });

  it("gives undated events no place on the timeline", () => {
    expect(sortDateOf({ kind: "undated", note: "autumn 2027" }, ASOF)).toBeUndefined();
  });
});
