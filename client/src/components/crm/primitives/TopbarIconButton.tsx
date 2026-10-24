// Icon-only action button for the PageTopbar (Filter, Sort, Group, Fields, the
// list fold, ...). The soft raised la-btn with a wine dot underneath when the
// menu it opens holds a non-default value. Works as a DropdownMenuTrigger child.
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TopbarIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip and aria-label. */
  label: string;
  /** Shows the wine dot (a filter, sort or group is set). */
  active?: boolean;
  /** Wine fill for the page's primary action (the + button). */
  primary?: boolean;
  /** Danger tint (delete). */
  danger?: boolean;
}

export const TopbarIconButton = React.forwardRef<HTMLButtonElement, TopbarIconButtonProps>(
  function TopbarIconButton({ label, active = false, primary = false, danger = false, className, style, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        className={cn("la-btn la-btn--icon shrink-0", primary ? "la-btn--wine" : "la-btn--soft", className)}
        style={{ position: "relative", ...(danger ? { color: "hsl(var(--destructive))" } : null), ...style }}
        {...rest}
      >
        {children}
        {active && (
          <span aria-hidden="true" style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)", pointerEvents: "none" }} />
        )}
      </button>
    );
  },
);
