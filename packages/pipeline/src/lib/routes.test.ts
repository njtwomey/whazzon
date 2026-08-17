import { describe, expect, it } from "vitest";
import { CatalogueArtefact, type Source } from "../schema/catalogue.js";
import { hasRoute, primaryUrl, routesFor, routesOf } from "./routes.js";

/**
 * `url` accepts two shapes, and the whole point of the widening was that the
 * 155 entries written before it existed keep working untouched. So the string
 * case is tested as carefully as the compound one.
 */

function source(url: Source["url"]): Source {
  return {
    id: "music/example",
    name: "Example",
    category: "music",
    kind: "venue",
    status: "provisional",
    url,
    tags: [],
    cadence: "weekly",
    addedAt: "2026-08-17",
  } as Source;
}

/** A whole catalogue file, so the cross-route rules can be exercised. */
function catalogue(url: unknown) {
  return {
    schema: "whazzon.catalogue/1",
    category: "music",
    label: "Music",
    sources: [{ ...source("https://example.org/"), url }],
  };
}

describe("reading a plain url", () => {
  it("reads as a single listings route", () => {
    expect(routesOf(source("https://example.org/whats-on"))).toEqual([
      { role: "listings", url: "https://example.org/whats-on" },
    ]);
  });

  it("is its own primary url", () => {
    expect(primaryUrl(source("https://example.org/whats-on"))).toBe("https://example.org/whats-on");
  });
});

describe("reading compound routes", () => {
  const compound = source([
    { role: "listings", url: "https://example.org/whats-on" },
    { role: "api", url: "https://example.org/wp-json/tribe/events/v1/events", note: "whole diary in one fetch" },
    { role: "ics", url: "https://example.org/events.ics" },
  ]);

  it("returns every route in declared order", () => {
    expect(routesOf(compound).map((route) => route.role)).toEqual(["listings", "api", "ics"]);
  });

  it("sends a person to the listings route, never the api", () => {
    // The reason the schema insists on a listings route at all: this value ends
    // up as the link under an event title.
    expect(primaryUrl(compound)).toBe("https://example.org/whats-on");
  });

  it("prefers the listings route even when it is not declared first", () => {
    const apiFirst = source([
      { role: "api", url: "https://example.org/api/events" },
      { role: "listings", url: "https://example.org/whats-on" },
    ]);

    expect(primaryUrl(apiFirst)).toBe("https://example.org/whats-on");
  });

  it("selects by role", () => {
    expect(routesFor(compound, "api")).toHaveLength(1);
    expect(routesFor(compound, "feed")).toEqual([]);
  });

  it("recognises any of its routes as its own", () => {
    // What stops `drift` reporting a source every single run because the
    // harvest sensibly read the API rather than the page.
    expect(hasRoute(compound, "https://example.org/events.ics")).toBe(true);
    expect(hasRoute(compound, "https://example.org/events.ics/")).toBe(true);
    expect(hasRoute(compound, "https://example.org/somewhere-else")).toBe(false);
  });
});

describe("the schema's rules for compound routes", () => {
  it("accepts a bare string, so existing catalogues are untouched", () => {
    expect(() => CatalogueArtefact.parse(catalogue("https://example.org/whats-on"))).not.toThrow();
  });

  it("rejects a list with no listings route", () => {
    expect(() =>
      CatalogueArtefact.parse(
        catalogue([
          { role: "api", url: "https://example.org/api/events" },
          { role: "ics", url: "https://example.org/events.ics" },
        ]),
      ),
    ).toThrow(/listings/);
  });

  it("rejects a one-item list, which should have been a string", () => {
    expect(() => CatalogueArtefact.parse(catalogue([{ role: "listings", url: "https://example.org/" }]))).toThrow();
  });

  it("rejects the same URL twice under two roles", () => {
    expect(() =>
      CatalogueArtefact.parse(
        catalogue([
          { role: "listings", url: "https://example.org/events" },
          { role: "api", url: "https://example.org/events/" },
        ]),
      ),
    ).toThrow();
  });

  it("rejects an unknown role rather than ignoring it", () => {
    expect(() =>
      CatalogueArtefact.parse(
        catalogue([
          { role: "listings", url: "https://example.org/whats-on" },
          { role: "graphql", url: "https://example.org/graphql" },
        ]),
      ),
    ).toThrow();
  });
});
