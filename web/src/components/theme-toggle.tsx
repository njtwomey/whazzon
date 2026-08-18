import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResolvedTheme, useTheme } from "@/lib/theme";

/**
 * One button: what you are not currently looking at.
 *
 * It started as a menu of light / dark / system, which is more state than a
 * one-click decision deserves — nobody opens a menu to change the brightness of a
 * page. So: **system is the default**, and the first click is an explicit choice
 * that overrides it from then on.
 *
 * The icon is the destination rather than the current state, because that is what
 * a toggle promises: a moon means "go dark". The label says the same thing for
 * anyone not looking at it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [, setTheme] = useTheme();
  const resolved = useResolvedTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const Icon = next === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
