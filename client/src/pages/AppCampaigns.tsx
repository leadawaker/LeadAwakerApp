import { useMemo, useState, useEffect } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { Filter, ChevronDown, Eye } from "lucide-react";
import DataTable, { SortConfig, RowSpacing } from "@/pages/DataTable";

/* ------------------------------------------------------------------ */
/* Mock accounts for mapping account_id to account name               */
/* ------------------------------------------------------------------ */
const mockAccounts = [
  { id: 1, name: "LeadAwaker Agency" },
  { id: 2, name: "FitnessGym ABC" },
  { id: 3, name: "LawFirm XYZ" },
];

/* ------------------------------------------------------------------ */
/* NocoDB API settings                                                */
/* ------------------------------------------------------------------ */
const TABLE_ID = "vwalnb0wa9mna9tn"; // campaigns table
const API_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";

/* ------------------------------------------------------------------ */
/* Column definitions                                                 */
/* ------------------------------------------------------------------ */
const CAMPAIGN_COLUMNS = [
  "id_number",
  "name",
  "Created time",
  "Last modified time",
  "status",
  "description",
  "type",
  "account_id",
  "n8n_workflow_id",
  "ai_prompt_template",
  "total_cost",
  "bump_1_template",
  "bump_2_template",
  "bump_3_template",
  "bump_1_delay_hours",
  "bump_2_delay_hours copy",
  "bump_3_delay_hours",
  "daily_lead_limit",
  "message_interval_minutes",
  "active_hours_start",
  "active_hours_end",
  "calendar_link",
  "webhook_url",
  "ai_model",
  "use_ai_bumps",
  "max_bumps",
  "stop_on_response",
  "Leads",
  "Interactions",
  "leads_total",
  "Automation Logs",
  "campaign_niche_override",
  "campaign_service",
  "campaign_usp",
  "target_audience",
  "niche_question",
  "qualification_criteria",
  "booking_mode_override",
  "calendar_link_override",
  "inquiries_source",
  "inquiry_timeframe",
  "what_lead_did",
  "ai_prompt_template_id",
  "First_Message",
  "agent_name",
  "service_name",
];

const SMALL_WIDTH_COLS = new Set([
  "id_number",
  "status",
  "type",
  "Leads",
  "Interactions",
  "leads_total",
  "use_ai_bumps",
  "max_bumps",
  "stop_on_response",
  "daily_lead_limit",
]);

/* ------------------------------------------------------------------ */

export default function AppCampaigns() {
  const { isAgencyView } = useWorkspace();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");

  const [visibleColumns, setVisibleColumns] = useState<string[]>(CAMPAIGN_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [groupBy, setGroupBy] = useState<string>("None");
  const [rowSpacing, setRowSpacing] = useState<RowSpacing>("medium");
  const [showVerticalLines, setShowVerticalLines] = useState<boolean>(true);
  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});

  const GROUP_OPTIONS = [
    { value: "None", label: "No Grouping" },
    { value: "status", label: "By Status" },
    { value: "account_id", label: "By Account" },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults = CAMPAIGN_COLUMNS.reduce((acc, c) => {
      acc[c] = SMALL_WIDTH_COLS.has(c) ? 120 : 200;
      return acc;
    }, {} as Record<string, number>);
    setColWidths((prev) => ({ ...defaults, ...prev }));
  }, []);

  /* ------------------------------------------------------------------ */
  /* Fetch campaigns from NocoDB via Netlify function                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}?tableId=${TABLE_ID}`);
        const data = await res.json();

        const normalized = (data?.list || []).map((c: any) => ({
          Id: c.id_number || c.id || c.ID,
          id_number: c.id_number || c.id || c.ID,
          name: c.name || "",
          "Created time": c["Created time"] || c.created_time || c.created_at || "",
          "Last modified time": c["Last modified time"] || c.updated_at || c.updatedAt || "",
          status: c.status || "",
          description: c.description || "",
          type: c.type || "",
          account_id: c.account_id || "",
          n8n_workflow_id: c.n8n_workflow_id || "",
          ai_prompt_template: c.ai_prompt_template || "",
          total_cost: c.total_cost || 0,
          bump_1_template: c.bump_1_template || "",
          bump_2_template: c.bump_2_template || "",
          bump_3_template: c.bump_3_template || "",
          bump_1_delay_hours: c.bump_1_delay_hours || "",
          "bump_2_delay_hours copy": c["bump_2_delay_hours copy"] || "",
          bump_3_delay_hours: c.bump_3_delay_hours || "",
          daily_lead_limit: c.daily_lead_limit || 0,
          message_interval_minutes: c.message_interval_minutes || 0,
          active_hours_start: c.active_hours_start || "",
          active_hours_end: c.active_hours_end || "",
          calendar_link: c.calendar_link || "",
          webhook_url: c.webhook_url || "",
          ai_model: c.ai_model || "",
          use_ai_bumps: c.use_ai_bumps ?? "",
          max_bumps: c.max_bumps ?? "",
          stop_on_response: c.stop_on_response ?? "",
          Leads: c.Leads || c.leads || [],
          Interactions: c.Interactions || c.interactions || [],
          leads_total: c.leads_total || 0,
          "Automation Logs": c.Automation_Logs || c["Automation Logs"] || [],
          campaign_niche_override: c.campaign_niche_override || "",
          campaign_service: c.campaign_service || "",
          campaign_usp: c.campaign_usp || "",
          target_audience: c.target_audience || "",
          niche_question: c.niche_question || "",
          qualification_criteria: c.qualification_criteria || "",
          booking_mode_override: c.booking_mode_override || "",
          calendar_link_override: c.calendar_link_override || "",
          inquiries_source: c.inquiries_source || "",
          inquiry_timeframe: c.inquiry_timeframe || "",
          what_lead_did: c.what_lead_did || "",
          ai_prompt_template_id: c.ai_prompt_template_id || "",
          First_Message: c.First_Message || "",
          agent_name: c.agent_name || "",
          service_name: c.service_name || "",
        }));

        setCampaigns(normalized);
      } catch (err) {
        console.error("Failed to fetch campaigns", err);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Apply search and filters                                           */
  /* ------------------------------------------------------------------ */
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => (accountFilter === "all" ? true : c.account_id === accountFilter))
      .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
      .filter((c) => (search ? String(c.name || "").toLowerCase().includes(search.toLowerCase()) : true));
  }, [campaigns, search, accountFilter, statusFilter]);

  const statusOptions = useMemo(() => {
    const set = new Set(filteredCampaigns.map((c) => c.status).filter(Boolean));
    return set.size ? Array.from(set) : ["Active", "Inactive"];
  }, [filteredCampaigns]);

  const typeOptions = useMemo(() => {
    const set = new Set(filteredCampaigns.map((c) => c.type).filter(Boolean));
    return set.size ? Array.from(set) : ["Outbound", "Inbound"];
  }, [filteredCampaigns]);

  const timezoneOptions: string[] = [];

  const hiddenFields: string[] = [];
  const nonEditableFields: string[] = ["Created time", "Last modified time", "Leads", "Interactions", "Automation Logs"];

  const handleUpdate = (rowId: number, col: string, value: any) => {
    setCampaigns((prev) =>
      prev.map((r) => (r.Id === rowId ? { ...r, [col]: value } : r))
    );
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <CrmShell>
      <div className="flex flex-col h-full pb-4">
        {/* TABLE */}
        <div className="flex-1">
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
            groupOptions={GROUP_OPTIONS}
            colWidths={colWidths}
            onColWidthsChange={setColWidths}
            rowSpacing={rowSpacing}
            onRowSpacingChange={setRowSpacing}
            showVerticalLines={showVerticalLines}
            onShowVerticalLinesChange={setShowVerticalLines}
            onUpdate={handleUpdate}
            statusOptions={statusOptions}
            typeOptions={typeOptions}
            timezoneOptions={timezoneOptions}
            hiddenFields={hiddenFields}
            nonEditableFields={nonEditableFields}
            smallWidthCols={[...SMALL_WIDTH_COLS]}
            searchValue={search}
            onSearchValueChange={setSearch}
            onRefresh={handleRefresh}
            isRefreshing={loading}
            filterConfig={filterConfig}
            onFilterConfigChange={setFilterConfig}
          />
        </div>
      </div>
    </CrmShell>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown components                                                 */
/* ------------------------------------------------------------------ */
function Dropdown({ label, children }: { label: string | undefined; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-11 px-4 rounded-2xl border border-slate-200 bg-white flex items-center gap-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
      >
        {label}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 min-w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 font-medium"
    >
      {children}
    </button>
  );
}