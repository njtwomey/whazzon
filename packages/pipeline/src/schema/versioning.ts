import { z } from "zod";

/**
 * Every file whazzon writes carries a `schema: <kind>/<version>` header, e.g.
 *
 *   schema: whazzon.catalogue/1
 *
 * Files are never read without going through `parseVersioned`. That function
 * validates against the schema for the version the file *claims*, then walks
 * the migration chain forward to the current version, validating at each step.
 * A file written years ago therefore stays readable, and the rest of the
 * codebase only ever sees the latest shape.
 *
 * Rules for changing a schema:
 *
 *   - Additive, optional field, old files still valid  -> edit the current
 *     version in place. No new version needed.
 *   - Anything else (required field, rename, retype,
 *     changed meaning of an existing field)            -> add version N+1 and
 *     a migration from N. Never edit a released version.
 *
 * Migrations are pure functions over plain data. They must not read the
 * network, the filesystem, or the clock: `npm run migrate` has to be
 * deterministic and reviewable as a diff.
 */

export const SCHEMA_HEADER_RE = /^([a-z][a-z0-9.]*)\/(\d+)$/;

export interface SchemaHeader {
  kind: string;
  version: number;
}

export function parseSchemaHeader(raw: unknown): SchemaHeader {
  if (typeof raw !== "string") {
    throw new SchemaError(
      `missing "schema" header — every whazzon file must start with e.g. "schema: whazzon.catalogue/1"`,
    );
  }
  const match = SCHEMA_HEADER_RE.exec(raw);
  if (!match) {
    throw new SchemaError(`malformed "schema" header ${JSON.stringify(raw)} — expected "<kind>/<version>"`);
  }
  return { kind: match[1]!, version: Number(match[2]!) };
}

export class SchemaError extends Error {
  constructor(
    readonly summary: string,
    readonly issues: string[] = [],
  ) {
    // The issues ARE the error. Keeping them in a side property means every
    // caller that just prints `error.message` — including any stack trace —
    // reports "failed validation" and nothing about what was actually wrong.
    super(issues.length > 0 ? `${summary}\n  - ${issues.join("\n  - ")}` : summary);
    this.name = "SchemaError";
  }
}

/** A migration takes the plain data of version N and returns version N+1. */
export type Migration = (data: any) => any;

export interface VersionedArtefactDefinition<TLatest> {
  /** Stable kind string, e.g. "whazzon.catalogue". Never changes. */
  kind: string;
  /**
   * One entry per version ever released, keyed by version number. Old entries
   * stay forever — they are what make old files readable.
   */
  versions: Record<number, z.ZodTypeAny>;
  /**
   * Keyed by source version: `migrations[1]` upgrades v1 data to v2. Every
   * version except the latest needs one.
   */
  migrations: Record<number, Migration>;
  /**
   * The schema for the current version. Declared for readability at the call
   * site; `versions[currentVersion]` is the same object. Loosely typed on
   * purpose — schemas using `.default()` or `.superRefine()` have an input
   * type that differs from their output type, and pinning this to
   * `ZodType<TLatest>` rejects exactly the schemas we care about.
   */
  latest: z.ZodTypeAny;
}

export interface ParseResult<T> {
  data: T;
  /** Version the file was written at. */
  fromVersion: number;
  /** Version the data is now at. */
  toVersion: number;
  /** True when migrations ran, i.e. the file on disk is behind. */
  migrated: boolean;
}

export class VersionedArtefact<TLatest> {
  constructor(private readonly def: VersionedArtefactDefinition<TLatest>) {
    const versions = this.knownVersions;
    if (versions.length === 0) {
      throw new Error(`${def.kind}: no versions declared`);
    }
    // Fail loudly at import time if the migration chain has a hole — this is a
    // programming error, and finding it lazily at read time would be worse.
    for (const v of versions) {
      if (v !== this.currentVersion && !def.migrations[v]) {
        throw new Error(`${def.kind}: no migration from v${v} to v${v + 1}; every version except the latest needs one`);
      }
    }
  }

  get kind(): string {
    return this.def.kind;
  }

  get knownVersions(): number[] {
    return Object.keys(this.def.versions)
      .map(Number)
      .sort((a, b) => a - b);
  }

  get currentVersion(): number {
    const versions = this.knownVersions;
    return versions[versions.length - 1]!;
  }

  get header(): string {
    return `${this.def.kind}/${this.currentVersion}`;
  }

  /**
   * Validate and upgrade a raw parsed object (from YAML or JSON) to the latest
   * version. Throws SchemaError with readable issues on failure.
   */
  parse(raw: unknown): ParseResult<TLatest> {
    if (raw === null || typeof raw !== "object") {
      throw new SchemaError(`expected a mapping at the top level of the file`);
    }

    const header = parseSchemaHeader((raw as Record<string, unknown>).schema);
    if (header.kind !== this.def.kind) {
      throw new SchemaError(
        `wrong artefact kind: file declares "${header.kind}" but this reader expects "${this.def.kind}"`,
      );
    }
    if (!this.def.versions[header.version]) {
      const known = this.knownVersions.join(", ");
      throw new SchemaError(
        header.version > this.currentVersion
          ? `file is at v${header.version} but this build only understands up to v${this.currentVersion} — update whazzon`
          : `unknown version v${header.version} (known: ${known})`,
      );
    }

    let version = header.version;
    let data: any = raw;

    // Validate at the claimed version first, so a corrupt old file reports an
    // error against the schema it was actually written for.
    data = this.validateAt(version, data);

    while (version < this.currentVersion) {
      const migrate = this.def.migrations[version]!;
      data = migrate(data);
      version += 1;
      data = { ...data, schema: `${this.def.kind}/${version}` };
      data = this.validateAt(version, data, `after migrating to v${version}`);
    }

    return {
      data: data as TLatest,
      fromVersion: header.version,
      toVersion: version,
      migrated: version !== header.version,
    };
  }

  private validateAt(version: number, data: unknown, context?: string): any {
    const schema = this.def.versions[version]!;
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new SchemaError(
        context ? `failed validation at v${version} ${context}` : `failed validation at v${version}`,
        formatIssues(result.error),
      );
    }
    return result.data;
  }
}

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

export function defineArtefact<TLatest>(def: VersionedArtefactDefinition<TLatest>): VersionedArtefact<TLatest> {
  return new VersionedArtefact(def);
}
