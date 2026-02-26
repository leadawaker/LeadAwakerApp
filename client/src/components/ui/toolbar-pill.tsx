import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ToolbarPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  activeValue?: string | number;
}

export const ToolbarPill = forwardRef<HTMLButtonElement, ToolbarPillProps>(
  ({ icon: Icon, label, active = false, activeValue, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "toolbar-pill-base",
        active && "toolbar-pill-active",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {label}
      {active && activeValue != null && ` \u00B7 ${activeValue}`}
    </button>
  ),
);

ToolbarPill.displayName = "ToolbarPill";
