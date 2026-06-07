import * as React from "react";
import { cn } from "@/lib/utils";
import { xBase, xDefault, xActive, xSpan, xExpanded, xSpanVisible } from "./toolbarButtonClasses";

/**
 * ToolbarButton — optional wrapper over the expand-on-hover toolbar pattern.
 * Collapsed to an icon by default; reveals its label on hover, or stays
 * expanded when `active` (showing the selected filter value).
 */
export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ icon, label, active = false, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(xBase, active ? cn(xActive, xExpanded) : xDefault, className)}
        {...rest}
      >
        <span className="shrink-0">{icon}</span>
        <span className={cn(xSpan, active && xSpanVisible)}>{label}</span>
      </button>
    );
  },
);
