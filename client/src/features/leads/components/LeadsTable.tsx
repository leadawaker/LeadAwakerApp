import { useMemo, useState, useEffect } from "react";
import DataTable, { SortConfig, RowSpacing } from "@/components/DataTable/DataTable";
import { useLeadsData } from "../hooks/useLeadsData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import {
  LeadFilters,
  applyLeadFilters,
  EMPTY_FILTERS,
  type LeadFilterState,
} from "./LeadFilters";
import { apiFetch } from "@/lib/apiUtils";

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
  const { leads, loading, error, handleRefresh, updateLeadRow } = useLeadsData(filterAccountId);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(LEAD_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("conversion_status");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  // Lead filter state
  const [leadFilters, setLeadFilters] = useState<LeadFilterState>({ ...EMPTY_FILTERS });

  // Lead-tag mapping for tag-based filtering
  const [leadTagMap, setLeadTagMap] = useState<Map<number, number[]>>(new Map());

  useEffect(() => {
    const defaults = LEAD_COLUMNS.reduce((acc, c) => {
      acc[c] = c === "conversion_status" ? 180 : SMALL_WIDTH_COLS.has(c) ? 120 : 200;
      return acc;
    }, {} as Record<string, number>);
    setColWidths((prev) => ({ ...defaults, ...prev }));
  }, []);

  // Fetch lead-tag mappings when leads change (for tag-based filtering)
  useEffect(() => {
    const fetchLeadTags = async () => {
      if (leads.length === 0) return;
      try {
        const tagMap = new Map<number, number[]>();
        // Fetch tags for each lead in parallel (batched)
        const batchSize = 10;
        for (let i = 0; i < leads.length; i += batchSize) {
          const batch = leads.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(async (lead) => {
              const leadId = lead.Id || lead.id;
              const res = await apiFetch(`/api/leads/${leadId}/tags`);
              if (res.ok) {
                const data = await res.json();
                const tagIds = Array.isArray(data)
                  ? data.map((t: any) => t.Tags_id || t.tags_id || t.id)
                  : [];
                return { leadId, tagIds };
              }
              return { leadId, tagIds: [] as number[] };
            })
          );
          results.forEach((result) => {
            if (result.status === "fulfilled") {
              tagMap.set(result.value.leadId, result.value.tagIds);
            }
          });
        }
        setLeadTagMap(tagMap);
      } catch (err) {
        console.error("Failed to fetch lead tags for filtering", err);
      }
    };
    fetchLeadTags();
  }, [leads]);

  // Apply search filter and structured filters
  const filteredLeads = useMemo(() => {
    // First apply search
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => {
        const fullName = String(l.full_name || "").toLowerCase();
        const firstName = String(l.first_name || "").toLowerCase();
        const lastName = String(l.last_name || "").toLowerCase();
        const email = String(l.email || "").toLowerCase();
        const phone = String(l.phone || "").toLowerCase();
        const notes = String(l.notes || "").toLowerCase();
        return (
          fullName.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          notes.includes(q)
        );
      });
    }

    // Then apply structured filters
    result = applyLeadFilters(result, leadFilters, leadTagMap);

    return result;
  }, [leads, search, leadFilters, leadTagMap]);

  const handleUpdate = async (rowId: number, col: string, value: any) => {
    try {
      await updateLeadRow(rowId, col, value);
    } catch (err) {}
  };

  const handleDelete = (ids: number[]) => {
    console.log("Delete leads", ids);
    // In mockup mode, we'd just show a toast or log
  };

  // Show error fallback when data fetch fails and we have no cached data to show
  if (error && leads.length === 0 && !loading) {
    return (
      <ApiErrorFallback
        error={error}
        onRetry={handleRefresh}
        isRetrying={loading}
      />
    );
  }

  return (
    <div className="space-y-0">
      {/* Lead Filters toolbar row - renders above the DataTable */}
      <div className="flex items-center gap-2 mb-3">
        <LeadFilters filters={leadFilters} onFiltersChange={setLeadFilters} />
        {/* Show active filter summary badges */}
        {leadFilters.pipelineStage && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
            Stage: {leadFilters.pipelineStage}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, pipelineStage: "" })}
            >
              &times;
            </button>
          </span>
        )}
        {leadFilters.campaignId && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
            Campaign: #{leadFilters.campaignId}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, campaignId: "" })}
            >
              &times;
            </button>
          </span>
        )}
        {leadFilters.tags.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium">
            {leadFilters.tags.length} tag{leadFilters.tags.length > 1 ? "s" : ""}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, tags: [] })}
            >
              &times;
            </button>
          </span>
        )}
        {(leadFilters.scoreMin > 0 || leadFilters.scoreMax < 100) && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
            Score: {leadFilters.scoreMin}–{leadFilters.scoreMax}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, scoreMin: 0, scoreMax: 100 })}
            >
              &times;
            </button>
          </span>
        )}
        {leadFilters.priority && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            Priority: {leadFilters.priority}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, priority: "" })}
            >
              &times;
            </button>
          </span>
        )}
        {(leadFilters.dateFrom || leadFilters.dateTo) && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
            Date range
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, dateFrom: undefined, dateTo: undefined })}
            >
              &times;
            </button>
          </span>
        )}
      </div>

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
    </div>
  );
}
