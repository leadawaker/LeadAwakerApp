import { useState, useEffect, useRef, useMemo } from "react";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useTranslation } from "react-i18next";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import {
  Plus,
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
  Type,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { type CampaignForPreview } from "../utils/resolveVariables";
import { useInlineEditing } from "@/features/prospects/components/useInlineEditing";
import { PromptEditorPanel, type PromptEditorPanelHandle } from "./PromptEditorPanel";
import { NicheVocabularyPanel } from "./NicheVocabularyPanel";
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

const PREVIEW_FONTS: { label: string; value: string }[] = [
  { label: "Mono", value: "var(--mono)" },
  { label: "Serif", value: "var(--serif)" },
  { label: "Sans", value: "system-ui, -apple-system, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Humanist", value: "'Trebuchet MS', Helvetica, sans-serif" },
];

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

/* ── Left panel list card ────────────────────────────────────────────────── */

function PromptListCard({
  prompt,
  isActive,
  onClick,
  campaignName,
  accountName,
}: {
  prompt: any;
  isActive: boolean;
  onClick: () => void;
  campaignName?: string;
  accountName?: string;
}) {
  const { t } = useTranslation("prompts");
  const name = prompt.name || t("labels.untitled");
  const normalizedStatus = (prompt.status || "").toLowerCase().trim();
  const isStatusActive = normalizedStatus === "active";
  const updatedAt = prompt.updatedAt || prompt.updated_at;
  const promptId = getPromptId(prompt);
  const isSystem = !MODEL_OPTIONS.includes(prompt.model);
  const accent = isSystem ? "var(--stage-responded)" : "var(--wine)";
  const accentTint = isSystem ? "rgba(63,142,142,0.12)" : "var(--wine-tint)";

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
        padding: "9px 7px",
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        background: isActive ? "var(--card)" : "transparent",
        boxShadow: isActive ? "var(--sh-raised-crisp)" : "none",
        transition: "all 130ms",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = accentTint;
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Left accent bar */}
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: 10, bottom: 10,
          width: 3, background: accent, borderRadius: "0 3px 3px 0",
        }} />
      )}
      {/* Bot icon */}
      <span style={{
        position: "relative", width: 34, height: 34, flexShrink: 0, borderRadius: "var(--r-surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isActive ? accentTint : "var(--bg)",
        boxShadow: isActive ? "none" : "var(--sh-inset-crisp)",
        color: isActive
          ? accent
          : normalizedStatus === "active"
          ? accent
          : normalizedStatus === "archived"
          ? "var(--mute-2)"
          : "var(--mute)",
        opacity: !isActive && normalizedStatus === "active" ? 0.55 : 1,
      }}>
        <Bot size={17} />
        {isActive && isStatusActive && (
          <span style={{
            position: "absolute", bottom: 1, right: 1,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--good)", border: "1.5px solid var(--card)",
          }} />
        )}
      </span>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name + date */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5, justifyContent: "space-between" }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--ink)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>
            {name}
          </span>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)",
            flexShrink: 0, marginTop: 1,
          }}>
            {formatRelativeTime(updatedAt, t)}
          </span>
        </div>
        {/* Row 2: campaign + account */}
        {(campaignName || accountName) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3, gap: 4 }}>
            {campaignName && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, minWidth: 0,
              }}>
                {campaignName}
              </span>
            )}
            {accountName && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)",
                flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 72,
              }}>
                {accountName}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Compact rail (narrower icon column) ───────────────────────────────────── */

function CompactPromptRail({
  items,
  selectedId,
  onSelect,
  campaigns,
  accountMap,
}: {
  items: any[];
  selectedId: string | null;
  onSelect: (prompt: any) => void;
  campaigns: CampaignForPreview[];
  accountMap: Map<number, string>;
}) {
  return (
    <div style={{
      width: 52, flexShrink: 0, borderRight: "1px solid var(--line)",
      background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", display: "flex",
        flexDirection: "column", gap: 6, alignItems: "center",
      }}>
        {items.map((p) => {
          const id = getPromptId(p);
          const isActive = selectedId === id;
          const pStatus = (p.status || "").toLowerCase().trim();
          const isSystem = !MODEL_OPTIONS.includes(p.model);
          const accent = isSystem ? "var(--stage-responded)" : "var(--wine)";
          const accentTint = isSystem ? "rgba(63,142,142,0.12)" : "var(--wine-tint)";
          const railColor = isActive
            ? accent
            : pStatus === "active"
            ? accent
            : pStatus === "archived"
            ? "var(--mute-2)"
            : "var(--mute)";
          const railOpacity = !isActive && pStatus === "active" ? 0.55 : 1;
          const campaign = campaigns.find((c) => c.id === Number(p.campaignsId || p.Campaigns_id));
          const campaignName = campaign?.name;
          const accountName = campaign?.accountsId ? accountMap.get(campaign.accountsId) ?? undefined : undefined;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(p)}
                  style={{
                    width: 34, height: 34, flexShrink: 0, borderRadius: "var(--r-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", border: "none",
                    background: isActive ? accentTint : "var(--bg)",
                    boxShadow: isActive ? `0 0 0 2px ${accent}` : "var(--sh-inset-crisp)",
                    color: railColor,
                    opacity: railOpacity,
                    transition: "all 130ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = accentTint;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
                  }}
                >
                  <Bot size={17} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold">{p.name || "Untitled"}</div>
                  {p.model && <div className="text-muted-foreground">{p.model}</div>}
                  {campaignName && <div className="text-muted-foreground">{campaignName}</div>}
                  {accountName && <div className="text-muted-foreground">{accountName}</div>}
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
  campaigns: CampaignForPreview[];
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
  const { state: listPanelState, cycle: cyclePanel } = useListPanelState();
  const leftPanelHidden = listPanelState === "hidden";
  const leftPanelCompact = listPanelState === "compact";

  // System / Campaigns tab filter
  const [listTab, setListTab] = useState<"system" | "campaign" | "niche">("campaign");

  // Section visibility toggles
  const [showSystemMessage, setShowSystemMessage] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // A prompt belongs to the Campaign tab only when it has a linked campaign.
  const isCampaignPrompt = (p: any) => !!(p.campaignsId || p.Campaigns_id);

  // Counts from the full prompts list (not filtered by tab)
  const systemCount = useMemo(() => prompts.filter((p: any) => !isCampaignPrompt(p)).length, [prompts]);
  const campaignCount = useMemo(() => prompts.filter((p: any) => isCampaignPrompt(p)).length, [prompts]);

  const accountMap = useMemo(
    () => new Map(availableAccounts.map((a) => [a.id, a.name])),
    [availableAccounts],
  );

  // Tab-filtered prompts
  const tabFilteredPrompts = useMemo(() => {
    return prompts.filter((p: any) =>
      listTab === "campaign" ? isCampaignPrompt(p) : !isCampaignPrompt(p)
    );
  }, [prompts, listTab]);

  // GroupedRows also needs to be tab-filtered
  const tabFilteredGroupedRows = useMemo<Map<string, any[]> | null>(() => {
    if (!groupedRows) return null;
    const result = new Map<string, any[]>();
    groupedRows.forEach((items, key) => {
      const filtered = items.filter((p: any) =>
        listTab === "campaign" ? isCampaignPrompt(p) : !isCampaignPrompt(p)
      );
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

  // Inline-rename the prompt from its header title.
  const { editableField: editablePromptName } = useInlineEditing(async (_field, value) => {
    if (!selectedPrompt || !selectedId || !value.trim()) return;
    try {
      const res = await apiFetch(`/api/prompts/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim() }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      setSelectedPrompt(saved);
      onSaved(saved);
    } catch {}
  });

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showEditorSidebar, setShowEditorSidebar] = useState(true);
  const editPanelRef = useRef<PromptEditorPanelHandle>(null);
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try { const v = localStorage.getItem("prompts-editor-font-size"); return v ? Number(v) : 14; } catch { return 14; }
  });
  useEffect(() => {
    try { localStorage.setItem("prompts-editor-font-size", String(editorFontSize)); } catch {}
  }, [editorFontSize]);
  const [previewFont, setPreviewFont] = useState(() => {
    try { return localStorage.getItem("prompts-preview-font") || "var(--mono)"; } catch { return "var(--mono)"; }
  });
  useEffect(() => {
    try { localStorage.setItem("prompts-preview-font", previewFont); } catch {}
  }, [previewFont]);
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [fontPopoverOpen, setFontPopoverOpen] = useState(false);

  // System prompt = no linked campaign → blue accent (responded-lead status color)
  const selectedIsSystem = selectedPrompt ? !(selectedPrompt.campaignsId || selectedPrompt.Campaigns_id) : false;
  const detailAccent = selectedIsSystem ? "var(--stage-responded)" : "var(--wine)";
  const detailAccentTint = selectedIsSystem ? "rgba(63,142,142,0.12)" : "var(--wine-tint)";
  const detailAccentGlow = selectedIsSystem ? "rgba(63,142,142,0.35)" : "var(--wine-glow)";

  // Derived account + campaign for selected prompt header
  const selCampaignId = selectedPrompt ? (selectedPrompt.campaignsId || selectedPrompt.Campaigns_id) : null;
  const selCampaignName = selCampaignId
    ? campaignMap.get(Number(selCampaignId)) || t("labels.noCampaign", { defaultValue: "no campaign" })
    : t("labels.noCampaign", { defaultValue: "no campaign" });
  const selCampaignData = selCampaignId ? campaigns.find((c) => c.id === Number(selCampaignId)) : null;
  const selAccountName = selCampaignData?.accountsId ? accountMap.get(selCampaignData.accountsId) : null;

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

  // Keyboard shortcuts: Ctrl+P preview, Ctrl+S save, Ctrl+Shift+S save version
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        if (selectedPrompt) setPreviewOpen((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (selectedPrompt) editPanelRef.current?.save();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (selectedPrompt) { setSaveBumpType("minor"); setSaveLabel(""); setSaveDialogOpen(true); }
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

  // Helper: get campaign name + account name for a prompt
  function getCardNames(p: any): { campaignName?: string; accountName?: string } {
    const cId = p.campaignsId || p.Campaigns_id;
    if (!cId) return {};
    const cName = campaignMap.get(Number(cId));
    const campaign = campaigns.find((c) => c.id === Number(cId));
    const aName = campaign?.accountsId ? accountMap.get(campaign.accountsId) : undefined;
    return { campaignName: cName, accountName: aName };
  }

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
          <button
            className={`la-seg-btn${listTab === "niche" ? " on" : ""}`}
            onClick={() => setListTab("niche")}
          >
            {t("vocabulary.title")}
          </button>
        </div>

        {/* Panel collapse toggle */}
        <div className="hidden lg:flex items-center" style={{ flexShrink: 0 }}>
          <button
            className="la-btn la-btn--soft la-btn--icon"
            onClick={cyclePanel}
            title={listPanelState === "full" ? "Compact panel" : listPanelState === "compact" ? "Hide panel" : "Show panel"}
          >
            {listPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Model pill — shown when a prompt is selected */}
        {listTab !== "niche" && selectedPrompt && (
          MODEL_OPTIONS.includes(selectedPrompt.model) ? (
            <select
              className="hidden lg:block text-[11px] font-mono outline-none cursor-pointer shrink-0"
              style={{
                background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
                color: "var(--mute)", borderRadius: "var(--r-pill)",
                padding: "6px 12px", height: 34,
              }}
              value={selectedPrompt.model}
              onChange={(e) => editPanelRef.current?.setField("model", e.target.value)}
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <span
              className="hidden lg:inline-block text-[11px] font-mono shrink-0"
              style={{
                background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
                color: "var(--mute-2)", borderRadius: "var(--r-pill)",
                padding: "6px 12px", height: 34, lineHeight: "22px",
              }}
            >
              Hardcoded
            </span>
          )
        )}

        {/* Controls */}
        {listTab !== "niche" && (
        <div className="hidden lg:flex items-center gap-1.5">

          {/* Edit actions — left of search, only when prompt selected */}
          {selectedPrompt && (
            <>
              {/* Font: size + family */}
              <Popover open={fontPopoverOpen} onOpenChange={setFontPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="la-btn la-btn--soft la-btn--icon"
                    style={{ width: 32, height: 32, flexShrink: 0 }}
                    title={t("editor.fontSize", { defaultValue: "Font" })}
                  >
                    <Type size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[210px] p-3" style={{ background: "var(--paper)" }}>
                  <div className="flex flex-col gap-3">
                    {/* Font family */}
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground block mb-1.5">
                        Preview font
                      </label>
                      <div className="flex flex-col gap-0.5">
                        {PREVIEW_FONTS.map((f) => (
                          <button
                            key={f.value}
                            onClick={() => setPreviewFont(f.value)}
                            className={cn(
                              "text-left text-[12px] px-2 py-1 rounded transition-colors",
                              previewFont === f.value
                                ? "bg-muted font-medium"
                                : "hover:bg-muted/50",
                            )}
                            style={{ fontFamily: f.value }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ height: 1, background: "var(--line)" }} />
                    {/* Font size */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-muted-foreground">
                        {t("editor.fontSize", { defaultValue: "Font size" })}: {editorFontSize}px
                      </label>
                      <input
                        type="range"
                        min={11}
                        max={18}
                        step={1}
                        value={editorFontSize}
                        onChange={(e) => setEditorFontSize(parseInt(e.target.value, 10))}
                        style={{ width: "100%", cursor: "pointer", accentColor: detailAccent }}
                      />
                      <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                        <span>11</span><span>18 px</span>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Save version — Ctrl+Shift+S */}
              <Popover open={saveDialogOpen} onOpenChange={(open) => { if (open) { setSaveBumpType("minor"); setSaveLabel(""); } setSaveDialogOpen(open); }}>
                <PopoverTrigger asChild>
                  <button
                    className="la-btn la-btn--soft la-btn--icon"
                    disabled={savingVersion}
                    title={`${t("versions.saveVersion")} (Ctrl+Shift+S)`}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-3 w-60 shadow-md border border-border/60" style={{ background: "var(--paper)" }}>
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

              {/* Version history */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="la-btn la-btn--soft text-[11px] font-mono shrink-0"
                    style={{ height: 32, minWidth: 32, padding: "0 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}
                    disabled={versionsLoading}
                    title={t("versions.history", { defaultValue: "Version history" })}
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
                <PopoverContent align="start" className="p-1 min-w-[220px] shadow-md border border-border/60" style={{ background: "var(--paper)" }}>
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
                        <span className="text-xs shrink-0 text-muted-foreground w-[96px]">
                          {new Date(v.savedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="text-xs flex-1 min-w-0 truncate">
                          v{v.versionNumber}{v.label ? ` — ${v.label}` : ""}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); deleteVersion(v.id); }} className="opacity-0 group-hover/vrow:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity shrink-0" title={t("versions.deleteVersion")}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>

              <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />
            </>
          )}

          {/* Search */}
          <div className="relative shrink-0" style={{ width: 180 }}>
            <input
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              placeholder={t("toolbar.searchPlaceholder", "Search...")}
              className="neu-input"
              style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: 10, height: 32, fontSize: 12 }}
            />
            <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>
            </span>
          </div>

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

          {/* Delete — stays right of sort/filter/group */}
          {selectedPrompt && (
            <>
              <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />
              <button
                onClick={() => onDelete(selectedPrompt)}
                className="la-btn la-btn--soft la-btn--icon"
                style={{ color: "var(--stage-lost)" }}
                title={t("actions.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />
            </>
          )}

          {/* New prompt */}
          <button
            onClick={onOpenCreate}
            className="la-btn la-btn--wine"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", fontSize: 12, flexShrink: 0 }}
          >
            <Plus size={13} /> {t("toolbar.create")}
          </button>
        </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Niche Words tab — full-width vocabulary manager
         ══════════════════════════════════════════════════════════════════ */}
      {listTab === "niche" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <NicheVocabularyPanel />
        </div>
      ) : (
      <>
      {/* ══════════════════════════════════════════════════════════════════
          Split pane: left list + right editor
         ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        {leftPanelHidden ? (
          <div className="hidden lg:flex lg:flex-col min-h-0 overflow-hidden" />
        ) : leftPanelCompact ? (
          <div className="hidden lg:flex">
            <CompactPromptRail
              items={tabFilteredPrompts}
              selectedId={selectedId}
              onSelect={(p) => { setSelectedPrompt(p); setMobileView("detail"); }}
              campaigns={campaigns}
              accountMap={accountMap}
            />
          </div>
        ) : (
          <div
            className={cn(
              "min-h-0 overflow-hidden flex-col",
              mobileView === "detail" ? "hidden lg:flex" : "flex",
              "w-full lg:w-[var(--toolbar-w)] lg:shrink-0",
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
                      {...getCardNames(item.prompt)}
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
          mobileView === "list" ? "hidden lg:flex" : "flex",
        )} style={{ background: "var(--surface)" }}>
          {selectedPrompt ? (
            <div key={selectedId} className="animate-panel-slide-up flex flex-col flex-1 min-h-0" style={{ padding: 8, gap: 8 }}>

              {/* ── Detail toolbar (MetaBar design) ────────────────────────── */}
              <div style={{
                flexShrink: 0, minHeight: 56, padding: "10px 18px",
                borderRadius: "var(--r-surface)",
                boxShadow: "var(--sh-raised-crisp)",
                display: "flex", alignItems: "center", gap: 14,
                background: "var(--paper)",
              }}>
                {selectedPrompt && (
                  <>
                    {/* Left section: Bot icon + name + Active badge + campaign/account */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Icon */}
                      <span style={{
                        width: 38, height: 38, flexShrink: 0, borderRadius: "var(--r-surface)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: detailAccentTint, color: detailAccent,
                        boxShadow: `0 0 0 1px ${detailAccentGlow}`,
                      }}>
                        <Bot size={18} />
                      </span>

                      {/* Name + Badge */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {editablePromptName(
                            "name",
                            selectedPrompt.name || "",
                            t("labels.untitledPrompt"),
                            "text-[16px] font-bold text-[color:var(--ink)] min-w-0 max-w-full",
                          )}
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
                              #{selectedId} · {selCampaignName}{selAccountName ? ` · ${selAccountName}` : ""}
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

                    {/* Right section: meta + controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Token + char estimate */}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", whiteSpace: "nowrap" }}>
                        ~{tokenEstimate} tok · {((selectedPrompt?.promptText || selectedPrompt?.prompt_text || "").length / 1000).toFixed(1)}k chr
                      </span>

                      {/* Vertical divider */}
                      <div style={{ width: 1, height: 22, background: "var(--line)" }} />

                      {/* System message toggle */}
                      {(() => {
                        const hasSysMsg = !!(selectedPrompt.systemMessage || selectedPrompt.system_message);
                        return (
                          <button
                            type="button"
                            onClick={() => setShowSystemMessage((v) => !v)}
                            className={cn("la-btn", showSystemMessage ? "la-btn--inset" : "la-btn")}
                            style={{ height: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12, color: hasSysMsg ? detailAccent : showSystemMessage ? "var(--ink)" : "var(--mute-2)" }}
                            title="Toggle system message"
                          >
                            <EyeOff size={13} />
                            System msg
                          </button>
                        );
                      })()}

                      {/* Notes toggle */}
                      {(() => {
                        const hasNotes = !!(selectedPrompt.notes);
                        return (
                          <button
                            type="button"
                            onClick={() => setShowNotes((v) => !v)}
                            className={cn("la-btn", showNotes ? "la-btn--inset" : "la-btn")}
                            style={{ height: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12, color: hasNotes ? detailAccent : showNotes ? "var(--ink)" : "var(--mute-2)" }}
                            title="Toggle notes"
                          >
                            <EyeOff size={13} />
                            Notes
                          </button>
                        );
                      })()}

                      {/* Left panel toggle */}
                      <button
                        type="button"
                        onClick={() => setShowEditorSidebar((v) => !v)}
                        className={cn("la-btn", showEditorSidebar ? "la-btn--surface" : "la-btn--soft")}
                        style={{ height: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12, color: showEditorSidebar ? detailAccent : undefined }}
                        title="Toggle left panel"
                      >
                        {showEditorSidebar ? <Eye size={13} /> : <EyeOff size={13} />}
                        Left Panel
                      </button>

                      {/* Preview toggle — Ctrl+P */}
                      <button
                        type="button"
                        onClick={() => setPreviewOpen((p) => !p)}
                        className={cn("la-btn", previewOpen ? "la-btn--surface" : "la-btn--soft")}
                        style={{ height: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12, color: previewOpen ? detailAccent : undefined }}
                        title="Toggle preview (Ctrl+P)"
                      >
                        {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                        Preview
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
                showSidebar={showEditorSidebar}
                showSystemMessage={showSystemMessage}
                showNotes={showNotes}
                editorFontSize={editorFontSize}
                previewFont={previewFont}
                accentColor={detailAccent}
                accentHex={selectedIsSystem ? "#3F8E8E" : "#722F37"}
                onTokenEstimate={setTokenEstimate}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <DataEmptyState variant="prompts" />
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
