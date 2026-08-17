# Roadmap

Ideas worth doing, not due yet. Short on purpose — enough to remember why, not a design.

`STATUS.md` is where things stand. `CLAUDE.md` is the rules. This is the queue.

---

## 1. Use the routes now that sources can have them

`url` takes a list of roled routes as of 2026-08-17, and `check-urls` probes all of them. What
is not done yet: nothing consumes an `ics` route as a calendar subscription ("subscribe to this
venue" is close to free once one exists), and Bristol's twelve known JSON endpoints are still
sitting in `hints` as prose rather than being curated into routes.

---

## 2. Use the de-duplication now that it exists

Done in `compile` on 2026-08-17: match on normalised title + anchor date + venue,
keep the venue's own listing over an aggregator's, fill its gaps from the losers,
union the tags, and record who else carried it in `alsoListedBy`. Cork went 1,641
to 1,472 events, Bristol 1,739 to 1,638.

Left to do: **nothing surfaces `alsoListedBy` in the UI.** "Also listed by Skiddle
and the PROC guide" is a small credibility signal worth showing on the detail
card. And venues are matched by containment, which misses the same place under
genuinely different names — "Frank O'Connor Library, Mayfield" and "Cork City
Libraries" are one event and stay two rows.

## 3. `check-urls` should check identity, not reachability

Five lapsed domains serve a healthy 200 to an unrelated business (hog roast, casino affiliate,
two parked, one marketplace). Three more return 200 with an empty shell. `check-urls` passes all
eight.

Add three checks: does the source's name appear in the body, is there anything date-shaped, does
it match a parking-lander signature (`/lander`, `ap:"parking"`, `saw.com`, `hugedomains`).
Report as gone / wrong / thin rather than pass/fail.

---

## 4. Run stage 2 from a scheduled workflow, into a pull request

Weekly cron, matrix job per category, then one job to `assign-ids`, `validate`, `compile`,
`sync-web`. **Open a PR, do not push** — the machine appends to the log, a human curates stage 1.

Needs an `ANTHROPIC_API_KEY` secret and the Claude Code action. Concurrency group so two runs
cannot share a run directory; `REPORT.md` into `$GITHUB_STEP_SUMMARY`.

Expect fewer sources to be reachable than from a laptop: runner IPs are shared and often
pre-blocked. `.scratch/github-actions.md` has the detail.

---

## 5. Some sources need a browser, not a better URL

Three walls, three mechanisms: a Radware interstitial served as **HTTP 200**
(`nationaltrust.org.uk`), a Cloudflare challenge whose token is minted in JS
(`bristol.events.mylibrary.digital`), and a flat site-wide 403 that looks IP-based
(`martinparrfoundation.org`).

Counter-lesson: RA walls its HTML and leaves its API open. **A 403 on the page is not evidence
the data is unreachable.**

If a JS-capable fetch is added it belongs in stage 2 only, opt-in per source.

---

## 6. Curate the 2026-08-17 findings

- **Renames**: SS Great Britain → Bristol Dockyards; SWX → Electric Bristol; maker-shed → The
  Makershed; Great Bristol Run → AJ Bell Great Bristol Run.
- **Miscategorised**: `making/the-island` is dance, circus and wrestling.
- **Duplicated entries**: `bristol-improv-theatre` in both comedy and theatre; Hen & Chicken vs
  Comedy Box; `grow-wilder` is a filtered view of `avon-wildlife-trust`.
- **Wrong `area`**: Puppet Place, Motion, Bristol Bike Project, Max Minerva's, Blaise Plant
  Nursery, ODEON.
- **Wrong `cadence`**: Everyman, Wapping Wharf, National Garden Scheme.
- **Radius**: Chipping Sodbury parkrun is 16.6 km out against `radiusKm: 12`.
- **`music/motion`** points at an abandoned 2021 build; needs a URL found by hand.
- **Twelve hints are now wrong** — listed in `data/gb-bristol/harvest/2026-08-17/REPORT.md`.
- **New sources worth adding**: Showcase Avonmeads, The Prospect Building, Ashton Court Mansion,
  Heritage Open Days, Bristol Shredfest, Exploring Whisky Bristol, three uncatalogued markets.
