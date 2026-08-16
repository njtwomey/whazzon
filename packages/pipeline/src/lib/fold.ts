import { basename, dirname } from "node:path";
import type { Occurrence, WhazzonEvent } from "../schema/harvest.js";
import { HarvestArtefact } from "../schema/harvest.js";
import { readArtefact } from "./files.js";
import { paths, rel, walk } from "./paths.js";

/**
 * Folding the harvest log into the current picture.
 *
 * Harvest files are immutable observations: "this is what these pages said on
 * this day". They are never edited. One file per category per run date, folded
 * together here. The current state of the world is
 * *derived* by folding them forward, which is what lets us answer two
 * questions a single snapshot cannot:
 *
 *   - What is new? (firstSeen equals the latest run that covered the source)
 *   - What has a source stopped mentioning that has not happened yet?
 *
 * That second case is the reason this exists. A venue that lists three months
 * ahead will drop a show announced a year out, and a naive "latest run wins"
 * compile would delete it from the site. Here it is carried forward and
 * marked, so the UI can show it and say how long since it was last confirmed.
 *
 * Because the fold is pure and the log is append-only, a bug here is fixed by
 * correcting the code and re-running — never by editing data.
 */

export interface FoldedEvent {
  event: WhazzonEvent;
  firstSeen: string;
  lastSeen: string;
}

export interface FoldedSource {
  sourceId: string;
  /** Most recent run that visited this source, whether or not it succeeded. */
  lastHarvest?: string;
  /** Error from that most recent visit, when it failed. */
  lastError?: string;
  events: FoldedEvent[];
}

export interface Fold {
  /** Every run date present in the log, ascending. */
  runDates: string[];
  /** Keyed by sourceId. Only sources that have been observed appear. */
  sources: Map<string, FoldedSource>;
}

/** Last day an occurrence is relevant. Absent when it is open-ended. */
export function endDateOf(occurrence: Occurrence): string | undefined {
  switch (occurrence.kind) {
    case "single":
      return occurrence.date;
    case "run":
      return occurrence.end;
    case "recurring":
      return occurrence.end;
    case "ongoing":
    case "undated":
      return undefined;
  }
}

/**
 * The date an event sorts by. Absent when it has no position on a timeline.
 *
 * A run with no stated start is already under way, so it sorts from today
 * rather than falling to the bottom of the list.
 */
export function sortDateOf(occurrence: Occurrence, asOf: string): string | undefined {
  switch (occurrence.kind) {
    case "single":
      return occurrence.date;
    case "run":
      return occurrence.start ?? asOf;
    case "recurring":
    case "ongoing":
      return occurrence.start;
    case "undated":
      return undefined;
  }
}

export type EventState = "listed" | "carried" | "finished";

/**
 * Derived, never stored. A stored state field would drift out of step with the
 * log the first time anything was re-run; firstSeen and lastSeen are facts,
 * and everything else follows from them plus the date.
 */
export function stateOf(folded: FoldedEvent, lastHarvest: string | undefined, asOf: string): EventState {
  const end = endDateOf(folded.event.occurrence);
  if (end !== undefined && end < asOf) return "finished";
  if (lastHarvest !== undefined && folded.lastSeen === lastHarvest) return "listed";
  return "carried";
}

/**
 * Read every run file for a location, in date order, and accumulate.
 *
 * Later observations of the same event id replace earlier ones — a venue that
 * corrects a date or a price is telling us something newer — while firstSeen
 * preserves when we first saw it.
 */
export function foldHarvests(locationId: string): Fold {
  const files = walk(paths.harvestDir(locationId), ".yaml").sort();
  const sources = new Map<string, FoldedSource>();
  const runDates: string[] = [];

  for (const path of files) {
    const { data: run } = readArtefact(HarvestArtefact, path);

    const expectedCategory = basename(path, ".yaml");
    const expectedDate = basename(dirname(path));
    if (run.category !== expectedCategory) {
      throw new Error(`${rel(path)}: declares category "${run.category}" but the filename says "${expectedCategory}"`);
    }
    if (run.date !== expectedDate) {
      throw new Error(`${rel(path)}: declares date "${run.date}" but the directory says "${expectedDate}"`);
    }
    if (run.locationId !== locationId) {
      throw new Error(`${rel(path)}: belongs to location "${run.locationId}", not "${locationId}"`);
    }
    if (!runDates.includes(run.date)) runDates.push(run.date);

    for (const observation of run.observations) {
      let folded = sources.get(observation.sourceId);
      if (!folded) {
        folded = { sourceId: observation.sourceId, events: [] };
        sources.set(observation.sourceId, folded);
      }

      folded.lastHarvest = run.date;
      folded.lastError = observation.fetch.ok ? undefined : observation.fetch.error;

      const byId = new Map(folded.events.map((e) => [e.event.id, e]));
      for (const event of observation.events) {
        const existing = byId.get(event.id);
        byId.set(event.id, {
          event,
          firstSeen: existing?.firstSeen ?? run.date,
          lastSeen: run.date,
        });
      }
      folded.events = [...byId.values()];
    }
  }

  return { runDates, sources };
}
