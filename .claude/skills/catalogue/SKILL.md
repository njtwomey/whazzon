---
name: catalogue
description: Build or extend the whazzon source catalogue for a location — work out which categories a place needs and which venues, festivals, promoters and listings sites belong in each. Use when asked to catalogue a city, add a category, find venues, or set up a new location (e.g. "catalogue bristol", "add a nightlife category to bristol", "find more music venues").
---

# Catalogue a location

Stage 1 of whazzon: decide **who, in this place, publishes what is happening**.

The full contract is `prompts/stage1-catalogue.md`. **Read it before starting** —
this file covers orchestration and the rules that matter most; that one covers
the field-by-field detail.

Everything here is slow-moving and human-curated. Nothing you write is
authoritative: sources land as `provisional` and a human promotes them.

## 1. Resolve what was asked for

**Location.** Match what the user said against `configs/*.yaml`. "bristol" means
`gb-bristol`. If there is no config, this is a _new_ location — see §5.

**Scope.** One of three jobs, and they behave differently:

| ask                      | job                                                    |
| ------------------------ | ------------------------------------------------------ |
| "catalogue \<city\>"     | every category, from nothing                           |
| "add a \<x\> category"   | one new category file                                  |
| "find more \<x\> venues" | extend an existing category — **merge, never rewrite** |

Say which one you are doing, and how many sources exist today, before starting.

## 2. Read the place before listing anything

`configs/<location-id>.yaml` holds `character:` — what the place is known for,
which neighbourhoods have their own scenes. That text is the whole input to this
stage. A catalogue built without reading it produces the same forty obvious
venues you would get for any city.

## 3. Fan out — one subagent per category

Categories are independent. Launch them in a single message so they run
concurrently, and give each one:

- the location's `character:` and `radiusKm`
- its category, and the existing entries in that category if any
- `prompts/stage1-catalogue.md`

Each returns proposed sources as YAML. They must **not** write catalogue files —
you assemble, so that merging is done once and consistently.

### What each subagent is looking for

Not just venues. A catalogue of buildings misses a large share of what happens
in any city:

| kind         | why it matters                                       |
| ------------ | ---------------------------------------------------- |
| `venue`      | the backbone                                         |
| `festival`   | often the biggest events of the year, and venue-less |
| `aggregator` | the safety net for everything you failed to think of |
| `organiser`  | promoters programming into other people's rooms      |
| `listing`    | council, library, university — civic and free events |

Push them to work the place systematically rather than listing what comes to
mind: the obvious ones, then the big commercial ones, then the independents,
then **neighbourhood by neighbourhood**, then institutions, then what happens
outdoors in summer. Going area by area is what surfaces places that thinking
category-by-category misses.

## 4. Assemble and merge

Write to `data/<location-id>/catalogue/<category>.yaml`. Filename, `category:`
and every `id:` prefix must agree.

**Merging is the part that goes wrong.** When a category file already exists:

- **Never overwrite curated fields.** `status`, `cadence`, `hints`, `notes` and
  `verifiedAt` are human decisions. A re-run proposes additions; it does not
  restate opinions.
- **Never delete an entry.** A source that looks gone becomes `status: closed`
  and stays, so the next run does not helpfully re-propose it.
- **Never renumber an `id`.** Everything downstream joins on it, and a renamed
  id orphans that source's entire harvest history.

Then:

```bash
npm run validate   -- <location-id>
npm run check-urls -- <location-id>
```

`check-urls` is this stage's quality control, and it probes **every route** a
source declares, not just its listings page. It separates:

- **ok** — reachable
- **blocked** — the host refused us (403/429). A bot wall, **not** a dead site.
  Never mark these `closed`.
- **dead path, live site** — a guessed `/whats-on/`. Fix the path.
- **no answer at all** — wrong domain, or genuinely gone.

Expect a meaningful number of failures: this stage proposes URLs from a model's
knowledge, which is exactly the kind of thing that is confidently wrong.

## 5. A location that does not exist yet

Write `configs/<location-id>.yaml` first — `id` must equal the filename — and get
`character:` right before cataloguing anything. Optionally drop a landscape image
at `data/<location-id>/assets/` and name it in `image:`.

Then run §3 for every category.

## Rules

- **`status: provisional` on everything you generate.** You are proposing, not
  deciding. Never write `active`.
- **Never invent a URL or an address.** If you do not know it, include the source
  anyway, put your best guess in `url`, and say plainly in `notes` that it is
  unverified. A missing venue is worse than a wrong URL, because `check-urls`
  catches wrong URLs and nothing catches an omission.
- **`url` is a plain string unless you have confirmed a second route.** It also
  takes a list of roled routes — `listings`, `api`, `feed`, `ics`, `booking` — and
  that is how a JSON endpoint or an ICS feed gets recorded instead of being
  described in `hints`. One route must be `listings`. Never guess an endpoint:
  `/wp-json/tribe/events/v1/events` and `/events.ics` are conventions a model
  will produce confidently and wrongly. `check-urls` tests every route.
- **`cadence` is a cost decision.** It is what stage 2 spends. `daily` only for
  sources that genuinely move daily; `quarterly` for annual festivals.
- **Put per-source knowledge in `hints`, not in the prompt.** "Books a year
  ahead", "listings are a PDF", "programme is inside a JS widget" — that is how
  the shared stage 2 prompt stays general.
- **Nothing location-specific in code.** It belongs in `configs/` or `data/`.
- **Tell subagents not to write `{0,n}` in a grep pattern.** See `CLAUDE.md`:
  `grep` wraps ugrep, and a bounded repeat of a wide character class over a saved
  page costs gigabytes and never finishes. Unbounded quantifiers,
  `/usr/bin/grep`, `rg`, or a short node script instead.
