import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { loadCatalogues } from "../lib/catalogue.js";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";

/**
 * Fill in `address.lat`/`address.lon` from a real geocode.
 *
 * The catalogue forbids guessing coordinates from a postcode, which is right — a
 * guessed pin is worse than no pin, because a map will draw it confidently in the
 * wrong street. So the field sits empty until something actually looks it up, and
 * this is that something.
 *
 * It is worth having beyond tidiness: the event dialog only draws its embedded map
 * when a venue has coordinates, so until now that was dead code waiting on data.
 *
 * Nominatim's terms allow this at one request a second with an identifying
 * user-agent, so the pace below is the policy rather than caution. Results are
 * cached to disk, so a re-run costs nothing and a half-finished run resumes.
 *
 *   npm run geocode -- ie-cork
 *   npm run geocode -- ie-cork --dry-run     look them up, write nothing
 *   npm run geocode -- ie-cork --limit 20
 */

const { locations, rest } = resolveLocations();
const dryRun = rest.includes("--dry-run");
const limitArg = rest.includes("--limit") ? Number(rest[rest.indexOf("--limit") + 1]) : undefined;
const limit = Number.isInteger(limitArg) && limitArg! > 0 ? limitArg! : Infinity;

const RATE_MS = 1100;
const UA = "whazzon/0.1 (city listings; https://github.com/njtwomey/whazzon)";

interface Hit {
  lat: number;
  lon: number;
  display: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(query: string): Promise<Hit | undefined> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=" + encodeURIComponent(query);
  const response = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!response.ok) return undefined;
  const rows = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  const first = rows[0];
  if (!first) return undefined;
  return { lat: Number(first.lat), lon: Number(first.lon), display: first.display_name };
}

for (const locationId of locations) {
  const cachePath = join(paths.locationDir(locationId), "assets", "geocode-cache.json");
  const cache: Record<string, Hit | null> = existsSync(cachePath)
    ? (JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, Hit | null>)
    : {};
  const saveCache = () => {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  };

  let looked = 0;
  let filled = 0;
  let missed = 0;

  for (const { path, catalogue } of loadCatalogues(locationId)) {
    /**
     * Edited through `parseDocument` rather than parse-then-stringify. The
     * catalogue is hand-curated: its block scalars, comment placement and key
     * order are deliberate, and prettier is excluded from `data/` for exactly that
     * reason. A round trip through plain objects would reflow the whole file.
     */
    const doc = parseDocument(readFileSync(path, "utf8"));
    let touched = false;

    for (const [index, source] of catalogue.sources.entries()) {
      if (looked >= limit) break;
      const address = source.address;
      if (!address || address.lat !== undefined) continue;
      // A street is the minimum worth asking about; a bare postcode geocodes to
      // the centroid of a delivery area, which is the guess we are avoiding.
      if (!address.street) continue;

      /**
       * Name first, then street alone. Including the venue name is worth trying —
       * it disambiguates two things on one street — but it is also why the first
       * pass missed 90 of 116: Nominatim has no record of most small venues, and a
       * name it cannot match poisons an address it could have. The street on its
       * own is a worse pin and a far better hit rate, so it is the fallback rather
       * than the first choice.
       */
      const city = address.city ?? "Cork";
      const queries = [
        [source.name, address.street, address.locality, city, "Ireland"].filter(Boolean).join(", "),
        [address.street, address.locality, city, "Ireland"].filter(Boolean).join(", "),
      ];

      let hit: Hit | null = null;
      for (const query of queries) {
        let cached = cache[query];
        if (cached === undefined) {
          looked += 1;
          cached = (await lookup(query)) ?? null;
          cache[query] = cached;
          saveCache();
          await sleep(RATE_MS);
        }
        if (cached) {
          hit = cached;
          break;
        }
      }

      const query = queries[0]!;
      if (!hit) {
        missed += 1;
        console.log(`  miss  ${source.id.padEnd(40)} ${query.slice(0, 70)}`);
        continue;
      }

      filled += 1;
      console.log(`  ok    ${source.id.padEnd(40)} ${hit.lat.toFixed(5)}, ${hit.lon.toFixed(5)}`);
      if (!dryRun) {
        doc.setIn(["sources", index, "address", "lat"], Number(hit.lat.toFixed(6)));
        doc.setIn(["sources", index, "address", "lon"], Number(hit.lon.toFixed(6)));
        touched = true;
      }
    }

    if (touched) writeFileSync(path, doc.toString({ lineWidth: 0 }), "utf8");
  }

  console.log(
    `\n${locationId}: ${filled} geocoded, ${missed} not found, ${looked} network lookups` +
      (dryRun ? " (dry run, nothing written)" : ` -> ${rel(paths.catalogueDir(locationId))}`),
  );
}
