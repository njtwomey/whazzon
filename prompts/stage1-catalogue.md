---
name: stage1-catalogue
version: "1"
stage: 1
description: Generate the venue/source catalogue for a location from nothing but config/location.yaml.
---

# Stage 1 — build the catalogue

You are building the source catalogue for **whazzon**, a "what's on" site. Your
job is to answer one question: **who, in this place, publishes what is
happening?**

You are given a location id and its `configs/<location-id>.yaml`. That is all.
Do not assume the catalogue already has anything in it, and do not look at
another location's data — each location is built independently.

## What a source is

A source is anything with a URL worth crawling every week. Most are venues, but
the catalogue fails if you only list venues — a large share of what happens in
any city is programmed by festivals, promoters and community organisations that
have no building of their own.

Cover all five kinds:

| kind         | what it is                                  | why it matters                                  |
| ------------ | ------------------------------------------- | ----------------------------------------------- |
| `venue`      | a place with its own programme              | the backbone of the catalogue                   |
| `festival`   | recurring, often venue-less, often annual   | the biggest events of the year are usually here |
| `aggregator` | lists events across many venues             | the safety net for everything you missed        |
| `organiser`  | programmes into other people's spaces       | catches gigs, club nights, tours                |
| `listing`    | council, library, university, tourist board | civic and free events                           |

**Include at least three aggregators.** They are the insurance policy against
your own blind spots: anything you failed to think of, they will list.

## Categories

Start from these, and add or drop to fit the place — a coastal town needs
different categories than an inland city:

`theatre`, `cinema`, `music`, `comedy`, `literature`, `art`, `museums`,
`food-drink`, `markets`, `festivals`, `family`, `sport`, `outdoors`, `nightlife`

One file per category at `data/<location-id>/catalogue/<category>.yaml`. The
filename, the `category:` field, and the prefix of every `id:` in it must all
agree.

Categories are not fixed by the project — they are a claim about what this
place is. Add ones the location's `character:` calls for, and leave out ones it
does not support.

## Coverage

Work through the place systematically rather than listing whatever comes to
mind first. For each category ask:

1. **The obvious ones** — what would a resident name immediately?
2. **The big commercial ones** — chains, arenas, multiplexes. Unglamorous, but
   people genuinely want to know what is on there.
3. **The small independent ones** — this is where a city's actual character
   lives, and where a generic list is always weakest.
4. **By neighbourhood** — walk the areas named in `character:` one at a time.
   Scenes cluster geographically, and going area by area surfaces places that
   thinking category-by-category misses.
5. **The institutions** — universities, libraries, churches, community centres,
   civic buildings. They programme far more public events than people expect.
6. **The seasonal** — what happens in this place in summer that has no venue?

Aim for genuine coverage over a tidy list. A catalogue of 15 obvious venues is
a failure; the whole point is not missing things.

## Rules

- **`status: provisional` on everything you generate.** You are proposing, not
  deciding. A human promotes entries to `active` after review, and
  `npm run check-urls` tests whether the URL is real. Never write `active`.
- **`url` should be the page that lists events**, not the homepage — the
  `/whats-on` or `/events` path where one exists. If unsure, use the homepage
  and say so in `notes`.
- **Never invent a URL.** If you do not know a source's real address, still
  include the source, put your best guess in `url`, and say plainly in `notes`
  that it is unverified. A missing venue is a worse outcome than a wrong URL,
  because the link checker catches wrong URLs and nothing catches an omission.
- **`cadence` is a judgement about churn**, and it is what stage 2 costs are
  made of. `daily` for aggregators and cinemas whose listings genuinely move
  every day; `weekly` for most live venues; `monthly` for galleries and
  museums, whose exhibitions run for months; `quarterly` for annual festivals.
- **`hints` is for what stage 2 needs to know about this source specifically.**
  This is the escape hatch that keeps the stage 2 prompt general — prefer a
  hint here over a bespoke prompt. Good hints:
  - "Books roughly a year ahead; capture the full forward horizon."
  - "Listings are paginated a month at a time."
  - "Programme is a PDF, not HTML."
  - "Also lists events at other venues — set `venue.sourceId` where it matches."
    Leave it out when there is nothing specific to say. An empty hint is better
    than a generic one.
- **`id` is forever.** `<category>/<slug>`, lowercase kebab, derived from the
  name. Everything downstream joins on it, so a renamed id orphans history.
- **`address` only where you actually know it.** Fill in street and postcode
  for venues you are sure of, and leave it out entirely otherwise — stage 2
  can read the address off the venue's own page, which is authoritative, and a
  guessed postcode is worse than an absent one because it silently produces a
  map pin in the wrong place. Aggregators, touring companies and city-wide
  festivals have no address; omit it rather than inventing one.

## Output

One YAML file per category, matching `whazzon.catalogue/1`:

```yaml
schema: whazzon.catalogue/1
category: theatre
label: Theatre
description: Playhouses, studio theatres and companies.
sources:
  - id: theatre/tobacco-factory
    name: Tobacco Factory Theatres
    category: theatre
    kind: venue
    status: provisional
    url: https://www.tobaccofactorytheatres.com/whats-on/
    area: Southville
    tags: [independent, studio]
    cadence: weekly
    hints: |
      Programmes several months ahead; capture the full forward horizon.
    addedAt: "2026-08-16"
```

Run `npm run validate -- <location-id>` when done, then
`npm run check-urls -- <location-id>` to find the URLs you got wrong. Expect a
meaningful number: the checker distinguishes a dead path on a live site (a
guessed `/whats-on/`, easy to fix) from a domain that does not answer at all,
and separates hosts that merely refused the checker — do not mark those closed.

## Re-running

When a catalogue already exists, this stage **merges**. Curated fields —
`status`, `cadence`, `hints`, `notes`, `verifiedAt` — are human decisions and
must survive untouched. Propose additions, and flag sources that look gone
rather than deleting them: set `status: closed` and leave the entry in place,
so the next run does not helpfully re-propose it.
