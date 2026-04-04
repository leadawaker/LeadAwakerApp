import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { resolveVariablesHtml, type CampaignForPreview } from "../utils/resolveVariables";
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

function EditPanel({
  prompt,
  onSaved,
  onDelete,
  campaigns = [],
  versionOverride = null,
  previewOpen,
  setPreviewOpen,
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  campaigns?: CampaignForPreview[];
  versionOverride?: PromptVersion | null;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
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
  // highlightTick triggers backdrop + preview re-render on every keystroke
  const [highlightTick, setHighlightTick] = useState(0);
  const [sampleLead, setSampleLead] = useState<import("../utils/resolveVariables").LeadForPreview | null>(null);
  // Uncontrolled refs for the 3 textarea fields — keeps browser undo history intact
  const promptTextValRef = useRef<string>("");
  const systemMessageValRef = useRef<string>("");
  const notesValRef = useRef<string>("");
  const promptTextRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const systemMessageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  // Stable ref to latest handleSave — avoids stale closure in useImperativeHandle
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  const promptId = getPromptId(prompt);
  const initialized = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const promptText = prompt.promptText || prompt.prompt_text || "";
    const systemMessage = prompt.systemMessage || prompt.system_message || "";
    const notes = (prompt.notes || "").replace(/^System prompt\s*[-–—]?\s*auto[- ]created.*$/im, "").trim();
    promptTextValRef.current = promptText;
    systemMessageValRef.current = systemMessage;
    notesValRef.current = notes;
    if (promptTextRef.current) promptTextRef.current.value = promptText;
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = systemMessage;
    if (notesTextareaRef.current) notesTextareaRef.current.value = notes;
    setForm({
      name: prompt.name || "",
      promptText,
      systemMessage,
      model: prompt.model || "gpt-5.1",
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: (prompt.status || "active").toLowerCase(),
      useCase: prompt.useCase || prompt.use_case || "",
      notes,
      campaignsId:
        prompt.campaignsId != null
          ? String(prompt.campaignsId)
          : prompt.Campaigns_id != null
          ? String(prompt.Campaigns_id)
          : "",
    });
    setErrors({});
    setHighlightTick((n) => n + 1); // re-render backdrop/preview with new prompt text
    initialized.current = false;
    const t = setTimeout(() => { initialized.current = true; }, 150);
    return () => clearTimeout(t);
  }, [promptId]);

  // Sync form.status when header pill changes status externally
  useEffect(() => {
    const newStatus = (prompt.status || "active").toLowerCase();
    setForm((prev) => prev.status === newStatus ? prev : { ...prev, status: newStatus });
  }, [prompt.status]);

  // Apply a loaded version's content into the uncontrolled textareas
  useEffect(() => {
    if (!versionOverride) return;
    const pt = versionOverride.promptText || "";
    const sm = versionOverride.systemMessage || "";
    const nt = versionOverride.notes || "";
    promptTextValRef.current = pt;
    systemMessageValRef.current = sm;
    notesValRef.current = nt;
    if (promptTextRef.current) { promptTextRef.current.value = pt; autoResize(promptTextRef.current); }
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = sm;
    if (notesTextareaRef.current) notesTextareaRef.current.value = nt;
    setHighlightTick((n) => n + 1);
    scheduleAutoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionOverride]);

  // Auto-save for structured fields (textarea fields call scheduleAutoSave directly)
  useEffect(() => {
    if (!initialized.current) return;
    scheduleAutoSave();
    return () => clearTimeout(autoSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.model, form.temperature, form.maxTokens, form.status, form.useCase, form.campaignsId]);

  // Backdrop content — highlights all {variable} tokens in amber; updates on every keystroke
  const renderBackdrop = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const parts = text.split(/(\{\w+\})/);
    return (
      <>
        {parts.filter(p => p).map((part, idx) => {
          if (/^\{\w+\}$/.test(part)) {
            return <mark key={idx} className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{part}</mark>;
          }
          return <>{part}</>;
        })}
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Fetch sample lead when preview opens and a campaign is selected
  useEffect(() => {
    if (!previewOpen || !form.campaignsId) { setSampleLead(null); return; }
    apiFetch(`/api/leads?campaignId=${form.campaignsId}&limit=1`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const lead = Array.isArray(data) ? data[0] : null;
        setSampleLead(lead ? {
          firstName: lead.firstName ?? lead.first_name ?? null,
          lastName: lead.lastName ?? lead.last_name ?? null,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          whatHasTheLeadDone: lead.whatHasTheLeadDone ?? lead.what_has_the_lead_done ?? null,
        } : null);
      })
      .catch(() => setSampleLead(null));
  }, [previewOpen, form.campaignsId]);


  function scheduleAutoSave() {
    if (!initialized.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => handleSaveRef.current(true), 800);
  }

  function setField(field: keyof PromptFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<PromptFormData> = {};
    if (!form.name.trim()) e.name = t("form.required");
    if (!promptTextValRef.current.trim()) e.promptText = t("form.required");
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) e.temperature = t("form.temperatureError");
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) e.maxTokens = t("form.maxTokensError");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(silent = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        promptText: promptTextValRef.current.trim(),
        systemMessage: systemMessageValRef.current.trim() || null,
        model: form.model || null,
        temperature: form.temperature,
        maxTokens: parseInt(form.maxTokens, 10),
        status: form.status || "active",
        useCase: form.useCase.trim() || null,
        notes: notesValRef.current.trim() || null,
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
      if (!silent) {
        hapticSave();
        toast({ title: t("toast.saved"), description: t("toast.savedDescription", { name: form.name }) });
      }
    } catch (err: any) {
      toast({
        title: t("toast.saveFailed"),
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // Keep ref in sync with the latest handleSave so useImperativeHandle never goes stale
  handleSaveRef.current = handleSave;

  // Auto-resize prompt textarea on content change.
  // Uses an off-screen mirror textarea to measure the required height without
  // collapsing the real element, which avoids triggering browser cursor-follow
  // scroll that would snap the viewport when the user presses Enter.
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    const mirror = document.createElement("textarea");
    mirror.style.cssText =
      `position:fixed;top:-9999px;left:-9999px;visibility:hidden;overflow:hidden;height:0;` +
      `width:${el.getBoundingClientRect().width}px;` +
      `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft};` +
      `border:${cs.border};font-size:${cs.fontSize};font-family:${cs.fontFamily};` +
      `line-height:${cs.lineHeight};letter-spacing:${cs.letterSpacing};white-space:pre-wrap;`;
    mirror.value = el.value;
    document.body.appendChild(mirror);
    const newHeight = Math.max(mirror.scrollHeight, 200);
    document.body.removeChild(mirror);
    el.style.height = newHeight + "px";
  }, []);

  // Sync backdrop div styles with textarea for perfect alignment
  useEffect(() => {
    const ta = promptTextRef.current;
    const bd = backdropRef.current;
    if (!ta || !bd) return;
    const cs = getComputedStyle(ta);
    bd.style.font = cs.font;
    bd.style.letterSpacing = cs.letterSpacing;
    bd.style.lineHeight = cs.lineHeight;
    bd.style.wordWrap = cs.wordWrap;
    bd.style.whiteSpace = cs.whiteSpace;
  }, [promptTextValRef.current?.length]);

  useEffect(() => {
    autoResize(promptTextRef.current);
  }, [autoResize]);

  // Sync backdrop transform + synchronized proportional scrolling between textarea and preview pane
  useEffect(() => {
    const textarea = promptTextRef.current;
    const backdrop = backdropRef.current;
    const preview = previewPaneRef.current;

    if (!textarea || !backdrop) return;

    const handleTextareaScroll = () => {
      // Sync backdrop with transform (absolute positioned divs respond to transform, not scrollTop)
      backdrop.style.transform = `translateY(-${textarea.scrollTop}px)`;

      // Sync preview scroll with proportional calculation if preview is open
      if (!previewOpen || !preview) return;
      if (syncingScrollRef.current) return;
      syncingScrollRef.current = true;

      // Proportional scroll: textarea scroll ratio applied to preview
      const textareaScrollHeight = textarea.scrollHeight - textarea.clientHeight;
      const previewScrollHeight = preview.scrollHeight - preview.clientHeight;

      if (textareaScrollHeight > 0 && previewScrollHeight > 0) {
        const scrollRatio = textarea.scrollTop / textareaScrollHeight;
        preview.scrollTop = scrollRatio * previewScrollHeight;
      }

      setTimeout(() => { syncingScrollRef.current = false; }, 0);
    };

    const handlePreviewScroll = () => {
      if (!preview) return;
      if (syncingScrollRef.current) return;
      syncingScrollRef.current = true;

      // Proportional scroll: preview scroll ratio applied to textarea
      const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
      const textareaScrollHeight = textarea.scrollHeight - textarea.clientHeight;

      if (previewScrollHeight > 0 && textareaScrollHeight > 0) {
        const scrollRatio = preview.scrollTop / previewScrollHeight;
        textarea.scrollTop = scrollRatio * textareaScrollHeight;
      }

      setTimeout(() => { syncingScrollRef.current = false; }, 0);
    };

    textarea.addEventListener("scroll", handleTextareaScroll);
    if (preview) preview.addEventListener("scroll", handlePreviewScroll);

    return () => {
      textarea.removeEventListener("scroll", handleTextareaScroll);
      if (preview) preview.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [previewOpen]);

  const inputCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaCls =
    "w-full rounded-xl bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 appearance-none";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5 block";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content panels */}
      <div className={cn("flex flex-1 min-h-0", previewOpen ? "flex-row" : "flex-col")}>
        {/* Left scrollable editor panel */}
        <div ref={scrollContainerRef} className={cn("min-h-0 overflow-y-auto overscroll-contain px-[3px] pb-[3px] [scrollbar-width:thin]", previewOpen ? "w-1/2" : "flex-1")}>
          <div className="flex flex-col gap-[3px] max-w-[1386px] w-full mr-auto">
            {/* ── Prompt Content + System Message ── */}
            <div className="flex flex-col gap-[3px]">
              {/* Prompt Content */}
              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.promptContent")}
              </p>
              <div className="relative">
                {/* Amber-highlight backdrop — floats over textarea, pointer-events:none */}
                <div
                  ref={backdropRef}
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none z-[1] overflow-hidden rounded-xl px-2.5 py-2 text-[12px] whitespace-pre-wrap break-words text-transparent"
                >
                  {renderBackdrop}
                </div>
                <textarea
                  ref={promptTextRef}
                  className={cn(
                    textareaCls,
                    "h-[400px] overflow-y-auto resize-none relative",
                    errors.promptText ? "ring-2 ring-red-400/40" : "",
                  )}
                  defaultValue={promptTextValRef.current}
                  onChange={(e) => { promptTextValRef.current = e.target.value; scheduleAutoSave(); }}
                  onInput={() => setHighlightTick((t) => t + 1)}
                  placeholder={t("form.mainPromptPlaceholder")}
                />
              </div>
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
                  ref={systemMessageTextareaRef}
                  className={cn(textareaCls, "min-h-[80px]")}
                  defaultValue={systemMessageValRef.current}
                  onChange={(e) => { systemMessageValRef.current = e.target.value; scheduleAutoSave(); }}
                  placeholder={t("form.systemMessagePlaceholderAlt")}
                />
              </div>
            </div>

            {/* ── Bottom row: Identity + Configuration + Notes (3 columns) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[3px]">
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
                    ref={notesTextareaRef}
                    className={cn(textareaCls, "min-h-[118px] h-full")}
                    defaultValue={notesValRef.current}
                    onChange={(e) => { notesValRef.current = e.target.value; scheduleAutoSave(); }}
                    placeholder={t("form.notesPlaceholderAlt")}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Right-side preview pane (split screen when preview is open) */}
      {previewOpen && (() => {
        const text = promptTextValRef.current ?? "";
        void highlightTick;
        const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
        const highlighted = resolveVariablesHtml(text, selectedCampaign, sampleLead);
        const leadLabel = sampleLead?.firstName
          ? `${sampleLead.firstName}${sampleLead.lastName ? " " + sampleLead.lastName : ""}`
          : form.campaignsId ? "no leads" : "no campaign";
        return (
          <div ref={previewPaneRef} className="w-1/2 min-h-0 overflow-y-auto border-l border-border/30 bg-muted/20 flex flex-col">
            <div className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Eye className="h-3 w-3" />
              <span>Preview · <span className="italic">{leadLabel}</span></span>
            </div>
            <div className="p-4 flex-1">
              {text.trim() ? (
                <div
                  className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <p className="text-muted-foreground italic text-[12px]">Nothing to preview yet.</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
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

              {/* Search — always visible */}
              <SearchPill
                value={q}
                onChange={onQChange}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder={t("toolbar.searchPlaceholder")}
              />

              {/* List controls — hidden when left panel is collapsed */}
              {!leftPanelCollapsed && (<>
              {/* +Create */}
              <button
                className={cn(xBase, "hover:max-w-[100px]", xDefault)}
                onClick={onOpenCreate}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("toolbar.create")}</span>
              </button>

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
              </>)}

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
                <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 font-mono">
                  #{selectedId}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full transition-opacity hover:opacity-70 cursor-pointer",
                        getStatusBadgeClasses(selectedPrompt.status),
                      )}
                    >
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
                {selectedPrompt.model && (
                  <>
                    <span className="text-foreground/25 text-[13px]">·</span>
                    <span className="text-[13px] text-foreground/50">
                      {selectedPrompt.model}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Body: always-editable two-column panel */}
            <EditPanel
              prompt={selectedPrompt}
              onSaved={onSaved}
              onDelete={onDelete}
              campaigns={campaigns}
              versionOverride={versionOverride}
              previewOpen={previewOpen}
              setPreviewOpen={setPreviewOpen}
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
