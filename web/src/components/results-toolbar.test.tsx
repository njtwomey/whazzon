/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResultsToolbar } from "./results-toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyFilters, useFilters } from "@/lib/filters";
import type { SnapshotEvent } from "@/lib/types";

/**
 * The date filter has been reported broken twice while its own unit tests
 * passed. Those tests drive `DateRangeFilter` with a mock `update`, which
 * proves the control fires — not that the wiring behind it narrows anything.
 *
 * This mounts the real toolbar over the real `useFilters` hook (so state goes
 * through the URL, as it does in the app) and asserts on the *filtered events*.
 * If any link in that chain is broken, this fails.
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

const EVENTS = [
  event("tomorrow", "2026-08-17"),
  event("in-ten-days", "2026-08-26"),
  event("in-two-months", "2026-10-20"),
];

/** Mirrors what LocationPage does: hook -> toolbar -> applyFilters -> list. */
function Harness() {
  const [filters, update] = useFilters();
  const visible = applyFilters(EVENTS, filters, ASOF);

  return (
    <>
      <ResultsToolbar
        count={visible.length}
        activeFilterCount={0}
        failingSourceCount={0}
        filters={filters}
        update={update}
        asOf={ASOF}
        density="medium"
        setDensity={() => {}}
      />
      <ul data-testid="results">
        {visible.map((e) => (
          <li key={e.id}>{e.id}</li>
        ))}
      </ul>
    </>
  );
}

function setup() {
  render(
    <MemoryRouter initialEntries={["/gb-bristol"]}>
      <TooltipProvider>
        <Harness />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const shown = () => Array.from(screen.getByTestId("results").querySelectorAll("li")).map((li) => li.textContent);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("date range, end to end", () => {
  it("shows everything before any filtering", () => {
    setup();
    expect(shown()).toEqual(["tomorrow", "in-ten-days", "in-two-months"]);
  });

  it("narrows the results when a preset is chosen", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 7 days" }));

    expect(shown()).toEqual(["tomorrow"]);
  });

  it("widens again for a longer preset", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 30 days" }));

    expect(shown()).toEqual(["tomorrow", "in-ten-days"]);
  });

  it("narrows when days are picked in the calendar", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));

    await user.click(screen.getByRole("button", { name: /August 25th, 2026/ }));
    await user.click(screen.getByRole("button", { name: /August 27th, 2026/ }));

    expect(shown()).toEqual(["in-ten-days"]);
  });

  it("restores everything when the range is cleared", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 7 days" }));
    expect(shown()).toEqual(["tomorrow"]);

    await user.click(screen.getByRole("button", { name: /clear dates/i }));
    expect(shown()).toEqual(["tomorrow", "in-ten-days", "in-two-months"]);
  });

  it("reflects the chosen range on the trigger", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 7 days" }));

    expect(screen.getByRole("button", { name: /next 7 days/i })).toBeDefined();
  });
});

describe("on now, end to end", () => {
  it("filters to what is on today", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /on now/i }));

    // Nothing in the fixture is on 2026-08-16 itself.
    expect(shown()).toEqual([]);
  });
});
