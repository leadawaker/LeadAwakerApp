import { useMemo, useState, useEffect, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { List, Table2 } from "lucide-react";

import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useIsMobile } from "@/hooks/useIsMobile";
import { groupItemsToMap } from "@/components/crm/entityList";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { PageTopbar, TopbarTabs } from "@/components/crm/primitives";

import { MobilePromptsView } from "../components/MobilePromptsView";
import { PromptsPageSkeleton } from "../components/PromptsPageSkeleton";
import { PromptsListView } from "../components/PromptsListView";
import { PromptsToolbar } from "../components/PromptsToolbar";
import { PromptsInlineTable } from "../components/PromptsInlineTable";
import { PromptFormPanel } from "../components/PromptFormPanel";
import { DeletePromptDialog } from "../components/DeletePromptDialog";

import type { PromptViewMode, PromptSortOption, PromptGroupOption, PromptColKey } from "../types";
import { VIEW_MODE_KEY, getPromptId, DEFAULT_VISIBLE_PROMPT_COLS } from "../types";
import { isPromptCategory, isVoiceUseCase, type PromptCategory } from "../promptCategories";

/* ── Constants ─────────────────────────────────────────────────────────── */
const VIEW_TABS = [
  { id: "list" as const,  labelKey: "views.list",  icon: List   },
  { id: "table" as const, labelKey: "views.table", icon: Table2 },
];

const VISIBLE_COLS_KEY = "prompts-visible-cols";

/* ════════════════════════════════════════════════════════════════════════════
   PromptsPage — slim orchestrator
   ════════════════════════════════════════════════════════════════════════════ */

export default function PromptsPage() {
  const { t } = useTranslation("prompts");
  const { isAgencyView } = useWorkspace();
  const { toast } = useToast();
  const isMobile = useIsMobile(768);

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
  // "voice": only the voice agents' prompts (use_case voice_* and eleven_*: layers, greetings, backend).
  const [typeFilter, setTypeFilter] = useState<"all" | "voice">("all");
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
  const [createCategory, setCreateCategory] = useState<PromptCategory>("chat");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<any | null>(null);

  /* ── Status toggle tracking ─────────────────────────────────────────────── */
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  /* ── Fetch campaigns (extracted so focus listener can call it independently) ── */
  const reloadCampaigns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/campaigns");
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(
        (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id || c.Id,
          name: c.name || c.Name || `Campaign #${c.id || c.Id}`,
          aiModel: c.aiModel || c.ai_model || "",
          agentName: c.agentName ?? c.agent_name ?? null,
          serviceName: c.serviceName ?? c.service_name ?? null,
          campaignService: c.campaignService ?? c.campaign_service ?? null,
          campaignUsp: c.campaignUsp ?? c.campaign_usp ?? null,
          calendarLink: c.calendarLink ?? c.calendar_link ?? null,
          firstMessage: c.firstMessage ?? c.first_message ?? c.First_Message ?? null,
          whatLeadDid: c.whatLeadDid ?? c.what_lead_did ?? null,
          firstTouch: c.firstTouch ?? c.first_touch ?? null,
          positioning: c.positioning ?? null,
          aiDisclosure: c.aiDisclosure ?? c.ai_disclosure ?? null,
          inquiriesSource: c.inquiriesSource ?? c.inquiries_source ?? null,
          inquiryTimeframe: c.inquiryTimeframe ?? c.inquiry_timeframe ?? null,
          niche: c.niche ?? c.campaignNicheOverride ?? c.campaign_niche_override ?? null,
          nicheQuestion: c.nicheQuestion ?? c.niche_question ?? null,
          bookingMode: c.bookingModeOverride ?? c.booking_mode_override ?? null,
          language: c.language ?? null,
          promptCampaignId: c.promptCampaignId ?? c.prompt_campaign_id ?? null,
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
    } catch { /* ignore — stale names are preferable to a crash */ }
  }, []);

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
            firstMessage: c.firstMessage ?? c.first_message ?? c.First_Message ?? null,
            whatLeadDid: c.whatLeadDid ?? c.what_lead_did ?? null,
            firstTouch: c.firstTouch ?? c.first_touch ?? null,
            positioning: c.positioning ?? null,
            aiDisclosure: c.aiDisclosure ?? c.ai_disclosure ?? null,
            inquiriesSource: c.inquiriesSource ?? c.inquiries_source ?? null,
            inquiryTimeframe: c.inquiryTimeframe ?? c.inquiry_timeframe ?? null,
            niche: c.niche ?? c.campaignNicheOverride ?? c.campaign_niche_override ?? null,
            nicheQuestion: c.nicheQuestion ?? c.niche_question ?? null,
            bookingMode: c.bookingModeOverride ?? c.booking_mode_override ?? null,
            language: c.language ?? null,
            promptCampaignId: c.promptCampaignId ?? c.prompt_campaign_id ?? null,
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

  /* ── Refetch campaigns on tab focus so renames appear without a hard reload ── */
  useEffect(() => {
    const handleFocus = () => reloadCampaigns();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [reloadCampaigns]);

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
      if (typeFilter === "voice" && !isVoiceUseCase(p.useCase || p.use_case)) return false;
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
  }, [promptLibraryData, q, typeFilter, statusFilter, modelFilter, campaignFilter, accountFilter, sortBy]);

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
  const isFilterActive = typeFilter !== "all" || statusFilter !== "all" || modelFilter !== "all" || !!campaignFilter || !!accountFilter;
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (modelFilter !== "all" ? 1 : 0) +
    (campaignFilter ? 1 : 0) +
    (accountFilter ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setTypeFilter("all");
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

  // The list passes its open tab, so a new prompt starts in that area; the
  // table's button passes nothing (or a click event) and gets the Chat area.
  function openCreate(category?: unknown) {
    setCreateCategory(isPromptCategory(category) ? category : "chat");
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
        <PromptsPageSkeleton />
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

  // Create / edit prompt: right-hand panel beside the list or the table (UI_STANDARDS 3.7).
  // Keyed by prompt so switching prompts starts a fresh form; a new prompt is
  // keyed by its area so + on another tab starts in that tab's area.
  const formPanel = formOpen ? (
    <PromptFormPanel
      key={editingPrompt ? String(getPromptId(editingPrompt)) : `new-${createCategory}`}
      onClose={() => setFormOpen(false)}
      prompt={editingPrompt}
      onSaved={handleSaved}
      campaigns={campaigns}
      defaultCategory={createCategory}
      className="w-[560px] max-w-[50%]"
    />
  ) : null;

  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-prompt-library">
        <div className="flex-1 min-h-0 overflow-hidden flex">

          {/* ── List view (D365 split-pane) ───────────────────────────────── */}
          {viewMode === "list" && (
            <div className="flex-1 min-w-0 h-full overflow-hidden">
            <PromptsListView
              prompts={rows}
              groupedRows={groupedRows}
              q={q}
              onQChange={setQ}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
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
            </div>
          )}
          {viewMode === "list" && formPanel}

          {/* ── Table view ───────────────────────────────────────────────── */}
          {viewMode === "table" && (
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
              <PageTopbar
                title={t("page.title")}
                count={rows.length}
                left={
                  <TopbarTabs
                    tabs={VIEW_TABS.map((v) => ({ id: v.id, label: t(v.labelKey), icon: v.icon }))}
                    value={viewMode}
                    onChange={handleViewSwitch}
                  />
                }
                right={
                  <PromptsToolbar
                    searchQuery={q}
                    onSearchQueryChange={setQ}
                    typeFilter={typeFilter}
                    onTypeFilterChange={setTypeFilter}
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
                }
              />

              <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-muted">
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
              {formPanel}
              </div>
            </div>
          )}
        </div>

        {/* ── Destructive confirmation ─────────────────────────────────────── */}
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
