import { cn } from "@/lib/utils";

export interface CompactTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface Props {
  tabs: CompactTab[];
  activeId: string;
  onChange: (id: string) => void;
}

/**
 * Vertical sliding-puck tab bar for compact rails. White pill slides via translateY.
 */
export function CompactTabPuck({ tabs, activeId, onChange }: Props) {
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeId));

  return (
    <div className="flex justify-center pt-3 pb-1.5 shrink-0">
      <div className="relative inline-flex flex-col items-center w-9 rounded-full border border-black/[0.125] bg-muted/30 p-0.5">
        <div
          className="absolute left-0.5 right-0.5 h-9 rounded-full bg-white dark:bg-card shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: `translateY(${activeIdx * 36}px)` }}
        />
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              title={tab.label}
              className={cn(
                "relative h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200",
                isActive ? "text-foreground" : "text-foreground/40 hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
