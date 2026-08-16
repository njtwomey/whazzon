import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { harvestableSources, loadSources } from "../lib/catalogue.js";
import { eventId } from "../lib/eventId.js";
import { writeArtefact } from "../lib/files.js";
import { resolveLocations } from "../lib/locations.js";
import { paths, rel } from "../lib/paths.js";
import { HarvestArtefact, type Observation, type Occurrence, type WhazzonEvent } from "../schema/harvest.js";

/**
 * Generates a fake stage 2 run so stage 3 can be built and judged before any
 * real fetching happens.
 *
 * This is scaffolding, not a stage. It exists because a listings UI cannot be
 * designed against an empty array: the layout decisions that matter — a
 * three-month exhibition next to a Tuesday gig, a market with no dates at all,
 * a venue whose fetch failed — only become visible with data of that shape.
 * Seeded from the source id, so output is stable across runs and a UI diff is
 * never noise from regenerated fixtures.
 *
 * Everything it writes is valid against whazzon.harvest/1, so replacing it
 * with a real harvest changes nothing downstream.
 *
 *   npm run mock -- bristol-uk
 *   npm run mock -- bristol-uk --date 2026-08-16
 */

const { locations, rest } = resolveLocations();
const dateArg = rest.includes("--date") ? rest[rest.indexOf("--date") + 1] : undefined;
const harvestDate = dateArg ?? new Date().toISOString().slice(0, 10);
const force = rest.includes("--force");

if (!/^\d{4}-\d{2}-\d{2}$/.test(harvestDate)) {
  console.error(`--date must be YYYY-MM-DD, got "${harvestDate}"`);
  process.exit(1);
}

/**
 * Refuse to overwrite an existing run. Once real harvests exist, running this
 * by habit would silently replace a day's genuine observations with fixtures —
 * and because the log is append-only, nothing downstream would notice.
 */
for (const locationId of locations) {
  const path = paths.harvestRunDir(locationId, harvestDate);
  if (existsSync(path) && !force) {
    console.error(
      `${rel(path)} already exists.\n` +
        `This generates FIXTURES, not real data — overwriting a real harvest would lose it.\n` +
        `Pass --force if you are certain that file is mock data.`,
    );
    process.exit(1);
  }
}

/** Deterministic PRNG so the same source always produces the same fixtures. */
function seeded(seed: string): () => number {
  let h = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0xffffffff;
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const between = (rand: () => number, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

/**
 * Per-category shapes. The point is not realistic titles — it is realistic
 * *structure*: which occurrence kinds each category produces, and in what mix.
 */
interface Profile {
  count: [number, number];
  occurrence: (rand: () => number, day: string) => Occurrence;
  titles: readonly string[];
  free?: boolean;
}

const singleNight = (rand: () => number, day: string): Occurrence => ({
  kind: "single",
  date: addDays(day, between(rand, 1, 90)),
  startTime: pick(rand, ["19:00", "19:30", "20:00", "20:30"]),
});

const exhibitionRun = (rand: () => number, day: string): Occurrence => {
  const start = addDays(day, between(rand, -30, 30));
  return { kind: "run", start, end: addDays(start, between(rand, 30, 120)) };
};

const theatreRun = (rand: () => number, day: string): Occurrence => {
  const start = addDays(day, between(rand, 5, 100));
  return { kind: "run", start, end: addDays(start, between(rand, 3, 35)) };
};

const PROFILES: Record<string, Profile> = {
  music: {
    count: [3, 9],
    occurrence: singleNight,
    titles: [
      "Sunken Choir",
      "The Harbour Lights",
      "Bezel",
      "Molly & the Tides",
      "Kaleidostep",
      "Night Ferry",
      "Pattern Language",
      "Vela",
      "Low Country",
    ],
  },
  theatre: {
    count: [2, 6],
    occurrence: (rand, day) => (rand() < 0.75 ? theatreRun(rand, day) : singleNight(rand, day)),
    titles: [
      "Macbeth",
      "The Winter Guest",
      "A Number",
      "Salt of the Earth",
      "The Glass Harbour",
      "Nora: A Doll's House",
      "Under Milk Wood",
    ],
  },
  cinema: {
    count: [4, 10],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 0, 28)),
      startTime: pick(rand, ["14:00", "17:45", "18:00", "20:15", "20:45"]),
    }),
    titles: [
      "Aftersun (2022)",
      "La Haine — 30th Anniversary",
      "Chungking Express",
      "New Release Preview",
      "Silent Cinema with Live Score",
      "Shorts Night",
      "Director Q&A: In the Fold",
      "Sunday Matinee Classic",
    ],
  },
  comedy: {
    count: [2, 6],
    occurrence: singleNight,
    titles: ["Saturday Night Stand-Up", "Improv Jam", "Work in Progress", "New Material Night", "Late Show"],
  },
  literature: {
    count: [1, 4],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 2, 70)),
      startTime: pick(rand, ["18:30", "19:00", "19:30"]),
    }),
    titles: [
      "An Evening with the Author",
      "Poetry Open Mic",
      "Book Launch: The Long Field",
      "Reading Group: Autumn Pick",
      "In Conversation: Writing Place",
    ],
  },
  art: {
    count: [1, 4],
    occurrence: (rand, day) => (rand() < 0.7 ? exhibitionRun(rand, day) : singleNight(rand, day)),
    titles: [
      "New Contemporaries",
      "Ground Truth",
      "Photographs 1994–2024",
      "Open Studios",
      "Material Evidence",
      "Artist's Talk",
    ],
    free: true,
  },
  museums: {
    count: [1, 4],
    occurrence: (rand, day) =>
      rand() < 0.4 ? { kind: "ongoing", start: addDays(day, -between(rand, 100, 800)) } : exhibitionRun(rand, day),
    titles: [
      "Permanent Collection",
      "Bristol Through the Lens",
      "Family Explorer Trail",
      "Curator's Tour",
      "Late Opening",
    ],
    free: true,
  },
  markets: {
    count: [1, 2],
    occurrence: (rand) => ({
      kind: "recurring",
      pattern: pick(rand, [
        "Every Sunday, 10:00–14:00",
        "Every Saturday morning",
        "Wednesday to Friday, 10:00–15:00",
        "First Sunday of the month",
      ]),
      startTime: "10:00",
    }),
    titles: ["Weekly Market", "Farmers' Market", "Street Food Market", "Makers' Market"],
    free: true,
  },
  making: {
    count: [2, 5],
    occurrence: (rand, day) =>
      rand() < 0.5
        ? {
            kind: "recurring",
            pattern: pick(rand, [
              "Ten Tuesdays from 22 September, 19:00–21:00",
              "Every Wednesday, open evening from 19:00",
              "Six Thursdays, 18:30–20:30",
            ]),
          }
        : { kind: "single", date: addDays(day, between(rand, 7, 80)), startTime: "10:00" },
    titles: [
      "Introduction to Green Woodworking",
      "Screenprinting Weekend Workshop",
      "Open Evening",
      "Beginners' Letterpress",
      "Bike Maintenance Basics",
      "Sashiko Mending",
      "Spoon Carving Day",
    ],
  },
  gardens: {
    count: [1, 4],
    occurrence: (rand, day) =>
      rand() < 0.3
        ? { kind: "ongoing" }
        : { kind: "single", date: addDays(day, between(rand, 3, 120)), startTime: "11:00" },
    titles: [
      "Open Garden Afternoon",
      "Autumn Plant Sale",
      "Guided Botanical Tour",
      "Seed Swap",
      "Pruning Workshop",
      "Wildlife Walk",
    ],
  },
  festivals: {
    count: [1, 2],
    occurrence: (rand, day) => {
      const start = addDays(day, between(rand, 30, 300));
      return { kind: "run", start, end: addDays(start, between(rand, 1, 4)) };
    },
    titles: ["2027 Edition", "Weekend Programme", "Opening Weekend"],
  },
  sport: {
    count: [2, 6],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 3, 120)),
      startTime: pick(rand, ["15:00", "19:45", "12:30"]),
    }),
    titles: ["Home Fixture", "League Match", "Cup Round", "Season Opener", "Derby Day"],
  },
  outdoors: {
    count: [0, 3],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 5, 90)),
      startTime: "10:30",
    }),
    titles: ["Guided Walk", "Volunteer Morning", "Dawn Chorus Walk", "Estate Open Day"],
    free: true,
  },
  "food-drink": {
    count: [1, 4],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 5, 140)),
      startTime: "18:00",
    }),
    titles: ["Tasting Evening", "Brewery Tour", "Supper Club", "Meet the Maker"],
  },
  family: {
    count: [1, 4],
    occurrence: (rand, day) => ({
      kind: "single",
      date: addDays(day, between(rand, 2, 60)),
      startTime: "10:00",
    }),
    titles: ["Half-Term Craft Session", "Animal Feeding", "Toddler Morning", "Storytelling"],
    free: true,
  },
  citywide: {
    count: [5, 12],
    occurrence: singleNight,
    titles: [
      "Late Night Opening",
      "Warehouse Party",
      "Community Fair",
      "Pop-Up Supper",
      "Street Party",
      "Open Mic",
      "Charity Fundraiser",
      "Talk & Screening",
    ],
  },
};

const DEFAULT_PROFILE: Profile = {
  count: [1, 3],
  occurrence: singleNight,
  titles: ["An Evening Event", "Open Day", "Special Programme"],
};

/**
 * Event-level tags, distinct from the source's category.
 *
 * The category says what kind of place this came from; the tags say what this
 * particular event is. A cinema's programme contains a subtitled matinee, a
 * director Q&A and a late-night horror screening, and only tags can tell them
 * apart. Slug-cased, because the schema requires it and because the UI filters
 * on them.
 */
const TAG_VOCABULARY: Record<string, readonly string[]> = {
  music: ["live-music", "electronic", "jazz", "folk", "indie", "club-night", "all-ages", "standing"],
  theatre: ["drama", "new-writing", "musical", "family", "matinee", "in-the-round", "one-person-show"],
  cinema: ["arthouse", "classic", "documentary", "q-and-a", "subtitled", "preview", "short-film"],
  comedy: ["stand-up", "improv", "work-in-progress", "sketch", "late-night"],
  literature: ["author-talk", "poetry", "book-launch", "open-mic", "signing"],
  art: ["exhibition", "private-view", "artist-talk", "photography", "sculpture", "free-entry"],
  museums: ["exhibition", "guided-tour", "family", "hands-on", "late-opening", "free-entry"],
  markets: ["street-food", "crafts", "farmers", "vintage", "outdoor"],
  making: ["workshop", "beginners", "hands-on", "materials-included", "woodwork", "printmaking", "textiles"],
  gardens: ["plant-sale", "guided-tour", "wildlife", "open-garden", "hands-on", "seasonal"],
  festivals: ["outdoor", "multi-day", "family", "headliner", "free-entry"],
  sport: ["fixture", "home-game", "mass-participation", "spectator"],
  outdoors: ["walk", "guided", "wildlife", "volunteering", "free-entry"],
  "food-drink": ["tasting", "supper-club", "brewery", "booking-required"],
  family: ["kids", "under-5s", "school-holidays", "drop-in", "free-entry"],
  citywide: ["pop-up", "one-off", "community", "late-night", "fundraiser"],
};

/** Places an aggregator might list that are not in the catalogue. */
const UNCATALOGUED_VENUES = [
  { name: "The Old Malthouse", area: "St Philips" },
  { name: "Redcliffe Caves", area: "Redcliffe" },
  { name: "St Anne's Church Hall", area: "Brislington" },
  { name: "Unit 4, Days Road", area: "St Philips" },
];

function makeRaw(title: string, name: string, long: boolean): string {
  const head = [
    `## ${title}`,
    ``,
    `Presented at [${name}](https://example.invalid/), this is **mock** listing text `,
    `standing in for scraped copy. It exists to prove that markdown survives the `,
    `pipeline: *emphasis*, [links](https://example.invalid/), and paragraph breaks.`,
    ``,
    `> Pull quotes appear in real listings often enough to be worth designing for.`,
  ];

  if (!long) return head.join("\n");

  // Some venues write an essay. The dialog has to cope with that without
  // growing off the screen, so a share of the fixtures are deliberately long.
  return [
    ...head,
    ``,
    `### About the programme`,
    ``,
    `Real listings run to several hundred words: a paragraph of billing, a cast `,
    `list, access information, a note about the bar, and three more paragraphs of `,
    `context that nobody asked for. All of it arrives as markdown and all of it `,
    `has to render without breaking the layout.`,
    ``,
    `- Doors open an hour before the advertised start`,
    `- Latecomers admitted at a suitable break`,
    `- The venue is fully accessible; contact the box office to arrange seating`,
    `- Age guidance applies to some performances`,
    ``,
    `### Access`,
    ``,
    `Step-free access throughout, with an accessible toilet on the ground floor. `,
    `An induction loop is fitted in the main auditorium. Assistance dogs welcome.`,
    ``,
    `### Getting here`,
    ``,
    `Ten minutes' walk from the centre, with several bus routes stopping nearby. `,
    `There is no venue car park; the nearest is a short walk away and fills early `,
    `on performance nights.`,
    ``,
    `*Programme details are subject to change. Check the venue's own page before `,
    `travelling — it is always the authority.*`,
  ].join("\n");
}

for (const locationId of locations) {
  const sources = harvestableSources(loadSources(locationId));

  // One file per category, mirroring how a real fan-out writes: each category
  // agent owns its own file.
  const byCategory = new Map<string, Observation[]>();
  let eventTotal = 0;
  let failures = 0;

  for (const source of sources) {
    const rand = seeded(`${source.id}:${harvestDate}`);
    const profile = PROFILES[source.category] ?? DEFAULT_PROFILE;
    const observations = byCategory.get(source.category) ?? [];
    byCategory.set(source.category, observations);

    // ~8% of sources fail. Real harvests always have some, and the UI needs to
    // show "we could not reach this venue" differently from "nothing on".
    if (rand() < 0.08) {
      observations.push({
        sourceId: source.id,
        fetch: {
          ok: false,
          url: source.url,
          status: pick(rand, [403, 404, 500, 503]),
          error: pick(rand, ["host returned an error page", "request timed out", "blocked by bot protection"]),
        },
        events: [],
        notes: "Mock failure, generated to exercise the failed-fetch path.",
      });
      failures += 1;
      continue;
    }

    const n = between(rand, profile.count[0], profile.count[1]);
    const events: WhazzonEvent[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < n; i += 1) {
      const title = pick(rand, profile.titles);
      const occurrence = profile.occurrence(rand, harvestDate);
      const id = eventId(source.id, `${title} ${i}`, occurrence);
      if (usedIds.has(id)) continue;
      usedIds.add(id);

      const free = profile.free ? rand() < 0.7 : rand() < 0.15;
      const min = free ? undefined : between(rand, 6, 22);
      const hasImage = rand() < 0.7;

      // Only aggregators list events somewhere other than themselves.
      const elsewhere = source.kind === "aggregator" && rand() < 0.8;
      const catalogued =
        elsewhere && rand() < 0.5
          ? pick(
              rand,
              sources.filter((s) => s.kind === "venue"),
            )
          : undefined;

      events.push({
        id,
        sourceId: source.id,
        title,
        occurrence,
        image: hasImage ? `https://picsum.photos/seed/${id.split("#")[1] ?? i}/800/450` : undefined,
        status: rand() < 0.06 ? "sold-out" : "scheduled",
        timesText: occurrence.kind === "run" ? "Tue–Sat 19:30, Sat matinee 14:30" : undefined,
        venue: elsewhere ? (catalogued ? { sourceId: catalogued.id } : pick(rand, UNCATALOGUED_VENUES)) : undefined,
        url: source.url,
        price: free
          ? { free: true, text: "Free entry" }
          : {
              free: false,
              text: `£${min} / £${min! - 3} concessions`,
              min,
              max: min! + between(rand, 0, 14),
              currency: "GBP",
            },
        ageRestriction: rand() < 0.1 ? "18+" : undefined,
        tags: (() => {
          const vocabulary = TAG_VOCABULARY[source.category] ?? [];
          const chosen = new Set<string>();
          for (let t = 0; t < between(rand, 1, 4); t += 1) chosen.add(pick(rand, vocabulary));
          if (free) chosen.add("free-entry");
          return [...chosen].filter(Boolean);
        })(),
        raw: makeRaw(title, source.name, rand() < 0.35),
        summary: `${title} at **${source.name}**. Placeholder copy generated for layout work — not a real listing.`,
        confidence: rand() < 0.15 ? "medium" : "high",
      });
    }

    observations.push({ sourceId: source.id, fetch: { ok: true, url: source.url, status: 200 }, events });
    eventTotal += events.length;
  }

  for (const [category, observations] of [...byCategory].sort()) {
    writeArtefact(HarvestArtefact, paths.harvestFile(locationId, harvestDate, category), {
      locationId,
      date: harvestDate,
      category,
      harvestedAt: `${harvestDate}T09:00:00Z`,
      prompt: { name: "mock-harvest", version: "1" },
      model: "mock",
      observations,
    });
  }

  console.log(
    `${locationId}: ${byCategory.size} categories, ${eventTotal} events, ` +
      `${failures} simulated failures -> ${rel(paths.harvestRunDir(locationId, harvestDate))}/`,
  );
}
