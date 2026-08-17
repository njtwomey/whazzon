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
          same chrome with a different name in it. Above the sticky header and
          scrolls away; `main` is sticky below, which is what keeps the
          viewport-height panes honest once the banner has gone. */}
      {locationBannerUrl && (
        <MapBanner
          src={`${import.meta.env.BASE_URL}${locationBannerUrl}`}
          title={snapshot.location.name.toLowerCase()}
          className="h-32 sm:h-40 lg:h-44"
          titleClassName="text-4xl sm:text-5xl"
          subtitle={
            <p className="mt-0.5 font-light tracking-wide text-muted-foreground/80">{snapshot.location.region}</p>
          }
        />
      )}

      <SiteHeader
        locationName={snapshot.location.name}
        locationImageUrl={locationImageUrl}
        asOf={snapshot.asOf}
        eventCount={snapshot.events.length}
        query={filters.q}
        onQueryChange={(q) => update({ q })}
        filterSlot={filterPanel}
        activeFilterCount={active}
      />

      {/* Two panes that scroll independently below the header. The filters stay
          put while results scroll past them, which is the whole point of a
          filter panel — and on small screens this collapses back to one
          ordinary scrolling page, with filters in the sheet instead. */}
      <main className="w-full gap-8 px-4 py-6 sm:px-6 lg:sticky lg:top-14 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:px-8 lg:py-0">
        <aside className="hidden w-64 shrink-0 lg:block lg:h-full">
          <ScrollArea className="h-full lg:py-6 lg:pr-3">{filterPanel}</ScrollArea>
        </aside>

        <div className="min-w-0 flex-1 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:py-6 lg:pl-1">
          <ResultsToolbar
            count={visible.length}
            activeFilterCount={active}
            failingSourceCount={failingSources.length}
            filters={filters}
            update={update}
            asOf={snapshot.asOf}
            density={density}
            setDensity={setDensity}
          />

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
