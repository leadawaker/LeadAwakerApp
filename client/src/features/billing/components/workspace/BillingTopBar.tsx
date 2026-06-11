import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Receipt, PenLine, Wallet, Filter, Check, ArrowUpDown, ArrowUp, ArrowDown,
  Layers, Plus, PanelLeft, PanelLeftClose, MoreHorizontal, Trash2, CalendarDays,
  LayoutList, LayoutGrid, Building2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../../types";
import type { ListPanelState } from "@/hooks/useListPanelState";
import type { BillingGroupBy } from "./BillingListPanel";

type Tab = "invoices" | "contracts" | "expenses";
type ViewMode = "list" | "table";

const INVOICE_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"];
const CONTRACT_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Signed", "Expired", "Cancelled"];
const SORT_TKEYS: Record<string, string> = {
  recent: "sort.recent", oldest: "sort.oldestFirst",
  amount_desc: "sort.amountDesc", amount_asc: "sort.amountAsc",
  due_asc: "sort.dueSoonest", due_desc: "sort.latestFirst",
  name_asc: "sort.nameAZ", name_desc: "sort.nameZA",
};

const wineDot = (
  <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--wine)" }} />
);

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  isOwner: boolean;
  count: number;
  listPanelState: ListPanelState;
  onCycle: () => void;
  // search
  search: string;
  onSearchChange: (v: string) => void;
  // filter
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  isAgencyUser: boolean;
  accountFilter: number | "all";
  onAccountFilterChange: (v: number | "all") => void;
  accounts: Array<{ id: number; name: string | null }>;
  onResetFilters: () => void;
  // sort
  sortBy: string;
  onSortByChange: (v: string) => void;
  // group
  groupBy: BillingGroupBy;
  onGroupByChange: (v: BillingGroupBy) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (v: "asc" | "desc") => void;
  // expenses-only
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  availableYears: number[];
  yearFilter: number | null;
  onYearFilterChange: (v: number | null) => void;
  quarterFilter: string | null;
  onQuarterFilterChange: (v: string | null) => void;
  // actions
  onCreate: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

export function BillingTopBar(p: Props) {
  const { t } = useTranslation("billing");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isExpenses = p.tab === "expenses";
  const statusOptions = p.tab === "invoices" ? INVOICE_STATUS_OPTIONS : CONTRACT_STATUS_OPTIONS;
  const statusColors = p.tab === "invoices" ? INVOICE_STATUS_COLORS : CONTRACT_STATUS_COLORS;
  const isFilterActive = p.filterStatus.length > 0 || (p.isAgencyUser && p.accountFilter !== "all");
  const isSortNonDefault = p.sortBy !== "recent";
  const isGroupNonDefault = p.groupBy !== "none";
  const isDateActive = !!p.yearFilter || !!p.quarterFilter;

  const tabs: { id: Tab; label: string; icon: typeof Receipt }[] = [
    { id: "invoices", label: t("tabs.invoices"), icon: Receipt },
    ...(p.isOwner ? [{ id: "expenses" as Tab, label: t("tabs.expenses"), icon: Wallet }] : []),
    { id: "contracts", label: t("tabs.contracts"), icon: PenLine },
  ];

  const groupOptions: { id: BillingGroupBy; label: string }[] = isExpenses
    ? [{ id: "none", label: t("groupOptions.none") }, { id: "year_quarter", label: t("groupOptions.yearQuarter") }]
    : [{ id: "none", label: t("groupOptions.none") }, { id: "date", label: t("toolbar.date") }, { id: "status", label: t("statusFilter.status") }];

  const handleDelete = () => {
    if (deleteConfirm) { p.onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  };

  const newTitle = isExpenses ? t("toolbar.newExpense") : p.tab === "invoices" ? t("toolbar.newInvoice") : t("toolbar.newContract");

  return (
    <div className="shrink-0 hidden md:flex items-center gap-2 px-[17px]" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.title")}</span>
      <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginLeft: 4 }}>#{p.count}</span>

      <div className="la-seg shrink-0" style={{ marginLeft: 10 }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => p.onTabChange(id)} className={`la-seg-btn${p.tab === id ? " on" : ""}`} style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.08em" }}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* Fold/cycle list panel */}
      <button className="la-btn la-btn--soft la-btn--icon" onClick={p.onCycle}
        title={p.listPanelState === "full" ? t("workspace.compactPanel", "Compact") : p.listPanelState === "compact" ? t("workspace.hidePanel", "Hide") : t("workspace.showPanel", "Show")}>
        {p.listPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <div className="flex-1" />

      {/* View toggle (all tabs) */}
      <div className="la-seg shrink-0">
        <button onClick={() => p.onViewModeChange("list")} className={`la-seg-btn${p.viewMode === "list" ? " on" : ""}`} style={{ padding: "7px 12px", fontSize: 11 }}><LayoutList size={13} />{t("tabs.list")}</button>
        <button onClick={() => p.onViewModeChange("table")} className={`la-seg-btn${p.viewMode === "table" ? " on" : ""}`} style={{ padding: "7px 12px", fontSize: 11 }}><LayoutGrid size={13} />{t("tabs.table")}</button>
      </div>

      {/* Search */}
      <div className="relative shrink-0" style={{ width: 180 }}>
        <input value={p.search} onChange={(e) => p.onSearchChange(e.target.value)}
          placeholder={isExpenses ? t("toolbar.searchExpenses") : p.tab === "invoices" ? t("toolbar.searchInvoices") : t("toolbar.searchContracts")}
          className="neu-input" style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: 10, height: 32, fontSize: 12 }} />
        <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
      </div>

      {/* Date (expenses only) */}
      {isExpenses && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}><CalendarDays className="h-4 w-4 shrink-0" />{isDateActive && wineDot}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {p.availableYears.length > 0 && (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("dateFilter.year")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {p.availableYears.map((year) => (
                  <DropdownMenuItem key={year} onClick={() => p.onYearFilterChange(p.yearFilter === year ? null : year)} className={cn("text-[12px]", p.yearFilter === year && "font-semibold text-[color:var(--wine)]")}>
                    {year}{p.yearFilter === year && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("dateFilter.quarter")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["Q1", "Q2", "Q3", "Q4"].map((q) => (
              <DropdownMenuItem key={q} onClick={() => p.onQuarterFilterChange(p.quarterFilter === q ? null : q)} className={cn("text-[12px]", p.quarterFilter === q && "font-semibold text-[color:var(--wine)]")}>
                {q}{p.quarterFilter === q && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
            {isDateActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { p.onQuarterFilterChange(null); p.onYearFilterChange(null); }} className="text-[12px] text-destructive">{t("toolbar.clearDates")}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Filter (status + account) — not on expenses */}
      {!isExpenses && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}><Filter className="h-4 w-4 shrink-0" />{isFilterActive && wineDot}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto bg-white">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.status")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statusOptions.map((s) => (
              <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); p.onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[s]?.dot || "#94A3B8" }} />
                <span className={cn("flex-1", p.filterStatus.includes(s) && "font-bold")}>{t(`${p.tab}.statusLabels.${s}`, s)}</span>
                {p.filterStatus.includes(s) && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--wine)" }} />}
              </DropdownMenuItem>
            ))}
            {p.isAgencyUser && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => p.onAccountFilterChange("all")} className={cn("text-[12px]", p.accountFilter === "all" && "font-semibold text-[color:var(--wine)]")}>
                  {t("statusFilter.allAccounts", "All accounts")}{p.accountFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {p.accounts.map((acct) => (
                  <DropdownMenuItem key={acct.id} onClick={() => p.onAccountFilterChange(acct.id)} className={cn("text-[12px]", p.accountFilter === acct.id && "font-semibold text-[color:var(--wine)]")}>
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground mr-1.5" />{acct.name}{p.accountFilter === acct.id && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {isFilterActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={p.onResetFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}><ArrowUpDown className="h-4 w-4 shrink-0" />{isSortNonDefault && wineDot}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {(["recent", "oldest", "amount_desc", "amount_asc", "due_asc", "name_asc"]).map((opt) => (
            <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); p.onSortByChange(opt); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", p.sortBy === opt && "font-semibold text-[color:var(--wine)]")}>{t(SORT_TKEYS[opt], opt)}</span>
              {p.sortBy === opt && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" style={{ position: "relative" }}><Layers className="h-4 w-4 shrink-0" />{isGroupNonDefault && wineDot}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {groupOptions.map((opt) => (
            <DropdownMenuItem key={opt.id} onSelect={(e) => { e.preventDefault(); p.onGroupByChange(opt.id); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", p.groupBy === opt.id && "font-semibold text-[color:var(--wine)]")}>{opt.label}</span>
              {p.groupBy === opt.id && opt.id !== "none" && (
                <>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onGroupDirectionChange("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDirection === "asc" ? "text-[color:var(--wine)]" : "text-foreground/30")}><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onGroupDirectionChange("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.groupDirection === "desc" ? "text-[color:var(--wine)]" : "text-foreground/30")}><ArrowDown className="h-3 w-3" /></button>
                </>
              )}
              {p.groupBy === opt.id && opt.id === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow menu */}
      {p.isAgencyUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="la-btn la-btn--soft la-btn--icon"><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-white">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={!p.hasSelection} className={cn("flex items-center gap-2 text-[12px]", deleteConfirm ? "text-red-600" : "text-destructive")}>
              <Trash2 className="h-3.5 w-3.5" />{deleteConfirm ? t("contracts.actions.confirm") : t("toolbar.delete", "Delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Create — icon-only wine button */}
      {p.isAgencyUser && (
        <button className="la-btn la-btn--wine la-btn--icon" onClick={p.onCreate} title={newTitle}>
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
