// src/features/accounts/pages/AccountsPage.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  List, Table2, Plus, Trash2, Copy, ArrowUpDown, Filter, Layers, Eye, Check,
} from "lucide-react";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { AccountListView } from "../components/AccountListView";
import { AccountsInlineTable } from "../components/AccountsInlineTable";
import type { AccountTableItem } from "../components/AccountsInlineTable";
import type { AccountRow } from "../components/AccountDetailsDialog";
import type { NewAccountForm } from "../components/AccountCreateDialog";
import { useAccountsData } from "../hooks/useAccountsData";
import { deleteAccount } from "../api/accountsApi";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { createAccount } from "../api/accountsApi";

export type AccountViewMode = "list" | "table";
export type AccountGroupBy  = "status" | "type" | "none";
export type AccountSortBy   = "recent" | "name_asc" | "name_desc";

const VIEW_MODE_KEY    = "accounts-view-mode";
const VISIBLE_COLS_KEY = "accounts-table-visible-cols";

/* ── Table column metadata for Fields dropdown ── */
const TABLE_COL_META = [
  { key: "name",            label: "Name",          defaultVisible: true  },
  { key: "status",          label: "Status",        defaultVisible: true  },
  { key: "type",            label: "Type",          defaultVisible: true  },
  { key: "owner_email",     label: "Owner Email",   defaultVisible: true  },
  { key: "phone",           label: "Phone",         defaultVisible: true  },
  { key: "business_niche",  label: "Niche",         defaultVisible: true  },
  { key: "website",         label: "Website",       defaultVisible: false },
  { key: "timezone",        label: "Timezone",      defaultVisible: false },
  { key: "max_daily_sends", label: "Daily Sends",   defaultVisible: false },
  { key: "notes",           label: "Notes",         defaultVisible: false },
];

const DEFAULT_VISIBLE = TABLE_COL_META.filter((c) => c.defaultVisible).map((c) => c.key);

/* ── Table sort / group types ── */
type TableSortByOption  = "recent" | "name_asc" | "name_desc";
type TableGroupByOption = "status" | "type" | "none";

const TABLE_SORT_LABELS: Record<TableSortByOption, string> = {
  recent:    "Most Recent",
  name_asc:  "Name A → Z",
  name_desc: "Name Z → A",
};

const TABLE_GROUP_LABELS: Record<TableGroupByOption, string> = {
  status: "Status",
  type:   "Type",
  none:   "None",
};

const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];
const ACCOUNT_STATUS_ORDER = ["Active", "Trial", "Inactive", "Suspended"];

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-emerald-500",
  Trial:     "bg-amber-500",
  Inactive:  "bg-slate-400",
  Suspended: "bg-rose-500",
};

/* ── Tab definitions ── */
const VIEW_TABS: TabDef[] = [
  { id: "list",  label: "List",  icon: List   },
  { id: "table", label: "Table", icon: Table2 },
];

// ── Inline confirmation button ────────────────────────────────────────────────
function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="h-10 flex items-center gap-1 rounded-full border border-border/30 bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-blue text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : "Yes"}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>No</button>
      </div>
    );
  }
  return (
    <button
      className={cn(
        "h-10 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shrink-0",
        variant === "danger"
          ? "border-red-300/50 text-red-600 hover:bg-red-50/60"
          : "border-border/30 text-foreground/70 hover:bg-card hover:text-foreground",
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function AccountsPage() {
  /* ── View mode (persisted) ─────────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<AccountViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && ["list", "table"].includes(stored)) return stored as AccountViewMode;
    } catch {}
    return "list";
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {}
  }, [viewMode]);

  /* ── Clear topbar actions (tabs are now inline) ─────────────────────────── */
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  /* ── Lifted list-view controls ─────────────────────────────────────────── */
  const [listSearch,   setListSearch]   = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [groupBy,      setGroupBy]      = useState<AccountGroupBy>("status");
  const [sortBy,       setSortBy]       = useState<AccountSortBy>("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  /* ── Table toolbar state ────────────────────────────────────────────────── */
  const [tableSearch,       setTableSearch]       = useState("");
  const [tableSortBy,       setTableSortBy]       = useState<TableSortByOption>("recent");
  const [tableGroupBy,      setTableGroupBy]      = useState<TableGroupByOption>("status");
  const [tableFilterStatus, setTableFilterStatus] = useState<string[]>([]);
  const [tableFilterType,   setTableFilterType]   = useState<string>("");
  const [tableSelectedIds,  setTableSelectedIds]  = useState<Set<number>>(new Set());

  /* ── Column visibility (persisted) ─────────────────────────────────────── */
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {}
  }, [visibleCols]);

  /* ── Data ───────────────────────────────────────────────────────────────── */
  const { rows, loading, fetchData, handleInlineUpdate, handleCreateRow } = useAccountsData(undefined);

  /* ── Persisted selection (after data hook) ───────────────────────────────── */
  const [selectedAccount, setSelectedAccount] = usePersistedSelection<AccountRow>(
    "selected-account-id",
    (a) => a.Id ?? a.id ?? 0,
    rows as AccountRow[],
  );

  /* ── View switch ────────────────────────────────────────────────────────── */
  const handleViewSwitch = useCallback((mode: AccountViewMode) => {
    setViewMode(mode);
    setSelectedAccount(null);
  }, []);

  const handleSelectAccount = useCallback((account: AccountRow) => {
    setSelectedAccount(account);
  }, []);

  const handleToggleStatus = useCallback((account: AccountRow) => {
    const aid = account.Id ?? account.id ?? 0;
    const newStatus = String(account.status) === "Active" ? "Inactive" : "Active";
    handleInlineUpdate(aid, "status", newStatus, [aid]);
    setSelectedAccount((prev) =>
      prev && (prev.Id ?? prev.id) === aid ? { ...prev, status: newStatus } : prev
    );
  }, [handleInlineUpdate]);

  async function handleCreate(data: NewAccountForm) {
    await handleCreateRow(data);
  }

  async function handleDetailSave(accountId: number, patch: Partial<AccountRow>) {
    for (const [col, value] of Object.entries(patch)) {
      await handleInlineUpdate(accountId, col, value, [accountId]);
    }
    const updated = rows.find((r) => (r.Id ?? r.id) === accountId);
    if (updated) {
      const merged = { ...updated, ...patch } as AccountRow;
      setSelectedAccount((prev) => (prev && (prev.Id ?? prev.id) === accountId ? merged : prev));
    }
  }

  const handleFieldSave = useCallback(async (field: string, value: string) => {
    if (!selectedAccount) return;
    const aid = selectedAccount.Id ?? selectedAccount.id ?? 0;
    await handleDetailSave(aid, { [field]: value });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccount) return;
    const aid = selectedAccount.Id ?? selectedAccount.id ?? 0;
    try {
      await deleteAccount(aid);
      setSelectedAccount(null);
      fetchData();
    } catch (err) {
      console.error("Delete account failed", err);
    }
  }, [selectedAccount, fetchData]);

  /* ── List-view control helpers ─────────────────────────────────────────── */
  const isGroupNonDefault     = groupBy !== "status";
  const isSortNonDefault      = sortBy !== "recent";
  const isFilterActive        = filterStatus.length > 0;
  const hasNonDefaultControls = isGroupNonDefault || isSortNonDefault || isFilterActive;

  const toggleFilterStatus = useCallback((s: string) =>
    setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);

  const handleResetControls = useCallback(() => {
    setFilterStatus([]);
    setGroupBy("status");
    setSortBy("recent");
  }, []);

  /* ── Table toolbar helpers ─────────────────────────────────────────────── */
  const toggleTableFilterStatus = useCallback((s: string) =>
    setTableFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const clearTableFilters = useCallback(() => {
    setTableFilterStatus([]);
    setTableFilterType("");
  }, []);
  const isTableFilterActive    = tableFilterStatus.length > 0 || !!tableFilterType;
  const tableActiveFilterCount = tableFilterStatus.length + (tableFilterType ? 1 : 0);

  /* ── Table bulk handlers ────────────────────────────────────────────────── */
  const handleAddAccount = useCallback(async () => {
    try {
      const created = await createAccount({ name: "New Account", status: "Active" });
      setTableSelectedIds(new Set([created.Id ?? created.id ?? 0]));
      fetchData();
    } catch (err) { console.error("Add account failed", err); }
  }, [fetchData]);

  const handleBulkDeleteAccounts = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(tableSelectedIds).map((id) => deleteAccount(id)));
      setTableSelectedIds(new Set());
      fetchData();
    } catch (err) { console.error("Bulk delete accounts failed", err); }
  }, [tableSelectedIds, fetchData]);

  const handleDuplicateAccounts = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      const toDup = rows.filter((r) => {
        const id = (r as any).Id ?? (r as any).id ?? 0;
        return tableSelectedIds.has(id);
      });
      await Promise.all(toDup.map((r) =>
        createAccount({ name: `${(r as any).name || "Account"} (Copy)`, status: (r as any).status || "Active" })
      ));
      fetchData();
    } catch (err) { console.error("Duplicate accounts failed", err); }
  }, [tableSelectedIds, rows, fetchData]);

  /* ── Available types (for table filter dropdown) ────────────────────────── */
  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => {
      const t = String(r.type || "");
      if (t) seen.add(t);
    });
    return Array.from(seen).sort();
  }, [rows]);

  /* ── Table flat items (filtered, sorted, grouped) ─────────────────────── */
  const tableFlatItems = useMemo((): AccountTableItem[] => {
    let source = [...rows] as AccountRow[];

    // Filter by status
    if (tableFilterStatus.length > 0) {
      source = source.filter((a) => tableFilterStatus.includes(String(a.status || "")));
    }
    // Filter by type
    if (tableFilterType) {
      source = source.filter((a) => String(a.type || "") === tableFilterType);
    }
    // Sort
    if (tableSortBy !== "recent") {
      source.sort((a, b) => {
        switch (tableSortBy) {
          case "name_asc":  return String(a.name || "").localeCompare(String(b.name || ""));
          case "name_desc": return String(b.name || "").localeCompare(String(a.name || ""));
          default: return 0;
        }
      });
    } else {
      source.sort((a, b) => {
        const da = a.updated_at || a.created_at || "";
        const db = b.updated_at || b.created_at || "";
        return db.localeCompare(da);
      });
    }

    // No grouping
    if (tableGroupBy === "none") {
      return source.map((a) => ({ kind: "account" as const, account: a }));
    }

    // Group
    const buckets = new Map<string, AccountRow[]>();
    source.forEach((a) => {
      const groupKey = tableGroupBy === "type"
        ? String(a.type || "Unknown")
        : String(a.status || "Unknown");
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey)!.push(a);
    });

    const orderedKeys =
      tableGroupBy === "status"
        ? ACCOUNT_STATUS_ORDER.filter((k) => buckets.has(k))
            .concat(Array.from(buckets.keys()).filter((k) => !ACCOUNT_STATUS_ORDER.includes(k)))
        : Array.from(buckets.keys()).sort();

    const result: AccountTableItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((a) => result.push({ kind: "account", account: a }));
    });
    return result;
  }, [rows, tableFilterStatus, tableFilterType, tableSortBy, tableGroupBy]);

  /* ── Table toolbar (rendered inline with tab buttons) ─────────────────── */
  const tableToolbar = (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search — always open */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-border/30 bg-card px-3 shrink-0">
        <svg className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
          placeholder="Search accounts…"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
        />
        {tableSearch && (
          <button onClick={() => setTableSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* +Add */}
      <ConfirmToolbarButton icon={Plus} label="Add" onConfirm={handleAddAccount} />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={ArrowUpDown} label="Sort" active={tableSortBy !== "recent"} activeValue={tableSortBy !== "recent" ? TABLE_SORT_LABELS[tableSortBy].split(" ")[0] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TABLE_SORT_LABELS) as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-blue")}>
              {TABLE_SORT_LABELS[opt]}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Filter} label="Filter" active={isTableFilterActive} activeValue={isTableFilterActive ? tableActiveFilterCount : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
              <span className="flex-1">{s}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-blue shrink-0" />}
            </DropdownMenuItem>
          ))}

          {availableTypes.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setTableFilterType(""); }}
                className={cn("text-[12px]", !tableFilterType && "font-semibold text-brand-blue")}
              >
                All Types {!tableFilterType && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableTypes.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={(e) => { e.preventDefault(); setTableFilterType((p) => p === t ? "" : t); }}
                  className={cn("text-[12px]", tableFilterType === t && "font-semibold text-brand-blue")}
                >
                  <span className="flex-1 truncate">{t}</span>
                  {tableFilterType === t && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearTableFilters} className="text-[12px] text-destructive">Clear all filters</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Layers} label="Group" active={tableGroupBy !== "status"} activeValue={tableGroupBy !== "status" ? TABLE_GROUP_LABELS[tableGroupBy] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_LABELS) as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-blue")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fields (Column Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Eye} label="Fields" active={visibleCols.size !== DEFAULT_VISIBLE.length} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Show / Hide Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TABLE_COL_META.map((col) => {
            const isVisible = visibleCols.has(col.key);
            return (
              <DropdownMenuItem
                key={col.key}
                onClick={(e) => {
                  e.preventDefault();
                  setVisibleCols((prev) => {
                    const next = new Set(prev);
                    if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); }
                    else next.add(col.key);
                    return next;
                  });
                }}
                className="flex items-center gap-2 text-[12px]"
              >
                <div className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  isVisible ? "bg-brand-blue border-brand-blue" : "border-border/50"
                )}>
                  {isVisible && <Check className="h-2 w-2 text-white" />}
                </div>
                <span className="flex-1">{col.label}</span>
                {!col.defaultVisible && (
                  <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))} className="text-[12px] text-muted-foreground">
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete / Duplicate — far right, when rows selected */}
      {tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            <ConfirmToolbarButton icon={Copy} label="Duplicate" onConfirm={handleDuplicateAccounts} />
            <ConfirmToolbarButton icon={Trash2} label="Delete" onConfirm={handleBulkDeleteAccounts} variant="danger" />
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">

          {/* ── List view ── */}
          {viewMode === "list" && (
            <AccountListView
              accounts={rows as AccountRow[]}
              loading={loading}
              selectedAccount={selectedAccount}
              onSelectAccount={handleSelectAccount}
              onAddAccount={() => {}}
              onCreate={handleCreate}
              onSave={handleFieldSave}
              onDelete={handleDeleteAccount}
              onToggleStatus={handleToggleStatus}
              // Lifted controls
              viewMode={viewMode}
              onViewModeChange={handleViewSwitch}
              listSearch={listSearch}
              onListSearchChange={setListSearch}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              filterStatus={filterStatus}
              onToggleFilterStatus={toggleFilterStatus}
              hasNonDefaultControls={hasNonDefaultControls}
              isGroupNonDefault={isGroupNonDefault}
              isSortNonDefault={isSortNonDefault}
              onResetControls={handleResetControls}
            />
          )}

          {/* ── Table view ── */}
          {viewMode === "table" && (
            <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden h-full">
              <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

                {/* Title */}
                <div className="px-3.5 pt-5 pb-1 shrink-0">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Accounts</h2>
                </div>

                {/* Controls row: tabs + inline toolbar */}
                <div className="px-3 pt-1.5 pb-2.5 shrink-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as AccountViewMode)} />

                  {/* Inline table toolbar */}
                  {tableToolbar}
                </div>

                {/* Table content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AccountsInlineTable
                    flatItems={tableFlatItems}
                    loading={loading}
                    selectedAccountId={selectedAccount ? (selectedAccount.Id ?? (selectedAccount as any).id ?? null) : null}
                    onSelectAccount={handleSelectAccount}
                    onRefresh={fetchData}
                    visibleCols={visibleCols}
                    tableSearch={tableSearch}
                    selectedIds={tableSelectedIds}
                    onSelectionChange={setTableSelectedIds}
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </>
  );
}
