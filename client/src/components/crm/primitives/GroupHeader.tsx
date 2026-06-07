import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GroupHeader — canonical sticky section divider for list views.
 *
 * Ported from the Leads card view (the best of the per-page variants). Bakes the
 * sticky offset, padding, bg, count badge, and divider lines so the `top-0` /
 * `-top-[3px]` and `pt-3` / `pt-[15px]` drift across pages disappears.
 *
 * Tokens: --group-header-pad-x/y, --group-header-sticky-top, --group-header-bg.
 */
export interface GroupHeaderProps {
  label: string;
  count?: number;
  /** Optional tint (e.g. PIPELINE_HEX[stage]); blended to ~12% alpha over the bg. */
  color?: string;
  /** Stick to the top of the scroll container. Default true. */
  sticky?: boolean;
  /** Trailing actions rendered after the count, before the right divider. */
  children?: React.ReactNode;
  className?: string;
}

export function GroupHeader({
  label,
  count,
  color,
  sticky = true,
  children,
  className,
}: GroupHeaderProps) {
  return (
    <div
      data-group-header="true"
      className={cn(
        "z-30 px-[var(--group-header-pad-x)] py-[var(--group-header-pad-y)]",
        sticky && "sticky top-[var(--group-header-sticky-top)]",
        className,
      )}
      style={{
        background: color
          ? `color-mix(in srgb, ${color} 12%, hsl(var(--group-header-bg)))`
          : "hsl(var(--group-header-bg))",
      }}
    >
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        {count !== undefined && (
          <>
            <span className="text-foreground/20 shrink-0">{"–"}</span>
            <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">
              {count}
            </span>
          </>
        )}
        {children}
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}
