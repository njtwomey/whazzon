import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type { VersionedArtefact } from "../schema/versioning.js";
import { SchemaError } from "../schema/versioning.js";

/**
 * Read a YAML artefact, validating and migrating it to the latest schema
 * version. Nothing in the codebase should read a data file any other way.
 */
export function readArtefact<T>(artefact: VersionedArtefact<T>, path: string) {
  let raw: unknown;
  try {
    raw = parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new SchemaError(`could not parse YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  return artefact.parse(raw);
}

/**
 * Write a YAML artefact, stamping the current schema header. Key order is
 * preserved from the object, so schemas should declare fields in the order a
 * human wants to read them in a diff.
 */
export function writeArtefact<T extends Record<string, unknown>>(
  artefact: VersionedArtefact<T>,
  path: string,
  data: Omit<T, "schema"> & { schema?: string },
): void {
  const withHeader = { ...data, schema: artefact.header };
  // Re-validate on the way out: a bug that writes a malformed file is much
  // cheaper to find here than three stages downstream.
  const checked = artefact.parse(withHeader);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    stringify(reorderSchemaFirst(checked.data as Record<string, unknown>), {
      lineWidth: 0,
      defaultStringType: "QUOTE_DOUBLE",
      defaultKeyType: "PLAIN",
    }),
    "utf8",
  );
}

/** `schema:` reads best as the first line of the file. */
function reorderSchemaFirst(data: Record<string, unknown>) {
  const { schema, ...rest } = data;
  return { schema, ...rest };
}
