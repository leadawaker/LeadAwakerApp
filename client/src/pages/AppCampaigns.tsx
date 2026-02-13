import { useMemo, useState, useEffect } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { Filter, ChevronDown, Eye } from "lucide-react";
import DataTable, { SortConfig, RowSpacing } from "@/pages/DataTable";

/* ------------------------------------------------------------------ */
/* Dropdown components                                                 */
/* ------------------------------------------------------------------ */
/* NocoDB API settings                                                */
/* ------------------------------------------------------------------ */
const TABLE_ID = "vwalnb0wa9mna9tn";
const NOCODB_BASE_URL =
  "https://api-leadawaker.netlify.app/.netlify/functions/api";

/* ------------------------------------------------------------------ */
/* Column definitions                                                 */
/* ------------------------------------------------------------------ */
const CAMPAIGN_COLUMNS = [
  "Id",
  "name",
  "account_name",
  "status",
  "type",
  "Leads",
  "Interactions",
  "leads_total",
  "Created time",
  "Last modified time",
  "description",
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
  "First_Message",
  "agent_name",
  "service_name",
];

const SMALL_WIDTH_COLS = new Set([
  "Id",
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
  const [accounts, setAccounts] = useState<any[]>([]);
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
    { value: "account_name", label: "By Account" },
  ];

  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 1. Fetch Accounts from accounts table to map names correctly
      const accountsRes = await fetch(
        "https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m8hflvkkfj25aio"
      );
      const accountsData = await accountsRes.json();
      const accountsList = accountsData?.list || [];
      setAccounts(accountsList);

      // 2. Fetch Campaigns
      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`);
      const data = await res.json();
      
      // 3. Normalize list (NocoDB often returns {list: [...]})
      const list = Array.isArray(data) ? data : (data?.list || []);
      
      const normalized = list.map((c: any) => {
        const account = accountsList.find(
          (a: any) =>
            String(a.Id || a.id) === String(c.account_id)
        );
        
        const rowId = c.Id || c.id || c.id_number || c.ID || Math.random();
        
        return {
          ...c,
          Id: rowId,
          id: rowId,
          account_name: account?.name || account?.Name || c.account_id || "Unknown Account",
          Leads: Array.isArray(c.Leads) ? c.Leads.length : (typeof c.Leads === 'number' ? c.Leads : 0),
          Interactions: Array.isArray(c.Interactions) ? c.Interactions.length : (typeof c.Interactions === 'number' ? c.Interactions : 0),
          "Automation Logs": Array.isArray(c["Automation Logs"]) ? c["Automation Logs"].length : 0,
        };
      });
      setCampaigns(normalized);
    } catch (err) {
      console.error("Failed to refresh campaigns", err);
    } finally {
      setLoading(false);
    }
  };

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
    handleRefresh();
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
    const set = new Set(campaigns.map((c) => c.status).filter(Boolean));
    const list = Array.from(set);
    return list.length ? list : ["Active", "Inactive"];
  }, [campaigns]);

  const typeOptions = useMemo(() => {
    const set = new Set(campaigns.map((c) => c.type).filter(Boolean));
    const list = Array.from(set);
    return list.length ? list : ["Outbound", "Inbound"];
  }, [campaigns]);

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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 min-w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {children}
          </div>
        </>
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