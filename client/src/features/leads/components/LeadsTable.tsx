import { useMemo, useState, useEffect, useCallback } from "react";
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
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import { LeadsKanban } from "./LeadsKanban";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { CsvImportWizard } from "./CsvImportWizard";
import { updateLead } from "../api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";
import { LayoutGrid, Table2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type ViewMode = "table" | "kanban";

export function LeadsTable() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  // For agency view with account 1 selected (all accounts), don't filter; otherwise filter by selected account
  const filterAccountId = (isAgencyView && currentAccountId === 1) ? undefined : currentAccountId;
  const { leads, loading, error, handleRefresh, updateLeadRow, setLeads } = useLeadsData(filterAccountId);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(LEAD_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("conversion_status");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  // Lead filter state
  const [leadFilters, setLeadFilters] = useState<LeadFilterState>({ ...EMPTY_FILTERS });

  // Lead-tag mapping for tag-based filtering (leadId → tag ID array)
  const [leadTagMap, setLeadTagMap] = useState<Map<number, number[]>>(new Map());
  // Full tag info for Kanban card display (leadId → [{name, color}])
  const [leadTagsInfo, setLeadTagsInfo] = useState<Map<number, { name: string; color: string }[]>>(new Map());
  // All tags by ID for quick lookup
  const [allTagsById, setAllTagsById] = useState<Map<number, { name: string; color: string }>>(new Map());

  useEffect(() => {
    const defaults = LEAD_COLUMNS.reduce((acc, c) => {
      acc[c] = c === "conversion_status" ? 180 : SMALL_WIDTH_COLS.has(c) ? 120 : 200;
      return acc;
    }, {} as Record<string, number>);
    setColWidths((prev) => ({ ...defaults, ...prev }));
  }, []);

  // Fetch all tags once for tag-name/color lookup
  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const res = await apiFetch("/api/tags");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.list || [];
          const byId = new Map<number, { name: string; color: string }>();
          list.forEach((t: any) => {
            byId.set(t.id, { name: t.name || `Tag ${t.id}`, color: t.color || "gray" });
          });
          setAllTagsById(byId);
        }
      } catch (err) {
        console.error("Failed to fetch all tags", err);
      }
    };
    fetchAllTags();
  }, []);

  // Fetch lead-tag mappings when leads change (for tag-based filtering + Kanban card display)
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

  // Build leadTagsInfo (leadId → [{name, color}]) whenever tagMap or allTagsById changes
  useEffect(() => {
    if (allTagsById.size === 0) return;
    const info = new Map<number, { name: string; color: string }[]>();
    leadTagMap.forEach((tagIds, leadId) => {
      const tagDetails = tagIds
        .map((id) => allTagsById.get(id))
        .filter((t): t is { name: string; color: string } => !!t);
      info.set(leadId, tagDetails);
    });
    setLeadTagsInfo(info);
  }, [leadTagMap, allTagsById]);

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

    // Augment each lead with a _primary_tag field (first tag name) for tag-based grouping.
    // Falls back to "Untagged" when no tags are assigned.
    result = result.map((l) => {
      const tags = leadTagsInfo.get(l.Id);
      const primaryTag = tags && tags.length > 0 ? tags[0].name : "Untagged";
      return { ...l, _primary_tag: primaryTag };
    });

    return result;
  }, [leads, search, leadFilters, leadTagMap, leadTagsInfo]);

  // Detect whether any filter is currently active (search, structured filters, or column filters)
  const hasActiveFilters = useMemo(() => {
    if (search) return true;
    if (leadFilters.pipelineStage) return true;
    if (leadFilters.campaignId) return true;
    if (leadFilters.tags.length > 0) return true;
    if (leadFilters.scoreMin > 0 || leadFilters.scoreMax < 100) return true;
    if (leadFilters.priority) return true;
    if (leadFilters.dateFrom || leadFilters.dateTo) return true;
    if (Object.keys(filterConfig).some((k) => filterConfig[k])) return true;
    return false;
  }, [search, leadFilters, filterConfig]);

  // Clear all active filters and search in one click
  const handleClearAllFilters = useCallback(() => {
    setSearch("");
    setLeadFilters({ ...EMPTY_FILTERS });
    setFilterConfig({});
  }, []);

  const handleUpdate = async (rowId: number, col: string, value: any) => {
    try {
      await updateLeadRow(rowId, col, value);
    } catch (err) {}
  };

  const handleDelete = (ids: number[]) => {
    console.log("Delete leads", ids);
    // In mockup mode, we'd just show a toast or log
  };

  /**
   * Called by LeadsKanban when a card is dragged to a different column.
   * 1. Optimistically updates the parent leads state so the kanban reflects the move instantly.
   * 2. Fires the PATCH API call (using the DB column name "Conversion_Status").
   * 3. On API failure:
   *    a. Calls handleRefresh() to revert the parent leads state from the server.
   *    b. Re-throws the error so LeadsKanban can immediately roll back its local
   *       snapshot without waiting for the server refresh to complete.
   */
  const handleKanbanLeadMove = useCallback(
    async (leadId: number | string, newStage: string) => {
      // Optimistic update in parent state (normalise both key forms used by the app)
      setLeads((prev) =>
        prev.map((l) =>
          l.Id === leadId || l.id === leadId
            ? {
                ...l,
                conversion_status: newStage,
                Conversion_Status: newStage,
              }
            : l
        )
      );

      try {
        // The PATCH route calls fromDbKeys which maps "Conversion_Status" → "conversionStatus"
        await updateLead(leadId, { Conversion_Status: newStage });
      } catch (err) {
        console.error("Failed to move lead to new stage", err);
        // Revert parent optimistic update by re-fetching from the server
        handleRefresh();
        // Re-throw so the Kanban's snapshot-based rollback fires immediately,
        // before the server refresh completes (gives instant UI feedback).
        throw err;
      }
    },
    [setLeads, handleRefresh]
  );

  const handleRowClick = useCallback((row: Record<string, any>) => {
    setSelectedLead(row);
    setDetailPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  const handleBulkActionComplete = useCallback(() => {
    // Refresh leads data and clear selection after any bulk action
    handleRefresh();
    setSelectedIds([]);
  }, [handleRefresh]);

  const renderBulkActions = useCallback(
    (ids: number[], clearSelection: () => void) => (
      <BulkActionsToolbar
        selectedIds={ids}
        onClearSelection={clearSelection}
        onActionComplete={handleBulkActionComplete}
      />
    ),
    [handleBulkActionComplete],
  );

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
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-blue/10 text-brand-blue text-xs font-medium">
            Stage: {leadFilters.pipelineStage}
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, pipelineStage: "" })}
              aria-label="Clear pipeline stage filter"
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
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-yellow/10 text-brand-yellow text-xs font-medium">
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
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-foreground text-xs font-medium">
            Date range
            <button
              className="ml-0.5 hover:text-red-600"
              onClick={() => setLeadFilters({ ...leadFilters, dateFrom: undefined, dateTo: undefined })}
            >
              &times;
            </button>
          </span>
        )}

        {/* Spacer to push view toggle to the right */}
        <div className="flex-1" />

        {/* Import CSV button */}
        <Button
          variant="outline"
          className="h-8 px-3 gap-1.5 text-xs font-semibold rounded-xl bg-card dark:bg-secondary border-border shadow-none"
          onClick={() => setImportWizardOpen(true)}
          data-testid="import-csv-button"
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Import CSV</span>
        </Button>

        {/* View toggle: Table vs Kanban */}
        <div
          className="inline-flex items-center rounded-xl border border-border bg-card dark:bg-secondary p-0.5 gap-0.5"
          data-testid="view-toggle"
        >
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              viewMode === "table"
                ? "bg-brand-blue text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-label="Table view"
            data-testid="view-toggle-table"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              viewMode === "kanban"
                ? "bg-brand-blue text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-label="Kanban view"
            data-testid="view-toggle-kanban"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      {/* Conditionally render Table or Kanban view */}
      {viewMode === "kanban" ? (
        <LeadsKanban
          leads={filteredLeads}
          loading={loading}
          campaignId={leadFilters.campaignId || undefined}
          leadTagsMap={leadTagsInfo}
          onLeadMove={handleKanbanLeadMove}
        />
      ) : (
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
            { value: "conversion_status", label: "By Stage" },
            { value: "Campaign", label: "By Campaign" },
            { value: "_primary_tag", label: "By Tag" },
            { value: "automation_status", label: "By Automation" },
            { value: "Account", label: "By Account" },
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
          virtualized={true}
          pageSizeOptions={[25, 50, 100]}
          emptyStateVariant={hasActiveFilters ? "search" : "leads"}
          emptyStateTitle={hasActiveFilters ? "No leads match your filters" : undefined}
          emptyStateDescription={
            hasActiveFilters
              ? "Try adjusting your search query or clearing active filters to see more results."
              : undefined
          }
          emptyStateActionLabel={hasActiveFilters ? "Clear all filters" : undefined}
          emptyStateOnAction={hasActiveFilters ? handleClearAllFilters : undefined}
          renderBulkActions={renderBulkActions}
          onRowClick={handleRowClick}
          exportable={true}
          exportFilename="leads"
        />
      )}

      {/* Lead Detail slide-over panel */}
      <LeadDetailPanel
        lead={selectedLead}
        open={detailPanelOpen}
        onClose={handleClosePanel}
      />

      {/* CSV Import Wizard */}
      <CsvImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImportComplete={handleRefresh}
        defaultAccountId={filterAccountId}
      />
    </div>
  );
}
