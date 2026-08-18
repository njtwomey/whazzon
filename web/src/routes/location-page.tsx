import { CalendarX2, FilterX, TriangleAlert } from "lucide-react";
import * as React from "react";
import { useParams } from "react-router-dom";
import { EventDialog } from "@/components/event-dialog";
import { EventGroups, groupEvents } from "@/components/event-groups";
import { FilterPanel } from "@/components/filter-panel";
import { MapBanner } from "@/components/map-banner";
import { ResultsToolbar } from "@/components/results-toolbar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDensity } from "@/lib/density";
import { activeFilterCount, applyFilters, EMPTY_FACET, useFilters } from "@/lib/filters";
import { useLocations, useSnapshot } from "@/lib/snapshot";
import type { SnapshotEvent } from "@/lib/types";

/**
 * The listing page: load a snapshot, derive the facet counts, and hand the
 * pieces to the toolbar, the filter panel and the grouped grid.
 *
 * Rendering lives in those components; what stays here is the data shaping,
 * because every part of it depends on the same filtered set.
 */
export function LocationPage() {
  const params = useParams<{ locationId: string; category?: string }>();
  const snapshotState = useSnapshot(params.locationId);
  const [filters, update, reset] = useFilters();
  const [selected, setSelected] = React.useState<SnapshotEvent | null>(null);
  const [density, setDensity] = useDensity();

  const snapshot = snapshotState.status === "ready" ? snapshotState.data : undefined;

  /**
   * The city's illustration for the header mark. It lives in the locations index
   * rather than the snapshot — the snapshot is the events contract and has no
   * business carrying an asset path — so this is a second, tiny fetch that the
   * header degrades gracefully without.
   */
  const locations = useLocations();
  const summary = locations.status === "ready" ? locations.data.find((l) => l.id === params.locationId) : undefined;
  const locationImageUrl = summary?.imageUrl;
  const locationBannerUrl = summary?.bannerUrl;
  const locationBannerDarkUrl = summary?.bannerDarkUrl;

  React.useEffect(() => {
    document.title = snapshot ? `whazzon ${snapshot.location.name.toLowerCase()}` : "whazzon";
  }, [snapshot]);

  // A category in the path behaves exactly like a category filter, so /theatre
  // and ?category=theatre produce the same view.
  const effectiveFilters = React.useMemo(
    () => (params.category ? { ...filters, categories: { include: [params.category], exclude: [] } } : filters),
    [filters, params.category],
  );

  const visible = React.useMemo(
    () => (snapshot ? applyFilters(snapshot.events, effectiveFilters, snapshot.asOf) : []),
    [snapshot, effectiveFilters],
  );

  /**
   * A facet's own counts are computed with that facet cleared. Otherwise
   * ticking "Theatre" would show 0 next to every other category, making the
   * panel useless for discovering what else is on.
   */
  const facets = React.useMemo(() => {
    const categories = new Map<string, number>();
    const areas = new Map<string, number>();
    const venues = new Map<string, number>();
    const tags = new Map<string, number>();
    if (!snapshot) return { categories, areas, venues, tags };

    for (const event of applyFilters(
      snapshot.events,
      { ...effectiveFilters, categories: EMPTY_FACET },
      snapshot.asOf,
    )) {
      categories.set(event.category, (categories.get(event.category) ?? 0) + 1);
    }
    for (const event of applyFilters(snapshot.events, { ...effectiveFilters, areas: EMPTY_FACET }, snapshot.asOf)) {
      if (event.area) areas.set(event.area, (areas.get(event.area) ?? 0) + 1);
    }
    for (const event of applyFilters(snapshot.events, { ...effectiveFilters, venues: EMPTY_FACET }, snapshot.asOf)) {
      if (event.venueName) venues.set(event.venueName, (venues.get(event.venueName) ?? 0) + 1);
    }
    for (const event of applyFilters(snapshot.events, { ...effectiveFilters, tags: EMPTY_FACET }, snapshot.asOf)) {
      for (const tag of event.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    return { categories, areas, venues, tags };
  }, [snapshot, effectiveFilters]);

  const groups = React.useMemo(() => (snapshot ? groupEvents(visible, snapshot.asOf) : []), [snapshot, visible]);

  if (snapshotState.status === "error") {
    return (
      <div className="min-h-dvh">
        <Empty className="mt-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>No data for this location</EmptyTitle>
            <EmptyDescription>
              {snapshotState.error}. Run <code>make refresh LOCATION={params.locationId}</code> to compile a snapshot.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-dvh w-full px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-64" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const active = activeFilterCount(effectiveFilters);
  const failingSources = snapshot.sources.filter((source) => source.lastError);
  const byCount = (counts: Map<string, number>) =>
    [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const filterPanel = (
    <FilterPanel
      snapshot={snapshot}
      filters={effectiveFilters}
      update={update}
      reset={reset}
      counts={facets.categories}
      areas={byCount(facets.areas)}
      venues={byCount(facets.venues)}
      tags={byCount(facets.tags)}
      activeCount={active}
    />
  );

  return (
    <div className="min-h-dvh">
      {/* The city's own map, so a page is recognisably this place rather than the
          same chrome with a different name in it.

          It is a welcome, not furniture: it sits above the sticky header at the
          size the landing hero uses, and being the first thing on the page it is
          the first thing scrolling takes away. Once it has gone the page is the
          listing and nothing else, with the city still named and drawn in the
          bar. */}
      {locationBannerUrl && (
        <MapBanner
          src={`${import.meta.env.BASE_URL}${locationBannerUrl}`}
          srcDark={locationBannerDarkUrl && `${import.meta.env.BASE_URL}${locationBannerDarkUrl}`}
          title={snapshot.location.name.toLowerCase()}
          className="h-56 sm:h-64 lg:h-72"
          titleClassName="text-5xl sm:text-6xl"
          subtitle={
            <p className="mt-1 font-light tracking-wide text-muted-foreground/80">{snapshot.location.region}</p>
          }
        />
      )}

      <SiteHeader
        locationName={snapshot.location.name}
        locationImageUrl={locationImageUrl}
        asOf={snapshot.asOf}
        eventCount={snapshot.events.length}
        sourceCount={snapshot.sources.length}
        categoryCount={snapshot.categories.length}
        failingSourceCount={failingSources.length}
        query={filters.q}
        onQueryChange={(q) => update({ q })}
        filterSlot={filterPanel}
        activeFilterCount={active}
        density={density}
        setDensity={setDensity}
      />

      {/* The page is one scroller, and it is the window.

          It used to be two: the results had an `overflow-y-auto` pane of their
          own, so the banner and the listing were on separate scrolls. That is
          what made it feel like two phases — a gesture over the cards moved the
          cards and never the map, so getting the map out of the way meant aiming
          at it first. Redirecting the wheel between the two only moved the seam
          into JavaScript, and `scroll-behavior: smooth` turned every redirected
          notch into its own small animation, which is where the clunk came from.

          The banner is now simply the first thing on an ordinary page, so one
          continuous gesture carries you off the map and into the events with
          nothing to feel. The filters keep a scroll of their own, because they
          are a rail beside the content rather than a step in the sequence: they
          stick under the header and the listing goes past them. On small screens
          the rail is a sheet and this is one plain column. */}
      <main className="w-full gap-8 px-4 py-6 sm:px-6 lg:flex lg:items-start lg:px-8">
        {/* `top-[5rem]` is the header (3.5rem) plus the page's own top padding,
            so the panel settles level with the first card rather than tucking
            under the bar. The height is definite rather than a max: a
            `ScrollArea` inside an auto-height box clips instead of scrolling,
            because its viewport has nothing to be 100% of. */}
        <aside className="sticky top-[5rem] hidden h-[calc(100dvh-6.5rem)] w-64 shrink-0 lg:block">
          <ScrollArea className="h-full lg:pr-3">{filterPanel}</ScrollArea>
        </aside>

        <div className="min-w-0 flex-1 lg:pl-1">
          <ResultsToolbar count={visible.length} activeFilterCount={active} />

          {visible.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarX2 />
                </EmptyMedia>
                <EmptyTitle>Nothing matches</EmptyTitle>
                <EmptyDescription>Try widening the date range, or clearing a filter or two.</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" onClick={reset}>
                <FilterX className="size-4" /> Clear filters
              </Button>
            </Empty>
          ) : (
            <EventGroups groups={groups} asOf={snapshot.asOf} density={density} onOpen={setSelected} />
          )}
        </div>
      </main>

      <EventDialog event={selected} asOf={snapshot.asOf} onClose={() => setSelected(null)} />
    </div>
  );
}
