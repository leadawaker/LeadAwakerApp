import { useState, useEffect, useRef } from "react";
import { fetchLeads, updateLead } from "../api/leadsApi";
import { useToast } from "@/hooks/use-toast";

export function useLeadsData() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const pendingSaves = useRef<Record<string, number>>({});

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const leadsList = await fetchLeads();
      const normalized = leadsList.map((l: any) => ({
        ...l,
        Id: l.Id || l.id || l.id_number || Math.random(),
        email: l.Email || l.email,
        conversion_status: l.conversion_status || l["Conversion Status"],
        created_at: l.created_at || l.CreatedAt || l["Created time"],
        updated_at: l.updated_at || l.UpdatedAt || l["Last modified time"],
      }));
      setLeads(normalized);
    } catch (err) {
      console.error("Failed to refresh leads", err);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadRow = async (rowId: string | number, col: string, value: any) => {
    const cleanValue = value === null || value === undefined ? "" : value;

    setLeads((prev) =>
      prev.map((r) => (r.Id === rowId ? { ...r, [col]: cleanValue } : r))
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
  }, []);

  return {
    leads,
    loading,
    handleRefresh,
    setLeads,
    updateLeadRow
  };
}
