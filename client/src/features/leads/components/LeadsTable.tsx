import { useMemo, useState, useEffect } from "react";
import DataTable, { SortConfig, RowSpacing } from "@/components/DataTable/DataTable";
import { useLeadsData } from "../hooks/useLeadsData";
import { useWorkspace } from "@/hooks/useWorkspace";

const LEAD_COLUMNS = [
  /* Core */
  "Id",
  "Image",
  "full_name",
  "first_name",
  "last_name",

  /* Contact */
  "email",
  "phone",
  "language",

  /* Status */
  "conversion_status",
  "priority",
  "automation_status",
  "manual_takeover",
  "opted_out",
  "dnc_reason",

  /* Relations */
  "Account",
  "Campaign",

  /* Activity */
  "Interactions",
  "last_interaction_at",
  "last_message_sent_at",
  "last_message_received_at",
  "message_count_sent",
  "message_count_received",

  /* Booking */
  "booked_call_date",
  "booking_confirmed_at",
  "booking_confirmation_sent",
  "no_show",
  "re-scheduled_count",

  /* Automation */
  "current_bump_stage",
  "next_action_at",
  "first_message_sent_at",
  "bump_1_sent_at",
  "bump_2_sent_at",
  "bump_3_sent_at",

  /* AI */
  "ai_sentiment",
  "ai_memory",

  /* Notes */
  "notes",

  /* Meta */
  "created_at",
  "updated_at",
];

const SMALL_WIDTH_COLS = new Set([
  "Id",
  "Image",
  "conversion_status",
  "priority",
  "Interactions",
  "current_bump_stage",
  "manual_takeover",
  "opted_out",
  "booking_confirmation_sent",
  "no_show",
]);

export function LeadsTable() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  // For agency view with account 1 selected (all accounts), don't filter; otherwise filter by selected account
  const filterAccountId = (isAgencyView && currentAccountId === 1) ? undefined : currentAccountId;
  const { leads, loading, handleRefresh, updateLeadRow } = useLeadsData(filterAccountId);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(LEAD_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("conversion_status");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults = LEAD_COLUMNS.reduce((acc, c) => {
      acc[c] = c === "conversion_status" ? 180 : SMALL_WIDTH_COLS.has(c) ? 120 : 200;
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

  const handleDelete = (ids: number[]) => {
    console.log("Delete leads", ids);
    // In mockup mode, we'd just show a toast or log
  };

  return (
    <DataTable
      loading={loading}
      rows={filteredLeads}
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
        { value: "conversion_status", label: "By Conversion" },
        { value: "automation_status", label: "By Automation Status" },
        { value: "Account", label: "By Account" },
        { value: "Campaign", label: "By Campaign" },
      ]}
      colWidths={colWidths}
      onColWidthsChange={setColWidths}
      rowSpacing={rowSpacing}
      onRowSpacingChange={setRowSpacing}
      showVerticalLines={showVerticalLines}
      onShowVerticalLinesChange={setShowVerticalLines}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onAdd={() => console.log("Add lead")}
      statusOptions={["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"]}
      automationStatusOptions={["completed", "queued", "active", "paused", "dnd", "error"]}
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
      pageSize={50}
    />
  );
}
