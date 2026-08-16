import { z } from "zod";
import { Slug } from "./common.js";
import { defineArtefact } from "./versioning.js";

/**
 * The only place-specific file in the project. Everything that makes whazzon
 * "about Bristol" lives here and in data/ — never in code. Swap this file and
 * re-run stage 1 to retarget the whole project at another city.
 */

const LocationV1 = z.strictObject({
  schema: z.string(),
  id: Slug,
  name: z.string().min(1),
  region: z.string().min(1),
  country: z.string().min(1),
  /** IANA zone. Every local time in the project is interpreted against this. */
  timezone: z.string().min(1),
  language: z.string().min(2),
  centre: z.strictObject({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  radiusKm: z.number().positive(),

  /**
   * Hero image for the location, as a filename inside this location's asset
   * directory — `data/<location-id>/assets/`. Kept as a bare filename rather
   * than a path or a URL so the convention stays enforceable: assets live with
   * the location's data, and `sync-web` publishes them to a predictable place.
   *
   * Any format the browser understands. Landscape, and readable with a dark
   * scrim over it, since text sits on top.
   */
  image: z
    .string()
    .regex(/^[a-z0-9-]+\.[a-z0-9]+$/, "must be a bare filename, e.g. region.jpg")
    .optional(),
  /** Attribution, shown wherever the image is. Required by most photo licences. */
  imageCredit: z.string().optional(),

  character: z.string().min(1),
  aggregatorPolicy: z.string().optional(),
});

export type Location = z.infer<typeof LocationV1>;

export const LocationArtefact = defineArtefact<Location>({
  kind: "whazzon.location",
  versions: { 1: LocationV1 },
  migrations: {},
  latest: LocationV1,
});
