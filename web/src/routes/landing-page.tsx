import { ArrowRight, MapPinned, Search } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useLocations } from "@/lib/snapshot";

/**
 * The front door. With one city it is nearly a redirect, but it is the piece
 * that makes the project honestly multi-location rather than Bristol with a
 * parameter — and the counts give each city a recognisable shape before you
 * commit to loading a whole snapshot.
 */
export function LandingPage() {
  const locations = useLocations();
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    document.title = "whazzon";
  }, []);

  const visible = React.useMemo(() => {
    if (locations.status !== "ready") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return locations.data;
    return locations.data.filter((location) =>
      `${location.name} ${location.region} ${location.country}`.toLowerCase().includes(needle),
    );
  }, [locations, query]);

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold tracking-tight">whazzon</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">What&rsquo;s on, where?</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Pick a city to see what is happening — theatre, music, markets, workshops and everything else worth leaving
          the house for.
        </p>

        {locations.status === "ready" && locations.data.length > 3 && (
          <InputGroup className="mt-8 max-w-sm">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter cities…"
              aria-label="Filter cities"
            />
          </InputGroup>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.status === "loading" && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44" />)}

          {visible.map((location) => (
            <Link key={location.id} to={`/${location.id}`} className="group">
              <Card className="h-full gap-0 overflow-hidden p-0 transition-all hover:border-foreground/20 hover:shadow-lg">
                {/* The image is the card. Text sits on a scrim over it rather
                    than beside it, so a city reads as a place before it reads
                    as a row of statistics. */}
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {location.imageUrl && (
                    <img
                      src={`${import.meta.env.BASE_URL}${location.imageUrl}`}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-semibold tracking-tight">{location.name}</h2>
                        <p className="truncate text-sm text-white/75">
                          {location.region}, {location.country}
                        </p>
                      </div>
                      <ArrowRight className="mb-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>

                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap gap-1.5">
                    {location.topCategories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>

                  <p className="mt-auto text-sm text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">
                      {location.eventCount.toLocaleString()}
                    </span>{" "}
                    events from {location.sourceCount} sources
                    <span className="block text-xs">last updated {formatDate(location.asOf, true)}</span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {locations.status === "error" && (
          <Empty className="mt-8 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinned />
              </EmptyMedia>
              <EmptyTitle>No locations yet</EmptyTitle>
              <EmptyDescription>
                Compile a snapshot with <code>make refresh</code>, then reload.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {locations.status === "ready" && visible.length === 0 && (
          <p className="mt-8 text-muted-foreground">No cities match &ldquo;{query}&rdquo;.</p>
        )}
      </main>
    </div>
  );
}
