import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveTheme, THEMES, useTheme, type Theme } from "@/lib/theme";

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Light, dark, or follow the machine.
 *
 * A menu rather than a two-way switch, because "system" cannot be reached by
 * toggling — and the trigger shows the theme you are *in* rather than the one you
 * chose, so "system" at night is a moon. That is the honest icon: it says what
 * you are looking at, and the menu says why.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const Icon = ICON[resolveTheme(theme)];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={`Theme: ${theme}`}>
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((option) => {
          const OptionIcon = ICON[option.value];
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value as Theme)}
              // A tick would need a column of its own; the current one simply
              // reads as selected.
              className={theme === option.value ? "bg-accent text-accent-foreground" : undefined}
            >
              <OptionIcon className="size-4" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
