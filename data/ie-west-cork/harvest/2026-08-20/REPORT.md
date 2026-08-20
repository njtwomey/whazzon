# West Cork — harvest 2026-08-20

First run of a new location, and a partial one: fifteen of seventeen sources
visited, twelve events recorded, five of them in scope for what this location is
actually for.

The location exists because two events were missed — a flax and linen day in
Clonakilty, and a Shetland knitting weekend on Cape Clear. This run caught the
first kind and could not have caught the second. That result is the useful part
of the report.

## What was found

Everything in scope came from **one source**: Dúchas Clonakilty Heritage's
Heritage Week page.

| date | event | where |
| --- | --- | --- |
| 18 Aug | Flax — Threads of Time | De Barra's, Clonakilty |
| 19 Aug | The Babóg Project — doll making workshop | Clonakilty Library |
| 19 Aug | Masters: The Stories Behind the Skills | Ballineen |
| **20 Aug** | **Flax Lín — walk & flax demonstration** | **Bennet's Mill Field, Clonakilty** |
| 22 Aug | Weaving demonstration with Louise Deasy | Clonakilty Tourist Office |

Uillinn added five exhibition runs through to December, and Bantry's Friday
market is recorded as recurring. Nothing else had a forward date today.

## What a human needs to decide

**Cape Clear has no machine-readable diary, and that is the whole Shetland
knitting problem.** `cleire.ie` answers 200 and is a JavaScript application — the
HTML is script tags and nothing else. The alternative, `capeclearisland.ie`, is
server-rendered but its Diary page is a stub. Three options, in order of effort:
catalogue the ferry company (`capeclearferries.com`, server-rendered, and it has
a reason to list what is on); catalogue the island co-op; or accept that the
island needs a browser-based fetch. Until one of those happens, an event on Cape
Clear will be missed again.

**Heritage Week cannot be read through its own index.** Every in-scope event this
run links to a `heritageweek.ie` page, yet the national listing yielded nothing:
2,648 events, paginated, and the county filter did not narrow the first page.
Going in through the local organiser worked; going in through the national index
did not. Next run should try the map view, or work out the real query parameter.
The general lesson for this location: **go to the town-level organiser, not the
national scheme.**

**The local papers are news, not diaries.** The Southern Star's "Things to See &
Do" is a list of articles with the dates inside the prose, some of it behind a
subscription; West Cork People's "Don't Miss" feed was profiles and round-ups
this month. Both stay catalogued — the Star is the best-informed source in the
region on flax and craft — but reading them costs a fetch per story, so they need
a hint to follow only headlines that name a month or a weekend.

**Catalogue corrections, already applied:**

- `craft-fairs/clonakilty-chamber` — `/whats-on/` is a 404; corrected to
  `/events`. That listing is JavaScript-rendered, so it will still yield nothing
  until it can be read with a browser.
- `craft-fairs/west-cork-crafts` — added the Creative Workshops page as a second
  listings route.
- `workshops/working-artist-studios` — added its Events Calendar JSON endpoint as
  an `api` route. Verified, not guessed: it returned 200 with `total: 0`.
- `textiles/cork-textiles-network` — dropped to quarterly. Its events page is a
  retrospective archive with nothing forward, and most of it is Cork city.
- `galleries/west-cork-creates` — **new source**, found through the West Cork
  People feed, which is precisely what that source is catalogued for. An annual
  selling exhibition of West Cork makers in Skibbereen; the 2026 edition ran 1–16
  August, so this run just missed it.

**Bot walls, not dead sites.** `galleries/uillinn`,
`galleries/michael-collins-house`, `notices/culture-night` and
`textiles/cork-textiles-network` all refuse `check-urls` with a 403 and answer a
browser user-agent. Do not mark any of them closed.

**Not read this run:** `notices/explore-west-cork` was reachable but left for next
time, and `notices/culture-night` has nothing to say until the September
programme goes up. Both are recorded as observations so the gap is visible rather
than silent.

## Cadence, on the evidence of one run

August is the peak, not a typical month: Heritage Week is the single densest
week in this location's year, and it is running as this was written. Expect a
quiet September until Culture Night, then the craft-fair season from late
October. Nothing here justifies a weekly fetch except the Southern Star and
Uillinn.
