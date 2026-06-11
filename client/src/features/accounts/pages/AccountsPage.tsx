// src/features/accounts/pages/AccountsPage.tsx
import { useMemo, useCallback, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import type { AccountRow } from "../components/AccountDetailsDialog";
import type { NewAccountForm } from "../components/AccountCreateDialog";
import { useAccountsData } from "../hooks/useAccountsData";
import { deleteAccount } from "../api/accountsApi";
import { AccountsWorkspace } from "../components/workspace/AccountsWorkspace";
import { LIST_PREFS_KEY } from "./pageWidgets";

// View vocabulary is kept for the list-panel grouping/sorting controls.
// AccountViewMode is retained for backwards-compat with listWidgets/accountListConstants.
export type AccountViewMode = "list" | "table";
export type AccountGroupBy = "status" | "type" | "none";
export type AccountSortBy = "recent" | "name_asc" | "name_desc";

export default function AccountsPage() {
  const { currentAccountId } = useWorkspace();

  // Clear any global topbar actions — the workspace owns its own top bar.
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  // ── Lifted list controls (persisted) ──────────────────────────────────────
  const [listSearch, setListSearch] = usePersistedState("accounts-list-search", "");
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
  const setGroupBy = useCallback((v: AccountGroupBy) => setListPrefs((pr) => ({ ...pr, groupBy: v })), [setListPrefs]);
  const setGroupDirection = useCallback((v: "asc" | "desc") => setListPrefs((pr) => ({ ...pr, groupDirection: v })), [setListPrefs]);
  const setSortBy = useCallback((v: AccountSortBy) => setListPrefs((pr) => ({ ...pr, sortBy: v })), [setListPrefs]);
  const setFilterStatus = useCallback(
    (v: string[] | ((p: string[]) => string[])) => setListPrefs((pr) => ({ ...pr, filterStatus: typeof v === "function" ? v(pr.filterStatus) : v })),
    [setListPrefs],
  );

  // ── Data ───────────────────────────────────────────────────────────────────
  const { rows: allRows, loading, fetchData, handleInlineUpdate, handleCreateRow } = useAccountsData(undefined);
  const rows = useMemo(
    () => (currentAccountId > 0 ? allRows.filter((r) => (r.id ?? r.Id) === currentAccountId) : allRows),
    [allRows, currentAccountId],
  );

  // ── Persisted selection ────────────────────────────────────────────────────
  const [selectedAccount, setSelectedAccount] = usePersistedSelection<AccountRow>(
    "selected-account-id",
    (a) => a.Id ?? a.id ?? 0,
    rows as AccountRow[],
  );

  // Auto-select first account when none is chosen.
  useEffect(() => {
    if (!selectedAccount && rows.length > 0) setSelectedAccount(rows[0] as AccountRow);
  }, [rows, selectedAccount, setSelectedAccount]);

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedAccount?.name ?? null);
    return () => setCrumb(null);
  }, [selectedAccount, setCrumb]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleDetailSave = useCallback(async (accountId: number, patch: Partial<AccountRow>) => {
    for (const [col, value] of Object.entries(patch)) {
      await handleInlineUpdate(accountId, col, value, [accountId]);
    }
    setSelectedAccount((prev) => (prev && (prev.Id ?? prev.id) === accountId ? ({ ...prev, ...patch } as AccountRow) : prev));
  }, [handleInlineUpdate, setSelectedAccount]);

  const handleFieldSave = useCallback(async (field: string, value: string) => {
    if (!selectedAccount) return;
    const aid = selectedAccount.Id ?? selectedAccount.id ?? 0;
    await handleDetailSave(aid, { [field]: value });
  }, [selectedAccount, handleDetailSave]);

  const handleCreate = useCallback(async (data: NewAccountForm) => {
    await handleCreateRow(data);
  }, [handleCreateRow]);

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
  }, [selectedAccount, fetchData, setSelectedAccount]);

  // ── Control flags ──────────────────────────────────────────────────────────
  const isFilterActive = filterStatus.length > 0;
  const isGroupNonDefault = groupBy !== "status";
  const isSortNonDefault = sortBy !== "recent";

  const toggleFilterStatus = useCallback((s: string) =>
    setFilterStatus((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])), [setFilterStatus]);

  const handleResetControls = useCallback(() => {
    setFilterStatus([]);
    setGroupBy("status");
    setGroupDirection("asc");
    setSortBy("recent");
  }, [setFilterStatus, setGroupBy, setGroupDirection, setSortBy]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AccountsWorkspace
        accounts={rows as AccountRow[]}
        loading={loading}
        selectedAccount={selectedAccount}
        onSelectAccount={setSelectedAccount}
        count={rows.length}
        onCreate={handleCreate}
        onSave={handleFieldSave}
        onDelete={handleDeleteAccount}
        listSearch={listSearch}
        onListSearchChange={setListSearch}
        filterStatus={filterStatus}
        onToggleFilterStatus={toggleFilterStatus}
        isFilterActive={isFilterActive}
        onResetControls={handleResetControls}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        isSortNonDefault={isSortNonDefault}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        groupDirection={groupDirection}
        onGroupDirectionChange={setGroupDirection}
        isGroupNonDefault={isGroupNonDefault}
      />
    </div>
  );
}
