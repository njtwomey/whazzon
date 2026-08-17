import { ChevronDown, FilterX } from "lucide-react";
import * as React from "react";
import { FacetSection, type FacetValue } from "@/components/facet-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { PRICE_OPTIONS, type Filters, type PriceFilter } from "@/lib/filters";
import type { Snapshot } from "@/lib/types";

/**
 * Category, area and tag are one component three times over — the same search,
 * sort and tri-state controls, so learning it once is enough.
 *
 * Sections start collapsed so the whole surface is visible at once. The count
 * badge is what makes that safe: a closed section still shows how many of its
 * filters are active, so nothing is applied invisibly.
 */
export function FilterPanel({
  snapshot,
  filters,
  update,
  reset,
  counts,
  areas,
  venues,
  tags,
  activeCount,
}: {
  snapshot: Snapshot;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  reset: () => void;
  counts: Map<string, number>;
  areas: { name: string; count: number }[];
  venues: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  activeCount: number;
}) {
  const categoryValues: FacetValue[] = React.useMemo(
    () =>
      snapshot.categories
        .map((category) => ({
          value: category.category,
          label: category.label,
          count: counts.get(category.category) ?? 0,
        }))
        .filter(
          (v) =>
            v.count > 0 || filters.categories.include.includes(v.value) || filters.categories.exclude.includes(v.value),
        ),
    [snapshot.categories, counts, filters.categories],
  );

  const areaValues: FacetValue[] = React.useMemo(
    () => areas.map((area) => ({ value: area.name, label: area.name, count: area.count })),
    [areas],
  );

  const venueValues: FacetValue[] = React.useMemo(
    () => venues.map((venue) => ({ value: venue.name, label: venue.name, count: venue.count })),
    [venues],
  );

  const tagValues: FacetValue[] = React.useMemo(
    () => tags.map((tag) => ({ value: tag.name, label: tag.name.replace(/-/g, " "), count: tag.count })),
    [tags],
  );

  const showCount =
    (filters.price !== "any" ? 1 : 0) + (filters.includeCarried ? 0 : 1) + (filters.includeFinished ? 1 : 0);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Filters
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </h2>
        {/* A filter with a cross, not a rewind arrow: this clears the filters,
            it does not undo the last thing you did. */}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <FilterX className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <FacetSection
        id="category"
        title="Category"
        noun="categories"
        values={categoryValues}
        facet={filters.categories}
        onChange={(next) => update({ categories: next })}
      />

      {venueValues.length > 0 && (
        <>
          <Separator />
          {/* Alphabetical: a venue is something you come looking for by name,
              unlike a tag, where the frequent ones are the useful ones. */}
          <FacetSection
            id="venue"
            title="Venue"
            noun="venues"
            values={venueValues}
            facet={filters.venues}
            onChange={(next) => update({ venues: next })}
          />
        </>
      )}

      {tagValues.length > 0 && (
        <>
          <Separator />
          <FacetSection
            id="tags"
            title="Tags"
            noun="tags"
            values={tagValues}
            facet={filters.tags}
            onChange={(next) => update({ tags: next })}
            defaultSort="count"
          />
        </>
      )}

      {areaValues.length > 0 && (
        <>
          <Separator />
          <FacetSection
            id="area"
            title="Area"
            noun="areas"
            values={areaValues}
            facet={filters.areas}
            onChange={(next) => update({ areas: next })}
          />
        </>
      )}

      <Separator />

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-1 text-left">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Show
            {showCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
                {showCount}
              </Badge>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-2.5">
          <ButtonGroup aria-label="Price" className="mb-2.5 w-full">
            {PRICE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.price === option.value ? "default" : "outline"}
                size="sm"
                className="h-6 flex-1 text-[0.72rem] font-normal"
                aria-pressed={filters.price === option.value}
                onClick={() => update({ price: option.value as PriceFilter })}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>

          <FieldGroup className="gap-2">
            <Field orientation="horizontal">
              <Checkbox
                id="carried"
                checked={filters.includeCarried}
                onCheckedChange={(v) => update({ includeCarried: v === true })}
              />
              <FieldLabel htmlFor="carried" className="flex-1 cursor-pointer font-normal">
                Unconfirmed listings
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="finished"
                checked={filters.includeFinished}
                onCheckedChange={(v) => update({ includeFinished: v === true })}
              />
              <FieldLabel htmlFor="finished" className="flex-1 cursor-pointer font-normal">
                Recently finished events
              </FieldLabel>
            </Field>
          </FieldGroup>

          <FieldDescription className="mt-2.5">
            Unconfirmed means the venue has stopped listing it but the date has not passed — usually because their page
            only looks a few months ahead. Anything that finished more than a fortnight ago is not in the snapshot at
            all, so it cannot be shown.
          </FieldDescription>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
