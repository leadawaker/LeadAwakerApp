import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface ViewTab<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  testId?: string;
}

interface ViewTabStripProps<T extends string = string> {
  tabs: ViewTab<T>[];
  activeTab: T;
  onTabChange: (id: T) => void;
}

export function ViewTabStrip<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: ViewTabStripProps<T>) {
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/50"
      role="tablist"
      aria-label="View mode"
    >
      {tabs.map(({ id, label, icon: Icon, testId }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(id)}
            data-testid={testId ?? `topbar-view-${id}`}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors duration-150 select-none shrink-0",
              isActive
                ? "bg-background shadow-sm text-brand-indigo border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
