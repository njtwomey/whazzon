# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**whazzon** answers "what's on?" for a place. It builds a periodically-refreshed catalogue of what is happening in a city and renders it as a static, filterable website. Bristol, UK is the first location; the project is multi-location by construction.

## The three stages (keep these separated)

The single most important architectural constraint: **stage 1, stage 2, and stage 3 never call into each other.** They communicate only through committed files on disk. Each stage must be runnable, re-runnable, and reviewable in isolation.

```
  Stage 1: CATALOGUE          Stage 2: HARVEST            Stage 3: RENDER
  "who exists here?"          "what's on right now?"      "show it to me"

  configs/<loc>.yaml   →      catalogue/*.yaml      →     snapshot.json    →   static site
  (LLM generates)             (LLM + WebFetch)            (fold + compile,     (React/Vite)
                                                           deterministic)
  runs: every few months      runs: daily–weekly          runs: on every build
```

- **Stage 1 (catalogue)** is slow-moving taxonomy. Hand-reviewable YAML that a human curates. A re-run must _merge_, never clobber human edits.
- **Stage 2 (harvest)** is the expensive, high-churn part. It visits sources via WebFetch and appends one run file.
- **Stage 3 (render)** is a pure function of committed data. **No network calls, no LLM calls.** If the page needs something, it must already be in the snapshot.

Violating the separation (fetching a venue page from the React app, letting the harvester decide layout) is the main thing to catch in review.

## Multi-location layout

Everything below the top level is keyed by a location id. A second city is a new config plus a new data directory — never a fork.

```
configs/<location-id>.yaml                the place; the only location-specific config
data/<location-id>/catalogue/*.yaml       stage 1 output — one file per category
data/<location-id>/harvest/<date>/<category>.yaml   stage 2 — one file per category per run
data/<location-id>/harvest/<date>/REPORT.md         what that run found, for a human
data/<location-id>/snapshot.json          compiled for stage 3, served at /<location-id>/
prompts/                                  versioned prompt templates
packages/pipeline/                        schemas (zod) and CLIs
web/                                      React + Vite + shadcn/ui
```

The config filename must equal the `id:` inside it, a catalogue filename must equal its `category:`, and a harvest filename must equal its `date:`. No code path may reach into another location's data.

## The harvest log is append-only

A harvest run file records **what these pages said on this day**, and is never edited afterwards. That is what makes the fold rebuildable: a bug in derivation is fixed by correcting code and re-running, never by editing data.

One file per _run_, not per source and not one file forever. A partial harvest of twenty stale sources produces a file containing twenty observations — which is the truth — with nothing to merge into a previous file. Each file is a batch of rows, which is the shape this wants when it becomes SQLite.

**The harvest log is normalised.** An event knows its `sourceId` and little else; venue name, area and address live in the catalogue. `venue` is set on an event _only_ when it happens somewhere other than the source that listed it (an aggregator advertising a gig across town). Denormalisation happens in `compile` and nowhere else — a copy of a venue's address inside a thousand events goes stale the moment the catalogue is corrected.

Format rule: **YAML for what humans curate** (config, catalogue), **JSONL for what the machine appends** (harvest — pending, currently YAML), **JSON for what the app reads** (snapshot).

## Deriving state — the fold

`lib/fold.ts` folds the run log forward: for each event id, keep the newest observation plus `firstSeen` and `lastSeen`. Everything else is **derived, never stored** — a stored state field drifts out of step the first time anything is re-run.

| state      | meaning                                                      |
| ---------- | ------------------------------------------------------------ |
| `listed`   | in the source's most recent run                              |
| `carried`  | seen before, absent from the latest run, date not yet passed |
| `finished` | its date has passed                                          |

`carried` is the reason the fold exists: a venue listing three months ahead drops a show announced a year out, and a naive "latest run wins" compile would delete it from the site. It is distinct from `status: cancelled`, which is the venue telling us rather than us inferring from silence.

`firstSeen` is also what makes "what's new in theatre this week" answerable.

## Schema versioning

Every data file starts with `schema: <kind>/<version>`. Files are read only through `readArtefact`, which validates against the version the file _claims_, then walks the migration chain forward.

- **Additive and optional** → edit the current version in place. No new version.
- **Anything else** (required field, rename, retype, changed meaning) → add version N+1 plus a migration. **Never edit a released version.**

Migrations are pure functions over plain data — no network, no filesystem, no clock. `defineArtefact` throws at import time if the chain has a hole. New artefact kinds must be registered in `schema/index.ts`; `validate` and `migrate` walk that registry.

## The event schema

`whazzon.harvest/1` is the schema that matters most — an LLM writes into it, so it is `z.strictObject` throughout: an unknown key is an error, never silently stripped.

The load-bearing decision is `occurrence`, a discriminated union rather than a nullable start/end pair:

| kind        | for                                                          |
| ----------- | ------------------------------------------------------------ |
| `single`    | one sitting — gigs, screenings, talks                        |
| `run`       | continuous run between two dates — plays, exhibitions        |
| `recurring` | a pattern stated in words — markets, weekly classes, parkrun |
| `ongoing`   | open-ended — permanent collections                           |
| `undated`   | a real listing with no usable date, with a required note     |

`undated` exists so an extractor never has to invent a date; a guessed date is far more damaging than a recorded absence. `recurring` stops a weekly market becoming fifty-two events and flooding the site.

Other invariants: a failed fetch is still recorded (a silent gap looks identical to "nothing on"), and events cannot be attached to one. Event ids are content-derived (`lib/eventId.ts`) and normalise out decoration like "SOLD OUT", so re-harvesting yields the same ids rather than apparent new events.

## The web app

**Use shadcn/ui components exclusively.** Never a bare `<select>`, `<input>`, `<button>`, `<dialog>` or hand-rolled equivalent — use `Select`, `Input`, `Button`, `Dialog` from `@/components/ui`. Styling is Tailwind utility classes over the shadcn semantic tokens (`bg-background`, `text-muted-foreground`), never raw palette values.

**Add components with the CLI, never by hand:**

```bash
cd web && npx shadcn@latest add <component>
```

Hand-writing a component that exists in the registry is wrong even if it looks identical — the CLI pulls the current canonical source. Config lives in `web/components.json` (style `radix-nova`, base colour neutral).

Other rules:

- Filter state lives in the URL (`lib/filters.ts`), so any view can be linked to or reloaded.
- Snapshots are fetched at runtime from `/snapshots/<id>.json`, not bundled.
- Types come from the pipeline schema via the `@pipeline/*` alias — type-only, so nothing is bundled and the build breaks if the snapshot shape drifts from the UI.
- Scraped copy renders through `<Markdown>`. Never build HTML from scraped text.

## Commands

Prefer the Makefile; `make help` lists everything. The location id is the first argument to every CLI, and may be omitted while only one location is configured.

```bash
make check                     # validate + typecheck + format + test — what CI runs
make dev                       # sync snapshots and run the web app
make build                     # static site into web/dist
make refresh-bristol           # validate, recompile, sync one location
make stale                     # the stage 2 worklist
make check-urls                # are catalogued URLs still real? (network)
make mock                      # regenerate mock harvest data
make <target> LOCATION=<id>    # any target, another location
```

## Skills

Stages 1 and 2 are driven by skills in `.claude/skills/`, both of which fan out
one subagent per category. Ask for them in words:

| skill       | stage | e.g.                                                                      |
| ----------- | ----- | ------------------------------------------------------------------------- |
| `catalogue` | 1     | "catalogue bristol", "add a nightlife category", "find more music venues" |
| `harvest`   | 2     | "harvest bristol", "fan out subagents to crawl for events in bristol"     |

Both must settle a **location** and a **category** (or all of them) before doing
any work — guessing writes into the wrong data directory.

The skills cover orchestration; the extraction contracts handed to subagents are
`prompts/stage1-catalogue.md` and `prompts/stage2-harvest.md`. Keep the split:
orchestration in the skill, what-a-good-record-looks-like in the prompt.

`harvest` never writes to the catalogue — a stale URL comes back as a `notes`
entry for `catalogue` to curate. That handover is how the stages stay separate,
and `npm run drift` turns those notes into a list of verified corrections.

**Every run writes a `REPORT.md` beside its category files**, at
`data/<location-id>/harvest/<date>/REPORT.md`. It records what that harvest
found and what a human needs to decide: catalogue URLs to correct, sources that
could not be reached, venues that look dormant, tag drift. It lives with the run
rather than at the repo root because it describes one day's observations, not
the project — and because the harvest log is the audit trail, so the reasoning
belongs beside the evidence.

`.claude/settings.json` pre-approves `WebFetch` and the npm/make scripts, since a
full harvest is otherwise a permission prompt per source.

## Conventions

- **Prompts are assets, not string literals** — `prompts/`, versioned, with frontmatter. Harvests record which prompt name and version produced them.
- **`hints` on a catalogue source** is the escape hatch that keeps prompt templates general ("books a year ahead, use a long horizon"). Prefer a hint over forking a prompt.
- **A source's `url` is one URL or a list of roled routes** — `listings`, `api`, `feed`, `ics`, `booking`. One must be `listings`; that is what a person is sent to and the only one the snapshot carries. Read it through `lib/routes.ts` (`routesOf`, `primaryUrl`), never by branching on the field's shape. Routes are for a confirmed endpoint, not a guessed one — `/wp-json/tribe/events/v1/events` is exactly the kind of plausible URL a model invents.
- **Location-agnostic by construction.** Anything Bristol-specific belongs in `configs/` or `data/`, never in `packages/` or `web/`.
- **Never invent a URL or an address to fill a field.** Omit it and say so in `notes`. `check-urls` catches wrong URLs; nothing catches a fabricated one that resolves.
- **Do not use `{0,n}` in a grep pattern here.** `grep` is a shell function wrapping ugrep, which builds a DFA eagerly, and a bounded repeat of a wide character class expands it combinatorially. `[a-z0-9./?=_-]{0,60}x[a-z0-9./?=_-]{0,60}` over a 7 KB file does not finish in ten seconds and reaches several GB of RSS; agents scraping saved HTML have twice left multi-GB orphans behind. The same pattern unbounded (`[...]*x[...]*`) runs in 15 ms, and `/usr/bin/grep` handles the bounded form in 10 ms. So: unbounded quantifiers, or `/usr/bin/grep`, or `rg`. Better still, parse HTML with node rather than regex.
- Data under `data/` is committed, snapshot included, and is excluded from prettier — the catalogue's block scalars and the append-only log should not be reflowed.

## Where things stand

**See `STATUS.md`** — which stages have run, what is curated, what is still mock data, and what is next. Keep progress notes there rather than here; this file is for rules that stay true between sessions.

One standing caveat worth knowing before touching data: the harvest directory currently holds generated mock data, not real harvests.
