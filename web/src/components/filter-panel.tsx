import { ChevronDown, FilterX, Info } from "lucide-react";
import * as React from "react";
import { FacetSection, type FacetValue } from "@/components/facet-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONFIDENCE_OPTIONS,
  PRICE_OPTIONS,
  type ConfidenceFilter,
  type Filters,
  type PriceFilter,
} from "@/lib/filters";
import type { Snapshot } from "@/lib/types";

/**
 * Category, area and tag are one component three times over — the same search,
 * sort and tri-state controls, so learning it once is enough.
 *
 * Sections start collapsed so the whole surface is visible at once. The count
 * badge is what makes that safe: a closed section still shows how many of its
 * filters are active, so nothing is applied invisibly.
 */

/**
 * An explanation attached to the control it is about.
 *
 * Several of these filters need a sentence — "unconfirmed" and "listing
 * quality" mean nothing without one — and a paragraph covering all of them made
 * the reader do the matching up.
 */
function Hint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="shrink-0 rounded-full text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[16rem] text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}

/** A sub-heading inside a section, with its explanation beside it. */
function SubLabel({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">{children}</span>
      <Hint label={`About ${String(children).toLowerCase()}`}>{hint}</Hint>
    </div>
  );
}
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
    (filters.price !== "any" ? 1 : 0) +
    (filters.includeCarried ? 0 : 1) +
    (filters.includeFinished ? 1 : 0) +
    (filters.hasLink ? 1 : 0) +
    (filters.confidence !== "any" ? 1 : 0);

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

        {/* Everything in here defaults to showing more rather than less. These
            are ways to narrow a catalogue built by scraping — a reader who has
            been burnt by a vague listing can raise the bar, but nobody should
            have to find this panel before seeing what is on.

            Each control carries its own explanation rather than a paragraph
            underneath them all: five sentences in a block is a wall nobody
            reads, and it makes you match each sentence back to a control
            yourself. */}
        <CollapsibleContent className="pt-2.5">
          <SubLabel hint="“Ticketed” means the listing says it costs money. An event with no price recorded is neither free nor ticketed, so it is only in “Any”.">
            Price
          </SubLabel>
          <ButtonGroup aria-label="Price" className="mb-2.5 w-full min-w-0">
            {PRICE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.price === option.value ? "default" : "outline"}
                size="sm"
                className="h-6 min-w-0 flex-1 text-[0.72rem] font-normal"
                aria-pressed={filters.price === option.value}
                onClick={() => update({ price: option.value as PriceFilter })}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>

          <SubLabel hint="How sure the extractor was that it read the page correctly — not how good the event is. Anything below high usually means an ambiguous date, time or price.">
            Listing quality
          </SubLabel>
          <ButtonGroup aria-label="Minimum confidence" className="mb-2.5 w-full min-w-0">
            {CONFIDENCE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.confidence === option.value ? "default" : "outline"}
                size="sm"
                className="h-6 min-w-0 flex-1 text-[0.72rem] font-normal"
                aria-pressed={filters.confidence === option.value}
                onClick={() => update({ confidence: option.value as ConfidenceFilter })}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>

          <FieldGroup className="gap-2">
            <Field orientation="horizontal">
              <Checkbox id="link" checked={filters.hasLink} onCheckedChange={(v) => update({ hasLink: v === true })} />
              <FieldLabel htmlFor="link" className="flex-1 cursor-pointer font-normal">
                Only with an event link
              </FieldLabel>
              <Hint label="About event links">
                Some indexes print a title and a date with nothing to click. Those events still open the listings page
                they came from, so this only hides the ones that cannot take you straight there.
              </Hint>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="carried"
                checked={filters.includeCarried}
                onCheckedChange={(v) => update({ includeCarried: v === true })}
              />
              <FieldLabel htmlFor="carried" className="flex-1 cursor-pointer font-normal">
                Unconfirmed listings
              </FieldLabel>
              <Hint label="About unconfirmed listings">
                The venue has stopped listing it but the date has not passed — usually because their page only looks a
                few months ahead, not because anything was cancelled.
              </Hint>
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
              <Hint label="About finished events">
                The last fortnight only. Anything older is left out of the snapshot altogether, so it cannot be shown
                however this is set.
              </Hint>
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
