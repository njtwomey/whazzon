import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineArtefact, SchemaError } from "./versioning.js";

/**
 * These tests are the guarantee behind the whole versioning scheme: a file
 * written at an old version must still load, and must arrive at the latest
 * shape. If this suite passes, committed data does not rot.
 */

const V1 = z.strictObject({
  schema: z.string(),
  name: z.string(),
  /** v1 stored a single line of address text. */
  address: z.string().optional(),
});

const V2 = z.strictObject({
  schema: z.string(),
  name: z.string(),
  /** v2 splits it into a structured object — a breaking change. */
  address: z.strictObject({ street: z.string() }).optional(),
});

const Thing = defineArtefact<z.infer<typeof V2>>({
  kind: "test.thing",
  versions: { 1: V1, 2: V2 },
  migrations: {
    1: (data) => ({
      ...data,
      address: data.address ? { street: data.address } : undefined,
    }),
  },
  latest: V2,
});

describe("versioned artefacts", () => {
  it("reads a current-version file unchanged", () => {
    const result = Thing.parse({
      schema: "test.thing/2",
      name: "Tobacco Factory",
      address: { street: "Raleigh Road" },
    });
    expect(result.migrated).toBe(false);
    expect(result.data.address).toEqual({ street: "Raleigh Road" });
  });

  it("migrates an old file forward to the latest version", () => {
    const result = Thing.parse({
      schema: "test.thing/1",
      name: "Tobacco Factory",
      address: "Raleigh Road",
    });
    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(2);
    expect(result.migrated).toBe(true);
    expect(result.data.address).toEqual({ street: "Raleigh Road" });
    expect(result.data.schema).toBe("test.thing/2");
  });

  it("validates against the version the file claims, not the latest", () => {
    // Structured address is invalid at v1, and the error should say so rather
    // than complaining that a v1 file does not look like v2.
    expect(() => Thing.parse({ schema: "test.thing/1", name: "x", address: { street: "y" } })).toThrow(/v1/);
  });

  it("refuses a file from a future version rather than guessing", () => {
    expect(() => Thing.parse({ schema: "test.thing/99", name: "x" })).toThrow(/only understands up to v2/);
  });

  it("refuses a file belonging to a different artefact kind", () => {
    expect(() => Thing.parse({ schema: "other.kind/1", name: "x" })).toThrow(/wrong artefact kind/);
  });

  it("requires a schema header", () => {
    expect(() => Thing.parse({ name: "x" })).toThrow(SchemaError);
  });

  it("rejects unknown fields instead of silently dropping them", () => {
    // A typo'd key must fail loudly — silently stripping it would lose data
    // that a human meant to record.
    expect(() => Thing.parse({ schema: "test.thing/2", name: "x", nmae: "typo" })).toThrow();
  });

  it("refuses to define an artefact with a hole in the migration chain", () => {
    expect(() =>
      defineArtefact({
        kind: "test.broken",
        versions: { 1: V1, 2: V2 },
        migrations: {},
        latest: V2,
      }),
    ).toThrow(/no migration from v1/);
  });
});
