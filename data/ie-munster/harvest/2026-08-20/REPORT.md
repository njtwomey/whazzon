# Munster — harvest 2026-08-20

The location was West Cork this morning and is the province this afternoon, for
one reason: **the thing it looks for is too rare to fill a calendar in one
corner of one county.** Widening the geography and narrowing the subject were the
same decision.

Twelve of thirteen sources visited, twenty-seven events recorded — twenty of them
from one source that had given a plain fetch nothing at all, until it was driven
in a browser.

## What changed, and why

**Narrowed to fibre and textiles.** Wool, knitting, crochet, weaving, spinning,
felting, dyeing, stitch, patchwork, flax and linen. The first catalogue had an
arts centre's exhibition programme, three heritage museums, a weekly country
market and a painting studio in it — all good things, none of them what was
asked for. They are gone rather than demoted: a listing that carries a painting
show alongside a spinning day teaches you to stop reading it.

**One-offs, not the standing programme.** Dropped with the rest: the Friday
market in Bantry, the town chamber's diary, the craft shop's opening hours. The
single exception kept is the guild's monthly Clare meeting, because it is the
only standing fibre group in the province and it is where a one-off gets
announced.

**Widened to Munster.** Cork, Kerry, Limerick, Clare, Tipperary, Waterford —
which immediately paid for itself: the only two events this run found outside
Clonakilty were in Limerick and Clare.

## What was found

Still to come this week, which is the part that matters today:

| date | event | where |
| --- | --- | --- |
| **20 Aug** | Flax Lín — walk & flax demonstration | Bennet's Mill Field, Clonakilty |
| **20 Aug** | Weaving — An Ancient Craft, with Leisa Grey | Tipperary Museum, Clonmel |
| **20 Aug** | Material Girls — a quilt and caint workshop | Christ Church, Fermoy |
| **21 Aug** | Spinning on the wheel and drop spindle | Bunratty Castle & Folk Park, Clare |
| **21 Aug** | The Magic of Felt-Making, with Leisa Grey | Tipperary Museum, Clonmel |
| **22 Aug** | Weaving demonstration, Louise Deasy | Clonakilty Tourist Office |
| **22 Aug** | Weaving with Natural Fibres | Tracton Arts Centre, Minane Bridge |
| **22 Aug** | Willow weaving with Cois Laoi Willow | Macroom Library |
| **23 Aug** | Spinning yarn on Scattery Island | Kilrush, Clare |
| **23 Aug** | Extended museum opening — flax heritage | West Cork Regional Museum, Clonakilty |
| 17–23 Aug | Irish Lace Exhibition | Kinsale Tourist Office |
| monthly | IGWSD Clare group — spinning, weaving, dyeing | Ennis and around Clare |

And fourteen more that have just gone: a wool project on Bere Island, Snáitheanna
in King John's Castle, súgán rope-twisting in Ballydehob, a knitting clinic in
Cashel, fleece-to-yarn in Clonmel, the Blarney mill's own story, needle skills in
Ballycommon, hand weaving at Cloughjordan, Rekindle in Lisdoonvarna.

## How the Heritage Week source was cracked

It was written off in the morning as unreadable: 2,648 events, paginated, and a
county filter that did nothing. Both true, and both beside the point.

The listing is a JavaScript application. Rendered in headless Chrome
(`--headless=new --dump-dom --virtual-time-budget=8000`) it comes back complete —
**and it takes a `?q=` search parameter.** So the route in is not the county
filter at all: it is one search per word of the vocabulary. Eleven searches —
wool, weaving, knitting, crochet, spinning, felting, dyeing, flax, textile, quilt,
lace — returned 33 Munster hits, twenty of them in scope.

That is the whole difference between this location working and not working. It is
in the catalogue as a hint, and the cadence is now weekly through August.

One caution recorded with it: the search matches organiser and venue as well as
title, so a storytelling event comes back under "wool" because the same library
also hosted a spinning talk. Read the title, not the hit.

## What a human needs to decide

**Cape Clear: the site is not broken, it is empty.** Rendering `cleire.ie` in the
same browser settled it — the JavaScript loads fine and the site is one page: a
welcome in Irish, a map, a newsletter box, the co-op's contact details. No events
section, no news, no diary, and one internal link (`/pages/map`). The Shetland
knitting weekend was never there to be scraped, and no amount of better fetching
would have found it. It will have been announced on social media, on the tutor's
own site, or through the ferry company. That is a different problem from the one
we thought we had, and a harder one.

**The guild is the find of this run.** Its "Upcoming Events 2026" block is prose
on the homepage — not /events/, which redirects, and not /learn/. Corrected in
the catalogue. It reaches well beyond Munster, so it needs filtering, but it is
the only source in Ireland that reliably knows when spinners are meeting.

**Two Munster events had just passed** — Limerick on the 15th, Clare on the 3rd.
Both would have been caught with a week's notice. This is an argument for a
weekly cadence on the guild rather than monthly.

**Catalogue corrections applied:**

- `guilds/weavers-spinners-dyers` — moved from `/learn/` to the homepage, where
  the diary actually is.
- `fibre/muckross-craft-centre` — moved from the craft centre page to `/events/`,
  which is the real diary. The craft centre page is now the `homepage`.

**Bot walls, not dead sites:** the guild, Cork Textiles Network and Culture Night
all refuse a plain fetcher and answer a browser user-agent.

**Not visited this run:** `notices/culture-night` — nothing to say until the
September programme is published, and no observation is recorded rather than a
misleading zero.

## Where to look next

The gaps are geographic. Nothing in this catalogue is rooted in Tipperary or
Waterford, and Kerry rests on one venue. Worth chasing: the county arts offices,
which run craft bursaries and often list workshops; yarn shops in Limerick,
Tralee and Waterford that host visiting tutors; and the Midlands Fibre Festival
in Athlone on 11 October, which is outside the province but is the nearest thing
to a fibre festival on the island this autumn — a case for a "worth the drive"
exception rather than for widening the boundary again.

## A second round of sleuthing, county by county

Ran after the harvest, working outward from the principal towns of each county —
Cork, Tralee and Killarney, Limerick, Ennis and Kilrush, Clonmel and Nenagh,
Waterford and Dungarvan — and searching the fibre vocabulary against each.

Four sources added, each one traced back from an event rather than guessed at:

- **Tipperary Museum of Hidden History**, Clonmel — three fibre workshops in one
  week (weaving, knitting, felt-making, all with Leisa Grey). Its diary is a page
  under `/museum-faqs/` on the county council's site, which is why no amount of
  searching for a museum website would have found it.
- **The Common Knowledge Centre**, Kilfenora — fifty acres in the Burren teaching
  lost skills, and the organiser behind REKINDLE in Lisdoonvarna. One of the few
  sources here with a real bookable diary.
- **Bunratty Castle & Folk Park** — spinning at the wheel and drop spindle among
  the daily demonstrations.
- **Limerick Lace** — a named tradition with its own body, behind Snáitheanna in
  King John's Castle.

### What was looked at and rejected, which is the more useful half

- **County library services.** Tipperary's runs The Events Calendar with a JSON
  API and 530 upcoming events — and searching the whole fibre vocabulary against
  it returned exactly one thing: a fortnightly crafting club in Nenagh. Clare's
  has no API. Libraries do storytime and book clubs; the fibre they carry is a
  standing club, which is what this location has decided not to be about. Not
  catalogued.
- **Yarn shops.** Tralee, Killarney, Waterford and Limerick all have one, and none
  publishes dated one-off events — they sell wool, and their classes are weekly
  courses. Cork's is already in as `fibre/vibes-and-scribes` for its ticket page.
  The Knitting Room, which does publish dated classes, is in Dublin.
- **Blarney Woollen Mills** — a retail brand at `blarney.com`, with no programme
  beyond the Heritage Week talk it gave this year.

### The gap that remains

**Waterford has nothing.** No guild branch, no mill, no fibre organiser, and
nothing in the Heritage Week sweep beyond a museum tour that matched on the word
"lace". Kerry rests on Muckross alone. Both are worth a look during Culture Night
in September, when the studios open and the people who do this in those counties
have to put their names somewhere.
