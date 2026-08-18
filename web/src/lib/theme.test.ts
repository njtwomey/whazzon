/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTheme, storedTheme, useTheme } from "./theme";

/**
 * The theme is one of the few things that has to be right *before* anything
 * renders, and the only piece of state the app keeps outside the URL. These pin
 * the two halves: what gets remembered, and what ends up on `<html>`.
 */

/** jsdom has no `matchMedia`, so the machine's preference is ours to set. */
function systemIsDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  systemIsDark(false);
});

afterEach(() => {
  // Unmount, so the store's subscribers do not pile up across tests.
  cleanup();
  vi.unstubAllGlobals();
});

describe("the stored preference", () => {
  it("is system until someone says otherwise", () => {
    expect(storedTheme()).toBe("system");
  });

  it("remembers a choice", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]("dark"));

    expect(localStorage.getItem("whazzon-theme")).toBe("dark");
    expect(storedTheme()).toBe("dark");
  });

  it("ignores a value it does not recognise, rather than trusting storage", () => {
    localStorage.setItem("whazzon-theme", "midnight");
    expect(storedTheme()).toBe("system");
  });
});

describe("what lands on the document", () => {
  it("adds the class for dark and removes it for light", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]("dark"));
    expect(isDark()).toBe(true);

    act(() => result.current[1]("light"));
    expect(isDark()).toBe(false);
  });

  it("follows the machine when the preference is system", () => {
    systemIsDark(true);
    const { result } = renderHook(() => useTheme());

    expect(result.current[0]).toBe("system");
    expect(isDark()).toBe(true);
  });

  it("keeps an explicit choice even when the machine disagrees", () => {
    systemIsDark(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]("light"));

    // The whole reason "system" is a separate state: choosing light must mean
    // light, not "light until sunset".
    expect(isDark()).toBe(false);
  });
});

describe("resolving", () => {
  it("reads the machine only for system", () => {
    systemIsDark(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});
