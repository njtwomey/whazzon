/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapBanner } from "./map-banner";
import { ThemeToggle } from "./theme-toggle";

/**
 * Two things the theme has to reach beyond the stylesheet: the control that flips
 * it, and anything whose *markup* depends on it. The banners are the latter —
 * each map is a third of a megabyte, so the theme picks one rather than the CSS
 * hiding one.
 */

function systemIsDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  systemIsDark(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the theme toggle", () => {
  it("offers the theme you are not in", () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
  });

  it("takes one click to override the system, whichever way round it is", async () => {
    systemIsDark(true);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    // Following a dark machine, so the button offers light — and taking it is an
    // explicit choice that outlives the next sunrise.
    await user.click(screen.getByLabelText("Switch to light mode"));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("whazzon-theme")).toBe("light");
  });
});

describe("which banner is fetched", () => {
  it("takes the dark map when the page is dark", () => {
    systemIsDark(true);
    render(<MapBanner src="/light.svg" srcDark="/dark.svg" title="cork" />);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/dark.svg");
  });

  it("falls back to the light map when a location has no dark one", () => {
    systemIsDark(true);
    render(<MapBanner src="/light.svg" title="cork" />);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/light.svg");
  });

  it("uses the light map in light mode", () => {
    render(<MapBanner src="/light.svg" srcDark="/dark.svg" title="cork" />);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/light.svg");
  });
});
