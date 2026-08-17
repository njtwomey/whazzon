/**
 * What the filters left you with, and nothing else.
 *
 * This used to hold the date range, the sort order and the card size. All of that
 * moved into the header, where the search already was: two bars of controls meant
 * looking in two places for the same kind of thing.
 *
 * The sort control went entirely rather than moving. Events are grouped by month
 * and read in date order, which is the only ordering the grouping supports — "by
 * venue" fought the month headings it sat under. `sort` survives in the filter
 * state and in the URL, so a link can still ask for `?sort=new`, but it is no
 * longer a button competing for the bar.
 *
 * What is left is a sentence, and it earns its line: after a filter change the one
 * thing you want to know is whether you narrowed it to something useful or to
 * nothing.
 */
export function ResultsToolbar({ count, activeFilterCount }: { count: number; activeFilterCount: number }) {
  return (
    <p className="mb-5 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{count.toLocaleString()}</span> {count === 1 ? "event" : "events"}
      {activeFilterCount > 0 && " matching your filters"}
    </p>
  );
}
