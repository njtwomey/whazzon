import * as React from "react";
import type { LocationSummary, Snapshot } from "./types";

/**
 * Snapshots are fetched at runtime rather than bundled. They are large and they
 * grow, and there is no reason to parse Bristol's data in order to look at
 * another city.
 */

const base = import.meta.env.BASE_URL;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export type Async<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: string };

export function useLocations(): Async<LocationSummary[]> {
  const [state, setState] = React.useState<Async<LocationSummary[]>>({ status: "loading" });

  React.useEffect(() => {
    let live = true;
    getJson<LocationSummary[]>("snapshots/index.json")
      .then((data) => live && setState({ status: "ready", data }))
      .catch((error: Error) => live && setState({ status: "error", error: error.message }));
    return () => {
      live = false;
    };
  }, []);

  return state;
}

export function useSnapshot(locationId: string | undefined): Async<Snapshot> {
  const [state, setState] = React.useState<Async<Snapshot>>({ status: "loading" });

  React.useEffect(() => {
    if (!locationId) return;
    let live = true;
    setState({ status: "loading" });
    getJson<Snapshot>(`snapshots/${locationId}.json`)
      .then((data) => live && setState({ status: "ready", data }))
      .catch((error: Error) => live && setState({ status: "error", error: error.message }));
    return () => {
      live = false;
    };
  }, [locationId]);

  return state;
}
