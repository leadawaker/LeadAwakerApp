import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Plus, Trash2, Copy, X } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { CampaignListView } from "../components/CampaignListView";
import { CampaignDetailPanel } from "../components/CampaignDetailPanel";
import { useCampaignsData } from "../hooks/useCampaignsData";
import { useCampaignMetrics } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Campaign } from "@/types/models";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { cn } from "@/lib/utils";
import { xBase, xDefault, xSpan } from "@/components/crm/primitives";
import { apiFetch } from "@/lib/apiUtils";
import { createCampaign, deleteCampaign, updateCampaign, fetchCampaignPreflight } from "../api/campaignsApi";
import { useToast } from "@/hooks/use-toast";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";

export type CampaignDetailTab = "summary" | "configurations";
export type CampaignGroupBy = "status" | "account" | "type" | "none";
export type CampaignSortBy = "recent" | "name_asc" | "name_desc" | "leads_desc" | "response_desc";

const DETAIL_TAB_KEY = "campaigns-detail-tab";
const LIST_PREFS_KEY = "campaigns-list-prefs";

const STATUS_OPTIONS = ["Active", "Paused", "Draft", "Completed", "Inactive"];

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-green-500",
  Paused:    "bg-amber-500",
  Completed: "bg-blue-500",
  Finished:  "bg-blue-500",
  Inactive:  "bg-slate-400",
  Archived:  "bg-slate-400",
  Draft:     "bg-gray-400",
};

const CAMPAIGN_STATUS_ORDER = ["Active", "Paused", "Draft", "Completed", "Finished", "Inactive", "Archived"];

/* ── Expand-on-hover toolbar button tokens — shared from @/components/crm/primitives ── */

function getCampaignName(c: Campaign): string {
  return String(c.name || "Unnamed");
}

// ── Inline confirmation button ────────────────────────────────────────────────
function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const { t: tc } = useTranslation("campaigns");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="h-9 flex items-center gap-1 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : tc("confirm.yes")}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>{tc("confirm.no")}</button>
      </div>
    );
  }
  const maxW = label.length <= 4 ? "hover:max-w-[80px]" : label.length <= 8 ? "hover:max-w-[100px]" : "hover:max-w-[120px]";
  return (
    <button
      className={cn(
        xBase, maxW,
        variant === "danger"
          ? "border-red-300/50 text-red-600"
          : xDefault,
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{label}</span>
    </button>
  );
}

function CampaignsContent() {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();

  // ── Detail tab (persisted) — controls which tab CampaignDetailView shows ───
  const [detailTab, setDetailTab] = useState<CampaignDetailTab>(() => {
    try {
      const stored = localStorage.getItem(DETAIL_TAB_KEY);
      if (stored && ["summary", "configurations"].includes(stored)) return stored as CampaignDetailTab;
    } catch {}
    return "summary";
  });

  useEffect(() => {
    try { localStorage.setItem(DETAIL_TAB_KEY, detailTab); } catch {}
  }, [detailTab]);

  // Clear topbar actions (tabs are now inline)
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  // ── Lifted list-view controls (persisted) ──────────────────────────────────
  const [listSearch, setListSearch]           = useState("");
  const [searchOpen, setSearchOpen]           = useState(false);
  const [groupDirection, setGroupDirection]   = useState<"asc" | "desc">("asc");
  const [listPrefs, setListPrefs] = usePersistedState(LIST_PREFS_KEY, {
    groupBy: "status" as CampaignGroupBy,
    sortBy: "recent" as CampaignSortBy,
    filterStatus: [] as string[],
    filterAccount: "",
    showDemoCampaigns: null as boolean | null,
  });
  const groupBy = listPrefs.groupBy;
  const sortBy = listPrefs.sortBy;
  const filterStatus = listPrefs.filterStatus;
  const listFilterAccount = listPrefs.filterAccount;
  const showDemoCampaigns = listPrefs.showDemoCampaigns;
  const setGroupBy = useCallback((v: CampaignGroupBy) => setListPrefs(p => ({ ...p, groupBy: v })), [setListPrefs]);
  const setSortBy = useCallback((v: CampaignSortBy) => setListPrefs(p => ({ ...p, sortBy: v })), [setListPrefs]);
  const setFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setListPrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setListPrefs]);
  const setListFilterAccount = useCallback((v: string) => setListPrefs(p => ({ ...p, filterAccount: v })), [setListPrefs]);
  const setShowDemoCampaigns = useCallback((v: boolean | null) => setListPrefs(p => ({ ...p, showDemoCampaigns: v })), [setListPrefs]);

  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  // ── Workspace & data ───────────────────────────────────────────────────────
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const filterAccountId: number | "all" = currentAccountId > 0 ? currentAccountId : "all";

  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined;
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { campaigns, loading: campaignsLoading, error: campaignsError, handleRefresh, updateCampaignRow, setCampaigns } = useCampaignsData(effectiveAccountId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics();

  const loading = campaignsLoading;

  // ── Persisted selection (after data hook) ─────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = usePersistedSelection<Campaign>(
    "selected-campaign-id",
    (c) => (c as any).Id ?? (c as any).id ?? 0,
    campaigns,
  );

  // Auto-select first campaign when data first arrives — one-shot, no loop.
  const hasAutoSelected = useRef(false);
  const campaignsHaveData = campaigns.length > 0;
  useEffect(() => {
    if (!hasAutoSelected.current && campaignsHaveData) {
      hasAutoSelected.current = true;
      setSelectedCampaign((prev) => prev ?? campaigns[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignsHaveData]);

  // Sync selectedCampaign with fresh data after any campaigns refresh (e.g. Generate button)
  const isFirstCampaignsLoad = useRef(true);
  useEffect(() => {
    if (campaigns.length === 0) return;
    if (isFirstCampaignsLoad.current) { isFirstCampaignsLoad.current = false; return; }
    if (!selectedCampaign) return;
    const id = (selectedCampaign as any).id ?? (selectedCampaign as any).Id;
    const fresh = campaigns.find((c: any) => ((c as any).id ?? (c as any).Id) === id);
    if (fresh) setSelectedCampaign(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedCampaign ? getCampaignName(selectedCampaign) : null);
    return () => setCrumb(null);
  }, [selectedCampaign, setCrumb]);

  // Publish campaign entity data for AI agent context (supports "this campaign" and "what campaigns are here")
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (selectedCampaign) {
      const c = selectedCampaign as any;
      // Publish selected campaign detail + list overview for "here" context
      const campaignListSummary = campaigns.slice(0, 20).map((camp: any) => ({
        id: camp.Id ?? camp.id,
        name: getCampaignName(camp),
        status: camp.status,
      }));
      publishEntity({
        entityType: "campaign",
        entityId: c.Id ?? c.id,
        entityName: getCampaignName(selectedCampaign),
        summary: {
          id: c.Id ?? c.id,
          name: getCampaignName(selectedCampaign),
          status: c.status,
          type: c.type,
          accountId: c.account_id,
          accountName: c.account_name,
          leadsCount: c.Leads ?? c.leads_count,
          interactionsCount: c.Interactions ?? c.interactions_count,
          totalCampaignsOnPage: campaigns.length,
          campaignsOnPage: campaignListSummary,
        },
        updatedAt: Date.now(),
      });
    } else if (campaigns.length > 0) {
      // No campaign selected — publish list-level context for "what campaigns are here"
      const campaignListSummary = campaigns.slice(0, 20).map((camp: any) => ({
        id: camp.Id ?? camp.id,
        name: getCampaignName(camp),
        status: camp.status,
      }));
      publishEntity({
        entityType: "list",
        entityName: "Campaigns List",
        summary: {
          totalCampaigns: campaigns.length,
          campaigns: campaignListSummary,
        },
        updatedAt: Date.now(),
      });
    }
  }, [selectedCampaign, campaigns, publishEntity]);

  const handleSelectCampaign = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
  }, []);

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditCampaign(campaign);
    setEditPanelOpen(true);
  }, []);

  const handleCloseEditPanel = useCallback(() => {
    setEditPanelOpen(false);
    setEditCampaign(null);
  }, []);

  const handleToggleStatus = useCallback(async (campaign: Campaign) => {
    const cid = campaign.id || campaign.Id;
    const newStatus = String(campaign.status) === "Active" ? "Paused" : "Active";

    // Hard-block activation if preflight critical checks fail (mirrors the server guard,
    // but proactively so we never show an optimistic "Active" that snaps back).
    if (newStatus === "Active") {
      try {
        const { ready, checks } = await fetchCampaignPreflight(cid);
        if (!ready) {
          const blockers = checks
            .filter((c) => c.critical && c.status === "error")
            .map((c) => t(`preflight.checks.${c.key}`, c.key, c.count !== undefined ? { count: c.count } : undefined));
          toast({
            variant: "destructive",
            title: t("preflight.blockedTitle", "Can't activate yet"),
            description: blockers.join(" · "),
          });
          return;
        }
      } catch {
        // If the check itself fails, fall through — the server guard still protects us.
      }
    }

    updateCampaignRow(cid, "status", newStatus);
    setSelectedCampaign((prev) =>
      prev && (prev.id || prev.Id) === cid ? { ...prev, status: newStatus } : prev
    );
  }, [updateCampaignRow, t, toast]);

  const handleSaveCampaign = useCallback(async (id: number, patch: Record<string, unknown>) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id || c.Id === id) ? { ...c, ...patch } : c));
    setSelectedCampaign((prev) => prev && (prev.id === id || prev.Id === id) ? { ...prev, ...patch } : prev);
    await updateCampaign(id, patch);

    // When business profile fields are saved, write them back to the niche
    // template so future campaigns pre-fill with the latest values.
    const niche = String(patch.niche ?? campaigns.find((c) => c.id === id || c.Id === id)?.niche ?? "").trim();
    const hasBusinessFields = "company_name" in patch || "description" in patch || "kb" in patch;
    if (niche && hasBusinessFields && isAgencyUser) {
      try {
        const toTemplate = (raw: unknown): { nl: string; en: string } | undefined => {
          if (!raw) return undefined;
          const s = String(raw).trim();
          if (s.startsWith("{")) {
            try { return JSON.parse(s); } catch { /* ok */ }
          }
          return s ? { nl: s, en: s } : undefined;
        };
        const body: Record<string, unknown> = {};
        if ("company_name" in patch) {
          const v = String(patch.company_name ?? "").trim();
          if (v) body.companyNameTemplate = { nl: v, en: v };
        }
        if ("description" in patch) body.descriptionTemplate = toTemplate(patch.description);
        if ("kb" in patch) body.kbTemplate = toTemplate(patch.kb);
        if (Object.keys(body).length) {
          await fetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/template`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } catch {
        // Non-critical — best-effort template sync.
      }
    }
  }, [setCampaigns, campaigns, isAgencyUser]);

  // ── List-view control helpers ──────────────────────────────────────────────
  const isGroupNonDefault     = groupBy !== "status";
  const isSortNonDefault      = sortBy !== "recent";
  const isFilterActive        = filterStatus.length > 0 || !!listFilterAccount || showDemoCampaigns !== null;
  const hasNonDefaultControls = isGroupNonDefault || isSortNonDefault || isFilterActive;

  const toggleFilterStatus = useCallback((s: string) =>
    setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const handleResetControls = useCallback(() => {
    setFilterStatus([]);
    setGroupBy("status");
    setSortBy("recent");
    setListFilterAccount("");
    setShowDemoCampaigns(null);
  }, []);

  // ── Available accounts (for list filter dropdown) ──────────────────────────
  const availableAccounts = useMemo(() => {
    if (!isAgencyUser) return [];
    const seen = new Set<string>();
    campaigns.forEach((c) => {
      const acctName = String(c.account_name || "");
      if (acctName) seen.add(acctName);
    });
    return Array.from(seen).sort();
  }, [campaigns, isAgencyUser]);

  const handleDeleteCampaign = useCallback(async (id: number) => {
    try {
      await deleteCampaign(id);
      setSelectedCampaign(null);
      handleRefresh();
    } catch (err) { console.error("Delete campaign failed", err); }
  }, [handleRefresh, setSelectedCampaign]);

  const handleDuplicateCampaign = useCallback(async (campaign: Campaign) => {
    try {
      await createCampaign({
        name: `${campaign.name || "Campaign"} (Copy)`,
        status: "Draft",
        description: campaign.description || "",
        ai_model: campaign.ai_model || "gpt-4.1",
        bot_token: campaign.bot_token || "",
        calendar_link: campaign.calendar_link || "",
        agent_name: campaign.agent_name || "Sofia",
        is_demo: campaign.is_demo ?? true,
        type: campaign.type || "Re-engagement",
        start_date: campaign.start_date || new Date().toISOString().slice(0, 10),
      });
      handleRefresh();
    } catch (err) { console.error("Duplicate campaign failed", err); }
  }, [handleRefresh]);

  const handleAddCampaign = useCallback(async () => {
    try {
      const payload: Record<string, unknown> = {
        name: "New Campaign",
        status: "Draft",
        type: "Re-engagement",
        description: "",
        start_date: new Date().toISOString().slice(0, 10),
        is_demo: true, // Default to demo for agency campaigns
        agent_name: "Sofia", // Default agent name
        calendar_link: "https://cal.com/lead-awaker-orlfpr/demo", // Demo calendar
        ai_model: "gpt-4.1",
        bot_token: "8280015135:AAGqqekYPNnGHa0zSn19Irop-9Ti1AAoBe8", // Demo bot token
      };
      if (isAgencyUser) {
        payload.Accounts_id = 1; // Lead Awaker (use DB field name, gets converted by fromDbKeys)
      }
      const newCampaign = await createCampaign(payload);
      await handleRefresh();
      const campaignId = newCampaign?.id ?? newCampaign?.Id;
      if (campaignId) {
        setSelectedCampaign(newCampaign);

        // Auto-create default tags by cloning from the campaign with the most tags
        try {
          const tagsRes = await apiFetch("/api/tags");
          if (tagsRes.ok) {
            const allTags: any[] = await tagsRes.json();
            if (Array.isArray(allTags) && allTags.length > 0) {
              const byCampaign = new Map<number, any[]>();
              allTags.forEach((t) => {
                if (t.campaign_id && t.campaign_id !== campaignId) {
                  if (!byCampaign.has(t.campaign_id)) byCampaign.set(t.campaign_id, []);
                  byCampaign.get(t.campaign_id)!.push(t);
                }
              });
              let templateTags: any[] = [];
              byCampaign.forEach((tags) => {
                if (tags.length > templateTags.length) templateTags = tags;
              });
              if (templateTags.length > 0) {
                const campaignName = newCampaign.name || "New Campaign";
                await Promise.allSettled(
                  templateTags.map((tag) =>
                    apiFetch("/api/tags", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: tag.name,
                        color: tag.color,
                        category: tag.category,
                        description: tag.description,
                        campaign_id: campaignId,
                        campaign_name: campaignName,
                      }),
                    }),
                  ),
                );
              }
            }
          }
        } catch (tagErr) {
          console.error("Failed to auto-create default tags:", tagErr);
        }
      }
    } catch (err) { console.error("Create campaign failed", err); }
  }, [handleRefresh, setSelectedCampaign]);

  // Show error fallback if campaigns failed to load
  if (campaignsError && !loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ApiErrorFallback
          error={campaignsError}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <>
      <div className="la-page" data-onboarding="campaigns-list">
        <div className="flex-1 overflow-hidden relative">
          <CampaignListView
            campaigns={campaigns}
            metrics={metrics}
            loading={loading}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={handleSelectCampaign}
            onEditCampaign={isAgencyUser ? handleEditCampaign : () => {}}
            onToggleStatus={isAgencyUser ? handleToggleStatus : () => {}}
            onSave={isAgencyUser ? handleSaveCampaign : async () => {}}
            onCreateCampaign={isAgencyUser ? handleAddCampaign : () => {}}
            onRefresh={handleRefresh}
            onDelete={isAgencyUser ? handleDeleteCampaign : undefined}
            onDuplicate={isAgencyUser ? handleDuplicateCampaign : undefined}
            // Detail tab
            detailTab={detailTab}
            onDetailTabChange={setDetailTab}
            // Lifted controls
            listSearch={listSearch}
            onListSearchChange={setListSearch}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            groupDirection={groupDirection}
            onGroupDirectionChange={setGroupDirection}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            filterStatus={filterStatus}
            onToggleFilterStatus={toggleFilterStatus}
            onFilterStatusSet={setFilterStatus}
            filterAccount={listFilterAccount}
            onFilterAccountChange={setListFilterAccount}
            availableAccounts={availableAccounts}
            showDemoCampaigns={showDemoCampaigns}
            onShowDemoCampaignsChange={isAgencyUser ? setShowDemoCampaigns : () => {}}
            hasNonDefaultControls={hasNonDefaultControls}
            isGroupNonDefault={isGroupNonDefault}
            isSortNonDefault={isSortNonDefault}
            onResetControls={handleResetControls}
          />
        </div>
      </div>

      {/* Edit slide-over */}
      <CampaignDetailPanel
        campaign={editCampaign}
        metrics={metrics}
        open={editPanelOpen}
        onClose={handleCloseEditPanel}
      />
    </>
  );
}

export function CampaignsPage() {
  return (
    <CrmShell>
      <CampaignsContent />
    </CrmShell>
  );
}
