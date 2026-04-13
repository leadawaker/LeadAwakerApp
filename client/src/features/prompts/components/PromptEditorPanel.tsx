import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { hapticSave } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { resolveVariablesHtml, type CampaignForPreview } from "../utils/resolveVariables";
import { PromptSearchBar } from "./PromptSearchBar";
import { PromptVariableAutocomplete, KNOWN_VARIABLE_SET } from "./PromptVariableAutocomplete";
import { PromptSnippets } from "./PromptSnippets";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import {
  getPromptId,
  type PromptFormData,
  type PromptVersion,
} from "../types";
import { usePublishEntityData } from "@/contexts/PageEntityContext";

/* ── Exported handle type ──────────────────────────────────────────────── */

export type PromptEditorPanelHandle = {
  setField: (k: string, v: string) => void;
  getForm: () => PromptFormData;
  getTokenEstimate: () => number;
};

/* ── Component ─────────────────────────────────────────────────────────── */

export const PromptEditorPanel = forwardRef(function PromptEditorPanel({
  prompt,
  onSaved,
  onDelete,
  campaigns = [],
  versionOverride = null,
  previewOpen,
  setPreviewOpen,
  editorFontSize,
  splitPreview = true,
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  campaigns?: CampaignForPreview[];
  versionOverride?: PromptVersion | null;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  editorFontSize: number;
  /** When true (default), preview opens side-by-side with the editor. When false, preview replaces the editor. */
  splitPreview?: boolean;
}, ref: React.Ref<PromptEditorPanelHandle>) {
  const { toast } = useToast();
  const { t } = useTranslation("prompts");
  const [saving, setSaving] = useState(false);

  // ── Publish entity data for AI chat context ──────────────────────────────
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!prompt) return;
    publishEntity({
      entityType: "prompt",
      entityId: getPromptId(prompt),
      entityName: prompt.name || "Unknown Prompt",
      summary: {
        id: getPromptId(prompt),
        name: prompt.name,
        status: prompt.status,
        useCase: prompt.use_case,
        model: prompt.model,
        campaignsId: prompt.campaigns_id,
        notes: prompt.notes,
      },
      updatedAt: Date.now(),
    });
  }, [publishEntity, prompt]);
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
  const editorOffsetRef = useRef<number>(0);
  const [activeHeaders, setActiveHeaders] = useState<{ h1?: string; h2?: string; h3?: string }>({});
  const [searchOpen, setSearchOpen] = useState(false);
  // Stable ref to latest handleSave — avoids stale closure in useImperativeHandle
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});

  const promptId = getPromptId(prompt);
  const initialized = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Backdrop content — highlights variables (amber=known, red=unknown); one div per line for height measurement
  const backdropLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renderBackdrop = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const lines = text.split("\n");
    backdropLineRefs.current = [];

    // Split each line into variable tokens, conditional tags, and plain text
    const TOKEN_RE = /(\{\{#if\s+\w+\s*(?:==|!=)\s*"[^"]*"\}\}|\{\{\/if\}\}|\{\w+\})/;
    const IF_OPEN_RE = /^\{\{#if\s+/;
    const IF_CLOSE_RE = /^\{\{\/if\}\}$/;
    const INDIGO = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";

    // Track whether we're inside a conditional block across lines
    let insideConditional = false;

    return (
      <>
        {lines.map((line, lineIdx) => {
          const parts = line.split(TOKEN_RE);
          return (
            <div
              key={lineIdx}
              ref={(el) => { backdropLineRefs.current[lineIdx] = el; }}
            >
              {parts.filter(p => p).map((part, idx) => {
                // Opening tag: {{#if ...}}
                if (IF_OPEN_RE.test(part)) {
                  insideConditional = true;
                  return <mark key={idx} className={INDIGO}>{part}</mark>;
                }
                // Closing tag: {{/if}}
                if (IF_CLOSE_RE.test(part)) {
                  insideConditional = false;
                  return <mark key={idx} className={INDIGO}>{part}</mark>;
                }
                // Variable tokens: {var_name}
                if (/^\{\w+\}$/.test(part)) {
                  const varName = part.slice(1, -1);
                  const isKnown = KNOWN_VARIABLE_SET.has(varName);
                  return (
                    <mark
                      key={idx}
                      className={isKnown
                        ? INDIGO
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      }
                    >
                      {part}
                    </mark>
                  );
                }
                // Plain text inside a conditional block: highlight it too
                if (insideConditional) {
                  return <mark key={idx} className={INDIGO}>{part}</mark>;
                }
                return <span key={idx}>{part}</span>;
              })}
              {line === "" && <br />}
            </div>
          );
        })}
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Token count estimate (prompt + system message)
  const tokenEstimate = useMemo(() => {
    const promptLen = (promptTextValRef.current ?? "").length;
    const sysLen = (systemMessageValRef.current ?? "").length;
    return Math.ceil((promptLen + sysLen) / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Parsed headings for sticky headers
  const headings = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const lines = text.split("\n");
    const h: { level: 1 | 2 | 3; text: string; lineIndex: number }[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/^(#{1,3})\s+(.+)/);
      if (m) h.push({ level: m[1].length as 1 | 2 | 3, text: m[2].trim(), lineIndex: i });
    });
    return h;
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

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  useImperativeHandle(ref, () => ({
    setField,
    getForm: () => form,
    getTokenEstimate: () => tokenEstimate,
  }));

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

  // Ctrl+F opens search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Sync backdrop div styles with textarea for perfect alignment + store line height
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
  }, [promptTextValRef.current?.length, editorFontSize]);

  // Auto-resize prompt textarea on mount, content changes, font size changes, and split toggle
  useEffect(() => {
    // When layout changes (e.g. split toggle), wait a frame for the new width before measuring
    requestAnimationFrame(() => autoResize(promptTextRef.current));
  }, [autoResize, highlightTick, editorFontSize, previewOpen]);

  // Auto-resize system message and notes on mount
  useEffect(() => {
    autoResize(systemMessageTextareaRef.current);
    autoResize(notesTextareaRef.current);
  }, [autoResize]);


  // Sticky section headers: use actual backdrop div positions for zero-drift accuracy
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) {
      setActiveHeaders({});
      return;
    }

    const handleScroll = () => {
      const refs = backdropLineRefs.current;
      if (refs.length === 0) return;
      const containerTop = container.getBoundingClientRect().top;

      // Find the topmost visible line by checking actual DOM positions
      let topLine = 0;
      for (const h of headings) {
        const el = refs[h.lineIndex];
        if (!el) continue;
        const elTop = el.getBoundingClientRect().top - containerTop;
        if (elTop > 10) break; // 10px buffer so header triggers slightly early
        topLine = h.lineIndex;
      }

      let h1: string | undefined;
      let h2: string | undefined;
      let h3: string | undefined;
      for (const h of headings) {
        if (h.lineIndex > topLine) break;
        if (h.level === 1) { h1 = h.text; h2 = undefined; h3 = undefined; }
        else if (h.level === 2) { h2 = h.text; h3 = undefined; }
        else if (h.level === 3) { h3 = h.text; }
      }
      setActiveHeaders((prev) => {
        if (prev.h1 === h1 && prev.h2 === h2 && prev.h3 === h3) return prev;
        return { h1, h2, h3 };
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const inputCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaCls =
    "w-full rounded-xl bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectCls =
    "w-full h-9 rounded-xl bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 appearance-none";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5 block";

  // Whether the preview replaces the editor (overlay) or sits beside it (split)
  const isSplit = splitPreview && previewOpen;
  const isOverlayPreview = !splitPreview && previewOpen;

  // Shared preview renderer
  const renderPreview = () => {
    const text = promptTextValRef.current ?? "";
    void highlightTick;
    const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
    const rawLines = text.split("\n");
    const highlighted = resolveVariablesHtml(text, selectedCampaign, sampleLead);
    const previewLines = highlighted.split("\n");
    return text.trim() ? (
      <div
        className="text-foreground break-words"
        style={{ fontSize: `${editorFontSize}px` }}
      >
        {previewLines.map((line, i) => {
          const raw = rawLines[i] ?? "";
          const h3 = /^###\s/.test(raw);
          const h2 = !h3 && /^##\s/.test(raw);
          const h1 = !h3 && !h2 && /^#\s/.test(raw);
          const isHeading = h1 || h2 || h3;
          const sizeClass = h1 ? "text-[1.5em] font-bold" : h2 ? "text-[1.25em] font-bold" : h3 ? "text-[1.1em] font-semibold" : "";
          const displayLine = isHeading ? line.replace(/^#{1,3}\s*/, "") : line;
          return (
            <div key={i} className={cn("leading-relaxed whitespace-pre-wrap", sizeClass)} dangerouslySetInnerHTML={{ __html: displayLine || "&nbsp;" }} />
          );
        })}
      </div>
    ) : (
      <p className="text-muted-foreground italic text-[12px]">Nothing to preview yet.</p>
    );
  };

  // Editor block (always mounted, sometimes hidden)
  const editorBlock = (
    <div className={cn("rounded-xl bg-popover overflow-hidden", isOverlayPreview && "hidden")}>
      <PromptSearchBar
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        textRef={promptTextRef}
        textValRef={promptTextValRef}
        onTextChange={() => { setHighlightTick((t) => t + 1); scheduleAutoSave(); autoResize(promptTextRef.current); }}
      />
      <div>
        <div className="relative">
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-[1] px-2.5 py-2 whitespace-pre-wrap break-words text-transparent"
            style={{ fontSize: `${editorFontSize}px` }}
          >
            {renderBackdrop}
          </div>
          <textarea
            ref={promptTextRef}
            className={cn(
              "w-full px-2.5 py-2 outline-none resize-none bg-transparent border-0",
              "min-h-[200px] overflow-hidden relative",
              errors.promptText ? "ring-2 ring-red-400/40" : "",
            )}
            style={{ fontSize: `${editorFontSize}px` }}
            defaultValue={promptTextValRef.current}
            onChange={(e) => { promptTextValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }}
            onInput={() => setHighlightTick((t) => t + 1)}
            placeholder={t("form.mainPromptPlaceholder")}
          />
          <PromptVariableAutocomplete
            textRef={promptTextRef}
            textValRef={promptTextValRef}
            onInsert={() => { setHighlightTick((t) => t + 1); scheduleAutoSave(); }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {isSplit ? (
        /* Split mode: single outer scroll, grid row for equal-height columns */
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          {/* Sticky section headers */}
          {(activeHeaders.h1 || activeHeaders.h2 || activeHeaders.h3) && (
            <div className="sticky top-0 z-10 bg-white dark:bg-popover border-b border-border/20 rounded-t-xl">
              {activeHeaders.h1 && (
                <div className="px-3 py-0.5 text-[11px] font-semibold text-foreground/70 truncate">{activeHeaders.h1}</div>
              )}
              {activeHeaders.h2 && (
                <div className="px-3 py-0.5 text-[11px] text-foreground/55 truncate pl-5">{activeHeaders.h2}</div>
              )}
              {activeHeaders.h3 && (
                <div className="px-3 py-0.5 text-[11px] text-foreground/40 truncate pl-8">{activeHeaders.h3}</div>
              )}
            </div>
          )}

          {/* Two-column grid: editor + preview, both stretch to the taller one */}
          <div className="grid grid-cols-2">
            {/* Left: editor */}
            <div className="px-[3px] pb-[3px]">
              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5 h-full">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">
                    {t("form.promptContent")}
                    {sampleLead && (
                      <span className="ml-3 text-[12px] font-normal normal-case tracking-normal text-foreground/40">
                        Preview: {sampleLead.firstName}{sampleLead.lastName ? ` ${sampleLead.lastName}` : ""}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums">~{tokenEstimate} tokens</span>
                    <PromptSnippets textRef={promptTextRef} textValRef={promptTextValRef} onInsert={() => { setHighlightTick((t) => t + 1); scheduleAutoSave(); autoResize(promptTextRef.current); }} />
                  </div>
                </div>
                {editorBlock}
                {errors.promptText && (
                  <p className="text-[10px] text-red-500 mt-0.5">{errors.promptText}</p>
                )}
              </div>
            </div>

            {/* Right: preview */}
            <div className="border-l border-border/30 bg-popover">
              <div className="sticky top-0 z-10 flex items-center px-5 py-2 bg-popover/95 backdrop-blur-sm border-b border-border/20">
                <p className="text-[11px] uppercase tracking-widest text-foreground/40 font-heading font-semibold">
                  {t("form.preview", "Preview")}
                  {sampleLead && (
                    <span className="ml-2 normal-case tracking-normal font-normal text-foreground/30">
                      {sampleLead.firstName}{sampleLead.lastName ? ` ${sampleLead.lastName}` : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="px-5 py-4">
                {renderPreview()}
              </div>
            </div>
          </div>

          {/* System Message + Notes below the split, full width */}
          <div className="flex flex-col gap-[3px] px-[3px] pb-[3px] mt-[3px]">
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.systemMessage")}
              </p>
              <div>
                <textarea
                  ref={systemMessageTextareaRef}
                  className={cn(textareaCls, "min-h-[60px] overflow-hidden")}
                  defaultValue={systemMessageValRef.current}
                  onChange={(e) => { systemMessageValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }}
                  placeholder={t("form.systemMessagePlaceholderAlt")}
                />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
              <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                {t("form.notes")}
              </p>
              <div>
                <textarea
                  ref={notesTextareaRef}
                  className={cn(textareaCls, "min-h-[60px] overflow-hidden")}
                  defaultValue={notesValRef.current}
                  onChange={(e) => { notesValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }}
                  placeholder={t("form.notesPlaceholderAlt")}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Non-split: single scrollable column (original layout) */
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[3px] pb-[3px] [scrollbar-width:thin]">
          {/* Sticky section headers */}
          {(activeHeaders.h1 || activeHeaders.h2 || activeHeaders.h3) && (
            <div className="sticky top-0 z-10 bg-white dark:bg-popover border-b border-border/20 rounded-t-xl">
              {activeHeaders.h1 && (
                <div className="px-3 py-0.5 text-[11px] font-semibold text-foreground/70 truncate">{activeHeaders.h1}</div>
              )}
              {activeHeaders.h2 && (
                <div className="px-3 py-0.5 text-[11px] text-foreground/55 truncate pl-5">{activeHeaders.h2}</div>
              )}
              {activeHeaders.h3 && (
                <div className="px-3 py-0.5 text-[11px] text-foreground/40 truncate pl-8">{activeHeaders.h3}</div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-[3px] w-full">
            <div className="flex flex-col gap-[3px]">
              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">
                    {t("form.promptContent")}
                    {previewOpen && sampleLead && (
                      <span className="ml-3 text-[12px] font-normal normal-case tracking-normal text-foreground/40">
                        Preview: {sampleLead.firstName}{sampleLead.lastName ? ` ${sampleLead.lastName}` : ""}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums">~{tokenEstimate} tokens</span>
                    <PromptSnippets textRef={promptTextRef} textValRef={promptTextValRef} onInsert={() => { setHighlightTick((t) => t + 1); scheduleAutoSave(); autoResize(promptTextRef.current); }} />
                  </div>
                </div>
                {isOverlayPreview && (
                  <div className="rounded-xl bg-popover border border-border/30 overflow-hidden">
                    <div className="px-3 py-2">
                      {renderPreview()}
                    </div>
                  </div>
                )}
                {editorBlock}
                {errors.promptText && (
                  <p className="text-[10px] text-red-500 mt-0.5">{errors.promptText}</p>
                )}
              </div>

              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
                <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                  {t("form.systemMessage")}
                </p>
                <div>
                  <textarea
                    ref={systemMessageTextareaRef}
                    className={cn(textareaCls, "min-h-[60px] overflow-hidden")}
                    defaultValue={systemMessageValRef.current}
                    onChange={(e) => { systemMessageValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }}
                    placeholder={t("form.systemMessagePlaceholderAlt")}
                  />
                </div>
              </div>

              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5">
                <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
                  {t("form.notes")}
                </p>
                <div>
                  <textarea
                    ref={notesTextareaRef}
                    className={cn(textareaCls, "min-h-[60px] overflow-hidden")}
                    defaultValue={notesValRef.current}
                    onChange={(e) => { notesValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }}
                    placeholder={t("form.notesPlaceholderAlt")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
