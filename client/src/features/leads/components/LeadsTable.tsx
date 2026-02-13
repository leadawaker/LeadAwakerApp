import { useMemo, useState, useEffect } from "react";
import DataTable, { SortConfig, RowSpacing } from "@/components/DataTable/DataTable";
import { useLeadsData } from "../hooks/useLeadsData";

const LEAD_COLUMNS = [
  "Id", "Image", "full_name", "email", "phone", "conversion_status", "priority", 
  "account_name", "campaign_name", "source", "notes", "tags", "created_at", "updated_at"
];

const SMALL_WIDTH_COLS = new Set([
  "Id", "Image", "conversion_status", "priority"
]);

export function LeadsTable() {
  const { leads, loading, handleRefresh, updateLeadRow } = useLeadsData();
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(LEAD_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("account_name");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults = LEAD_COLUMNS.reduce((acc, c) => {
      acc[c] = SMALL_WIDTH_COLS.has(c) ? 120 : 200;
      return acc;
    }, {} as Record<string, number>);
    setColWidths((prev) => ({ ...defaults, ...prev }));
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => 
      search ? String(l.full_name || l.email || "").toLowerCase().includes(search.toLowerCase()) : true
    );
  }, [leads, search]);

  const handleUpdate = async (rowId: number, col: string, value: any) => {
    try {
      await updateLeadRow(rowId, col, value);
    } catch (err) {}
  };

  return (
    <DataTable
      loading={loading}
      rows={leads}
      columns={LEAD_COLUMNS}
      visibleColumns={visibleColumns}
      onVisibleColumnsChange={setVisibleColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      sortConfig={sortConfig}
      onSortChange={setSortConfig}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      groupOptions={[
        { value: "None", label: "No Grouping" },
        { value: "conversion_status", label: "By Status" },
        { value: "priority", label: "By Priority" },
        { value: "account_name", label: "By Account" },
        { value: "campaign_name", label: "By Campaign" },
      ]}
      colWidths={colWidths}
      onColWidthsChange={setColWidths}
      rowSpacing={rowSpacing}
      onRowSpacingChange={setRowSpacing}
      showVerticalLines={showVerticalLines}
      onShowVerticalLinesChange={setShowVerticalLines}
      onUpdate={handleUpdate}
      statusOptions={["New", "Contacted", "Responded", "Qualified", "Booked", "DND"]}
      typeOptions={[]}
      timezoneOptions={[]}
      hiddenFields={[]}
      nonEditableFields={["created_at", "updated_at"]}
      smallWidthCols={Array.from(SMALL_WIDTH_COLS)}
      searchValue={search}
      onSearchValueChange={setSearch}
      onRefresh={handleRefresh}
      isRefreshing={loading}
      filterConfig={filterConfig}
      onFilterConfigChange={setFilterConfig}
    />
  );
}
