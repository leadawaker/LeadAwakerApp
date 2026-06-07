import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill — status/label badge with enforced pill dimensions.
 *
 * Wraps the shadcn badge look but pins radius + padding to the pill tokens so
 * the per-page badge padding drift (px-1.5 vs px-2 vs px-2.5) collapses to one.
 *
 * Tokens: --pill-radius, --pill-pad-x, --pill-pad-y.
 */
export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Accent color (any CSS color). Drives the solid bg or soft tint. */
  color?: string;
  /** "solid" fills with color; "soft" uses a ~15% tint. Default "soft". */
  tone?: "solid" | "soft";
}

export function Pill({ color, tone = "soft", className, style, children, ...rest }: PillProps) {
  const colorStyle: React.CSSProperties = color
    ? tone === "solid"
      ? { backgroundColor: color, color: "#fff" }
      : { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }
    : {};

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--pill-radius)]",
        "px-[var(--pill-pad-x)] py-[var(--pill-pad-y)]",
        "text-[11px] font-medium leading-none whitespace-nowrap",
        !color && tone === "soft" && "bg-muted text-muted-foreground",
        className,
      )}
      style={{ ...colorStyle, ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}
