# Harvest report — gb-bristol, 2026-09-11

**72 observations, 2,323 events, 3 failures**, across 16 category files. Prompt
`stage2-harvest` v5, model `claude-opus-5`, 17 subagents (music split in two).

The first run with the mailbox as a second input channel. `npm run mail` pulled
71 messages, all attributed (24 sources now carry a `mail:` binding), and 11
categories had a mail file for their subagent to read before fetching anything.

## What the mailbox added

| | |
| --- | --- |
| Observations `via: mail` (source not due a fetch) | 8, carrying 26 events |
| Events a fetched source got only from its newsletter | ~18 (Bristol Beacon 11, Watershed 3, Bristol24/7 4) |
| Rows enriched from a newsletter (times, prices, access dates) | ~35 (St George's ~25, Old Vic / Tobacco Factory / Wardrobe access performances, Arnolfini times) |

The clearest case is **The Island**: six September events — an exhibition, an
open studios weekend, two classes, a UN 80th anniversary show at an uncatalogued
second venue — from a newsletter, for a source that was not due and whose site
would not have been visited this run. **Spike Island** and the **RWA** likewise:
ten events between them, neither due.

Three newsletters carried nothing a fetch did not already have (Old Vic,
Tobacco Factory, Wardrobe), which is also worth knowing: for the big theatres
the site is the fuller record and mail is a supplement. **Aerospace Bristol**,
**Love Saves the Day** and **Forwards** produced empty `via: mail` observations
— a welcome mail and two ticket-link mails with no dated events. They are
recorded because they were read, and the fold now treats them correctly (below).

## Two derivation bugs found by this run, fixed in code

Both were caught by subagents reading the mail files, and both would have made
every future mail-inclusive run quietly wrong.

1. **`fold.ts` bumped `lastHarvest` on a mail observation.** A welcome email
   with no listings would have flipped every event the last web harvest saw —
   and the email happened not to mention — to `carried`. Mail observations now
   contribute their events without standing in for a look at the programme,
   and `stateOf` uses `>=` so an event a newsletter refreshed after the last
   web harvest is `listed`, not `carried`. Tests added.
2. **Campaign Monitor carries the recipient id in the URL path and the
   Message-ID**, not the query string, so the pull's redaction missed it. Both
   are now scrubbed to `RCP0`; the Message-ID stays a stable dedup key because
   the scrub is deterministic. Mailchimp click-tracking wrappers are also now
   resolved to their real target, so mail-sourced event `url`s are venue pages
   rather than tracking hops. Tests added. Today's mail files were re-pulled
   after the fix; nothing had been committed.

## Per category

| category | sources | events | via mail | failed |
| --- | ---: | ---: | --- | ---: |
| art | 4 | 48 | 2 (10 events) | — |
| churches | 2 | 50 | — | — |
| cinema | 5 | 186 | — | — |
| citywide | 8 | 292 | — | — |
| comedy | 3 | 93 | — | — |
| education | 4 | 12 | — | 1 |
| family | 1 | 5 | 1 (5 events) | — |
| festivals | 2 | 0 | 2 (0 events) | — |
| food-drink | 1 | 0 | — | — |
| gardens | 1 | 16 | — | — |
| literature | 4 | 43 | — | — |
| making | 1 | 6 | 1 (6 events) | — |
| museums | 1 | 0 | 1 (0 events) | — |
| music | 20 | 1,059 | — | 1 |
| sport | 4 | 102 | — | — |
| theatre | 11 | 411 | 1 (5 events) | 1 |

## Failures (3)

| source | why | since |
| --- | --- | --- |
| `music/rough-trade` | Cloudflare "you have been blocked" served to headless Chrome, which worked on 28 Aug. Curl gets 200 but only the DICE widget config. | new |
| `theatre/alma-tavern-theatre` | Ticket Tailor returns a Cloudflare JS challenge to the browser-UA retry. The hint saying a UA is enough is stale. | 28 Aug |
| `education/bristol-ideas` | Same bot interstitial as the last two runs. Its surviving strand (Festival of Economics) now appears in the University's own calendar; candidate for `status: closed`. | 16 Aug |

None bypassed. A "verifying your browser" page is a recorded failure.

Compile: **4,328 events from 165 sources over 4 runs (2,730 listed, 786
carried, 812 finished, 18 failing)**.

## Catalogue work for stage 1

`npm run drift -- gb-bristol --date 2026-09-11` lists 29 sources with
findings; the ones that matter, each verified by a successful fetch:

**URLs that have moved**

- `music/the-fleece` — `www.thefleece.co.uk/events/` now 404s; listings are `https://thefleece.co.uk/whats-on/` (paginated `/page/N/`)
- `music/bristol-beacon` — `/whats-on/` is curated carousels; the diary is `/whats-on-all/` (14 pages)
- `literature/gloucester-road-books` — `/events/` is last season's page; live listings are `/events-listings/` (repeat of 28 Aug)
- `comedy/bristol-improv-theatre` and `theatre/bristol-improv-theatre` — `?filter=Events` on the homepage; real diary is `/events/?filter=Events` on the apex host (repeat of 28 Aug)
- `theatre/bristol-hippodrome` — 301s to `/venues/bristol-hippodrome/whats-on/`
- `theatre/redgrave-theatre` — `www.` redirects to the apex
- `music/the-gallimaufry` — `/whatson` 301s to `/whats-on/`; the hint says the reverse
- `theatre/circomedia` — apex redirects to `www.`

**Confirmed structured routes worth adding** (each returned real data this run)

- `sport/bristol-city` — `ics`: `/wp-json/afz/v1/fixtures/ical/upcoming/men` — the page's own "add all" button; 41 fixtures where the page shows 9
- `theatre/wardrobe-theatre` — `api`: `/wp-json/wp/v2/shows?per_page=100` (whole diary to May 2027; `_embed=wp:featuredmedia` for images)
- `churches/bristol-cathedral` — `api`: Tribe REST `/wp-json/tribe/events/v1/events`, filter `categories=` by slug, exclude `services`
- `churches/st-mary-redcliffe` — `api`: the Tockify endpoint (repeat of 28 Aug; detail-page and image URL patterns now in the notes)
- `art/arnolfini` — `api`: `/wp-json/wp/v2/event?per_page=100` — links and excerpts, no dates; supplements the index
- `comedy/hen-and-chicken` — `ics`: `/?post_type=tribe_events&tribe_events_cat=comedy&ical=1&eventDisplay=list`
- `music/thekla` — later months load via a POST to `wp-content/themes/dhp/includes/ajax/ajax_guide.php`; wants a hint

**Hints now wrong**

- `music/o2-academy` — root shows ~22 featured cards; `/events?Page=N` renders in headless Chrome
- `music/rough-trade` — the `self.__next_f` payload no longer carries listings
- `education/wea-bristol` — plain fetch now hits a Cloudflare challenge; a browser UA gets through
- `education/university-of-bristol` — the Timely calendar in the hint is harvestable but needs a JS render; `/events/` still renders nothing
- `citywide/bristol-live` — "don't spend a slot" should be "browser UA works"
- `citywide/resident-advisor` — needs `Referer`/`Origin` headers as well as a UA
- `citywide/skiddle` — region bleed this run is Swansea, not Bath/Newport
- `theatre/alma-tavern-theatre` — a UA is no longer enough (see failures)
- `comedy/hen-and-chicken` — the stale-`<title>` hint can be retired

**Sources worth adding** (named in observation notes)

- **Sparks Bristol** (78 Broadmead) — Artspace Lifespace's second venue, with its own programme
- **The Station** (Silver Street) — literature events land there
- Club programme venues the aggregators keep surfacing: Clock Factory, Love Inn, The Crown, The Croft, Moon Club, Jam Jar, Cosies, Sawmills, Lost Horizon, DOCUMENT, The Gaffe
- `economicsfestival.co.uk` — the Festival of Economics, if Bristol Ideas is closed

**Dormant or gone**

- `music/dareshack` and `music/the-black-swan` — three consecutive empty runs each
- `music/motion` — site lists nothing anywhere (page, ICS, Tribe REST); RA may be the only live source
- `education/bristol-ideas` — see failures

**Data the reviewer should weigh**

- `sport/bristol-city` and `education/university-of-bristol` will show as "moved" in drift because they were harvested from a route the catalogue does not list. Both are handovers, not errors.
- `family/childrens-scrapstore` — newsletter and website disagree on session times for Picnic in the Park and the costume workshops; the newsletter is older. Per-day rows from the mail sit beside per-session rows from the 28 Aug web fetch until the next web run.
- `music/exchange` — Headfirst returns exactly 150 rows with no pagination link; likely a cap.
- `citywide/visit-bristol` — 60 of 199 rows taken (11–20 Sep); 14 region-bleed rows dropped.
- `citywide/resident-advisor` — 72 events 20 Sep–11 Oct truncated.

## Mail bindings written this run (stage 1, before the fan-out)

Nine sending addresses observed in the first pull did not match any binding,
because the venues mail from domains unrelated to their websites. Bound from
the observed addresses, never guessed, then the pull was re-run before anything
was committed:

| source | observed sender |
| --- | --- |
| `theatre/tobacco-factory` | `tobaccofactorytheatre@arts-mail.co.uk` (exact — the domain is shared) |
| `theatre/bristol-old-vic` | `bristol.old.vic@arts-mail.co.uk` (exact, added) |
| `music/st-georges-bristol` | `stgeorgesbristol@arts-mail.co.uk` (exact, added) |
| `music/bristol-beacon` | `*@bristolbeacon-mail.org` |
| `theatre/wardrobe-theatre` | `*@*.thewardrobetheatre.com` |
| `churches/bristol-cathedral` | `*@bristol-cathedral.co.uk` |
| `family/childrens-scrapstore` | `*@childrensscrapstore.co.uk` |
| `music/the-gallimaufry` | `*@thegallimaufry.co.uk` |
| `making/the-island` | `*@artspacelifespace.com` (added) |

`unmatched.yaml` is empty this run. Two Folk House opt-in confirmations still
await a click in the inbox; their newsletters are not yet arriving.

## Tags

Vocabulary 148 (was 144). Four coined, each by an agent that said why:
`pop` (145 uses — nothing in the vocabulary said pop), `world` (16 — afrobeat and
global-roots programming), `disco` (7), `open-studios` (2). No drift: no parallel
of an existing tag was introduced.

## Deliberately truncated

`music/crofters-rights` (60 of 93, to 31 Oct), `music/swx` (pages 1–3 of 6),
`music/the-louisiana` (4 of 5 pages), `music/exchange` (150-row cap),
`comedy/hen-and-chicken` (to 7 Nov; the rest is Comedy Box already taken),
`citywide/visit-bristol`, `citywide/resident-advisor`, `citywide/365-bristol`
(page 1), `citywide/eventbrite` (58 of 1,282). Each says so in `notes`.
