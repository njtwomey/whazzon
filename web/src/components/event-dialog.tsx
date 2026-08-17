import { CalendarDays, ExternalLink, MapPin, Ticket, X } from "lucide-react";
import * as React from "react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDate, occurrenceLabel, occurrenceTime, priceLabel } from "@/lib/format";
import { addressLine, directionsUrl, googleMapsUrl, osmEmbedUrl } from "@/lib/map";
import type { SnapshotEvent } from "@/lib/types";

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function EventDialog({
  event,
  asOf,
  onClose,
}: {
  event: SnapshotEvent | null;
  asOf: string;
  onClose: () => void;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);

  // Reset the image state per event, or one broken hotlink would suppress the
  // image on every event opened afterwards.
  React.useEffect(() => setImageFailed(false), [event?.id]);

  if (!event) return null;

  const price = priceLabel(event);
  const time = occurrenceTime(event.occurrence);
  const address = addressLine(event);
  const mapUrl = googleMapsUrl(event);
  const directions = directionsUrl(event);
  const embed = osmEmbedUrl(event);
  const showImage = Boolean(event.image) && !imageFailed;

  /**
   * `description` is the event's own page; `raw` is the line the listings index
   * carried. Most events have only the latter, which is a paragraph at best —
   * so prefer the fuller text when a harvest went and got it, and keep the
   * index line alongside when it says something the page does not.
   */
  const body = event.description?.trim() || event.raw.trim();
  const listing = event.raw.trim();
  const alsoShowListing = Boolean(event.description?.trim()) && listing.length > 0 && !body.includes(listing);

  /**
   * Plenty of indexes print a title and a date with nothing to click. Falling
   * back to the page the listing came from is the difference between a dead end
   * and one more click to a box office — and it is not a guess, it is where we
   * read this.
   *
   * The two are not the same promise, so the tooltip says which one this is.
   */
  const link = event.url ?? event.sourceUrl;
  const linksToEvent = Boolean(event.url);

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-2rem)] !max-w-5xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        {/* The header is fixed and the whole body scrolls beneath it, rather
            than an inner pane scrolling inside a column that also holds an
            image and a map. That arrangement only bounded the copy when
            everything above it happened to fit; this one is bounded by the
            dialog itself.

            One line carries the title, the pills and the close button. The
            dialog's own close button is turned off because it is positioned
            absolutely, which would have it float over that row rather than sit
            in it. */}
        <DialogHeader className="shrink-0 gap-0 border-b p-6 py-4">
          <div className="flex items-center gap-3">
            {/* The title is the link. A separate button said the same thing
                twice, and the title is what people aim at anyway.

                No `text-balance` here, and the icon is glued to the last word
                with a non-breaking space. Balancing distributes content to even
                out line lengths, and it counted the icon as something to place —
                so a title that fitted comfortably on one line still put its
                icon alone on a second. The nbsp then removes the only break
                opportunity left before the icon. */}
            <DialogTitle className="min-w-0 flex-1 text-2xl">
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={
                    linksToEvent ? undefined : `No link for this event \u2014 opens ${event.sourceName}'s listings`
                  }
                  className="group inline underline-offset-4 hover:underline"
                >
                  {event.title}
                  {"\u00a0"}
                  <ExternalLink
                    className={
                      linksToEvent
                        ? "inline size-4 align-baseline text-muted-foreground transition-colors group-hover:text-foreground"
                        : // Dimmer, because it promises less: the venue's index
                          // rather than this event's own page.
                          "inline size-4 align-baseline text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
                    }
                  />
                </a>
              ) : (
                event.title
              )}
            </DialogTitle>

            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant="secondary">{event.categoryLabel}</Badge>
              {event.status === "sold-out" && <Badge variant="destructive">Sold out</Badge>}
              {event.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
              {event.state === "carried" && <Badge variant="outline">Unconfirmed</Badge>}
              {event.confidence !== "high" && (
                <Badge variant="outline" title="The extractor was unsure about this listing">
                  {event.confidence} confidence
                </Badge>
              )}
            </div>

            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close">
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-6">
            {showImage && (
              <div className="overflow-hidden rounded-lg bg-muted">
                <img
                  src={event.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}

            {/* Facts take their natural width rather than a third each, which
                is what lets the venue, its address and the map links sit on one
                line instead of stacking into three. */}
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2.5">
              <Fact icon={<CalendarDays className="size-4" />}>
                {occurrenceLabel(event.occurrence, asOf)}
                {time && ` · ${time}`}
                {event.timesText && <span className="block text-muted-foreground">{event.timesText}</span>}
              </Fact>

              <Fact icon={<MapPin className="size-4" />}>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span>{event.venueName}</span>
                  {address && <span className="text-muted-foreground">{address}</span>}
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary underline underline-offset-2"
                    >
                      Map
                    </a>
                  )}
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary underline underline-offset-2"
                    >
                      Directions
                    </a>
                  )}
                </span>
              </Fact>

              {price && <Fact icon={<Ticket className="size-4" />}>{price}</Fact>}
            </div>

            {/* The embedded map only appears once a venue has real coordinates,
                which `make geocode` fills in. Without them there is nothing
                honest to centre a map on, so the links above do the job. */}
            {embed && (
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={embed}
                  title={`Map showing ${event.venueName}`}
                  loading="lazy"
                  className="h-56 w-full border-0"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}

            <Separator />

            {body.length > 0 ? (
              <Markdown className="text-base">{body}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">
                The listing carried no description. The event page will have more.
              </p>
            )}

            {alsoShowListing && (
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  As listed by {event.sourceName}
                </p>
                <Markdown className="text-sm">{listing}</Markdown>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground">
              {/* Provenance matters here: everything on this page was scraped, and
                  the venue's own site is always the authority. */}
              From {event.sourceName} · first seen {formatDate(event.firstSeen, true)} · last confirmed{" "}
              {formatDate(event.lastSeen, true)}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
