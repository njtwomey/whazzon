/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventGroups, groupEvents } from "./event-groups";
import type { SnapshotEvent } from "@/lib/types";

/**
 * Progressive rendering is the kind of thing that breaks silently: if the cap
 * stopped growing, the page would simply be missing events at the bottom and
 * everything would still look fine. So the cap, the growth, and the reset on a
 * new filter are all asserted.
 */

const ASOF = "2026-08-16";

function event(id: string, date: string): SnapshotEvent {
  return {
    id,
    sourceId: "music/x",
    sourceName: "A Venue",
    category: "music",
    categoryLabel: "Music",
    title: id,
    occurrence: { kind: "single", date },
    status: "scheduled",
    state: "listed",
    sortDate: date,
    endDate: date,
    tags: [],
    raw: "",
    summary: "",
    confidence: "high",
    firstSeen: ASOF,
    lastSeen: ASOF,
  } as SnapshotEvent;
}

/** 100 events, all in the same month so they land in one group. */
const MANY = Array.from({ length: 100 }, (_, i) => event(`event-${i}`, "2026-09-10"));

const trigger = () => (globalThis as unknown as { __triggerIntersection: () => void }).__triggerIntersection();
const cards = () => screen.getAllByRole("button", { name: /event-\d+/ }).length;

afterEach(cleanup);

describe("progressive rendering", () => {
  it("mounts a first page rather than everything", () => {
    render(<EventGroups groups={groupEvents(MANY, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    expect(cards()).toBe(60);
    expect(screen.getByText(/loading 40 more/i)).toBeDefined();
  });

  it("still reports the true total on the group heading", () => {
    render(<EventGroups groups={groupEvents(MANY, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    // The badge must count the group, not what happens to be mounted, or the
    // cap would quietly understate how much is on.
    expect(screen.getByText("100")).toBeDefined();
  });

  it("extends when the sentinel comes into view", () => {
    render(<EventGroups groups={groupEvents(MANY, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    act(() => trigger());

    expect(cards()).toBe(100);
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it("renders everything when there is less than a page", () => {
    const few = MANY.slice(0, 5);
    render(<EventGroups groups={groupEvents(few, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    expect(cards()).toBe(5);
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it("starts again from the top when the filtered set changes", () => {
    const { rerender } = render(
      <EventGroups groups={groupEvents(MANY, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />,
    );
    act(() => trigger());
    expect(cards()).toBe(100);

    // A new filter is a new list; keeping the grown cap would render a hundred
    // cards for a result set nobody has scrolled through yet.
    const narrowed = MANY.slice(0, 80);
    rerender(<EventGroups groups={groupEvents(narrowed, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    expect(cards()).toBe(60);
  });

  it("spends the budget across groups in order", () => {
    // Two months: the cap should fill the first group before starting the second.
    const mixed = [
      ...Array.from({ length: 50 }, (_, i) => event(`event-sep-${i}`, "2026-09-10")),
      ...Array.from({ length: 50 }, (_, i) => event(`event-oct-${i}`, "2026-10-10")),
    ];
    render(<EventGroups groups={groupEvents(mixed, ASOF)} asOf={ASOF} density="medium" onOpen={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /event-sep-\d+/ })).toHaveLength(50);
    expect(screen.getAllByRole("button", { name: /event-oct-\d+/ })).toHaveLength(10);
  });
});
