// src/features/accounts/pages/AccountsPage.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { List, Table2 } from "lucide-react";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useWorkspace } from "@/hooks/useWorkspace";
import { AccountListView } from "../components/AccountListView";
import { AccountsInlineTable } from "../components/AccountsInlineTable";
import type { AccountTableItem } from "../components/AccountsInlineTable";
import type { AccountRow } from "../components/AccountDetailsDialog";
import type { NewAccountForm } from "../components/AccountCreateDialog";
import { useAccountsData } from "../hooks/useAccountsData";
import { deleteAccount } from "../api/accountsApi";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { createAccount, updateAccount } from "../api/accountsApi";
import {
  AccountViewMode,
  AccountGroupBy,
  AccountSortBy,
  TableSortByOption,
  TableGroupByOption,
  VIEW_MODE_KEY,
  VISIBLE_COLS_KEY,
  LIST_PREFS_KEY,
  TABLE_PREFS_KEY,
  DEFAULT_VISIBLE,
  ACCOUNT_STATUS_ORDER,
  TableToolbar,
} from "./pageWidgets";

export type { AccountViewMode, AccountGroupBy, AccountSortBy } from "./pageWidgets";

export default function AccountsPage() {
  const { t } = useTranslation("accounts");
  const { currentAccountId } = useWorkspace();

  const VIEW_TABS: TabDef[] = [
    { id: "list",  label: t("views.list"),  icon: List   },
    { id: "table", label: t("views.table"), icon: Table2 },
  ];

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

  /* ── Lifted list-view controls (persisted) ─────────────────────────────── */
  const [listSearch,   setListSearch]   = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [listPrefs, setListPrefs] = usePersistedState(LIST_PREFS_KEY, {
    groupBy: "status" as AccountGroupBy,
    sortBy: "recent" as AccountSortBy,
    filterStatus: [] as string[],
    groupDirection: "asc" as "asc" | "desc",
  });
  const groupBy = listPrefs.groupBy;
  const sortBy = listPrefs.sortBy;
  const filterStatus = listPrefs.filterStatus;
  const groupDirection = listPrefs.groupDirection ?? "asc";
  const setGroupBy = useCallback((v: AccountGroupBy) => setListPrefs(p => ({ ...p, groupBy: v })), [setListPrefs]);
  const setGroupDirection = useCallback((v: "asc" | "desc") => setListPrefs(p => ({ ...p, groupDirection: v })), [setListPrefs]);
  const setSortBy = useCallback((v: AccountSortBy) => setListPrefs(p => ({ ...p, sortBy: v })), [setListPrefs]);
  const setFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setListPrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setListPrefs]);

  /* ── Table toolbar state (persisted) ────────────────────────────────────── */
  const [tableSearch,       setTableSearch]       = useState("");
  const [tablePrefs, setTablePrefs] = usePersistedState(TABLE_PREFS_KEY, {
    sortBy: "recent" as TableSortByOption,
    groupBy: "status" as TableGroupByOption,
    filterStatus: [] as string[],
    filterType: "",
  });
  const tableSortBy = tablePrefs.sortBy;
  const tableGroupBy = tablePrefs.groupBy;
  const tableFilterStatus = tablePrefs.filterStatus;
  const tableFilterType = tablePrefs.filterType;
  const setTableSortBy = useCallback((v: TableSortByOption) => setTablePrefs(p => ({ ...p, sortBy: v })), [setTablePrefs]);
  const setTableGroupBy = useCallback((v: TableGroupByOption) => setTablePrefs(p => ({ ...p, groupBy: v })), [setTablePrefs]);
  const setTableFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setTablePrefs]);
  const setTableFilterType = useCallback((v: string) => setTablePrefs(p => ({ ...p, filterType: v })), [setTablePrefs]);
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
  const { rows: allRows, loading, fetchData, handleInlineUpdate, handleCreateRow } = useAccountsData(undefined);
  // When admin has selected a specific subaccount, show only that account
  const rows = useMemo(
    () => currentAccountId > 0 ? allRows.filter(r => (r.id ?? r.Id) === currentAccountId) : allRows,
    [allRows, currentAccountId],
  );

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

  const handleSelectAccount = useCallback((account: AccountRow | null) => {
    setSelectedAccount(account);
  }, []);

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedAccount?.name ?? null);
    return () => setCrumb(null);
  }, [selectedAccount, setCrumb]);

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
    setGroupDirection("asc");
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

  const handleBulkStatusChange = useCallback(async (status: string) => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(tableSelectedIds).map((id) => updateAccount(id, { status })));
      setTableSelectedIds(new Set());
      fetchData();
    } catch (err) { console.error("Bulk status change failed", err); }
  }, [tableSelectedIds, fetchData]);

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
              onAddAccount={handleAddAccount}
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
              groupDirection={groupDirection}
              onGroupDirectionChange={setGroupDirection}
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

                {/* Title + 309px wrapper with ViewTabBar + toolbar */}
                <div className="pl-[17px] pr-[3px] pt-3 md:pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
                  <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
                    <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
                    <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as AccountViewMode)} variant="segment" />
                  </div>
                  <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
                  {/* Inline table toolbar */}
                  <TableToolbar
                    tableSearch={tableSearch}
                    onTableSearchChange={setTableSearch}
                    tableSortBy={tableSortBy}
                    onTableSortByChange={setTableSortBy}
                    isTableFilterActive={isTableFilterActive}
                    tableFilterStatus={tableFilterStatus}
                    onToggleTableFilterStatus={toggleTableFilterStatus}
                    availableTypes={availableTypes}
                    tableFilterType={tableFilterType}
                    onTableFilterTypeChange={setTableFilterType}
                    onClearTableFilters={clearTableFilters}
                    tableGroupBy={tableGroupBy}
                    onTableGroupByChange={setTableGroupBy}
                    visibleCols={visibleCols}
                    onVisibleColsChange={setVisibleCols}
                    tableSelectedIds={tableSelectedIds}
                    onClearSelection={() => setTableSelectedIds(new Set())}
                    onAddAccount={handleAddAccount}
                    onBulkStatusChange={handleBulkStatusChange}
                    onDuplicateAccounts={handleDuplicateAccounts}
                    onBulkDeleteAccounts={handleBulkDeleteAccounts}
                  />
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
