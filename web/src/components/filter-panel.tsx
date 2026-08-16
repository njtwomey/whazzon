import { ChevronDown, RotateCcw, Search } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Filters } from "@/lib/filters";
import type { Snapshot } from "@/lib/types";

/**
 * Sections start collapsed so the whole filter surface is visible at once, and
 * remember whether they were opened — someone who works by area shouldn't have
 * to reopen "Area" on every visit.
 *
 * The count badge is what makes collapsing safe: a closed section still shows
 * how many of its filters are active, so nothing is silently applied.
 */
/** How many tags to show before asking. Past this, searching beats scrolling. */
const TAG_LIMIT = 24;

const TAG_SORTS = [
  { value: "count", label: "Count" },
  { value: "name", label: "A–Z" },
] as const;

type TagSort = (typeof TAG_SORTS)[number]["value"];

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

function Section({
  id,
  title,
  children,
  count,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useRemembered(id, false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between py-1 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
              {count}
            </Badge>
          )}
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function CheckRow({
  id,
  checked,
  onChange,
  label,
  count,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count?: number;
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <FieldLabel htmlFor={id} className="flex-1 cursor-pointer justify-between gap-2 font-normal">
        <span className="truncate">{label}</span>
        {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
      </FieldLabel>
    </Field>
  );
}

export function FilterPanel({
  snapshot,
  filters,
  update,
  reset,
  counts,
  areas,
  tags,
  activeCount,
}: {
  snapshot: Snapshot;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  reset: () => void;
  counts: Map<string, number>;
  areas: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  activeCount: number;
}) {
  const [tagQuery, setTagQuery] = React.useState("");
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [tagSort, setTagSort] = React.useState<TagSort>("count");

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const shownCategories = snapshot.categories.filter(
    (category) => (counts.get(category.category) ?? 0) > 0 || filters.categories.includes(category.category),
  );

  const matchingTags = React.useMemo(() => {
    const needle = tagQuery.trim().toLowerCase().replace(/\s+/g, "-");
    const matched = needle ? tags.filter((tag) => tag.name.includes(needle)) : tags;
    // `tags` arrives sorted by count, so only alphabetical needs re-sorting.
    return tagSort === "name" ? [...matched].sort((a, b) => a.name.localeCompare(b.name)) : matched;
  }, [tags, tagQuery, tagSort]);

  // Tags are pre-sorted by count, so the head of the list is the useful part.
  // A selected tag stays visible even when it falls outside the cap.
  const shownTags = React.useMemo(() => {
    if (showAllTags || tagQuery || matchingTags.length <= TAG_LIMIT) return matchingTags;
    const head = matchingTags.slice(0, TAG_LIMIT);
    const selectedBelow = matchingTags.slice(TAG_LIMIT).filter((tag) => filters.tags.includes(tag.name));
    return [...head, ...selectedBelow];
  }, [matchingTags, showAllTags, tagQuery, filters.tags]);

  const hiddenTagCount = matchingTags.length - shownTags.length;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Filters
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        )}
      </div>

      <Section id="category" title="Category" count={filters.categories.length}>
        <FieldGroup className="gap-2">
          {shownCategories.map((category) => (
            <CheckRow
              key={category.category}
              id={`cat-${category.category}`}
              checked={filters.categories.includes(category.category)}
              onChange={() => update({ categories: toggle(filters.categories, category.category) })}
              label={category.label}
              count={counts.get(category.category) ?? 0}
            />
          ))}
        </FieldGroup>
      </Section>

      {areas.length > 0 && (
        <>
          <Separator />
          <Section id="area" title="Area" count={filters.areas.length}>
            <FieldGroup className="gap-2">
              {areas.map((area) => (
                <CheckRow
                  key={area.name}
                  id={`area-${area.name}`}
                  checked={filters.areas.includes(area.name)}
                  onChange={() => update({ areas: toggle(filters.areas, area.name) })}
                  label={area.name}
                  count={area.count}
                />
              ))}
            </FieldGroup>
          </Section>
        </>
      )}

      {tags.length > 0 && (
        <>
          <Separator />
          <Section id="tags" title="Tags" count={filters.tags.length}>
            {/* Tags are a long tail by nature: a handful describe most events
                and a great many appear once. Searching beats scrolling, and the
                list is capped until asked otherwise — but anything already
                selected is always shown, or unticking it would be impossible. */}
            {tags.length > TAG_LIMIT && (
              <InputGroup className="mb-2.5">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  placeholder={`Search ${tags.length} tags…`}
                  aria-label="Search tags"
                />
              </InputGroup>
            )}

            {/* A wrapping cloud, not a column of checkboxes: tags are short,
                there are a lot of them, and forty rows of one word each wastes
                the panel. Sorting by count puts the useful ones first;
                alphabetical is for when you know what you are looking for. */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <FieldDescription>
                {matchingTags.length} {matchingTags.length === 1 ? "tag" : "tags"}
              </FieldDescription>
              <ButtonGroup aria-label="Sort tags">
                {TAG_SORTS.map((option) => (
                  <Button
                    key={option.value}
                    variant={tagSort === option.value ? "default" : "outline"}
                    size="sm"
                    aria-pressed={tagSort === option.value}
                    onClick={() => setTagSort(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </ButtonGroup>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {/* "All" leads the cloud and is selected when nothing is: it both
                  states the current position and is the way back out, without
                  making someone untick pills one at a time. */}
              <Button
                variant={filters.tags.length === 0 ? "default" : "outline"}
                size="sm"
                aria-pressed={filters.tags.length === 0}
                aria-label="All tags"
                className="h-6 gap-1 rounded-full px-2 text-[0.72rem] font-normal"
                onClick={() => update({ tags: [] })}
              >
                All
              </Button>

              {shownTags.map((tag) => {
                const selected = filters.tags.includes(tag.name);
                return (
                  <Button
                    key={tag.name}
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    aria-pressed={selected}
                    aria-label={`${tag.name.replace(/-/g, " ")}, ${tag.count} events`}
                    className="h-6 gap-1 rounded-full px-2 text-[0.72rem] font-normal"
                    onClick={() => update({ tags: toggle(filters.tags, tag.name) })}
                  >
                    {tag.name.replace(/-/g, " ")}
                    <span className={cn("tabular-nums", selected ? "opacity-70" : "text-muted-foreground")}>
                      {tag.count}
                    </span>
                  </Button>
                );
              })}
            </div>

            {hiddenTagCount > 0 && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllTags(true)}>
                Show {hiddenTagCount} more
              </Button>
            )}
            {shownTags.length === 0 && <FieldDescription>No tags match &ldquo;{tagQuery}&rdquo;.</FieldDescription>}

            <FieldDescription className="mt-2.5">
              Tags describe the event itself, where a category describes the venue it came from. Selecting several shows
              events matching any of them.
            </FieldDescription>
          </Section>
        </>
      )}

      <Separator />

      <Section
        id="show"
        title="Show"
        count={(filters.freeOnly ? 1 : 0) + (filters.includeCarried ? 0 : 1) + (filters.includeFinished ? 1 : 0)}
      >
        <FieldGroup className="gap-2">
          <CheckRow
            id="free-only"
            checked={filters.freeOnly}
            onChange={(checked) => update({ freeOnly: checked })}
            label="Free events only"
          />
          <CheckRow
            id="carried"
            checked={filters.includeCarried}
            onChange={(checked) => update({ includeCarried: checked })}
            label="Unconfirmed listings"
          />
          <CheckRow
            id="finished"
            checked={filters.includeFinished}
            onChange={(checked) => update({ includeFinished: checked })}
            label="Events that have been and gone"
          />
        </FieldGroup>
        <FieldDescription className="mt-2.5">
          Unconfirmed means the venue has stopped listing it but the date has not passed — usually because their page
          only looks a few months ahead.
        </FieldDescription>
      </Section>
    </div>
  );
}
