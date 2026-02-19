import { useState, useEffect, useRef } from "react";
import { fetchLeads, updateLead } from "../api/leadsApi";
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
      const leadsList = await fetchLeads(accountId);

      const normalized = leadsList.map((l: any) => {
        const rowId =
          l.Id || l.id || l.id_number || l.ID || Math.random();

        /* ---------------- RELATIONS ---------------- */

        const accountName =
          l.account_name ||
          l.Account?.name ||
          l.Account?.Name ||
          l.account_id ||
          "Unknown Account";

        const campaignName =
          l.campaign_name ||
          l.Campaign?.name ||
          l.Campaign?.Name ||
          l.campaign_id ||
          "Unknown Campaign";

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