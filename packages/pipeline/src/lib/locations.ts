import { existsSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { LocationArtefact, type Location } from "../schema/location.js";
import { readArtefact } from "./files.js";
import { paths, rel } from "./paths.js";

/**
 * Resolving which location a command applies to.
 *
 * Every CLI takes the location id as its first positional argument:
 *
 *   npm run validate -- bristol-uk
 *   npm run stale -- bristol-uk --ids
 *   npm run validate -- --all
 *
 * With exactly one location configured the argument may be omitted, so the
 * single-city case stays as short as it was before locations existed. With
 * more than one, it is required — quietly defaulting to whichever sorted
 * first would eventually operate on the wrong city's data.
 */

export interface LocationRef {
  id: string;
  configPath: string;
}

export function listLocations(): LocationRef[] {
  const dir = paths.configsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => ({ id: basename(f, ".yaml"), configPath: paths.config(basename(f, ".yaml")) }));
}

export function loadLocation(locationId: string): Location {
  const path = paths.config(locationId);
  if (!existsSync(path)) {
    throw new Error(`no such location "${locationId}" — expected ${rel(path)}`);
  }
  const { data } = readArtefact(LocationArtefact, path);
  if (data.id !== locationId) {
    throw new Error(`${rel(path)}: declares id "${data.id}" but the filename says "${locationId}"`);
  }
  return data;
}

export interface ResolvedArgs {
  /** Locations this invocation applies to. */
  locations: string[];
  /** Everything that was not the location id, flags included. */
  rest: string[];
}

/**
 * Pull the location out of argv. Exits with a readable message rather than a
 * stack trace, since this is the first thing every CLI does.
 */
export function resolveLocations(argv: string[] = process.argv.slice(2)): ResolvedArgs {
  const available = listLocations();
  if (available.length === 0) {
    console.error(`no locations configured — add configs/<location-id>.yaml before running this.`);
    process.exit(1);
  }

  if (argv.includes("--all")) {
    return {
      locations: available.map((l) => l.id),
      rest: argv.filter((a) => a !== "--all"),
    };
  }

  const ids = new Set(available.map((l) => l.id));
  const index = argv.findIndex((a) => !a.startsWith("-") && ids.has(a));

  if (index === -1) {
    // Not a known id. If something that looks like a bare word was passed,
    // it is a typo rather than an omission — say so instead of silently
    // running against the default.
    const stray = argv.find((a) => !a.startsWith("-") && !a.includes("."));
    if (stray && !ids.has(stray)) {
      console.error(`unknown location "${stray}". Available: ${available.map((l) => l.id).join(", ")}`);
      process.exit(1);
    }
    if (available.length === 1) {
      return { locations: [available[0]!.id], rest: argv };
    }
    console.error(
      `more than one location is configured, so the location must be given:\n` +
        available.map((l) => `  ${l.id}`).join("\n") +
        `\n\ne.g. npm run <script> -- ${available[0]!.id}   (or --all)`,
    );
    process.exit(1);
  }

  return {
    locations: [argv[index]!],
    rest: [...argv.slice(0, index), ...argv.slice(index + 1)],
  };
}
