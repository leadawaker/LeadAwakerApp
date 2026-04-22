/**
 * Central data hooks for fetching real API data.
 * Replaces all mock data imports across the application.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import type {
  Account,
  Campaign,
  Lead,
  Interaction,
  AutomationLog,
  AppUser,
  TagItem,
  PromptItem,
  CampaignMetricsHistory,
} from "@/types/models";

/* ─── Generic fetch helper ────────────────────────────────────── */

async function fetchApi<T>(url: string): Promise<T[]> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || data?.data || [];
}

/* ─── Accounts ────────────────────────────────────────────────── */

export function useAccounts(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false; // default true for backward compat
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchApi<Account>("/api/accounts");
      setAccounts(data);
    } catch (err) {
      console.error("Failed to fetch accounts", err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { if (enabled) refresh(); }, [refresh, enabled]);

  return { accounts, loading, refresh };
}

/* ─── Campaigns ───────────────────────────────────────────────── */

export function useCampaigns(accountId?: number) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = accountId ? `?accountId=${accountId}` : "";
      const data = await fetchApi<Campaign>(`/api/campaigns${params}`);
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { campaigns, loading, refresh };
}

/* ─── Leads ───────────────────────────────────────────────────── */

export function useLeads(accountId?: number, campaignId?: number) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountId) params.set("accountId", String(accountId));
      if (campaignId) params.set("campaignId", String(campaignId));
      const qs = params.toString();
      const data = await fetchApi<Lead>(`/api/leads${qs ? `?${qs}` : ""}`);
      // Normalize common field variations from the API
      const normalized = data.map((l: any) => ({
        ...l,
        id: l.Id || l.id || l.id_number,
        account_id: l.account_id || l.accounts_id || l.Accounts_id,
        campaign_id: l.campaign_id || l.campaigns_id || l.Campaigns_id,
        full_name: l.full_name || l.full_name_1 || `${l.first_name || ""} ${l.last_name || ""}`.trim(),
        first_name: l.first_name || "",
        last_name: l.last_name || "",
        phone: l.phone || l.Phone || "",
        email: l.email || l.Email || "",
        conversion_status: l.conversion_status || l.Conversion_Status || "New",
        source: l.source || l.Source || "Manual Upload",
        last_interaction_at: l.last_interaction_at || l.Last_interaction_at || "",
        notes: l.notes || l.Notes || "",
        booked_call_date: l.booked_call_date || l.Booked_call_date || null,
        automation_status: l.automation_status || l.Automation_status || "queued",
        last_message_sent_at: l.last_message_sent_at || null,
        last_message_received_at: l.last_message_received_at || null,
        message_count_sent: l.message_count_sent || 0,
        message_count_received: l.message_count_received || 0,
        priority: l.priority || l.Priority || "Medium",
        ai_sentiment: l.ai_sentiment || l.Ai_sentiment || "Unknown",
        opted_out: l.opted_out ?? false,
        manual_takeover: l.manual_takeover ?? false,
        tags: Array.isArray(l.tags) ? l.tags : [],
        created_at: l.created_at || l.Created_time || l["Created time"] || "",
        updated_at: l.updated_at || l.Last_modified_time || l["Last modified time"] || "",
      }));
      setLeads(normalized);
    } catch (err) {
      console.error("Failed to fetch leads", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [accountId, campaignId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { leads, loading, error, refresh };
}

/* ─── Interactions ────────────────────────────────────────────── */

/** Normalize raw interaction record from API */
function normalizeInteraction(i: any): Interaction {
  return {
    ...i,
    id: i.Id || i.id,
    account_id: i.account_id || i.accounts_id || i.Accounts_id,
    campaign_id: i.campaign_id || i.campaigns_id || i.Campaigns_id,
    lead_id: i.lead_id || i.leads_id || i.Leads_id,
    user_id: i.user_id || i.users_id || i.Users_id,
    type: i.type || i.Type || "WhatsApp",
    direction: i.direction || i.Direction || "Outbound",
    content: i.content || i.Content || "",
    status: i.status || i.Status || "sent",
    created_at: i.created_at || i.Created_time || "",
    updated_at: i.updated_at || i.Last_modified_time || "",
  } as Interaction;
}

export function useInteractions(accountId?: number, leadId?: number) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInteractions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (leadId) params.set("leadId", String(leadId));
      else if (accountId) params.set("accountId", String(accountId));
      const qs = params.toString();
      const data = await fetchApi<Interaction>(`/api/interactions${qs ? `?${qs}` : ""}`);
      setInteractions(data.map(normalizeInteraction));
    } catch (err: any) {
      console.error("Failed to fetch interactions", err);
      if (!silent) setError(err.message || "Failed to load interactions");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [accountId, leadId]);

  const refresh = useCallback(() => fetchInteractions(false), [fetchInteractions]);

  useEffect(() => { fetchInteractions(false); }, [fetchInteractions]);

  // SSE: real-time interaction updates (replaces 15s polling)
  useEffect(() => {
    const url = accountId
      ? `${API_BASE}/api/interactions/stream?accountId=${accountId}`
      : `${API_BASE}/api/interactions/stream`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("new_interaction", (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        const newMsg = normalizeInteraction(raw);
        // Only append if it belongs to the lead we're viewing (when filtering by lead)
        if (leadId && newMsg.lead_id !== leadId) return;
        setInteractions((prev) => {
          if (prev.some((i) => i.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Fetch full record (SSE payload is truncated at 500 chars due to PG NOTIFY limit)
        apiFetch(`/api/interactions/${newMsg.id}`)
          .then((r) => r.ok ? r.json() : null)
          .then((full) => {
            if (full) {
              const normalized = normalizeInteraction(full);
              setInteractions((prev) =>
                prev.map((i) => i.id === normalized.id ? normalized : i)
              );
            }
          })
          .catch(() => {});
      } catch (err) {
        console.error("[sse] Failed to parse new_interaction in useInteractions:", err);
      }
    });

    es.onerror = () => {};

    return () => es.close();
  }, [accountId, leadId]);

  return { interactions, loading, error, refresh };
}

/** Paginated interactions for a single lead — uses server-side limit/offset */
export function useInteractionsPaginated(leadId: number | undefined, pageSize = 15) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageRaw] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset page when leadId changes
  useEffect(() => { setPageRaw(1); }, [leadId]);

  useEffect(() => {
    if (!leadId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("leadId", String(leadId));
    params.set("page", String(page));
    params.set("limit", String(pageSize));

    apiFetch(`/api/interactions?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result: any) => {
        if (cancelled) return;
        const data = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];
        setInteractions(data.map(normalizeInteraction));
        setTotal(result.total ?? data.length);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Failed to load interactions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [leadId, page, pageSize]);

  const goToPage = (n: number) => setPageRaw(Math.max(1, Math.min(n, totalPages)));
  const nextPage = () => goToPage(page + 1);
  const prevPage = () => goToPage(page - 1);

  return { interactions, total, totalPages, page, loading, error, nextPage, prevPage };
}

/* ─── Users ───────────────────────────────────────────────────── */

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<AppUser>("/api/users");
      // Normalize field names
      const normalized = data.map((u: any) => ({
        ...u,
        id: u.Id || u.id,
        account_id: u.account_id || u.accounts_id || u.Accounts_id,
        full_name: u.full_name || u.Full_name || "",
        email: u.email || u.Email || "",
        phone: u.phone || u.Phone || "",
        timezone: u.timezone || u.Timezone || "UTC",
        role: u.role || u.Role || "Viewer",
        status: u.status || u.Status || "Active",
        avatar_url: u.avatar_url || u.Avatar_url || "",
        n8n_webhook_url: u.n8n_webhook_url || u.N8n_webhook_url || "",
        notification_email: u.notification_email ?? true,
        notification_sms: u.notification_sms ?? false,
        last_login_at: u.last_login_at || u.Last_login_at || "",
        users_id: u.users_id || String(u.Id || u.id || ""),
        Accounts: u.Accounts || u.account_name || "",
        accounts_id: u.accounts_id || String(u.account_id || ""),
        created_time: u.created_time || u.Created_time || "",
        last_modified_time: u.last_modified_time || u.Last_modified_time || "",
      }));
      setUsers(normalized);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { users, loading, refresh, setUsers };
}

/* ─── Tags ────────────────────────────────────────────────────── */

export function useTags(accountId?: number) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = accountId ? `?accountId=${accountId}` : "";
      const data = await fetchApi<TagItem>(`/api/tags${params}`);
      const normalized = data.map((t: any) => ({
        ...t,
        id: t.Id || t.id,
        account_id: t.account_id || t.accounts_id || t.Accounts_id,
        name: t.name || t.Name || "",
      }));
      setTags(normalized);
    } catch (err) {
      console.error("Failed to fetch tags", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { tags, loading, refresh };
}

/* ─── Prompt Library ──────────────────────────────────────────── */

export function usePrompts(accountId?: number) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = accountId ? `?accountId=${accountId}` : "";
      const data = await fetchApi<PromptItem>(`/api/prompts${params}`);
      const normalized = data.map((p: any) => ({
        ...p,
        id: p.Id || p.id,
        account_id: p.account_id || p.accounts_id || p.Accounts_id,
        name: p.name || p.Name || "",
        use_case: p.use_case || p.Use_case || "",
        model: p.model || p.Model || "",
        performance_score: p.performance_score || p.Performance_score || 0,
      }));
      setPrompts(normalized);
    } catch (err) {
      console.error("Failed to fetch prompts", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { prompts, loading, refresh };
}

/* ─── Automation Logs ─────────────────────────────────────────── */

export function useAutomationLogs(accountId?: number) {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = accountId ? `?accountId=${accountId}` : "";
      const data = await fetchApi<AutomationLog>(`/api/automation-logs${params}`);
      const normalized = data.map((log: any) => ({
        ...log,
        id: log.Id || log.id,
        account_id: log.account_id || log.accounts_id || log.Accounts_id,
        campaign_id: log.campaign_id || log.campaigns_id || log.Campaigns_id,
        lead_id: log.lead_id || log.leads_id || log.Leads_id,
        status: log.status || log.Status || "success",
        error_message: log.error_message || log.Error_message || "",
        execution_time_ms: log.execution_time_ms || log.Execution_time_ms || 0,
        stage: log.stage || log.Stage || "",
        created_at: log.created_at || log.Created_time || "",
      }));
      setLogs(normalized);
    } catch (err) {
      console.error("Failed to fetch automation logs", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { logs, loading, refresh };
}

/* ─── Campaign Metrics History ─────────────────────────────────── */

export function useCampaignMetrics(campaignId?: number) {
  const [metrics, setMetrics] = useState<CampaignMetricsHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = campaignId ? `?campaignId=${campaignId}` : "";
      const data = await fetchApi<CampaignMetricsHistory>(`/api/campaign-metrics-history${params}`);
      // Normalize field names
      const normalized = data.map((m: any) => ({
        ...m,
        id: m.Id || m.id,
        campaigns_id: m.campaigns_id || m.campaignsId || m.Campaigns_id,
        metric_date: m.metric_date || m.metricDate || m.Metric_date || "",
        total_leads_targeted: Number(m.total_leads_targeted || m.totalLeadsTargeted || 0),
        total_messages_sent: Number(m.total_messages_sent || m.totalMessagesSent || 0),
        total_responses_received: Number(m.total_responses_received || m.totalResponsesReceived || 0),
        response_rate_percent: Number(m.response_rate_percent || m.responseRatePercent || 0),
        bookings_generated: Number(m.bookings_generated || m.bookingsGenerated || 0),
        booking_rate_percent: Number(m.booking_rate_percent || m.bookingRatePercent || 0),
        total_cost: Number(m.total_cost || m.totalCost || 0),
        cost_per_lead: Number(m.cost_per_lead || m.costPerLead || 0),
        cost_per_booking: Number(m.cost_per_booking || m.costPerBooking || 0),
        roi_percent: Number(m.roi_percent || m.roiPercent || 0),
        created_at: m.created_at || m.createdAt || m.Created_time || "",
      }));
      setMetrics(normalized);
    } catch (err) {
      console.error("Failed to fetch campaign metrics", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { metrics, loading, refresh };
}

