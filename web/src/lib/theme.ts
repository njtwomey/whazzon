import * as React from "react";

/**
 * Light, dark, or whatever the machine is set to.
 *
 * Three states rather than a boolean, because "system" is a real answer and not a
 * default: someone whose laptop flips at sunset wants the site to flip with it.
 * What is stored is the *preference*; `.dark` on `<html>` is the resolved result,
 * and `color-scheme` beside it is what the browser keys off for scrollbars and
 * form controls.
 *
 * **One store, not one copy per component.** This was `useState` inside a hook,
 * which gave every caller its own idea of the theme: the toggle updated its copy,
 * the banner never heard, and the toggle's own `useResolvedTheme` — a second call,
 * so a second copy — kept computing the next theme from a stale one, which made
 * the second click a no-op. `useSyncExternalStore` over `localStorage` is the fix
 * and the whole of it: storage is the single source of truth, every subscriber
 * re-renders together, and a second tab follows through the `storage` event.
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "whazzon-theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** The preference. Also the store's snapshot, so it is read rather than cached. */
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

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Choose a theme: remember it, apply it, and tell everything on the page. */
export function setTheme(next: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Remembering is a nicety; applying is the job.
  }
  applyTheme(next);
  notify();
}

/** Bound once, lazily: the machine flipping is a change even when nobody chose it. */
let watchingSystem = false;

function watchSystem(): void {
  if (watchingSystem || typeof matchMedia !== "function") return;
  watchingSystem = true;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (storedTheme() === "system") applyTheme("system");
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  // Self-healing, on every subscription rather than the first: normally the
  // inline script in index.html has already put the class on before first paint,
  // and this agrees with it. It is a `classList.toggle` — cheap enough that
  // "which subscriber am I" is not worth tracking.
  applyTheme(storedTheme());
  listeners.add(listener);
  watchSystem();

  // Another tab changing the preference is the same event as this one changing it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(storedTheme());
    notify();
  };
  addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

/** The preference, and how to change it. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = React.useSyncExternalStore(subscribe, storedTheme, () => "system" as Theme);
  return [theme, setTheme];
}

/**
 * What is actually on screen.
 *
 * Anything whose *markup* depends on the theme needs this rather than the
 * preference — the toggle's icon, and the banner's `src`, since each map is a
 * third of a megabyte and only the one being shown should be fetched.
 */
export function useResolvedTheme(): "light" | "dark" {
  return React.useSyncExternalStore(
    subscribe,
    () => resolveTheme(storedTheme()),
    () => "light" as const,
  );
}
