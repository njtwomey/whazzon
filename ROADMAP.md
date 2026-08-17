# Roadmap

Deliberately short. A holding place for ideas that are worth doing but are not due yet, each
with enough of the reasoning that picking it up later does not mean re-deriving why.

`STATUS.md` says where things stand today. `CLAUDE.md` holds the rules that stay true. This
file is neither — it is the queue.

---

## 1. A source should be able to have more than one URL

**Today** a catalogue source has one `url`, meant to be the page that lists events, plus an
optional `homepage`. Everything else we have learned about how to read that source lives in
prose inside `hints`.

That is now straining. The harvest of 2026-08-17 found that the best route into a source is
very often not an HTML listings page at all:

| source                           | the route that actually works                                  |
| -------------------------------- | -------------------------------------------------------------- |
| `making/bricks-bristol`          | `wp-json/tribe/events/v1/events` — whole diary, with body text |
| `family/windmill-hill-city-farm` | per-shop BookThatApp `schedule.json` — 966 occurrences         |
| `literature/max-minervas`        | Shopify `collections/events/products.json`                     |
| `comedy/hen-and-chicken`         | The Events Calendar REST API with `&categories=comedy`         |
| `sport/parkrun-bristol`          | `images.parkrun.com/events.json` (GeoJSON)                     |
| `sport/gloucestershire-cricket`  | a JSON match API                                               |
| `sport/bristol-cycling-campaign` | a Google Calendar ICS feed                                     |
| `citywide/resident-advisor`      | an unauthenticated GraphQL POST                                |

Four separate agents independently discovered that one JSON call beats reading a dozen pages.
That is a strong signal it belongs in the data model rather than in prose that each agent has
to re-read and re-interpret.

**Shape to consider.** Keep `url` as the canonical human-facing page — it is what the UI links
to and what identity checks should verify — and add an optional list beside it:

```yaml
url: https://www.stanneshouse.org/whats-on/ # what a person should be sent to
urls:
  - role: api
    url: https://www.stanneshouse.org/wp-json/tribe/events/v1/events
    note: whole diary with body text; needs a browser user-agent
  - role: rss
    url: https://example.org/events/feed
```

Roles worth having: `listings`, `api`, `feed` (RSS/Atom), `ics`, `booking`. RSS and ICS are the
interesting ones we are not using at all yet — both are structured, cheap, stable, and common
on exactly the small venues whose HTML is worst.

**What it buys.**

- `check-urls` can verify every route rather than one.
- `stale`/`repointed` can reason about which route changed.
- Prompts stop carrying operational detail that belongs in data.
- The web app could eventually offer "subscribe to this venue" from an `ics` role.

**Schema note.** Adding `urls` as optional is additive, so it edits `whazzon.catalogue/1` in
place. Making it required, or folding `url` into the list, is a rename — that needs version 2
plus a migration, per the rules in `CLAUDE.md`.

---

## 2. `check-urls` should check identity, not reachability

The 2026-08-17 curation found **five lapsed domains serving a healthy 200** to an unrelated
business — `bookhaus.co.uk` (a hog-roast company), `wappingwharf.com` (parked),
`croftersrights.co.uk` and `propyard.co.uk` (the same casino-affiliate network),
`comedybox.co.uk` (a domain marketplace). It also found three sources returning 200 with an
**empty shell**: no listings, no dates, nothing.

`check-urls` passed all eight. It verifies that something answered, which is the least
interesting property a URL has.

**Three cheap checks that would have caught all of it:**

1. Does the source's own `name` (or a distinctive token from it) appear in the body?
2. Does the page contain anything date-shaped at all?
3. Does it match a parking-lander signature — a sub-200-byte redirect to `/lander`,
   `ap:"parking"`, `saw.com`, `hugedomains`?

Worth reporting as three severities rather than pass/fail: gone, wrong, and thin.

---

## 3. Undated events never expire

`stateOf` derives `finished` by comparing an end date against today, so an event with no date
can never reach it. An `undated` row that a source stops listing becomes `carried` and stays
`carried` for ever.

This is not hypothetical: on 2026-08-17 the Harbour Festival was recorded `undated` on the 16th
and dated on the 17th. Because event ids hash the anchor date, the dated row is a _new_ id and
the undated one persists beside it.

**Options, in order of how much they disturb the model:**

1. **Expire by absence** — drop an `undated` event a source has not listed in its last N runs.
   Absence is the only signal an undated listing ever gives, and it needs no id change.
2. **Dedupe at compile on `(sourceId, normalised title)`**, newest wins. Collapses the twins
   exactly, but softens what an event id means.
3. Accept occasional twins.

Leaning to 1. Measure the twin count after a couple more runs before deciding.

---

## 4. Run stage 2 from a scheduled workflow, into a pull request

The harvest is already the shape Actions wants: a matrix job per category, each writing its own
file, then one job to `assign-ids`, `validate`, `compile`, `sync-web`.

The part worth being deliberate about is **what it does with the result**. Not a push to `main`
— a pull request. The machine appends to the log; a human reads the diff and curates stage 1.
That is the existing stage separation expressed as a workflow, and it makes a bad harvest a
closed PR rather than a bad deploy.

Needs an `ANTHROPIC_API_KEY` secret and the Claude Code GitHub Action, since Actions has no
model access of its own. `.scratch/github-actions.md` has the longer write-up.

Two things to get right: a concurrency group so two harvests cannot write the same run
directory, and the run's `REPORT.md` into `$GITHUB_STEP_SUMMARY` so it is readable without
checking out the branch.

---

## 5. Some sources need a browser, not a better URL

Three distinct walls turned up on 2026-08-17, and they want different answers:

- **Radware interstitial** (`nationaltrust.org.uk`) — returns **HTTP 200 whose body is a
  "verifying your browser" page**. A 200 here is not a page, which is its own argument for
  item 2.
- **Cloudflare managed challenge** (`bristol.events.mylibrary.digital`) — mints its token in
  JavaScript, so no header combination clears it.
- **Flat site-wide 403** (`martinparrfoundation.org`) — verified fine with a browser user-agent
  in the morning and refused everything by the afternoon, which looks like an IP-level block
  earned by our own fetch volume.

The counter-lesson, worth remembering before writing anything off: Resident Advisor walls its
HTML and leaves its GraphQL API wide open. **A 403 on the page is not evidence the data is
unreachable.**

If a JS-capable fetch is ever added it belongs in stage 2 and nowhere else — and it should be
opt-in per source, via a hint or a URL role, not the default path for 155 sources.

---

## 6. Curate the findings from 2026-08-17

The URL pass produced a pile of catalogue decisions that are deliberately not code's business.
Recorded here so they do not evaporate:

- **Renames**: `museums/ss-great-britain` → Bristol Dockyards; `music/swx` → Electric Bristol;
  `making/maker-shed` → The Makershed; `sport/great-bristol-run` → AJ Bell Great Bristol Run.
- **Miscategorised**: `making/the-island` programmes dance, circus and wrestling, no making.
- **Duplicated**: `bristol-improv-theatre` exists in both `comedy` and `theatre`;
  `hen-and-chicken` and `the-comedy-box` are the same building; `resident-advisor` and
  `skiddle` overlap heavily on club nights; `gardens/grow-wilder` is a filtered view of
  `gardens/avon-wildlife-trust`.
- **Wrong `area`**: Puppet Place (Spike Island, not Bedminster), Motion (moved to Victoria
  Terrace), Bristol Bike Project (Stapleton Road), Max Minerva's (Henleaze), Blaise Plant
  Nursery (Lawrence Weston), ODEON (Cabot Circus).
- **Wrong `cadence`**: Everyman and Wapping Wharf are fetched far more often than they change;
  the National Garden Scheme publishes a year at once in February.
- **Radius**: Chipping Sodbury parkrun is 16.6 km out, against `radiusKm: 12`. Either widen the
  radius or drop the source.
- **New sources worth adding**: Showcase Bristol Avonmeads, The Prospect Building, Ashton Court
  Mansion, Heritage Open Days, Bristol Shredfest, Exploring Whisky Bristol, and three
  uncatalogued markets (Temple Quay, Whiteladies Road, Windmill Hill).
