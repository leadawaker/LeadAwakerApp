// The prompt editor: form state and autosave, with the code editor, the optional
// system message and the preview around them. Parts live in ./editor/. Also used
// by the campaign detail view, which passes one campaign and no serving list.
import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { hapticSave } from "@/lib/haptics";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { resolveVariablesHtml, resolvePreviewPlainText, splitHtmlPreservingMarks, buildMap, type CampaignForPreview, type ResolveOpts } from "../utils/resolveVariables";
import { detectPromptVariables, readHeadings } from "../utils/promptVariables";
import { defaultContextKey } from "../utils/previewContext";
import { effectivePromptModel } from "../utils/campaignPrompt";
import { getPromptId, promptNote, type PromptFormData, type PromptVersion } from "../types";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PromptCodeEditor, type PromptCodeEditorHandle } from "./PromptCodeEditor";
import { VoicePreviewPane, voicePromptTarget } from "./VoicePreviewPane";
import { PromptPreviewSections, buildPreviewSections } from "./PromptPreviewSections";
import { SectionsRail } from "./editor/SectionsRail";
import { PreviewPane } from "./editor/PreviewPane";
import { usePreviewContext } from "./editor/usePreviewContext";
import { useTokenCounter } from "./editor/useTokenCounter";

const EDITOR_PX = 20;
const NO_IDS: number[] = [];
const NO_NAMES = new Map<number, string>();

export type PromptEditorPanelHandle = {
  setField: (k: string, v: string) => void;
  getForm: () => PromptFormData;
  getTokenEstimate: () => number;
  save: () => void;
};

export const PromptEditorPanel = forwardRef(function PromptEditorPanel({
  prompt,
  onSaved,
  campaigns = [],
  servingCampaignIds = NO_IDS,
  accountNames = NO_NAMES,
  onCampaignUpdated,
  versionOverride = null,
  previewOpen,
  showSidebar = false,
  showSystemMessage = true,
  editorFontSize,
  previewFont = "var(--mono)",
  onTokenEstimate,
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  campaigns?: CampaignForPreview[];
  /** Campaigns that run this prompt: listed first in "Preview as". */
  servingCampaignIds?: number[];
  accountNames?: Map<number, string>;
  /** A campaign row was saved from here (model, a variable's value). */
  onCampaignUpdated?: (row: any) => void;
  versionOverride?: PromptVersion | null;
  previewOpen: boolean;
  showSidebar?: boolean;
  showSystemMessage?: boolean;
  editorFontSize: number;
  previewFont?: string;
  onTokenEstimate?: (n: number) => void;
}, ref: React.Ref<PromptEditorPanelHandle>) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("prompts");
  const promptId = getPromptId(prompt);

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
    name: "", promptText: "", systemMessage: "", model: "", temperature: "0.7", maxTokens: "1000",
    status: "active", useCase: "", notes: "", campaignsId: "",
  });
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});
  const [highlightTick, setHighlightTick] = useState(0);
  const [foldedSections, setFoldedSections] = useState<Set<number>>(new Set());
  const [activeH1, setActiveH1] = useState(-1);
  const [activeH2, setActiveH2] = useState(-1);
  const [variablesOpen, setVariablesOpen] = usePersistedState<boolean>("prompts-variables-open", true, (v) => typeof v === "boolean");

  const promptTextValRef = useRef<string>("");
  const systemMessageValRef = useRef<string>("");
  const codeEditorRef = useRef<PromptCodeEditorHandle>(null);
  const systemMessageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewPaneScrollRef = useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const isSyncingScrollRef = useRef(false);
  const highlightDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);
  // The model already on the linked campaign: an edit to the text never re-sends it.
  const savedModelRef = useRef("");

  /* ── Load the prompt ─────────────────────────────────────────────────── */
  useEffect(() => {
    const promptText = prompt.promptText || prompt.prompt_text || "";
    const systemMessage = prompt.systemMessage || prompt.system_message || "";
    promptTextValRef.current = promptText;
    systemMessageValRef.current = systemMessage;
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = systemMessage;
    const linkedCampaignId =
      prompt.campaignsId != null ? String(prompt.campaignsId)
      : prompt.Campaigns_id != null ? String(prompt.Campaigns_id) : "";
    const model = effectivePromptModel(prompt, campaigns);
    savedModelRef.current = model;
    setForm({
      name: prompt.name || "",
      promptText,
      systemMessage,
      model,
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: (prompt.status || "active").toLowerCase(),
      useCase: prompt.useCase || prompt.use_case || "",
      notes: promptNote(prompt),
      campaignsId: linkedCampaignId,
    });
    setErrors({});
    setFoldedSections(new Set());
    setHighlightTick((n) => n + 1);
    initialized.current = false;
    const timer = setTimeout(() => { initialized.current = true; }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId]);

  useEffect(() => {
    const newStatus = (prompt.status || "active").toLowerCase();
    setForm((prev) => (prev.status === newStatus ? prev : { ...prev, status: newStatus }));
  }, [prompt.status]);

  useEffect(() => {
    if (!versionOverride) return;
    const pt = versionOverride.promptText || "";
    const sm = versionOverride.systemMessage || "";
    promptTextValRef.current = pt;
    systemMessageValRef.current = sm;
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = sm;
    setForm((prev) => ({ ...prev, notes: versionOverride.notes || "" }));
    setHighlightTick((n) => n + 1);
    scheduleAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionOverride]);

  useEffect(() => {
    if (!initialized.current) return;
    scheduleAutoSave();
    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.model, form.temperature, form.maxTokens, form.status, form.useCase, form.campaignsId, form.notes]);

  /* ── Preview context ─────────────────────────────────────────────────── */
  const linkedCampaign = useMemo(
    () => campaigns.find((c) => String(c.id) === form.campaignsId) ?? null,
    [campaigns, form.campaignsId],
  );
  // The user's "Preview as" pick; until then, a campaign that runs this prompt.
  const [pickedContext, setPickedContext] = useState<string | null>(null);
  useEffect(() => { setPickedContext(null); }, [promptId]);
  const contextKey = pickedContext ?? defaultContextKey(servingCampaignIds, Number(form.campaignsId) || 0);

  // Preview-only branch picks, and another niche's words: both start from the context's real values.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [nicheOverride, setNicheOverride] = useState("");
  useEffect(() => { setOverrides({}); setNicheOverride(""); }, [contextKey, promptId]);

  const ctx = usePreviewContext({
    enabled: previewOpen && !voicePromptTarget(form.useCase),
    contextKey,
    campaigns,
    servingIds: servingCampaignIds,
    nicheOverride,
    uiLang: i18n.language,
  });

  // "No campaign" shows the bare template values; with the preview closed the linked campaign still sizes the prompt.
  const previewCampaign = contextKey ? ctx.campaign ?? linkedCampaign : null;
  const baseOpts = useMemo<ResolveOpts>(() => ({ nicheTerms: ctx.nicheTerms, extra: ctx.extra }), [ctx.nicheTerms, ctx.extra]);
  const resolveOpts = useMemo<ResolveOpts>(() => ({ ...baseOpts, overrides }), [baseOpts, overrides]);

  // What each variable really resolves to, before any condition pick.
  const actualValues = useMemo(
    () => buildMap(previewCampaign, ctx.lead, ctx.account, ctx.fieldLang, baseOpts),
    [previewCampaign, ctx.lead, ctx.account, ctx.fieldLang, baseOpts],
  );

  const variables = useMemo(
    () => detectPromptVariables(promptTextValRef.current, systemMessageValRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightTick],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headings = useMemo(() => readHeadings(promptTextValRef.current ?? ""), [highlightTick]);

  // Token estimate: the RESOLVED text (what the preview shows), so pack variables
  // like {niche_question_bank} count instead of being undercounted.
  const countTokens = useTokenCounter(previewOpen);
  const tokenEstimate = useMemo(() => {
    const resolve = (s: string) => resolvePreviewPlainText(s, previewCampaign, ctx.lead, ctx.account, ctx.fieldLang, resolveOpts);
    const combined = `${resolve(promptTextValRef.current ?? "")}\n${resolve(systemMessageValRef.current ?? "")}`;
    return countTokens ? countTokens(combined) : Math.ceil(combined.length / 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTick, previewCampaign, ctx.lead, ctx.account, ctx.fieldLang, resolveOpts, countTokens]);

  useEffect(() => { onTokenEstimate?.(tokenEstimate); }, [tokenEstimate, onTokenEstimate]);

  /* ── Saving ──────────────────────────────────────────────────────────── */
  function scheduleAutoSave() {
    if (!initialized.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => handleSaveRef.current(true), 800);
  }

  function setField(field: string, value: string) {
    setForm((prev) => {
      // A different linked campaign brings its own model: the model has one home.
      if (field === "campaignsId") {
        const next = campaigns.find((c) => String(c.id) === value);
        const model = next?.aiModel || prompt.model || "";
        savedModelRef.current = model;
        return { ...prev, campaignsId: value, model };
      }
      return { ...prev, [field]: value };
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function onEditorChange(value: string) {
    promptTextValRef.current = value;
    clearTimeout(highlightDebounceRef.current);
    highlightDebounceRef.current = setTimeout(() => setHighlightTick((n) => n + 1), 150);
    scheduleAutoSave();
  }

  function onSystemMessageInput(el: HTMLTextAreaElement) {
    systemMessageValRef.current = el.value;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 60) + "px";
    clearTimeout(highlightDebounceRef.current);
    highlightDebounceRef.current = setTimeout(() => setHighlightTick((n) => n + 1), 150);
    scheduleAutoSave();
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
    try {
      const res = await apiFetch(`/api/prompts/${promptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          promptText: (promptTextValRef.current ?? "").trim(),
          systemMessage: systemMessageValRef.current.trim() || null,
          model: form.model || null,
          temperature: form.temperature,
          maxTokens: parseInt(form.maxTokens, 10),
          status: form.status || "active",
          useCase: form.useCase.trim() || null,
          notes: form.notes.trim() || null,
          campaignsId: form.campaignsId ? parseInt(form.campaignsId, 10) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      // Campaigns.ai_model is what the engine runs: only touched when the model really changed.
      if (form.campaignsId && form.model && form.model !== savedModelRef.current) {
        const model = form.model;
        const campaignRes = await apiFetch(`/api/campaigns/${parseInt(form.campaignsId, 10)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiModel: model }),
        });
        if (!campaignRes.ok) throw new Error(`HTTP ${campaignRes.status}`);
        savedModelRef.current = model;
        onCampaignUpdated?.(await campaignRes.json());
      }
      onSaved(saved);
      if (!silent) {
        hapticSave();
        toast({ title: t("toast.saved"), description: t("toast.savedDescription", { name: form.name }) });
      }
    } catch (err: any) {
      toast({ title: t("toast.saveFailed"), description: err.message || t("toast.unknownError"), variant: "destructive" });
    }
  }
  handleSaveRef.current = handleSave;

  /* ── Editor and preview wiring ───────────────────────────────────────── */
  function handleScrollSync() {
    if (isSyncingScrollRef.current) return;
    const container = codeEditorRef.current?.getScrollDOM();
    const preview = previewPaneScrollRef.current;
    if (!container || !preview) return;
    const maxSrc = container.scrollHeight - container.clientHeight;
    if (maxSrc <= 0) return;
    isSyncingScrollRef.current = true;
    preview.scrollTop = (container.scrollTop / maxSrc) * (preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }

  const toggleFold = (lineIndex: number) => setFoldedSections((prev) => {
    const next = new Set(prev);
    if (next.has(lineIndex)) next.delete(lineIndex); else next.add(lineIndex);
    return next;
  });

  const previewText = promptTextValRef.current ?? "";
  const voiceTarget = voicePromptTarget(form.useCase);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 flex">
        <div style={{
          flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex",
          background: "var(--paper)", boxShadow: "var(--sh-raised-crisp)", borderRadius: 10,
        }}>
          {showSidebar && (
            <SectionsRail
              headings={headings}
              activeH1={activeH1}
              activeH2={activeH2}
              onJump={(line) => codeEditorRef.current?.scrollToLine(line)}
            />
          )}

          <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", gap: 12, padding: 12 }}>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div className="flex-1 min-h-0 overflow-hidden" style={{ background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: 8 }}>
                {/* CodeMirror editor: variable highlights, live heading styling, wrap-aware scroll */}
                <PromptCodeEditor
                  ref={codeEditorRef}
                  initialValue={promptTextValRef.current}
                  fontSize={editorFontSize}
                  onChange={onEditorChange}
                  onScroll={handleScrollSync}
                  onActiveHeadingsChange={(h1, h2) => { setActiveH1(h1); setActiveH2(h2); }}
                />
              </div>
              <div className="flex-shrink-0 overflow-y-auto [scrollbar-width:thin]" style={{ maxHeight: "42%" }}>
                {errors.promptText && (
                  <p className="text-[10px] pb-2" style={{ paddingLeft: EDITOR_PX, color: "var(--destructive)" }}>{errors.promptText}</p>
                )}
                {showSystemMessage && (
                  <div style={{ padding: "14px 0 18px" }}>
                    <p style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: "0 0 8px 0", paddingLeft: EDITOR_PX }}>{t("form.systemMessage")}</p>
                    <textarea
                      ref={systemMessageTextareaRef}
                      className="w-full px-2.5 py-2 text-[12px] outline-none resize-y min-h-[60px] overflow-hidden"
                      style={{ background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: 4 }}
                      defaultValue={systemMessageValRef.current}
                      onChange={(e) => onSystemMessageInput(e.target)}
                      placeholder={t("form.systemMessagePlaceholderAlt")}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Voice prompts are rendered by the engine for a chosen Client (VoicePreviewPane). */}
            {previewOpen && voiceTarget && (
              <div style={{ flex: variablesOpen ? 2 : 1, minHeight: 0, minWidth: 0, overflow: "hidden", borderRadius: 8 }}>
                <VoicePreviewPane
                  useCase={form.useCase}
                  text={previewText}
                  font={previewFont}
                  fontSize={editorFontSize}
                  variablesOpen={variablesOpen}
                  onToggleVariables={() => setVariablesOpen((v) => !v)}
                  onInsertVariable={(name) => codeEditorRef.current?.insertAtCaret(`{${name}}`)}
                />
              </div>
            )}
            {previewOpen && !voiceTarget && (
              <PreviewPane
                ref={previewPaneScrollRef}
                contextKey={contextKey}
                onContextChange={setPickedContext}
                ctx={ctx}
                campaigns={campaigns}
                servingIds={servingCampaignIds}
                accountNames={accountNames}
                variableNames={variables.names}
                conditions={variables.conditions}
                actualValues={actualValues}
                overrides={overrides}
                onOverride={(name, value) => setOverrides((prev) => {
                  const next = { ...prev };
                  if (value === null) delete next[name]; else next[name] = value;
                  return next;
                })}
                nicheOverride={nicheOverride}
                onNicheChange={setNicheOverride}
                canFold={headings.length > 0}
                anyFolded={foldedSections.size > 0}
                onToggleFoldAll={() => setFoldedSections(foldedSections.size > 0 ? new Set() : new Set(headings.map((h) => h.lineIndex)))}
                variablesOpen={variablesOpen}
                onToggleVariables={() => setVariablesOpen((v) => !v)}
                onCampaignUpdated={onCampaignUpdated}
                onInsertVariable={(name) => codeEditorRef.current?.insertAtCaret(`{${name}}`)}
              >
                {previewText.trim() ? (
                  <PromptPreviewSections
                    sections={buildPreviewSections(
                      previewText,
                      (raw) => resolveVariablesHtml(raw, previewCampaign, ctx.lead, ctx.account, ctx.fieldLang, resolveOpts),
                      splitHtmlPreservingMarks,
                    )}
                    folded={foldedSections}
                    onToggleFold={toggleFold}
                    fontSize={editorFontSize}
                    font={previewFont}
                  />
                ) : (
                  <p className="text-muted-foreground italic text-[12px]">{t("preview.empty")}</p>
                )}
              </PreviewPane>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
