import { useMemo, useState, useEffect } from "react";
import DataTable, { SortConfig, RowSpacing } from "@/components/DataTable/DataTable";
import { useLeads } from "@/hooks/useLeads";
import { useWorkspace } from "@/hooks/useWorkspace";

const GLOBAL_COLUMNS = ["Id", "Image", "full_name", "conversion_status"];

const ALL_FIELDS = [
  ...GLOBAL_COLUMNS,
  "first_name", "last_name", "email", "phone", "language", "timezone",
  "priority", "automation_status", "manual_takeover", "opted_out", "dnc_reason",
  "Account", "Campaign", "Interactions", "last_interaction_at", "last_message_sent_at",
  "last_message_received_at", "message_count_sent", "message_count_received",
  "booked_call_date", "booking_confirmed_at", "booking_confirmation_sent",
  "no_show", "re-scheduled_count", "current_bump_stage", "next_action_at",
  "first_message_sent_at", "bump_1_sent_at", "bump_2_sent_at", "bump_3_sent_at",
  "ai_sentiment", "ai_memory", "notes", "created_at", "updated_at",
  "account_id", "campaign_id"
];

const BASICS_FIELDS = [
  ...GLOBAL_COLUMNS,
  "first_name", "last_name", "email", "phone", "Leads_Tags",
  "automation_status", "priority", "Account", "Campaign", "notes"
];

const ENGAGEMENT_FIELDS = [
  ...GLOBAL_COLUMNS,
  "Interactions", "last_interaction_at", "last_message_sent_at",
  "last_message_received_at", "message_count_sent", "message_count_received",
  "current_bump_stage", "next_action_at", "manual_takeover", "opted_out"
];

const BOOKING_FIELDS = [
  ...GLOBAL_COLUMNS,
  "booked_call_date", "booking_confirmed_at", "booking_confirmation_sent",
  "no_show", "re-scheduled_count", "automation_status", "current_bump_stage",
  "next_action_at", "Campaign", "Account"
];

const VIEW_PRESETS = [
  { key: "all_fields", label: "All Fields", columns: ALL_FIELDS },
  { key: "basics", label: "Basics", columns: BASICS_FIELDS },
  { key: "engagement", label: "Engagement", columns: ENGAGEMENT_FIELDS },
  { key: "booking", label: "Booking & Automation", columns: BOOKING_FIELDS }
];

export function LeadsTable() {
  const { currentAccountId } = useWorkspace();
  const { leads, isLoading, handleRefresh } = useLeads({ accountId: currentAccountId });
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState(VIEW_PRESETS[0]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(VIEW_PRESETS[0].columns);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "created_at", direction: "desc" });
  const [groupBy, setGroupBy] = useState<string>("None");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    setVisibleColumns(activePreset.columns);
  }, [activePreset]);

  const rows = useMemo(() => {
    return leads.map(l => ({
      ...l,
      Id: l.id,
      Account: l.account_name || `Account ${l.account_id}`,
      Campaign: l.campaign_name || `Campaign ${l.campaign_id}`,
      Interactions: (l.message_count_sent || 0) + (l.message_count_received || 0),
      Leads_Tags: l.tags?.join(", ") || "",
      account_id: l.account_id,
      campaign_id: l.campaign_id
    }));
  }, [leads]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      !search || 
      r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [rows, search]);

  const handleUpdate = (id: number, col: string, val: any) => {
    console.log("Update", id, col, val);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {VIEW_PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => setActivePreset(preset)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePreset.key === preset.key 
                ? "bg-white shadow-sm border border-border text-primary" 
                : "text-muted-foreground hover:bg-white/50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable
          loading={isLoading}
          rows={filteredRows}
          columns={ALL_FIELDS}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          colWidths={colWidths}
          onColWidthsChange={setColWidths}
          rowSpacing={rowSpacing}
          onRowSpacingChange={setRowSpacing}
          showVerticalLines={showVerticalLines}
          onShowVerticalLinesChange={setShowVerticalLines}
          onUpdate={handleUpdate}
          statusOptions={["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "DND"]}
          typeOptions={[]}
          timezoneOptions={["Europe/Amsterdam", "America/New_York", "UTC", "America/Los_Angeles", "Asia/Tokyo"]}
          hiddenFields={[]}
          nonEditableFields={["Id", "Interactions", "account_id", "campaign_id"]}
          searchValue={search}
          onSearchValueChange={setSearch}
          onRefresh={handleRefresh}
          isRefreshing={isLoading}
        />
      </div>
    </div>
  );
}
