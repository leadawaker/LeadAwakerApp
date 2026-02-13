import { useState, useEffect, useMemo, useRef } from "react";
import { fetchAccounts, fetchCampaigns } from "../api/campaignsApi";
import { useToast } from "@/hooks/use-toast";
import type { SortConfig } from "@/components/DataTable/DataTable";

const SMALL_WIDTH_COLS = [
  "Id", "status", "type", "Leads", "Interactions", "leads_total",
  "use_ai_bumps", "max_bumps", "stop_on_response", "daily_lead_limit",
];

const HIDDEN_FIELDS = [
  "account_id",
  "n8n_workflow_id",
  "ai_prompt_template",
  "bump_1_template",
  "bump_2_template",
  "bump_3_template",
  "webhook_url",
];

const NON_EDITABLE_FIELDS = [
  "Id",
  "account_name",
  "Leads",
  "Interactions",
  "leads_total",
  "Automation Logs",
  "Created time",
  "Last modified time",
];

export function useCampaignsData() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("campaigns_col_widths");
    return saved ? JSON.parse(saved) : {};
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem("campaigns_sort");
    return saved ? JSON.parse(saved) : { key: "", direction: null };
  });

  const { toast } = useToast();
  const pendingSaves = useRef<Record<string, number>>({});

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const accountsList = await fetchAccounts();
      setAccounts(accountsList);

      const campaignsList = await fetchCampaigns();
      
      const normalized = campaignsList.map((c: any) => {
        const account = accountsList.find(
          (a: any) => String(a.Id || a.id) === String(c.account_id)
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

      if (normalized.length > 0) {
        const allKeys = Object.keys(normalized[0]);
        const finalCols = allKeys.filter(k => !HIDDEN_FIELDS.includes(k));
        
        // Ensure ID is first if it exists
        const sortedCols = ["Id", ...finalCols.filter(c => c !== "Id")];
        
        setColumns(sortedCols);
        setVisibleColumns(sortedCols);

        const initialWidths = { ...colWidths };
        sortedCols.forEach((col) => {
          if (!initialWidths[col]) {
            if (col === "Id") initialWidths[col] = 80;
            else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 120;
            else initialWidths[col] = 180;
          }
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      console.error("Failed to refresh campaigns", err);
      toast({ variant: "destructive", title: "Error fetching campaigns" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const setColWidthsPersist = (next: Record<string, number>) => {
    setColWidths(next);
    localStorage.setItem("campaigns_col_widths", JSON.stringify(next));
  };

  const setSortConfigPersist = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("campaigns_sort", JSON.stringify(next));
  };

  return {
    campaigns,
    accounts,
    loading,
    columns,
    visibleColumns,
    setVisibleColumns,
    colWidths,
    setColWidths: setColWidthsPersist,
    sortConfig,
    setSortConfig: setSortConfigPersist,
    handleRefresh,
    setCampaigns,
    SMALL_WIDTH_COLS,
    HIDDEN_FIELDS,
    NON_EDITABLE_FIELDS
  };
}