import { useState, useEffect } from "react";
import { fetchLeads } from "@/features/leads/api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";

interface UseLeadsOptions {
  accountId?: number | null;
}

export function useLeads({ accountId }: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const id = accountId ?? undefined;

    Promise.all([
      fetchLeads(id),
      apiFetch(id ? `/api/interactions?accountId=${id}` : "/api/interactions")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => (Array.isArray(d) ? d : d?.list ?? [])),
    ])
      .then(([leadsData, interactionsData]) => {
        if (cancelled) return;
        setLeads(leadsData);
        setInteractions(interactionsData);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return { leads, interactions, isLoading };
}
