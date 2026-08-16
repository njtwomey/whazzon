/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterPanel } from "./filter-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_FILTERS, type Filters } from "@/lib/filter-events";
const facet = (include: string[] = [], exclude: string[] = []) => ({ include, exclude });
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
    <TooltipProvider>
      <FilterPanel
        snapshot={snapshot}
        filters={{ ...DEFAULT_FILTERS, ...filters }}
        update={update}
        reset={vi.fn()}
        counts={new Map([["theatre", 12]])}
        areas={[{ name: "Old City", count: 9 }]}
        tags={tags}
        activeCount={0}
      />
    </TooltipProvider>,
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

  it("renders each tag with a label and a hide control", async () => {
    const { user } = setup();
    await openTags(user);

    expect(screen.getByRole("button", { name: /live music, 14 events/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^hide live music$/i })).toBeDefined();
  });

  it("includes a tag when its label is clicked", async () => {
    const { update, user } = setup();
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /free entry, 6 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet(["free-entry"]) });
  });

  it("clears an included tag when its label is clicked again", async () => {
    const { update, user } = setup({ tags: facet(["free-entry"]) });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /free entry, 6 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet() });
  });

  it("excludes a tag only via the deliberate hide control", async () => {
    const { update, user } = setup();
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /^hide free entry$/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet([], ["free-entry"]) });
  });

  it("goes straight from included to excluded", async () => {
    const { update, user } = setup({ tags: facet(["free-entry"]) });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /^hide free entry$/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet([], ["free-entry"]) });
  });

  it("un-hides via the same control", async () => {
    const { update, user } = setup({ tags: facet([], ["free-entry"]) });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /^stop hiding free entry$/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet() });
  });

  it("clears a tag by clicking its label", async () => {
    const { update, user } = setup({ tags: facet([], ["free-entry"]) });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /free entry, 6 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet() });
  });

  it("adds to the selection rather than replacing it", async () => {
    const { update, user } = setup({ tags: facet(["live-music"]) });
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /documentary, 4 events/i }));

    expect(update).toHaveBeenCalledWith({ tags: facet(["live-music", "documentary"]) });
  });

  it("announces an excluded tag as hidden", async () => {
    const { user } = setup({ tags: facet([], ["documentary"]) });
    await openTags(user);
    expect(screen.getByRole("button", { name: /documentary.*hidden/i })).toBeDefined();
  });

  it("leads with an All pill that clears the selection", async () => {
    const { update, user } = setup({ tags: facet(["live-music", "documentary"]) });
    await openTags(user);

    const all = screen.getByRole("button", { name: /all tags/i });
    expect(all.getAttribute("aria-pressed")).toBe("false");
    await user.click(all);
    // "All" clears both sides of the facet, not just the inclusions.
    expect(update).toHaveBeenCalledWith({ tags: facet() });
  });

  it("marks All as selected when no tag is applied", async () => {
    const { user } = setup();
    await openTags(user);
    expect(screen.getByRole("button", { name: /all tags/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the count of applied tags on the collapsed section", () => {
    setup({ tags: facet(["live-music", "free-entry"]) });
    const trigger = screen.getByRole("button", { name: /^tags/i });
    expect(within(trigger).getByText("2")).toBeDefined();
  });
});

describe("tag long tail", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ name: `tag-${i}`, count: 40 - i }));
  const pill = (name: RegExp) => screen.queryByRole("button", { name });
  const showOnly = (n: string) => screen.queryByRole("button", { name: new RegExp(`^${n}, \\d+ events`, "i") });

  it("caps the list and offers the rest", async () => {
    const { user } = setup({}, many);
    await openTags(user);

    expect(screen.getByRole("button", { name: /show 16 more/i })).toBeDefined();
    expect(showOnly("tag 39")).toBeNull();
  });

  it("reveals everything when asked", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    await user.click(screen.getByRole("button", { name: /show 16 more/i }));

    expect(showOnly("tag 39")).not.toBeNull();
  });

  it("searches the full vocabulary, not just the visible head", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    await user.type(screen.getByLabelText(/search tags/i), "tag-33");

    expect(showOnly("tag 33")).not.toBeNull();
  });

  it("keeps a selected tag visible even when it falls past the cap", async () => {
    const { user } = setup({ tags: facet(["tag-39"]) }, many);
    await openTags(user);

    // Otherwise it could be applied and impossible to remove.
    expect(showOnly("tag 39")).not.toBeNull();
  });

  it("re-sorts alphabetically on request", async () => {
    const { user } = setup({}, many);
    await openTags(user);
    // The sort control is now icons, labelled for assistive tech.
    await user.click(screen.getByRole("button", { name: /sort a to z/i }));

    const pills = screen.getAllByRole("button", { name: /^tag \d+, / });
    const names = pills.map((p) => p.getAttribute("aria-label")!.split(",")[0]);
    expect(names).toEqual([...names].sort());
  });
});
