import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ListCard — a selectable list row with the one list-card look (Chats behaviour).
 *
 * It renders `.la-camp-card` (styles/components.css): flat at rest, wine tint on hover,
 * white + raised-crisp + a wine bar on the left when `selected` (`.active`), raised on phones.
 * Unlike a hand-written `.la-camp-card` row it wraps free-form content, so it drops that
 * class's flex row layout and uses its own padding (or none, with `padded={false}`).
 *
 * Do NOT hand-roll `rounded-*`/shadow/padding on list cards — compose this or `.la-camp-card`.
 */
export interface ListCardProps extends React.HTMLAttributes<HTMLElement> {
  /** Selected/active row: white card, raised, wine bar on the left. */
  selected?: boolean;
  /** Pointer cursor. Default true. The hover tint comes from `.la-camp-card` either way. */
  interactive?: boolean;
  /** Kept for API compatibility. The list card is flat until selected, so this no longer lifts it. */
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
    hoverShadow: _hoverShadow = false,
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

  // Inline because .la-camp-card is unlayered CSS, which Tailwind utilities cannot override.
  const box: React.CSSProperties = {
    display: "block",
    padding: padded ? "var(--list-card-pad-y) var(--list-card-pad-x)" : 0,
    ...(interactive ? null : { cursor: "default" }),
    ...(accentColor ? { borderLeft: `3px solid ${accentColor}` } : null),
  };

  return (
    <Comp
      ref={ref}
      type={as === "button" ? "button" : undefined}
      className={cn("la-camp-card min-h-[var(--list-card-min-h)]", selected && "active", className)}
      style={{ ...box, ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
});
