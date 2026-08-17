# Harvest report — gb-bristol, 2026-08-17

A **targeted re-harvest**, not a full run. On 2026-08-16 the first real harvest found that 80
of 155 catalogued URLs were wrong. Those URLs were then verified and corrected by hand, and
this run re-visited **only the 94 sources whose URL changed**, taken from
`npm run repointed -- gb-bristol`. The other 61 sources keep their observations from the 16th,
which the fold merges.

Extraction ran under `stage2-harvest` **version 3**, which adds the optional `description`
field — the event's own page, in full, for the detail view.

## What it found

**971 events from 94 sources**, against 1,095 from 155 sources the day before. Where yesterday
saw nothing at all, it now sees a programme.

| category   | sources | events | with a description |
| ---------- | ------: | -----: | -----------------: |
| music      |      17 |    212 |                  0 |
| theatre    |       7 |    163 |                  7 |
| comedy     |       4 |    128 |                 54 |
| sport       |      7 |     89 |                  7 |
| citywide   |       4 |     78 |                  7 |
| museums    |       7 |     71 |                 47 |
| making     |       8 |     69 |                 25 |
| literature |       6 |     54 |                 33 |
| family     |       4 |     48 |                 38 |
| gardens    |       5 |     23 |                 18 |
| art        |       6 |     16 |                 15 |
| festivals  |       5 |      8 |                  3 |
| markets    |       4 |      6 |                  4 |
| food-drink |       3 |      4 |                  4 |
| outdoors   |       5 |      2 |                  2 |
| cinema     |       2 |      0 |                  0 |
| **total**  |  **94** | **971** |            **264** |

Compiled snapshot: **1,662 events** (1,492 listed, 154 carried, 16 finished) across both runs.

## Sources that could not be reached (3)

Three walls, three different mechanisms, and none of them fixable with a better URL.

| source                       | wall                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `art/martin-parr-foundation` | **403 on every route including the site root.** Verified working with a browser user-agent hours earlier; now refuses plain fetches, a Chrome user-agent, a full browser header set, and a different egress. The body is the site's own styled error template with no challenge markers, so it is the host refusing us — consistent with an IP-level block earned by the day's fetch volume. |
| `citywide/bristol-libraries` | **Cloudflare managed challenge.** The token is minted in JavaScript, so no header combination clears it. |
| `outdoors/leigh-woods`       | **Radware interstitial served as HTTP 200.** "Verifying your browser" in a 118 KB loader page, through WebFetch and curl alike. A 200 here is not a page. |

All three catalogued URLs are correct. What they need is a JavaScript-capable fetch, or in
Martin Parr's case a different network — the **hint** claiming a browser user-agent works is
now the thing that is wrong, not the URL.

The counter-lesson from the morning's curation is worth keeping beside this: Resident Advisor
walls its HTML and leaves its GraphQL API open. **A 403 on the page is not evidence the data is
unreachable.**

## Reached, and legitimately listing nothing (17)

Not failures. Each was read successfully and had nothing to say, and in most cases that is the
page's nature rather than a gap:

- **Council park pages** — `outdoors/ashton-court`, `outdoors/the-downs`,
  `outdoors/blaise-castle-estate`. Correct URLs; they serve car park charges and conservation
  notices. `the-downs` does not contain the word "event".
- **Administrative pages** — `gardens/bristol-allotments` (apply, pay rent, tenancy guide).
- **Between editions** — `literature/lyra-poetry-festival` (ran April 2026, 2027 unannounced),
  `family/puppet-place` (an archive in the past tense between programmes).
- **Out of term** — `theatre/wickham-theatre`, quoting the page: "There are currently no events
  scheduled."
- **Dormant** — `making/bristol-textile-quarter` (its own view JSON reads `"events":[]`),
  `art/grant-bradley-gallery` (still a 2016 exhibition, still carrying injected gambling spam —
  do not harvest).
- **No dated programme published** — `art/upfest-gallery`, `cinema/everyman-bristol`,
  `cinema/20th-century-flicks`, `food-drink/wapping-wharf`,
  `literature/gloucester-road-books`, `music/dareshack`, `music/the-black-swan`.

Each has a `hints` line so the next run does not re-diagnose it.

## What a human needs to decide

### 1. `music/motion` points at an abandoned build

The page loads, is genuinely Motion's, and lists nothing forward. Its Events Calendar API
answers with **809 events, every one between 22 May and 17 Nov 2021**. So `motion-bristol.com`
is a dead build rather than the live programme, and `check-urls` will keep passing it. The site
links `themarblefactory-bristol.com`; the catalogue already notes the October 2025 relocation to
Unit 2 Victoria Terrace. Needs a new URL, found by hand.

### 2. Hints that are now wrong

These matter more than URLs this run, because a wrong hint sends the next agent down a route
that no longer exists.

| source                      | correction                                                              |
| --------------------------- | ----------------------------------------------------------------------- |
| `museums/clifton-observatory` | **The inverse of the Bristol Museums rule** — a Chrome user-agent gets a hard 403, the default fetcher gets 200. Its page title is also a stale plugin artefact reading "Events from 6 June 2021". |
| `art/martin-parr-foundation` | drop the "browser user-agent returns 200" claim; retry from another network before reading it as closed |
| `music/rough-trade`         | no headless browser needed — the streamed payload exposes a DICE widget config, and the DICE partner API returns the whole Bristol programme as JSON |
| `music/the-black-swan`      | the Skiddle fallback names a **different pub** (92 Stoke Lane, Westbury-on-Trym) |
| `making/bristol-hackspace`  | the page lists **one** open day, not two — the second date is the ticket on-sale time |
| `family/windmill-hill-city-farm` | the feed is per-shop (`windmill-hill-city-farm-bristol.bookthatapp.com/availability/schedule.json`); the generic `/calendar/events.json` returns empty |
| `travelling-light`          | shows now print explicit date ranges, so they are `run`, not `undated`  |
| `festivals/bristol-harbour-festival` | the programme page does **not** empty between editions — it still serves 318 slot rows |
| `citywide/uwe-bristol`      | `?a=General+public` cuts 206 rows to 19; `?pageSize=250` returns the diary in one fetch |
| `comedy/hen-and-chicken`    | add `&categories=comedy`; the comedy page paginates at 12 |
| `museums/we-the-curious`    | `/whats-on/events` paginates, and **dates exist only on event pages** |
| `sport/gloucestershire-cricket` | the ground is named "Seat Unique Stadium"; the API envelope says "No matches found" while the data array is full |

### 3. One JSON route beats a dozen page fetches

Four agents independently discovered this, which is why it is now item 1 on `ROADMAP.md`
(multiple URLs per source, with roles):

`stanneshouse.org/wp-json/tribe/events/v1/events` · Windmill Hill's BookThatApp `schedule.json`
· `max-minervas .../products.json` · the Hen & Chicken's Events Calendar REST API ·
`images.parkrun.com/events.json` · a Gloucestershire cricket JSON API · a Google Calendar ICS
feed for Bristol Cycling · Resident Advisor's GraphQL.

Several return each event's **body text alongside its dates**, which is how three categories got
descriptions at no extra fetch cost.

### 4. Coverage deliberately truncated

Declared in each observation's `notes`, and material for music:

| source                | taken | available |
| --------------------- | ----: | --------: |
| `music/exchange`      |    16 |       150 |
| `music/crofters-rights` |  16 |        85 |
| `music/strange-brew`  |    16 |        82 |
| `music/thekla`        |    22 |      ~76 |
| `music/lakota`        |    15 |        36 |
| `music/the-canteen`   |    12 |        28 |
| `citywide/uwe-bristol` |   15 |       206 |

The music venues are the ones worth a second pass — a third of Bristol's gig listings are not
in the snapshot.

### 5. Contradictions recorded rather than resolved

The extractors are witnesses, so where a source disagrees with itself the row carries the
printed value at reduced confidence and the conflict sits in `notes`:

- **St Nicholas Market** — the council says street food is the first Friday of the month, Visit
  Bristol says Tuesdays and Fridays. The farmers' market starts at 8:00 on one page, 9:30 on the
  other.
- **Compost Cafe** (Windmill Hill) — copy says "first Friday of the month", the calendar lists
  last Fridays.
- **Calm Sessions** (Bristol Dockyards) — "Sunday 17th October" against a 17 October that is a
  Saturday.
- **Peter Antoniou** (Hen & Chicken) — the API gives 08:00–17:00 where the Comedy Box says 8pm.
- Price disagreements at the Makershed (£75 vs £65) and Folk House (£5.88 vs £15.88) keep the
  printed text with `min`/`max` omitted.

### 6. Tag vocabulary

**140 tags across 5,478 uses**, up from 136. Four coined, each with a stated justification and
nothing existing that covered it: `away-game` (the complement of `home-game`), `cricket`,
`running`, `open-mic`. No near-duplicates flagged by `npm run tags`.

### 7. Two model problems this run exposed

Both now handled in `compile`, and worth knowing about:

- **Undated events could never expire.** State is derived by comparing an end date against
  today, so an `undated` row that a source stops listing was carried for ever. Because event ids
  hash the anchor date, a listing recorded `undated` on the 16th and dated on the 17th became
  two ids sitting side by side — **18 such ghosts** appeared. `compile` now drops an undated
  event a successfully-read source has stopped listing; 25 rows left out this run.
  Deduplicating on title instead would have destroyed **81 legitimately distinct** same-title
  events on different dates.
- **A re-harvest could have discarded descriptions.** The fold replaces an event wholesale on
  re-observation, so one index-only run would have thrown away every event page a previous run
  read. Silence about `description` is no longer treated as a retraction.

## Numbers worth repeating

- 94 of 155 sources visited; **3 unreachable**, 17 reached with nothing to say.
- 971 events recorded, **264 with a full description** — the first run captured none.
- Snapshot: 1,662 events, 2.0 MB.
- 12 events left out as finished more than a fortnight ago; 25 as undated and no longer listed.
