import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useEffect } from "react";

export interface AutomationLogsFilters {
  page: number;
  limit: number;
  accountId?: number;
  status?: string;
  workflowName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedLogsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

export interface AutomationSummary {
  total_executions: number;
  error_count_total: number;
  errors_today: number;
  avg_execution_time_ms: number | null;
  last_run_at: string | null;
  successRate: number | null;
  topFailingWorkflows: { workflow_name: string; fail_count: number }[];
}

export function useAutomationLogs(filters: AutomationLogsFilters) {
  const queryClient = useQueryClient();
  const query = useQuery<PaginatedLogsResponse>({
    queryKey: ["/api/automation-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(filters.page));
      params.set("limit", String(filters.limit));
      if (filters.accountId) params.set("accountId", String(filters.accountId));
      if (filters.status) params.set("status", filters.status);
      if (filters.workflowName) params.set("workflowName", filters.workflowName);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const res = await apiFetch(`/api/automation-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch automation logs");
      return res.json();
    },
    placeholderData: (prev: any) => prev,
  });

  // Auto-refresh automation logs on SSE automation_logs_changed events
  useEffect(() => {
    const es = new EventSource("/api/interactions/stream", { withCredentials: true });
    es.addEventListener("automation_logs_changed", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-logs"] });
    });
    return () => { es.close(); };
  }, [queryClient]);

  return query;
}

export function useAutomationSummary(accountId?: number) {
  return useQuery<AutomationSummary>({
    queryKey: ["/api/automation-logs/summary", accountId],
    queryFn: async () => {
      const qs = accountId ? `?accountId=${accountId}` : "";
      const res = await apiFetch(`/api/automation-logs/summary${qs}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
