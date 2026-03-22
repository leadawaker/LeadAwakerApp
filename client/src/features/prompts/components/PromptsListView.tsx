import { useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef, useCallback } from "react";
import { hapticSave } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import {
  Plus,
  Star,
  ArrowUpDown,
  Layers,
  Filter,
  Check,
  Save,
  Trash2,
  ChevronLeft,
  List,
  Table2,
  Bot,
} from "lucide-react";
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
import {
  getStatusBadgeClasses,
  getScoreColorClasses,
  getPromptId,
  type PromptViewMode,
  type PromptSortOption,
  type PromptGroupOption,
  type PromptFormData,
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

/* ── EditPanel ───────────────────────────────────────────────────────────── */

interface EditPanelHandle {
  save: () => void;
  isSaving: boolean;
}

const EditPanel = forwardRef<EditPanelHandle, {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  onSavingChange?: (saving: boolean) => void;
  campaigns?: { id: number; name: string; aiModel: string }[];
}>(function EditPanel({ prompt, onSaved, onDelete, onSavingChange, campaigns = [] }, ref) {
  const { toast } = useToast();
  const { t } = useTranslation("prompts");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PromptFormData>({
    name: "",
    promptText: "",
    systemMessage: "",
    model: "gpt-5.1",
    temperature: "0.7",
    maxTokens: "1000",
    status: "active",
    useCase: "",
    notes: "",
    campaignsId: "",
  });
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});
  const promptTextRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Stable ref to latest handleSave — avoids stale closure in useImperativeHandle
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  const promptId = getPromptId(prompt);

  useImperativeHandle(ref, () => ({
    save: () => { handleSaveRef.current(); },
    get isSaving() { return saving; },
  }), [saving]);

  useEffect(() => {
    setForm({
      name: prompt.name || "",
      promptText: prompt.promptText || prompt.prompt_text || "",
      systemMessage: prompt.systemMessage || prompt.system_message || "",
      model: prompt.model || "gpt-5.1",
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: (prompt.status || "active").toLowerCase(),
      useCase: prompt.useCase || prompt.use_case || "",
      notes: (prompt.notes || "").replace(/^System prompt\s*[-–—]?\s*auto[- ]created.*$/im, "").trim(),
      campaignsId:
        prompt.campaignsId != null
          ? String(prompt.campaignsId)
          : prompt.Campaigns_id != null
          ? String(prompt.Campaigns_id)
          : "",
    });
    setErrors({});
  }, [promptId]);

  function setField(field: keyof PromptFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<PromptFormData> = {};
    if (!form.name.trim()) e.name = t("form.required");
    if (!form.promptText.trim()) e.promptText = t("form.required");
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) e.temperature = t("form.temperatureError");
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) e.maxTokens = t("form.maxTokensError");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    onSavingChange?.(true);
    try {
      const payload = {
        name: form.name.trim(),
        promptText: form.promptText.trim(),
        systemMessage: form.systemMessage.trim() || null,
        model: form.model || null,
        temperature: form.temperature,
        maxTokens: parseInt(form.maxTokens, 10),
        status: form.status || "active",
        useCase: form.useCase.trim() || null,
        notes: form.notes.trim() || null,
        campaignsId: form.campaignsId ? parseInt(form.campaignsId, 10) : null,
      };
      const res = await apiFetch(`/api/prompts/${promptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      onSaved(saved);
      hapticSave();
      toast({ title: t("toast.saved"), description: t("toast.savedDescription", { name: form.name }) });
    } catch (err: any) {
      toast({
        title: t("toast.saveFailed"),
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  // Keep ref in sync with the latest handleSave so useImperativeHandle never goes stale
  handleSaveRef.current = handleSave;

  // Auto-resize prompt textarea on content change.
  // Saves/restores scroll container position to prevent mobile scroll jumps
  // caused by the brief height-collapse needed to measure scrollHeight.
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const container = scrollContainerRef.current;
    const savedTop = container ? container.scrollTop : 0;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
    if (container) container.scrollTop = savedTop;
  }, []);

  useEffect(() => {
    autoResize(promptTextRef.current);
  }, [form.promptText, autoResize]);

  const inputCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaCls =
    "w-full rounded-xl bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 appearance-none";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5 block";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable two-column body */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[3px] pb-[3px] [scrollbar-width:thin]">
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-[3px] max-w-[1386px] w-full mr-auto">

          {/* ── Left column (wide): Prompt Content + System Message ── */}
          <div className="flex flex-col gap-[3px]">
            {/* Prompt Content */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.promptContent")}
              </p>
              <textarea
                ref={promptTextRef}
                className={cn(
                  textareaCls,
                  "min-h-[120px] overflow-hidden resize-none",
                  errors.promptText ? "ring-2 ring-red-400/40" : "",
                )}
                value={form.promptText}
                onChange={(e) => { setField("promptText", e.target.value); autoResize(e.target); }}
                placeholder={t("form.mainPromptPlaceholder")}
              />
              {errors.promptText && (
                <p className="text-[10px] text-red-500 mt-0.5">{errors.promptText}</p>
              )}
            </div>

            {/* System Message */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.systemMessage")}
              </p>
              <div>
                <textarea
                  className={cn(textareaCls, "min-h-[80px]")}
                  value={form.systemMessage}
                  onChange={(e) => setField("systemMessage", e.target.value)}
                  placeholder={t("form.systemMessagePlaceholderAlt")}
                />
              </div>
            </div>

          </div>

          {/* ── Right column (narrow): Identity + Configuration + Notes ── */}
          <div className="flex flex-col gap-[3px]">
            {/* Identity */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.identity")}
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelCls}>{t("form.name")} *</label>
                  <input
                    className={cn(inputCls, errors.name && "ring-2 ring-red-400/40")}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder={t("form.namePlaceholderAlt")}
                  />
                  {errors.name && (
                    <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t("form.useCase")}</label>
                  <input
                    className={inputCls}
                    value={form.useCase}
                    onChange={(e) => setField("useCase", e.target.value)}
                    placeholder={t("form.useCasePlaceholder")}
                  />
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.configuration")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>{t("labels.campaign")}</label>
                  <select
                    className={selectCls}
                    value={form.campaignsId}
                    onChange={(e) => setField("campaignsId", e.target.value)}
                  >
                    <option value="">{t("form.noneOption")}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("detail.model")}</label>
                  <div className={`${selectCls} opacity-60 cursor-default`}>
                    {(() => {
                      const c = campaigns.find((c) => String(c.id) === form.campaignsId);
                      return c?.aiModel || t("form.noCampaignModel");
                    })()}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t("labels.status")}</label>
                  <select
                    className={selectCls}
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                  >
                    <option value="active">{t("status.active")}</option>
                    <option value="archived">{t("status.archived")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("form.temperature")} {t("form.temperatureRange")}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className={cn(inputCls, errors.temperature && "ring-2 ring-red-400/40")}
                    value={form.temperature}
                    onChange={(e) => setField("temperature", e.target.value)}
                  />
                  {errors.temperature && (
                    <p className="text-[10px] text-red-500 mt-0.5">{errors.temperature}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t("form.maxTokens")}</label>
                  <input
                    type="number"
                    min="1"
                    className={cn(inputCls, errors.maxTokens && "ring-2 ring-red-400/40")}
                    value={form.maxTokens}
                    onChange={(e) => setField("maxTokens", e.target.value)}
                  />
                  {errors.maxTokens && (
                    <p className="text-[10px] text-red-500 mt-0.5">{errors.maxTokens}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.notes")}
              </p>
              <div>
                <textarea
                  className={cn(textareaCls, "min-h-[80px]")}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder={t("form.notesPlaceholderAlt")}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});

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
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconColor.bg }}
        >
          <Bot className="h-4.5 w-4.5" style={{ color: iconColor.icon }} />
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
        <span className="text-foreground/20 shrink-0">–</span>
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
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const editPanelRef = useRef<EditPanelHandle>(null);

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
      <div className={cn("w-full md:w-[340px] md:shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden", mobileView === "detail" ? "hidden md:flex" : "flex")}>
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

              {/* +Create */}
              <button
                className={cn(xBase, "hover:max-w-[100px]", xDefault)}
                onClick={onOpenCreate}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("toolbar.create")}</span>
              </button>

              {/* Search */}
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
                  <button className={cn(xBase, "hover:max-w-[80px]", sortBy !== "recent" ? xActive : xDefault)}>
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

              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)}>
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("toolbar.filter")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("labels.status")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      className="text-[12px] flex items-center justify-between"
                      onClick={(e) => { e.preventDefault(); onStatusFilterChange(opt); }}
                    >
                      {opt === "all" ? t("toolbar.allStatuses") : t(STATUS_I18N_KEY[opt] ?? "status.unknown")}
                      {statusFilter === opt && <Check className="h-3 w-3 text-brand-indigo" />}
                    </DropdownMenuItem>
                  ))}

                  {availableModels.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("labels.model")}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className={cn("text-[12px]", modelFilter === "all" && "font-semibold text-brand-indigo")}
                        onClick={(e) => { e.preventDefault(); onModelFilterChange("all"); }}
                      >
                        {t("toolbar.allModels")}
                        {modelFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      {availableModels.map((m) => (
                        <DropdownMenuItem
                          key={m}
                          className={cn("text-[12px]", modelFilter === m && "font-semibold text-brand-indigo")}
                          onClick={(e) => { e.preventDefault(); onModelFilterChange(m); }}
                        >
                          <span className="truncate flex-1">{m}</span>
                          {modelFilter === m && <Check className="h-3 w-3 ml-1 shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}

                  {availableCampaigns.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("labels.campaign")}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className={cn("text-[12px]", !campaignFilter && "font-semibold text-brand-indigo")}
                        onClick={(e) => { e.preventDefault(); onCampaignFilterChange(""); }}
                      >
                        {t("toolbar.allCampaigns")}
                        {!campaignFilter && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      {availableCampaigns.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          className={cn("text-[12px]", campaignFilter === String(c.id) && "font-semibold text-brand-indigo")}
                          onClick={(e) => { e.preventDefault(); onCampaignFilterChange(campaignFilter === String(c.id) ? "" : String(c.id)); }}
                        >
                          <span className="truncate flex-1">{c.name}</span>
                          {campaignFilter === String(c.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}

                  {availableAccounts.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("labels.account")}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className={cn("text-[12px]", !accountFilter && "font-semibold text-brand-indigo")}
                        onClick={(e) => { e.preventDefault(); onAccountFilterChange(""); }}
                      >
                        {t("toolbar.allAccounts")}
                        {!accountFilter && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      {availableAccounts.map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          className={cn("text-[12px]", accountFilter === String(a.id) && "font-semibold text-brand-indigo")}
                          onClick={(e) => { e.preventDefault(); onAccountFilterChange(accountFilter === String(a.id) ? "" : String(a.id)); }}
                        >
                          <span className="truncate flex-1">{a.name}</span>
                          {accountFilter === String(a.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}

                  {isFilterActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onClearAllFilters} className="text-[12px] text-destructive">
                        {t("toolbar.clearAllFilters")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Group */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", groupBy !== "none" ? xActive : xDefault)}>
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("toolbar.group")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {GROUP_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => onGroupByChange(opt)}
                      className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}
                    >
                      {t(PROMPT_GROUP_TKEYS[opt])}
                      {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

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

              {/* Save button */}
              <button
                onClick={() => editPanelRef.current?.save()}
                disabled={editSaving}
                className={cn(xBase, "hover:max-w-[80px] border-brand-indigo text-brand-indigo")}
              >
                <Save className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{editSaving ? t("actions.saving") : t("actions.save")}</span>
              </button>

              {/* Delete button */}
              <button
                onClick={() => onDelete(selectedPrompt)}
                className={cn(xBase, "hover:max-w-[100px] border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("actions.delete")}</span>
              </button>
            </div>

            {/* ── Title + status row ──────────────────────────────────────── */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-3">
                {(() => {
                  const spAId = selectedPrompt.accountsId || selectedPrompt.Accounts_id;
                  const ic = getPromptIconColor(spAId ? `account-${spAId}` : "agency-bots");
                  return (
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: ic.bg }}
                    >
                      <Bot className="h-6 w-6" style={{ color: ic.icon }} />
                    </div>
                  );
                })()}
                <h2 className="text-[22px] font-semibold font-heading text-foreground leading-tight">
                  {selectedPrompt.name || t("labels.untitledPrompt")}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                    getStatusBadgeClasses(selectedPrompt.status),
                  )}
                >
                  {t(STATUS_I18N_KEY[selectedPrompt.status?.toLowerCase() ?? ""] ?? "status.unknown")}
                </span>
                {selectedPrompt.model && (
                  <>
                    <span className="text-foreground/25 text-[13px]">·</span>
                    <span className="text-[13px] text-foreground/50">
                      {selectedPrompt.model}
                    </span>
                  </>
                )}
                {selectedPrompt.version && (
                  <>
                    <span className="text-foreground/25 text-[13px]">·</span>
                    <span className="text-[13px] text-foreground/50 font-mono">
                      v{selectedPrompt.version}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Body: always-editable two-column panel */}
            <EditPanel
              ref={editPanelRef}
              prompt={selectedPrompt}
              onSaved={onSaved}
              onDelete={onDelete}
              onSavingChange={setEditSaving}
              campaigns={campaigns}
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
