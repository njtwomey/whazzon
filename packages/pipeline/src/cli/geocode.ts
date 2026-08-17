import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseDocument } from "yaml";
import { loadCatalogues } from "../lib/catalogue.js";
import { loadLocation, resolveLocations } from "../lib/locations.js";
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

/** Great-circle distance in km, for sanity-checking what came back. */
function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * How far from the configured centre a result may land before it is rejected.
 *
 * Generous on purpose — several catalogued sources are deliberately outside the
 * radius, and Cork Racecourse is 35km out with a note explaining why. This is not
 * a radius filter; it is here to catch a lookup that answered with the wrong Cork.
 */
const SANITY_KM = 45;

for (const locationId of locations) {
  const location = loadLocation(locationId);
  const centre = location.centre;
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
      /**
       * A missing address is not a reason to skip. Most catalogued sources have no
       * street line — stage 1 is told not to invent one — but Nominatim knows plenty
       * of them as named points of interest, and a name lookup is still a lookup. So
       * the only thing that disqualifies a source is already having coordinates.
       */
      const address = source.address ?? {};
      if (address.lat !== undefined) continue;

      /**
       * Name first, then street alone. Including the venue name is worth trying —
       * it disambiguates two things on one street — but it is also why the first
       * pass missed 90 of 116: Nominatim has no record of most small venues, and a
       * name it cannot match poisons an address it could have. The street on its
       * own is a worse pin and a far better hit rate, so it is the fallback rather
       * than the first choice.
       */
      // From the config, not hardcoded. The first run of this appended "Ireland"
      // to every Bristol query and wasted 68 lookups finding nothing.
      const city = address.city ?? location.name;
      const country = address.country ?? location.country;
      /**
       * Three shapes, most specific first. The last one — the venue's name and the
       * city, with no street at all — is what reaches the sources that have no
       * street line, which is most of them. It is still a lookup rather than a
       * guess: Nominatim either knows the place as a point of interest or it does
       * not, and a result too far from the configured centre is thrown away below.
       */
      const queries = [
        address.street ? [source.name, address.street, address.locality, city, country].filter(Boolean).join(", ") : "",
        address.street ? [address.street, address.locality, city, country].filter(Boolean).join(", ") : "",
        [source.name, city, country].filter(Boolean).join(", "),
      ].filter(Boolean);

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
          const away = distanceKm(centre.lat, centre.lon, cached.lat, cached.lon);
          if (away > SANITY_KM) {
            console.log(`  far   ${source.id.padEnd(40)} ${away.toFixed(0)}km away — ${cached.display.slice(0, 48)}`);
            continue;
          }
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
        // `{lat, lon}` alone is a valid address: the schema asks for at least one
        // field and for the pair to arrive together, which this does.
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
