import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import {
  Plus,
  Star,
  ArrowUpDown,
  Layers,
  Filter,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  Table2,
  Bot,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Minus,
} from "lucide-react";
import { type CampaignForPreview } from "../utils/resolveVariables";
import { PromptEditorPanel, type PromptEditorPanelHandle } from "./PromptEditorPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getPromptIconColor } from "@/lib/avatarUtils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { SearchPill } from "@/components/ui/search-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getStatusBadgeClasses,
  getScoreColorClasses,
  getPromptId,
  type PromptViewMode,
  type PromptSortOption,
  type PromptGroupOption,
  type PromptFormData,
  type PromptVersion,
  MODEL_OPTIONS,
} from "../types";

/* ── Module-level i18n key maps ─────────────────────────────────────────── */

const STATUS_I18N_KEY: Record<string, string> = {
  active:   "status.active",
  archived: "status.archived",
};

const PROMPT_SORT_TKEYS: Record<PromptSortOption, string> = {
  recent:     "sort.mostRecent",
  name_asc:   "sort.nameAZ",
  name_desc:  "sort.nameZA",
  score_desc: "sort.scoreDesc",
  score_asc:  "sort.scoreAsc",
};

const PROMPT_GROUP_TKEYS: Record<PromptGroupOption, string> = {
  none:     "group.none",
  status:   "labels.status",
  model:    "labels.model",
  campaign: "labels.campaign",
  account:  "labels.account",
};

const VIEW_TAB_DEFS = [
  { id: "list",  tKey: "views.list",  icon: List   },
  { id: "table", tKey: "views.table", icon: Table2 },
];

/* ── Expand-on-hover button constants ──────────────────────────────────── */
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

type TFn = (key: string, opts?: any) => string;

function formatRelativeTime(dateStr: string | null | undefined, t: TFn): string {
  if (!dateStr) return "";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? t("time.justNow") : t("time.hoursAgo", { count: h });
    }
    if (diffDays === 1) return t("time.yesterday");
    if (diffDays < 7) return t("time.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("time.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("time.monthsAgo", { count: Math.floor(diffDays / 30) });
  } catch {
    return "";
  }
}

/* ── Left panel card ─────────────────────────────────────────────────────── */

function PromptListCard({
  prompt,
  isActive,
  onClick,
  campaignMap,
}: {
  prompt: any;
  isActive: boolean;
  onClick: () => void;
  campaignMap: Map<number, string>;
}) {
  const { t } = useTranslation("prompts");
  const name = prompt.name || t("labels.untitled");
  const aId = prompt.accountsId || prompt.Accounts_id;
  const iconColor = getPromptIconColor(aId ? `account-${aId}` : "agency-bots");
  const normalizedStatus = (prompt.status || "").toLowerCase().trim();
  const isInactive = normalizedStatus !== "" && normalizedStatus !== "active";
  const cId = prompt.campaignsId || prompt.Campaigns_id;
  const campaignName = cId ? campaignMap.get(cId) : null;
  const updatedAt = prompt.updatedAt || prompt.updated_at;
  const promptId = getPromptId(prompt);

  return (
    <div
      data-prompt-id={promptId}
      className={cn(
        "group mx-[3px] my-0.5 rounded-xl cursor-pointer",
        "transition-colors duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover",
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        {/* Avatar */}
        <div
          className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", isInactive && "bg-muted")}
          style={isInactive ? undefined : { backgroundColor: iconColor.bg }}
        >
          <Bot className={cn("h-4.5 w-4.5", isInactive ? "text-muted-foreground/40" : "")} style={isInactive ? undefined : { color: iconColor.icon }} />
        </div>
        {/* Name */}
        <p className="flex-1 min-w-0 text-[14px] font-semibold font-heading leading-tight truncate text-foreground">
          {name}
        </p>
        {/* Date + model, right-aligned */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums whitespace-nowrap">
            {formatRelativeTime(updatedAt, t)}
          </span>
          {prompt.model && (
            <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap">
              {prompt.model}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Group header ────────────────────────────────────────────────────────── */

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const SORT_OPTIONS: PromptSortOption[] = [
  "recent",
  "name_asc",
  "name_desc",
  "score_desc",
  "score_asc",
];
const GROUP_OPTIONS: PromptGroupOption[] = ["none", "status", "model", "campaign", "account"];
const STATUS_OPTIONS = ["all", "active", "archived"] as const;

/* ── Props ───────────────────────────────────────────────────────────────── */

interface PromptsListViewProps {
  prompts: any[];
  groupedRows: Map<string, any[]> | null;
  viewMode: PromptViewMode;
  onViewModeChange: (v: PromptViewMode) => void;
  q: string;
  onQChange: (v: string) => void;
  sortBy: PromptSortOption;
  onSortByChange: (s: PromptSortOption) => void;
  groupBy: PromptGroupOption;
  onGroupByChange: (g: PromptGroupOption) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  modelFilter: string;
  onModelFilterChange: (m: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (c: string) => void;
  accountFilter: string;
  onAccountFilterChange: (a: string) => void;
  availableModels: string[];
  availableCampaigns: { id: number; name: string }[];
  availableAccounts: { id: number; name: string }[];
  isFilterActive: boolean;
  onClearAllFilters: () => void;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  onOpenCreate: () => void;
  campaignMap: Map<number, string>;
  campaigns: { id: number; name: string; aiModel: string }[];
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function PromptsListView({
  prompts,
  groupedRows,
  viewMode,
  onViewModeChange,
  q,
  onQChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  statusFilter,
  onStatusFilterChange,
  modelFilter,
  onModelFilterChange,
  campaignFilter,
  onCampaignFilterChange,
  accountFilter,
  onAccountFilterChange,
  availableModels,
  availableCampaigns,
  availableAccounts,
  isFilterActive,
  onClearAllFilters,
  onSaved,
  onDelete,
  onOpenCreate,
  campaignMap,
  campaigns,
}: PromptsListViewProps) {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => {
    try { return localStorage.getItem("prompts-left-panel-collapsed") === "true"; } catch { return false; }
  });
  const [searchOpen, setSearchOpen] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (!selectedPrompt || !selectedId) return;
    try {
      const res = await apiFetch(`/api/prompts/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      setSelectedPrompt(saved);
      onSaved(saved);
    } catch {}
  }

  // Compute VIEW_TABS from tKeys inside component (hooks requirement)
  const VIEW_TABS = useMemo<TabDef[]>(
    () => VIEW_TAB_DEFS.map((d) => ({ id: d.id, label: t(d.tKey), icon: d.icon })),
    [t],
  );

  // Persisted selection — survives page navigation (same pattern as Leads, Campaigns, etc.)
  const [selectedPrompt, setSelectedPrompt] = usePersistedSelection(
    "prompts-selected-id",
    (p: any) => getPromptId(p),
    prompts,
  );

  // Auto-select first prompt when none is selected or stored ID not found
  useEffect(() => {
    if (prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0]);
    }
  }, [prompts, selectedPrompt, setSelectedPrompt]);

  // Derive selectedId from selectedPrompt
  const selectedId = selectedPrompt ? getPromptId(selectedPrompt) : null;

  // Preview state — lifted to PromptsListView so button lives in sticky toolbar
  const [previewOpen, setPreviewOpen] = useState(false);
  const editPanelRef = useRef<{ setField: (k: string, v: string) => void; getForm: () => any; getTokenEstimate: () => number }>(null);
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try { const v = localStorage.getItem("prompts-editor-font-size"); return v ? Number(v) : 14; } catch { return 14; }
  });
  useEffect(() => {
    try { localStorage.setItem("prompts-editor-font-size", String(editorFontSize)); } catch {}
  }, [editorFontSize]);

  // Version history state
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [versionOverride, setVersionOverride] = useState<PromptVersion | null>(null);
  const [liveSnap, setLiveSnap] = useState<{
    promptText: string | null; systemMessage: string | null; notes: string | null;
  } | null>(null);
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveBumpType, setSaveBumpType] = useState<"minor" | "major">("minor");
  const [saveLabel, setSaveLabel] = useState("");

  useEffect(() => {
    if (!selectedId) { setVersions([]); setSelectedVersion(""); setVersionOverride(null); setLiveSnap(null); return; }
    setVersions([]);
    setSelectedVersion("");
    setVersionOverride(null);
    setLiveSnap(null);
    setVersionsLoading(true);
    apiFetch(`/api/prompts/${selectedId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data))
      .catch(() => {})
      .finally(() => setVersionsLoading(false));
  }, [selectedId]);

  // Ctrl+P toggles preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        if (selectedPrompt) setPreviewOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPrompt]);

  async function saveVersion(bumpType: "minor" | "major", label: string) {
    if (!selectedId) return;
    setSavingVersion(true);
    try {
      const res = await apiFetch(`/api/prompts/${selectedId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bumpType,
          promptText: selectedPrompt?.promptText || selectedPrompt?.prompt_text || null,
          systemMessage: selectedPrompt?.systemMessage || selectedPrompt?.system_message || null,
          notes: selectedPrompt?.notes || null,
          label: label || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newVersion: PromptVersion = await res.json();
      setVersions((prev) => [newVersion, ...prev]);
      setSelectedPrompt((prev: any) => prev ? { ...prev, version: newVersion.versionNumber } : prev);
      toast({ title: t("versions.saved"), description: `v${newVersion.versionNumber}` });
    } catch {
      toast({ title: t("versions.saveFailed"), variant: "destructive" });
    } finally {
      setSavingVersion(false);
    }
  }

  function loadVersion(v: PromptVersion) {
    if (!liveSnap) setLiveSnap({
      promptText: selectedPrompt?.promptText || selectedPrompt?.prompt_text || null,
      systemMessage: selectedPrompt?.systemMessage || selectedPrompt?.system_message || null,
      notes: selectedPrompt?.notes || null,
    });
    setSelectedVersion(v.versionNumber);
    setVersionOverride(v);
    toast({ title: t("versions.loaded"), description: `v${v.versionNumber}` });
  }

  function revertToCurrent() {
    if (!liveSnap) return;
    setVersionOverride({
      id: -1, promptsId: selectedId!,
      versionNumber: "", savedAt: "", savedBy: null, label: null,
      promptText: liveSnap.promptText,
      systemMessage: liveSnap.systemMessage,
      notes: liveSnap.notes,
    });
    setSelectedVersion("");
    setLiveSnap(null);
    toast({ title: t("versions.reverted") });
  }

  async function deleteVersion(versionId: number) {
    const target = versions.find(v => v.id === versionId);
    const res = await apiFetch(`/api/prompts/${selectedId}/versions/${versionId}`, { method: "DELETE" });
    if (!res.ok) return toast({ title: t("versions.deleteFailed"), variant: "destructive" });
    setVersions(prev => prev.filter(v => v.id !== versionId));
    if (target && selectedVersion === target.versionNumber) {
      setSelectedVersion(""); setVersionOverride(null);
    }
    toast({ title: t("versions.deleted") });
  }

  // Smooth scroll to selected prompt card (§29)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId == null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const run = () => {
      const el = container.querySelector(`[data-prompt-id="${selectedId}"]`) as HTMLElement | null;
      if (!el) return;
      let headerHeight = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("data-group-header") === "true") {
          headerHeight = (sibling as HTMLElement).offsetHeight;
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedId]);

  // Build flat list: headers + cards interleaved
  const listItems = useMemo<Array<
    | { kind: "header"; label: string; count: number }
    | { kind: "prompt"; prompt: any }
  >>(() => {
    if (!groupedRows) {
      return prompts.map((p) => ({ kind: "prompt" as const, prompt: p }));
    }
    const result: Array<
      | { kind: "header"; label: string; count: number }
      | { kind: "prompt"; prompt: any }
    > = [];
    groupedRows.forEach((group, label) => {
      result.push({ kind: "header", label, count: group.length });
      group.forEach((p) => result.push({ kind: "prompt", prompt: p }));
    });
    return result;
  }, [prompts, groupedRows]);

  return (
    <div className="flex h-full gap-[3px]" data-testid="prompts-list-view">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden",
        leftPanelCollapsed
          ? cn(mobileView === "detail" ? "hidden" : "flex", "md:hidden")
          : cn("w-full md:w-[340px] md:shrink-0", mobileView === "detail" ? "hidden md:flex" : "flex")
      )}>
        {/* Header: title + view tabs (§16 standard) */}
        <div className="px-3.5 pt-5 pb-3 shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
            {t("page.title")}
          </h2>
          <ViewTabBar
            tabs={VIEW_TABS}
            activeId={viewMode}
            onTabChange={(id) => onViewModeChange(id as PromptViewMode)}
            variant="segment"
          />
        </div>

        {/* ── List toolbar: search + sort + filter + group + create ── */}
        <div className="px-2 pb-2 flex items-center gap-1 shrink-0">
          <SearchPill
            value={q}
            onChange={onQChange}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            placeholder={t("toolbar.searchPlaceholder")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[80px]", sortBy !== "recent" ? xActive : xDefault)}
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("toolbar.sort")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("toolbar.sortBy")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => onSortByChange(opt)}
                  className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}
                >
                  {t(PROMPT_SORT_TKEYS[opt])}
                  {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)}
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("toolbar.filter")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("labels.status")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt} className="text-[12px] flex items-center justify-between" onClick={(e) => { e.preventDefault(); onStatusFilterChange(opt); }}>
                  {opt === "all" ? t("toolbar.allStatuses") : t(STATUS_I18N_KEY[opt] ?? "status.unknown")}
                  {statusFilter === opt && <Check className="h-3 w-3 text-brand-indigo" />}
                </DropdownMenuItem>
              ))}
              {availableModels.length > 0 && (<>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("labels.model")}</DropdownMenuLabel>
                <DropdownMenuItem className={cn("text-[12px]", modelFilter === "all" && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onModelFilterChange("all"); }}>
                  {t("toolbar.allModels")}
                  {modelFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {availableModels.map((m) => (
                  <DropdownMenuItem key={m} className={cn("text-[12px]", modelFilter === m && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onModelFilterChange(m); }}>
                    <span className="truncate flex-1">{m}</span>
                    {modelFilter === m && <Check className="h-3 w-3 ml-1 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </>)}
              {availableCampaigns.length > 0 && (<>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("labels.campaign")}</DropdownMenuLabel>
                <DropdownMenuItem className={cn("text-[12px]", !campaignFilter && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onCampaignFilterChange(""); }}>
                  {t("toolbar.allCampaigns")}
                  {!campaignFilter && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {availableCampaigns.map((c: any) => (
                  <DropdownMenuItem key={c.id} className={cn("text-[12px]", campaignFilter === String(c.id) && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onCampaignFilterChange(campaignFilter === String(c.id) ? "" : String(c.id)); }}>
                    <span className="truncate flex-1">{c.name}</span>
                    {campaignFilter === String(c.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </>)}
              {availableAccounts.length > 0 && (<>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("labels.account")}</DropdownMenuLabel>
                <DropdownMenuItem className={cn("text-[12px]", !accountFilter && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onAccountFilterChange(""); }}>
                  {t("toolbar.allAccounts")}
                  {!accountFilter && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {availableAccounts.map((a) => (
                  <DropdownMenuItem key={a.id} className={cn("text-[12px]", accountFilter === String(a.id) && "font-semibold text-brand-indigo")} onClick={(e) => { e.preventDefault(); onAccountFilterChange(accountFilter === String(a.id) ? "" : String(a.id)); }}>
                    <span className="truncate flex-1">{a.name}</span>
                    {accountFilter === String(a.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </>)}
              {isFilterActive && (<>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClearAllFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
              </>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", groupBy !== "none" ? xActive : xDefault)}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("toolbar.group")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {GROUP_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                  {t(PROMPT_GROUP_TKEYS[opt])}
                  {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className={cn(xBase, "hover:max-w-[100px]", xDefault)}
            onClick={onOpenCreate}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.create")}</span>
          </button>
        </div>

        {/* ── Prompt list ── */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]">
          {prompts.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <DataEmptyState variant={q || isFilterActive ? "search" : "prompts"} />
            </div>
          ) : (
            listItems.map((item) =>
              item.kind === "header" ? (
                <GroupHeader key={`h-${item.label}`} label={item.label} count={item.count} />
              ) : (
                <PromptListCard
                  key={getPromptId(item.prompt)}
                  prompt={item.prompt}
                  isActive={selectedId === getPromptId(item.prompt)}
                  onClick={() => { setSelectedPrompt(item.prompt); setMobileView("detail"); }}
                  campaignMap={campaignMap}
                />
              ),
            )
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      <div className={cn("flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden relative", mobileView === "list" ? "hidden md:flex" : "flex")}>
        {/* Gradient background layers */}
        <div className="absolute inset-0 bg-popover dark:bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_99%_151%_at_42%_91%,rgba(255,164,184,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#f3e7ff_5%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_69%_50%,rgba(255,194,165,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
        {/* Content sits above gradient */}
        {selectedPrompt ? (
          <div key={selectedId} className="animate-panel-slide-up flex flex-col flex-1 min-h-0 relative z-10">

            {/* ── Detail toolbar ──────────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileView("list")}
                className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Collapse left panel (desktop only) */}
              <button
                onClick={() => {
                  const next = !leftPanelCollapsed;
                  setLeftPanelCollapsed(next);
                  try { localStorage.setItem("prompts-left-panel-collapsed", String(next)); } catch {}
                }}
                className="hidden md:grid h-9 w-9 rounded-full border border-black/[0.125] bg-background place-items-center shrink-0"
                title={leftPanelCollapsed ? "Show list" : "Hide list"}
              >
                {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              {/* Inline prompt metadata — name only shown when left panel is collapsed */}
              {selectedPrompt && (
                <div className="flex items-center gap-1.5 min-w-0 shrink">
                  {leftPanelCollapsed && (() => {
                    const spAId = selectedPrompt.accountsId || selectedPrompt.Accounts_id;
                    const ic = getPromptIconColor(spAId ? `account-${spAId}` : "agency-bots");
                    return (
                      <>
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: ic.bg }}
                        >
                          <Bot className="h-3.5 w-3.5" style={{ color: ic.icon }} />
                        </div>
                        <h2 className="text-[15px] font-semibold font-heading text-foreground truncate max-w-[200px]">
                          {selectedPrompt.name || t("labels.untitledPrompt")}
                        </h2>
                      </>
                    );
                  })()}
                  <span className="text-[13px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 font-mono shrink-0">
                    #{selectedId}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "text-[13px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full transition-opacity hover:opacity-70 cursor-pointer shrink-0",
                        getStatusBadgeClasses(selectedPrompt.status),
                      )}>
                        {t(STATUS_I18N_KEY[selectedPrompt.status?.toLowerCase() ?? ""] ?? "status.unknown")}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem
                        className={cn("text-[12px]", selectedPrompt.status === "active" && "font-semibold text-brand-indigo")}
                        onClick={() => handleStatusChange("active")}
                      >
                        {t("status.active")}
                        {selectedPrompt.status === "active" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={cn("text-[12px]", selectedPrompt.status === "archived" && "font-semibold text-brand-indigo")}
                        onClick={() => handleStatusChange("archived")}
                      >
                        {t("status.archived")}
                        {selectedPrompt.status === "archived" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <select
                    className="text-[13px] text-foreground/50 bg-transparent outline-none hover:text-foreground cursor-pointer shrink-0"
                    value={selectedPrompt.model || "gpt-5.1"}
                    onChange={(e) => editPanelRef.current?.setField("model", e.target.value)}
                  >
                    {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    className="text-[13px] text-foreground/40 bg-transparent outline-none hover:text-foreground cursor-pointer max-w-[150px] truncate shrink-0"
                    value={String(selectedPrompt.campaignsId || selectedPrompt.Campaigns_id || "")}
                    onChange={(e) => editPanelRef.current?.setField("campaignsId", e.target.value)}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c: any) => (
                      <option key={c.id} value={String(c.id)}>#{c.id} {c.name}</option>
                    ))}
                  </select>
                  <span className="inline-flex items-center text-[13px] text-foreground/40 shrink-0">
                    <input
                      type="number" step="0.1" min="0" max="2"
                      className="w-9 bg-transparent outline-none tabular-nums text-center text-[13px] hover:text-foreground focus:text-foreground"
                      defaultValue={String(selectedPrompt.temperature ?? "0.7")}
                      key={`temp-c-${selectedPrompt.id}`}
                      onBlur={(e) => editPanelRef.current?.setField("temperature", e.target.value)}
                    />°
                  </span>
                  <span className="inline-flex items-center text-[13px] text-foreground/40 shrink-0">
                    <input
                      type="number" min="1"
                      className="w-14 bg-transparent outline-none tabular-nums text-center text-[13px] hover:text-foreground focus:text-foreground"
                      defaultValue={String(selectedPrompt.maxTokens ?? "1000")}
                      key={`tok-c-${selectedPrompt.id}`}
                      onBlur={(e) => editPanelRef.current?.setField("maxTokens", e.target.value)}
                    /> tokens
                  </span>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Preview toggle */}
              {selectedPrompt && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors shrink-0",
                    previewOpen
                      ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-white dark:bg-popover"
                  )}
                >
                  {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {previewOpen ? "Hide preview" : "Preview"}
                </button>
              )}

              {/* Font size controls */}
              {selectedPrompt && (
                <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border bg-white dark:bg-popover px-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditorFontSize((s) => Math.max(10, s - 1))}
                    className="px-1 py-0.5 rounded hover:bg-muted text-foreground/70 hover:text-foreground text-xs font-medium transition-colors"
                  >
                    A−
                  </button>
                  <span className="text-[11px] tabular-nums w-5 text-center text-muted-foreground">{editorFontSize}</span>
                  <button
                    type="button"
                    onClick={() => setEditorFontSize((s) => Math.min(24, s + 1))}
                    className="px-1 py-0.5 rounded hover:bg-muted text-foreground/70 hover:text-foreground text-xs font-medium transition-colors"
                  >
                    A+
                  </button>
                </div>
              )}

              {/* Version picker + save buttons */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="h-8 rounded-lg border border-border bg-white dark:bg-popover px-2.5 text-xs outline-none hover:border-foreground/30 transition-colors shrink-0 min-w-[80px] max-w-[220px] truncate text-left"
                    disabled={versionsLoading}
                  >
                    {versionsLoading
                      ? t("versions.loading")
                      : selectedVersion
                      ? (() => {
                          const sv = versions.find((v) => v.versionNumber === selectedVersion);
                          return sv
                            ? `v${sv.versionNumber} — ${new Date(sv.savedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} ${new Date(sv.savedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`
                            : `v${selectedVersion}`;
                        })()
                      : liveSnap
                      ? `${t("versions.current")} ●`
                      : versions.length > 0
                      ? `v${versions[0].versionNumber}`
                      : selectedPrompt?.version
                      ? `v${selectedPrompt.version}`
                      : t("versions.noVersions")}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="p-1 min-w-[220px] bg-white dark:bg-popover shadow-md border border-border/60">
                  {liveSnap && (
                    <button
                      onClick={revertToCurrent}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("versions.revertToCurrent")}
                    </button>
                  )}
                  {versions.length === 0 && !liveSnap && (
                    <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{t("versions.noVersions")}</p>
                  )}
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-muted/60 group/vrow",
                        selectedVersion === v.versionNumber && "bg-muted font-medium"
                      )}
                      onClick={() => loadVersion(v)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs flex-1 min-w-0 truncate">
                          v{v.versionNumber}
                          {v.label ? ` — ${v.label}` : ` — ${new Date(v.savedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} ${new Date(v.savedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteVersion(v.id); }}
                          className="opacity-0 group-hover/vrow:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity shrink-0"
                          title={t("versions.deleteVersion")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {v.notes && (
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 hidden group-hover/vrow:block whitespace-pre-wrap">
                          {v.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover open={saveDialogOpen} onOpenChange={(open) => { if (open) { setSaveBumpType("minor"); setSaveLabel(""); } setSaveDialogOpen(open); }}>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors shrink-0 disabled:opacity-50"
                    disabled={savingVersion}
                    title={t("versions.saveVersion")}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="p-3 w-64 bg-white dark:bg-popover shadow-md border border-border/60">
                  <p className="text-xs font-medium mb-2">{t("versions.saveVersion")}</p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setSaveBumpType("minor")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                        saveBumpType === "minor"
                          ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo font-medium"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      {t("versions.minorUpdate")}
                    </button>
                    <button
                      onClick={() => setSaveBumpType("major")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                        saveBumpType === "major"
                          ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo font-medium"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      {t("versions.majorUpdate")}
                    </button>
                  </div>
                  <input
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-brand-indigo/30 mb-2"
                    placeholder={t("versions.labelPlaceholder")}
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { saveVersion(saveBumpType, saveLabel); setSaveDialogOpen(false); } }}
                  />
                  <button
                    onClick={() => { saveVersion(saveBumpType, saveLabel); setSaveDialogOpen(false); }}
                    disabled={savingVersion}
                    className="w-full text-xs py-1.5 rounded-lg bg-brand-indigo text-white hover:bg-brand-indigo/90 transition-colors disabled:opacity-50"
                  >
                    {t("actions.save")}
                  </button>
                </PopoverContent>
              </Popover>

              {/* Score badge */}
              {selectedPrompt.performanceScore != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold shrink-0",
                    getScoreColorClasses(selectedPrompt.performanceScore),
                  )}
                >
                  <Star className="h-3.5 w-3.5 fill-current shrink-0" />
                  {selectedPrompt.performanceScore}
                </span>
              )}

              {/* Delete button */}
              <button
                onClick={() => onDelete(selectedPrompt)}
                className={cn(xBase, "hover:max-w-[100px] border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("actions.delete")}</span>
              </button>
            </div>


            {/* Body: always-editable two-column panel */}
            <PromptEditorPanel
              ref={editPanelRef}
              prompt={selectedPrompt}
              onSaved={onSaved}
              onDelete={onDelete}
              campaigns={campaigns}
              versionOverride={versionOverride}
              previewOpen={previewOpen}
              setPreviewOpen={setPreviewOpen}
              editorFontSize={editorFontSize}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 relative z-10">
            <DataEmptyState variant="prompts" />
          </div>
        )}
      </div>


    </div>
  );
}
