import { Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";

/**
 * One bar, not a bar plus a hero. The page's whole job is to show events, and a
 * large banner repeating the city name pushes the first row of cards below the
 * fold. The title carries the same information in a line: which city, and how
 * fresh the data is.
 */
export function SiteHeader({
  locationName,
  asOf,
  eventCount,
  query,
  onQueryChange,
  filterSlot,
  activeFilterCount,
}: {
  locationName: string;
  asOf: string;
  eventCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  filterSlot: React.ReactNode;
  activeFilterCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-baseline gap-2" title="All locations">
          <span className="text-lg font-semibold tracking-tight">
            whazzon <span className="text-primary">{locationName.toLowerCase()}</span>
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            last updated {formatDate(asOf, true)}
          </span>
        </Link>

        <Badge variant="secondary" className="hidden shrink-0 tabular-nums md:inline-flex">
          {eventCount.toLocaleString()} events
        </Badge>

        <InputGroup className="ml-auto w-full max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search events, venues…"
            aria-label="Search"
          />
        </InputGroup>

        {/* Filters live in a sheet on small screens and a sidebar on large ones. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative lg:hidden" aria-label="Filters">
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-1.5 -top-1.5 size-4 justify-center p-0 text-[0.6rem]"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] overflow-y-auto p-5">
            <SheetTitle className="sr-only">Filters</SheetTitle>
            {filterSlot}
          </SheetContent>
        </Sheet>

        <ThemeToggle />
      </div>
    </header>
  );
}
