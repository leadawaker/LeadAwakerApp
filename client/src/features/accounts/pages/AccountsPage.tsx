// src/features/accounts/pages/AccountsPage.tsx
import React, { useMemo, useState } from "react";
import { useAccountsData } from "../hooks/useAccountsData";
import { AccountsTable } from "../components/AccountsTable";
import { AccountDetailsDialog } from "../components/AccountDetailsDialog";
import { AccountCreateDialog, type NewAccountForm } from "../components/AccountCreateDialog";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import type { DataTableRow } from "@/components/DataTable/DataTable";

export default function AccountsPage() {
  const accountId = undefined;

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
    handleDelete,
    handleCreateRow,
  } = useAccountsData(accountId);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<string>("None");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">(
    "medium",
  );
  const [showVerticalLines, setShowVerticalLines] = useState(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // ── Create dialog state ───────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);

  async function handleCreate(data: NewAccountForm) {
    await handleCreateRow(data);
    setCreateOpen(false);
  }

  // ── Detail/Edit dialog state ─────────────────────────────────────────────
  const [detailAccount, setDetailAccount] = useState<DataTableRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function handleRowClick(row: DataTableRow) {
    setDetailAccount(row);
    setDetailOpen(true);
  }

  function handleDetailClose() {
    setDetailOpen(false);
    setDetailAccount(null);
  }

  async function handleDetailSave(accountId: number, patch: Record<string, any>) {
    // Use the existing handleInlineUpdate for each changed field
    const patchEntries = Object.entries(patch);
    for (const [col, value] of patchEntries) {
      await handleInlineUpdate(accountId, col, value, [accountId]);
    }
    // Refresh the detail account with the latest data
    const updated = rows.find((r) => (r.Id ?? r.id) === accountId);
    if (updated) {
      setDetailAccount({ ...updated, ...patch });
    }
  }

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesFilter = Object.entries(filterConfig).every(
          ([col, val]) => {
            if (!val) return true;
            return String(row[col] || "")
              .toLowerCase()
              .includes(val.toLowerCase());
          },
        );
        const matchesSearch =
          !searchTerm ||
          Object.values(row).some((v) =>
            String(v).toLowerCase().includes(searchTerm.toLowerCase()),
          );
        return matchesFilter && matchesSearch;
      }),
    [rows, filterConfig, searchTerm],
  );

  // Show error fallback when data fetch fails and we have no cached data
  if (error && rows.length === 0 && !loading) {
    return (
      <ApiErrorFallback
        error={error}
        onRetry={fetchData}
        isRetrying={loading}
      />
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full mx-auto space-y-6">
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
              if (row) handleRowClick(row);
            }
          }}
          canViewSelected={selectedIds.length === 1}
          onImportCSV={(file) => {/* your CSV import */}}
          onExportCSV={() => {/* your CSV export */}}
          onRowClick={handleRowClick}
        />

        {/* ── Account Detail / Edit Dialog ─────────────────────────────── */}
        <AccountDetailsDialog
          account={detailAccount}
          open={detailOpen}
          onClose={handleDetailClose}
          onSave={handleDetailSave}
        />

        {/* ── Create Account Dialog ─────────────────────────────────────── */}
        <AccountCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      </div>
    </div>
  );
}
