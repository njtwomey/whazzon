import * as React from "react";
import { useSearchParams } from "react-router-dom";
import type { Filters, Sort } from "./filter-events";

/**
 * Filter state lives in the URL, not in component state, so any view a person
 * is looking at can be linked to or reloaded. Defaults are omitted from the
 * query string to keep shareable links short.
 *
 * The filtering logic itself is in `filter-events.ts`, free of React so it can
 * be tested directly.
 */
export * from "./filter-events";

export function useFilters(): [Filters, (patch: Partial<Filters>) => void, () => void] {
  const [params, setParams] = useSearchParams();

  const filters = React.useMemo<Filters>(
    () => ({
      q: params.get("q") ?? "",
      categories: params.getAll("category"),
      areas: params.getAll("area"),
      tags: params.getAll("tag"),
      onNow: params.get("now") === "1",
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      sort: (params.get("sort") as Sort) ?? "date",
      freeOnly: params.get("free") === "1",
      includeCarried: params.get("carried") !== "0",
      includeFinished: params.get("finished") === "1",
    }),
    [params],
  );

  const update = React.useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      const search = new URLSearchParams();
      if (next.q) search.set("q", next.q);
      for (const category of next.categories) search.append("category", category);
      for (const area of next.areas) search.append("area", area);
      for (const tag of next.tags) search.append("tag", tag);
      if (next.onNow) search.set("now", "1");
      if (next.from) search.set("from", next.from);
      if (next.to) search.set("to", next.to);
      if (next.sort !== "date") search.set("sort", next.sort);
      if (next.freeOnly) search.set("free", "1");
      if (!next.includeCarried) search.set("carried", "0");
      if (next.includeFinished) search.set("finished", "1");
      setParams(search, { replace: true });
    },
    [filters, setParams],
  );

  const reset = React.useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return [filters, update, reset];
}
