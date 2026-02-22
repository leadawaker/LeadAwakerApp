// src/features/accounts/pages/AccountsPage.tsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { LayoutList, TableIcon } from "lucide-react";
import { useAccountsData } from "../hooks/useAccountsData";
import { AccountsTable } from "../components/AccountsTable";
import { AccountListView } from "../components/AccountListView";
import { AccountDetailsDialog } from "../components/AccountDetailsDialog";
import { AccountCreateDialog, type NewAccountForm } from "../components/AccountCreateDialog";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import type { DataTableRow } from "@/components/DataTable/DataTable";
import type { AccountRow } from "../components/AccountDetailsDialog";
import { cn } from "@/lib/utils";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { ViewTabStrip, type ViewTab } from "@/components/crm/ViewTabStrip";

type ViewMode = "list" | "table";

const ACCOUNT_VIEW_TABS: ViewTab<"list" | "table">[] = [
  { id: "list", label: "List", icon: LayoutList, testId: "accounts-view-list" },
  { id: "table", label: "Table", icon: TableIcon, testId: "accounts-view-table" },
];

export default function AccountsPage() {
  const {
    rows,
    loading,
    error,
    columns,
    visibleColumns,
    setVisibleColumns,
    colWidths,
    setColWidths,
    sortConfig,
    setSortConfig,
    fetchData,
    handleInlineUpdate,
    handleCreateRow,
  } = useAccountsData(undefined);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { setTopbarActions, clearTopbarActions } = useTopbarActions();

  useEffect(() => {
    setTopbarActions(
      <ViewTabStrip tabs={ACCOUNT_VIEW_TABS} activeTab={viewMode} onTabChange={setViewMode} />
    );
    return () => clearTopbarActions();
  }, [viewMode, setTopbarActions, clearTopbarActions]);

  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);

  // Table-mode only state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<string>("Type");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">("medium");
  const [showVerticalLines, setShowVerticalLines] = useState(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Edit slide-over
  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountRow | null>(null);

  // Auto-select first account
  useEffect(() => {
    if (!selectedAccount && rows.length > 0) {
      setSelectedAccount(rows[0] as AccountRow);
    }
  }, [rows, selectedAccount]);

  // Keep selectedAccount synced after refresh
  useEffect(() => {
    if (selectedAccount && rows.length > 0) {
      const aid = selectedAccount.Id ?? selectedAccount.id;
      const refreshed = rows.find((r) => (r.Id ?? r.id) === aid);
      if (refreshed) setSelectedAccount(refreshed as AccountRow);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const handleSelectAccount = useCallback((account: AccountRow) => {
    setSelectedAccount(account);
  }, []);

  const handleEditAccount = useCallback((account: AccountRow) => {
    setEditAccount(account);
    setEditOpen(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false);
    setEditAccount(null);
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
    setCreateOpen(false);
  }

  async function handleDetailSave(accountId: number, patch: Partial<AccountRow>) {
    for (const [col, value] of Object.entries(patch)) {
      await handleInlineUpdate(accountId, col, value, [accountId]);
    }
    const updated = rows.find((r) => (r.Id ?? r.id) === accountId);
    if (updated) {
      const merged = { ...updated, ...patch } as AccountRow;
      setSelectedAccount((prev) => (prev && (prev.Id ?? prev.id) === accountId ? merged : prev));
      if (editAccount && (editAccount.Id ?? editAccount.id) === accountId) {
        setEditAccount(merged);
      }
    }
  }

  // Table-mode filtered rows
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesFilter = Object.entries(filterConfig).every(
          ([col, val]) => !val || String(row[col] || "").toLowerCase().includes(val.toLowerCase())
        );
        const matchesSearch =
          !searchTerm ||
          Object.values(row).some((v) =>
            String(v).toLowerCase().includes(searchTerm.toLowerCase())
          );
        return matchesFilter && matchesSearch;
      }),
    [rows, filterConfig, searchTerm]
  );

  if (error && rows.length === 0 && !loading) {
    return <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />;
  }

  return (
    <>
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-hidden">
          {viewMode === "list" ? (
            <AccountListView
              accounts={rows as AccountRow[]}
              loading={loading}
              selectedAccount={selectedAccount}
              onSelectAccount={handleSelectAccount}
              onAddAccount={() => setCreateOpen(true)}
              onEditAccount={handleEditAccount}
              onToggleStatus={handleToggleStatus}
            />
          ) : (
            <AccountsTable
              rows={filteredRows}
              loading={loading}
              columns={columns}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              colWidths={colWidths}
              onColWidthsChange={setColWidths}
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              rowSpacing={rowSpacing}
              onRowSpacingChange={setRowSpacing}
              showVerticalLines={showVerticalLines}
              onShowVerticalLinesChange={setShowVerticalLines}
              onUpdate={handleInlineUpdate}
              onRefresh={fetchData}
              isRefreshing={loading}
              filterConfig={filterConfig}
              onFilterConfigChange={setFilterConfig}
              searchValue={searchTerm}
              onSearchValueChange={setSearchTerm}
              onAdd={() => setCreateOpen(true)}
              onViewSelected={() => {
                if (selectedIds.length === 1) {
                  const row = rows.find((r) => r.Id === selectedIds[0]);
                  if (row) handleEditAccount(row as AccountRow);
                }
              }}
              canViewSelected={selectedIds.length === 1}
              onImportCSV={() => {}}
              onExportCSV={() => {}}
              onRowClick={(row: DataTableRow) => handleEditAccount(row as AccountRow)}
            />
          )}
      </div>
    </div>

      {/* Edit slide-over */}
      {editOpen && editAccount && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={handleCloseEdit} />
          <div className={cn(
            "fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px]",
            "bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden",
            "animate-in slide-in-from-right duration-200 ease-out"
          )}>
            <AccountDetailsDialog
              account={editAccount}
              onClose={handleCloseEdit}
              onSave={handleDetailSave}
              panelMode
            />
          </div>
        </>
      )}

      {/* Create dialog */}
      <AccountCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
