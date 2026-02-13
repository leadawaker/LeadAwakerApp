import { useState, useEffect, useMemo } from "react";
import { fetchAccounts, fetchCampaigns, updateCampaign } from "../api/campaignsApi";

export function useCampaignsData() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      console.error("Failed to refresh campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  const updateCampaignRow = async (rowId: string | number, col: string, value: any) => {
    try {
      // Optimistic update
      setCampaigns((prev) =>
        prev.map((r) => (r.Id === rowId ? { ...r, [col]: value } : r))
      );
      
      await updateCampaign(rowId, { [col]: value });
    } catch (err) {
      console.error("Failed to update campaign row", err);
      // Revert on error
      handleRefresh();
      throw err;
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  return {
    campaigns,
    accounts,
    loading,
    handleRefresh,
    setCampaigns,
    updateCampaignRow
  };
}