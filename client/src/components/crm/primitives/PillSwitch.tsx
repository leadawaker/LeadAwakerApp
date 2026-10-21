// Small segmented switch: an inset pill track, the active item tinted with its own color over the
// card surface and ringed. Used by the Live | Demo switch (Calls) and the Chats | Stats tabs.
import type { LucideIcon } from "lucide-react";

export interface PillSwitchItem<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  /** CSS color of the active state, e.g. "var(--wine)". */
  color: string;
  /** Show a pulsing dot while this item is active (the "live" signal). */
  dot?: boolean;
}

export function PillSwitch<Id extends string>({ items, value, onChange, ariaLabel, testId, itemTestId, compact }: {
  items: PillSwitchItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  ariaLabel: string;
  /** data-testid of the track. */
  testId?: string;
  /** data-testid of each item, from its id. */
  itemTestId?: (id: Id) => string;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid={testId}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: 3, borderRadius: "var(--r-pill)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)", flexShrink: 0 }}
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
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
              height: compact ? 30 : 32, padding: compact ? "0 11px" : "0 13px", borderRadius: "var(--r-pill)",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 700 : 600,
              background: on ? `color-mix(in srgb, ${color} 14%, var(--card))` : "transparent",
              color: on ? color : "var(--mute)",
              boxShadow: on ? `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` : "none",
              transition: "background 130ms, color 130ms",
            }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            {label}
            {dot && on && (
              <span aria-hidden="true" className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
