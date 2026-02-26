import { useMemo, useState, useEffect, useCallback } from "react";
import { List, Table2 } from "lucide-react";

import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";

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

  /* ── Sort & Group ───────────────────────────────────────────────────────── */
  const [sortBy, setSortBy] = useState<PromptSortOption>("recent");
  const [groupBy, setGroupBy] = useState<PromptGroupOption>("none");

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
  const [campaigns, setCampaigns] = useState<{ id: number; name: string }[]>([]);
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
      const [promptsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/prompts"),
        apiFetch("/api/campaigns"),
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
  }, [promptLibraryData, q, statusFilter, modelFilter, campaignFilter, sortBy]);

  /* ── Derived: grouped rows ───────────────────────────────────────────────── */
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, any[]>();
    for (const p of rows) {
      let key: string;
      switch (groupBy) {
        case "status":
          key = (p.status || "Unknown").toLowerCase();
          key = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        case "model":
          key = p.model || "No Model";
          break;
        case "campaign": {
          const cId = p.campaignsId || p.Campaigns_id;
          key = cId ? (campaignMap.get(cId) || `Campaign #${cId}`) : "No Campaign";
          break;
        }
        default:
          key = "All";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return groups;
  }, [rows, groupBy, campaignMap]);

  /* ── Filter state helpers ───────────────────────────────────────────────── */
  const isFilterActive = statusFilter !== "all" || modelFilter !== "all" || !!campaignFilter;
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (modelFilter !== "all" ? 1 : 0) +
    (campaignFilter ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setModelFilter("all");
    setCampaignFilter("");
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
        <div className="flex h-full gap-[3px]" data-testid="page-prompt-library">
          {/* Left panel skeleton */}
          <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">
            <div className="px-3.5 pt-5 pb-1 shrink-0">
              <div className="h-7 w-36 bg-card/70 rounded animate-pulse" />
            </div>
            <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 w-16 bg-card/70 rounded-full animate-pulse" />
              ))}
            </div>
            <div className="flex-1 px-2 pb-2 space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[88px] bg-card/70 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          {/* Right panel skeleton */}
          <div className="flex-1 bg-card rounded-lg animate-pulse" />
        </div>
      </CrmShell>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */

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
              availableModels={availableModels}
              availableCampaigns={availableCampaigns}
              isFilterActive={isFilterActive}
              activeFilterCount={activeFilterCount}
              onClearAllFilters={clearAllFilters}
              togglingIds={togglingIds}
              onSaved={handleSaved}
              onDelete={openDelete}
              onToggleStatus={handleToggleStatus}
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
                  availableModels={availableModels}
                  availableCampaigns={availableCampaigns}
                  totalCount={rows.length}
                  onOpenCreate={openCreate}
                  isFilterActive={isFilterActive}
                  activeFilterCount={activeFilterCount}
                  onClearAllFilters={clearAllFilters}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  groupBy={groupBy}
                  onGroupByChange={setGroupBy}
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
