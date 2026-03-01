import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}

interface ViewTabBarProps {
  tabs: TabDef[];
  activeId: string;
  onTabChange: (id: string) => void;
  className?: string;
  activeClassName?: string;
  /** When true, inactive tabs with icons still render as full pills (icon + label), not icon-only circles. */
  showLabels?: boolean;
  /** "pill" (default) = icon circles / highlight-active pills. "text" = plain text labels, bold when active, no background. */
  variant?: "pill" | "text";
}

export function ViewTabBar({ tabs, activeId, onTabChange, className, activeClassName, showLabels, variant = "pill" }: ViewTabBarProps) {
  // Text variant: simple bold/muted labels, no pill or circle styling
  if (variant === "text") {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-9 px-2.5 text-[12px] shrink-0 rounded-full transition-colors duration-150",
                isActive
                  ? "font-bold text-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;

        // Icon-based tabs: active = permanent pill, inactive = 38px circle
        if (Icon && !showLabels) {
          if (isActive) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-[38px] px-3 rounded-full text-[12px] font-semibold shrink-0",
                  activeClassName ?? "bg-highlight-active text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 stroke-[2.5]" />
                {tab.label}
                {tab.badge}
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={cn(
                "h-[38px] rounded-full border border-black/[0.125] bg-transparent hover:bg-white hover:border-black/[0.175] inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-[background-color,color,border-color] duration-150",
                tab.badge ? "gap-0.5 px-2" : "w-[38px]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.badge}
            </button>
          );
        }

        // Active pill (no icon or showLabels)
        if (isActive) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-semibold shrink-0",
                activeClassName ?? "bg-highlight-active text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4 stroke-[2.5]" />}
              {tab.label}
              {tab.badge}
            </button>
          );
        }

        // Inactive pill (no icon, or showLabels=true)
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full icon-circle-base text-muted-foreground hover:text-foreground text-[12px] font-semibold shrink-0"
          >
            {Icon && showLabels && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
