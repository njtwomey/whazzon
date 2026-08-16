import { ArrowDownAZ, ArrowDownWideNarrow, ChevronDown, Search } from "lucide-react";
import * as React from "react";
import { TriSelect } from "@/components/tri-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldDescription } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { facetCount, type Facet } from "@/lib/filter-events";

/**
 * One collapsible facet: search, sort, and a wrapping set of tri-state values.
 *
 * Category, area and tag are the same problem at different scales — a list of
 * named values with counts — so they get the same component rather than three
 * that slowly diverge. It also means learning the control once is enough.
 *
 * Search and sort share a line — the sort sits beside the field rather than
 * inside it, where the buttons had to shrink below a comfortable target and
 * read as decoration. The total lives in the placeholder ("Search 136 tags…")
 * rather than printed separately, which would say the same thing twice.
 *
 * Values are a wrapping cloud in every section. Rows waste most of a 256px
 * panel on whitespace, and the cloud puts far more of the vocabulary in view.
 */

export interface FacetValue {
  /** What is stored in the filter — a slug or an area name. */
  value: string;
  /** What is shown. */
  label: string;
  count: number;
}

type SortMode = "count" | "name";

/** Below this many values a search box is noise; the list is scannable. */
const SEARCH_THRESHOLD = 8;

/** How many to show before asking, so a long tail cannot bury the panel. */
const SHOW_LIMIT = 24;

function useRemembered(key: string, fallback: boolean): [boolean, (open: boolean) => void] {
  const storageKey = `whazzon-filter-${key}`;
  const [open, setOpen] = React.useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? fallback : stored === "1";
  });
  return [
    open,
    (next: boolean) => {
      setOpen(next);
      localStorage.setItem(storageKey, next ? "1" : "0");
    },
  ];
}

export function FacetSection({
  id,
  title,
  noun,
  values,
  facet,
  onChange,
  defaultSort = "name",
}: {
  id: string;
  title: string;
  /** Plural noun for the search placeholder: "tags", "categories", "areas". */
  noun: string;
  values: FacetValue[];
  facet: Facet;
  onChange: (next: Facet) => void;
  /**
   * Categories and areas are a small, stable vocabulary you look things up in,
   * so alphabetical wins — you know what you are after. Tags are a long tail
   * where the useful ones are the frequent ones, so those lead with the count.
   */
  defaultSort?: SortMode;
}) {
  const [open, setOpen] = useRemembered(id, false);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortMode>(defaultSort);
  const [showAll, setShowAll] = React.useState(false);

  const active = facetCount(facet);
  const searchable = values.length > SEARCH_THRESHOLD;

  const matching = React.useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "-");
    const matched = needle
      ? values.filter((v) => v.value.toLowerCase().includes(needle) || v.label.toLowerCase().includes(needle))
      : values;
    return [...matched].sort((a, b) =>
      sort === "name" ? a.label.localeCompare(b.label) : b.count - a.count || a.label.localeCompare(b.label),
    );
  }, [values, query, sort]);

  // Anything included or excluded stays visible even past the cap — otherwise a
  // filter could be applied and impossible to remove.
  const shown = React.useMemo(() => {
    if (showAll || query || matching.length <= SHOW_LIMIT) return matching;
    const head = matching.slice(0, SHOW_LIMIT);
    const activeBelow = matching
      .slice(SHOW_LIMIT)
      .filter((v) => facet.include.includes(v.value) || facet.exclude.includes(v.value));
    return [...head, ...activeBelow];
  }, [matching, showAll, query, facet]);

  const hidden = matching.length - shown.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between py-1 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
          {active > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
              {active}
            </Badge>
          )}
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2.5">
        {searchable && (
          <div className="mb-2.5 flex items-center gap-1.5">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${values.length} ${noun}…`}
                aria-label={`Search ${noun}`}
              />
            </InputGroup>

            <ButtonGroup aria-label={`Sort ${noun}`} className="shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={sort === "count" ? "default" : "outline"}
                    size="icon"
                    aria-pressed={sort === "count"}
                    aria-label="Sort by count"
                    className="size-8"
                    onClick={() => setSort("count")}
                  >
                    <ArrowDownWideNarrow className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Most events first</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={sort === "name" ? "default" : "outline"}
                    size="icon"
                    aria-pressed={sort === "name"}
                    aria-label="Sort A to Z"
                    className="size-8"
                    onClick={() => setSort("name")}
                  >
                    <ArrowDownAZ className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>A to Z</TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={active === 0 ? "default" : "outline"}
            size="sm"
            aria-pressed={active === 0}
            aria-label={`All ${noun}`}
            className="h-6 px-2 text-[0.72rem] font-normal"
            onClick={() => onChange({ include: [], exclude: [] })}
          >
            All
          </Button>

          {shown.map((v) => (
            <TriSelect
              key={v.value}
              facet={facet}
              value={v.value}
              label={v.label}
              count={v.count}
              onChange={onChange}
            />
          ))}
        </div>

        {hidden > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll(true)}>
            Show {hidden} more
          </Button>
        )}
        {shown.length === 0 && (
          <FieldDescription className="mt-2">
            No {noun} match &ldquo;{query}&rdquo;.
          </FieldDescription>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
