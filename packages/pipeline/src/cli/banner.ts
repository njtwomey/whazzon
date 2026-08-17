import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalogues } from "../lib/catalogue.js";
import { loadLocation, resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";

/**
 * Build a location's banner: its streets from OpenStreetMap, with a marker at
 * every catalogued venue that has been geocoded, coloured by what it programmes.
 *
 * This lives in the repo rather than in a scratch directory because the asset it
 * writes is committed, and an asset nobody can regenerate is a liability — the
 * first version of this was a throwaway script and went in the bin with the
 * directory it sat in.
 *
 * Positions are real. `npm run geocode` writes `address.lat`/`lon` from Nominatim,
 * and only sources that actually have coordinates get a pin: a banner that invented
 * venue locations would be the same lie as a guessed postcode, just prettier.
 *
 *   npm run geocode -- ie-cork      first, to have anything to plot
 *   npm run banner  -- ie-cork
 *   npm run banner  -- ie-cork --span 6000   metres across, default 6000
 *
 * The OSM response is cached under the location's assets, so re-running to nudge
 * the styling costs nothing and does not hammer a free service.
 */

const { locations, rest } = resolveLocations();
const spanArg = rest.includes("--span") ? Number(rest[rest.indexOf("--span") + 1]) : undefined;
/** Metres across. Wide enough to read as a city rather than a few blocks. */
const SPAN_M = Number.isFinite(spanArg) && spanArg! > 500 ? spanArg! : 6000;
const ASPECT = 3.4;
const HEIGHT = 340;
const REFRESH = rest.includes("--refresh");

/** Colour per category — the point of a marker is saying what kind of evening. */
const COLOUR: Record<string, string> = {
  music: "#5b5bd6",
  trad: "#3b7dd8",
  theatre: "#b0132a",
  comedy: "#e8590c",
  cinema: "#7048e8",
  art: "#d6336c",
  museums: "#7a5c2e",
  literature: "#0e7490",
  education: "#1864ab",
  "food-drink": "#e07c1f",
  markets: "#9a5b12",
  family: "#0ca678",
  making: "#846ab5",
  sport: "#2f9e44",
  outdoors: "#37812a",
  festivals: "#c2255c",
  citywide: "#495057",
};

/** Drawn at r=14 inside a white ring, so they read at banner scale. */
const GLYPH: Record<string, string> = {
  music: '<path d="M-2.1-5.6v7.8a2.4 2.4 0 1 0 1.7 2.3V-2.9l3.3 1v-3.1z"/>',
  trad: '<path d="M-3.4 4.6a2.4 2.4 0 1 0 2.6-2.4V-5.6l4.4 1.5v6.9a2.4 2.4 0 1 0 1.7 2.3" fill="none" stroke="#fff" stroke-width="1.7"/>',
  theatre:
    '<path d="M-5.1-2.8h10.2v3.3a5.1 5.1 0 0 1-10.2 0z"/><circle cx="-2" cy="-.4" r="1.1" fill="#fff"/><circle cx="2" cy="-.4" r="1.1" fill="#fff"/>',
  comedy:
    '<circle r="5.6"/><g fill="#fff"><circle cx="-2" cy="-1.6" r="1"/><circle cx="2" cy="-1.6" r="1"/><path d="M-3.2 1.2a3.6 3.6 0 0 0 6.4 0z"/></g>',
  cinema:
    '<path d="M-5.6-4h11.2v8H-5.6z"/><g fill="#fff"><rect x="-4.6" y="-3" width="1.8" height="1.8"/><rect x="-4.6" y="1.2" width="1.8" height="1.8"/><rect x="2.8" y="-3" width="1.8" height="1.8"/><rect x="2.8" y="1.2" width="1.8" height="1.8"/><rect x="-1.8" y="-2.4" width="3.6" height="4.8"/></g>',
  art: '<path d="M0-5.6a5.6 5.6 0 1 0 1.9 10.8c1-.4.6-1.5.2-2-.5-.6-.2-1.5.6-1.6 1-.1 2.9.2 2.9-1.7A5.6 5.6 0 0 0 0-5.6z"/><circle cx="-2.2" cy="-2.4" r="1" fill="#fff"/><circle cx="1.4" cy="-3" r="1" fill="#fff"/>',
  museums:
    '<path d="M0-5.6 5.6-2.6v1.4H-5.6v-1.4zM-4-.2h1.7v4.2H-4zM-.9-.2h1.8v4.2H-.9zM2.3-.2H4v4.2H2.3zM-5.2 5h10.4v1.2H-5.2z"/>',
  literature: '<path d="M-5-4.4h4a1 1 0 0 1 1 1V5h-4a1 1 0 0 1-1-1zM5-4.4H1a1 1 0 0 0-1 1V5h4a1 1 0 0 0 1-1z"/>',
  education: '<path d="M0-5.2 6-2.6 0 0-6-2.6zM-4-.6v3.2C-4 4.2-2.2 5.4 0 5.4S4 4.2 4 2.6V-.6L0 1.2z"/>',
  "food-drink":
    '<path d="M-3.3-5.8v4a1.7 1.7 0 0 0 1.1 1.6V5.8h1.2V-.2A1.7 1.7 0 0 0 .1-1.8v-4h-1v3.6h-.6v-3.6h-.7v3.6h-.6v-3.6zM2.6-5.8c1.3 0 2 1.3 2 2.7 0 1.2-.7 2.2-1.6 2.5V5.8H1.6V-5.8z"/>',
  markets:
    '<path d="M-5.4-3.2h10.8l-1.1 1.8H-4.3zM-4.2-.8h8.4v5.2h-8.4z"/><g fill="#fff"><rect x="-2.6" y="1" width="2.2" height="3.4"/><rect x="1" y="1" width="2.2" height="2"/></g>',
  family:
    '<circle cx="-2.6" cy="-3.2" r="1.9"/><path d="M-2.6-.4c-1.9 0-3 1.4-3 3V5h6V2.6c0-1.6-1.1-3-3-3z"/><circle cx="3" cy="-4" r="1.6"/><path d="M3-1.6c-1.6 0-2.5 1.2-2.5 2.6V5h5V1c0-1.4-.9-2.6-2.5-2.6z"/>',
  making: '<path d="M3.8-5.6 5.6-3.8-1.2 3-3 1.2zM-3.8 2.2-5.6 5.6-2.2 3.8z"/>',
  sport:
    '<circle r="4.8"/><g fill="#fff"><circle r="1.5"/><rect x="-.6" y="-4.4" width="1.2" height="1.6"/><rect x="-.6" y="2.8" width="1.2" height="1.6"/><rect x="-4.4" y="-.6" width="1.6" height="1.2"/><rect x="2.8" y="-.6" width="1.6" height="1.2"/></g>',
  outdoors: '<path d="M0-5.6 4.6 1.4H-4.6zM-.9 1.4h1.8V5.6H-.9z"/>',
  festivals: '<path d="M0-5.6 1.7-1.9 5.6-1.4 2.8 1.3 3.5 5.2 0 3.3-3.5 5.2-2.8 1.3-5.6-1.4-1.7-1.9z"/>',
  citywide: '<circle r="4.6" fill="none" stroke="#fff" stroke-width="1.8"/><circle r="1.4"/>',
};

const ROAD_M: Record<string, number> = {
  motorway: 22,
  trunk: 18,
  primary: 15,
  secondary: 13,
  tertiary: 11,
  residential: 8,
  unclassified: 8,
  living_street: 7,
  pedestrian: 7,
};

const MIRRORS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"];

interface Way {
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/**
 * Overpass is a free service under real load, and a 504 on a wide bounding box is
 * an ordinary outcome rather than a fault. So: every mirror, three rounds, with a
 * pause — and if the full road network will not come back, ask for the arterials
 * alone. At six metres a pixel a residential street is barely more than a line, so
 * the degraded map is a slightly plainer one rather than a broken one. Failing
 * outright and leaving no banner would be the worse answer.
 */
async function overpass(queries: string[]): Promise<{ elements: Way[] }> {
  for (const [tier, query] of queries.entries()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      for (const mirror of MIRRORS) {
        try {
          // `data=` form-encoded, which is what Overpass documents. A plain
          // string body sends no usable content type and earns a 406 from some
          // mirrors — which looks like rate limiting and is not.
          const response = await fetch(mirror, { method: "POST", body: new URLSearchParams({ data: query }) });
          if (response.ok) {
            const text = await response.text();
            if (text.startsWith("{")) {
              if (tier > 0) console.log(`  (arterials only — the full network kept timing out)`);
              return JSON.parse(text) as { elements: Way[] };
            }
          }
          console.log(`  ${new URL(mirror).host} -> ${response.status}`);
        } catch (error) {
          console.log(`  ${new URL(mirror).host} -> ${error instanceof Error ? error.message : error}`);
        }
        await new Promise((r) => setTimeout(r, 6000));
      }
    }
  }
  throw new Error("every Overpass mirror refused at every detail level; try again in a few minutes");
}

for (const locationId of locations) {
  const location = loadLocation(locationId);
  const { lat: cLat, lon: cLon } = location.centre;

  const halfLat = SPAN_M / ASPECT / 2 / 111_200;
  const cos = Math.cos((cLat * Math.PI) / 180);
  const halfLon = SPAN_M / 2 / (111_200 * cos);
  const [south, north, west, east] = [cLat - halfLat, cLat + halfLat, cLon - halfLon, cLon + halfLon];

  const cachePath = join(paths.locationDir(locationId), "assets", "banner-osm.json");
  let osm: { elements: Way[] };
  if (existsSync(cachePath) && !REFRESH) {
    osm = JSON.parse(readFileSync(cachePath, "utf8")) as { elements: Way[] };
    console.log(`${locationId}: reusing ${rel(cachePath)} (--refresh to re-fetch)`);
  } else {
    const bbox = `${south},${west},${north},${east}`;
    const build = (classes: string[]) => `[out:json][timeout:180];
(
  way["highway"~"^(${classes.join("|")})$"](${bbox});
  way["waterway"~"^(river|riverbank)$"](${bbox});
  way["natural"="water"](${bbox});
  way["leisure"~"^(park|golf_course)$"](${bbox});
);
out geom;`;
    const ARTERIAL = ["motorway", "trunk", "primary", "secondary", "tertiary"];
    console.log(`${locationId}: fetching ${SPAN_M}m of OSM...`);
    osm = await overpass([build(Object.keys(ROAD_M)), build(ARTERIAL)]);
    mkdirSync(join(paths.locationDir(locationId), "assets"), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(osm), "utf8");
  }

  const K = HEIGHT / (north - south);
  const W = Math.round((east - west) * cos * K);
  const project = (lat: number, lon: number): [number, number] => [
    (lon - cLon) * cos * K + W / 2,
    -(lat - cLat) * K + HEIGHT / 2,
  ];
  const mPerPx = 1 / (K / 111_200);

  const simplify = (pts: [number, number][], tol: number) => {
    const out: [number, number][] = [pts[0]!];
    for (const p of pts.slice(1)) {
      const last = out[out.length - 1]!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= tol) out.push(p);
    }
    return out.length >= 2 ? out : pts.slice(0, 2);
  };
  const area = (pts: [number, number][]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[(i - 1 + pts.length) % pts.length]!;
      const q = pts[i]!;
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a / 2);
  };
  const d = (pts: [number, number][], close: boolean) =>
    `M${pts[0]![0].toFixed(0)} ${pts[0]![1].toFixed(0)}` +
    pts
      .slice(1)
      .map((p) => `L${p[0].toFixed(0)} ${p[1].toFixed(0)}`)
      .join("") +
    (close ? "Z" : "");

  const roads: [string, number][] = [];
  const water: [string, boolean][] = [];
  const green: string[] = [];
  const buildings: string[] = [];
  for (const way of osm.elements) {
    const g = way.geometry;
    const t = way.tags ?? {};
    if (!g?.length) continue;
    const pts = g.map((p) => project(p.lat, p.lon));
    if (!pts.some(([x, y]) => x > -20 && x < W + 20 && y > -20 && y < HEIGHT + 20)) continue;
    const closed = g[0]!.lat === g[g.length - 1]!.lat && g[0]!.lon === g[g.length - 1]!.lon;
    if (t.building) {
      // Footprints are what stop the map reading as a bare wire diagram. Anything
      // under 10px² is dust at this scale and only costs bytes.
      const s2 = simplify(pts, 1.4);
      if (area(s2) >= 10) buildings.push(d(s2, true));
    } else if (t.waterway || t.natural === "water") water.push([d(simplify(pts, 1.2), closed), closed]);
    else if (t.leisure) {
      const s = simplify(pts, 2);
      if (area(s) >= 30) green.push(d(s, true));
    } else if (t.highway && ROAD_M[t.highway]) roads.push([d(simplify(pts, 1.3), false), ROAD_M[t.highway]!]);
  }

  /** Every geocoded, harvestable source, with a colour and a glyph for its category. */
  const pins: { x: number; y: number; category: string; name: string }[] = [];
  for (const { catalogue } of loadCatalogues(locationId)) {
    if (!GLYPH[catalogue.category]) continue;
    for (const source of catalogue.sources) {
      const { lat, lon } = source.address ?? {};
      if (lat === undefined || lon === undefined || source.status === "closed") continue;
      const [x, y] = project(lat, lon);
      if (x < 18 || x > W - 18 || y < 18 || y > HEIGHT - 18) continue;
      // Nudged apart rather than stacked: two pins on one street should both read.
      if (pins.some((p) => Math.hypot(p.x - x, p.y - y) < 26)) continue;
      pins.push({ x, y, category: catalogue.category, name: source.name });
    }
  }

  const px = (m: number, extra: number) => Math.max(1.1, (m * K) / 111_200 + extra).toFixed(1);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HEIGHT}" role="img" aria-label="${location.name}">
<title>whazzon</title>
<desc>${location.name}, with a marker at each catalogued venue, coloured by what it programmes. Positions are real geocodes. Map data (c) OpenStreetMap contributors, ODbL.</desc>
<rect width="${W}" height="${HEIGHT}" fill="#eef0f2"/>`;
  svg += `<g fill="#d3e2cb">${green.map((p) => `<path d="${p}"/>`).join("")}</g>`;
  svg += `<g fill="#e2e5e9">${buildings.map((p) => `<path d="${p}"/>`).join("")}</g>`;
  svg += `<g fill="#a9c9dd" stroke="#a9c9dd" stroke-width="5" stroke-linejoin="round">${water
    .map(([p, c]) => (c ? `<path d="${p}"/>` : `<path d="${p}" fill="none" stroke-width="7"/>`))
    .join("")}</g>`;
  for (const [colour, extra] of [
    ["#c7ccd4", 1.5],
    ["#ffffff", 0],
  ] as const) {
    svg += `<g fill="none" stroke="${colour}" stroke-linecap="round" stroke-linejoin="round">`;
    for (const [p, m] of [...roads].sort((a, b) => b[1] - a[1]))
      svg += `<path d="${p}" stroke-width="${px(m, extra)}"/>`;
    svg += `</g>`;
  }
  for (const pin of pins) {
    const [x, y] = [pin.x.toFixed(0), pin.y.toFixed(0)];
    svg += `<g><title>${pin.name.replace(/[<>&]/g, "")}</title><circle cx="${x}" cy="${y}" r="17" fill="#fff" opacity=".95"/><circle cx="${x}" cy="${y}" r="14" fill="${COLOUR[pin.category]}"/><g transform="translate(${x} ${y})" fill="#fff">${GLYPH[pin.category]}</g></g>`;
  }
  svg += `</svg>\n`;

  const out = join(paths.root(), "web", "public", "banner.svg");
  writeFileSync(out, svg, "utf8");
  const byCategory = [...new Set(pins.map((p) => p.category))].sort();
  console.log(
    `${locationId}: ${W}x${HEIGHT} (${SPAN_M}m, ${mPerPx.toFixed(1)} m/px), ` +
      `${roads.length} roads, ${buildings.length} buildings, ${pins.length} real venues across ${byCategory.length} categories, ` +
      `${(svg.length / 1024).toFixed(0)} KB -> ${rel(out)}`,
  );
  console.log(`  ${byCategory.join(", ")}`);
}
