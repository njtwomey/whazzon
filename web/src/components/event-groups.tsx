import * as React from "react";
import { EventCard } from "@/components/event-card";
import { Badge } from "@/components/ui/badge";
import { DENSITY, type Density } from "@/lib/density";
import { bucketOf, formatMonth, monthKey } from "@/lib/format";
import type { SnapshotEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Dated events are grouped by month; everything without a place on a timeline —
 * weekly markets, permanent collections, "coming soon" — is gathered into its
 * own sections underneath.
 *
 * Mixing them would either bury the regular things or scatter them arbitrarily
 * through the calendar, and both are worse than saying plainly which is which.
 */

export interface EventGroup {
  key: string;
  title: string;
  subtitle?: string;
  events: SnapshotEvent[];
}

export function groupEvents(events: SnapshotEvent[], asOf: string): EventGroup[] {
  const dated = new Map<string, SnapshotEvent[]>();
  const regular: SnapshotEvent[] = [];
  const undated: SnapshotEvent[] = [];

  for (const event of events) {
    const bucket = bucketOf(event);
    if (bucket === "regular") regular.push(event);
    else if (bucket === "undated") undated.push(event);
    else {
      // A run already under way belongs to the current month, not the month it
      // opened — otherwise a play that started in July files itself under a
      // heading that has already passed.
      const key = monthKey(event.sortDate && event.sortDate > asOf ? event.sortDate : asOf);
      const list = dated.get(key) ?? [];
      list.push(event);
      dated.set(key, list);
    }
  }

  const groups: EventGroup[] = [...dated.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, title: formatMonth(`${key}-01`), events: list }));

  if (regular.length) {
    groups.push({
      key: "regular",
      title: "Regular & ongoing",
      subtitle: "Repeating events and permanent things, which have no single date",
      events: regular,
    });
  }
  if (undated.length) {
    groups.push({
      key: "undated",
      title: "Dates to be confirmed",
      subtitle: "Announced by the venue without a usable date",
      events: undated,
    });
  }
  return groups;
}

/** Rendered in the first pass, and added each time the sentinel comes into view. */
const PAGE = 60;

/**
 * How many cards to mount, growing as the reader approaches the end.
 *
 * Mounting a thousand cards costs real time even with off-screen paint skipped,
 * and almost nobody scrolls that far. This renders a screenful or two and
 * extends before the reader reaches the bottom, so it never reads as pagination.
 *
 * Deliberately not full virtualisation: cards live in month sections of varying
 * height, so a windowing library would need measured offsets for a problem that
 * a growing cap solves.
 */
function useProgressiveCount(total: number, resetKey: string): [number, (node: HTMLDivElement | null) => void] {
  const [count, setCount] = React.useState(PAGE);

  // A new filter means a new list — start from the top again.
  React.useEffect(() => setCount(PAGE), [resetKey]);

  const observer = React.useRef<IntersectionObserver | null>(null);

  const sentinelRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!node) return;

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setCount((current) => Math.min(current + PAGE, total));
          }
        },
        // Generous margin so the next batch is mounted before it is needed.
        // Root is the viewport: the results pane scrolls inside it, so a
        // sentinel in that pane still crosses the viewport as it moves.
        { rootMargin: "800px 0px" },
      );
      observer.current.observe(node);
    },
    [total],
  );

  React.useEffect(() => () => observer.current?.disconnect(), []);

  return [count, sentinelRef];
}

export function EventGroups({
  groups,
  asOf,
  density,
  onOpen,
}: {
  groups: EventGroup[];
  asOf: string;
  density: Density;
  onOpen: (event: SnapshotEvent) => void;
}) {
  const total = React.useMemo(() => groups.reduce((n, group) => n + group.events.length, 0), [groups]);
  const resetKey = React.useMemo(
    () => `${total}:${groups.map((g) => g.key).join(",")}:${groups[0]?.events[0]?.id ?? ""}`,
    [groups, total],
  );
  const [count, sentinelRef] = useProgressiveCount(total, resetKey);

  /**
   * Spend the budget across groups in order, so the cap behaves like scrolling
   * a single list rather than truncating every section a little.
   */
  const visible = React.useMemo(() => {
    let budget = count;
    const out: (EventGroup & { total: number })[] = [];
    for (const group of groups) {
      if (budget <= 0) break;
      out.push({ ...group, events: group.events.slice(0, budget), total: group.events.length });
      budget -= Math.min(budget, group.events.length);
    }
    return out;
  }, [groups, count]);

  const remaining = total - Math.min(count, total);

  return (
    <div className="grid gap-10">
      {visible.map((group) => (
        <section key={group.key}>
          {/* Sticks to the results pane, not the viewport, since the pane is its
              own scroll container. */}
          <div className="sticky top-0 z-30 -mx-1 bg-background/90 px-1 py-2 backdrop-blur lg:-top-6 lg:pt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
              <Badge variant="secondary">{group.total}</Badge>
            </div>
            {group.subtitle && <p className="text-sm text-muted-foreground">{group.subtitle}</p>}
          </div>

          <div className={cn("mt-3", DENSITY[density].grid)}>
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} asOf={asOf} density={density} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}

      {remaining > 0 && (
        <div ref={sentinelRef} className="py-6 text-center text-sm text-muted-foreground">
          Loading {remaining.toLocaleString()} more…
        </div>
      )}
    </div>
  );
}
