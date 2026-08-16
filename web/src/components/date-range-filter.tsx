import { CalendarDays, X } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DATE_PRESETS, matchedPreset, type Filters } from "@/lib/filters";
import { addDays, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Date filtering as a range rather than a fixed set of horizons — "what's on
 * the weekend I'm visiting" is the question a listings site actually gets
 * asked, and a preset dropdown cannot answer it.
 *
 * The presets remain, because they cover the common cases in one click, and
 * they are expressed against the snapshot's as-of date rather than the browser
 * clock so the filter always agrees with the data on screen.
 */

function toDate(iso: string | undefined): Date | undefined {
  return iso ? new Date(`${iso}T12:00:00Z`) : undefined;
}

function toIso(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return utc.toISOString().slice(0, 10);
}

export function DateRangeFilter({
  filters,
  update,
  asOf,
}: {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  asOf: string;
}) {
  const [open, setOpen] = React.useState(false);
  const activePreset = matchedPreset(filters, asOf);

  const range: DateRange | undefined =
    filters.from || filters.to ? { from: toDate(filters.from), to: toDate(filters.to) } : undefined;

  const label = React.useMemo(() => {
    if (activePreset) return DATE_PRESETS.find((p) => p.days === activePreset)?.label ?? "Any time";
    if (filters.from && filters.to) return `${formatDate(filters.from)} – ${formatDate(filters.to)}`;
    if (filters.from) return `From ${formatDate(filters.from)}`;
    if (filters.to) return `Until ${formatDate(filters.to)}`;
    return "Any time";
  }, [activePreset, filters.from, filters.to]);

  const hasRange = Boolean(filters.from || filters.to);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("flex-1 justify-start font-normal", !hasRange && "text-muted-foreground")}
          >
            <CalendarDays className="size-4" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex max-sm:flex-col">
            <div className="flex flex-col gap-1 p-3 max-sm:flex-row max-sm:flex-wrap">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  variant={activePreset === preset.days ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    update({ from: asOf, to: addDays(asOf, preset.days) });
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  update({ from: undefined, to: undefined });
                  setOpen(false);
                }}
              >
                Any time
              </Button>
            </div>

            <Separator orientation="vertical" className="max-sm:hidden" />
            <Separator className="sm:hidden" />

            <Calendar
              mode="range"
              defaultMonth={toDate(filters.from) ?? toDate(asOf)}
              selected={range}
              numberOfMonths={1}
              onSelect={(next) => {
                update({ from: toIso(next?.from), to: toIso(next?.to) });
                // Kept open until both ends are chosen — closing on the first
                // click would make picking a range impossible.
                if (next?.from && next?.to) setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {hasRange && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear dates"
          onClick={() => update({ from: undefined, to: undefined })}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
