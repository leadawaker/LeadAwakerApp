import { useTranslation } from "react-i18next";
import { Columns3, Table2, GanttChart } from "lucide-react";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import type { ViewMode } from "../types";

const VIEW_TABS: { key: ViewMode; icon: typeof Columns3; tKey: string }[] = [
  { key: "kanban", icon: Columns3, tKey: "views.kanban" },
  { key: "table", icon: Table2, tKey: "views.table" },
  { key: "gantt", icon: GanttChart, tKey: "views.gantt" },
];

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Render compact icon-only variant for mobile */
  compact?: boolean;
}

export default function ViewSwitcher({ value, onChange, compact }: ViewSwitcherProps) {
  const { t } = useTranslation("tasks");

  const tabs: TabDef[] = VIEW_TABS.map(({ key, icon, tKey }) => ({
    id: key,
    label: t(tKey),
    icon,
  }));

  return (
    <ViewTabBar
      tabs={tabs}
      activeId={value}
      onTabChange={(id) => onChange(id as ViewMode)}
      variant="segment"
      className={compact ? "h-8 text-[11px]" : undefined}
    />
  );
}
