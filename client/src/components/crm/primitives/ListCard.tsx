import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ListCard — single source of truth for a selectable list row.
 *
 * Bakes the surface tokens (radius, padding, min-height, bg, shadow) from
 * styles/variables.css so every list view shares one look. Per-instance tweaks
 * flow through `className` (tailwind-merge lets a page win without forking).
 *
 * Do NOT hand-roll `rounded-*`/shadow/padding on list cards — compose this.
 */
export interface ListCardProps extends React.HTMLAttributes<HTMLElement> {
  /** Selected/active row — paints the highlight-selected tint. */
  selected?: boolean;
  /** Hover affordances (cursor + hover bg tint). Default true. */
  interactive?: boolean;
  /** Lift the card with a stronger shadow on hover. Opt-in (default off) so
   *  pages that never had one keep exact parity. */
  hoverShadow?: boolean;
  /** Underlying element. Default "div". */
  as?: "div" | "button" | "li";
  /** Bake the standard list-card padding. Default true; set false when the
   *  consumer manages its own (e.g. variable padding, nested footers). */
  padded?: boolean;
  /** Optional left accent stripe color (any CSS color). */
  accentColor?: string;
}

export const ListCard = React.forwardRef<HTMLElement, ListCardProps>(function ListCard(
  {
    selected = false,
    interactive = true,
    hoverShadow = false,
    as = "div",
    padded = true,
    accentColor,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const Comp = as as any;

  return (
    <Comp
      ref={ref}
      type={as === "button" ? "button" : undefined}
      className={cn(
        // base surface
        "rounded-[var(--list-card-radius)] max-md:rounded-[var(--list-card-radius-mobile)]",
        "min-h-[var(--list-card-min-h)] bg-card",
        "shadow-[var(--list-card-shadow)]",
        "transition-[box-shadow,background-color] duration-150",
        padded && "px-[var(--list-card-pad-x)] py-[var(--list-card-pad-y)]",
        interactive && "cursor-pointer",
        hoverShadow && "hover:shadow-[var(--list-card-shadow-hover)]",
        // hover bg only when not selected (selected keeps its tint)
        interactive && !selected && "hover:bg-card-hover",
        selected && "bg-[hsl(var(--highlight-selected))]",
        // Mobile: every card is a white/paper raised-crisp tile, selected or not —
        // selection shows only as a wine left bar, never the desktop amber tint.
        "max-md:shadow-[var(--sh-raised-crisp)] max-md:rounded-[var(--list-card-radius-mobile)]",
        "max-md:bg-[var(--surface)]",
        selected && "max-md:border-l-[3px] max-md:border-l-[var(--wine)]",
        className,
      )}
      style={accentColor ? { borderLeft: `3px solid ${accentColor}`, ...style } : style}
      {...rest}
    >
      {children}
    </Comp>
  );
});
