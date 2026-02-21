import { useMemo, useState, useEffect } from "react";
import DataTable, { SortConfig, RowSpacing } from "@/components/DataTable/DataTable";
import { useCampaignsData } from "../hooks/useCampaignsData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";

const CAMPAIGN_COLUMNS = [
  "Id", "Image", "name", "Account", "status", "Leads", "Interactions",
  "leads_total", "Created time", "Last modified time", "description",
  "account_id", "n8n_workflow_id", "ai_prompt_template", "total_cost",
  "bump_1_template", "bump_2_template", "bump_3_template",
  "bump_1_delay_hours", "bump_2_delay_hours copy", "bump_3_delay_hours",
  "daily_lead_limit", "message_interval_minutes", "active_hours_start",
  "active_hours_end", "calendar_link", "webhook_url", "ai_model",
  "use_ai_bumps", "max_bumps", "stop_on_response", "Automation Logs",
  "campaign_niche_override", "campaign_service", "campaign_usp",
  "target_audience", "niche_question", "qualification_criteria",
  "booking_mode_override", "calendar_link_override", "inquiries_source",
  "inquiry_timeframe", "what_lead_did", "First_Message", "agent_name",
  "service_name",
];

const SMALL_WIDTH_COLS = new Set([
  "Id", "Image", "status", "Leads", "Interactions", "leads_total",
  "use_ai_bumps", "max_bumps", "stop_on_response", "daily_lead_limit",
]);

export function CampaignsTable({ accountId, externalStatusFilter }: { accountId?: number; externalStatusFilter?: string }) {
  const { currentAccountId, isAgencyView } = useWorkspace();
  // If parent passes accountId (from CampaignsPage filter), use it.
  // Otherwise fall back to workspace-based filtering.
  const filterAccountId = accountId !== undefined
    ? accountId
    : (isAgencyView && currentAccountId === 1) ? undefined : currentAccountId;
  const { campaigns, loading, error, handleRefresh, setCampaigns, updateCampaignRow } = useCampaignsData(filterAccountId);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(CAMPAIGN_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("Account");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults = CAMPAIGN_COLUMNS.reduce((acc, c) => {
      acc[c] = SMALL_WIDTH_COLS.has(c) ? 120 : 200;
      return acc;
    }, {} as Record<string, number>);
    setColWidths((prev) => ({ ...defaults, ...prev }));
  }, []);

  const campaignsWithAccount = useMemo(() => {
    return campaigns.map(c => ({
      ...c,
      Account: c.account_name
    }));
  }, [campaigns]);

  // Use external status filter from parent page if provided, otherwise use internal state
  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;

  const filteredCampaigns = useMemo(() => {
    return campaignsWithAccount
      .filter((c) => (accountFilter === "all" ? true : c.account_id === accountFilter))
      .filter((c) => {
        if (effectiveStatusFilter === "all") return true;
        const s = String(c.status || "");
        if (effectiveStatusFilter === "Completed") {
          return s === "Completed" || s === "Finished";
        }
        return s === effectiveStatusFilter;
      })
      .filter((c) => (search ? String(c.name || "").toLowerCase().includes(search.toLowerCase()) : true));
  }, [campaignsWithAccount, search, accountFilter, effectiveStatusFilter]);

  const handleUpdate = async (rowId: number, col: string, value: any) => {
    try {
      await updateCampaignRow(rowId, col, value);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleAdd = () => {
    // In a real app, this would open a dialog
    const newId = Math.floor(Math.random() * 1000000);
    const newCampaign = {
      Id: newId,
      id: newId,
      name: "New Campaign",
      status: "Inactive",
      account_id: accountFilter === "all" ? 1 : accountFilter,
      Leads: 0,
      Interactions: 0,
      "Automation Logs": 0,
      created_at: new Date().toISOString()
    };
    setCampaigns(prev => [newCampaign, ...prev]);
  };

  const handleDelete = async (ids: number[]) => {
    setCampaigns(prev => prev.filter(c => !ids.includes(c.Id)));
  };

  const statusOptions = Array.from(new Set(campaigns.map((c) => c.status).filter(Boolean)));

  // Show error fallback when data fetch fails and we have no cached data to show
  if (error && campaigns.length === 0 && !loading) {
    return (
      <ApiErrorFallback
        error={error}
        onRetry={handleRefresh}
        isRetrying={loading}
      />
    );
  }

  return (
    <DataTable
      loading={loading}
      rows={filteredCampaigns}
      columns={CAMPAIGN_COLUMNS}
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
        { value: "status", label: "Group by Status" },
        { value: "Account", label: "Group by Account" },
      ]}
      colWidths={colWidths}
      onColWidthsChange={setColWidths}
      rowSpacing={rowSpacing}
      onRowSpacingChange={setRowSpacing}
      showVerticalLines={showVerticalLines}
      onShowVerticalLinesChange={setShowVerticalLines}
      onUpdate={handleUpdate}
      statusOptions={statusOptions.length ? statusOptions : ["Active", "Inactive"]}
      typeOptions={[]}
      timezoneOptions={[]}
      hiddenFields={[]}
      nonEditableFields={["Created time", "Last modified time", "Leads", "Interactions", "Automation Logs"]}
      smallWidthCols={Array.from(SMALL_WIDTH_COLS)}
      searchValue={search}
      onSearchValueChange={setSearch}
      onRefresh={handleRefresh}
      isRefreshing={loading}
      filterConfig={filterConfig}
      onFilterConfigChange={setFilterConfig}
      pageSize={50}
      emptyStateVariant={search ? "search" : "campaigns"}
    />
  );
}