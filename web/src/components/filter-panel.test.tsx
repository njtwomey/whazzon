/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterPanel } from "./filter-panel";
import { DEFAULT_FILTERS, type Filters } from "@/lib/filter-events";
import type { Snapshot } from "@/lib/types";

/**
 * The tag facet went missing once already: the page passed `tags` in and the
 * panel quietly never rendered them, which typechecked perfectly because the
 * prop was simply unused. Only rendering catches that class of bug.
 */

const snapshot = {
  categories: [
    { category: "theatre", label: "Theatre", sourceCount: 3, eventCount: 12 },
    { category: "cinema", label: "Cinema", sourceCount: 2, eventCount: 25 },
  ],
} as unknown as Snapshot;

const TAGS = [
  { name: "live-music", count: 14 },
  { name: "one-night", count: 11 },
  { name: "free-entry", count: 6 },
  { name: "documentary", count: 4 },
  { name: "storytelling", count: 3 },
];

function setup(filters: Partial<Filters> = {}, tags = TAGS) {
  const update = vi.fn();
  render(
    <FilterPanel
      snapshot={snapshot}
      filters={{ ...DEFAULT_FILTERS, ...filters }}
      update={update}
      reset={vi.fn()}
      counts={new Map([["theatre", 12]])}
      areas={[{ name: "Old City", count: 9 }]}
      tags={tags}
      activeCount={0}
    />,
  );
  return { update, user: userEvent.setup() };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

async function openTags(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^tags/i }));
}

describe("tag filtering", () => {
  it("renders a Tags section", () => {
    setup();
    expect(screen.getByRole("button", { name: /^tags/i })).toBeDefined();
  });

  it("renders each tag as a pill carrying its count", async () => {
    const { user } = setup();
    await openTags(user);

    // Slugs read as words, and the count rides in the pill: "live music, 14 events".
    expect(screen.getByRole("button", { name: /live music, 14 events/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /free entry, 6 events/i })).toBeDefined();
  });

  it("selects a tag", async () => {
    const { update, user } = setup();
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /free entry, 6 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: ["free-entry"] });
  });

  it("deselects a tag that is already applied", async () => {
    const { update, user } = setup({ tags: ["free-entry"] });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /free entry, 6 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: [] });
  });

  it("adds to the selection rather than replacing it", async () => {
    const { update, user } = setup({ tags: ["live-music"] });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /documentary, 4 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: ["live-music", "documentary"] });
  });

  it("leads with an All pill that clears the selection", async () => {
    const { update, user } = setup({ tags: ["live-music", "documentary"] });
    await openTags(user);

    const all = screen.getByRole("button", { name: /all tags/i });
    expect(all.getAttribute("aria-pressed")).toBe("false");
    await user.click(all);
    expect(update).toHaveBeenCalledWith({ tags: [] });
  });

  it("marks All as selected when no tag is applied", async () => {
    const { user } = setup();
    await openTags(user);
    expect(screen.getByRole("button", { name: /all tags/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the count of applied tags on the collapsed section", () => {
    setup({ tags: ["live-music", "free-entry"] });
    const trigger = screen.getByRole("button", { name: /^tags/i });
    expect(within(trigger).getByText("2")).toBeDefined();
  });
});

describe("tag long tail", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ name: `tag-${i}`, count: 40 - i }));
  const pill = (name: RegExp) => screen.queryByRole("button", { name });

  it("caps the list and offers the rest", async () => {
    const { user } = setup({}, many);
    await openTags(user);

    expect(screen.getByRole("button", { name: /show 16 more/i })).toBeDefined();
    expect(pill(/^tag 39, /)).toBeNull();
  });

  it("reveals everything when asked", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /show 16 more/i }));

    expect(pill(/^tag 39, /)).not.toBeNull();
  });

  it("searches the full vocabulary, not just the visible head", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    await user.type(screen.getByLabelText(/search tags/i), "tag-33");

    expect(pill(/^tag 33, /)).not.toBeNull();
  });

  it("keeps a selected tag visible even when it falls past the cap", async () => {
    const { user } = setup({ tags: ["tag-39"] }, many);
    await openTags(user);

    // Otherwise it could be applied and impossible to remove.
    expect(pill(/^tag 39, /)).not.toBeNull();
  });

  it("re-sorts alphabetically on request", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    await user.click(screen.getByRole("button", { name: "A–Z" }));

    const pills = screen.getAllByRole("button", { name: /^tag \d+, / });
    const names = pills.map((p) => p.getAttribute("aria-label")!.split(",")[0]);
    expect(names).toEqual([...names].sort());
  });
});
