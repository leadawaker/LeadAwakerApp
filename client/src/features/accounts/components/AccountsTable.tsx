// src/features/accounts/components/AccountsTable.tsx
import React from "react";
import DataTable, { SortConfig } from "@/components/DataTable/DataTable";
import type { RowSpacing } from "@/components/DataTable/DataTable";
import type { DataTableRow } from "@/components/DataTable/DataTable";

interface AccountsTableProps {
  rows: DataTableRow[];
  loading: boolean;
  columns: string[];
  visibleColumns: string[];
  onVisibleColumnsChange: (cols: string[]) => void;
  colWidths: Record<string, number>;
  onColWidthsChange: (w: Record<string, number>) => void;
  sortConfig: SortConfig;
  onSortChange: (cfg: SortConfig) => void;

  // selection / presentation
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  groupBy: string;
  onGroupByChange: (g: string) => void;
  rowSpacing: RowSpacing;
  onRowSpacingChange: (s: RowSpacing) => void;
  showVerticalLines: boolean;
  onShowVerticalLinesChange: (v: boolean) => void;

  // behaviors
  onUpdate: (rowId: number, col: string, value: any) => void;
  onRefresh: () => void;
  isRefreshing: boolean;

  filterConfig: Record<string, string>;
  onFilterConfigChange: (cfg: Record<string, string>) => void;
  searchValue: string;
  onSearchValueChange: (v: string) => void;

  onAdd: () => void;
  onViewSelected: () => void;
  canViewSelected: boolean;
  onImportCSV: (file: File) => void;
  onExportCSV: () => void;

  /** Called when a row is clicked — opens the detail/edit dialog */
  onRowClick?: (row: DataTableRow) => void;
}

const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
const TYPE_OPTIONS = ["Agency", "Client"];
const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Dubai",
];

const HIDDEN_FIELDS: string[] = [];
const NON_EDITABLE_FIELDS: string[] = [];
const SMALL_WIDTH_COLS: string[] = [];

const WORKSPACE_VIEWS = [
  "Default View",
  "Sales Pipeline",
  "Customer Success",
  "Admin Dashboard",
];

export function AccountsTable(props: AccountsTableProps) {
  const {
    rows,
    loading,
    columns,
    visibleColumns,
    onVisibleColumnsChange,
    colWidths,
    onColWidthsChange,
    sortConfig,
    onSortChange,
    selectedIds,
    onSelectedIdsChange,
    groupBy,
    onGroupByChange,
    rowSpacing,
    onRowSpacingChange,
    showVerticalLines,
    onShowVerticalLinesChange,
    onUpdate,
    onRefresh,
    isRefreshing,
    filterConfig,
    onFilterConfigChange,
    searchValue,
    onSearchValueChange,
    onAdd,
    onViewSelected,
    canViewSelected,
    onImportCSV,
    onExportCSV,
    onRowClick,
  } = props;

  return (
    <DataTable
      loading={loading}
      rows={rows}
      columns={columns}
      visibleColumns={visibleColumns}
      onVisibleColumnsChange={onVisibleColumnsChange}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      sortConfig={sortConfig}
      onSortChange={onSortChange}
      groupBy={groupBy}
      onGroupByChange={onGroupByChange}
      colWidths={colWidths}
      onColWidthsChange={onColWidthsChange}
      rowSpacing={rowSpacing}
      onRowSpacingChange={onRowSpacingChange}
      showVerticalLines={showVerticalLines}
      onShowVerticalLinesChange={onShowVerticalLinesChange}
      onUpdate={onUpdate}
      statusOptions={STATUS_OPTIONS}
      typeOptions={TYPE_OPTIONS}
      timezoneOptions={TIMEZONE_OPTIONS}
      hiddenFields={HIDDEN_FIELDS}
      nonEditableFields={NON_EDITABLE_FIELDS}
      smallWidthCols={SMALL_WIDTH_COLS}
      filterConfig={filterConfig}
      onFilterConfigChange={onFilterConfigChange}
      searchValue={searchValue}
      onSearchValueChange={onSearchValueChange}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      workspaceViewOptions={WORKSPACE_VIEWS.map((v) => ({
        value: v,
        label: v,
      }))}
      activeWorkspaceView={"Default View"} // or controlled from page
      onWorkspaceViewChange={() => {}}
      onAdd={onAdd}
      addLabel="Add"
      onViewSelected={onViewSelected}
      canViewSelected={canViewSelected}
      onImportCSV={onImportCSV}
      onExportCSV={onExportCSV}
      pageSize={50}
      emptyStateVariant={searchValue ? "search" : "accounts"}
      onRowClick={onRowClick}
      columnLabelOverrides={{ name: "Account Name" }}
      nonResizableCols={["Id", "Image"]}
    />
  );
}
