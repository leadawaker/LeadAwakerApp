import { useMemo, useState, useEffect, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { List, Table2 } from "lucide-react";

import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useIsMobile } from "@/hooks/useIsMobile";
import { groupItemsToMap } from "@/components/crm/entityList";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useListPanelState } from "@/hooks/useListPanelState";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";

import { MobilePromptsView } from "../components/MobilePromptsView";
import { PromptsListView } from "../components/PromptsListView";
import { PromptsToolbar } from "../components/PromptsToolbar";
import { PromptsInlineTable } from "../components/PromptsInlineTable";
import { PromptFormDialog } from "../components/PromptFormDialog";
import { DeletePromptDialog } from "../components/DeletePromptDialog";

import type { PromptViewMode, PromptSortOption, PromptGroupOption, PromptColKey } from "../types";
import { VIEW_MODE_KEY, getPromptId, DEFAULT_VISIBLE_PROMPT_COLS } from "../types";

/* ── Constants ─────────────────────────────────────────────────────────── */
const VIEW_TABS: TabDef[] = [
  { id: "list",  label: "List",  icon: List   },
  { id: "table", label: "Table", icon: Table2 },
];

const VISIBLE_COLS_KEY = "prompts-visible-cols";

/* ════════════════════════════════════════════════════════════════════════════
   PromptsPage — slim orchestrator
   ════════════════════════════════════════════════════════════════════════════ */

export default function PromptsPage() {
  const { isAgencyView } = useWorkspace();
  const { toast } = useToast();
  const isMobile = useIsMobile(768);
  const { state: leftPanelState } = useListPanelState();

  /* ── Clear topbar actions (tabs are inline) ─────────────────────────────── */
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => {
    clearTopbarActions();
  }, [clearTopbarActions]);

  /* ── View mode (persisted) ──────────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<PromptViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "list" || stored === "table") return stored;
    } catch { /* ignore */ }
    return "list";
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  /* ── Search & filters ───────────────────────────────────────────────────── */
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");

  /* ── Sort & Group (persisted) ───────────────────────────────────────────── */
  const [sortBy, setSortBy] = usePersistedState<PromptSortOption>("prompts-sort", "recent");
  const [groupBy, setGroupBy] = usePersistedState<PromptGroupOption>("prompts-group", "none");
  const [groupDirection, setGroupDirection] = usePersistedState<"asc" | "desc">("prompts-group-dir", "asc");

  /* ── Column visibility (persisted) ──────────────────────────────────────── */
  const [visibleCols, setVisibleCols] = useState<Set<PromptColKey>>(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr as PromptColKey[]);
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_VISIBLE_PROMPT_COLS);
  });

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch { /* ignore */ }
  }, [visibleCols]);

  /* ── Data ────────────────────────────────────────────────────────────────── */
  const [promptLibraryData, setPromptLibraryData] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<import("../utils/resolveVariables").CampaignForPreview[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /* ── Dialog state ───────────────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<any | null>(null);

  /* ── Status toggle tracking ─────────────────────────────────────────────── */
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  /* ── Fetch prompts + campaigns ──────────────────────────────────────────── */
  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [promptsRes, campaignsRes, accountsRes] = await Promise.all([
        apiFetch("/api/prompts"),
        apiFetch("/api/campaigns"),
        apiFetch("/api/accounts"),
      ]);
      if (!promptsRes.ok) throw new Error(`${promptsRes.status}: Could not load prompts`);
      const promptsData = await promptsRes.json();
      setPromptLibraryData(Array.isArray(promptsData) ? promptsData : []);

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(
          (Array.isArray(campaignsData) ? campaignsData : []).map((c: any) => ({
            id: c.id || c.Id,
            name: c.name || c.Name || `Campaign #${c.id || c.Id}`,
            aiModel: c.aiModel || c.ai_model || "",
            agentName: c.agentName ?? c.agent_name ?? null,
            serviceName: c.serviceName ?? c.service_name ?? null,
            campaignService: c.campaignService ?? c.campaign_service ?? null,
            campaignUsp: c.campaignUsp ?? c.campaign_usp ?? null,
            calendarLink: c.calendarLink ?? c.calendar_link ?? null,
            whatLeadDid: c.whatLeadDid ?? c.what_lead_did ?? null,
            inquiriesSource: c.inquiriesSource ?? c.inquiries_source ?? null,
            inquiryTimeframe: c.inquiryTimeframe ?? c.inquiry_timeframe ?? null,
            niche: c.niche ?? c.campaignNicheOverride ?? c.campaign_niche_override ?? null,
            nicheQuestion: c.nicheQuestion ?? c.niche_question ?? null,
            bookingMode: c.bookingModeOverride ?? c.booking_mode_override ?? null,
            language: c.language ?? null,
            demoClientName: c.demoClientName ?? c.demo_client_name ?? null,
            companyName: c.companyName ?? c.company_name ?? null,
            aiStyleOverride: c.aiStyleOverride ?? c.ai_style_override ?? null,
            description: c.description ?? null,
            aiRole: c.aiRole ?? c.ai_role ?? null,
            typoCount: c.typoCount ?? c.typo_count ?? null,
            kb: c.kb ?? null,
            accountsId: c.accountsId ?? c.Accounts_id ?? null,
          })),
        );
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(
          (Array.isArray(accountsData) ? accountsData : []).map((a: any) => ({
            id: a.id || a.Id,
            name: a.name || a.Name || `Account #${a.id || a.Id}`,
          })),
        );
      }
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [isAgencyView]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  /* ── Campaign lookup map ────────────────────────────────────────────────── */
  const campaignMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of campaigns) m.set(c.id, c.name);
    return m;
  }, [campaigns]);

  /* ── Account lookup map ─────────────────────────────────────────────────── */
  const accountMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);

  /* ── Derived: unique models ─────────────────────────────────────────────── */
  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    promptLibraryData.forEach((p: any) => {
      const m = p.model || "";
      if (m) modelSet.add(m);
    });
    return Array.from(modelSet).sort();
  }, [promptLibraryData]);

  /* ── Derived: available campaign options ────────────────────────────────── */
  const availableCampaigns = useMemo(() => {
    const ids = new Set<number>();
    promptLibraryData.forEach((p: any) => {
      const cId = p.campaignsId || p.Campaigns_id;
      if (cId) ids.add(cId);
    });
    return campaigns.filter((c) => ids.has(c.id));
  }, [promptLibraryData, campaigns]);

  /* ── Derived: available account options ──────────────────────────────── */
  const availableAccounts = useMemo(() => {
    const ids = new Set<number>();
    promptLibraryData.forEach((p: any) => {
      const aId = p.accountsId || p.Accounts_id;
      if (aId) ids.add(aId);
    });
    return accounts.filter((a) => ids.has(a.id));
  }, [promptLibraryData, accounts]);

  /* ── Derived: filtered + sorted rows ────────────────────────────────────── */
  const rows = useMemo(() => {
    let filtered = promptLibraryData.filter((p: any) => {
      if (q && !(p.name || "").toLowerCase().includes(q.toLowerCase())) return false;
      if (statusFilter !== "all") {
        const pStatus = (p.status || "").toLowerCase().trim();
        if (pStatus !== statusFilter) return false;
      }
      if (modelFilter !== "all") {
        const pModel = (p.model || "").trim();
        if (pModel !== modelFilter) return false;
      }
      if (campaignFilter) {
        const pCampaign = p.campaignsId || p.Campaigns_id;
        if (String(pCampaign) !== campaignFilter) return false;
      }
      if (accountFilter) {
        const pAccount = p.accountsId || p.Accounts_id;
        if (String(pAccount) !== accountFilter) return false;
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "score_desc": {
          const sa = parseFloat(a.performanceScore || "0");
          const sb = parseFloat(b.performanceScore || "0");
          return sb - sa;
        }
        case "score_asc": {
          const sa2 = parseFloat(a.performanceScore || "0");
          const sb2 = parseFloat(b.performanceScore || "0");
          return sa2 - sb2;
        }
        case "recent":
        default: {
          const da = new Date(a.updatedAt || a.updated_at || 0).getTime();
          const db = new Date(b.updatedAt || b.updated_at || 0).getTime();
          return db - da;
        }
      }
    });

    return filtered;
  }, [promptLibraryData, q, statusFilter, modelFilter, campaignFilter, accountFilter, sortBy]);

  /* ── Derived: grouped rows ───────────────────────────────────────────────── */
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return null;
    return groupItemsToMap(
      rows,
      (p: any) => {
        switch (groupBy) {
          case "status": {
            const key = (p.status || "Unknown").toLowerCase();
            return key.charAt(0).toUpperCase() + key.slice(1);
          }
          case "model":
            return p.model || "No Model";
          case "campaign": {
            const cId = p.campaignsId || p.Campaigns_id;
            return cId ? (campaignMap.get(cId) || `Campaign #${cId}`) : "No Campaign";
          }
          case "account": {
            const aId = p.accountsId || p.Accounts_id;
            return aId ? (accountMap.get(aId) || `Account #${aId}`) : "Agency Bots";
          }
          default:
            return "All";
        }
      },
      groupDirection,
    );
  }, [rows, groupBy, groupDirection, campaignMap, accountMap]);

  /* ── Filter state helpers ───────────────────────────────────────────────── */
  const isFilterActive = statusFilter !== "all" || modelFilter !== "all" || !!campaignFilter || !!accountFilter;
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (modelFilter !== "all" ? 1 : 0) +
    (campaignFilter ? 1 : 0) +
    (accountFilter ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setModelFilter("all");
    setCampaignFilter("");
    setAccountFilter("");
  }, []);

  /* ════════════════════════════════════════════════════════════════════════
     Handlers
     ════════════════════════════════════════════════════════════════════════ */

  const handleViewSwitch = useCallback((id: string) => {
    setViewMode(id as PromptViewMode);
  }, []);

  function openCreate() {
    setEditingPrompt(null);
    setFormOpen(true);
  }

  function openEdit(prompt: any) {
    setEditingPrompt(prompt);
    setFormOpen(true);
  }

  function openDelete(prompt: any) {
    setDeletingPrompt(prompt);
    setDeleteOpen(true);
  }

  function handleSaved(saved: any) {
    setPromptLibraryData((prev) => {
      const id = getPromptId(saved);
      const idx = prev.findIndex((p) => getPromptId(p) === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  function handleDeleted(id: number) {
    setPromptLibraryData((prev) => prev.filter((p) => getPromptId(p) !== id));
  }

  async function handleToggleStatus(prompt: any) {
    const id = getPromptId(prompt);
    const currentStatus = (prompt.status || "").toLowerCase().trim();
    const newStatus = currentStatus === "active" ? "archived" : "active";

    if (togglingIds.has(id)) return;

    setTogglingIds((prev) => new Set(prev).add(id));
    setPromptLibraryData((prev) =>
      prev.map((p) => (getPromptId(p) === id ? { ...p, status: newStatus } : p)),
    );

    try {
      const res = await apiFetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setPromptLibraryData((prev) =>
        prev.map((p) => (getPromptId(p) === id ? updated : p)),
      );
      toast({
        title: "Status updated",
        description: `"${prompt.name}" is now ${newStatus}.`,
      });
    } catch (err: any) {
      setPromptLibraryData((prev) =>
        prev.map((p) => (getPromptId(p) === id ? { ...p, status: currentStatus } : p)),
      );
      toast({
        title: "Failed to update status",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     Early returns: error / loading
     ════════════════════════════════════════════════════════════════════════ */

  if (error && promptLibraryData.length === 0 && !loading) {
    return (
      <CrmShell>
        <ApiErrorFallback error={error} onRetry={fetchPrompts} isRetrying={loading} />
      </CrmShell>
    );
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="flex flex-col h-full" data-testid="page-prompt-library">
          {/* Topbar skeleton — mirrors the 60px topbar with title + tabs + action buttons */}
          <div
            className="shrink-0 flex items-center gap-3 px-[18px]"
            style={{ height: 60, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {/* Title */}
            <div className="h-[22px] w-32 bg-primary/10 rounded animate-pulse hidden md:block" />
            {/* Segment tabs */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="h-8 w-24 bg-primary/10 rounded-full animate-pulse" />
              <div className="h-8 w-20 bg-primary/5 rounded-full animate-pulse" />
            </div>
            {/* Panel toggle icon */}
            <div className="h-8 w-8 bg-primary/5 rounded animate-pulse hidden md:block" />
            {/* Spacer */}
            <div className="flex-1" />
            {/* Right action buttons */}
            <div className="hidden md:flex items-center gap-1.5">
              <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-[180px] bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
              <div className="h-8 w-20 bg-primary/10 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Split pane */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left panel — width follows the persisted toolbar state
                (full=300px list, compact=52px bot-icon rail, hidden=none) */}
            {leftPanelState === "hidden" ? null : leftPanelState === "compact" ? (
              <div
                className="shrink-0 hidden md:flex flex-col min-h-0 overflow-hidden items-center"
                style={{ width: 52, borderRight: "1px solid var(--line)", background: "var(--bg)" }}
              >
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center gap-1.5 py-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="shrink-0 bg-primary/10 animate-pulse"
                      style={{ width: 34, height: 34, borderRadius: "var(--r-surface)", opacity: 1 - i * 0.085 }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="shrink-0 hidden md:flex flex-col min-h-0 overflow-hidden w-[300px]"
                style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
              >
                <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: "8px 10px 16px" }}>
                  <div className="flex flex-col gap-[3px]">
                    {Array.from({ length: 8 }).map((_, i) => (
                      /* Each card mirrors PromptListCard: padding 9px 7px, gap 9, 34px icon + content */
                      <div
                        key={i}
                        className="bg-card animate-pulse"
                        style={{
                          borderRadius: "var(--r-surface)",
                          boxShadow: "var(--sh-raised-crisp)",
                          padding: "9px 7px",
                          display: "flex",
                          gap: 9,
                          alignItems: "flex-start",
                          opacity: 1 - i * 0.085,
                        }}
                      >
                        {/* Bot icon box */}
                        <div
                          className="shrink-0 bg-primary/10"
                          style={{ width: 34, height: 34, borderRadius: "var(--r-surface)" }}
                        />
                        {/* Content area */}
                        <div className="flex-1 min-w-0 flex flex-col gap-[7px] pt-[2px]">
                          {/* Row 1: name line + date stub */}
                          <div className="flex items-center gap-2 justify-between">
                            <div
                              className="bg-primary/10 rounded"
                              style={{ height: 11, width: `${52 + (i % 3) * 16}%` }}
                            />
                            <div className="bg-primary/5 rounded shrink-0" style={{ height: 9, width: 28 }} />
                          </div>
                          {/* Row 2: campaign + account metas */}
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-primary/5 rounded"
                              style={{ height: 9, width: `${38 + (i % 2) * 20}%` }}
                            />
                            <div className="bg-primary/5 rounded" style={{ height: 9, width: 44 }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Right panel — mirrors background: var(--surface), padding: 8px, gap: 8 */}
            <div
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
              style={{ background: "var(--surface)", padding: 8, gap: 8 }}
            >
              {/* Detail header — mirrors: bg: var(--paper), sh-raised-crisp, r-surface, minHeight 56, padding 10px 18px */}
              <div
                className="shrink-0 flex items-center gap-4 animate-pulse"
                style={{
                  minHeight: 56,
                  padding: "10px 18px",
                  borderRadius: "var(--r-surface)",
                  boxShadow: "var(--sh-raised-crisp)",
                  background: "var(--paper)",
                }}
              >
                {/* Icon */}
                <div
                  className="shrink-0 bg-primary/10"
                  style={{ width: 38, height: 38, borderRadius: "var(--r-surface)" }}
                />
                {/* Name + badge + meta */}
                <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 rounded" style={{ height: 14, width: 160 }} />
                    <div className="bg-primary/10 rounded-full" style={{ height: 16, width: 44 }} />
                  </div>
                  <div className="bg-primary/5 rounded" style={{ height: 9, width: 110 }} />
                </div>
                {/* Right controls */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <div className="bg-primary/5 rounded" style={{ height: 10, width: 80 }} />
                  <div style={{ width: 1, height: 22, background: "var(--line)" }} />
                  <div className="bg-primary/5 rounded" style={{ height: 32, width: 90 }} />
                  <div className="bg-primary/5 rounded" style={{ height: 32, width: 66 }} />
                  <div className="bg-primary/5 rounded" style={{ height: 32, width: 80 }} />
                  <div className="bg-primary/5 rounded" style={{ height: 32, width: 72 }} />
                </div>
              </div>

              {/* Editor body — raised card with code-line shimmers */}
              <div
                className="flex-1 min-h-0 animate-pulse"
                style={{
                  borderRadius: "var(--r-surface)",
                  boxShadow: "var(--sh-raised-crisp)",
                  background: "var(--paper)",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Section label */}
                <div className="bg-primary/5 rounded" style={{ height: 9, width: 80, marginBottom: 6 }} />
                {/* Code lines — varying widths to look like prompt text */}
                {[92, 78, 85, 65, 90, 72, 88, 60, 82, 75, 55, 86, 70, 64, 91].map((w, i) => (
                  <div
                    key={i}
                    className="bg-primary/10 rounded"
                    style={{ height: 11, width: `${w}%`, opacity: 1 - i * 0.03 }}
                  />
                ))}
                {/* Gap between sections */}
                <div style={{ height: 16 }} />
                {/* Second section label */}
                <div className="bg-primary/5 rounded" style={{ height: 9, width: 60 }} />
                {[80, 55, 72, 46, 68].map((w, i) => (
                  <div
                    key={`b-${i}`}
                    className="bg-primary/10 rounded"
                    style={{ height: 11, width: `${w}%`, opacity: 0.6 - i * 0.05 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </CrmShell>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */

  if (isMobile) {
    return (
      <CrmShell>
        <MobilePromptsView prompts={rows} q={q} onQChange={setQ} onSaved={handleSaved} campaigns={campaigns} />
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-prompt-library">
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* ── List view (D365 split-pane) ───────────────────────────────── */}
          {viewMode === "list" && (
            <PromptsListView
              prompts={rows}
              groupedRows={groupedRows}
              viewMode={viewMode}
              onViewModeChange={(v) => setViewMode(v)}
              q={q}
              onQChange={setQ}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              modelFilter={modelFilter}
              onModelFilterChange={setModelFilter}
              campaignFilter={campaignFilter}
              onCampaignFilterChange={setCampaignFilter}
              accountFilter={accountFilter}
              onAccountFilterChange={setAccountFilter}
              availableModels={availableModels}
              availableCampaigns={availableCampaigns}
              availableAccounts={availableAccounts}
              isFilterActive={isFilterActive}
              onClearAllFilters={clearAllFilters}
              onSaved={handleSaved}
              onDelete={openDelete}
              onOpenCreate={openCreate}
              campaignMap={campaignMap}
              campaigns={campaigns}
            />
          )}

          {/* ── Table view ───────────────────────────────────────────────── */}
          {viewMode === "table" && (
            <div className="flex flex-col h-full bg-muted rounded-lg overflow-hidden">
              <div className="px-3.5 pt-5 pb-1 shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  Prompt Library
                </h2>
              </div>

              <div className="px-3 pt-1.5 pb-2 shrink-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                <ViewTabBar
                  tabs={VIEW_TABS}
                  activeId={viewMode}
                  onTabChange={handleViewSwitch}
                  variant="segment"
                />
                <PromptsToolbar
                  searchQuery={q}
                  onSearchQueryChange={setQ}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  modelFilter={modelFilter}
                  onModelFilterChange={setModelFilter}
                  campaignFilter={campaignFilter}
                  onCampaignFilterChange={setCampaignFilter}
                  accountFilter={accountFilter}
                  onAccountFilterChange={setAccountFilter}
                  availableModels={availableModels}
                  availableCampaigns={availableCampaigns}
                  availableAccounts={availableAccounts}
                  totalCount={rows.length}
                  onOpenCreate={openCreate}
                  isFilterActive={isFilterActive}
                  activeFilterCount={activeFilterCount}
                  onClearAllFilters={clearAllFilters}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  groupBy={groupBy}
                  onGroupByChange={setGroupBy}
                  groupDirection={groupDirection}
                  onGroupDirectionChange={setGroupDirection}
                  visibleCols={visibleCols}
                  onVisibleColsChange={setVisibleCols}
                  showTableControls={true}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <PromptsInlineTable
                  prompts={rows}
                  groupedRows={groupedRows}
                  searchQuery={q}
                  isFilterActive={isFilterActive}
                  togglingIds={togglingIds}
                  onEdit={openEdit}
                  onDelete={openDelete}
                  onToggleStatus={handleToggleStatus}
                  visibleCols={visibleCols}
                  campaignMap={campaignMap}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Dialogs ──────────────────────────────────────────────────────── */}
        <PromptFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          prompt={editingPrompt}
          onSaved={handleSaved}
          campaigns={campaigns}
        />

        <DeletePromptDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          prompt={deletingPrompt}
          onDeleted={handleDeleted}
        />
      </div>
    </CrmShell>
  );
}
