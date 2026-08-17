/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationPage } from "./location-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Snapshot } from "@/lib/types";

/**
 * The whole page, not a component in isolation.
 *
 * The date control has been reported dead twice while its own tests passed —
 * both of those mounted it directly. This mounts `LocationPage` exactly as the
 * app does, with the router, the tooltip provider, the filter rail and a stubbed
 * snapshot fetch, so anything about the real composition that stops the popover
 * opening shows up here — including a popover nested in a collapsed section
 * inside a scroll area, which is where it now lives.
 */

const ASOF = "2026-08-16";

const SNAPSHOT = {
  schema: "whazzon.snapshot/1",
  location: { id: "gb-bristol", name: "Bristol", region: "SW", country: "UK", timezone: "Europe/London" },
  generatedAt: "2026-08-16T09:00:00Z",
  asOf: ASOF,
  categories: [{ category: "music", label: "Music", sourceCount: 1, eventCount: 2 }],
  sources: [
    {
      id: "music/venue",
      name: "A Venue",
      category: "music",
      kind: "venue",
      status: "provisional",
      url: "https://example.com/",
      tags: [],
    },
  ],
  events: [
    {
      id: "soon",
      sourceId: "music/venue",
      sourceName: "A Venue",
      category: "music",
      categoryLabel: "Music",
      title: "Gig Tomorrow",
      occurrence: { kind: "single", date: "2026-08-17" },
      status: "scheduled",
      state: "listed",
      sortDate: "2026-08-17",
      endDate: "2026-08-17",
      tags: ["live-music"],
      raw: "",
      summary: "",
      confidence: "high",
      firstSeen: ASOF,
      lastSeen: ASOF,
    },
    {
      id: "later",
      sourceId: "music/venue",
      sourceName: "A Venue",
      category: "music",
      categoryLabel: "Music",
      title: "Gig Later In August",
      occurrence: { kind: "single", date: "2026-08-26" },
      status: "scheduled",
      state: "listed",
      sortDate: "2026-08-26",
      endDate: "2026-08-26",
      tags: ["live-music"],
      raw: "",
      summary: "",
      confidence: "high",
      firstSeen: ASOF,
      lastSeen: ASOF,
    },
  ],
} as unknown as Snapshot;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).endsWith("index.json") ? [SNAPSHOT.location] : SNAPSHOT),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function setup() {
  render(
    <MemoryRouter initialEntries={["/gb-bristol"]}>
      <TooltipProvider>
        <Routes>
          <Route path="/:locationId" element={<LocationPage />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText("Gig Tomorrow")).toBeDefined());
  const user = userEvent.setup();
  // The dates live in the panel's Date facet, closed like every other section.
  await user.click(screen.getByRole("button", { name: /^date/i }));
  return user;
}

describe("the date control, on the real page", () => {
  it("renders in the filter panel", async () => {
    await setup();
    expect(screen.getByRole("button", { name: /any time/i })).toBeDefined();
  });

  it("opens a calendar when clicked", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));

    expect(screen.getByRole("grid")).toBeDefined();
    expect(screen.getByRole("button", { name: "Next 7 days" })).toBeDefined();
  });

  it("filters the visible events when a range is chosen", async () => {
    const user = await setup();
    expect(screen.getByText("Gig Later In August")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /any time/i }));
    await user.click(screen.getByRole("button", { name: "Next 7 days" }));

    await waitFor(() => expect(screen.queryByText("Gig Later In August")).toBeNull());
    expect(screen.getByText("Gig Tomorrow")).toBeDefined();
  });

  it("filters when days are clicked in the calendar", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: /any time/i }));

    // The calendar opens on the snapshot's month, so pick days that are on
    // screen — navigating months is react-day-picker's concern, not ours.
    await user.click(screen.getByRole("button", { name: /August 25th, 2026/ }));
    await user.click(screen.getByRole("button", { name: /August 27th, 2026/ }));

    await waitFor(() => expect(screen.queryByText("Gig Tomorrow")).toBeNull());
    expect(screen.getByText("Gig Later In August")).toBeDefined();
  });
});
