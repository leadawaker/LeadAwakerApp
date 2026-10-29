// Topbar of the Leads page Pipeline (Kanban) view. Extracted from LeadsTable.tsx.
// The high-score filter and score sort were removed with the lead score.
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Filter, Check, Phone, Mail, X, Rows3, Shrink, Expand } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TopbarIconButton } from "@/components/crm/primitives";
import { TopbarSearch, ActiveDot, type ViewFilterSlot } from "./LeadsTopbarParts";
import { MenuGroup } from "./FilterGroups";
import type { PipelineSort, ViewMode, VIEW_TAB_KEYS } from "./leadsTableConfig";

export function LeadsPipelineTopbar(p: {
  total: number;
  showTabs: boolean;
  viewTabs: typeof VIEW_TAB_KEYS;
  viewMode: ViewMode;
  onViewSwitch: (v: ViewMode) => void;
  compactMode: boolean;
  setCompactMode: (fn: (v: boolean) => boolean) => void;
  hasAnyCollapsed: boolean;
  onFoldToggle: () => void;
  search: string;
  onSearch: (v: string) => void;
  hasPhone: boolean;
  setHasPhone: (v: boolean) => void;
  hasEmail: boolean;
  setHasEmail: (v: boolean) => void;
  sortBy: PipelineSort;
  setSortBy: (v: PipelineSort) => void;
  /** Desktop: the channel tabs (LeadsQuickControls). */
  quickControls?: React.ReactNode;
  /** Desktop: the quick view, shown as the "Show" group of the Filter menu. */
  viewFilter?: ViewFilterSlot;
}) {
  const { t } = useTranslation("leads");
  const attrCount = (p.hasPhone ? 1 : 0) + (p.hasEmail ? 1 : 0);
  const filterOn = attrCount > 0 || !!p.viewFilter?.active;
  const compactLabel = t("toolbar.compactView");
  const foldLabel = p.hasAnyCollapsed ? t("toolbar.unfold") : t("toolbar.fold");
  const row = "flex items-center gap-2 cursor-pointer rounded-xl";
  return (
    <div className="la-page-header max-md:!gap-2 la-m-chrome max-md:!px-3" style={{ gap: 12, paddingLeft: 17, paddingRight: 17 }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="la-page-title">{t("page.title")}</span>
        <span className="eyebrow eyebrow-sm tabular-nums max-md:hidden" style={{ color: "var(--mute-2)" }} data-testid="leads-total">#{p.total}</span>
      </div>
      {p.showTabs && (
        <div className="la-seg la-seg--main shrink-0" role="tablist">
          {p.viewTabs.map((tab) => (
            <button key={tab.id} onClick={() => p.onViewSwitch(tab.id)} role="tab" aria-selected={p.viewMode === tab.id} className={`la-seg-btn${p.viewMode === tab.id ? " on" : ""}`}>
              <tab.icon size={14} style={{ flexShrink: 0 }} />
              {t(tab.tKey)}
            </button>
          ))}
        </div>
      )}
      {p.quickControls}
      <div className="flex-1 min-w-0" />
      <div className="shrink-0 flex items-center gap-[5px]">
        {/* Phones: no Compact and no Fold toggle; empty columns start folded instead. */}
        <TopbarIconButton label={compactLabel} onClick={() => p.setCompactMode((v) => !v)} aria-pressed={p.compactMode} className={cn("max-md:hidden", p.compactMode && "on")} data-testid="pipeline-compact">
          {p.compactMode ? <Expand className="h-4 w-4" /> : <Shrink className="h-4 w-4" />}
        </TopbarIconButton>
        <TopbarIconButton label={foldLabel} onClick={p.onFoldToggle} className="max-md:hidden" data-testid="pipeline-fold">
          <Rows3 className="h-4 w-4" />
        </TopbarIconButton>
        <TopbarSearch value={p.search} onChange={p.onSearch} placeholder={t("toolbar.searchPlaceholder")} />
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.filter")}><Filter className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {filterOn && <ActiveDot />}
          </div>
          <DropdownMenuContent align="end" className="w-60 max-h-[460px] overflow-y-auto rounded-2xl">
            {p.viewFilter?.group}
            <MenuGroup label={t("filters.attributes")} count={attrCount}>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.setHasPhone(!p.hasPhone); }} className={row}>
                <Phone className={cn("h-4 w-4 shrink-0", p.hasPhone ? "text-brand-indigo" : "text-muted-foreground")} />
                <span className={cn("text-sm flex-1", p.hasPhone && "font-semibold")}>{t("filters.hasPhone")}</span>
                {p.hasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.setHasEmail(!p.hasEmail); }} className={row}>
                <Mail className={cn("h-4 w-4 shrink-0", p.hasEmail ? "text-brand-indigo" : "text-muted-foreground")} />
                <span className={cn("text-sm flex-1", p.hasEmail && "font-semibold")}>{t("filters.hasEmail")}</span>
                {p.hasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            </MenuGroup>
            {filterOn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { p.setHasPhone(false); p.setHasEmail(false); p.viewFilter?.clear(); }} className={cn(row, "text-muted-foreground")}>
                  <X className="h-4 w-4 shrink-0" /><span className="text-sm">{t("toolbar.clearAll")}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.sort")}><ArrowUpDown className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {p.sortBy !== null && <ActiveDot />}
          </div>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl">
            {([[null, "sort.default"], ["recency", "sort.recency"], ["alpha", "sort.alphaAZ"]] as [PipelineSort, string][]).map(([v, k]) => (
              <DropdownMenuItem key={String(v)} onClick={() => p.setSortBy(v)} className={row}>
                <span className={cn("text-sm flex-1", p.sortBy === v && "font-semibold")}>{t(k)}</span>
                {p.sortBy === v && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
