import type { SnapshotEvent } from "../schema/snapshot.js";

/**
 * Scoring the same event listed by more than one source — and only scoring it.
 *
 * Event ids are `<sourceId>#<hash>`, so two sources listing one gig are two
 * events by construction. That is right for the harvest log, where each
 * observation must stand as an honest account of what one page said, and
 * unhelpful in the snapshot, where a reader sees the same evening three times.
 *
 * The obvious fix is to drop the extra rows here. This deliberately does not.
 * Every rule below is a guess about whether two strings mean the same evening,
 * and some of those guesses are wrong — so instead of deciding, `compile`
 * records **how confident the match was** and the browser decides what to hide.
 * That way the threshold can be moved without recompiling, a reader who wants
 * everything can have it, and a wrong guess costs a hidden row rather than a
 * deleted one.
 *
 * Which parts of the key matter was forced by counter-examples, not chosen:
 *
 * - Title alone matched 337 rows in Cork and 81 legitimately distinct same-title
 *   events in Bristol — a venue running "Storytime" weekly has many.
 * - Title plus date is 208 rows, all of them cross-source.
 * - Date is still not enough: on one day Cork's four cinemas all showed Toy
 *   Story 5. Four real screenings, so venue has to be in the key.
 */

/**
 * How sure we are that two rows are the same event. The bands are what the UI
 * thresholds on, so they are named rather than left as loose magic numbers.
 */
export const DUP_SCORE = {
  /** Same normalised title, same venue. As certain as this gets. */
  certain: 1,
  /** Same title; one venue name contains the other ("City Library, Grand Parade"). */
  likely: 0.8,
  /** One title contains the other, venue agrees. */
  probable: 0.65,
  /** Titles differ by a few characters, venue agrees. */
  possible: 0.5,
  /** Titles close, but one row does not say where it is. */
  weak: 0.3,
} as const;

/** Strip the decoration sources add to a title so the same event matches itself. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(sold\s*out|cancelled|postponed|free|tickets?|live|presents?|w\/|with support from)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reduce a venue name to something comparable. The removed words carry no
 * distinguishing information — every venue is in one city, and "theatre" or
 * "arts centre" appears in half of them.
 */
export function normaliseVenue(venue: string | undefined): string {
  return (venue ?? "")
    .toLowerCase()
    .replace(/\b(the|at|in|theatre|arts centre|centre|center|cork|bristol)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `max`.
 *
 * The early exit is what makes this affordable: most candidate pairs are nothing
 * alike and bail after a row or two.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      if (row[j]! < best) best = row[j]!;
    }
    if (best > max) return max + 1; // no cell in this row can recover
    prev = row;
  }
  return prev[b.length]!;
}

/** A contained title must be this long to count — or "Quiz" matches half a diary. */
const MIN_TITLE_CONTAINMENT = 14;
/** Below this, fuzzy title matching is off: short titles differ for real reasons. */
const MIN_FUZZY_TITLE = 12;
/** Tolerated edit distance as a fraction of the longer title. */
const TITLE_TOLERANCE = 0.15;
/** A contained venue must be this long. */
const MIN_VENUE_CONTAINMENT = 6;

type TitleMatch = "same" | "contained" | "close" | "no";

function compareTitles(a: string, b: string): TitleMatch {
  const x = normaliseTitle(a);
  const y = normaliseTitle(b);
  if (!x || !y) return "no";
  if (x === y) return "same";
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= MIN_TITLE_CONTAINMENT && long.includes(short)) return "contained";
  if (long.length < MIN_FUZZY_TITLE) return "no";
  const budget = Math.max(1, Math.floor(long.length * TITLE_TOLERANCE));
  return editDistance(x, y, budget) <= budget ? "close" : "no";
}

type VenueMatch = "same" | "contained" | "unknown" | "no";

function compareVenues(a: string | undefined, b: string | undefined): VenueMatch {
  const x = normaliseVenue(a);
  const y = normaliseVenue(b);
  if (x && y && x === y) return "same";
  if (!x || !y) return "unknown";
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= MIN_VENUE_CONTAINMENT && long.includes(short)) return "contained";
  return "no";
}

/**
 * How likely is it that these two rows are the same event? 0 means "no reason to
 * think so"; the bands above are the rest.
 *
 * Venue disagreement is fatal at every level. That is the Toy Story rule: the
 * same title on the same day at two named, different places is two events, and no
 * amount of title similarity should override it.
 */
export function duplicateScore(a: SnapshotEvent, b: SnapshotEvent): number {
  if ((a.sortDate ?? "-") !== (b.sortDate ?? "-")) return 0;
  const venue = compareVenues(a.venueName, b.venueName);
  if (venue === "no") return 0;

  const title = compareTitles(a.title, b.title);
  if (title === "no") return 0;

  if (venue === "unknown") return title === "same" ? DUP_SCORE.possible : DUP_SCORE.weak;
  if (title === "same") return venue === "same" ? DUP_SCORE.certain : DUP_SCORE.likely;
  if (title === "contained") return DUP_SCORE.probable;
  return DUP_SCORE.possible;
}

/**
 * Which row is the canonical one — and this is the other half of the job. A
 * venue's own page beats an aggregator's copy: it is the authority on its own
 * programme, its times were the ones that turned out right when Ticketmaster and
 * the Opera House disagreed, and its `categoryLabel` files the event under the
 * category a reader expects rather than "City-wide".
 */
const KIND_RANK: Record<string, number> = { venue: 0, festival: 1, organiser: 2, listing: 3, aggregator: 4 };

/** How much a row tells a reader, for breaking ties within a kind. */
function richness(event: SnapshotEvent): number {
  return (
    (event.description ? 8 : 0) +
    (event.image ? 4 : 0) +
    (event.url ? 2 : 0) +
    (event.price ? 1 : 0) +
    (event.timesText ? 1 : 0)
  );
}

/**
 * The canonical row takes on whatever the others knew that it did not, so a
 * duplicate can be hidden or dropped without losing a description, an image or
 * a price that only it carried. Shared by both passes below so that what
 * "absorb" means cannot drift between them.
 */
function absorb(winner: SnapshotEvent, losers: SnapshotEvent[]): SnapshotEvent {
  return {
    ...winner,
    // A venue's row can be `carried` while an aggregator's copy is `listed`
    // — the aggregator simply visited more recently. The event is current
    // either way, and the row that survives must say so or it is hidden.
    state: winner.state === "carried" && losers.some((l) => l.state === "listed") ? "listed" : winner.state,
    description: winner.description ?? losers.find((l) => l.description)?.description,
    image: winner.image ?? losers.find((l) => l.image)?.image,
    url: winner.url ?? losers.find((l) => l.url)?.url,
    price: winner.price ?? losers.find((l) => l.price)?.price,
    timesText: winner.timesText ?? losers.find((l) => l.timesText)?.timesText,
    tags: [...new Set([...winner.tags, ...losers.flatMap((l) => l.tags)])].sort(),
    alsoListedBy: [
      ...new Set(
        [...(winner.alsoListedBy ?? []), ...losers.map((l) => l.sourceId)].filter((id) => id !== winner.sourceId),
      ),
    ].sort(),
    firstSeen: [winner, ...losers].map((e) => e.firstSeen).sort()[0]!,
    lastSeen: [winner, ...losers]
      .map((e) => e.lastSeen)
      .sort()
      .reverse()[0]!,
  };
}

export interface DuplicateGroup {
  canonical: SnapshotEvent;
  /** Each duplicate with the score it earned against the canonical row. */
  duplicates: { event: SnapshotEvent; score: number }[];
}

export interface AnnotateResult {
  events: SnapshotEvent[];
  groups: DuplicateGroup[];
  /** Rows marked as somebody else's duplicate. Nothing is removed. */
  marked: number;
}

/**
 * Mark duplicates and enrich the canonical row. Every input row comes back out.
 */
export function annotateDuplicates(
  events: SnapshotEvent[],
  kindOf: (sourceId: string) => string | undefined,
): AnnotateResult {
  /**
   * Blocked by date before anything fuzzy runs. Two events on different days are
   * never the same event, so this turns a quadratic over 1,600 rows into a
   * quadratic over the handful sharing a date.
   */
  const byDate = new Map<string, SnapshotEvent[]>();
  for (const event of events) {
    const key = event.sortDate ?? "-";
    const bucket = byDate.get(key);
    if (bucket) bucket.push(event);
    else byDate.set(key, [event]);
  }

  const annotated = new Map<string, SnapshotEvent>();
  const groups: DuplicateGroup[] = [];
  let marked = 0;

  for (const bucket of byDate.values()) {
    /**
     * Precedence, then first-caught-wins. The first row in a cluster is the real
     * one and every later row scores its best similarity against the rows already
     * accepted — which is a rule anyone can follow by eye, unlike ranking a
     * cluster after the fact.
     *
     * But "first" has to mean something, and bucket order is really catalogue file
     * order, which would make the canonical row arbitrary — a gig could end up
     * filed under "City-wide" rather than "Music" depending on which YAML file
     * happened to be walked first. So the precedence is set here, once: a venue's
     * own page before an aggregator's copy of it, then whichever row says more,
     * then the id so it is deterministic. Ordering is the only preference
     * expressed; everything after it is mechanical.
     */
    const ordered = [...bucket].sort((a, b) => {
      const ka = KIND_RANK[kindOf(a.sourceId) ?? "aggregator"] ?? 4;
      const kb = KIND_RANK[kindOf(b.sourceId) ?? "aggregator"] ?? 4;
      if (ka !== kb) return ka - kb;
      const byRichness = richness(b) - richness(a);
      if (byRichness !== 0) return byRichness;
      return a.id.localeCompare(b.id);
    });

    const clusters: { members: SnapshotEvent[]; scores: number[] }[] = [];
    for (const event of ordered) {
      let joined = false;
      for (const cluster of clusters) {
        // Max similarity against the rows already in the cluster, per the rule.
        const score = Math.max(...cluster.members.map((member) => duplicateScore(member, event)));
        if (score > 0) {
          cluster.members.push(event);
          cluster.scores.push(score);
          joined = true;
          break;
        }
      }
      if (!joined) clusters.push({ members: [event], scores: [0] });
    }

    for (const { members, scores } of clusters) {
      if (members.length === 1) continue;

      const [winner, ...losers] = members as [SnapshotEvent, ...SnapshotEvent[]];

      // The canonical row absorbs what the others knew, so hiding a duplicate
      // never loses an image or a description that only it had.
      annotated.set(winner.id, absorb(winner, losers));

      const duplicates = losers.map((event, i) => {
        const score = scores[i + 1]!;
        annotated.set(event.id, { ...event, duplicateOf: winner.id, duplicateScore: score });
        return { event, score };
      });

      marked += losers.length;
      groups.push({ canonical: annotated.get(winner.id)!, duplicates });
    }
  }

  return { events: events.map((e) => annotated.get(e.id) ?? e), groups, marked };
}

/**
 * A URL compared the way a reader would: host case and a trailing slash do
 * not make a different page, and neither does the campaign tracking an
 * aggregator appends when it links out.
 */
export function normaliseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

function titlesMatch(a: SnapshotEvent, b: SnapshotEvent): boolean {
  const x = normaliseTitle(a.title);
  const y = normaliseTitle(b.title);
  return x === y || x.includes(y) || y.includes(x);
}

export interface DropResult {
  events: SnapshotEvent[];
  /** Rows removed outright. */
  dropped: number;
  /** URL groups that lost at least one row. */
  groups: number;
}

/**
 * Drop the duplicates that are not a guess: two rows pointing at the same
 * event page.
 *
 * Everything in `annotateDuplicates` is a similarity score, kept in the
 * snapshot for the browser to threshold, because a wrong guess should cost a
 * hidden row rather than a deleted one. An identical detail URL is different
 * in kind — it is the same page, and there is nothing to be unsure about — so
 * these rows are removed here rather than scored.
 *
 * Two guards, both forced by real rows rather than chosen:
 *
 * - **The same page can host several occurrences.** Vue's Spider-Man page
 *   covers an autism-friendly screening on the 13th and an open-captioned one
 *   on the 16th; one cricket fixtures page covers three matches. So a shared
 *   URL is only a duplicate when the rows also share a date and their titles
 *   agree — or when it is one source re-listing the same page under a
 *   *tweaked* title, which the fold sees as a new event and leaves the old row
 *   stranded as `carried`. Visit Bristol does this every run. An identical
 *   title on a different date is not a tweak; it is another occurrence.
 * - **A listings page is not a detail page.** An agent that could not find a
 *   deep link and fell back to the venue's what's-on URL has not produced
 *   forty duplicates. Anything matching a catalogued route is left alone.
 */
export function dropExactDuplicates(
  events: SnapshotEvent[],
  kindOf: (sourceId: string) => string | undefined,
  isListingsUrl: (normalisedUrl: string) => boolean,
): DropResult {
  const byUrl = new Map<string, SnapshotEvent[]>();
  for (const event of events) {
    if (!event.url) continue;
    const key = normaliseUrl(event.url);
    if (isListingsUrl(key)) continue;
    const bucket = byUrl.get(key);
    if (bucket) bucket.push(event);
    else byUrl.set(key, [event]);
  }

  const replaced = new Map<string, SnapshotEvent>();
  const gone = new Set<string>();
  let groups = 0;

  const precedence = (a: SnapshotEvent, b: SnapshotEvent) =>
    (KIND_RANK[kindOf(a.sourceId) ?? ""] ?? 9) - (KIND_RANK[kindOf(b.sourceId) ?? ""] ?? 9) ||
    (a.state === "listed" ? 0 : 1) - (b.state === "listed" ? 0 : 1) ||
    richness(b) - richness(a) ||
    b.lastSeen.localeCompare(a.lastSeen) ||
    a.id.localeCompare(b.id);

  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    const before = gone.size;
    let survivors = [...group].sort(precedence);

    // A source that lists this page now, under a tweaked title, supersedes its
    // own stranded row for it. The tweak is the signature: the same title on
    // another date is another occurrence — three cricket fixtures on one page,
    // a comedian's two dates — and stays.
    for (const event of survivors) {
      if (event.state !== "carried") continue;
      const winner = survivors.find(
        (e) =>
          e.state === "listed" && e.sourceId === event.sourceId && e.title !== event.title && titlesMatch(e, event),
      );
      if (!winner) continue;
      replaced.set(winner.id, absorb(replaced.get(winner.id) ?? winner, [event]));
      gone.add(event.id);
    }
    survivors = survivors.filter((e) => !gone.has(e.id));

    // The same page on the same day, described the same way, is one event.
    const byDate = new Map<string, SnapshotEvent[]>();
    for (const event of survivors) {
      const key = event.sortDate ?? "-";
      const bucket = byDate.get(key);
      if (bucket) bucket.push(event);
      else byDate.set(key, [event]);
    }
    for (const sameDay of byDate.values()) {
      const [winner, ...rest] = sameDay as [SnapshotEvent, ...SnapshotEvent[]];
      const losers = rest.filter((e) => titlesMatch(winner, e));
      if (losers.length === 0) continue;
      replaced.set(winner.id, absorb(replaced.get(winner.id) ?? winner, losers));
      for (const loser of losers) gone.add(loser.id);
    }

    if (gone.size > before) groups += 1;
  }

  return {
    events: events.filter((e) => !gone.has(e.id)).map((e) => replaced.get(e.id) ?? e),
    dropped: gone.size,
    groups,
  };
}
