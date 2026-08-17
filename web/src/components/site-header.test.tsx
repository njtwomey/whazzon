/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Search commits to the URL on a delay, because filter state lives in the URL
 * and a keystroke re-renders the whole result set. At a thousand events that was
 * visible lag. These tests pin the two halves of that: the field stays
 * immediate, and the expensive commit happens once.
 */

function setup(query = "") {
  const onQueryChange = vi.fn();
  render(
    <MemoryRouter>
      {/* The card-size buttons carry tooltips, so the provider is not optional. */}
      <TooltipProvider>
        <SiteHeader
          locationName="Bristol"
          asOf="2026-08-16"
          eventCount={1095}
          sourceCount={155}
          categoryCount={16}
          failingSourceCount={0}
          query={query}
          onQueryChange={onQueryChange}
          filterSlot={null}
          activeFilterCount={0}
          density="medium"
          setDensity={() => {}}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return { onQueryChange };
}

const field = () => screen.getByLabelText("Search") as HTMLInputElement;

/** Type character by character, so a per-keystroke commit would be caught. */
function type(text: string) {
  for (let i = 1; i <= text.length; i += 1) {
    fireEvent.change(field(), { target: { value: text.slice(0, i) } });
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("search", () => {
  it("updates the field immediately without committing", () => {
    const { onQueryChange } = setup();

    act(() => type("jazz"));

    expect(field().value).toBe("jazz");
    // Nothing has been committed yet — this is what keeps typing responsive.
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("commits once after typing stops", () => {
    const { onQueryChange } = setup();

    act(() => type("jazz"));
    act(() => vi.advanceTimersByTime(250));

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith("jazz");
  });

  it("does not commit a partial word mid-typing", () => {
    const { onQueryChange } = setup();

    act(() => type("jaz"));
    // Shorter than the debounce: the pending commit should have been cancelled
    // and replaced, not fired.
    act(() => vi.advanceTimersByTime(150));
    act(() => type("jazz"));
    act(() => vi.advanceTimersByTime(250));

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith("jazz");
  });

  it("follows the URL when it changes from elsewhere", () => {
    // Reset, or landing on a shared link, must fill the field.
    const { onQueryChange } = setup("folk");

    expect(field().value).toBe("folk");
    expect(onQueryChange).not.toHaveBeenCalled();
  });
});
