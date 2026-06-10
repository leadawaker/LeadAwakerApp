import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { hapticSave } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { resolveVariablesHtml, buildMap, type CampaignForPreview } from "../utils/resolveVariables";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PromptSearchBar } from "./PromptSearchBar";
import { PromptVariableAutocomplete, KNOWN_VARIABLE_SET } from "./PromptVariableAutocomplete";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Type } from "lucide-react";
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

/* ── Structured-editor helpers ─────────────────────────────────────────── */

interface ParsedSection { heading: string; body: string; rules: number }
interface ParsedPrompt { title: string; intro: string; sections: ParsedSection[] }

function countRules(body: string): number {
  return (body.match(/^\s*[-*]\s+/gm) || []).length;
}

function splitSections(value: string): ParsedPrompt {
  const lines = value.split("\n");
  let i = 0;
  // Skip leading blank lines
  while (i < lines.length && !lines[i].trim()) i++;
  // Everything before the first `## ` heading is the intro
  const introLines: string[] = [];
  while (i < lines.length && !/^## /.test(lines[i])) {
    introLines.push(lines[i]);
    i++;
  }
  const intro = introLines.join("\n").trim();
  const sections: ParsedSection[] = [];
  while (i < lines.length) {
    const line = lines[i];
    // Section starts with `## `
    if (/^## /.test(line)) {
      const heading = line.replace(/^## /, "").trim();
      i++;
      const bodyLines: string[] = [];
      // Body continues until we hit another `## `
      while (i < lines.length && !/^## /.test(lines[i])) {
        bodyLines.push(lines[i]);
        i++;
      }
      const body = bodyLines.join("\n").trimEnd();
      sections.push({ heading, body, rules: countRules(body) });
    } else {
      // Lines before any ## heading (shouldn't happen but skip)
      i++;
    }
  }
  return { title: "", intro, sections };
}

function joinSections(title: string, intro: string, sections: ParsedSection[]): string {
  const parts: string[] = [];
  if (intro) parts.push(intro);
  for (const s of sections) {
    parts.push(`## ${s.heading}`);
    if (s.body) parts.push(s.body);
  }
  return parts.join("\n\n");
}

/* ── SectionCard (collapsible section editor) ──────────────────────────── */

function SectionCard({ section, open, onToggle, onChangeBody, editorFontSize }: {
  section: ParsedSection;
  open: boolean;
  onToggle: () => void;
  onChangeBody: (b: string) => void;
  editorFontSize: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Sync textarea when section body changes externally (e.g. version load)
  useEffect(() => {
    if (taRef.current && taRef.current.value !== section.body) {
      taRef.current.value = section.body;
    }
  }, [section.body]);

  return (
    <div style={{
      background: "var(--card)", borderRadius: "var(--r-surface)",
      boxShadow: "var(--sh-raised-crisp)", overflow: "hidden",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", border: "none", cursor: "pointer",
          background: "transparent", textAlign: "left",
        }}
      >
        <ChevronDown
          size={15}
          style={{
            color: "var(--mute-2)", flexShrink: 0,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 150ms",
          }}
        />
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", flex: 1, textAlign: "left" }}>
          {section.heading}
        </span>
        {section.rules > 0 && (
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)",
            background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
            borderRadius: "var(--r-pill)", padding: "3px 10px",
          }}>
            {section.rules} {section.rules === 1 ? "rule" : "rules"}
          </span>
        )}
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
          <textarea
            ref={taRef}
            defaultValue={section.body}
            spellCheck={false}
            onChange={(e) => onChangeBody(e.target.value)}
            style={{
              width: "100%",
              height: Math.max(90, section.body.split("\n").length * 24 + 32),
              padding: 16, border: "none", outline: "none", resize: "vertical",
              background: "transparent",
              fontFamily: "var(--mono)", fontSize: editorFontSize, lineHeight: 1.7,
              color: "var(--ink)",
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── StructuredEditor ──────────────────────────────────────────────────── */

function StructuredEditor({ sections, sectionsTitle, sectionsIntro, sectionOpen, setSectionOpen, onSectionBodyChange, editorFontSize }: {
  sections: ParsedSection[];
  sectionsTitle: string;
  sectionsIntro: string;
  sectionOpen: boolean[];
  setSectionOpen: React.Dispatch<React.SetStateAction<boolean[]>>;
  onSectionBodyChange: (i: number, body: string) => void;
  editorFontSize: number;
}) {
  const allOpen = sectionOpen.every(Boolean);
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 24px", background: "var(--bg)" }}>
      {/* Title + intro block */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700,
          }}>
            Prompt Structure
          </span>
          {sections.length > 0 && (
            <button
              onClick={() => setSectionOpen(sections.map(() => !allOpen))}
              style={{
                border: "none", cursor: "pointer", background: "var(--surface)",
                boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-button)",
                padding: "6px 12px", fontFamily: "var(--mono)", fontSize: 9,
                letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)",
              }}
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        {(sectionsTitle || sectionsIntro) && (
          <div style={{
            background: "var(--card)", borderRadius: "var(--r-surface)",
            boxShadow: "var(--sh-raised-crisp)", padding: "13px 16px",
            borderLeft: "3px solid var(--wine)",
          }}>
            {sectionsTitle && (
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, fontWeight: 700 }}>
                {sectionsTitle}
              </div>
            )}
            {sectionsIntro && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--mute)", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {sectionsIntro}
              </div>
            )}
          </div>
        )}
        {!sectionsTitle && !sectionsIntro && sections.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--mute-2)", fontFamily: "var(--mono)", fontSize: 11 }}>
            No sections found. Add ## headings to your prompt to split into sections.
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sections.map((s, i) => (
          <SectionCard
            key={i}
            section={s}
            open={!!sectionOpen[i]}
            onToggle={() => setSectionOpen(o => o.map((v, j) => j === i ? !v : v))}
            onChangeBody={(b) => onSectionBodyChange(i, b)}
            editorFontSize={editorFontSize}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

export const PromptEditorPanel = forwardRef(function PromptEditorPanel({
  prompt,
  onSaved,
  onDelete: _onDelete,
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

  // Uncontrolled refs for the 3 textarea fields
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
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});

  // ── Raw / Structured edit mode ───────────────────────────────────────────
  const [editMode, setEditMode] = useState<"raw" | "structured">("structured");
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [sectionsTitle, setSectionsTitle] = useState("");
  const [sectionsIntro, setSectionsIntro] = useState("");
  const [sectionOpen, setSectionOpen] = useState<boolean[]>([]);
  const [showVariables, setShowVariables] = useState(true);
  const [fontSizePopoverOpen, setFontSizePopoverOpen] = useState(false);

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
    const linkedCampaignId =
      prompt.campaignsId != null
        ? String(prompt.campaignsId)
        : prompt.Campaigns_id != null
        ? String(prompt.Campaigns_id)
        : "";
    // Campaigns.ai_model is the source of truth the AI engine reads, so when a
    // prompt is linked to a campaign show that campaign's model, not the stale
    // value stored on the prompt row.
    const linkedCampaign = campaigns.find((c) => String(c.id) === linkedCampaignId);
    const effectiveModel =
      (linkedCampaign?.aiModel as string | undefined) || prompt.model || "gpt-5.5";
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
    setHighlightTick((n) => n + 1);
    // Reset to structured mode when switching prompts
    setEditMode("structured");
    // Parse sections immediately so structured mode shows content on load
    const parsed = splitSections(promptText);
    setSectionsTitle(parsed.title);
    setSectionsIntro(parsed.intro);
    setSections(parsed.sections);
    setSectionOpen(parsed.sections.map((_, idx) => idx === 0));
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
    if (promptTextRef.current) { promptTextRef.current.value = pt; autoResize(promptTextRef.current); }
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = sm;
    if (notesTextareaRef.current) notesTextareaRef.current.value = nt;
    setHighlightTick((n) => n + 1);
    // Re-parse sections if in structured mode
    if (editMode === "structured") {
      const parsed = splitSections(pt);
      setSectionsTitle(parsed.title);
      setSectionsIntro(parsed.intro);
      setSections(parsed.sections);
      setSectionOpen(parsed.sections.map((_, i) => i === 0));
    }
    scheduleAutoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionOverride]);

  useEffect(() => {
    if (!initialized.current) return;
    scheduleAutoSave();
    return () => clearTimeout(autoSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.model, form.temperature, form.maxTokens, form.status, form.useCase, form.campaignsId]);

  // Switch between Raw and Structured edit modes
  function switchMode(mode: "raw" | "structured") {
    if (mode === "structured" && editMode === "raw") {
      const parsed = splitSections(promptTextValRef.current);
      setSectionsTitle(parsed.title);
      setSectionsIntro(parsed.intro);
      setSections(parsed.sections);
      setSectionOpen(parsed.sections.map((_, i) => i === 0));
      setPreviewOpen(true);
    } else if (mode === "raw" && editMode === "structured") {
      // promptTextValRef.current is already up-to-date via onSectionBodyChange
      if (promptTextRef.current) {
        promptTextRef.current.value = promptTextValRef.current;
        requestAnimationFrame(() => autoResize(promptTextRef.current));
      }
      setHighlightTick((n) => n + 1);
    }
    setEditMode(mode);
  }

  // Update a section's body and sync back to the raw ref
  function onSectionBodyChange(i: number, body: string) {
    const updated = sections.map((s, j) => j === i ? { ...s, body, rules: countRules(body) } : s);
    setSections(updated);
    promptTextValRef.current = joinSections(sectionsTitle, sectionsIntro, updated);
    scheduleAutoSave();
  }

  // Backdrop content
  const backdropLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renderBackdrop = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const lines = text.split("\n");
    backdropLineRefs.current = [];
    const TOKEN_RE = /(\{\{#if\s+\w+\s*(?:==|!=)\s*"[^"]*"\}\}|\{\{\/if\}\}|\{\{else\}\}|\{\w+\})/;
    const IF_OPEN_RE = /^\{\{#if\s+/;
    const IF_CLOSE_RE = /^\{\{\/if\}\}$/;
    const INDIGO = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
    let insideConditional = false;
    return (
      <>
        {lines.map((line, lineIdx) => {
          const parts = line.split(TOKEN_RE);
          return (
            <div key={lineIdx} ref={(el) => { backdropLineRefs.current[lineIdx] = el; }}>
              {parts.filter(p => p).map((part, idx) => {
                if (IF_OPEN_RE.test(part)) { insideConditional = true; return <mark key={idx} className={INDIGO}>{part}</mark>; }
                if (IF_CLOSE_RE.test(part)) { insideConditional = false; return <mark key={idx} className={INDIGO}>{part}</mark>; }
                if (part === "{{else}}") return <mark key={idx} className={INDIGO}>{part}</mark>;
                if (/^\{\w+\}$/.test(part)) {
                  const varName = part.slice(1, -1);
                  const isKnown = KNOWN_VARIABLE_SET.has(varName);
                  return <mark key={idx} className={isKnown ? INDIGO : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}>{part}</mark>;
                }
                if (insideConditional) return <mark key={idx} className={INDIGO}>{part}</mark>;
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

  // Token estimate
  const tokenEstimate = useMemo(() => {
    const promptLen = (promptTextValRef.current ?? "").length;
    const sysLen = (systemMessageValRef.current ?? "").length;
    return Math.ceil((promptLen + sysLen) / 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Used variables for legend strip
  const usedVars = useMemo(() => {
    const text = promptTextValRef.current ?? "";
    const matches = text.match(/\{(\w+)\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick]);

  // Variable resolution map for tooltips
  const varMap = useMemo(() => {
    const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
    return buildMap(selectedCampaign, sampleLead, null);
  }, [form.campaignsId, campaigns, sampleLead]);

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
      // Mirror the model to the linked campaign — Campaigns.ai_model is the
      // source of truth the AI engine actually reads, so keep both in sync.
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

  handleSaveRef.current = handleSave;

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

  useEffect(() => {
    requestAnimationFrame(() => autoResize(promptTextRef.current));
  }, [autoResize, highlightTick, editorFontSize, previewOpen]);

  useEffect(() => {
    autoResize(systemMessageTextareaRef.current);
    autoResize(notesTextareaRef.current);
  }, [autoResize]);

  // Sticky section headers
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) { setActiveHeaders({}); return; }
    const handleScroll = () => {
      const refs = backdropLineRefs.current;
      if (refs.length === 0) return;
      const containerTop = container.getBoundingClientRect().top;
      let topLine = 0;
      for (const h of headings) {
        const el = refs[h.lineIndex];
        if (!el) continue;
        const elTop = el.getBoundingClientRect().top - containerTop;
        if (elTop > 10) break;
        topLine = h.lineIndex;
      }
      let h1: string | undefined; let h2: string | undefined; let h3: string | undefined;
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

  const textareaCls =
    "w-full rounded-xl bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";

  const isSplit = splitPreview && previewOpen;
  const isOverlayPreview = !splitPreview && previewOpen;

  const renderPreview = () => {
    const text = promptTextValRef.current ?? "";
    void highlightTick;
    const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
    const rawLines = text.split("\n");
    const highlighted = resolveVariablesHtml(text, selectedCampaign, sampleLead);
    const previewLines = highlighted.split("\n");
    return text.trim() ? (
      <div className="text-foreground break-words" style={{ fontSize: `${editorFontSize}px` }}>
        {previewLines.map((line, i) => {
          const raw = rawLines[i] ?? "";
          const h3 = /^###\s/.test(raw);
          const h2 = !h3 && /^##\s/.test(raw);
          const h1 = !h3 && !h2 && /^#\s/.test(raw);
          const isHeading = h1 || h2 || h3;
          const sizeClass = h1 ? "text-[1.5em] font-bold" : h2 ? "text-[1.25em] font-bold" : h3 ? "text-[1.1em] font-semibold" : "";
          const displayLine = isHeading ? line.replace(/^#{1,3}\s*/, "") : line;
          return <div key={i} className={cn("leading-relaxed whitespace-pre-wrap", sizeClass)} dangerouslySetInnerHTML={{ __html: displayLine || "&nbsp;" }} />;
        })}
      </div>
    ) : (
      <p className="text-muted-foreground italic text-[12px]">Nothing to preview yet.</p>
    );
  };

  const editorBlock = (
    <div className={cn("bg-popover overflow-hidden", isOverlayPreview && "hidden")}>
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
            className={cn("w-full px-2.5 py-2 outline-none resize-none bg-transparent border-0 min-h-[200px] overflow-hidden relative", errors.promptText ? "ring-2 ring-red-400/40" : "")}
            style={{ fontSize: `${editorFontSize}px`, fontFamily: "var(--mono)", lineHeight: 1.7 }}
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

  // Suppress unused warning (saving is used implicitly via handleSave)
  void saving;
  void editorOffsetRef;

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Sub-header: Raw / Sections toggle ────────────────────────────── */}
      <div style={{
        height: 45, flexShrink: 0, padding: "0 20px 0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--line)", background: "var(--paper)",
      }}>
        <div className="la-seg">
          <button
            className={`la-seg-btn${editMode === "raw" ? " on" : ""}`}
            onClick={() => switchMode("raw")}
          >
            {t("editor.raw")}
          </button>
          <button
            className={`la-seg-btn${editMode === "structured" ? " on" : ""}`}
            onClick={() => switchMode("structured")}
          >
            {t("editor.sections")}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Popover open={fontSizePopoverOpen} onOpenChange={setFontSizePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: "var(--r-button)",
                  border: "1px solid var(--line)", background: "transparent",
                  cursor: "pointer", color: "var(--mute-2)", transition: "all 150ms",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Type size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-[200px] p-3">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", flex: 1 }}>
                    Font size: {editorFontSize}px
                  </label>
                </div>
                <input
                  type="range"
                  min="12"
                  max="16"
                  step="1"
                  value={editorFontSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    if (typeof editorFontSize === "number" && typeof newSize === "number") {
                      // The parent component handles state via the prop
                      // For now, just store it — the parent will have a callback to update
                    }
                  }}
                  style={{
                    width: "100%", cursor: "pointer",
                    accentColor: "var(--wine)",
                  }}
                />
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute)", textAlign: "center" }}>
                  12 — 16 pixels
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>
            ~{tokenEstimate} tokens
          </span>
        </div>
      </div>

      {/* ── Variables panel ──────────────────────────────────────────────── */}
      {usedVars.length > 0 && (
        <TooltipProvider>
          <div style={{
            flexShrink: 0, borderBottom: "1px solid var(--line)",
            background: "var(--bg)",
          }}>
            <button
              onClick={() => setShowVariables(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 24px", border: "none", cursor: "pointer",
                background: "transparent", textAlign: "left",
              }}
            >
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "var(--mute-2)", flex: 1,
              }}>
                {t("editor.variables")}
              </span>
              <ChevronDown size={12} style={{
                color: "var(--mute-2)",
                transform: showVariables ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 150ms",
              }} />
            </button>
            {showVariables && (
              <div style={{ padding: "0 24px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {usedVars.map((v) => {
                  const varValue = varMap[v.toLowerCase()] || varMap[v];
                  const tooltipText = varValue ? String(varValue) : "Link a campaign to preview";
                  return (
                    <Tooltip key={v}>
                      <TooltipTrigger asChild>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "3px 9px", borderRadius: "var(--r-pill)",
                          background: "var(--wine-tint)", boxShadow: "0 0 0 1px var(--wine-glow)",
                          fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wine)",
                          cursor: "help",
                        }}>
                          {`{${v}}`}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        {tooltipText}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* ── Structured editor mode ────────────────────────────────────────── */}
      {editMode === "structured" && (
        <StructuredEditor
          sections={sections}
          sectionsTitle={sectionsTitle}
          sectionsIntro={sectionsIntro}
          sectionOpen={sectionOpen}
          setSectionOpen={setSectionOpen}
          onSectionBodyChange={onSectionBodyChange}
          editorFontSize={editorFontSize}
        />
      )}

      {/* ── Raw editor mode ───────────────────────────────────────────────── */}
      {editMode === "raw" && (isSplit ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] flex flex-col" style={{ borderRight: "1px solid var(--line)" }}>
            {(activeHeaders.h1 || activeHeaders.h2 || activeHeaders.h3) && (
              <div className="sticky top-0 z-10 border-b border-border/20" style={{ height: 30, background: "var(--paper)", paddingLeft: 18, paddingRight: 18, display: "flex", alignItems: "center", flexShrink: 0 }}>
                <div className="flex gap-3 items-center text-[10px] text-muted-foreground">
                  {activeHeaders.h1 && <span className="font-semibold truncate">{activeHeaders.h1}</span>}
                  {activeHeaders.h2 && <span className="truncate">{activeHeaders.h2}</span>}
                  {activeHeaders.h3 && <span className="opacity-50 truncate">{activeHeaders.h3}</span>}
                </div>
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, background: "var(--paper)" }}>
              {editorBlock}
            </div>
            {errors.promptText && <p className="text-[10px] text-red-500 mt-0.5 px-5 pb-2">{errors.promptText}</p>}
          </div>
          <div className="flex flex-col gap-[3px] px-[3px] pb-[3px] mt-[3px]">
            <div style={{ background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-surface)", padding: 16 }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, marginBottom: 12, margin: "0 0 12px 0" }}>{t("form.systemMessage")}</p>
              <textarea ref={systemMessageTextareaRef} className={cn(textareaCls, "min-h-[60px] overflow-hidden")} defaultValue={systemMessageValRef.current} onChange={(e) => { systemMessageValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }} placeholder={t("form.systemMessagePlaceholderAlt")} />
            </div>
            <div style={{ background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-surface)", padding: 16 }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, marginBottom: 12, margin: "0 0 12px 0" }}>{t("form.notes")}</p>
              <textarea ref={notesTextareaRef} className={cn(textareaCls, "min-h-[60px] overflow-hidden")} defaultValue={notesValRef.current} onChange={(e) => { notesValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }} placeholder={t("form.notesPlaceholderAlt")} />
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0">
            <div style={{
              height: 45, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: 18, paddingRight: 18,
              background: "var(--paper)", borderBottom: "1px solid var(--line)", gap: 8,
            }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: 0 }}>
                Preview
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ background: "var(--paper)" }}>{renderPreview()}</div>
          </div>
        </div>
      ) : (
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[3px] pb-[3px] [scrollbar-width:thin]">
          {(activeHeaders.h1 || activeHeaders.h2 || activeHeaders.h3) && (
            <div className="sticky top-0 z-10 border-b border-border/20" style={{ height: 30, background: "var(--paper)", paddingLeft: 18, paddingRight: 18, display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div className="flex gap-3 items-center text-[10px] text-muted-foreground">
                {activeHeaders.h1 && <span className="font-semibold truncate">{activeHeaders.h1}</span>}
                {activeHeaders.h2 && <span className="truncate">{activeHeaders.h2}</span>}
                {activeHeaders.h3 && <span className="opacity-50 truncate">{activeHeaders.h3}</span>}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-[3px]">
            <div style={{ background: "var(--paper)" }}>
              {isOverlayPreview && (
                <div className="rounded-xl bg-popover border border-border/30 overflow-hidden mb-3 mx-5 mt-5">
                  <div className="px-3 py-2">{renderPreview()}</div>
                </div>
              )}
              <div className="px-5 py-5">
                {editorBlock}
              </div>
              {errors.promptText && <p className="text-[10px] text-red-500 mt-0.5 px-5 pb-2">{errors.promptText}</p>}
            </div>
            <div style={{ background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-surface)", padding: 16 }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, marginBottom: 12, margin: "0 0 12px 0" }}>{t("form.systemMessage")}</p>
              <textarea ref={systemMessageTextareaRef} className={cn(textareaCls, "min-h-[60px] overflow-hidden")} defaultValue={systemMessageValRef.current} onChange={(e) => { systemMessageValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }} placeholder={t("form.systemMessagePlaceholderAlt")} />
            </div>
            <div style={{ background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-surface)", padding: 16 }}>
              <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, marginBottom: 12, margin: "0 0 12px 0" }}>{t("form.notes")}</p>
              <textarea ref={notesTextareaRef} className={cn(textareaCls, "min-h-[60px] overflow-hidden")} defaultValue={notesValRef.current} onChange={(e) => { notesValRef.current = e.target.value; autoResize(e.target); scheduleAutoSave(); }} placeholder={t("form.notesPlaceholderAlt")} />
            </div>
          </div>
        </div>
      ))}

    </div>
  );
});
