import { useState, useEffect, useMemo, useRef } from "react";
import { fetchCampaigns, updateCampaign } from "../api/campaignsApi";
import { fetchAccounts } from "../../accounts/api/accountsApi";
import { useToast } from "@/hooks/use-toast";

export function useCampaignsData(accountId?: number) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const pendingSaves = useRef<Record<string, number>>({});

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const accountsList = await fetchAccounts();
      setAccounts(accountsList);

      const campaignsList = await fetchCampaigns(accountId);
      
      const normalized = campaignsList.map((c: any) => {
        // API returns Accounts_id (capital A) from NocoDB field naming
        const rawAccountId = c.Accounts_id ?? c.accounts_id ?? c.account_id;
        const account = accountsList.find(
          (a: any) => String(a.Id || a.id) === String(rawAccountId)
        );

        const rowId = c.Id || c.id || c.id_number || c.ID || Math.random();

        return {
          ...c,
          Id: rowId,
          id: rowId,
          account_id: rawAccountId,
          account_name: account?.name || account?.Name || rawAccountId || "Unknown Account",
          Leads: Array.isArray(c.Leads) ? c.Leads.length : (typeof c.Leads === 'number' ? c.Leads : 0),
          Interactions: Array.isArray(c.Interactions) ? c.Interactions.length : (typeof c.Interactions === 'number' ? c.Interactions : 0),
          "Automation Logs": Array.isArray(c["Automation Logs"]) ? c["Automation Logs"].length : 0,
        };
      });
      setCampaigns(normalized);
    } catch (err) {
      console.error("Failed to refresh campaigns", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const updateCampaignRow = async (rowId: string | number, col: string, value: any) => {
    const cleanValue = value === null || value === undefined ? "" : value;

    // Optimistic update
    setCampaigns((prev) =>
      prev.map((r) => (r.Id === rowId ? { ...r, [col]: cleanValue } : r))
    );

    // debounce server save per (rowId, col)
    const key = `${rowId}:${col}`;
    if (pendingSaves.current[key]) {
      window.clearTimeout(pendingSaves.current[key]);
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await updateCampaign(rowId, { [col]: cleanValue });
        toast({
          title: "Updated",
          description: "Saved changes to database.",
        });
      } catch (err) {
        console.error("Failed to update campaign row", err);
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Failed to save to database.",
        });
        // Revert on error
        handleRefresh();
      } finally {
        delete pendingSaves.current[key];
      }
    }, 500);

    pendingSaves.current[key] = timeoutId;
  };

  useEffect(() => {
    handleRefresh();
  }, [accountId]);

  return {
    campaigns,
    accounts,
    loading,
    error,
    handleRefresh,
    setCampaigns,
    updateCampaignRow
  };
}