import { CalendarClock, ImageOff, MapPin, Repeat } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bucketOf, formatDate, formatDay, occurrenceLabel, occurrenceTime, priceLabel } from "@/lib/format";
import { DENSITY, type Density } from "@/lib/density";
import type { SnapshotEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A media card: the venue's own image, with the facts someone needs to decide
 * whether they care — when, what, where, how much. The venue's full copy stays
 * one click away in the dialog. The temptation with scraped data is to show all
 * of it, which produces a wall no one reads.
 *
 * Images are hotlinked from the source, so any of them can fail at any time.
 * A broken image must degrade to the no-image layout rather than leaving a
 * torn box in the grid.
 */

/** The compact date marker overlaid on the image, or shown inline without one. */
function DateChip({ event, asOf, overlay }: { event: SnapshotEvent; asOf: string; overlay?: boolean }) {
  const { occurrence } = event;
  const base = cn("gap-1.5", overlay && "bg-background/90 shadow-sm backdrop-blur-sm");

  if (occurrence.kind === "single") {
    const [, month, day] = occurrence.date.split("-");
    return (
      <Badge variant="secondary" className={base}>
        <span className="text-muted-foreground">{formatDay(occurrence.date)}</span>
        <span className="tabular-nums">
          {Number(day)} {formatDate(`2000-${month}-01`).split(" ")[1]}
        </span>
      </Badge>
    );
  }

  const label =
    occurrence.kind === "run"
      ? !occurrence.start || occurrence.start <= asOf
        ? "Now on"
        : "Run"
      : occurrence.kind === "recurring"
        ? "Regular"
        : occurrence.kind === "ongoing"
          ? "Ongoing"
          : "Date TBC";

  return (
    <Badge variant="secondary" className={base}>
      {occurrence.kind === "recurring" ? (
        <Repeat className="size-3.5 text-muted-foreground" />
      ) : (
        <CalendarClock className="size-3.5 text-muted-foreground" />
      )}
      {label}
    </Badge>
  );
}

function EventCardImpl({
  event,
  asOf,
  density = "medium",
  onOpen,
}: {
  event: SnapshotEvent;
  asOf: string;
  density?: Density;
  onOpen: (event: SnapshotEvent) => void;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const config = DENSITY[density];
  const price = priceLabel(event);
  const time = occurrenceTime(event.occurrence);
  const isNew = event.firstSeen === event.lastSeen && bucketOf(event) !== "undated";
  const showImage = Boolean(event.image) && !imageFailed;

  /**
   * "Now on" and "New" are both statements about currency rather than about
   * when something is, so they cluster on the right with the price. That leaves
   * the top-left for a date — and a run already under way has no date to show
   * there, which is why the chip moves rather than duplicating.
   */
  const nowOn = event.occurrence.kind === "run" && (!event.occurrence.start || event.occurrence.start <= asOf);

  /**
   * Pills in priority order. A narrow card cannot show all of them without
   * wrapping into a block, so the most consequential come first and the rest
   * appear on hover or focus. Status leads: whether something is sold out
   * changes the decision more than which category it belongs to.
   */
  const pills: { key: string; label: string; node: React.ReactNode }[] = [];
  if (event.status === "sold-out")
    pills.push({ key: "sold", label: "Sold out", node: <Badge variant="destructive">Sold out</Badge> });
  if (event.status === "cancelled")
    pills.push({ key: "cancelled", label: "Cancelled", node: <Badge variant="destructive">Cancelled</Badge> });
  if (event.status === "postponed")
    pills.push({ key: "postponed", label: "Postponed", node: <Badge variant="destructive">Postponed</Badge> });
  pills.push({
    key: "category",
    label: event.categoryLabel,
    node: (
      <Badge variant="secondary" className="max-w-[11rem] truncate">
        {event.categoryLabel}
      </Badge>
    ),
  });
  if (event.state === "carried")
    pills.push({
      key: "carried",
      label: "Unconfirmed",
      node: (
        <Badge variant="outline" title={`Last confirmed ${event.lastSeen}`}>
          Unconfirmed
        </Badge>
      ),
    });
  if (event.state === "finished")
    pills.push({ key: "finished", label: "Finished", node: <Badge variant="outline">Finished</Badge> });
  if (event.ageRestriction)
    pills.push({
      key: "age",
      label: event.ageRestriction,
      node: <Badge variant="outline">{event.ageRestriction}</Badge>,
    });

  const hiddenPills = Math.max(0, pills.length - config.visiblePills);
  const hiddenTags = Math.max(0, event.tags.length - config.visibleTags);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(event);
        }
      }}
      className={cn(
        "group relative cursor-pointer gap-0 overflow-hidden p-0",
        // Skip layout and paint while off screen — see .card-skip in index.css.
        "card-skip",
        // A card is a button, so hovering should feel like one: it lifts,
        // takes a real shadow, and picks up a coloured edge. The subtle
        // version read as nothing happening at all.
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
        "focus-visible:-translate-y-1 focus-visible:border-primary/40 focus-visible:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:translate-y-0 active:shadow-md",
        // Respect a reduced-motion preference: keep the shadow, drop the lift.
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        event.state === "finished" && "opacity-60",
      )}
    >
      {showImage ? (
        <div className={cn("relative overflow-hidden bg-muted", config.imageAspect)}>
          <img
            src={event.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {/* These ride at the very top, not down among the category pills:
              they are what a returning reader scans for, and up here they are
              visible before the title is even read. */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            <span className="flex min-w-0 items-center gap-1.5">
              {!nowOn && <DateChip event={event} asOf={asOf} overlay />}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {nowOn && <DateChip event={event} asOf={asOf} overlay />}
              {isNew && <Badge className="shadow-sm">New</Badge>}
              {price && (
                <Badge variant="secondary" className="bg-background/90 tabular-nums shadow-sm backdrop-blur-sm">
                  {price}
                </Badge>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5">{!nowOn && <DateChip event={event} asOf={asOf} />}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {nowOn && <DateChip event={event} asOf={asOf} />}
            {isNew && <Badge>New</Badge>}
            {price && <span className="text-xs font-medium tabular-nums text-muted-foreground">{price}</span>}
            <ImageOff className="size-3.5 text-muted-foreground/50" aria-hidden />
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 pb-0">
        {/* Title and pills share a line: the title takes the space it needs and
            truncates, the pills hug the right. They belong together because the
            pills change how the title reads — "Sold out" after the fact is a
            different sentence. The row is strictly one line: pills beyond what
            fits are named in a tooltip on the counter, because expanding them
            on hover pushed the row onto a second line. */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight group-hover:underline">
            {event.title}
          </h3>
          <div className="flex max-w-[55%] shrink-0 items-center gap-1 overflow-hidden">
            {pills.slice(0, config.visiblePills).map((pill) => (
              <span key={pill.key} className="min-w-0">
                {pill.node}
              </span>
            ))}
            {hiddenPills > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="shrink-0 cursor-default tabular-nums text-muted-foreground">
                    +{hiddenPills}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {pills
                    .slice(config.visiblePills)
                    .map((pill) => pill.label)
                    .join(" · ")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <p className="truncate text-sm text-muted-foreground">
          {occurrenceLabel(event.occurrence, asOf)}
          {time && ` · ${time}`}
        </p>

        <p className="flex items-center gap-1 truncate text-sm">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{event.venueName}</span>
          {event.area && <span className="shrink-0 truncate text-muted-foreground">· {event.area}</span>}
        </p>

        {config.showSummary && (
          <p className={cn("text-sm text-muted-foreground", config.summaryLines)}>
            {event.summary.replace(/[*_`#[\]]/g, "")}
          </p>
        )}

        {/* A footer, pinned to the bottom edge: tags sit in the same place on
            every card in a row, however tall the title or summary turned out. */}
        <div className="-mx-4 mt-auto flex flex-wrap items-center gap-1 border-t px-4 pb-2 pt-1.5">
          {event.tags.map((tag, index) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "font-normal text-muted-foreground",
                index >= config.visibleTags && "hidden group-hover:inline-flex group-focus-visible:inline-flex",
              )}
            >
              {tag.replace(/-/g, " ")}
            </Badge>
          ))}
          {hiddenTags > 0 && (
            <Badge
              variant="outline"
              className="tabular-nums text-muted-foreground group-hover:hidden group-focus-visible:hidden"
            >
              +{hiddenTags}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Memoised because a filter change re-renders the list, and at a thousand cards
 * that is a thousand pointless re-renders — every prop here is stable across
 * one: `event` comes from the immutable snapshot, `asOf` and `density` are
 * primitives, and `onOpen` is a `useState` setter.
 */
export const EventCard = React.memo(EventCardImpl);
