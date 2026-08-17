# Status

Where the project actually stands. Update this as things move; `CLAUDE.md` is
for durable rules and should not accumulate progress notes.

_Last updated: 2026-08-17_

## Locations

| location     | stage 1                    | stage 2                           | snapshot     |
| ------------ | -------------------------- | --------------------------------- | ------------ |
| `bristol-uk` | 16 categories, 155 sources | 2 runs, 2,066 observations logged | 1,662 events |
| `cork-ie`    | in progress                | in progress                       | —            |

Cork is the second location, and the point of it is that it required no code
change: a config, a catalogue, an asset, and it appears on the landing page. Its
`trad` category — pub sessions, which are most of what Cork does well — exists
only in Cork, which is what "categories are a claim about the place" was for.

## Bristol

### Stage 1 — catalogue

16 categories, 155 sources: 141 provisional, 4 dormant, 10 closed.

**Curated once, on 2026-08-16, and it was a large job.** The first real harvest
found that **80 of 155 catalogued URLs were wrong** — dead paths, moved listings,
five domains that had lapsed to unrelated businesses. Nine agents verified and
corrected them by hand, reconciling three things per source: what the page is
meant to be, what the URL looks like, and what the URL actually serves.

That is the origin of the two rules that now matter most in stage 1: never invent
a URL, and a 200 is not proof.

Outstanding, all listed in `data/bristol-uk/harvest/2026-08-17/REPORT.md`:

- Four renames, one miscategorisation, three duplicate entries, six wrong
  `area`s, three wrong `cadence`s.
- `music/motion` points at an abandoned 2021 build whose API still answers with
  809 events, none of them forward-dated. Needs a URL found by hand.
- Twelve `hints` are now wrong, which matters more than a wrong URL: a bad hint
  sends the next agent down a route that no longer exists.
- Eight new sources worth adding.
- Nothing has been promoted to `active` yet.

### Stage 2 — harvest

Two real runs. **No mock data remains.**

| run          | shape                                       | events | sources |
| ------------ | ------------------------------------------- | -----: | ------: |
| `2026-08-16` | full catalogue, prompt v2                   |  1,095 |     155 |
| `2026-08-17` | only the 94 re-pointed sources, prompt v3/4 |    971 |      94 |

The second run is the one to read: it exists because `npm run repointed` was
written to answer a question `stale` cannot — "whose URL changed since a given
commit?" — which is the right worklist after a curation pass.

It also produced the first `description` values (264 of 971), because prompt v3
allowed a bounded number of event-page fetches where the index was thin. The
first run captured none, which is why the detail view had nothing to show.

Three sources are genuinely unreachable, each for a different reason, and none
fixable with a better URL: a Radware interstitial served as HTTP 200, a
Cloudflare challenge minted in JavaScript, and a site-wide 403 that looks
IP-based and was earned by our own fetch volume. Seventeen more were reached and
legitimately list nothing.

Two model bugs the run exposed, both now fixed in `compile`:

- **Undated events could never expire.** State is derived by comparing an end
  date against today, so an `undated` row a source stopped listing was carried
  for ever — and because ids hash the anchor date, a listing recorded `undated`
  one day and dated the next became two rows side by side. 18 such ghosts
  appeared. Measured before fixing: 92 same-title groups, of which only 18 were
  ghosts and **81 were legitimately distinct** same-title events on different
  dates, which is what killed the title-dedupe option.
- **A re-harvest could discard descriptions.** The fold replaces an event
  wholesale, so one index-only run would have thrown away every event page a
  previous run read. Silence about `description` is no longer a retraction.

### Stage 3 — render

Built and running (`make dev`).

Filterable listing grouped by month, progressive rendering, debounced search,
tri-state facets for category, venue, tags and area, a Show section for price,
listing quality, link presence, carried and finished events, filter state in the
URL, a detail dialog, dark mode.

Finished events are dropped from the snapshot after a fortnight
(`--keep-finished`, default 14). The payload argument does not yet bite — 4 KB of
1,105 KB when it was measured — but the rule is right and the fortnight keeps the
"recently finished" control meaningful.

## Tooling

| command      | what it answers                                                |
| ------------ | -------------------------------------------------------------- |
| `validate`   | schemas, plus the cross-file checks no schema can express      |
| `check-urls` | is every route of every source still reachable (network)       |
| `stale`      | what is due, by cadence                                        |
| `repointed`  | whose URL changed since a git ref — the post-curation worklist |
| `drift`      | what stage 2 learned that stage 1 needs to know                |
| `tags`       | the tag vocabulary, and near-duplicates in it                  |
| `compile`    | fold the log into a snapshot                                   |
| `migrate`    | walk files forward to the current schema                       |

Tag vocabulary: **140 tags across 5,478 uses**, no drift flagged. Cork's first
harvest is told to use Bristol's vocabulary rather than start its own, so a tag
means the same thing in both cities.

116 tests. `make check` runs validate, typecheck, format and test.

## Next

- **Promote Bristol's catalogue to `active`** and work through the 2026-08-17
  report. Nothing is human-approved yet.
- **A second pass over Bristol's music venues.** Seven sources were deliberately
  truncated and it is material: `music/exchange` listed 150 events and 16 were
  taken. Roughly a third of Bristol's gig listings are not in the snapshot, and
  every truncation is declared in its observation's `notes`.
- **Switch the harvest log to JSONL** — one observation per line with a header
  line carrying the schema version. Genuinely appendable, so a run that dies
  part-way keeps what it recorded.
- **AI digests** — one location-wide "what does this week look like" and one per
  category. Must run after the fold (it needs `firstSeen`) and before render
  (which does no LLM work), so it is its own versioned artefact rather than part
  of `compile`, which stays deterministic.
- **Automation** — see `ROADMAP.md` item 4. `make stale` already produces the
  worklist a scheduled job would consume.

`ROADMAP.md` holds the ideas that are not due yet, cross-source de-duplication
being the largest.
