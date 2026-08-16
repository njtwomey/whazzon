/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangeFilter } from "./date-range-filter";
import { DEFAULT_FILTERS, type Filters } from "@/lib/filter-events";

/**
 * The date filter is the one control people reach for first, and it is built
 * out of three third-party pieces — Popover, Calendar and react-day-picker —
 * any of which can break silently on a version bump. A rendering test is the
 * only way to know it still works; a typecheck will happily pass on a control
 * that never opens.
 */

const ASOF = "2026-08-16";

afterEach(cleanup);

function setup(filters: Partial<Filters> = {}) {
  const update = vi.fn();
  render(<DateRangeFilter filters={{ ...DEFAULT_FILTERS, ...filters }} update={update} asOf={ASOF} />);
  return { update, user: userEvent.setup() };
}

describe("DateRangeFilter", () => {
  it("shows 'Any time' when no range is set", () => {
    setup();
    expect(screen.getByRole("button", { name: /any time/i })).toBeDefined();
  });

  it("opens a popover containing a calendar grid", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));

    // react-day-picker renders the month as a grid of days.
    expect(screen.getByRole("grid")).toBeDefined();
    expect(screen.getAllByRole("gridcell").length).toBeGreaterThan(27);
  });

  it("applies a preset range relative to the snapshot's as-of date", async () => {
    const { update, user } = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 7 days" }));

    expect(update).toHaveBeenCalledWith({ from: "2026-08-16", to: "2026-08-23" });
  });

  it("applies a range when days are clicked in the calendar", async () => {
    const { update, user } = setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));

    // Day buttons are labelled in full, e.g. "Tuesday, August 18th, 2026".
    const grid = screen.getByRole("grid");
    await user.click(within(grid).getByRole("button", { name: /August 18th, 2026/ }));

    expect(update).toHaveBeenCalled();
    const [patch] = update.mock.calls.at(-1)!;
    expect(patch.from).toBe("2026-08-18");
  });

  it("labels a preset range rather than showing raw dates", () => {
    setup({ from: ASOF, to: "2026-08-23" });
    expect(screen.getByRole("button", { name: /next 7 days/i })).toBeDefined();
  });

  it("labels a custom range with both endpoints", () => {
    setup({ from: "2026-09-01", to: "2026-09-05" });
    expect(screen.getByRole("button", { name: /1 Sep.*5 Sep/ })).toBeDefined();
  });

  it("clears the range", async () => {
    const { update, user } = setup({ from: ASOF, to: "2026-08-23" });
    await user.click(screen.getByRole("button", { name: /clear dates/i }));
    expect(update).toHaveBeenCalledWith({ from: undefined, to: undefined });
  });
});
