# Harvest report — gb-bristol, 2026-08-28

**The August bank holiday run.** Friday 28 August, with Saturday 29, Sunday 30
and **Monday 31 August** — the UK summer bank holiday — ahead of it.

| | |
| --- | --- |
| sources visited | 128 (of 155 harvestable) |
| observations | 128, in 18 category files |
| events recorded | 2,774 |
| failures | 6 |
| snapshot after compile | 3,637 events — 2,908 listed, 465 carried, 264 finished |
| **live over 29–31 August** | **509** — 373 Sat, 310 Sun, **248 on the bank holiday Monday** |
| tagged `bank-holiday` | 61 |

## Why this run is shaped the way it is

`npm run stale` said 67 sources were due. That worklist is right for an ordinary
day and **wrong for a long weekend**, because the categories that only come alive
on a bank holiday are the ones with the slowest cadences. 61 sources were pulled
in ahead of cadence for that reason:

| category | cadence | due | harvested |
| --- | --- | --- | --- |
| festivals | quarterly | 0 | 14 |
| making | monthly | 0 | 11 |
| museums | monthly/quarterly | 0 | 10 |
| gardens | monthly/quarterly | 1 | 8 |
| markets | monthly | 0 | 5 |
| family | monthly | 0 | 5 |
| outdoors | monthly/quarterly | 0 | 5 |
| food-drink | monthly | 1 | 5 |

The catalogue itself made the argument. `festivals/forwards` carried a note
recording its lineup under "Saturday 29 and Sunday 30 August" — **this weekend** —
against a quarterly cadence that would not have looked at it until October. That
one entry justified the override, and the override then paid for itself several
times over: **museums alone contributed 45 of the weekend's events** from a
category that was not due for another fortnight.

Every agent was told the same three things beyond the standard contract:

1. **29–31 August may not be truncated.** The prompt lets a large source be
   partial; for this run that window came first and whole, and any cut had to
   fall on the far future instead.
2. Look for what an ordinary run misses — late-published holiday programming,
   altered hours and Monday closures, aggregator "what's on this bank holiday"
   roundups, and the Sunday that behaves like a Saturday.
3. One new tag, `bank-holiday`, mandated centrally so eighteen agents could not
   coin eighteen variants of it — **and only where the listing itself ties the
   event to the holiday**, never because an event merely falls in the window.

## What is actually on

**Forwards Festival, Saturday 29 and Sunday 30, Durdham Down.** Confirmed from
`/faqs`, which prints the year that `/lineup` does not: doors 12:00, last entry
20:00, all ages. Two changes since 2026-08-17 — prices are now published (weekend
from £134.30, days from ~£72), and **Sunday has quietly lost an act**: Jim
Legxacy was on the bill on the 17th and is not printed today, with no cancellation
notice. Both observations are in the log; nothing was edited.

**The Old Duke's annual Jazz Fest** is the find of the run. Four two-hour sets a
day at 12:00, 15:00, 18:00 and 21:00 across all three days — twelve free events
against its usual one gig a night, and the venue's own copy ties it to the holiday.

Other genuinely bank-holiday-billed programming: the **Aquarium's Conservation
Carnival Bank Holiday Bonanza** (29–31); **Bristol Zoo Project's Aardman Summer
Special** (28–31, with the year pinned in the T&Cs); **Blaise Castle open
afternoons** on Sunday and Monday; **M Shed's steam train rides** adding the
Monday to a weekends-only service; the **East Bristol Brewery Trail's
10th-anniversary weekend** at Wiper and True with a soundsystem on Saturday and a
dub all-dayer on Sunday; **bank holiday shows at the Fleece** on both Sunday and
Monday (the Monday with "special Bank Holiday Monday early stage times"); a
**Bank Holiday Sunday special at Strange Brew**; and a raft of Sunday club nights
on Resident Advisor and Eventbrite programmed as Saturdays.

**Altered hours, recorded only where printed.** Wiper and True publishes explicit
holiday hours at both venues (Old Market opens 12:00 instead of 16:00; the Barrel
Store opens at all, on a day it is normally shut). We The Curious prints its rule
outright — "Bristol school holidays and bank holidays: Monday to Sunday". Blaise
Plant Nursery gives bank holidays their own line. And **St James' Priory is shut**:
"THE CHURCH IS CLOSED ON GOOD FRIDAY AND BANK HOLIDAY MONDAY". None of these are
events, so they live in observation `notes`.

**Where the bank holiday is not.** Markets: not one of five mentions it, checked
against raw HTML rather than summarised text. Theatre: no venue bills anything as
a holiday show, though the Hippodrome adds a Saturday matinee and the Improv
Theatre runs a free Monday showcase. Gardens: the premise was wrong — NGS
openings cluster in spring, and ten of the fourteen Bristol gardens opened say in
terms that they have finished for the year. Sport: **there is no bank holiday
Monday fixture round**; both football clubs jump from Saturday to a midweek round
on Tuesday 1 September, confirmed on two independent sites.

Two false positives were caught and refused, and both deserve recording because
they are the shape of mistake this tag invites:

- **ODEON tags the whole of Monday 31 August "Saver"** — which also appears on
  Mondays 7 and 14 September and 12 October. Standing Monday pricing, not a
  holiday offer. Not tagged.
- **The Island's "no class 31/08"** notices *were* tagged, in the inverse sense:
  the listing ties itself to the holiday, and a reader checking Monday needs to
  know a class is cancelled as much as they need to know one is on.

## Sources that failed (6)

Five are bot walls and one is a dead domain. **None is fixable with a better
URL**, and none was worked around — getting past bot detection is not something
this pipeline does.

| source | what happened |
| --- | --- |
| `churches/clifton-cathedral` | Cloudflare block: 403 to a plain fetch, to a Chrome UA, **and to a real browser session**. Its hint claims this is a JS problem; it is not. Correct the hint. |
| `theatre/alma-tavern-theatre` | Ticket Tailor now serves a Cloudflare "Just a moment…" challenge. **A real gap, not a dark venue** — August's run took 52 listings here. |
| `making/bristol-hackspace` | Same platform, same challenge. The hint saying a browser UA gets a 200 is now wrong. |
| `museums/clifton-observatory` | 403 on both `/events/` and the site root, with a browser UA. Read fine on 2026-08-17, whose note records a **Maker Market on 31 August** this run could not confirm — it will show as `carried`. |
| `education/bristol-ideas` | Cloudflare interstitial. See the contradiction below; this source may not exist any more. |
| `food-drink/bristol-whisky-festival` | `getaddrinfo ENOTFOUND` — dead host, not a block. Unchanged since 2026-08-17; already a human call. |

## Catalogue work for stage 1

Nothing below was written to the catalogue. Each is a `notes` handover, and
`npm run drift` lists the URL changes with the fetch that proved each one.

### The catalogue contradicts itself

- **Bristol Ideas is catalogued twice with opposite answers.** `literature/bristol-ideas`
  is `closed`, carrying the organisation's own "Bristol Ideas closed 30 April 2024".
  `education/bristol-ideas` is `provisional`, pointing at the same host. If the
  closed one is right, the autumn festival-of-ideas season this run went looking
  for does not exist. Settle it.
- **`music/motion` may have closed.** Reachable but genuinely empty: filter tabs
  only, its Events Calendar API returns zero forward events, its iCal export is a
  zero-byte file, and `themarblefactory-bristol.com` no longer resolves. The
  venue's own `/leaseexpiration/` page carries a closing statement dated
  **30.07.2025**. The 2021-era backlog behind that API was correctly not recorded.
  Needs a listings route or a `dormant`/`closed` status.
- **`food-drink/wiper-and-true` is one source describing two buildings**, and it
  affects all 23 of its events. Catalogued as "Barrel Store" with `area: Old
  Market`; the site runs The Taproom, Old Market (BS5 0SP, actually Easton, 19
  events) and The Barrel Store, St Werburghs (BS2 9XT, 4 events). The name and the
  area name different premises. `venue` was left off every event rather than
  guess. **This wants splitting into two sources.**

### A 200 that is not the listings page

Three entries answer 200 while serving something that is not the diary — the
failure mode `check-urls` cannot see:

- **`theatre/bristol-improv-theatre` / `comedy/bristol-improv-theatre`** (found
  independently by two agents). The site is now Blazor; the catalogued
  `?filter=Events` path returns a six-show homepage carousel. The real programme —
  27 shows — is at **`https://improvtheatre.co.uk/events/?filter=Events`**. `www`
  301s to the apex.
- **`literature/gloucester-road-books`.** `/events/` returns 200 and serves the
  **past** season only, which is why previous harvests read nothing from it. The
  shop's own nav points at **`/events-listings/`**, which carries the autumn
  programme. Not a dormant shop — a one-path-out-of-date entry.
- **`citywide/headfirst`.** The catalogued homepage is a marketing shell; the
  listings are at `/whats-on/this-weekend` (91 server-rendered rows). Note it
  covers **Friday–Sunday only** and has nothing for the Monday; no date-addressable
  URL exists behind its JS calendar.

### Routes worth adding

Each was confirmed on the wire, not guessed:

| source | route |
| --- | --- |
| `music/o2-academy` | `api` — `academymusicgroup.com/api/search/events?VenueIds=4114,4574…&PageSize=200`, whole 73-event diary in one call. Found by driving a browser and reading the request it made. |
| `sport/bristol-city` | `ics` — the page's own "ADD ALL" button: `/wp-json/afz/v1/fixtures/ical/upcoming/men`, whole remaining season with kick-offs and grounds. |
| `citywide/visit-bristol` | **the fix for this source.** `/whats-on/search-results/?filter_daterange[start]=…&filter_daterange[end]=…&skip=N`, read with headless Chrome **and a normal Chrome UA** — Chrome's own headless UA gets an Akamai "Access Denied". `/whats-on/` is the wrong target: lazy-loaded on scroll, never fires under `--dump-dom`. |
| `churches/st-mary-redcliffe` | `api` — Tockify: `tockify.com/api/ngevent?calname=stmaryredcliffeevents&startms=…&endms=…`. Whole forward diary in one fetch; carries no per-event URL or image. |
| `making/bricks-bristol` | `/whats-on/list/?tribe-bar-date=YYYY-MM-DD` (the catalogued grid is 1.37 MB for the same data), plus an ICS feed at `/whats-on/?ical=1`. |
| `cinema/the-cube` | `feed` — `cubecinema.com/programme/rss/`, advertised on the page. |
| `family/windmill-hill-city-farm` | `products.json?limit=250` — prices, body text, images, the farm's own tags. |
| `family/childrens-scrapstore` | `/free-events?format=json-pretty` — whole collection with body text in one fetch. |
| `making/bristol-bike-project` | `booking` — `bookwhen.com/bristolbikeproject` is the **only** place any date exists. It is where Saturday's maintenance intensive was found. |
| Headfirst venue pages | embed a JSON-LD `MusicEvent` array with doors, ages and prices **in pence** — cheapest route for `music/exchange`, `music/strange-brew`, `literature/bookhaus`. |

### Hints that are now wrong

- `citywide/bristol-live` — hint says the host answers 202 with an empty body and
  "no URL will fix it". A Chrome UA returned 200 and 941 KB of real HTML today.
- `citywide/resident-advisor` — hint says the wall does not cover the API. It now
  does: `POST /graphql` needs a Chrome UA plus `Referer` and `Origin` headers.
- `music/the-gallimaufry` — `/whatson` now **301s to `/whats-on/`**, the opposite
  of the hint, and the calendar is maintained again (JSON-LD to 25 Nov). The
  advice to prefer `recurring` over stale dated entries should be dropped.
- `outdoors/leigh-woods` — the Radware interstitial was not firing today, and
  behind it the catalogued `/whats-on` path is a genuine 404. The block was hiding
  a wrong URL.
- `comedy/hen-and-chicken` — the "ignore the stale `<title>`" hint can be retired;
  it now tracks the view.
- `music/rough-trade` — understated: a browser UA returns 200 with **zero**
  listings. The DICE widget is client-side; a headless browser is the only route.
- `music/dareshack` — now 403s to a browser UA with a bot-check body, not the
  single-page site the hint describes.
- `churches/st-james-priory` — the hint says it programmes lunchtime concerts.
  **There is no music programme anywhere on the site.** Its `classical` tag needs
  verifying.
- `music/the-black-swan` — the Skiddle cross-check in the hints points at
  `/The-Black-Swan/`, **a different pub in Westbury-on-Trym**. The Stapleton Road
  venue is `/Black-Swan/`.

### Cadence

- **`food-drink/wapping-wharf` is weekly and should be monthly** — second
  consecutive run returning zero from a news feed whose newest post is dated 17 June.
- **`gardens/bristol-allotments`**: three consecutive harvests, zero events. The
  page is purely administrative. Whether it stays a source is a stage 1 call.
- `festivals` at quarterly is defensible most of the year but was wrong this week.
  Consider a seasonal bump, as `festivals/bristol-harbour-festival` already hints.

### Sources worth adding

Named repeatedly across the weekend and absent from the catalogue: **The Clock
Factory** (18 events on RA alone), **The Love Inn** (8), Moon Club, Lost Horizon,
Sawmills, The Crown, **Prospect Bristol** and **Electric Bristol** (formerly SWX),
Spirited, Mivart Studios, Glenside Hospital Museum, Coppa Club, OMG, Totos by the
River. Also four markets Visit Bristol lists that we lack: Bristol Flea, Temple
Quay, Whiteladies Road, Windmill Hill.

## Coverage, honestly

**The 29–31 August window was taken whole everywhere.** Every truncation below
falls outside it and is declared in its own observation's `notes`.

- **`music/exchange` went from 16 events to all 150** — the coverage failure
  named in the 2026-08-17 report is fixed. The Fleece, the Louisiana, Strange
  Brew, St George's, Thekla, Lakota and the O2 Academy are all complete; only the
  Beacon and the Fleece are partial, and only in the far future.
- **Arnolfini's link trap is closed**: 33 of 33 rows carry an href taken verbatim,
  including `/whatson/latinasinbristol-2/` and `/whatson/adultlifedrawing/` for
  "Life Drawing". Last run dropped 7 of 16.
- **Eventbrite was deliberately re-run deeper.** The first pass sampled 2 of 49
  weekend pages; the second walked to page 9 and stopped where the marginal return
  flattened into weekly wellness classes already represented several times over.
  Weekend coverage went 23 → 52 events, and the deeper pages found **three more
  genuinely bank-holiday-billed events the sample had missed**. 40 pages remain
  unread of 988 raw rows; of 308 rows read, 209 were discarded — but 168 of those
  were simply not in Bristol.
- **Visit Bristol was re-run through a browser.** Its RSS caps at 30 events
  alphabetically and stopped at F, so the entire G–Z tail of the weekend was
  invisible. 41 → 114 events, 73 new, all inside the window — including things no
  other source carried (Arnos Vale bug hunts, the Open Canvas Art Festival on the
  Monday, Upfest street-art tours, a cathedral tower tour).
- Multiplex rule held: Vue and ODEON contributed only labelled strands, not 200
  routine screenings.
- Far-future cuts: Croft to 30 Sep, Rough Trade to 30 Sep, SWX to 27 Oct, Redgrave
  and Trinity dropped 2027, RA dropped October, Skiddle dropped Oct 26–Jul 27.

## Tag vocabulary

**145 tags across 12,409 uses. Exactly one tag was coined — `bank-holiday`, 61
events — and nothing was dropped.** Eighteen agents, no drift. Mandating the slug
centrally rather than letting each agent decide is what did that.

## Things a human should decide

1. **Settle Bristol Ideas** — the two entries contradict each other.
2. **Settle `music/motion`** — closing statement dated July 2025.
3. **Split `food-drink/wiper-and-true`** into its two venues; 23 events hang on it.
4. **Four sources now need a real browser, not a user-agent**: `citywide/visit-bristol`
   (route recorded above), `music/rough-trade`, `cinema/everyman-bristol`,
   `cinema/vue-cribbs-causeway`. This is becoming a category of its own and may
   deserve a `route` role or a hint convention.
5. **Region bleed is worse at depth.** Roman Baths, Bishop's Palace at Wells,
   Westonbirt, Cheddar Gorge, Wookey Hole, Sudeley Castle, Go Ape Forest of Dean,
   the Grand Pier and Slimbridge all arrived through the aggregators, kept with
   venue names and flagged in their summaries rather than silently dropped. Two of
   them are in the `bank-holiday` set. An `addressLocality` filter deserves a hint
   on `citywide/visit-bristol`, `citywide/skiddle` and `citywide/eventbrite`.
6. **Cross-source duplication is now visible enough to matter.** Compile scored
   401 rows as duplicates of 340 events. Forwards appears four times and one Clock
   Factory rave five, from five different aggregators. `ROADMAP.md` already holds
   cross-source de-duplication as the largest open item; this run is the argument
   for it.
7. One row needs a human eye: Visit Bristol prints "Spring Bulb Planting Workshop
   at Badminton Estate" as `23 Oct 2026 - 30 Aug 2026`, a range ending before it
   starts. Recorded `undated` at `confidence: low` rather than guessing which end
   is the typo.
