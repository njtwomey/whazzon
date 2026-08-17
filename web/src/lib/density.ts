import { Grid2x2, Grid3x3, Rows3, type LucideIcon } from "lucide-react";
import * as React from "react";

/**
 * How much room each event card gets.
 *
 * Kept in localStorage rather than the URL: it is a personal viewing preference
 * with no bearing on *which* events are shown, and a shared link should carry
 * the filters, not the reader's taste in card size.
 */
export const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "medium", label: "Medium" },
  { value: "spacious", label: "Spacious" },
] as const;

export type Density = (typeof DENSITY_OPTIONS)[number]["value"];

// Bumped when the meaning of a value changed — "compact" used to be four to a
// row and is now six, so a stored preference would silently get denser.
const STORAGE_KEY = "whazzon-density-1";

export interface DensityConfig {
  grid: string;
  imageAspect: string;
  summaryLines: string;
  /** Show the summary at all — there is no room for it at six to a row. */
  showSummary: boolean;
  /**
   * How many pills and tags stay visible when the card is at rest. The rest are
   * revealed on hover or keyboard focus, so a narrow card is not a wall of
   * overlapping chips — but nothing is permanently hidden either.
   */
  visiblePills: number;
  visibleTags: number;
  /**
   * Passed straight to shadcn's `Card`, which is where card padding and the gaps
   * between its regions actually come from: `sm` sets `--card-spacing` to 3
   * rather than 4. Spacing the card by hand instead of through this was what made
   * the tag strip look bolted on.
   */
  cardSize: "default" | "sm";
  /** Shown in the size toggle — three cell sizes you can compare at a glance. */
  icon: LucideIcon;
}

export const DENSITY: Record<Density, DensityConfig> = {
  compact: {
    grid: "grid gap-2.5 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6",
    imageAspect: "aspect-[16/9]",
    summaryLines: "line-clamp-1",
    showSummary: false,
    cardSize: "sm",
    visiblePills: 1,
    visibleTags: 2,
    icon: Grid3x3,
  },
  medium: {
    grid: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
    imageAspect: "aspect-[16/8]",
    summaryLines: "line-clamp-2",
    showSummary: true,
    cardSize: "default",
    visiblePills: 2,
    visibleTags: 3,
    icon: Grid2x2,
  },
  spacious: {
    grid: "grid gap-5 lg:grid-cols-2",
    imageAspect: "aspect-[16/7]",
    summaryLines: "line-clamp-4",
    showSummary: true,
    cardSize: "default",
    visiblePills: 99,
    visibleTags: 99,
    icon: Rows3,
  },
};

export function useDensity(): [Density, (density: Density) => void] {
  const [density, setDensityState] = React.useState<Density>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Density | null;
    return stored && DENSITY_OPTIONS.some((option) => option.value === stored) ? stored : "medium";
  });

  const setDensity = React.useCallback((next: Density) => {
    setDensityState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return [density, setDensity];
}
