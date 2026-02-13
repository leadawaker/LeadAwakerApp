// src/features/accounts/pages/AccountsPage.tsx
import React, { useMemo, useState } from "react";
import { useAccountsData } from "../hooks/useAccountsData";
import { AccountsTable } from "../components/AccountsTable";

  const accountId = undefined;
export default function AccountsPage() {
  const accountId = undefined; // Or get from context/params if needed

  const {
    rows,
    loading,
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
  const [groupBy, setGroupBy] = useState<string>("Type");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">(
    "medium",
  );
  const [showVerticalLines, setShowVerticalLines] = useState(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // dialogs / detail state, etc. live here

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
          onAdd={() => {/* open create dialog */}}
          onViewSelected={() => {/* open detail view */}}
          canViewSelected={selectedIds.length === 1}
          onImportCSV={(file) => {/* your CSV import */}}
          onExportCSV={() => {/* your CSV export */}}
        />

        {/* create dialog, delete confirmation, detail dialog, etc. */}
      </div>
    </div>
  );
}