# whazzon

What's on, in a place.

whazzon builds a periodically-refreshed catalogue of what is happening in a city
and renders it as a static site. Bristol is the first location; adding another is
a config file, not a fork.

**Live:** [nialltwomey.com/whazzon](https://nialltwomey.com/whazzon/)

---

## How it works

Three stages that never call into each other. They hand over through committed
files, so each can be run, re-run and reviewed on its own.

| stage             | question                   | who does it              | how often        |
| ----------------- | -------------------------- | ------------------------ | ---------------- |
| **1 · catalogue** | who publishes events here? | LLM, then human curation | every few months |
| **2 · harvest**   | what's on?                 | LLM + web fetching       | daily–weekly     |
| **3 · render**    | show me                    | deterministic build      | every deploy     |

```
configs/<location>.yaml                       the place
data/<location>/catalogue/<category>.yaml     stage 1 — sources worth watching
data/<location>/harvest/<date>/<cat>.yaml     stage 2 — append-only observations
data/<location>/harvest/<date>/REPORT.md      what that run found
data/<location>/snapshot.json                 compiled for stage 3
```

Stages 1 and 2 are driven by **skills** — ask for them in plain words and Claude
Code fans out one subagent per category.

---

## The three jobs

### 1. Harvest — the weekly job

The routine one. Visits every source whose cadence has elapsed and records what
its page says today.

> "harvest bristol"
> "fan out subagents to crawl for events in bristol"
> "harvest bristol music" — one category only

What happens: each category agent reads `prompts/stage2-harvest.md`, crawls its
sources, and writes `data/gb-bristol/harvest/<today>/<category>.yaml`. Then:

```bash
npm run assign-ids -- gb-bristol --date <YYYY-MM-DD>   # ids are content hashes
npm run validate   -- gb-bristol                        # must pass
npm run tags       -- gb-bristol                        # vocabulary drift?
npm run drift      -- gb-bristol                        # catalogue corrections
npm run compile    -- gb-bristol                        # -> snapshot.json
```

Or just `make refresh-bristol` for the last three once the harvest has landed.

Check what is actually due first:

```bash
make stale                    # grouped by category
npm run stale -- gb-bristol --ids
```

**After every harvest, read the run's `REPORT.md`.** It lists what needs a human:
stale URLs, unreachable sources, venues that look dead.

### 2. Catalogue — the occasional job

Deciding who is worth watching. Slow-moving, human-curated, and the thing that
determines whether stage 2 finds anything.

> "catalogue bristol" — build from nothing
> "add a nightlife category to bristol"
> "find more music venues in bristol"

Everything a run proposes lands as `status: provisional`. Nothing is trusted
until a human promotes it.

```bash
npm run check-urls -- gb-bristol    # are the catalogued URLs real?
```

Take that seriously — on the first Bristol run, **80 of 155 catalogued URLs were
wrong**, because stage 1 generates plausible URLs from model knowledge. It also
cannot tell a live venue from a lapsed domain that now points at somebody else's
business, so a "200 OK" is not proof the source is still real.

**Applying corrections after a harvest** is the main catalogue chore:

```bash
npm run drift -- gb-bristol              # every URL that harvested from elsewhere
npm run drift -- gb-bristol --markdown   # as a table, for a report
```

Each suggestion was actually fetched during the harvest, so you are verifying,
not searching.

### 3. Add a location

```bash
# 1. describe the place — the filename must equal the id inside
$EDITOR configs/manchester-uk.yaml
```

`character:` is the important field. It is the whole input to stage 1, and a
catalogue built without it returns the same forty obvious venues you would get
for any city. Say what the place is known for and which neighbourhoods have
their own scenes.

Optionally drop a landscape image at `data/manchester-uk/assets/` and name it in
`image:`.

```bash
# 2. build the catalogue
#    ask: "catalogue manchester"

# 3. check what it proposed
npm run validate   -- manchester-uk
npm run check-urls -- manchester-uk

# 4. harvest, then compile
#    ask: "harvest manchester"
make refresh LOCATION=manchester-uk
```

It appears at `/manchester-uk/` with no further wiring — the app discovers
locations from the synced snapshot index.

---

## Adding one source by hand

Faster than a catalogue run when you just want one venue:

```yaml
# data/gb-bristol/catalogue/music.yaml
- id: music/the-new-place # <category>/<slug> — permanent, joins everything
  name: The New Place
  category: music
  kind: venue # venue | festival | aggregator | organiser | listing
  status: provisional
  url: https://example.com/whats-on # the listings page, not the homepage
  area: Stokes Croft
  tags: [independent, grassroots]
  cadence: weekly # daily | weekly | monthly | quarterly
  hints: |
    Books three months ahead. Listings are a Headfirst widget — use
    headfirstbristol.co.uk/whats-on/the-new-place instead.
  addedAt: "2026-08-16"
```

Then `npm run validate -- gb-bristol`.

**`hints` is the important field.** It carries everything specific to that source
— how far ahead it books, where the listings really are, what to ignore — which
is what keeps the shared stage 2 prompt general. Prefer a hint over editing the
prompt.

**`cadence` is a cost decision.** It is what stage 2 spends. `daily` only for
sources that genuinely change daily.

---

## Commands

`make help` lists everything. The location may be omitted while only one exists.

```bash
make check              # validate + typecheck + format + test — what CI runs
make dev                # run the site against current snapshots
make build              # static site into web/dist
make build-pages        # same, for GitHub Pages under /whazzon/
make refresh-bristol    # validate, recompile, sync
make stale              # what is due a harvest
make check-urls         # are the catalogued URLs real?
make drift              # catalogue corrections learned while harvesting
make tags               # tag vocabulary and near-duplicates
```

---

## Rules worth knowing before you edit anything

- **The harvest log is append-only.** Never edit a past run; fix the code and
  re-fold. That is what makes the derived state rebuildable.
- **Stage 2 never writes to the catalogue.** A stale URL comes back as a `notes`
  entry for stage 1 to curate. `npm run drift` collects them.
- **Never invent a date.** `occurrence` is a union — `single`, `run`,
  `recurring`, `ongoing`, `undated` — so an extractor never has to guess one to
  satisfy the schema.
- **Nothing location-specific in code.** It belongs in `configs/` or `data/`.
- **The web app uses shadcn/ui exclusively**, added via
  `cd web && npx shadcn@latest add <component>` — never hand-written.

## Data format

Every file carries a `schema: <kind>/<version>` header and is read through a
migration chain, so data written today stays readable after the schema moves on.
Adding an optional field is an in-place edit; anything else is a new version plus
a migration. See `packages/pipeline/src/schema/versioning.ts`.

## Deploying

Pushing to `main` builds and publishes via GitHub Actions — the workflow
validates the committed data first, so a broken harvest fails rather than
shipping. Nothing built is ever committed.

See [STATUS.md](STATUS.md) for where the project currently stands.
