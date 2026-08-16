# whazzon

What's on, in a place.

whazzon builds a periodically-refreshed catalogue of what is happening in a city
and renders it as a static, filterable website. Bristol, UK is the first
location; adding another is a new config file, not a fork.

## How it works

Three stages that never call into each other. They communicate only through
committed files, so each one can be run, re-run and reviewed on its own.

**1. Catalogue** — _who exists here?_
From nothing but a location config, generate the set of sources worth watching:
venues, festivals, promoters, listings sites. Slow-moving and human-curated.
Runs every few months.

**2. Harvest** — _what's on?_
Visit each source and record what it is showing. One append-only file per
harvest run, never edited afterwards. Each source declares a cadence, and only
sources that are due get visited.

**3. Render** — _show me._
A static site built from the compiled snapshot. No network calls, no LLM calls:
if the page needs something, it must already be in the data.

Between 2 and 3 sits **compile**, which folds the run log into the current
picture — carrying forward events a venue has stopped listing but which have not
happened yet, and marking them as unconfirmed rather than silently dropping
them.

## Layout

```
configs/<location-id>.yaml               the place
data/<location-id>/catalogue/*.yaml      stage 1
data/<location-id>/harvest/<date>.yaml   stage 2 — one file per run, append-only
data/<location-id>/snapshot.json         compiled for stage 3
prompts/                                 versioned prompt templates
packages/pipeline/                       schemas and CLIs
web/                                     React + Vite + shadcn/ui
```

## Commands

`make help` lists everything. The location id may be omitted while only one
location is configured.

```bash
make check              # validate + typecheck + format + test
make dev                # run the web app against the current snapshots
make build              # static site into web/dist
make refresh-bristol    # validate, recompile and sync Bristol
make stale              # what is due a harvest
make check-urls         # are the catalogued URLs real?
make mock               # regenerate mock data for interface work
```

## Deploying

`make build` produces `web/dist` — a static site, no server. It includes a
`404.html` copy of `index.html`, which is what makes deep links like
`/bristol-uk/theatre` work: static hosts serve a file per path, so client-side
routes only resolve if the host falls back to it.

For a GitHub Pages **project** site, assets live under `/<repo>/`:

```bash
make build-pages            # BASE=/whazzon/ by default
make build-pages BASE=/     # root domain or a user/org site
```

## Data format

Every file carries a `schema: <kind>/<version>` header and is read through a
migration chain, so data written today stays readable after the schema moves
on. Adding an optional field is an in-place edit; anything else is a new
version plus a migration. See `packages/pipeline/src/schema/versioning.ts`.

## Status

Stage 1 is catalogued, stage 3 runs, and stage 2 has not yet fetched anything
for real — the harvest directory holds mock data so the interface could be built
against realistic shapes.

See [STATUS.md](STATUS.md) for detail and what is next.
