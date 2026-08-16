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
  return (
    <div className="grid gap-10">
      {groups.map((group) => (
        <section key={group.key}>
          {/* Sticks to the results pane, not the viewport, since the pane is its
              own scroll container. */}
          <div className="sticky top-0 z-30 -mx-1 bg-background/90 px-1 py-2 backdrop-blur lg:-top-6 lg:pt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
              <Badge variant="secondary">{group.events.length}</Badge>
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
    </div>
  );
}
