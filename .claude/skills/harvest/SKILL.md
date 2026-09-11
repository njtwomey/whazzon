---
name: harvest
description: Run a whazzon stage 2 harvest for a location — fan out one subagent per category to crawl catalogued venues and record what is on. Use when asked to harvest, crawl, or fan out subagents to find events for a city (e.g. "fan out subagents to crawl for events in bristol", "harvest bristol theatre").
---

# Harvest a location

Stage 2 of whazzon: visit every catalogued source that is due, record what its
page says, and fold the result into the snapshot the site reads.

The full extraction contract is `prompts/stage2-harvest.md`. **Read it before
starting** — this file covers orchestration; that one covers what a correct
observation looks like, and the subagents need it.

## 1. Resolve what was asked for

Two things must always be settled before any fetching. Do not guess at either.

**Location.** Match what the user said against the configured locations:

```bash
ls configs/*.yaml    # gb-bristol.yaml -> location id "gb-bristol"
```

"bristol", "Bristol UK" and "gb-bristol" all mean `gb-bristol`. If nothing
matches, stop and say which locations exist — harvesting the wrong city writes
into the wrong data directory.

**Category.** Either a single named category, or all of them:

```bash
ls data/<location-id>/catalogue/    # theatre.yaml, cinema.yaml, ...
```

"crawl for events in bristol" with no category named means **all categories**.
Say how many categories and sources that covers before you start, so the person
knows the size of what they asked for.

## 2. Take the worklist

```bash
npm run stale -- <location-id> --ids
```

Only these sources are due, given each one's cadence. Harvesting everything
regardless is the main way this stage wastes money. If it returns nothing, say
so and stop — that is a correct outcome, not a problem.

Get the tag vocabulary too; every subagent needs it so they reuse tags rather
than coining parallel ones:

```bash
npm run tags -- <location-id> --list
```

## 2b. Pull the mailbox

```bash
npm run mail -- <location-id>
```

Stage 2 has two input channels. The other one is a dedicated address subscribed
to venue and promoter mailing lists, and this pulls it into

```
data/<location-id>/mail/<YYYY-MM-DD>/<category>.yaml
```

one file per category, mirroring the harvest layout. It is deterministic — IMAP,
MIME, redaction, matching against the catalogue — and no model runs in it.
Deciding what in a newsletter is an event is the fan-out's job, from these
files.

Run it **before** the fan-out, so the files exist when the subagents look. It is
cheap and idempotent: messages already filed are recognised by `Message-Id` and
skipped, so a re-run costs one connection.

Two things it tells you that belong in the report:

- **senders it could not attribute** — post from someone the catalogue has never
  heard of, filed in `unmatched.yaml`. That is stage 1's work: a source to add,
  or a `mail:` binding to write on one that already exists. Never write the
  binding yourself; it is a catalogue edit.
- **messages matching more than one source** — a shared sending domain, which
  wants a `listId` to disambiguate.

If `.env` is not set up, it says so and stops. That is not a reason to abandon
the harvest: mail is a supplement, and the fan-out runs perfectly well without
it. Say in the report that the mailbox was not read.

## 3. Fan out — one subagent per category

Sources are independent and nothing about one venue informs another, so
categories run in parallel. Launch them in a single message so they actually
run concurrently.

Each subagent gets:

- the contents of `prompts/stage2-harvest.md`
- its category's due sources: `id`, `name`, `url` and **`hints`** (the hints are
  the per-source knowledge that keeps the shared prompt general — pass them).
  `url` may be a list of roled routes rather than one URL; pass all of them, with
  their roles and notes — an `api` or `ics` route is usually the whole diary in
  one fetch and is the reason the source has more than one.
- the path to its mail file, when the pull produced one:
  `data/<location-id>/mail/<YYYY-MM-DD>/<category>.yaml`. Tell it to read that
  first — the file is already on disk, so it costs no fetch, and a newsletter
  routinely carries what the listings page does not.
- the current tag vocabulary
- today's date, so it can resolve "08 Mar" to a real year

**They are crawling, not fetching one URL.** A catalogued `url` may be a
homepage, or a path that has moved — around a quarter of Bristol's are. The
subagent navigates to the real listings (What's On / Events / Programme /
Diary), follows a page or two of pagination, and records the URL it actually
read in `fetch.url`. Budget two to four fetches per source; it is not there to
open every individual event page.

Each subagent **writes its own file**:

```
data/<location-id>/harvest/<YYYY-MM-DD>/<category>.yaml
```

That is the point of splitting by category — agents write directly instead of
funnelling every event back through your context, and a category that fails
loses nothing from the others. They return a short summary only: how many
events, how many sources, which failed.

Split a category if it is large; `citywide` and `music` are the usual
candidates. Keep the fan-out proportionate — around 16 subagents for a full
Bristol run, not 155.

## 4. Finish the run

Each category file carries this header, written by the subagent that owns it:

```yaml
schema: whazzon.harvest/1
locationId: <location-id>
date: "<YYYY-MM-DD>"
category: <category>
harvestedAt: "<YYYY-MM-DD>T<HH:MM:SS>Z"
prompt: { name: stage2-harvest, version: "4" }
model: <the model that did the extraction>
observations: [...]
```

A file may only contain its own category's sources — the schema enforces it.
Omit every `id`; they are hashes, filled in next. Once the fan-out is done:

```bash
npm run assign-ids -- <location-id> --date <YYYY-MM-DD>
npm run validate   -- <location-id>
npm run tags       -- <location-id>    # did the vocabulary drift?
npm run compile    -- <location-id>
npm run sync-web   -- --all
```

If `validate` fails, fix the data. Never widen the schema to accommodate a
sloppy extraction — the strictness is the point.

## 5. Report

Write `data/<location-id>/harvest/<YYYY-MM-DD>/REPORT.md`, beside the category
files. It belongs with the run because it describes that day's observations, and
because the reasoning should sit next to the evidence it came from.

Cover what a human has to act on:

- catalogue URLs to correct (`npm run drift` lists them, each one verified by a
  successful fetch)
- sources that could not be reached, and why — bot walls and JS-only pages need
  a different approach, not a better URL
- venues that look dormant or gone, miscategorised, or duplicated
- cadence that turned out wrong (a source with nothing to say until spring
  should not be fetched monthly)
- tag drift, from `npm run tags`
- anything deliberately truncated
- **senders in `unmatched.yaml`**, with what they appear to be. This is the
  mailbox's other product: a promoter's newsletter arrives there long before
  the source turns up in a catalogue sweep.

Then say the same thing back to the person, briefly:

- events recorded, and from how many sources
- **sources that failed**, with the reason — this is the number people actually
  need, and it is the one most easily glossed over
- any catalogue URLs the subagents flagged as stale, so stage 1 can be curated
- any source where coverage was deliberately truncated

A harvest that quietly covered half the catalogue and reported a total is worse
than one that covered half and said so.

## Rules

- **Never edit the catalogue from here.** Stage 1 is curated by hand; a broken
  URL is reported in `notes`, not fixed in place. Keeping the stages separate is
  the project's core constraint. A `mail:` binding is a catalogue edit like any
  other: report the unattributed sender, never bind it yourself.
- **Never overwrite an existing run file.** The harvest log is append-only —
  that is what lets the fold be rebuilt from scratch.

  If today's directory already exists you are extending a partial run, which is
  the normal case when a harvest is done in tranches. A category not yet
  harvested simply gets a new file. A category file that already exists means
  that category has run: leave it, or merge into it deliberately.

  `assign-ids` is idempotent — it skips events that already have one — so
  running it over the whole run directory is always safe.

- **`npm run mock` is fixtures, not a harvest.** It refuses to overwrite a real
  run without `--force`. Never reach for it here.

- **Tell subagents not to write `{0,n}` in a grep pattern.** See `CLAUDE.md`:
  `grep` wraps ugrep, and a bounded repeat of a wide character class over saved
  HTML costs gigabytes and never finishes. Two fan-outs have left multi-GB
  orphaned processes behind doing exactly this. Unbounded quantifiers,
  `/usr/bin/grep`, `rg`, or a short node script instead.
