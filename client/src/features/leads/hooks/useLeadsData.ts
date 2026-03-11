import { useState, useEffect, useRef } from "react";
import { fetchLeads, updateLead } from "../api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";

export function useLeadsData(accountId?: number) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const pendingSaves = useRef<Record<string, number>>({});

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch leads + lookup data in parallel for name resolution
      // Always fetch all accounts/campaigns for lookup (leads may reference cross-account entities)
      const [leadsList, accountsRaw, campaignsRaw] = await Promise.all([
        fetchLeads(accountId),
        apiFetch("/api/accounts")
          .then((r) => r.ok ? r.json() : []).catch(() => []),
        apiFetch("/api/campaigns")
          .then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);

      // Build lookup maps: id → name
      const accountsMap = new Map<number, string>();
      const acctArr = Array.isArray(accountsRaw) ? accountsRaw : [];
      for (const a of acctArr) {
        if (!a) continue;
        const id = Number(a.id || a.Id);
        if (id) accountsMap.set(id, a.name || a.Name || `Account ${id}`);
      }

      const campaignsMap = new Map<number, string>();
      const campArr = Array.isArray(campaignsRaw) ? campaignsRaw : campaignsRaw?.data ? campaignsRaw.data : [];
      for (const c of campArr) {
        if (!c) continue;
        const id = Number(c.id || c.Id);
        if (id) campaignsMap.set(id, c.name || c.Name || c.campaign_name || `Campaign ${id}`);
      }

      const normalized = leadsList.map((l: any) => {
        const rowId =
          l.Id || l.id || l.id_number || l.ID || Math.random();

        /* ---------------- RELATIONS ---------------- */

        const acctId = Number(l.Accounts_id || l.accounts_id || l.accountsId || 0);
        const accountName =
          l.account_name ||
          l.Account?.name ||
          l.Account?.Name ||
          accountsMap.get(acctId) ||
          (acctId ? `Account ${acctId}` : "No Account");

        const campId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
        const campaignName =
          l.campaign_name ||
          l.Campaign?.name ||
          l.Campaign?.Name ||
          campaignsMap.get(campId) ||
          (campId ? `Campaign ${campId}` : "No Campaign");

        /* ---------------- COUNTERS ---------------- */

        const interactionsCount = Array.isArray(
          l["interactions_id (from Interactions)"]
        )
          ? l["interactions_id (from Interactions)"].length
          : typeof l.Interactions === "number"
          ? l.Interactions
          : 0;

        const tagsCount = Array.isArray(l.Leads_Tags)
          ? l.Leads_Tags.length
          : typeof l.Leads_Tags === "number"
          ? l.Leads_Tags
          : 0;

        const logsCount = Array.isArray(l.Automation_Logs)
          ? l.Automation_Logs.length
          : typeof l.Automation_Logs === "number"
          ? l.Automation_Logs
          : 0;

        /* ---------------- IMAGE (ACRONYM) ---------------- */

        const first = l.first_name || "";
        const last = l.last_name || "";

        const acronym =
          `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
          "?";

        return {
          ...l,

          Id: rowId,
          id: rowId,

          /* UI-friendly fields */
          Account: accountName,
          Campaign: campaignName,
          Interactions: interactionsCount,
          Leads_Tags: tagsCount,
          Automation_Logs: logsCount,
          Image: acronym,

          /* Normalized timestamps */
          created_at:
            l.created_at || l.CreatedAt || l["Created time"],

          updated_at:
            l.updated_at || l.UpdatedAt || l["Last modified time"],

          conversion_status:
            l.conversion_status || l.Conversion_Status || l["Conversion Status"],

          email: l.Email || l.email,
          full_name: l.full_name || l.full_name_1 || `${l.first_name || ""} ${l.last_name || ""}`.trim() || "",
          phone: l.Phone || l.phone || l.phone_number || "",
        };
      });

      setLeads(normalized);
    } catch (err) {
      console.error("Failed to refresh leads", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const updateLeadRow = async (
    rowId: string | number,
    col: string,
    value: any
  ) => {
    const cleanValue =
      value === null || value === undefined ? "" : value;

    /* Optimistic update */
    setLeads((prev) =>
      prev.map((r) =>
        r.Id === rowId ? { ...r, [col]: cleanValue } : r
      )
    );

    const key = `${rowId}:${col}`;

    if (pendingSaves.current[key]) {
      window.clearTimeout(pendingSaves.current[key]);
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await updateLead(rowId, { [col]: cleanValue });

        toast({
          title: "Updated",
          description: "Saved changes to database.",
        });
      } catch (err) {
        console.error("Failed to update lead row", err);

        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Failed to save to database.",
        });

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
    leads,
    loading,
    error,
    handleRefresh,
    setLeads,
    updateLeadRow,
  };
}