// Topbar of the Leads page Pipeline (Kanban) view. Extracted from LeadsTable.tsx.
// The high-score filter and score sort were removed with the lead score.
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Filter, Check, Phone, Mail, X, Rows3, Shrink, Expand, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TopbarSearch, ActiveDot } from "./LeadsTopbarParts";
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
  canDelete: boolean;
  onDeleteSelected: () => void;
  search: string;
  onSearch: (v: string) => void;
  hasPhone: boolean;
  setHasPhone: (v: boolean) => void;
  hasEmail: boolean;
  setHasEmail: (v: boolean) => void;
  sortBy: PipelineSort;
  setSortBy: (v: PipelineSort) => void;
  /** Desktop: the quick view dropdown and channel tabs (LeadsQuickControls). */
  quickControls?: React.ReactNode;
}) {
  const { t } = useTranslation("leads");
  const filterOn = p.hasPhone || p.hasEmail;
  const row = "flex items-center gap-2 cursor-pointer rounded-xl";
  return (
    <div className="shrink-0 flex items-center gap-3 max-md:gap-2 la-m-chrome max-md:!px-3" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)", paddingLeft: 17, paddingRight: 17 }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.title")}</span>
        <span className="eyebrow eyebrow-sm tabular-nums max-md:hidden" style={{ color: "var(--mute-2)" }} data-testid="leads-total">#{p.total}</span>
      </div>
      {p.showTabs && (
        <div className="la-seg shrink-0">
          {p.viewTabs.map((tab) => (
            <button key={tab.id} onClick={() => p.onViewSwitch(tab.id)} className={`la-seg-btn${p.viewMode === tab.id ? " on" : ""}`} style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em" }}>
              <span className="flex items-center"><tab.icon size={13} /></span>
              {t(tab.tKey)}
            </button>
          ))}
        </div>
      )}
      {p.quickControls}
      <div className="flex-1 min-w-0" />
      <div className="shrink-0 flex items-center gap-[5px]">
        {/* Phones: no Compact and no Fold toggle; empty columns start folded instead. */}
        <button onClick={() => p.setCompactMode((v) => !v)} className={cn("la-btn la-btn--soft max-md:hidden", p.compactMode && "on")} title={t("toolbar.compactView")} style={{ fontSize: 11 }}>
          {p.compactMode ? <Expand size={13} /> : <Shrink size={13} />}
          {t("toolbar.compactView")}
        </button>
        <button onClick={p.onFoldToggle} className="la-btn la-btn--soft max-md:hidden" title={p.hasAnyCollapsed ? t("toolbar.unfold") : t("toolbar.fold")} style={{ fontSize: 11 }}>
          <Rows3 size={13} />
          {p.hasAnyCollapsed ? t("toolbar.unfold") : t("toolbar.fold")}
        </button>
        {p.canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("common.more")}><MoreHorizontal size={13} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-white">
              <DropdownMenuItem onClick={p.onDeleteSelected} className="text-destructive focus:text-destructive text-[12px]">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {t("detailView.deleteLead")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <TopbarSearch value={p.search} onChange={p.onSearch} placeholder={t("toolbar.searchPlaceholder")} />
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.filter")}><Filter className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {filterOn && <ActiveDot />}
          </div>
          <DropdownMenuContent align="start" className="w-60 rounded-2xl bg-white">
            <DropdownMenuItem onClick={() => p.setHasPhone(!p.hasPhone)} className={row}>
              <Phone className={cn("h-4 w-4 shrink-0", p.hasPhone ? "text-brand-indigo" : "text-muted-foreground")} />
              <span className={cn("text-sm flex-1", p.hasPhone && "font-semibold")}>{t("filters.hasPhone")}</span>
              {p.hasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.setHasEmail(!p.hasEmail)} className={row}>
              <Mail className={cn("h-4 w-4 shrink-0", p.hasEmail ? "text-brand-indigo" : "text-muted-foreground")} />
              <span className={cn("text-sm flex-1", p.hasEmail && "font-semibold")}>{t("filters.hasEmail")}</span>
              {p.hasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
            {filterOn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { p.setHasPhone(false); p.setHasEmail(false); }} className={cn(row, "text-muted-foreground")}>
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
          <DropdownMenuContent align="start" className="w-56 rounded-2xl bg-white">
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
