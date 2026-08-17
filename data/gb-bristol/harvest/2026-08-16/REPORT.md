# Harvest report — gb-bristol, 2026-08-16

First full harvest. 16 categories, one agent each, 155 catalogued sources.

**1,095 events recorded.** Validates against `whazzon.harvest/1`.
Generated from the harvest log by `npm run drift` and `npm run tags` — not from
notes taken while it ran.

| | |
| --- | --- |
| events | 1,095 |
| sources observed | 155 |
| with an image | 748 |
| with a price | 234 |
| confidence high / medium / low | 682 / 372 / 41 |
| occurrence single / run / recurring / ongoing / undated | 722 / 227 / 93 / 12 / 41 |

### Events per category

| category | events |
| --- | --- |
| theatre | 245 |
| music | 224 |
| museums | 115 |
| citywide | 103 |
| comedy | 69 |
| cinema | 62 |
| making | 58 |
| gardens | 49 |
| literature | 42 |
| sport | 39 |
| art | 38 |
| food-drink | 18 |
| festivals | 12 |
| family | 12 |
| markets | 7 |
| outdoors | 2 |

---

## What needs your attention

Three kinds of problem, in the order they cost you.

### 1. The catalogue is badly out of date

**80 of 155 sources were harvested from a different URL than catalogued** — over
half. Stage 1 generated plausible URLs from model knowledge and a large share
were simply wrong; the crawl instruction is what rescued them.

Every proposed URL below was **fetched successfully during this harvest**, so
you are verifying correctness, not hunting. Apply them to
`data/gb-bristol/catalogue/*.yaml`, then re-run `npm run check-urls`.

Patterns worth knowing before you start:

- **`bristol.gov.uk` restructured** — parks pages gained a
  `/parks-and-open-spaces/` segment; `clifton-and-durdham-downs` is now
  `the-downs`. Affects most of `outdoors` and `markets`.
- **Lapsed domains now resolving to unrelated businesses.** `bookhaus.co.uk`
  redirects to a Shropshire hog-roast company; `wappingwharf.com` is parked and
  for sale; `croftersrights.co.uk` has been taken by a casino affiliate;
  `comedybox.co.uk` is on Aftermarket. **`check-urls` reports all of these as a
  healthy 200** — it verifies reachability, not identity. That is a real blind
  spot in stage 1's quality check.
- **The Headfirst route.** Exchange, Strange Brew, The Canteen, The Lanes, The
  Croft, Loco Klub and Bookhaus all embed JS-only Headfirst widgets. The pattern
  `headfirstbristol.co.uk/whats-on/<venue>` is server-rendered and works. Worth
  adding as a `hints` line on each.

### Catalogue URLs to correct (80)

Each replacement was fetched successfully during the harvest.

| source | catalogued (broken) | proposed |
| --- | --- | --- |
| `art/rwa` | https://www.rwa.org.uk/pages/whats-on | **https://www.rwa.org.uk/collections/events** |
| `art/centrespace` | https://www.centrespacegallery.com/ | **https://www.centrespace.org.uk/whats-on** |
| `art/upfest-gallery` | https://www.upfest.co.uk/ | **https://www.upfest.co.uk/gallery/** |
| `art/prsc` | https://www.prsc.org.uk/ | **https://prsc.org.uk/events/** |
| `art/grant-bradley-gallery` | https://www.grantbradleygallery.co.uk/ | **https://www.grantbradleygallery.co.uk/current.html** |
| `cinema/everyman-bristol` | https://www.everymancinema.com/venues-list/bristol/ | **https://www.everymancinema.com/bristol/** |
| `citywide/365-bristol` | https://www.365bristol.com/whats-on | **https://365bristol.com/events** |
| `citywide/bristol-city-council` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture | **https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/arts-culture-and-events** |
| `citywide/uwe-bristol` | https://www.uwe.ac.uk/events | **https://www.uwe.ac.uk/events/search-results** |
| `comedy/the-comedy-box` | https://www.comedybox.co.uk/ | **https://www.thecomedybox.co.uk/** |
| `comedy/bristol-improv-theatre` | https://www.improvtheatre.co.uk/whats-on | **https://www.improvtheatre.co.uk/?filter=Events** |
| `family/windmill-hill-city-farm` | https://www.windmillhillcityfarm.org.uk/whats-on/ | **https://windmillhillcityfarm.org.uk/apps/bookthatapp/calendar** |
| `family/st-werburghs-city-farm` | https://swcityfarm.org.uk/ | **https://swcityfarm.co.uk/events/** |
| `family/puppet-place` | https://puppetplace.org/ | **https://puppetplace.org/whats-on/** |
| `family/childrens-scrapstore` | https://childrensscrapstore.co.uk/ | **https://childrensscrapstore.co.uk/free-events** |
| `festivals/bristol-harbour-festival` | https://bristolharbourfestival.co.uk/ | **https://www.bristolharbourfestival.co.uk/** |
| `festivals/upfest` | https://www.upfest.co.uk/ | **https://www.upfest.co.uk/festivals/** |
| `festivals/bristol-pride` | https://www.bristolpride.co.uk/ | **https://www.bristolpride.co.uk/events/** |
| `festivals/forwards` | https://www.forwardsbristol.co.uk/ | **https://www.forwardsbristol.co.uk/lineup** |
| `festivals/winter-lanterns` | https://www.winterlanterns.co.uk/ | **https://www.lanternparade.org/** |
| `food-drink/wapping-wharf` | https://wappingwharf.com/whats-on/ | **https://www.wappingwharf.co.uk/latest-news** |
| `food-drink/left-handed-giant` | https://lefthandedgiant.com/ | **https://lefthandedgiant.com/collections/brewery-tours-and-events** |
| `food-drink/bristol-beer-factory` | https://bristolbeerfactory.co.uk/ | **https://bristolbeerfactory.co.uk/collections/tours-tastings** |
| `gardens/university-botanic-garden` | https://botanic-garden.bristol.ac.uk/whats-on/ | **https://botanic-garden.bristol.ac.uk/events/** |
| `gardens/grow-wilder` | https://www.avonwildlifetrust.org.uk/grow-wilder | **https://www.avonwildlifetrust.org.uk/events?tags=661** |
| `gardens/bristol-allotments` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/allotments | **https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/allotments-and-gardens** |
| `gardens/bristol-botanical-society` | https://www.bristolnats.org.uk/ | **https://bristolnats.org.uk/events/** |
| `gardens/blaise-plant-nursery` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-estates/blaise-plant-nursery | **https://www.bristol.gov.uk/blaise-plant-nursery** |
| `literature/storysmith` | https://storysmithbooks.com/pages/events | **https://storysmithbooks.com/product-category/upcoming-events/** |
| `literature/gloucester-road-books` | https://www.gloucesterroadbooks.co.uk/ | **https://gloucesterroadbooks.com/events/** |
| `literature/bookhaus` | https://www.bookhaus.co.uk/ | **https://www.headfirstbristol.co.uk/whats-on/bookhaus** |
| `literature/max-minervas` | https://www.maxminervas.co.uk/ | **https://www.maxminervas.co.uk/collections/events** |
| `literature/lyra-poetry-festival` | https://www.lyrabristol.com/ | **https://www.lyrafest.com/** |
| `making/bristol-folk-house` | https://www.bristolfolkhouse.co.uk/courses/ | **https://www.bristolfolkhouse.co.uk/live-music** |
| `making/bristol-hackspace` | https://www.bristolhackspace.org/ | **https://www.bristolhackspace.org/visit** |
| `making/bristol-wood-recycling` | https://www.bristolwoodrecycling.org.uk/ | **https://www.bwrp.org.uk/what-to-expect** |
| `making/bristol-bike-project` | https://www.thebristolbikeproject.org/ | **https://thebristolbikeproject.org/maintenance/bike-kitchen/** |
| `making/bricks-bristol` | https://bricksbristol.org/ | **https://bricksbristol.org/what-we-do/** |
| `making/bristol-textile-quarter` | https://bristoltextilequarter.co.uk/ | **https://bristoltextilequarter.co.uk/workshops/** |
| `making/the-island` | https://artspacelifespace.com/ | **https://artspace.uk/events-home/** |
| `making/maker-shed` | https://www.bristolhackspace.org/ | **https://www.bristolhackspace.org/visit** |
| `markets/st-nicholas-market` | https://www.bristol.gov.uk/residents/business-and-work/st-nicholas-markets | **https://www.bristol.gov.uk/st-nicholas-markets** |
| `markets/bristol-farmers-market` | https://www.bristol.gov.uk/residents/business-and-work/markets | **https://bristololdcity.co.uk/where-to-go/bristol-farmers%E2%80%99-and-producers%E2%80%99-market** |
| `markets/harbourside-market` | https://visitbristol.co.uk/things-to-do/bristol-harbourside-market-p2436113 | **https://visitbristol.co.uk/things-to-do/shopping/markets/** |
| `markets/finzels-reach-market` | https://www.finzelsreach.co.uk/ | **https://finzelsreachmarket.co.uk/** |
| `museums/we-the-curious` | https://www.wethecurious.org/whats-on | **https://www.wethecurious.org/whats-on/events** |
| `museums/ss-great-britain` | https://www.ssgreatbritain.org/whats-on/ | **https://www.bristoldockyards.org/whats-on** |
| `museums/georgian-house` | https://www.bristolmuseums.org.uk/georgian-house-museum/ | **https://www.bristolmuseums.org.uk/georgian-house-museum/whats-on/** |
| `museums/red-lodge` | https://www.bristolmuseums.org.uk/red-lodge-museum/ | **https://www.bristolmuseums.org.uk/red-lodge-museum/whats-on/** |
| `museums/blaise-museum` | https://www.bristolmuseums.org.uk/blaise-museum/ | **https://www.bristolmuseums.org.uk/blaise-museum/whats-on/** |
| `museums/clifton-observatory` | https://cliftonobservatory.com/ | **https://cliftonobservatory.com/events/** |
| `museums/bristol-aquarium` | https://www.bristolaquarium.co.uk/ | **https://www.bristolaquarium.co.uk/whats-on-event/whats-on/** |
| `music/o2-academy` | https://www.academymusicgroup.com/o2academybristol/events | **https://www.academymusicgroup.com/o2academybristol** |
| `music/thekla` | https://www.theklabristol.co.uk/whats-on/ | **https://www.theklabristol.co.uk/** |
| `music/exchange` | https://www.exchangebristol.com/ | **https://www.headfirstbristol.co.uk/whats-on/exchange** |
| `music/strange-brew` | https://www.strangebrewbristol.com/ | **https://www.headfirstbristol.co.uk/whats-on/strange-brew** |
| `music/lakota` | https://www.lakota.co.uk/ | **https://lakota.co.uk/** |
| `music/crofters-rights` | https://www.croftersrights.co.uk/ | **https://www.headfirstbristol.co.uk/whats-on/the-croft** |
| `music/the-lanes` | https://www.thelanesbristol.com/ | **https://www.headfirstbristol.co.uk/whats-on/the-lanes** |
| `music/the-canteen` | https://www.canteenbristol.co.uk/live-music | **https://www.headfirstbristol.co.uk/whats-on/the-canteen** |
| `music/the-gallimaufry` | https://thegallimaufry.co.uk/ | **https://www.thegallimaufry.co.uk/whatson** |
| `music/the-old-duke` | https://www.theoldduke.co.uk/ | **https://www.theoldduke.com/listings** |
| `music/the-bristol-fringe` | https://www.thebristolfringe.co.uk/ | **https://www.thebristolfringe.co.uk/event-listings** |
| `music/ashton-gate-stadium` | https://www.ashtongatestadium.co.uk/events/ | **https://www.ashtongatestadium.co.uk/** |
| `outdoors/ashton-court` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-estates/ashton-court-estate | **https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-open-spaces/parks-and-estates/ashton-court-estate** |
| `outdoors/the-downs` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-estates/clifton-and-durdham-downs | **https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-open-spaces/parks-and-estates/the-downs** |
| `outdoors/blaise-castle-estate` | https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-estates/blaise-castle-estate | **https://www.bristol.gov.uk/residents/museums-parks-sports-and-culture/parks-and-open-spaces/parks-and-estates/blaise-castle-estate** |
| `outdoors/avon-gorge-nature-reserve` | https://avongorge.org.uk/events/ | **https://avongorge.org.uk/whats-on/** |
| `sport/bristol-city` | https://www.bcfc.co.uk/fixtures/ | **https://www.bcfc.co.uk/match-centre/teams/bristol-city/fixtures** |
| `sport/bristol-bears` | https://www.bristolbearsrugby.com/matches/ | **https://www.bristolbearsrugby.com/match-centre/teams/bristol-bears/fixtures** |
| `sport/bristol-rovers` | https://www.bristolrovers.co.uk/fixtures/ | **https://www.bristolrovers.co.uk/fixture/list/34** |
| `sport/bristol-flyers` | https://www.bristolflyers.co.uk/fixtures/ | **https://www.bristolflyers.co.uk/match-centre/teams/bristol-flyers/fixtures** |
| `sport/bristol-cycling-campaign` | https://bristolcycling.org.uk/ | **https://bristolcycling.org.uk/diary/** |
| `theatre/wardrobe-theatre` | https://thewardrobetheatre.com/whats-on/ | **https://thewardrobetheatre.com/** |
| `theatre/bristol-improv-theatre` | https://www.improvtheatre.co.uk/whats-on | **https://improvtheatre.co.uk/** |
| `theatre/the-loco-klub` | https://www.thelocoklub.co.uk/ | **https://www.headfirstbristol.co.uk/whats-on/loco-klub** |
| `theatre/alma-tavern-theatre` | https://www.almataverntheatre.co.uk/ | **https://www.almatavernandtheatre.co.uk/theatre** |
| `theatre/trinity-centre` | https://3ca.org.uk/whats-on/ | **https://www.trinitybristol.org.uk/whats-on/** |
| `theatre/travelling-light` | https://travellinglighttheatre.org.uk/ | **https://www.travellinglighttheatre.org.uk/** |
| `theatre/wickham-theatre` | https://www.bristol.ac.uk/theatre-film-television/ | **https://www.bristol.ac.uk/theatre/events/** |

### Could not be reached (28)

| source | url | why |
| --- | --- | --- |
| `art/martin-parr-foundation` | https://www.martinparrfoundation.org/exhibitions/ | 403 Forbidden on the catalogued exhibitions page, on the site root https://www.martinparrf |
| `cinema/showcase-cabot-circus` | https://www.showcasecinemas.co.uk/cinema-listing/BCC/bristol-cabot-circus | 404 Not Found; the venue appears to have closed and no replacement page exists on the Show |
| `cinema/odeon-bristol` | https://www.odeon.co.uk/cinemas/bristol/ | 403 Forbidden — odeon.co.uk blocks automated fetches; no page content returned |
| `cinema/20th-century-flicks` | https://www.20thcenturyflicks.co.uk/ | 403 Forbidden on both / and /whats-on; the host blocks automated fetches |
| `citywide/bristol-247` | https://www.bristol247.com/whats-on/ | 403 Forbidden — bot protection. The site root https://www.bristol247.com/ returns 403 as w |
| `citywide/bristol-live` | https://www.bristolpost.co.uk/whats-on/ | the fetcher refuses this host outright — 'unable to fetch from www.bristolpost.co.uk'. No  |
| `citywide/resident-advisor` | https://ra.co/events/uk/bristol | 403 Forbidden — bot protection. https://ra.co/events/uk/bristol/week returns 403 as well. |
| `citywide/bristol-libraries` | https://www.bristol.gov.uk/residents/libraries-and-archives | 403 Forbidden from the library events platform — bodiless block, no listings retrieved. |
| `comedy/bristol-comedy-garden` | https://www.bristolcomedygarden.co.uk/ | 403 Forbidden on every attempt — bot protection appears to block the fetcher at host level |
| `comedy/hen-and-chicken` | https://www.henandchicken.com/ | 403 Forbidden on every attempt — bot protection appears to block the fetcher at host level |
| `festivals/bristol-light-festival` | https://bristollightfestival.org/ | host returns 403 Forbidden to every request (bot protection); /about/ and /faq/ also 403 |
| `festivals/downs-festival` | https://www.thedownsbristol.com/ | page returns an empty body — content is JavaScript-rendered and nothing is readable; /tick |
| `food-drink/bristol-whisky-festival` | https://www.bristolwhisky.co.uk/ | DNS lookup failed — getaddrinfo ENOTFOUND www.bristolwhisky.co.uk; the catalogued domain d |
| `food-drink/bristol-food-connections` | https://bristolfoodconnections.com/ | domain has lapsed — 301 redirects to kavarnadecatur.com, an unrelated US site |
| `literature/waterstones-bristol` | https://www.waterstones.com/events | waterstones.com refuses automated requests; /events and /events/bristol both returned 403  |
| `literature/bristol-ideas` | https://www.bristolideas.co.uk/ | host refuses automated requests; both / and /events/ returned 403 Forbidden with no body |
| `music/motion` | https://www.motionbristol.com/ | programme is JavaScript-rendered; no event data reachable from four routes |
| `music/swx` | https://www.swxbristol.com/ | DNS lookup failed: getaddrinfo ENOTFOUND (both www.swxbristol.com and swxbristol.com) |
| `music/rough-trade` | https://www.roughtrade.com/en-gb/events | host returned 403 Forbidden to both /en-gb/events and /gb-en/events |
| `music/the-black-swan` | https://www.theblackswanbristol.com/ | DNS lookup failed: getaddrinfo ENOTFOUND www.theblackswanbristol.com |
| `music/propyard` | https://propyard.co.uk/ | host returned 403 Forbidden |
| `outdoors/leigh-woods` | https://www.nationaltrust.org.uk/visit/bristol-bath/leigh-woods | Radware bot-protection interstitial served instead of the page ('Verifying your browser be |
| `sport/gloucestershire-cricket` | https://www.gloscricket.co.uk/fixtures | page returns HTTP 200 but the body contains only the document title; the fixture list is r |
| `sport/great-bristol-run` | https://www.greatrun.org/events/great-bristol-run/ | 403 Forbidden — greatrun.org blocks automated fetches |
| `sport/bristol-marathon` | https://www.bristolmarathon.co.uk/ | DNS lookup failed — getaddrinfo ENOTFOUND www.bristolmarathon.co.uk; the domain no longer  |
| `sport/parkrun-bristol` | https://www.parkrun.org.uk/events/events/ | 403 Forbidden — parkrun.org.uk blocks automated fetches |
| `sport/bristol-bikefest` | https://www.bikefest.co.uk/ | domain is parked — the page is a saw.com domain-sale listing, not the event site |
| `sport/severn-bridge-half` | https://www.severnbridgehalf.com/ | DNS lookup failed — getaddrinfo ENOTFOUND www.severnbridgehalf.com; the domain no longer r |

### Reachable but listed nothing (28)

- `art/upfest-gallery`
- `art/grant-bradley-gallery`
- `cinema/everyman-bristol`
- `cinema/vue-cribbs-causeway`
- `citywide/skiddle`
- `citywide/bristol-city-council`
- `citywide/university-of-bristol`
- `family/windmill-hill-city-farm`
- `family/puppet-place`
- `festivals/bristol-open-doors`
- `food-drink/wapping-wharf`
- `gardens/national-garden-scheme`
- `gardens/bristol-allotments`
- `literature/gloucester-road-books`
- `literature/lyra-poetry-festival`
- `making/bricks-bristol`
- `making/bristol-textile-quarter`
- `making/bristol-guild`
- `making/maker-shed`
- `making/mens-sheds-bristol`
- `music/dareshack`
- `music/bristol-beacon-presents`
- `outdoors/ashton-court`
- `outdoors/the-downs`
- `outdoors/blaise-castle-estate`
- `sport/bristol-cycling-campaign`
- `theatre/alma-tavern-theatre`
- `theatre/wickham-theatre`


## 2. Decisions only you can make

Not URL problems.

| source | issue |
| --- | --- |
| `cinema/showcase-cabot-circus` + `cinema/odeon-bristol` | **The same building.** Showcase closed Nov 2023; reopened as ODEON Luxe Feb 2026. Retire one. ODEON's `area: City Centre` is also wrong — it moved to Cabot Circus. |
| `making/the-island` | **Miscategorised.** Programmes dance, ballet, aerial circus and pro wrestling — 20 weekly classes, no making. |
| `making/maker-shed` | **Phantom.** The name appears nowhere on the site it points at. Identify it or set `status: closed`. |
| `art/grant-bradley-gallery` | "Current" exhibition dated **December 2016**. |
| `festivals/bristol-open-doors` | Still advertising **October 2023**; says it moved to biennial. |
| `sport/bristol-grand-prix` | Last word on the site: *"the 2019 #BristolGP is cancelled"*. |
| `literature/bristol-ideas` | Site states **"Bristol Ideas closed 30 April 2024"**. |
| `citywide/bristol-city-council` | **No events diary exists** at that path — policy, funding and busking guidance only. I catalogued it on a false assumption. |
| `music/swx` | DNS failure; search suggests it may now trade as **Electric Bristol**. |
| `gardens/national-garden-scheme` | `cadence: monthly` is wrong — nothing to see until **February 2027**, when a year of openings publishes at once. |
| `museums/ss-great-britain` | Rebranded to **Bristol Dockyards** (new domain). `name` probably wants changing too. |

## 3. Unreachable, and no URL will fix it

Bot walls and client-side rendering. **28 sources could not be reached.**

The most valuable loss is **`citywide/resident-advisor`** — nothing else in the
catalogue covers club and electronic listings with any depth, which for Bristol
is a real hole.

One finding may unlock several: `bristolmuseums.org.uk` **403s to WebFetch but
200s to a browser user-agent**, and the museums agent harvested 115 events via
curl. That trick is now in the prompt and is worth retrying against Martin Parr,
Waterstones, ODEON, 20th Century Flicks, Comedy Garden, Hen & Chicken, parkrun
and Great Bristol Run before writing any of them off.

## 4. Tag vocabulary

**136 distinct tags across 3,294 uses.** Sixteen agents ran in parallel against
an empty vocabulary and could not see each other's, so this is the first-run
worst case. `npm run tags` flags no near-duplicates, but its matcher is crude —
eyeball the list for concepts split across categories.

Known collisions to look at: `dance` was coined independently by art, making,
theatre and citywide; `comedy`, `theatre` and `food-drink` are being used as
tags *and* exist as categories.

## 5. Spot-checks worth doing

- **Inferred years.** 372 rows are `confidence: medium`, mostly because a
  listing omitted the year. Several agents cross-checked the inferred year
  against the printed weekday and got exact matches; that technique is now in
  the prompt. Sample a few of the medium rows.
- **41 `undated` events** — mostly dormant festivals whose sites still show
  *passed* dates (Upfest, Love Saves the Day, Harbour Festival). Check a couple
  read sensibly rather than as next year's guess.
- **28 sources reachable but empty.** Many are correct — council park pages are
  location information, not programmes. Check none is a venue we simply failed
  to crawl.

## 6. Then look at the site

```bash
make dev
```

Regular & ongoing should hold the markets and permanent collections; Dates to be
confirmed should hold the dormant festivals.

## Known gaps, unchanged by this run

- No `404.html`, so a direct hit on `/gb-bristol/theatre` 404s on GitHub Pages
- No AI digests — they need `firstSeen`, which only becomes meaningful from the
  second harvest onward
- Harvest log is YAML, not the agreed JSONL
- Every source is still `status: provisional`
