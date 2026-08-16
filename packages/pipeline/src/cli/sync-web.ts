import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocation, resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import type { Snapshot } from "../schema/snapshot.js";

/**
 * Copies compiled snapshots into the web app's public directory and writes the
 * index the app uses to discover which locations exist.
 *
 * The snapshots are fetched at runtime rather than imported into the bundle:
 * they are large, they grow, and there is no reason to parse Bristol's data in
 * order to look at another city. Keeping them out of the bundle also means the
 * app has exactly one way to get data — over HTTP, at a known path — which is
 * the same shape it will have if this ever becomes a real API.
 *
 * The index carries a few headline counts so the landing page can describe each
 * city without downloading every snapshot to do it.
 */

const { locations } = resolveLocations();
const outDir = join(paths.root(), "web", "public", "snapshots");
mkdirSync(outDir, { recursive: true });

const index: unknown[] = [];

for (const locationId of locations) {
  const snapshotPath = paths.snapshot(locationId);
  if (!existsSync(snapshotPath)) {
    console.warn(`skipping ${locationId} — no snapshot yet, run \`npm run compile -- ${locationId}\``);
    continue;
  }

  const location = loadLocation(locationId);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;

  copyFileSync(snapshotPath, join(outDir, `${locationId}.json`));

  // Assets live beside the location's data and are published to a predictable
  // path, so a location is still a self-contained directory on disk.
  let imageUrl: string | undefined;
  if (location.image) {
    const source = join(paths.locationDir(locationId), "assets", location.image);
    if (existsSync(source)) {
      const assetDir = join(paths.root(), "web", "public", "assets", locationId);
      mkdirSync(assetDir, { recursive: true });
      copyFileSync(source, join(assetDir, location.image));
      imageUrl = `assets/${locationId}/${location.image}`;
    } else {
      console.warn(`${locationId}: config names image "${location.image}" but ${rel(source)} does not exist`);
    }
  }

  index.push({
    id: location.id,
    name: location.name,
    region: location.region,
    country: location.country,
    imageUrl,
    imageCredit: location.imageCredit,
    asOf: snapshot.asOf,
    eventCount: snapshot.events.length,
    sourceCount: snapshot.sources.length,
    categoryCount: snapshot.categories.length,
    // Enough to give each city a recognisable shape on the landing page.
    topCategories: [...snapshot.categories]
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 4)
      .map((category) => category.label),
  });

  console.log(`${locationId} -> ${rel(join(outDir, `${locationId}.json`))}`);
}

writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

if (index.length === 0) {
  console.error("no snapshots synced — the web app will have nothing to show");
  process.exit(1);
}
