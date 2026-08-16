import { ArrowUpDown, Radio, TriangleAlert } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DENSITY, DENSITY_OPTIONS, type Density } from "@/lib/density";
import { SORT_OPTIONS, type Filters } from "@/lib/filters";

/**
 * The bar above the results: how many there are, and the controls people reach
 * for first.
 *
 * "On now" and the date range live here rather than in the sidebar because they
 * are the two questions someone arrives with, and the sidebar's sections are
 * collapsed by default. Sort and size sit alongside them because they act on
 * what is already on screen.
 */
export function ResultsToolbar({
  count,
  activeFilterCount,
  failingSourceCount,
  filters,
  update,
  asOf,
  density,
  setDensity,
}: {
  count: number;
  activeFilterCount: number;
  failingSourceCount: number;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  asOf: string;
  density: Density;
  setDensity: (density: Density) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{count.toLocaleString()}</span> {count === 1 ? "event" : "events"}
        {activeFilterCount > 0 && " matching your filters"}
        {failingSourceCount > 0 && (
          <span className="ml-2 inline-flex items-center gap-1">
            <TriangleAlert className="size-3.5" />
            {failingSourceCount} sources unreachable last harvest
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filters.onNow ? "default" : "outline"}
          size="sm"
          onClick={() => update({ onNow: !filters.onNow })}
          aria-pressed={filters.onNow}
        >
          <Radio className="size-4" /> On now
        </Button>

        <div className="w-56">
          <DateRangeFilter filters={filters} update={update} asOf={asOf} />
        </div>

        {/* The control says what it controls. A bare "By date" next to a bare
            "Medium" tells you neither what is being sorted nor what is being
            sized, so sort keeps an icon and an explicit prefix, and size becomes
            three cell icons you can compare at a glance. */}
        <Select value={filters.sort} onValueChange={(sort) => update({ sort: sort as Filters["sort"] })}>
          <SelectTrigger className="w-48" aria-label="Sort order">
            <ArrowUpDown className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sort:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ButtonGroup aria-label="Card size">
          {DENSITY_OPTIONS.map((option) => {
            const Icon = DENSITY[option.value].icon;
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={density === option.value ? "default" : "outline"}
                    size="icon"
                    aria-pressed={density === option.value}
                    aria-label={`${option.label} cards`}
                    onClick={() => setDensity(option.value)}
                  >
                    <Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{option.label} cards</TooltipContent>
              </Tooltip>
            );
          })}
        </ButtonGroup>
      </div>
    </div>
  );
}
