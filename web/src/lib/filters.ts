import * as React from "react";
import { useSearchParams } from "react-router-dom";
import type { Facet, Filters, PriceFilter, Sort } from "./filter-events";

/**
 * Filter state lives in the URL, not in component state, so any view a person
 * is looking at can be linked to or reloaded. Defaults are omitted from the
 * query string to keep shareable links short.
 *
 * The filtering logic itself is in `filter-events.ts`, free of React so it can
 * be tested directly.
 */
export * from "./filter-events";

/**
 * A facet reads as `?category=theatre&category=-cinema` — a leading minus means
 * exclude. Two parallel parameters would work too, but this keeps a shared link
 * legible, and it reads the way people already write search queries.
 */
function readFacet(params: URLSearchParams, key: string): Facet {
  const values = params.getAll(key);
  return {
    include: values.filter((v) => !v.startsWith("-")),
    exclude: values.filter((v) => v.startsWith("-")).map((v) => v.slice(1)),
  };
}

function writeFacet(search: URLSearchParams, key: string, facet: Facet): void {
  for (const value of facet.include) search.append(key, value);
  for (const value of facet.exclude) search.append(key, `-${value}`);
}

export function useFilters(): [Filters, (patch: Partial<Filters>) => void, () => void] {
  const [params, setParams] = useSearchParams();

  const filters = React.useMemo<Filters>(
    () => ({
      q: params.get("q") ?? "",
      categories: readFacet(params, "category"),
      areas: readFacet(params, "area"),
      venues: readFacet(params, "venue"),
      tags: readFacet(params, "tag"),
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      onNow: params.get("now") === "1",
      sort: (params.get("sort") as Sort) ?? "date",
      price: (params.get("price") as PriceFilter) ?? "any",
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
      writeFacet(search, "category", next.categories);
      writeFacet(search, "area", next.areas);
      writeFacet(search, "venue", next.venues);
      writeFacet(search, "tag", next.tags);
      if (next.onNow) search.set("now", "1");
      if (next.from) search.set("from", next.from);
      if (next.to) search.set("to", next.to);
      if (next.sort !== "date") search.set("sort", next.sort);
      if (next.price !== "any") search.set("price", next.price);
      if (!next.includeCarried) search.set("carried", "0");
      if (next.includeFinished) search.set("finished", "1");
      setParams(search, { replace: true });
    },
    [filters, setParams],
  );

  const reset = React.useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return [filters, update, reset];
}
