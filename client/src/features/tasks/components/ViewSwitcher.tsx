import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Columns3, List, Table2, Sun, GitBranch } from "lucide-react";
import type { ViewMode } from "../types";

const VIEW_TABS: { key: ViewMode; icon: typeof Columns3; tKey: string }[] = [
  { key: "kanban", icon: Columns3, tKey: "views.kanban" },
  { key: "list", icon: List, tKey: "views.list" },
  { key: "table", icon: Table2, tKey: "views.table" },
  { key: "simple", icon: Sun, tKey: "views.simple" },
  { key: "tree", icon: GitBranch, tKey: "views.tree" },
];

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  const { t } = useTranslation("tasks");

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg bg-background/60 dark:bg-white/5 border border-border/40 p-0.5"
      data-testid="view-switcher"
    >
      {VIEW_TABS.map(({ key, icon: Icon, tKey }) => {
        const isActive = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-all duration-150",
              isActive
                ? "bg-brand-indigo/10 text-brand-indigo dark:bg-brand-indigo/20 dark:text-brand-indigo shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            title={t(tKey)}
            data-testid={`view-tab-${key}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{t(tKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
