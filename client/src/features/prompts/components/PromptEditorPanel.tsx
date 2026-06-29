import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { hapticSave } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { resolveVariablesHtml, buildMap, DEFAULT_NICHE_TERMS, type CampaignForPreview, type ResolveOpts } from "../utils/resolveVariables";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KNOWN_VARIABLE_SET } from "./PromptVariableAutocomplete";
import { PromptCodeEditor, type PromptCodeEditorHandle } from "./PromptCodeEditor";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, ChevronsUpDown, SlidersHorizontal } from "lucide-react";
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
  save: () => void;
};

/* ── Component ─────────────────────────────────────────────────────────── */

export const PromptEditorPanel = forwardRef(function PromptEditorPanel({
  prompt,
  onSaved,
  onDelete: _onDelete,
  campaigns = [],
  versionOverride = null,
  previewOpen,
  setPreviewOpen: _setPreviewOpen,
  showSidebar: showSidebarProp = false,
  showSystemMessage = true,
  showNotes = true,
  editorFontSize,
  previewFont = "var(--mono)",
  accentColor = "var(--wine)",
  accentHex: _accentHex = "#722F37",
  onTokenEstimate,
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  campaigns?: CampaignForPreview[];
  versionOverride?: PromptVersion | null;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  showSidebar?: boolean;
  showSystemMessage?: boolean;
  showNotes?: boolean;
  editorFontSize: number;
  previewFont?: string;
  accentColor?: string;
  accentHex?: string;
  onTokenEstimate?: (n: number) => void;
}, ref: React.Ref<PromptEditorPanelHandle>) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("prompts");
  const [saving, setSaving] = useState(false);

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
    model: "gpt-5.5",
    temperature: "0.7",
    maxTokens: "1000",
    status: "active",
    useCase: "",
    notes: "",
    campaignsId: "",
  });
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});
  const [highlightTick, setHighlightTick] = useState(0);
  const [sampleLead, setSampleLead] = useState<import("../utils/resolveVariables").LeadForPreview | null>(null);
  // Per-niche substitution terms for the selected campaign (fetched from the vocabulary API).
  const [nicheTerms, setNicheTerms] = useState<Record<string, string>>({});
  // Preview-only branch choices for {{#if}} blocks — default to the most-used options.
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, string>>({
    lead_stage: "inquired", positioning: "mid_market", ai_disclosure: "off",
  });
  // Niche override for preview: "__campaign__" means use the campaign's actual niche.
  const [previewNiche, setPreviewNiche] = useState<string>("__campaign__");
  const [availableNiches, setAvailableNiches] = useState<string[]>([]);
  const [foldedSections, setFoldedSections] = useState<Set<number>>(new Set());
  // Active heading tracking for the Sections panel (emitted by the CodeMirror editor).
  const [activeH1, setActiveH1] = useState(-1);
  const [activeH2, setActiveH2] = useState(-1);

  const promptTextValRef = useRef<string>("");
  const systemMessageValRef = useRef<string>("");
  const notesValRef = useRef<string>("");
  const codeEditorRef = useRef<PromptCodeEditorHandle>(null);
  const systemMessageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewPaneScrollRef = useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const isSyncingScrollRef = useRef(false);
  const highlightDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const promptId = getPromptId(prompt);
  const initialized = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const container = scrollContainerRef.current;
    const savedScroll = container?.scrollTop;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 60) + "px";
    if (container && savedScroll !== undefined) container.scrollTop = savedScroll;
  }, []);

  useEffect(() => {
    const promptText = prompt.promptText || prompt.prompt_text || "";
    const systemMessage = prompt.systemMessage || prompt.system_message || "";
    const notes = (prompt.notes || "").replace(/^System prompt\s*[-–—]?\s*auto[- ]created.*$/im, "").trim();
    promptTextValRef.current = promptText;
    systemMessageValRef.current = systemMessage;
    notesValRef.current = notes;
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = systemMessage;
    if (notesTextareaRef.current) notesTextareaRef.current.value = notes;
    // The CodeMirror editor reloads its document from initialValue on re-render.
    const linkedCampaignId =
      prompt.campaignsId != null ? String(prompt.campaignsId)
      : prompt.Campaigns_id != null ? String(prompt.Campaigns_id) : "";
    const linkedCampaign = campaigns.find((c) => String(c.id) === linkedCampaignId);
    const effectiveModel = (linkedCampaign?.aiModel as string | undefined) || prompt.model || "gpt-5.5";
    setForm({
      name: prompt.name || "",
      promptText,
      systemMessage,
      model: effectiveModel,
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: (prompt.status || "active").toLowerCase(),
      useCase: prompt.useCase || prompt.use_case || "",
      notes,
      campaignsId: linkedCampaignId,
    });
    setErrors({});
    setFoldedSections(new Set());
    setHighlightTick((n) => n + 1);
    initialized.current = false;
    const timer = setTimeout(() => { initialized.current = true; }, 150);
    return () => clearTimeout(timer);
  }, [promptId]);

  useEffect(() => {
    const newStatus = (prompt.status || "active").toLowerCase();
    setForm((prev) => prev.status === newStatus ? prev : { ...prev, status: newStatus });
  }, [prompt.status]);

  useEffect(() => {
    if (!versionOverride) return;
    const pt = versionOverride.promptText || "";
    const sm = versionOverride.systemMessage || "";
    const nt = versionOverride.notes || "";
    promptTextValRef.current = pt;
    systemMessageValRef.current = sm;
    notesValRef.current = nt;
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = sm;
    if (notesTextareaRef.current) notesTextareaRef.current.value = nt;
    setHighlightTick((n) => n + 1);
    scheduleAutoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionOverride]);

  useEffect(() => {
    if (!initialized.current) return;
    scheduleAutoSave();
    return () => clearTimeout(autoSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.model, form.temperature, form.maxTokens, form.status, form.useCase, form.campaignsId]);

  useEffect(() => {
    autoResize(systemMessageTextareaRef.current);
    autoResize(notesTextareaRef.current);
  }, [autoResize]);

  // Token estimate
  const tokenEstimate = useMemo(() => {
    const promptLen = (promptTextValRef.current ?? "").length;
    const sysLen = (systemMessageValRef.current ?? "").length;
    return Math.ceil((promptLen + sysLen) / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  useEffect(() => { onTokenEstimate?.(tokenEstimate); }, [tokenEstimate, onTokenEstimate]);

  // Used variables
  const usedVars = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const matches = text.match(/\{(\w+)\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // The niche that the linked campaign actually uses at runtime.
  const campaignNiche = useMemo(() => {
    const sc = campaigns.find((c) => String(c.id) === form.campaignsId);
    return (sc?.niche || "").trim();
  }, [form.campaignsId, campaigns]);

  // Reset preview niche override when the linked campaign changes.
  useEffect(() => { setPreviewNiche("__campaign__"); }, [form.campaignsId]);

  // Fetch the list of available niches (agency-only) once when preview opens.
  useEffect(() => {
    if (!previewOpen) return;
    apiFetch("/api/niche-vocabulary")
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => setAvailableNiches(rows.map((r: any) => r.niche).filter(Boolean)))
      .catch(() => setAvailableNiches([]));
  }, [previewOpen]);

  const resolveOpts = useMemo<ResolveOpts>(
    () => ({ overrides: previewOverrides, nicheTerms }),
    [previewOverrides, nicheTerms],
  );

  const varMap = useMemo(() => {
    const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
    return buildMap(selectedCampaign, sampleLead, null, i18n.language, resolveOpts);
  }, [form.campaignsId, campaigns, sampleLead, i18n.language, resolveOpts]);

  // Headings for the outline strip
  const headings = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const lines = text.split("\n");
    const result: { level: number; text: string; lineIndex: number }[] = [];
    lines.forEach((line, i) => {
      const m = line.match(/^(#{1,3})\s+(.+)/);
      if (m) result.push({ level: m[1].length, text: m[2], lineIndex: i });
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Fetch sample lead when preview opens
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

  // Fetch the selected campaign's niche terms so {project_term} etc. resolve in the preview,
  // mirroring what the Python engine substitutes at runtime. Canonical = first word in each group.
  // Seed with language-appropriate defaults first so raw tokens never appear when no vocab row exists.
  useEffect(() => {
    if (!previewOpen) { setNicheTerms({}); return; }
    const vlang = (i18n.language || "en").toLowerCase().startsWith("nl") ? "nl" : "en";
    const defaults = DEFAULT_NICHE_TERMS[vlang];
    const niche = (previewNiche !== "__campaign__" ? previewNiche : campaignNiche) || "__default__";
    apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}?lang=${vlang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((groups: any) => {
        if (!groups) { setNicheTerms(defaults); return; }
        const pick = (a?: string[]) => (Array.isArray(a) && a.length ? a[0] : "");
        const list = (a?: string[]) => (Array.isArray(a) ? a.join(", ") : "");
        setNicheTerms({
          ...defaults,
          project_term: pick(groups.projectTerm) || defaults.project_term,
          project_term_list: list(groups.projectTerm) || defaults.project_term_list,
          proposal_term: pick(groups.proposalTerm) || defaults.proposal_term,
          proposal_term_list: list(groups.proposalTerm) || defaults.proposal_term_list,
          decision_term: pick(groups.decisionTerm) || defaults.decision_term,
          decision_term_list: list(groups.decisionTerm) || defaults.decision_term_list,
          advisor_term: pick(groups.advisorTerm) || defaults.advisor_term,
          advisor_term_list: list(groups.advisorTerm) || defaults.advisor_term_list,
          visit_term: pick(groups.visitTerm) || defaults.visit_term,
          visit_term_list: list(groups.visitTerm) || defaults.visit_term_list,
        });
      })
      .catch(() => setNicheTerms(defaults));
  }, [previewOpen, previewNiche, campaignNiche, i18n.language]);

  function scheduleAutoSave() {
    if (!initialized.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => handleSaveRef.current(true), 800);
  }

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // The CodeMirror editor reports edits through this; mirrors the old textarea input.
  function onEditorChange(value: string) {
    promptTextValRef.current = value;
    clearTimeout(highlightDebounceRef.current);
    highlightDebounceRef.current = setTimeout(() => setHighlightTick((n) => n + 1), 150);
    scheduleAutoSave();
  }

  function toggleFold(lineIndex: number) {
    setFoldedSections((prev) => {
      const next = new Set(prev);
      if (next.has(lineIndex)) next.delete(lineIndex);
      else next.add(lineIndex);
      return next;
    });
  }

  function foldAll() {
    setFoldedSections(new Set(headings.map((h) => h.lineIndex)));
  }

  function unfoldAll() {
    setFoldedSections(new Set());
  }

  useImperativeHandle(ref, () => ({
    setField,
    getForm: () => form,
    getTokenEstimate: () => tokenEstimate,
    save: () => { handleSaveRef.current(); },
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
        promptText: (promptTextValRef.current ?? "").trim(),
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
      if (form.campaignsId && form.model) {
        apiFetch(`/api/campaigns/${parseInt(form.campaignsId, 10)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_model: form.model }),
        }).catch(() => {});
      }
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

  handleSaveRef.current = handleSave;

  function scrollToLine(lineIndex: number) {
    codeEditorRef.current?.scrollToLine(lineIndex);
  }

  function handleScrollSync() {
    if (isSyncingScrollRef.current) return;
    const container = codeEditorRef.current?.getScrollDOM();
    const preview = previewPaneScrollRef.current;
    if (!container || !preview) return;
    const maxSrc = container.scrollHeight - container.clientHeight;
    if (maxSrc <= 0) return;
    const pct = container.scrollTop / maxSrc;
    const maxDst = preview.scrollHeight - preview.clientHeight;
    isSyncingScrollRef.current = true;
    preview.scrollTop = pct * maxDst;
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }


  function insertAtCaret(token: string) {
    // CodeMirror inserts at the caret and fires onEditorChange (ref + highlight + autosave).
    codeEditorRef.current?.insertAtCaret(token);
  }

  void saving;

  const EDITOR_PX = 20;

  const renderPreview = () => {
    const text = promptTextValRef.current ?? "";
    void highlightTick;
    const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
    const rawLines = text.split("\n");

    if (!text.trim()) return (
      <p className="text-muted-foreground italic text-[12px]">Nothing to preview yet.</p>
    );

    // Group RAW lines into foldable sections first, then resolve variables per
    // section. Resolving the whole text up front breaks line alignment because
    // multi-line {{#if}} conditionals collapse into fewer lines, shifting every
    // heading below them.
    type RawSection = {
      headingLineIndex: number | null;
      headingRawLine: string | null;
      headingLevel: number;
      bodyRawLines: string[];
    };

    const rawSections: RawSection[] = [];
    let currentRaw: RawSection = { headingLineIndex: null, headingRawLine: null, headingLevel: 0, bodyRawLines: [] };

    rawLines.forEach((rawLine, i) => {
      const m = rawLine.match(/^(#{1,3})\s+/);
      if (m) {
        rawSections.push(currentRaw);
        currentRaw = {
          headingLineIndex: i,
          headingRawLine: rawLine,
          headingLevel: m[1].length,
          bodyRawLines: [],
        };
      } else {
        currentRaw.bodyRawLines.push(rawLine);
      }
    });
    rawSections.push(currentRaw);

    type Section = {
      headingLineIndex: number | null;
      headingHtmlLine: string | null;
      headingLevel: number;
      bodyLines: { htmlLine: string; lineIndex: number }[];
    };

    const sections: Section[] = rawSections.map((s) => ({
      headingLineIndex: s.headingLineIndex,
      headingHtmlLine: s.headingRawLine !== null
        ? resolveVariablesHtml(s.headingRawLine, selectedCampaign, sampleLead, null, i18n.language, resolveOpts)
        : null,
      headingLevel: s.headingLevel,
      bodyLines: s.bodyRawLines.length > 0
        ? resolveVariablesHtml(s.bodyRawLines.join("\n"), selectedCampaign, sampleLead, null, i18n.language, resolveOpts)
            .split("\n")
            .map((htmlLine, j) => ({ htmlLine, lineIndex: j }))
        : [],
    }));

    // Determine which section indices have a "real" heading (for top border logic)
    const headingIndices = new Set(sections.map((s, si) => s.headingLineIndex !== null ? si : -1).filter((n) => n >= 0));

    // Pre-compute which sections are hidden by a folded ancestor
    const hiddenByParent = new Set<number>();
    const activeAncestors: Record<number, number> = {}; // level -> lineIndex of last ancestor heading
    sections.forEach((section, si) => {
      if (section.headingLineIndex === null) return;
      const level = section.headingLevel;
      for (let parentLevel = 1; parentLevel < level; parentLevel++) {
        if (activeAncestors[parentLevel] !== undefined && foldedSections.has(activeAncestors[parentLevel])) {
          hiddenByParent.add(si);
          break;
        }
      }
      activeAncestors[level] = section.headingLineIndex;
      for (let l = level + 1; l <= 3; l++) delete activeAncestors[l];
    });

    return (
      <div
        className="text-foreground break-words"
        style={{ fontSize: `${editorFontSize}px`, fontFamily: previewFont, lineHeight: 1.7 }}
      >
        {sections.map((section, si) => {
          if (section.headingLineIndex === null && section.bodyLines.length === 0) return null;
          if (hiddenByParent.has(si)) return null;
          const isFolded = section.headingLineIndex !== null && foldedSections.has(section.headingLineIndex);
          const h1 = section.headingLevel === 1;
          const h2 = section.headingLevel === 2;
          const h3 = section.headingLevel === 3;
          const hasHeading = h1 || h2 || h3;
          const sizeClass = h1 ? "text-[1.3em] font-bold" : h2 ? "text-[1.15em] font-bold" : h3 ? "text-[1.05em] font-semibold" : "";
          const prevHasHeading = [...headingIndices].some((idx) => idx < si);
          const showTopBorder = hasHeading && (h1 || h2) && prevHasHeading;

          return (
            <div key={si}>
              {hasHeading && section.headingHtmlLine !== null && (
                <div
                  className="flex items-start gap-1"
                  style={showTopBorder ? { borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 14 } : {}}
                >
                  <button
                    onClick={() => toggleFold(section.headingLineIndex!)}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: "2px 1px 0", flexShrink: 0, color: "var(--mute-2)",
                      display: "flex", alignItems: "center",
                    }}
                  >
                    {isFolded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <div
                    className={cn("leading-relaxed whitespace-pre-wrap flex-1 min-w-0", sizeClass)}
                    dangerouslySetInnerHTML={{ __html: section.headingHtmlLine.replace(/^#{1,3}\s*/, "") || "&nbsp;" }}
                  />
                </div>
              )}
              {!isFolded && section.bodyLines.map(({ htmlLine, lineIndex }) => (
                <div
                  key={lineIndex}
                  className="leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: htmlLine || "&nbsp;" }}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const usedVarSet = useMemo(() => new Set(usedVars), [usedVars]);
  const allKnownVars = useMemo(() => Array.from(KNOWN_VARIABLE_SET), []);
  const showSidebar = showSidebarProp;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Body: unified raised panel with sidebar + editor + optional preview ───────────── */}
      <div className="flex-1 min-h-0 flex" style={{ padding: 0 }}>
        <div style={{
          flex: 1, minHeight: 0, overflow: "hidden",
          background: "var(--paper)",
          boxShadow: "var(--sh-raised-crisp)",
          borderRadius: 10,
          display: "flex",
        }}>
          {/* Sidebar — left column inside the panel */}
          {showSidebar && (
            <div style={{
              width: 148, flexShrink: 0,
              overflowY: "auto", padding: "12px 0",
              scrollbarWidth: "thin",
            }}>
              {headings.length > 0 && (
                <>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
                    textTransform: "uppercase", color: "var(--ink)", padding: "0 12px 5px",
                    display: "block", fontWeight: 700,
                  }}>
                    SECTIONS
                  </span>
                  {headings.map((h, i) => {
                    // Only the topmost-visible `#` and the topmost-visible `##` within it light up.
                    const isActive = (h.level === 1 && h.lineIndex === activeH1) || (h.level === 2 && h.lineIndex === activeH2);
                    return (
                    <button
                      key={i}
                      onClick={() => scrollToLine(h.lineIndex)}
                      style={{
                        fontFamily: "var(--mono)", border: "none", background: "transparent",
                        cursor: "pointer", textAlign: "left",
                        padding: h.level === 1 ? "3px 12px" : h.level === 2 ? "3px 12px 3px 20px" : "3px 12px 3px 28px",
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "var(--ink)" : "var(--mute-2)",
                        opacity: isActive ? 1 : 0.55,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        display: "block", width: "100%",
                      }}
                      title={h.text}
                    >
                      {h.text}
                    </button>
                    );
                  })}
                </>
              )}

              {headings.length > 0 && (
                <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
              )}

              <TooltipProvider delayDuration={0}>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "var(--ink)", padding: "0 12px 5px",
                  display: "block", fontWeight: 700,
                }}>
                  VARIABLES
                </span>
                {allKnownVars.map((v) => {
                  const varValue = varMap[v.toLowerCase()] || varMap[v];
                  const inUse = usedVarSet.has(v);
                  const tooltipText = varValue ? String(varValue) : "Link a campaign to preview";
                  return (
                    <Tooltip key={v}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => insertAtCaret(`{${v}}`)}
                          style={{
                            fontFamily: "var(--mono)", fontSize: 10,
                            color: inUse ? accentColor : "var(--mute-2)",
                            cursor: "pointer", border: "none",
                            background: inUse ? "rgba(114,47,55,0.10)" : "transparent",
                            textAlign: "left", overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", width: "100%", display: "block",
                            padding: "3px 12px",
                            borderRadius: 3,
                          }}
                        >
                          {`{${v}}`}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs max-w-[220px]">
                        {tooltipText}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          )}

          {/* Editor + preview — right section inside the unified panel */}
          <div style={{
            flex: 1, minHeight: 0, overflow: "hidden",
            display: "flex", gap: 12, padding: 12,
          }}>
            {/* Editor panel */}
            <div style={{
              flex: 1, minHeight: 0,
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
            <div
              className="flex-1 min-h-0 overflow-hidden"
              style={{
                background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: 8,
              }}
            >
              {/* CodeMirror editor — variable highlights, live heading styling, wrap-aware scroll */}
              <PromptCodeEditor
                ref={codeEditorRef}
                initialValue={promptTextValRef.current}
                fontSize={editorFontSize}
                accentColor={accentColor}
                onChange={onEditorChange}
                onScroll={handleScrollSync}
                onActiveHeadingsChange={(h1, h2) => { setActiveH1(h1); setActiveH2(h2); }}
              />
            </div>
            <div className="flex-shrink-0 overflow-y-auto [scrollbar-width:thin]" style={{ maxHeight: "42%" }}>
              {errors.promptText && <p className="text-[10px] text-red-500 pb-2" style={{ paddingLeft: EDITOR_PX }}>{errors.promptText}</p>}

              {/* System message + notes */}
              {(showSystemMessage || showNotes) && (
                <div className="flex flex-col gap-4" style={{ padding: "14px 0 18px" }}>
                  {showSystemMessage && (
                    <div>
                      <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: "0 0 8px 0", paddingLeft: EDITOR_PX }}>{t("form.systemMessage")}</p>
                      <textarea ref={systemMessageTextareaRef} className="w-full px-2.5 py-2 text-[12px] outline-none resize-y min-h-[60px] overflow-hidden" style={{ background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: 4 }} defaultValue={systemMessageValRef.current} onChange={(e) => { systemMessageValRef.current = e.target.value; autoResize(e.target); setHighlightTick((tk) => tk + 1); scheduleAutoSave(); }} placeholder={t("form.systemMessagePlaceholderAlt")} />
                    </div>
                  )}
                  {showNotes && (
                    <div>
                      <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: "0 0 8px 0", paddingLeft: EDITOR_PX }}>{t("form.notes")}</p>
                      <textarea ref={notesTextareaRef} className="w-full px-2.5 py-2 text-[12px] outline-none resize-y min-h-[60px] overflow-hidden" style={{ background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: 4 }} defaultValue={notesValRef.current} onChange={(e) => { notesValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }} placeholder={t("form.notesPlaceholderAlt")} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          {previewOpen && (
            <div style={{
              flex: 1, minHeight: 0, overflow: "hidden",
              display: "flex", flexDirection: "column",
              background: "transparent",
              borderRadius: 8,
              position: "relative",
            }}>
              {/* Conditional-branch override: pick which {{#if}} branch the preview resolves to. */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="neu-inset-super-crisp"
                    title={t("preview.conditionsTitle", { defaultValue: "Preview conditions" })}
                    style={{
                      position: "absolute", top: 7, right: headings.length > 0 ? 32 : 8, zIndex: 2,
                      border: "none", cursor: "pointer",
                      color: "var(--mute-2)", padding: 4,
                      display: "flex", alignItems: "center",
                    }}
                  >
                    <SlidersHorizontal size={12} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-3">
                  <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: "0 0 8px 0" }}>
                    {t("preview.conditionsTitle", { defaultValue: "Preview conditions" })}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {([
                      { key: "lead_stage", label: t("preview.cond.leadStage", { defaultValue: "Lead stage" }), opts: [
                        ["inquired", t("preview.cond.stage.inquired", { defaultValue: "Inquired" })],
                        ["visited", t("preview.cond.stage.visited", { defaultValue: "Had a site visit" })],
                        ["deciding", t("preview.cond.stage.deciding", { defaultValue: "Deciding" })],
                        ["declined", t("preview.cond.stage.declined", { defaultValue: "Declined" })],
                        ["quoted", t("preview.cond.stage.quoted", { defaultValue: "Received a quote (baseline)" })],
                      ] },
                      { key: "positioning", label: t("preview.cond.positioning", { defaultValue: "Positioning" }), opts: [
                        ["mid_market", t("preview.cond.pos.midMarket", { defaultValue: "Mid-market" })],
                        ["premium", t("preview.cond.pos.premium", { defaultValue: "Premium" })],
                      ] },
                      { key: "ai_disclosure", label: t("preview.cond.aiDisclosure", { defaultValue: "AI disclosure" }), opts: [
                        ["off", t("preview.cond.off", { defaultValue: "Off" })],
                        ["on", t("preview.cond.on", { defaultValue: "On" })],
                      ] },
                    ] as const).map(({ key, label, opts }) => (
                      <label key={key} className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                        <select
                          className="neu-inset-super-crisp px-2 py-1 text-xs"
                          value={previewOverrides[key] ?? ""}
                          onChange={(e) => setPreviewOverrides((p) => ({ ...p, [key]: e.target.value }))}
                        >
                          {opts.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                        </select>
                      </label>
                    ))}
                    {/* Niche override — campaign's actual niche shown in wine so it's clear which is real */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {t("preview.cond.niche", { defaultValue: "Niche" })}
                      </span>
                      <select
                        className="neu-inset-super-crisp px-2 py-1 text-xs"
                        style={{ color: previewNiche === "__campaign__" ? "var(--wine)" : undefined }}
                        value={previewNiche}
                        onChange={(e) => setPreviewNiche(e.target.value)}
                      >
                        <option value="__campaign__">
                          {campaignNiche
                            ? `${campaignNiche} (actual)`
                            : t("preview.cond.nicheDefault", { defaultValue: "Default (actual)" })}
                        </option>
                        {availableNiches
                          .filter((n) => n !== campaignNiche)
                          .map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
              {headings.length > 0 && (
                <button
                  onClick={() => foldedSections.size > 0 ? unfoldAll() : foldAll()}
                  title={foldedSections.size > 0 ? "Unfold all sections" : "Fold all sections"}
                  style={{
                    position: "absolute", top: 7, right: 8, zIndex: 2,
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--mute-2)", padding: 3, borderRadius: 3,
                    display: "flex", alignItems: "center",
                  }}
                >
                  <ChevronsUpDown size={12} />
                </button>
              )}
              <div
                ref={previewPaneScrollRef}
                className="h-full overflow-y-auto px-5 py-4 [scrollbar-width:thin]"
                style={{ background: "var(--paper)" }}
              >
                {renderPreview()}
              </div>
            </div>
          )}
            </div>{/* end editor+preview section */}
        </div>{/* end unified raised panel */}
      </div>
    </div>
  );
});
