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
}

export function ViewTabBar({ tabs, activeId, onTabChange, className, activeClassName, showLabels }: ViewTabBarProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;

        // Icon-based tabs: 36px circle, expand to pill on hover
        if (Icon && !showLabels) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={cn(
                "group h-[38px] w-[38px] hover:w-auto hover:px-3 rounded-full border border-border/60 bg-transparent hover:bg-white inline-flex items-center justify-center gap-1.5 text-[12px] font-medium shrink-0 transition-[width,padding,background-color,color] duration-150",
                isActive
                  ? (activeClassName ?? "text-foreground")
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive && "stroke-[2.5]")} />
              <span className="hidden group-hover:inline whitespace-nowrap">{tab.label}</span>
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
