import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import * as React from "react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-2rem)] !max-w-5xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton
      >
        {showImage && (
          <div className="relative max-h-64 shrink-0 overflow-hidden bg-muted">
            <img
              src={event.image}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-64 w-full object-cover"
            />
          </div>
        )}

        {/* flex-1 + min-h-0 is what actually bounds the scroll area: without it
            this column grows to fit the extracted copy and the dialog clips it
            instead of scrolling. Some venues write a great deal. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          <DialogHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
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
            <DialogTitle className="text-balance text-2xl">{event.title}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <Fact icon={<CalendarDays className="size-4" />}>
              {occurrenceLabel(event.occurrence, asOf)}
              {time && ` · ${time}`}
              {event.timesText && <span className="block text-muted-foreground">{event.timesText}</span>}
            </Fact>

            <Fact icon={<MapPin className="size-4" />}>
              {event.venueName}
              {address && <span className="block text-muted-foreground">{address}</span>}
              <span className="mt-1 flex flex-wrap gap-3">
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline underline-offset-2"
                  >
                    View on map
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

          <ScrollArea className="min-h-24 flex-1 [&>[data-radix-scroll-area-viewport]]:max-h-[45vh]">
            <Markdown className="pr-4 text-base">{event.raw}</Markdown>
          </ScrollArea>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {/* Provenance matters here: everything on this page was scraped, and
                  the venue's own site is always the authority. */}
              From {event.sourceName} · first seen {formatDate(event.firstSeen, true)} · last confirmed{" "}
              {formatDate(event.lastSeen, true)}
            </p>
            {event.url && (
              <Button asChild>
                <a href={event.url} target="_blank" rel="noreferrer noopener">
                  Visit source <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
