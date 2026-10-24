import { useTranslation } from "react-i18next";
import { BarChart3, Settings as SettingsIcon, Filter, ArrowUpDown, Layers, Plus, PanelLeft, PanelLeftClose } from "lucide-react";
import { PageTopbar, TopbarTabs, TopbarIconButton, ExpandingSearch } from "@/components/crm/primitives";

export type SpeedToLeadTab = "performance" | "settings";

const TABS: { id: SpeedToLeadTab; labelKey: string; icon: typeof BarChart3 }[] = [
  { id: "performance", labelKey: "tabs.performance", icon: BarChart3 },
  { id: "settings", labelKey: "tabs.settings", icon: SettingsIcon },
];

/**
 * The page topbar: title + count + Performance/Settings tabs + fold + search +
 * filter/sort/group/+. Search filters the mock list; filter/sort/group/+ are
 * decorative in the mockup.
 */
export function SpeedToLeadTopbar({
  count,
  tab,
  onTabChange,
  search,
  onSearchChange,
  listHidden,
  onToggleList,
}: {
  count: number;
  tab: SpeedToLeadTab;
  onTabChange: (t: SpeedToLeadTab) => void;
  search: string;
  onSearchChange: (v: string) => void;
  listHidden: boolean;
  onToggleList: () => void;
}) {
  const { t } = useTranslation("speedToLead");

  return (
    <PageTopbar
      desktopOnly
      testId="speed-to-lead-topbar"
      title={t("header.title")}
      count={count}
      left={<>
        <TopbarTabs
          tabs={TABS.map((tb) => ({ id: tb.id, label: t(tb.labelKey), icon: tb.icon }))}
          value={tab}
          onChange={onTabChange}
          testId="speed-to-lead-tabs"
          testIdPrefix="speed-to-lead-tab"
        />
        <TopbarIconButton label={listHidden ? t("toolbar.showList") : t("toolbar.hideList")} onClick={onToggleList}>
          {listHidden ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </TopbarIconButton>
      </>}
      right={<>
        <ExpandingSearch value={search} onChange={onSearchChange} placeholder={t("toolbar.searchPlaceholder")} testId="speed-to-lead-search" />
        {/* Filter / Sort / Group — decorative in the mockup */}
        <TopbarIconButton label={t("toolbar.filter")}><Filter className="h-4 w-4 shrink-0" /></TopbarIconButton>
        <TopbarIconButton label={t("toolbar.sort")}><ArrowUpDown className="h-4 w-4 shrink-0" /></TopbarIconButton>
        <TopbarIconButton label={t("toolbar.group")}><Layers className="h-4 w-4 shrink-0" /></TopbarIconButton>
        <TopbarIconButton label={t("toolbar.add")} primary><Plus className="h-4 w-4" /></TopbarIconButton>
      </>}
    />
  );
}
