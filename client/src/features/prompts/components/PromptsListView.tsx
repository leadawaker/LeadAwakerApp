import { useState, useEffect, useRef, useMemo } from "react";
import { useListPanelState } from "@/hooks/useListPanelState";
import { ListPanelToggleButton } from "@/components/crm/ListPanelToggleButton";
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
  Bot,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { SearchPill } from "@/components/ui/search-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
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

/* ── Left panel list card (wine premium design) ──────────────────────────── */

function PromptListCard({
  prompt,
  isActive,
  onClick,
}: {
  prompt: any;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("prompts");
  const name = prompt.name || t("labels.untitled");
  const normalizedStatus = (prompt.status || "").toLowerCase().trim();
  const isStatusActive = normalizedStatus === "active";
  const updatedAt = prompt.updatedAt || prompt.updated_at;
  const promptId = getPromptId(prompt);

  return (
    <div
      data-prompt-id={promptId}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        position: "relative",
        cursor: "pointer",
        borderRadius: "var(--r-surface)",
        padding: "11px 13px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: isActive ? "var(--card)" : "transparent",
        boxShadow: isActive ? "var(--sh-raised-crisp)" : "none",
        transition: "all 130ms",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--wine-tint)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Left wine accent bar */}
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: 12, bottom: 12,
          width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0",
        }} />
      )}
      {/* Bot icon */}
      <span style={{
        width: 38, height: 38, flexShrink: 0, borderRadius: "var(--r-surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isActive ? "var(--wine-tint)" : "var(--bg)",
        boxShadow: isActive ? "none" : "var(--sh-inset-crisp)",
        color: isActive
          ? "var(--wine)"
          : normalizedStatus === "active"
          ? "var(--wine)"
          : normalizedStatus === "archived"
          ? "var(--mute-2)"
          : "var(--mute)",
        opacity: !isActive && normalizedStatus === "active" ? 0.55 : 1,
      }}>
        <Bot size={19} />
      </span>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: "var(--ink)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </div>
        {prompt.model && (
          <div style={{ marginTop: 3 }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {prompt.model}
            </span>
          </div>
        )}
      </div>
      {/* Active dot */}
      {isActive && isStatusActive && (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--good)", flexShrink: 0 }} title="Active" />
      )}
      {/* Date */}
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", flexShrink: 0 }}>
        {formatRelativeTime(updatedAt, t)}
      </span>
    </div>
  );
}

/* ── Compact rail (65px icon column) ──────────────────────────────────────── */

function CompactPromptRail({
  items,
  selectedId,
  onSelect,
}: {
  items: any[];
  selectedId: string | null;
  onSelect: (prompt: any) => void;
}) {
  return (
    <div style={{
      width: 65, flexShrink: 0, borderRight: "1px solid var(--line)",
      background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", display: "flex",
        flexDirection: "column", gap: 6, alignItems: "center", "[scrollbar-width]": "thin",
      }}>
        {items.map((p) => {
          const id = getPromptId(p);
          const isActive = selectedId === id;
          const pStatus = (p.status || "").toLowerCase().trim();
          const railColor = isActive
            ? "var(--wine)"
            : pStatus === "active"
            ? "var(--wine)"
            : pStatus === "archived"
            ? "var(--mute-2)"
            : "var(--mute)";
          const railOpacity = !isActive && pStatus === "active" ? 0.55 : 1;
          const promptContent = p.promptText || p.prompt_text || "";
          const previewText = promptContent.length > 100 ? promptContent.substring(0, 100) + "..." : promptContent;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(p)}
                  style={{
                    width: 38, height: 38, flexShrink: 0, borderRadius: "var(--r-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", border: "none",
                    background: isActive ? "var(--wine-tint)" : "var(--bg)",
                    boxShadow: isActive ? "0 0 0 2px var(--wine)" : "var(--sh-inset-crisp)",
                    color: railColor,
                    opacity: railOpacity,
                    transition: "all 130ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--wine-tint)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
                  }}
                >
                  <Bot size={19} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="text-xs">
                  <div className="font-semibold">{p.name || "Untitled"}</div>
                  {previewText && <div className="text-muted-foreground mt-1 whitespace-normal">{previewText}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/* ── Group header (wine mono design) ─────────────────────────────────────── */

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 6px 7px" }}>
      <span style={{
        fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)" }}>{count}</span>
    </div>
  );
}

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
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
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
  const { state: listPanelState } = useListPanelState();
  const leftPanelHidden = listPanelState === "hidden";
  const leftPanelCompact = listPanelState === "compact";
  const [searchOpen, setSearchOpen] = useState(false);

  // System / Campaigns tab filter
  const [listTab, setListTab] = useState<"system" | "campaign">("campaign");

  // Counts from the full prompts list (not filtered by tab)
  const systemCount = useMemo(() => prompts.filter((p: any) => !(p.campaignsId || p.Campaigns_id)).length, [prompts]);
  const campaignCount = useMemo(() => prompts.filter((p: any) => !!(p.campaignsId || p.Campaigns_id)).length, [prompts]);

  // Tab-filtered prompts
  const tabFilteredPrompts = useMemo(() => {
    return prompts.filter((p: any) => {
      const hasCampaign = !!(p.campaignsId || p.Campaigns_id);
      return listTab === "campaign" ? hasCampaign : !hasCampaign;
    });
  }, [prompts, listTab]);

  // GroupedRows also needs to be tab-filtered
  const tabFilteredGroupedRows = useMemo<Map<string, any[]> | null>(() => {
    if (!groupedRows) return null;
    const result = new Map<string, any[]>();
    groupedRows.forEach((items, key) => {
      const filtered = items.filter((p: any) => {
        const hasCampaign = !!(p.campaignsId || p.Campaigns_id);
        return listTab === "campaign" ? hasCampaign : !hasCampaign;
      });
      if (filtered.length > 0) result.set(key, filtered);
    });
    return result;
  }, [groupedRows, listTab]);

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

  // Persisted selection
  const [selectedPrompt, setSelectedPrompt] = usePersistedSelection(
    "prompts-selected-id",
    (p: any) => getPromptId(p),
    prompts,
  );

  // Auto-select first prompt when none is selected
  useEffect(() => {
    if (prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0]);
    }
  }, [prompts, selectedPrompt, setSelectedPrompt]);

  const selectedId = selectedPrompt ? getPromptId(selectedPrompt) : null;

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(true);
  const editPanelRef = useRef<PromptEditorPanelHandle>(null);
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

  // Smooth scroll to selected prompt card
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

  useFKeyScrollToSelected({
    containerRef: scrollContainerRef,
    selectedId: selectedId ?? null,
    getSelector: (id) => `[data-prompt-id="${id}"]`,
  });

  // Build flat list from tab-filtered prompts
  const listItems = useMemo<Array<
    | { kind: "header"; label: string; count: number }
    | { kind: "prompt"; prompt: any }
  >>(() => {
    if (!tabFilteredGroupedRows) {
      return tabFilteredPrompts.map((p) => ({ kind: "prompt" as const, prompt: p }));
    }
    const result: Array<
      | { kind: "header"; label: string; count: number }
      | { kind: "prompt"; prompt: any }
    > = [];
    tabFilteredGroupedRows.forEach((group, label) => {
      result.push({ kind: "header", label, count: group.length });
      group.forEach((p) => result.push({ kind: "prompt", prompt: p }));
    });
    return result;
  }, [tabFilteredPrompts, tabFilteredGroupedRows]);

  // Topbar expand-on-hover button style helper

  return (
    <div className="flex flex-col h-full" data-testid="prompts-list-view">

      {/* ══════════════════════════════════════════════════════════════════
          Full-width page topbar
         ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        height: 60, flexShrink: 0, padding: "0 18px",
        borderBottom: "1px solid var(--line)", background: "var(--bg)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {/* Title */}
        <span style={{
          fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)",
          letterSpacing: "-0.01em", flexShrink: 0,
        }} className="hidden md:block">
          {t("page.title")}
        </span>

        {/* System / Campaigns tabs */}
        <div className="la-seg" style={{ flexShrink: 0 }}>
          <button
            className={`la-seg-btn${listTab === "campaign" ? " on" : ""}`}
            onClick={() => setListTab("campaign")}
          >
            {t("tabs.campaigns")}
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
              color: listTab === "campaign" ? "var(--wine)" : "var(--mute-2)",
              background: listTab === "campaign" ? "var(--wine-tint)" : "var(--bg)",
              borderRadius: "var(--r-pill)", padding: "1px 7px", marginLeft: 5,
            }}>
              {campaignCount}
            </span>
          </button>
          <button
            className={`la-seg-btn${listTab === "system" ? " on" : ""}`}
            onClick={() => setListTab("system")}
          >
            {t("tabs.system")}
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
              color: listTab === "system" ? "var(--wine)" : "var(--mute-2)",
              background: listTab === "system" ? "var(--wine-tint)" : "var(--bg)",
              borderRadius: "var(--r-pill)", padding: "1px 7px", marginLeft: 5,
            }}>
              {systemCount}
            </span>
          </button>
        </div>

        {/* Desktop: panel collapse toggle (right of tabs) */}
        <div className="hidden md:flex items-center" style={{ flexShrink: 0 }}>
          <ListPanelToggleButton />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Controls: search + sort + filter + group + new */}
        <div className="hidden md:flex items-center gap-1.5">
          <SearchPill
            value={q}
            onChange={onQChange}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            placeholder={t("toolbar.searchPlaceholder")}
          />

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon">
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon">
                <Filter className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
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

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon">
                <Layers className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {GROUP_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                  {t(PROMPT_GROUP_TKEYS[opt])}
                  {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New prompt */}
          <button
            onClick={onOpenCreate}
            className="la-btn la-btn--wine"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", fontSize: 12, flexShrink: 0 }}
          >
            <Plus size={13} /> {t("toolbar.create")}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Split pane: left list + right editor
         ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        {leftPanelHidden ? (
          <div className="hidden md:flex md:flex-col min-h-0 overflow-hidden" />
        ) : leftPanelCompact ? (
          <CompactPromptRail
            items={tabFilteredPrompts}
            selectedId={selectedId}
            onSelect={(p) => { setSelectedPrompt(p); setMobileView("detail"); }}
          />
        ) : (
          <div
            className={cn(
              "min-h-0 overflow-hidden flex-col",
              mobileView === "detail" ? "hidden md:flex" : "flex",
              "w-full md:w-[300px] md:shrink-0",
            )}
            style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {/* Scrollable list */}
            <div
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]"
              style={{ padding: "8px 10px 16px", display: "flex", flexDirection: "column" }}
            >
              {tabFilteredPrompts.length === 0 ? (
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
                    />
                  ),
                )
              )}
            </div>
          </div>
        )}

        {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
        <div className={cn(
          "flex-1 min-h-0 flex flex-col overflow-hidden relative",
          mobileView === "list" ? "hidden md:flex" : "flex",
        )} style={{ background: "var(--surface)" }}>
          {selectedPrompt ? (
            <div key={selectedId} className="animate-panel-slide-up flex flex-col flex-1 min-h-0">

              {/* ── Detail toolbar (MetaBar design) ────────────────────────── */}
              <div style={{
                flexShrink: 0, minHeight: 56, padding: "10px 18px",
                borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--paper)",
              }}>
                {selectedPrompt && (
                  <>
                    {/* Left section: Bot icon + name + Active badge + #id */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Icon */}
                      <span style={{
                        width: 38, height: 38, flexShrink: 0, borderRadius: "var(--r-surface)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--wine-tint)", color: "var(--wine)",
                        boxShadow: "0 0 0 1px var(--wine-glow)",
                      }}>
                        <Bot size={18} />
                      </span>

                      {/* Name + Badge */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{
                            fontSize: 16, fontWeight: 700, color: "var(--ink)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {selectedPrompt.name || t("labels.untitledPrompt")}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <span style={{
                                fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
                                background: (selectedPrompt.status || "").toLowerCase() === "archived" ? "var(--bg)" : "var(--good-tint)",
                                color: (selectedPrompt.status || "").toLowerCase() === "archived" ? "var(--mute-2)" : "var(--good)",
                                borderRadius: "var(--r-pill)", padding: "2px 8px", flexShrink: 0,
                                cursor: "pointer",
                              }}>
                                {(selectedPrompt.status || "active").toLowerCase() === "archived" ? t("status.archived") : t("status.active")}
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                              <DropdownMenuItem onClick={() => handleStatusChange("active")} className="text-[12px]">
                                {t("status.active")}
                                {(selectedPrompt.status || "").toLowerCase() !== "archived" && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange("archived")} className="text-[12px]">
                                {t("status.archived")}
                                {(selectedPrompt.status || "").toLowerCase() === "archived" && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span style={{
                              fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)",
                              marginTop: 2, cursor: "pointer", display: "inline-block",
                            }}>
                              #{selectedId} · {campaignMap.get(selectedPrompt.campaignsId || selectedPrompt.Campaigns_id) || t("labels.noCampaign", { defaultValue: "no campaign" })}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52 max-h-60 overflow-y-auto">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              {t("labels.campaign")}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[12px]"
                              onClick={() => editPanelRef.current?.setField("campaignsId", "")}
                            >
                              {t("labels.noCampaign", { defaultValue: "No campaign" })}
                              {!(selectedPrompt.campaignsId || selectedPrompt.Campaigns_id) && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                            {campaigns.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                className="text-[12px]"
                                onClick={() => editPanelRef.current?.setField("campaignsId", String(c.id))}
                              >
                                <span className="truncate flex-1">{c.name}</span>
                                {String(selectedPrompt.campaignsId || selectedPrompt.Campaigns_id) === String(c.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Right section: MetaChips + divider + controls */}
                    <div className="flex items-center gap-6 shrink-0">
                      {/* MetaChips */}
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Model */}
                        <select
                          className="text-[12px] font-mono px-2.5 py-1.5 rounded-full outline-none cursor-pointer shrink-0"
                          style={{
                            background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
                            color: "var(--mute)",
                          }}
                          value={selectedPrompt.model || "gpt-5.5"}
                          onChange={(e) => editPanelRef.current?.setField("model", e.target.value)}
                        >
                          {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      {/* Vertical divider */}
                      <div style={{ width: 1, height: 26, background: "var(--line)" }} />

                      {/* Preview toggle */}
                      <button
                        type="button"
                        onClick={() => setPreviewOpen((p) => !p)}
                        className={cn("la-btn", previewOpen ? "la-btn--surface" : "la-btn--soft")}
                        style={{ height: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12, color: previewOpen ? "var(--wine)" : undefined }}
                      >
                        {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                        Preview
                      </button>

                      {/* Save version */}
                      <Popover open={saveDialogOpen} onOpenChange={(open) => { if (open) { setSaveBumpType("minor"); setSaveLabel(""); } setSaveDialogOpen(open); }}>
                        <PopoverTrigger asChild>
                          <button
                            className="la-btn la-btn--soft la-btn--icon"
                            style={{ width: 32, height: 32, flexShrink: 0 }}
                            disabled={savingVersion}
                            title={t("versions.saveVersion")}
                          >
                            <Save size={14} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="p-3 w-60 shadow-md border border-border/60" style={{ background: "var(--paper)" }}>
                          <p className="text-xs font-medium mb-2">{t("versions.saveVersion")}</p>
                          <div className="flex gap-2 mb-2">
                            <button onClick={() => setSaveBumpType("minor")} className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-colors", saveBumpType === "minor" ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo font-medium" : "border-border text-muted-foreground hover:border-foreground/30")}>
                              {t("versions.minorUpdate")}
                            </button>
                            <button onClick={() => setSaveBumpType("major")} className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-colors", saveBumpType === "major" ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo font-medium" : "border-border text-muted-foreground hover:border-foreground/30")}>
                              {t("versions.majorUpdate")}
                            </button>
                          </div>
                          <input
                            className="w-full h-8 rounded-lg border border-border px-2.5 text-xs outline-none focus:ring-2 focus:ring-brand-indigo/30 mb-2"
                            style={{ background: "var(--bg)" }}
                            placeholder={t("versions.labelPlaceholder")}
                            value={saveLabel}
                            onChange={(e) => setSaveLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { saveVersion(saveBumpType, saveLabel); setSaveDialogOpen(false); } }}
                          />
                          <button onClick={() => { saveVersion(saveBumpType, saveLabel); setSaveDialogOpen(false); }} disabled={savingVersion} className="w-full text-xs py-1.5 rounded-lg bg-brand-indigo text-white hover:bg-brand-indigo/90 transition-colors disabled:opacity-50">
                            {t("actions.save")}
                          </button>
                        </PopoverContent>
                      </Popover>

                      {/* Version */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="h-7 rounded-full px-2.5 text-[12px] font-mono outline-none cursor-pointer shrink-0"
                            style={{
                              background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", color: "var(--mute)",
                            }}
                            disabled={versionsLoading}
                          >
                            {versionsLoading
                              ? "…"
                              : selectedVersion
                              ? (() => {
                                  const sv = versions.find((v) => v.versionNumber === selectedVersion);
                                  return sv ? `v${sv.versionNumber}` : `v${selectedVersion}`;
                                })()
                              : liveSnap
                              ? `${t("versions.current")} ●`
                              : versions.length > 0
                              ? `v${versions[0].versionNumber}`
                              : selectedPrompt?.version
                              ? `v${selectedPrompt.version}`
                              : "v1"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="p-1 min-w-[220px] shadow-md border border-border/60" style={{ background: "var(--paper)" }}>
                          {liveSnap && (
                            <button onClick={revertToCurrent} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-amber-600 hover:bg-amber-50 font-medium">
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
                              className={cn("px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-muted/60 group/vrow", selectedVersion === v.versionNumber && "bg-muted font-medium")}
                              onClick={() => loadVersion(v)}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-xs flex-1 min-w-0 truncate">
                                  v{v.versionNumber}{v.label ? ` — ${v.label}` : ` — ${new Date(v.savedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); deleteVersion(v.id); }} className="opacity-0 group-hover/vrow:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity shrink-0" title={t("versions.deleteVersion")}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>

                      {/* Delete */}
                      <button
                        onClick={() => onDelete(selectedPrompt)}
                        className="la-btn la-btn--soft la-btn--icon"
                        style={{ width: 32, height: 32, color: "var(--stage-lost)", flexShrink: 0 }}
                        title={t("actions.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Body: editor */}
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
            <div className="flex-1 flex items-center justify-center p-8">
              <DataEmptyState variant="prompts" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
