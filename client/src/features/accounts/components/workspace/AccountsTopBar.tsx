import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Filter, Check, ArrowUpDown, ArrowUp, ArrowDown, Layers, Plus,
  PanelLeft, PanelLeftClose, MoreHorizontal, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import {
  STATUS_FILTER_OPTIONS, STATUS_I18N_KEY, GROUP_TKEYS,
} from "../listWidgets/accountListConstants";
import type { ListPanelState } from "@/hooks/useListPanelState";
import type { WorkspaceTab } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";

const TABS: WorkspaceTab[] = ["overview", "integrations", "knowledge", "communication"];
const SORT_OPTIONS: AccountSortBy[] = ["recent", "name_asc", "name_desc"];

interface Props {
  tab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  showTabs: boolean;
  count: number;
  listPanelState: ListPanelState;
  onCycle: () => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  isFilterActive: boolean;
  onResetControls: () => void;
  sortBy: AccountSortBy;
  onSortByChange: (v: AccountSortBy) => void;
  isSortNonDefault: boolean;
  groupBy: AccountGroupBy;
  onGroupByChange: (v: AccountGroupBy) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (v: "asc" | "desc") => void;
  isGroupNonDefault: boolean;
  onCreate: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

const wineDot = (
  <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)" }} />
);

export function AccountsTopBar(p: Props) {
  const { t } = useTranslation("accounts");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (deleteConfirm) { p.onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  };

  return (
    <div className="shrink-0 hidden md:flex items-center gap-2 px-[17px]" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.title")}</span>
      <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginLeft: 4 }}>#{p.count}</span>

      {p.showTabs && (
        <div className="la-seg shrink-0" style={{ marginLeft: 10 }}>
          {TABS.map((k) => (
            <button key={k} onClick={() => p.onTabChange(k)} className={`la-seg-btn${p.tab === k ? " on" : ""}`} style={{ padding: "8px 14px", fontSize: 11, letterSpacing: "0.13em" }}>
              {t(`workspace.tabs.${k}`)}
            </button>
          ))}
        </div>
      )}

      {/* Fold/cycle list panel */}
      <button className="la-btn la-btn--soft la-btn--icon" onClick={p.onCycle}
        title={p.listPanelState === "full" ? t("workspace.compactPanel") : p.listPanelState === "compact" ? t("workspace.hidePanel") : t("workspace.showPanel")}>
        {p.listPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative shrink-0" style={{ width: 180 }}>
        <input value={p.listSearch} onChange={(e) => p.onListSearchChange(e.target.value)} placeholder={t("page.searchPlaceholder")} className="neu-input" style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: 10, height: 32, fontSize: 12 }} />
        <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
      </div>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}>
            <Filter className="h-4 w-4 shrink-0" />{p.isFilterActive && wineDot}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white">
          {STATUS_FILTER_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ACCOUNT_STATUS_HEX[s] || "#94A3B8" }} />
              <span className={cn("flex-1", p.filterStatus.includes(s) && "font-bold text-brand-indigo")}>{t(STATUS_I18N_KEY[s] ?? s)}</span>
              {p.filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
          {p.isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={p.onResetControls} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />{p.isSortNonDefault && wineDot}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.onSortByChange("recent"); }} className="text-[12px] flex items-center gap-2">
            <span className={cn("flex-1", p.sortBy === "recent" && "font-semibold !text-brand-indigo")}>{t("sort.mostRecent")}</span>
          </DropdownMenuItem>
          {(() => {
            const isActive = p.sortBy === "name_asc" || p.sortBy === "name_desc";
            const dir = p.sortBy === "name_asc" ? "asc" : "desc";
            return (
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); p.onSortByChange(isActive ? p.sortBy : "name_desc"); }} className="text-[12px] flex items-center gap-2">
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{t("sort.name", { defaultValue: "Name" })}</span>
                {isActive && (
                  <>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onSortByChange("name_asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "asc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onSortByChange("name_desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "desc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowDown className="h-3 w-3" /></button>
                  </>
                )}
              </DropdownMenuItem>
            );
          })()}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}>
            <Layers className="h-4 w-4 shrink-0" />{p.isGroupNonDefault && wineDot}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {(Object.keys(GROUP_TKEYS) as AccountGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); p.onGroupByChange(opt); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", p.groupBy === opt && "font-semibold !text-brand-indigo")}>{t(GROUP_TKEYS[opt])}</span>
              {p.groupBy === opt && opt !== "none" && (
                <>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onGroupDirectionChange("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onGroupDirectionChange("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}><ArrowDown className="h-3 w-3" /></button>
                </>
              )}
              {p.groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow menu — left of Create */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon"><MoreHorizontal className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 bg-white">
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={!p.hasSelection} className={cn("flex items-center gap-2 text-[12px]", deleteConfirm ? "text-red-600" : "text-destructive")}>
            <Trash2 className="h-3.5 w-3.5" />{deleteConfirm ? t("detail.confirm") : t("toolbar.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create account — icon-only wine button */}
      <button className="la-btn la-btn--wine la-btn--icon" onClick={p.onCreate} title={t("workspace.createAccount")}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
