# Status

Where the project actually stands. Update this as things move; `CLAUDE.md` is
for durable rules and should not accumulate progress notes.

_Last updated: 2026-08-16_

## Stage 1 — catalogue

**Done for Bristol.** 16 categories, 155 sources.

Every source is `status: provisional` — nothing has been verified by a human
yet. `make check-urls` currently reports:

| outcome                   | count | what to do                                            |
| ------------------------- | ----- | ----------------------------------------------------- |
| ok                        | 107   | promote to `active` as they are confirmed             |
| blocked by bot protection | 12    | check by hand — **never** mark these `closed`         |
| dead path, live site      | 21    | find the real listings path, or fall back to the root |
| no answer at all          | 15    | wrong domain or genuinely gone                        |

Curating that down is the outstanding stage 1 work, and it is the main thing
standing between here and a real harvest.

Known loose ends in the catalogue:

- `making/maker-shed` — a placeholder. Could not confirm a Bristol makerspace of
  that name; currently points at Bristol Hackspace as a stand-in.
- `food-drink/bristol-whisky-festival` — name and URL unverified; may be an
  organiser running year-round tastings rather than a festival.
- `sport/severn-bridge-half` and `gardens/the-community-farm` sit outside the
  configured 12km radius. Kept deliberately.
- Three duplicate-URL warnings from `make validate`, all deliberate
  cross-listings, documented in the entries' `notes`.

## Stage 2 — harvest

**Started.** Mock data has been deleted. The first real run is
`data/bristol-uk/harvest/2026-08-16.yaml`: 37 events from 2 sources, all with
images, tags and deep links.

| source                    | events |
| ------------------------- | ------ |
| `theatre/bristol-old-vic` | 12     |
| `cinema/the-cube`         | 25     |

153 of 155 sources are still due. `prompts/stage2-harvest.md` is at v2, rewritten
around **one agent per category** — that is the shape a full run should take.

Two things real pages taught us that the fixtures never would:

- Listings say "Until Thu 20 Aug" for something already running. `run.start` is
  now optional, because requiring it would force an extractor to invent a date.
- Cinemas list the same film twice in one day. Multiple showings collapse to one
  event with the times in `timesText`, which also avoids an id collision.

`npm run mock` now refuses to overwrite an existing run file without `--force`.

## Stage 3 — render

**Built and running** (`make dev`).

Filterable listing grouped by month, with regular/ongoing and undated events in
their own sections, a detail dialog rendering the source markdown, dark mode,
and filter state persisted in the URL.

## Tooling

`npm run tags -- bristol-uk` reports the tag vocabulary in use and flags
near-duplicates (`family` / `family-friendly`). Stage 2 is told to reuse existing
tags; before this existed that instruction could not be followed.

Current vocabulary: 41 tags across 102 uses, no drift detected — though with only
two sources harvested that proves little.

## Next

- **Curate stage 1** — fix the 21 wrong paths, resolve the 15 dead domains,
  promote confirmed sources to `active`.
- **Switch the harvest log to JSONL** — one observation per line with a header
  line carrying the schema version. Genuinely appendable, so a run that dies
  part-way keeps what it recorded. Deferred so the UI could land first.
- **AI digests** — one location-wide "what does this week look like" and one per
  category, seasonally aware. Must run after the fold (it needs `firstSeen` to
  know what is new) and before render (which does no LLM work), so it is its own
  versioned artefact rather than part of `compile`, which stays deterministic.
- **First real harvest**, once the catalogue is curated.
- **Automation** — none yet, by design. `make stale` already produces the
  worklist a cron job would consume.
