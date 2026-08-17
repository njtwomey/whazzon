import { ArrowRight, Building2, CalendarDays, LayoutGrid, MapPinned, Rss, Search, Tags } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { MapBanner } from "@/components/map-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { useLocations } from "@/lib/snapshot";
import type { LocationSummary } from "@/lib/types";

/**
 * One count: its icon, the number, what it counts, and the interpunct that
 * follows it.
 *
 * The separator belongs *inside* the item, and the whole thing is
 * `whitespace-nowrap`. That is what makes a single wrapping list behave: the
 * unbreakable unit is "stat plus its trailing dot", so a wrap can only happen
 * between units and a dot can never be orphaned at the start of a line. Dots as
 * siblings of their own would land wherever the wrap fell.
 */
function Stat({ icon, value, label, last }: { icon: React.ReactNode; value: number; label: string; last: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" title={`${value.toLocaleString()} ${label}`}>
      <span className="text-muted-foreground/70 [&>svg]:size-3.5">{icon}</span>
      <span className="font-medium tabular-nums text-foreground">{value.toLocaleString()}</span>
      {label}
      {!last && <span className="mx-2 text-muted-foreground/40">·</span>}
    </span>
  );
}

/**
 * What a city amounts to, in numbers.
 *
 * One list at one size. The as-of date is not in here — it is a fact about the
 * data rather than another thing the city has, so it belongs in the card's
 * footer, which already draws the rule and sits flush to the bottom edge.
 *
 * Venues, areas and tags are counted over events, so they answer "how much of
 * the city is doing something" rather than "how much have we catalogued". A
 * location compiled before `sync-web` emitted them has none, so each is
 * conditional rather than defaulted to zero — an absent count and a real zero
 * are different claims.
 */
function LocationStats({ location }: { location: LocationSummary }) {
  // Conditional spreads rather than filtering falsy entries out: the absent
  // counts simply contribute nothing, and the annotation keeps `icon` a
  // ReactNode instead of narrowing to JSX.Element.
  const stats: { icon: React.ReactNode; value: number; label: string }[] = [
    { icon: <CalendarDays />, value: location.eventCount, label: "events" },
    ...(location.venueCount === undefined
      ? []
      : [{ icon: <Building2 />, value: location.venueCount, label: "venues" }]),
    { icon: <LayoutGrid />, value: location.categoryCount, label: "categories" },
    ...(location.tagCount === undefined ? [] : [{ icon: <Tags />, value: location.tagCount, label: "tags" }]),
    ...(location.areaCount === undefined ? [] : [{ icon: <MapPinned />, value: location.areaCount, label: "areas" }]),
    { icon: <Rss />, value: location.sourceCount, label: "sources" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-y-1 text-sm text-muted-foreground">
      {stats.map((stat, i) => (
        <Stat key={stat.label} {...stat} last={i === stats.length - 1} />
      ))}
    </div>
  );
}

/**
 * The image is the card, so the credit has nowhere obvious to sit — printing it
 * under a city would put attribution ahead of the thing people came for. A
 * tooltip on the image is where a reader looks for it anyway, and it is the only
 * place `imageCredit` was ever surfaced: `sync-web` has always published it and
 * nothing rendered it.
 *
 * Long delay, deliberately. The provider's default is instant, which is right
 * for a control you have aimed at and wrong for a card the size of a postcard —
 * every drift of the mouse across the grid would fire one.
 */
function LocationMedia({ location }: { location: LocationSummary }) {
  const media = (
    // `rounded-t-xl` here rather than relying on the Card's
    // `*:[img:first-child]:rounded-t-xl`, which does not fire: the card's first
    // child is this wrapper, not the image itself.
    <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-muted">
      {location.imageUrl && (
        <img
          src={`${import.meta.env.BASE_URL}${location.imageUrl}`}
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{location.name}</h2>
            <p className="truncate text-sm text-white/75">
              {location.region}, {location.country}
            </p>
          </div>
          <ArrowRight className="mb-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );

  // Nothing to credit, so nothing to hover.
  if (!location.imageUrl) return media;

  return (
    <Tooltip delayDuration={600}>
      <TooltipTrigger asChild>{media}</TooltipTrigger>
      {/* Below, not above: the city's name sits at the foot of the image, and a
          tooltip on top would cover the one thing the card is for.

          `block` overrides the content's default `inline-flex`, which centres a
          single row and would run the two sentences together. The credit needs
          to read as a credit rather than as more of the invitation. */}
      <TooltipContent side="bottom" className="block max-w-sm text-pretty">
        <span className="block">Discover events in {location.name}.</span>
        {location.imageCredit && (
          <span className="mt-1.5 block text-background/70">Image Credits: {location.imageCredit}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The front door. With one city it is nearly a redirect, but it is the piece
 * that makes the project honestly multi-location rather than Bristol with a
 * parameter — and the counts give each city a recognisable shape before you
 * commit to loading a whole snapshot.
 */
export function LandingPage() {
  const locations = useLocations();
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    document.title = "whazzon";
  }, []);

  const visible = React.useMemo(() => {
    if (locations.status !== "ready") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return locations.data;
    return locations.data.filter((location) =>
      `${location.name} ${location.region} ${location.country}`.toLowerCase().includes(needle),
    );
  }, [locations, query]);

  return (
    <div className="min-h-dvh">
      {/* The site-wide banner. Cork's map, because it is the city the mark was
          drawn from; every city page shows its own instead. */}
      <MapBanner
        src={`${import.meta.env.BASE_URL}banner.svg`}
        title="whazzon"
        className="h-52 sm:h-64 lg:h-72"
        titleClassName="text-6xl sm:text-7xl lg:text-8xl"
        subtitle={
          <p className="mt-1 font-light tracking-wide text-muted-foreground/80 sm:text-lg">werzziton and whenzziton</p>
        }
      />

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold tracking-tight">City listing</h2>

        {locations.status === "ready" && locations.data.length > 3 && (
          <InputGroup className="mt-8 max-w-sm">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter cities…"
              aria-label="Filter cities"
            />
          </InputGroup>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.status === "loading" && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44" />)}

          {visible.map((location) => (
            <Link key={location.id} to={`/${location.id}`} className="group">
              {/* Only `pt-0` is overridden, so the image can meet the top edge.
                  Everything else is the Card's own geometry: `--card-spacing`
                  gives the gap and the horizontal padding, and the presence of a
                  footer makes the card drop its bottom padding so the footer bar
                  sits flush. Setting `p-0` here, as this did, opts out of all of
                  that and leaves you spacing things by hand.

                  `ring`, not `border` — the Card draws its edge with
                  `ring-1 ring-foreground/10`, so a `hover:border-*` did nothing. */}
              <Card className="h-full pt-0 transition-all hover:ring-foreground/20 hover:shadow-lg">
                {/* The image is the card. Text sits on a scrim over it rather
                    than beside it, so a city reads as a place before it reads
                    as a row of statistics. */}
                <LocationMedia location={location} />

                {/* The counts alone. The four top-category pills that used to sit
                    above them said less than "16 categories" does and repeated
                    what the badges on the events page show anyway. */}
                <CardContent className="flex-1">
                  <LocationStats location={location} />
                </CardContent>

                {/* `bg-transparent` overrides the footer's default `bg-muted/50`.
                    The rule is enough to set the date apart; a tinted bar reads
                    as a separate panel and gives the corner of the card more
                    weight than a timestamp deserves. */}
                <CardFooter className="bg-transparent text-sm text-muted-foreground">
                  updated {formatDate(location.asOf, true)}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>

        {locations.status === "error" && (
          <Empty className="mt-8 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinned />
              </EmptyMedia>
              <EmptyTitle>No locations yet</EmptyTitle>
              <EmptyDescription>
                Compile a snapshot with <code>make refresh</code>, then reload.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {locations.status === "ready" && visible.length === 0 && (
          <p className="mt-8 text-muted-foreground">No cities match &ldquo;{query}&rdquo;.</p>
        )}
      </main>
    </div>
  );
}
