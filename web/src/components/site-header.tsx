import { Info, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DENSITY, DENSITY_OPTIONS, type Density } from "@/lib/density";
import { formatDate } from "@/lib/format";

/**
 * One bar for everything you do to the listing.
 *
 * It used to be split: identity and search up here, dates, sort and card size in a
 * toolbar above the results. Two bars of controls meant looking in two places for
 * the same kind of thing, so they are together now, and the split is by purpose
 * instead — **who and where** on the left, **what you do about it** on the right.
 *
 * The left is a breadcrumb: `whazzon / bristol`. One city page looks much like
 * another, so the bar has to say which one you are on, and the trail gives the way
 * back out at the same time.
 *
 * The counts moved into a hover card behind an ⓘ. They are worth having and worth
 * nobody's screen space: how many events there are does not change what you click,
 * and the number of unreachable sources is a caveat rather than a headline. Reading
 * them on demand is the right trade.
 *
 * Dates are not here. They started here and moved into the panel as a Date facet,
 * with everything else you narrow by — one filter kept somewhere else meant the
 * panel's count badge was never the whole story.
 *
 * Compression order matters, because this bar has more in it than a phone can hold.
 * Search is last to go — it is the one control that reaches anything. Card size
 * goes first, then the sidebar collapses into the filters sheet, and everything
 * that hid is inside it.
 */
export function SiteHeader({
  locationName,
  locationImageUrl,
  asOf,
  eventCount,
  sourceCount,
  categoryCount,
  failingSourceCount,
  query,
  onQueryChange,
  filterSlot,
  activeFilterCount,
  density,
  setDensity,
}: {
  locationName: string;
  /**
   * The city's own illustration, as its mark. Optional: it comes from the
   * locations index rather than the snapshot, so a page can render before it
   * arrives, and a location need not have an image at all.
   */
  locationImageUrl?: string;
  asOf: string;
  eventCount: number;
  sourceCount: number;
  categoryCount: number;
  failingSourceCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  filterSlot: React.ReactNode;
  activeFilterCount: number;
  density: Density;
  setDensity: (density: Density) => void;
}) {
  // One broken image should not leave a torn box in the header.
  const [markFailed, setMarkFailed] = React.useState(false);
  React.useEffect(() => setMarkFailed(false), [locationImageUrl]);

  /**
   * The field is local and commits to the URL after a pause.
   *
   * Filter state lives in the URL, which is right for linkability but means a
   * keystroke re-renders the whole result set. At a thousand events that made
   * typing visibly lag. Debouncing keeps the input immediate and does the
   * expensive work once the person stops typing.
   */
  const [draft, setDraft] = React.useState(query);

  // Follow the URL when it changes from elsewhere — Reset, or a shared link.
  React.useEffect(() => setDraft(query), [query]);

  React.useEffect(() => {
    if (draft === query) return;
    const timer = setTimeout(() => onQueryChange(draft), 200);
    return () => clearTimeout(timer);
  }, [draft, query, onQueryChange]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* city mark | whazzon / city.

            The city's own illustration leads, because it is the fastest way to
            know which page you are on — you recognise the shape before you read
            the word. Then a rule, then the trail: the bar had carried the city's
            name alone, which said where you were but not how to leave, since the
            way back was that name being a link you had to guess at.

            A slash rather than the default chevron. Two crumbs read as a path,
            and the slash is the punctuation the URL uses. */}
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          {locationImageUrl && !markFailed && (
            <img
              src={`${import.meta.env.BASE_URL}${locationImageUrl}`}
              alt=""
              onError={() => setMarkFailed(true)}
              className="h-8 w-14 shrink-0 rounded-md object-cover ring-1 ring-border"
            />
          )}

          {locationImageUrl && !markFailed && <Separator orientation="vertical" className="h-6" />}

          <Breadcrumb>
            <BreadcrumbList className="gap-1.5 text-base sm:gap-1.5">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="lowercase tracking-tight">
                  <Link to="/">whazzon</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-muted-foreground/50">/</BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold lowercase tracking-tight">{locationName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Everything the old toolbar said in prose, on demand. A hover card rather
            than a tooltip because it is a small table, and because the unreachable
            count deserves room to explain itself rather than being a bare number
            with a warning triangle next to it. */}
        <HoverCard openDelay={120}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label="About this listing"
              className="shrink-0 rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-4" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-72">
            <p className="text-sm font-medium">{locationName}</p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="tabular-nums">{formatDate(asOf, true)}</dd>
              <dt className="text-muted-foreground">Events</dt>
              <dd className="tabular-nums">{eventCount.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Sources</dt>
              <dd className="tabular-nums">{sourceCount.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Categories</dt>
              <dd className="tabular-nums">{categoryCount}</dd>
            </dl>
            {failingSourceCount > 0 && (
              <p className="mt-3 flex gap-2 border-t pt-3 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {failingSourceCount} {failingSourceCount === 1 ? "source was" : "sources were"} unreachable at the
                  last harvest, so anything they list is missing here rather than not on.
                </span>
              </p>
            )}
          </HoverCardContent>
        </HoverCard>

        <InputGroup className="ml-auto min-w-0 max-w-sm flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            className="min-w-0"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search events, venues…"
            aria-label="Search"
          />
        </InputGroup>

        {/* Three cell icons rather than a labelled select: the choice is about
            shape, so showing the shapes is quicker to read than naming them. */}
        <ButtonGroup aria-label="Card size" className="hidden shrink-0 sm:flex">
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

        {/* Beside card size: both are about how the page looks rather than what
            it shows, and neither belongs in the filter panel. It survives the
            small-screen squeeze because a reader in the dark cannot work around
            its absence the way they can open a sheet. */}
        <ThemeToggle className="shrink-0" />

        {/* Filters live in a sheet on small screens and a sidebar on large ones. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0 lg:hidden" aria-label="Filters">
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-medium text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] overflow-y-auto p-5">
            <SheetTitle className="sr-only">Filters</SheetTitle>
            {filterSlot}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
