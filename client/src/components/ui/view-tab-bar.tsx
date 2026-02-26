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

        if (isActive) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[12px] font-semibold shrink-0",
                activeClassName ?? "bg-[#FFE35B] text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
              {tab.badge}
            </button>
          );
        }

        // Inactive with icon: collapse to circle unless showLabels is set
        if (Icon && !showLabels) {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className="icon-circle-lg icon-circle-base"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        }

        // Inactive pill (no icon, or showLabels=true)
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full icon-circle-base text-muted-foreground hover:text-foreground text-[12px] font-semibold shrink-0"
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
