// Round pill switch for every page's main tabs (the `.la-seg--main` track in design-system.css).
// solid (default): the selected item is a raised solid fill (wine, or the item's own color).
// soft: the selected item is a flat 14% tint of its color with an inset ring (People | All calls,
// the Live | Tests | Demo ScopeSwitch).
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PillSwitchItem<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  /** CSS color of the active state, e.g. "var(--wine)" (the default). */
  color?: string;
  /** Show a pulsing dot while this item is active (the "live" signal). */
  dot?: boolean;
}

export function PillSwitch<Id extends string>({ items, value, onChange, ariaLabel, testId, itemTestId, compact, variant = "solid", className }: {
  items: PillSwitchItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  ariaLabel: string;
  /** data-testid of the track. */
  testId?: string;
  /** data-testid of each item, from its id. */
  itemTestId?: (id: Id) => string;
  compact?: boolean;
  variant?: "solid" | "soft";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn("la-seg la-seg--main shrink-0", compact && "la-seg--compact", variant === "soft" && "la-seg--soft", className)}
    >
      {items.map(({ id, label, icon: Icon, color, dot }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={itemTestId?.(id)}
            onClick={() => onChange(id)}
            className={cn("la-seg-btn", on && "on")}
            style={color ? ({ "--seg-c": color } as CSSProperties) : undefined}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            {label}
            {dot && on && (
              <span aria-hidden="true" className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
