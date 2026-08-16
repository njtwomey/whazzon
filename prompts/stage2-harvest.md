---
name: stage2-harvest
version: "2"
stage: 2
description: Harvest one category's sources into whazzon.harvest/1 observations.
---

# Stage 2 — harvest a category

You are given a location id, a category, and that category's sources from
`data/<location-id>/catalogue/<category>.yaml`. Visit each source and record
**what its page said today**.

You are a witness, not a curator. You are not ranking, improving or completing
anything. The value of this record is that it is honest about what was there —
including when what was there was nothing, or nothing you could reach.

Stage 2 is the expensive stage. Everything below is shaped by that: fetch once,
take what the listings page gives you, and be explicit about what you left.

---

## 1. Before you fetch

Read each source's `hints`. It is the accumulated knowledge about that specific
source — how far ahead it books, where the listings actually live, what to
ignore — and it exists so this prompt can stay general. Follow it.

Take the worklist from `npm run stale -- <location-id> --ids`, which lists only
sources whose cadence has elapsed. Harvesting a monthly source every day is
just spending money.

## 2. Find the listings, then read them

The catalogued `url` is a starting point, not a guarantee. Some are the real
listings page; some are a homepage; some are a path that has since moved. Your
job is to reach the page that actually lists events.

**Navigate, but cheaply.** Budget roughly **two to four fetches per source**:

1. **Fetch the catalogued URL.** If it lists events, you are done — read it.
2. **If it is a homepage or a landing page**, find the listings from its
   navigation. They are almost always behind one of: _What's On_, _Events_,
   _Programme_, _Diary_, _Calendar_, _Listings_, _Gigs_, _Exhibitions_,
   _Courses_. Follow that link and read it.
3. **If it 404s**, go to the site root and navigate from there. A dead
   `/whats-on/` on a live site is a stale catalogue entry, not a dead venue.
4. **Follow pagination or month-by-month links** while they keep paying —
   usually one or two more pages. Many sites default to "this month" and hide
   the rest behind a next-month link; that is where the forward horizon lives.

Stop after that. If you still cannot find listings, record the fetch as failed
with what you tried — that is a useful result, not a defeat.

**A 403 is not always a wall.** Plenty of hosts refuse an unfamiliar fetcher but
serve an ordinary browser perfectly. Before recording a 403 as a failure, try
once with a browser user-agent:

```bash
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
  (KHTML, like Gecko) Chrome/120.0 Safari/537.36" "<url>" | head -c 40000
```

If that returns real HTML, harvest from it and **say so in `notes`** — the
source wants a hint recording that it needs this route, so the next run does not
rediscover it. If it also fails, or returns a "verifying your browser"
interstitial, then it is a genuine wall: record the failure.

Some sites hide their programme behind a search form or a JavaScript calendar
that returns nothing useful. Two things often work: an `/events` or `/whats-on`
path guessed directly, and the structured data (JSON-LD `Event` blocks) many
ticketing platforms embed. If neither yields anything, say so in `notes`.

**Record the URL you actually harvested** in `fetch.url` — the page you read,
not the catalogued one. If they differ, say so in `notes` so stage 1 can correct
the catalogue.

### Ask for everything in one pass

Navigating between pages is fine; re-reading _the same page_ for a second field
is not. A second fetch of one page to pick up images or prices doubles the cost
of the most expensive stage for no new information. Ask for all of it together:

> For every event listed, give: TITLE; DATES exactly as stated (a single date, a
> date range, "until \<date\>", a recurring pattern, "ongoing", or UNDATED with
> the wording used — never guess); start time(s); price text; the event's own
> link; the URL of its promotional image; and one sentence of the listing's own
> description. Skip logos and decorative images. If nothing is listed, reply
> NO EVENTS.

Two things that otherwise cost you a re-fetch:

- **Resolve relative URLs.** Sites return `/media/thumbnails/x.jpg`. Prefix the
  site root, or the image will not load.
- **Listings often omit the year.** "08 Mar" on a page you are reading in August
  means the following March. Infer it from the page's own ordering.

  **Then check the weekday.** Most listings print one — "Fri 4 Sep". If 4
  September really is a Friday in the year you inferred, the inference is
  confirmed and the row is `confidence: high`. If it is not, you have the wrong
  year. Where no weekday is printed, the inference stands unverified and the row
  is `confidence: medium`.

## 3. How deep to go

Good coverage of forty venues beats perfect coverage of one.

- **Do not open each event's own page.** Navigating _to_ the listings is worth
  a fetch or two; visiting forty individual events is not. The listings page
  carries enough for a card — deep-link and let the reader go there.
- **A multiplex is not worth 200 rows.** Where a source lists the same
  mainstream release forty times, take the special events — previews, Q&As,
  event cinema, festival strands — and leave the routine screenings.
- **A large aggregator is allowed to be partial.** Take its best few dozen.

Whatever you skip or truncate, say so in that observation's `notes`. A recorded
limit is honest; a silent one is a lie about coverage.

## 4. Never invent a date

`occurrence` is a discriminated union precisely so you never have to:

| kind        | when                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| `single`    | one sitting — a gig, a screening, a talk                                                   |
| `run`       | ends on a known date; `start` optional, omit it when the page says only "Until Thu 20 Aug" |
| `recurring` | repeats on a pattern; put the pattern in the source's own words                            |
| `ongoing`   | open-ended — a permanent collection                                                        |
| `undated`   | a real listing with no usable date; `note` records what it said instead                    |

A guessed date is far more damaging than a recorded absence, because it looks
correct. "Coming autumn 2027" is `undated` with that note — not a date.

Two rules that follow from how events are identified:

- **Several showings on one day are one event.** A film at 15:00 and 20:00 on
  Friday is one `single` for Friday with both times in `timesText`. Separate
  rows duplicate the card and collide on id.
- **Never expand a recurring event into dates.** A weekly market is one
  `recurring` event, not fifty-two.

Times are local wall-clock as printed: `19:30`, never `7.30pm`, never UTC.
Times that vary across a run go in `timesText` verbatim — parsing them reliably
is not worth the wrong answers.

## 5. Record failures

```yaml
- sourceId: theatre/example
  fetch:
    {
      ok: false,
      url: "https://...",
      status: 503,
      error: "host returned an error page",
    }
  events: []
```

A silent gap is indistinguishable from "this venue has nothing on", which is why
a failure is written down rather than skipped. Never attach events to a failed
fetch. A successful fetch listing genuinely nothing is also a real result:
`ok: true` with an empty `events`.

**Feed a broken URL back to stage 1.** A catalogued `/whats-on` path that 404s
while the site's root is fine is a stale catalogue entry, not a dead venue.
Record the failure, then say so in `notes` with the URL that did work:

```yaml
notes: >-
  /whats-on/ returns 404; the listings now live at /events/. Catalogue URL
  needs updating.
```

Do not fix the catalogue yourself — stage 1 is curated, and stage 2 writing to
it would break the separation. The note is the handover.

## 6. Do not copy the catalogue into the event

The event knows its `sourceId`. Venue name, area and address live in the
catalogue and are joined on at compile time; a copy inside a thousand events
goes stale the moment the catalogue is corrected.

Set `venue` **only** when the event happens somewhere other than the source that
listed it — an aggregator advertising a gig across town, a festival in borrowed
spaces. Prefer `venue.sourceId` when that venue is itself catalogued; fall back
to `venue.name` when it is not.

## 7. Fields that carry the weight

**`raw` and `summary` are both markdown, and both matter.** `raw` is the listing
as the venue wrote it — links and emphasis intact, not tidied, not shortened,
never HTML. `summary` is your own sentence or two: what it is and why someone
might go. It fills the card, so it must be informative — not a truncation of
`raw`, not marketing copy echoed back.

**`tags` describe the event; the category describes the source.** A cinema's
programme holds a subtitled matinee, a director Q&A and a late-night horror;
only tags tell them apart, and they are what the interface filters on.

- Lowercase kebab slugs, two to five per event.
- **Reuse tags already present in this location's harvests.** Get the current
  vocabulary before you start:

  ```bash
  npm run tags -- <location-id> --list
  ```

  A vocabulary that drifts — `family`, `family-friendly`, `for-families` — is
  useless for filtering, and this is the single easiest thing to get wrong.
  Coin a new tag only when nothing existing fits.

- Tag form (`stand-up`, `exhibition`, `workshop`), audience (`family`,
  `beginners`, `18-plus`), and practicalities worth filtering on (`free-entry`,
  `outdoor`, `booking-required`, `subtitled`).
- Do not restate the category, and do not tag the venue, date or price — those
  are fields.

Use `subcategory` for the source's own classification ("Live Music", "Family
Shows"), verbatim.

**`status`** is what the venue says — `sold-out`, `cancelled`, `postponed` —
never your inference. **`price.free`** is set deliberately, not inferred from a
missing price; keep the printed text in `price.text`, since "£12 / £9
concessions" carries more than a number. **`confidence: low`** is a legitimate
and useful answer when the page was ambiguous; silently guessing instead is the
one thing you must not do.

## 8. Output

Return a list of `observations` — one per source you visited:

```yaml
- sourceId: cinema/the-cube
  fetch: { ok: true, url: "https://www.cubecinema.com/programme/", status: 200 }
  notes: Programme mixes film, music and talks; classified per event.
  events:
    - sourceId: cinema/the-cube
      title: Kelly Moran
      occurrence: { kind: single, date: "2026-09-22", startTime: "20:00" }
      status: scheduled
      url: https://www.cubecinema.com/programme/event/kelly-moran/15512/
      image: https://www.cubecinema.com/media/diary/thumbnails/KM_Pianos.png
      price:
        {
          free: false,
          text: "£14 / £12 advance",
          min: 12,
          max: 14,
          currency: GBP,
        }
      tags: [live-music, electronic, experimental]
      raw: |
        **Kelly Moran (Warp Records)** — Tue 22 September, 20:00.
        With support from Minor Conflict & Maes Y Circles.
      summary: Warp pianist and composer Kelly Moran, with two support acts.
      confidence: high
```

Omit `id` — it is a hash of source, title and anchor date, filled in afterwards.

**Do not write the run file yourself.** There is one file per run,
`data/<location-id>/harvest/<YYYY-MM-DD>.yaml`, and category agents run in
parallel; concurrent writers would clobber each other. Return your observations
and let the orchestrator assemble them.

## 9. Assembling a run

Sources are independent and nothing about one venue informs another, so a full
harvest is naturally **one agent per category**. Once every category has
returned, the orchestrator:

```bash
# 1. writes all observations into the single run file for the date, then
npm run assign-ids -- <location-id> --date <YYYY-MM-DD>
npm run validate  -- <location-id>
npm run tags      -- <location-id>   # check the vocabulary has not drifted
npm run compile   -- <location-id>
```

The schema is strict: an unknown field is an error, not something quietly
dropped. If validation fails, fix the data — never widen the schema to
accommodate a sloppy extraction.
