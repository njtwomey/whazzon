import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import { walk } from "../lib/paths.js";

/**
 * Which sources have been pointed somewhere new since a given commit.
 *
 * This is the worklist `stale` cannot produce. `stale` asks "has enough time
 * passed?", which is the right question most of the time and the wrong one
 * after a curation pass: a source whose URL was corrected an hour ago is not
 * due by cadence, but everything we know about it came from the wrong page.
 *
 * The comparison is against git rather than the harvest log, because an
 * observation records the URL it *read* (`fetch.url`), not the catalogue URL it
 * started from — an agent that navigated from a homepage to /whats-on would
 * look like a re-pointed source forever.
 *
 *   npm run repointed -- bristol-uk              vs HEAD
 *   npm run repointed -- bristol-uk --since <ref>
 *   npm run repointed -- bristol-uk --ids        bare ids, for scripting
 */

const { locations, rest } = resolveLocations();
const idsOnly = rest.includes("--ids");
const sinceFlag = rest.indexOf("--since");
const sinceArg = sinceFlag >= 0 ? rest[sinceFlag + 1] : "HEAD";

if (!sinceArg) {
  console.error("--since needs a git ref");
  process.exit(1);
}

const since: string = sinceArg;

/** The committed version of a file, or undefined if it did not exist then. */
function atRef(ref: string, path: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${ref}:${rel(path)}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return undefined;
  }
}

interface Entry {
  url: string;
  status: string;
  category: string;
}

/**
 * A source's routes as one comparable string.
 *
 * `url` is either a plain URL or a list of roled routes, and both forms have to
 * reduce to something two commits apart can be compared with. Roles are part of
 * the key on purpose: gaining an `api` route is as good a reason to re-harvest
 * as having the listings page corrected, because everything recorded so far came
 * from the worse of the two.
 */
function routeKey(url: unknown): string | undefined {
  if (typeof url === "string") return url;
  if (!Array.isArray(url)) return undefined;
  const routes = url
    .filter((route): route is { role?: string; url?: string } => Boolean(route) && typeof route === "object")
    .map((route) => `${route.role ?? "?"}=${route.url ?? "?"}`);
  return routes.length > 0 ? routes.join(" ") : undefined;
}

function sourcesOf(text: string): Map<string, Entry> {
  const out = new Map<string, Entry>();
  const parsed = parse(text) as { sources?: { id?: string; url?: unknown; status?: string; category?: string }[] };
  for (const source of parsed?.sources ?? []) {
    const url = routeKey(source?.url);
    if (!source?.id || !url) continue;
    out.set(source.id, { url, status: source.status ?? "", category: source.category ?? "" });
  }
  return out;
}

for (const locationId of locations) {
  const changed: { id: string; from?: string; to: string; status: string; note: string }[] = [];

  for (const path of walk(paths.catalogueDir(locationId), ".yaml").sort()) {
    const before = atRef(since, path);
    const now = sourcesOf(readFileSync(path, "utf8"));

    // A catalogue file that did not exist at `since` is entirely new, so every
    // source in it needs a first visit.
    const was = before === undefined ? new Map<string, Entry>() : sourcesOf(before);

    for (const [id, entry] of now) {
      const old = was.get(id);
      if (old?.url === entry.url) continue;
      changed.push({
        id,
        from: old?.url,
        to: entry.url,
        status: entry.status,
        note: old === undefined ? "new source" : "re-pointed",
      });
    }
  }

  /**
   * A closed source is deliberately left pointing at its dead URL, so it is
   * reported separately rather than sent to a harvester that would only record
   * the failure again.
   */
  const worklist = changed.filter((c) => c.status !== "closed");
  const skipped = changed.filter((c) => c.status === "closed");

  if (idsOnly) {
    for (const row of worklist) console.log(row.id);
    continue;
  }

  console.log(`\n=== ${locationId} — changed since ${since} ===\n`);
  if (changed.length === 0) {
    console.log("no catalogue URLs have changed");
    continue;
  }

  for (const row of worklist) {
    console.log(`${row.id}`);
    if (row.from) console.log(`  was ${row.from}`);
    console.log(`  now ${row.to}${row.note === "new source" ? "  (new source)" : ""}`);
  }

  console.log(`\n${worklist.length} source(s) to re-harvest`);
  if (skipped.length > 0) {
    console.log(`${skipped.length} skipped as closed: ${skipped.map((s) => s.id).join(", ")}`);
  }
}
