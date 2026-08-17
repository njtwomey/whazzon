import type { Route, RouteRole, Source } from "../schema/catalogue.js";

/**
 * Reading a source's `url`, whichever form it takes.
 *
 * A catalogue entry may carry a single URL string or a list of roled routes
 * (see `SourceUrl` in the catalogue schema). Every consumer wants one of two
 * things — "all the ways in" or "the one link to show a person" — so both are
 * answered here and nothing else branches on the shape of the field.
 */

/** Just enough of a source to read its routes; keeps callers free of the full type. */
export type Routable = Pick<Source, "url">;

/**
 * Every route into a source, in declared order. A bare URL is one listings
 * route, which is what it always meant.
 */
export function routesOf(source: Routable): Route[] {
  return typeof source.url === "string" ? [{ role: "listings", url: source.url }] : source.url;
}

/**
 * The one URL that stands for this source: where a person is sent, what the
 * snapshot carries, and what the site links to.
 *
 * The first `listings` route, which the schema guarantees exists. Ordering is
 * therefore meaningful — put the page you would give someone first.
 */
export function primaryUrl(source: Routable): string {
  const routes = routesOf(source);
  return (routes.find((route) => route.role === "listings") ?? routes[0]!).url;
}

/** Routes of one role, in declared order. Empty when the source has none. */
export function routesFor(source: Routable, role: RouteRole): Route[] {
  return routesOf(source).filter((route) => route.role === role);
}

/**
 * True when a URL is one of this source's routes.
 *
 * `drift` asks this of the URL a harvest actually read: an agent that used the
 * `api` route did not find a moved page, and reporting it as drift every run
 * would bury the real corrections. Compared with trailing slashes and case
 * ignored, which is how the rest of the pipeline compares URLs.
 */
export function hasRoute(source: Routable, url: string): boolean {
  const normalise = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  const needle = normalise(url);
  return routesOf(source).some((route) => normalise(route.url) === needle);
}

/** One-line description of a source's routes, for CLI output. */
export function describeRoutes(source: Routable): string {
  const routes = routesOf(source);
  if (routes.length === 1) return routes[0]!.url;
  return `${primaryUrl(source)} (+${routes.length - 1}: ${routes
    .filter((route) => route.url !== primaryUrl(source))
    .map((route) => route.role)
    .join(", ")})`;
}
