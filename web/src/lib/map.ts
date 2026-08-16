import type { SnapshotEvent } from "./types";

/**
 * Maps without an API key.
 *
 * A link to a maps app always works and needs nothing from us. An *embedded*
 * map needs coordinates — Google's Embed API needs a key, and OpenStreetMap's
 * embed needs a bounding box — which is why `geocode` exists as a pipeline
 * step: it fills `lat`/`lon` on catalogued sources from a real geocoder, and
 * the embed appears for any venue that has them.
 *
 * Nothing here ever guesses a position from a name.
 */

/** Human-readable address, venue name first. */
export function addressLine(event: SnapshotEvent): string | undefined {
  const parts = [event.address?.street, event.address?.locality, event.address?.city, event.address?.postcode];
  const line = parts.filter(Boolean).join(", ");
  return line || undefined;
}

/** The most specific query we can build for a maps search. */
function mapQuery(event: SnapshotEvent): string | undefined {
  const address = addressLine(event);
  if (address) return [event.venueName, address].filter(Boolean).join(", ");
  // Falling back to the venue name alone is honest — a maps search will do
  // something sensible with "Thekla, Bristol" — but never pretend it is an
  // address by putting it in the address field.
  return event.venueName;
}

export function googleMapsUrl(event: SnapshotEvent): string | undefined {
  const coords = event.address?.lat !== undefined && event.address?.lon !== undefined;
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${event.address!.lat},${event.address!.lon}`;
  }
  const query = mapQuery(event);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
}

export function directionsUrl(event: SnapshotEvent): string | undefined {
  const query = mapQuery(event);
  return query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : undefined;
}

/**
 * OpenStreetMap's embeddable map. Keyless, but it needs a bounding box, so it
 * only appears once a venue has been geocoded. The iframe carries OSM's own
 * attribution, which the licence requires.
 */
export function osmEmbedUrl(event: SnapshotEvent, spanDegrees = 0.006): string | undefined {
  const { lat, lon } = event.address ?? {};
  if (lat === undefined || lon === undefined) return undefined;
  const bbox = [lon - spanDegrees, lat - spanDegrees / 2, lon + spanDegrees, lat + spanDegrees / 2]
    .map((n) => n.toFixed(5))
    .join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}
