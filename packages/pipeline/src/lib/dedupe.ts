import type { SnapshotEvent } from "../schema/snapshot.js";

/**
 * Collapsing the same event listed by more than one source.
 *
 * Event ids are `<sourceId>#<hash>`, so two sources listing one gig are two
 * events by construction. That is right for the harvest log — each observation
 * has to stand as an honest account of what one page said — and wrong for the
 * snapshot, which is what a reader looks at. So it happens here and never in the
 * log: re-compiling from an untouched log rebuilds whatever rule is current.
 *
 * The matching key is **normalised title + anchor date + venue**, and every part
 * of that was forced by a measurement rather than chosen:
 *
 * - Title alone merged 337 rows in Cork and 81 legitimately distinct same-title
 *   events in Bristol — a venue that runs "Storytime" weekly has many.
 * - Adding the date brings it to 208 rows, all of them cross-source.
 * - The date is still not enough, and the counter-example is decisive: on one
 *   day Cork's four cinemas all showed Toy Story 5. That is four real
 *   screenings, and merging them would delete three cinemas' listings.
 *
 * Venues are matched by **containment**, not equality, because the same place
 * arrives under different names from different sources: "Cork City Library",
 * "City Library, Grand Parade" and "Cork City Library, Grand Parade" are one
 * room. Containment catches those while keeping "Omniplex Mahon Point" and "The
 * Reel Picture Blackpool" apart, which equality-plus-a-synonym-list would not
 * have done without someone maintaining the list.
 */

/** Strip the decoration sources add to a title so the same event matches itself. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(sold\s*out|cancelled|postponed|free|tickets?|live|presents?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reduce a venue name to something comparable. The removed words are the ones
 * that carry no distinguishing information in this context — every venue here is
 * in Cork, and "theatre" or "arts centre" appears in half of them.
 */
export function normaliseVenue(venue: string | undefined): string {
  return (venue ?? "")
    .toLowerCase()
    .replace(/\b(cork|the|at|in|theatre|arts centre|centre|center)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Do two venue strings refer to the same place?
 *
 * Containment in either direction, with a floor on the shorter string. Without
 * the floor, short normalised names swallow unrelated ones — and a bad merge
 * loses an event outright, where a missed merge only shows it twice.
 */
const MIN_VENUE_OVERLAP = 6;

export function sameVenue(a: string | undefined, b: string | undefined): boolean {
  const x = normaliseVenue(a);
  const y = normaliseVenue(b);
  if (x === y) return true;
  if (!x || !y) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= MIN_VENUE_OVERLAP && long.includes(short);
}

/**
 * Which listing to keep. A venue's own page beats an aggregator's copy of it:
 * it is the authority on its own programme, its times are the ones that turned
 * out right when Ticketmaster and the Opera House disagreed, and its
 * `categoryLabel` is the one a reader expects to see on the card.
 */
const KIND_RANK: Record<string, number> = {
  venue: 0,
  festival: 1,
  organiser: 2,
  listing: 3,
  aggregator: 4,
};

/** How much a row actually tells a reader, for breaking ties within a kind. */
function richness(event: SnapshotEvent): number {
  return (
    (event.description ? 8 : 0) +
    (event.image ? 4 : 0) +
    (event.url ? 2 : 0) +
    (event.price ? 1 : 0) +
    (event.timesText ? 1 : 0)
  );
}

export interface DedupeResult {
  events: SnapshotEvent[];
  /** Rows removed because another source already carried the same event. */
  merged: number;
  /** How many distinct events were listed more than once. */
  groups: number;
}

/**
 * Collapse duplicates, keeping the best row and folding what the others knew
 * into it.
 *
 * The survivor is enriched rather than merely chosen: a venue's own listing
 * often has no image where an aggregator does, and an aggregator sometimes tags
 * more usefully. Taking the union means the merged row is better than either
 * input, which is the point — de-duplicating is not only about removing a card.
 */
export function dedupeEvents(events: SnapshotEvent[], kindOf: (sourceId: string) => string | undefined): DedupeResult {
  /** title + date first; venue is then matched within each bucket. */
  const buckets = new Map<string, SnapshotEvent[]>();
  for (const event of events) {
    const key = `${normaliseTitle(event.title)}|${event.sortDate ?? "-"}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }

  const out: SnapshotEvent[] = [];
  let merged = 0;
  let groups = 0;

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]!);
      continue;
    }

    // Partition the bucket by venue. Greedy: each event joins the first cluster
    // whose venue it matches, which is stable because the input is already in a
    // deterministic order.
    const clusters: SnapshotEvent[][] = [];
    for (const event of bucket) {
      const found = clusters.find((c) => sameVenue(c[0]!.venueName, event.venueName));
      if (found) found.push(event);
      else clusters.push([event]);
    }

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        out.push(cluster[0]!);
        continue;
      }

      const ranked = [...cluster].sort((a, b) => {
        const ka = KIND_RANK[kindOf(a.sourceId) ?? "aggregator"] ?? 4;
        const kb = KIND_RANK[kindOf(b.sourceId) ?? "aggregator"] ?? 4;
        if (ka !== kb) return ka - kb;
        const ra = richness(b) - richness(a);
        if (ra !== 0) return ra;
        return a.id.localeCompare(b.id); // deterministic last resort
      });

      const [winner, ...losers] = ranked as [SnapshotEvent, ...SnapshotEvent[]];
      out.push({
        ...winner,
        // Fill the gaps from whichever loser has the field.
        description: winner.description ?? losers.find((l) => l.description)?.description,
        image: winner.image ?? losers.find((l) => l.image)?.image,
        url: winner.url ?? losers.find((l) => l.url)?.url,
        price: winner.price ?? losers.find((l) => l.price)?.price,
        timesText: winner.timesText ?? losers.find((l) => l.timesText)?.timesText,
        tags: [...new Set([...winner.tags, ...losers.flatMap((l) => l.tags)])].sort(),
        // Provenance survives the merge: the reader is told one thing, but the
        // record still says who else was carrying it.
        alsoListedBy: [...new Set(losers.map((l) => l.sourceId))].sort(),
        // The earliest sighting across the group is the honest firstSeen — it is
        // what "what's new this week" is answered from.
        firstSeen: [winner, ...losers].map((e) => e.firstSeen).sort()[0]!,
        lastSeen: [winner, ...losers]
          .map((e) => e.lastSeen)
          .sort()
          .reverse()[0]!,
      });
      merged += losers.length;
      groups += 1;
    }
  }

  return { events: out, merged, groups };
}
