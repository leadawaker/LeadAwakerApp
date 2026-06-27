import { useTranslation } from "react-i18next";
import { BarChart3, Settings as SettingsIcon, Filter, ArrowUpDown, Layers, Plus, PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpeedToLeadTab = "performance" | "settings";

const TABS: { id: SpeedToLeadTab; labelKey: string; icon: typeof BarChart3 }[] = [
  { id: "performance", labelKey: "tabs.performance", icon: BarChart3 },
  { id: "settings", labelKey: "tabs.settings", icon: SettingsIcon },
];

/**
 * 60px topbar mirroring CampaignListView's full-width bar: serif title + count +
 * Performance/Settings tabs + fold + search + filter/sort/group/+. Search filters
 * the mock list; filter/sort/group/+ are decorative in the mockup.
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
    <div
      className="shrink-0 hidden md:flex items-center gap-2 px-[17px]"
      style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}
      data-testid="speed-to-lead-topbar"
    >
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("header.title")}</span>
      <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginLeft: 4 }}>#{count}</span>

      <div className="la-seg la-seg--fill shrink-0" role="tablist" style={{ marginLeft: 10 }} data-testid="speed-to-lead-tabs">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={cn("la-seg-btn", tab === tb.id && "on")}
            style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
            onClick={() => onTabChange(tb.id)}
            data-testid={`speed-to-lead-tab-${tb.id}`}
          >
            <span className="flex items-center"><tb.icon size={13} /></span>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <button
        className="la-btn la-btn--soft la-btn--icon"
        onClick={onToggleList}
        title={listHidden ? t("toolbar.showList") : t("toolbar.hideList")}
      >
        {listHidden ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <div className="flex-1" />

      <div className="relative shrink-0" style={{ width: 180 }}>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("toolbar.searchPlaceholder")}
          className="neu-input"
          style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: 10, height: 32, fontSize: 12 }}
          data-testid="speed-to-lead-search"
        />
        <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
      </div>

      {/* Filter / Sort / Group — decorative in the mockup */}
      <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.filter")}><Filter className="h-4 w-4 shrink-0" /></button>
      <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.sort")}><ArrowUpDown className="h-4 w-4 shrink-0" /></button>
      <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.group")}><Layers className="h-4 w-4 shrink-0" /></button>
      <button className="la-btn la-btn--wine la-btn--icon" title={t("toolbar.add")}><Plus className="h-4 w-4" /></button>
    </div>
  );
}
