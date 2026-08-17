import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { loadSources } from "../lib/catalogue.js";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel, walk } from "../lib/paths.js";
import { hasRoute, primaryUrl, routesOf } from "../lib/routes.js";

/**
 * What stage 2 learned that stage 1 needs to know.
 *
 * A harvest never edits the catalogue — the stages stay separate — so a stale
 * URL comes back as an observation whose `fetch.url` differs from the
 * catalogued one, plus a note. This is the other half of that handover: it
 * reads the harvest log and reports the corrections, so curating the catalogue
 * is a mechanical pass rather than trawling agent summaries.
 *
 * Reports nothing it cannot back up. A suggested URL is one a harvest actually
 * fetched successfully.
 *
 *   npm run drift -- gb-bristol
 *   npm run drift -- gb-bristol --date 2026-08-16
 *
 * Reads the YAML directly rather than through the schema, so it works on a
 * harvest that is still mid-flight and has not had ids assigned yet — which is
 * exactly when you want to see whether the catalogue is sending agents at dead
 * URLs.
 */

interface RawRun {
  date: string;
  observations: {
    sourceId: string;
    fetch: { ok: boolean; url: string; error?: string };
    events?: unknown[];
    notes?: string;
  }[];
}

const { locations, rest } = resolveLocations();
const dateFilter = rest.includes("--date") ? rest[rest.indexOf("--date") + 1] : undefined;
/** Emit a table for pasting into a run REPORT.md, so corrections can be checked at a glance. */
const markdown = rest.includes("--markdown");

for (const locationId of locations) {
  const catalogued = new Map(loadSources(locationId).map((s) => [s.id, s]));

  interface Finding {
    sourceId: string;
    catalogueUrl: string;
    workingUrl?: string;
    error?: string;
    note?: string;
    date: string;
  }

  const moved: Finding[] = [];
  const failed: Finding[] = [];
  const empty: Finding[] = [];

  for (const path of walk(paths.harvestDir(locationId), ".yaml")) {
    let run: RawRun;
    try {
      run = parse(readFileSync(path, "utf8")) as RawRun;
    } catch {
      console.warn(`skipping ${rel(path)} — not readable yet (agent may still be writing)`);
      continue;
    }
    if (!run?.observations) continue;
    if (dateFilter && run.date !== dateFilter) continue;

    for (const observation of run.observations) {
      const source = catalogued.get(observation.sourceId);
      if (!source) continue;

      const routes = routesOf(source);
      const base = {
        sourceId: observation.sourceId,
        catalogueUrl: primaryUrl(source) + (routes.length > 1 ? ` (+${routes.length - 1} more routes)` : ""),
        note: observation.notes,
        date: run.date,
      };

      if (!observation.fetch.ok) {
        failed.push({ ...base, error: observation.fetch.error });
        continue;
      }
      // Against every route, not just the primary one. An agent that took the
      // `api` route found no moved page, and flagging it each run would bury
      // the corrections that are real.
      if (!hasRoute(source, observation.fetch.url)) {
        moved.push({ ...base, workingUrl: observation.fetch.url });
      }
      if ((observation.events ?? []).length === 0) {
        empty.push({ ...base, workingUrl: observation.fetch.url });
      }
    }
  }

  if (markdown) {
    if (moved.length > 0) {
      console.log(`### Catalogue URLs to correct (${moved.length})\n`);
      console.log(`Each replacement was fetched successfully during the harvest.\n`);
      console.log(`| source | catalogued (broken) | proposed |`);
      console.log(`| --- | --- | --- |`);
      for (const f of moved) console.log(`| \`${f.sourceId}\` | ${f.catalogueUrl} | **${f.workingUrl}** |`);
      console.log("");
    }
    if (failed.length > 0) {
      console.log(`### Could not be reached (${failed.length})\n`);
      console.log(`| source | url | why |`);
      console.log(`| --- | --- | --- |`);
      for (const f of failed)
        console.log(`| \`${f.sourceId}\` | ${f.catalogueUrl} | ${(f.error ?? "").slice(0, 90)} |`);
      console.log("");
    }
    if (empty.length > 0) {
      console.log(`### Reachable but listed nothing (${empty.length})\n`);
      for (const f of empty) console.log(`- \`${f.sourceId}\``);
      console.log("");
    }
    continue;
  }

  console.log(`\n=== ${locationId} — catalogue drift ===`);

  if (moved.length > 0) {
    console.log(`\n${moved.length} source(s) harvested from a different URL than catalogued.`);
    console.log(`These are verified: a harvest fetched the replacement successfully.\n`);
    for (const f of moved) {
      console.log(`  ${f.sourceId}`);
      console.log(`    catalogued: ${f.catalogueUrl}`);
      console.log(`    worked:     ${f.workingUrl}`);
      if (f.note) console.log(`    note:       ${f.note.replace(/\s+/g, " ").slice(0, 140)}`);
      console.log("");
    }
  }

  if (failed.length > 0) {
    console.log(`\n${failed.length} source(s) could not be reached at all — these need a human:\n`);
    for (const f of failed) {
      console.log(`  ${f.sourceId}\n    ${f.catalogueUrl}\n    ${f.error}`);
      if (f.note) console.log(`    note: ${f.note.replace(/\s+/g, " ").slice(0, 140)}`);
      console.log("");
    }
  }

  if (empty.length > 0) {
    console.log(`\n${empty.length} source(s) were reachable but listed nothing.`);
    console.log(`Often correct (a park page, a dormant festival) — but a venue that never`);
    console.log(`lists anything is a candidate for status: dormant or closed.\n`);
    for (const f of empty) console.log(`  ${f.sourceId.padEnd(38)} ${f.workingUrl}`);
  }

  if (moved.length === 0 && failed.length === 0 && empty.length === 0) {
    console.log("no drift — every catalogued URL worked and listed something");
  }
  console.log("");
}
