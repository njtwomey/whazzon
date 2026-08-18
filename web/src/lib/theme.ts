import * as React from "react";

/**
 * Light, dark, or whatever the machine is set to.
 *
 * Three states rather than a boolean, because "system" is a real answer and not
 * a default: someone whose laptop flips at sunset wants the site to flip with it,
 * and collapsing that to "dark, remembered" gets it wrong twice a day. The stored
 * value is the *preference*; `.dark` on `<html>` is the resolved result.
 *
 * The class is what the CSS keys off (`@custom-variant dark`), and `color-scheme`
 * beside it is what the browser keys off for scrollbars, form controls and the
 * canvas behind the page — without it a dark page keeps a white scrollbar.
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "whazzon-theme";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function storedTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Private browsing, or a storage quota that has had enough. A theme is not
    // worth failing a render over.
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

/** The one place that touches the document. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

/**
 * The preference, applied and remembered.
 *
 * It also follows the system while the preference *is* "system" — the media
 * query fires when the machine flips, and without the listener the page would
 * only pick it up on reload.
 */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = React.useState<Theme>(storedTheme);

  React.useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // As above: remembering is a nicety, applying is the job.
    }
  }, [theme]);

  React.useEffect(() => {
    if (theme !== "system" || typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  return [theme, setTheme];
}
