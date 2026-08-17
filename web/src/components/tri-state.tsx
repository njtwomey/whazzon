import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { withState, type Facet, type TriState } from "@/lib/filter-events";
import { cn } from "@/lib/utils";

/**
 * A facet value as two segments: the label, and a small "hide" button.
 *
 * The two actions are not equally common, so they should not cost the same.
 * Nearly everyone wants "show me theatre", so **the label itself toggles that**
 * — one click on the obvious target, one click back off. Excluding is rarer and
 * more surprising, so it gets its own deliberate control rather than hiding
 * behind a third click that nobody would find.
 *
 * Clicking the label always returns to neutral from any state, so there is
 * exactly one way to undo whatever you did.
 *
 * States never rely on colour alone: included is filled, excluded is struck
 * through with its hide button filled.
 */

export const TRI_HINT: Record<TriState, string> = {
  off: "not filtered",
  include: "showing only this",
  exclude: "hidden",
};

export function TriSelect({
  facet,
  value,
  label,
  count,
  onChange,
  className,
  labelClassName,
}: {
  facet: Facet;
  value: string;
  label: string;
  count?: number;
  onChange: (next: Facet) => void;
  className?: string;
  labelClassName?: string;
}) {
  const state: TriState = facet.include.includes(value) ? "include" : facet.exclude.includes(value) ? "exclude" : "off";

  return (
    <ButtonGroup className={cn("max-w-full", className)} aria-label={`${label} — ${TRI_HINT[state]}`}>
      <Button
        variant={state === "include" ? "default" : "outline"}
        size="sm"
        aria-pressed={state === "include"}
        aria-label={`${label}${count !== undefined ? `, ${count} events` : ""} — ${TRI_HINT[state]}`}
        title={state === "off" ? `Show only ${label}` : `Stop filtering on ${label}`}
        className={cn(
          "h-6 min-w-0 gap-1 px-2 text-[0.72rem] font-normal",
          state === "exclude" && "text-muted-foreground line-through decoration-destructive/60",
          labelClassName,
        )}
        // Off goes to included; anything else goes back to neutral.
        onClick={() => onChange(withState(facet, value, state === "off" ? "include" : "off"))}
      >
        {/* `truncate` alone did nothing: with no width cap the button simply grew
            to fit, so a long venue name — "Gurranabraher Credit Union Brunell" —
            pushed the pill past the edge of the 256px rail and dragged the whole
            cloud with it.

            Capped in pixels rather than after N characters, because a character
            count is not a width: thirteen capitals are far wider than thirteen
            i's. The full name is on the button's `title`, so nothing is lost. */}
        <span className="max-w-[8.5rem] truncate">{label}</span>
        {count !== undefined && (
          <span className={cn("tabular-nums", state === "include" ? "opacity-70" : "text-muted-foreground")}>
            {count}
          </span>
        )}
      </Button>

      <Button
        variant={state === "exclude" ? "destructive" : "outline"}
        size="icon"
        aria-pressed={state === "exclude"}
        aria-label={state === "exclude" ? `Stop hiding ${label}` : `Hide ${label}`}
        title={state === "exclude" ? `Stop hiding ${label}` : `Hide ${label}`}
        className="h-6 w-6 shrink-0"
        onClick={() => onChange(withState(facet, value, state === "exclude" ? "off" : "exclude"))}
      >
        <Ban className="size-3" />
      </Button>
    </ButtonGroup>
  );
}
