// Topbar of the Leads page Table view: title + count, view tabs, inline bulk
// actions, search, and the Filter / Sort / Group / Settings menus. Extracted
// from LeadsTable.tsx. Filter options come from the server facets.
import { useTranslation } from "react-i18next";
import {
  Plus, Trash2, Copy, ArrowUpDown, Filter, Layers, Check, Upload, Download, Settings, X, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ALL_STAGE_KEYS, stageHex, stageLabel } from "../lib/leadDisplay";
import {
  TABLE_COL_META, DEFAULT_VISIBLE_COLS, TABLE_GROUP_TKEYS, TABLE_SORT_GROUPS, VIEW_TAB_KEYS,
  type TableGroupByOption, type TableSortByOption, type ViewMode,
} from "./leadsTableConfig";
import { ConfirmToolbarButton, TopbarSearch, ActiveDot } from "./LeadsTopbarParts";

type Opt = { id: string; name: string };

export interface TableFilters {
  status: string[];
  campaign: string;
  account: string;
  service: string[];
  source: string[];
  tags: string[];
  hasPhone: boolean;
  hasEmail: boolean;
}

export function LeadsTableTopbar(p: {
  total: number;
  viewTabs: typeof VIEW_TAB_KEYS;
  viewMode: ViewMode;
  onViewSwitch: (v: ViewMode) => void;
  selectedCount: number;
  onDuplicate: () => Promise<void> | void;
  onBulkDelete: () => Promise<void> | void;
  onClearSelection: () => void;
  deleteLabel: string;
  search: string;
  onSearch: (v: string) => void;
  filters: TableFilters;
  setFilter: <K extends keyof TableFilters>(k: K, v: TableFilters[K]) => void;
  toggleIn: (k: "status" | "service" | "source" | "tags", v: string) => void;
  clearFilters: () => void;
  isFilterActive: boolean;
  accounts: Opt[];
  campaigns: Opt[];
  services: string[];
  sources: string[];
  allTags: { name: string; color: string }[];
  sortBy: TableSortByOption;
  setSortBy: (v: TableSortByOption) => void;
  groupBy: TableGroupByOption;
  setGroupBy: (v: TableGroupByOption) => void;
  groupDir: "asc" | "desc";
  setGroupDir: (v: "asc" | "desc") => void;
  visibleCols: Set<string>;
  setVisibleCols: (fn: (prev: Set<string>) => Set<string>) => void;
  showVerticalLines: boolean;
  setShowVerticalLines: (v: boolean) => void;
  onImport: () => void;
  onExport: () => void;
  onResetColumnOrder: () => void;
  onResetColumnWidths: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation("leads");
  const f = p.filters;
  const item = "flex items-center gap-2 text-[12px]";
  const label = "text-[10px] uppercase tracking-widest text-muted-foreground";
  const check = (on: boolean) => on && <Check className="h-3 w-3 text-brand-indigo shrink-0" />;

  return (
    <div className="shrink-0 flex items-center gap-3" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)", paddingLeft: 17, paddingRight: 17 }}>
      <div className="flex items-baseline gap-2 shrink-0">
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.title")}</span>
        <span className="eyebrow eyebrow-sm tabular-nums" style={{ color: "var(--mute-2)" }} data-testid="leads-total">#{p.total}</span>
      </div>
      <div className="la-seg shrink-0">
        {p.viewTabs.map((tab) => (
          <button key={tab.id} onClick={() => p.onViewSwitch(tab.id)} className={`la-seg-btn${p.viewMode === tab.id ? " on" : ""}`} style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em" }}>
            <span className="flex items-center"><tab.icon size={13} /></span>
            {t(tab.tKey)}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-[5px] pr-1.5">
        {p.selectedCount > 0 && (
          <>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700 }}>
              {t("selection.countSelected", { count: p.selectedCount })}
            </span>
            <ConfirmToolbarButton icon={Copy} label={t("toolbar.duplicate")} onConfirm={p.onDuplicate} />
            <ConfirmToolbarButton icon={Trash2} label={p.deleteLabel} onConfirm={p.onBulkDelete} variant="danger" />
            <button className="la-btn la-btn--soft la-btn--icon" onClick={p.onClearSelection} title={t("selection.clearSelection")} aria-label={t("selection.clearSelection")}>
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-[5px]">
        <TopbarSearch value={p.search} onChange={p.onSearch} placeholder={t("toolbar.searchPlaceholder")} />

        {/* Filter */}
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.filter")}><Filter className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {p.isFilterActive && <ActiveDot />}
          </div>
          <DropdownMenuContent align="start" className="w-56 max-h-[460px] overflow-y-auto bg-white">
            <DropdownMenuLabel className={label}>{t("group.status")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_STAGE_KEYS.map((s) => (
              <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.toggleIn("status", s); }} className={item}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stageHex(s) }} />
                <span className="flex-1">{stageLabel(t, s)}</span>
                {check(f.status.includes(s))}
              </DropdownMenuItem>
            ))}
            {p.accounts.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={label}>{t("group.account")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); p.setFilter("account", ""); p.setFilter("campaign", ""); }} className={cn("text-[12px]", !f.account && "font-semibold text-brand-indigo")}>
                  {t("filters.allAccounts")} {!f.account && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {p.accounts.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={(e) => { e.preventDefault(); p.setFilter("account", f.account === a.id ? "" : a.id); p.setFilter("campaign", ""); }} className={cn("text-[12px]", f.account === a.id && "font-semibold text-brand-indigo")}>
                    <span className="flex-1 truncate">{a.name}</span>{check(f.account === a.id)}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {p.campaigns.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={label}>{t("group.campaign")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); p.setFilter("campaign", ""); }} className={cn("text-[12px]", !f.campaign && "font-semibold text-brand-indigo")}>
                  {t("filters.allCampaigns")} {!f.campaign && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {p.campaigns.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={(e) => { e.preventDefault(); p.setFilter("campaign", f.campaign === c.id ? "" : c.id); }} className={cn("text-[12px]", f.campaign === c.id && "font-semibold text-brand-indigo")}>
                    <span className="flex-1 truncate">{c.name}</span>{check(f.campaign === c.id)}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {p.services.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={label}>{t("group.service")}</DropdownMenuLabel>
                {p.services.map((s) => (
                  <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.toggleIn("service", s); }} className={item}>
                    <span className="flex-1 truncate">{s}</span>{check(f.service.includes(s))}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {p.sources.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={label}>{t("group.source")}</DropdownMenuLabel>
                {p.sources.map((s) => (
                  <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.toggleIn("source", s); }} className={item}>
                    <span className="flex-1 truncate">{s}</span>{check(f.source.includes(s))}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {p.allTags.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className={label}>{t("group.tag")}</DropdownMenuLabel>
                {p.allTags.map((tg) => (
                  <DropdownMenuItem key={tg.name} onClick={(e) => { e.preventDefault(); p.toggleIn("tags", tg.name); }} className={item}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tg.color || "var(--mute-2)" }} />
                    <span className="flex-1 truncate">{tg.name}</span>{check(f.tags.includes(tg.name))}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={label}>{t("filters.attributes")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); p.setFilter("hasPhone", !f.hasPhone); }} className={item}>
              <span className="flex-1">{t("filters.hasPhone")}</span>{check(f.hasPhone)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); p.setFilter("hasEmail", !f.hasEmail); }} className={item}>
              <span className="flex-1">{t("filters.hasEmail")}</span>{check(f.hasEmail)}
            </DropdownMenuItem>
            {p.isFilterActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={p.clearFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.sort")}><ArrowUpDown className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {p.sortBy !== "recent" && <ActiveDot />}
          </div>
          <DropdownMenuContent align="start" className="w-52 bg-white">
            {TABLE_SORT_GROUPS.map((g) => {
              const isActive = p.sortBy === g.asc || p.sortBy === g.desc;
              const dir = p.sortBy === g.asc ? "asc" : "desc";
              return (
                <DropdownMenuItem key={g.key} onSelect={(e) => { e.preventDefault(); p.setSortBy(isActive ? p.sortBy : g.desc); }} className="text-[12px] flex items-center gap-2">
                  <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{t(g.tKey)}</span>
                  {isActive && (
                    <>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setSortBy(g.asc); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "asc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowUp className="h-3 w-3" /></button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setSortBy(g.desc); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "desc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowDown className="h-3 w-3" /></button>
                    </>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Group */}
        <DropdownMenu>
          <div style={{ position: "relative" }}>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.group")}><Layers className="h-4 w-4 shrink-0" /></button>
            </DropdownMenuTrigger>
            {p.groupBy !== "status" && <ActiveDot />}
          </div>
          <DropdownMenuContent align="start" className="w-52 bg-white">
            {(Object.keys(TABLE_GROUP_TKEYS) as TableGroupByOption[]).map((opt) => (
              <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); p.setGroupBy(opt); }} className="text-[12px] flex items-center gap-2">
                <span className={cn("flex-1", p.groupBy === opt && "font-semibold !text-brand-indigo")}>{t(TABLE_GROUP_TKEYS[opt])}</span>
                {p.groupBy === opt && opt !== "none" && (
                  <>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setGroupDir("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setGroupDir("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowDown className="h-3 w-3" /></button>
                  </>
                )}
                {p.groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" title={t("toolbar.settings")}><Settings className="h-4 w-4 shrink-0" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[500px] overflow-y-auto bg-white">
            <DropdownMenuLabel className={label}>{t("toolbar.fields")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TABLE_COL_META.map((col) => {
              const on = p.visibleCols.has(col.key);
              return (
                <DropdownMenuItem key={col.key} onClick={(e) => { e.preventDefault(); p.setVisibleCols((prev) => { const next = new Set(prev); if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); } else next.add(col.key); return next; }); }} className={item}>
                  <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", on ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
                    {on && <Check className="h-2 w-2 text-white" />}
                  </div>
                  <span className="flex-1">{t(`table.columns.${col.key}`)}</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); p.setShowVerticalLines(!p.showVerticalLines); }} className={item}>
              <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", p.showVerticalLines ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
                {p.showVerticalLines && <Check className="h-2 w-2 text-white" />}
              </div>
              <span className="flex-1">{t("toolbar.verticalLines")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={p.onImport} className="text-[12px]"><Upload className="h-3.5 w-3.5 mr-2" /> {t("toolbar.importCsv")}</DropdownMenuItem>
            <DropdownMenuItem onClick={p.onExport} className="text-[12px]"><Download className="h-3.5 w-3.5 mr-2" /> {t("toolbar.exportCsv")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={p.onResetColumnOrder} className="text-[12px] text-muted-foreground">{t("toolbar.resetColumnOrder")}</DropdownMenuItem>
            <DropdownMenuItem onClick={p.onResetColumnWidths} className="text-[12px] text-muted-foreground">{t("toolbar.resetColumnWidths")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.setVisibleCols(() => new Set(DEFAULT_VISIBLE_COLS))} className="text-[12px] text-muted-foreground">{t("toolbar.resetToDefault")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button onClick={p.onAdd} className="la-btn la-btn--wine la-btn--icon" title={t("toolbar.add")}>
          <Plus className="h-[14px] w-[14px] shrink-0" />
        </button>
      </div>
    </div>
  );
}
