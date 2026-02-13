import { useMemo, useState } from "react";
import DataTable, { RowSpacing } from "@/components/DataTable/DataTable";
import { useCampaignsData } from "../hooks/useCampaignsData";

export function CampaignsTable() {
  const { 
    campaigns, 
    loading, 
    handleRefresh, 
    setCampaigns,
    columns,
    visibleColumns,
    setVisibleColumns,
    colWidths,
    setColWidths,
    sortConfig,
    setSortConfig,
    SMALL_WIDTH_COLS,
    NON_EDITABLE_FIELDS,
    HIDDEN_FIELDS
  } = useCampaignsData();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [groupBy, setGroupBy] = useState<string>("None");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => (accountFilter === "all" ? true : c.account_id === accountFilter))
      .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
      .filter((c) => (search ? String(c.name || "").toLowerCase().includes(search.toLowerCase()) : true));
  }, [campaigns, search, accountFilter, statusFilter]);

  const handleUpdate = (rowId: number, col: string, value: any) => {
    setCampaigns((prev) =>
      prev.map((r) => (r.Id === rowId ? { ...r, [col]: value } : r))
    );
  };

  const statusOptions = Array.from(new Set(campaigns.map((c) => c.status).filter(Boolean)));
  const typeOptions = Array.from(new Set(campaigns.map((c) => c.type).filter(Boolean)));

  return (
    <DataTable
      loading={loading}
      rows={filteredCampaigns}
      columns={columns}
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
        { value: "status", label: "By Status" },
        { value: "account_name", label: "By Account" },
      ]}
      colWidths={colWidths}
      onColWidthsChange={setColWidths}
      rowSpacing={rowSpacing}
      onRowSpacingChange={setRowSpacing}
      showVerticalLines={showVerticalLines}
      onShowVerticalLinesChange={setShowVerticalLines}
      onUpdate={handleUpdate}
      statusOptions={statusOptions.length ? statusOptions : ["Active", "Inactive"]}
      typeOptions={typeOptions.length ? typeOptions : ["Outbound", "Inbound"]}
      timezoneOptions={[]}
      hiddenFields={HIDDEN_FIELDS}
      nonEditableFields={NON_EDITABLE_FIELDS}
      smallWidthCols={SMALL_WIDTH_COLS}
      searchValue={search}
      onSearchValueChange={setSearch}
      onRefresh={handleRefresh}
      isRefreshing={loading}
      filterConfig={filterConfig}
      onFilterConfigChange={setFilterConfig}
    />
  );
}