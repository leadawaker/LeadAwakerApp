import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot, Building2, MessageSquare,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  HelpCircle, X, Plus, LayoutTemplate, GitBranch,
} from "lucide-react";
import {
  EditText, InfoRow, CopyButton,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { buildMap, resolvePreviewPlainText, DEFAULT_NICHE_TERMS, type CampaignForPreview } from "@/features/prompts/utils/resolveVariables";
import { OpenerTemplatePicker, type OpenerTemplate } from "./OpenerTemplatePicker";
import { DEMO_MODES, type DemoMode } from "../../demoMode";

// The four built-in assistant personas (same set as the onboarding wizard). The
// operator picks one or types a custom name — it's a pick-or-type combobox.
const AGENT_NAME_OPTIONS = ["Thomas", "Mark", "Sophie", "Lisa"].map((n) => ({ label: n, store: n }));

// Distinct example objections per row (price / competitor / stalling) so the
// playbook demonstrates its range instead of repeating the same example 3x.
const OBJECTION_PLACEHOLDER_KEYS = [
  "config.objectionPlaceholder",
  "config.objectionPlaceholder2",
  "config.objectionPlaceholder3",
  "config.objectionPlaceholder4",
  "config.objectionPlaceholder5",
] as const;

interface BusinessSectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  /** Transient "demo lead name" that feeds the Launch Campaign button (not saved). */
  launchName?: string;
  setLaunchName?: (v: string) => void;
  /** Transient conversation type for THIS demo run (not saved — see the note on
   *  the state in CampaignSettingsLayout). Also decides which opener column the
   *  First Message field below edits. Absent on campaigns with one opener. */
  demoMode?: DemoMode;
  setDemoMode?: (v: DemoMode) => void;
  /** Universal demo: render only the opener surface (demo lead name, First
      Message, agent name). The rest of the persona is generated per lead. */
  openerOnly?: boolean;
}

export function BusinessSectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
  launchName, setLaunchName,
  demoMode, setDemoMode,
  openerOnly = false,
}: BusinessSectionFieldsProps) {
  const { t, i18n } = useTranslation("campaigns");

  // UI language drives BOTH dropdown labels AND free-text display/edit.
  // The operator reads & writes the slot for their CRM language; the campaign's
  // `language` field (read by the engine) decides what actually gets sent.
  const uiLang = asCampaignLang(i18n.language);

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

  // Build LocalizedCombo options for a given field and option table
  const comboOptions = (
    field: string,
    table: Record<string, string[]>,
  ) =>
    (table[uiLang] ?? table.en).map((label) => ({
      label,
      store: optionStore(field, label, uiLang),
    }));

  // Resolve a raw field value to its display label in UI language
  const displayLabel = (field: string, raw: unknown) =>
    optionLabel(field, raw, uiLang);

  // Show the slot for the operator's UI language.
  const displayText = (raw: unknown) => resolveLang(raw, uiLang === "pt" ? "en" : uiLang);

  // OnChange for free-text fields: write the UI-language slot, preserving others.
  const onTextChange = (field: string, raw: unknown, text: string) => {
    let current: Record<string, string> = {};
    const s = String(raw ?? "").trim();
    if (s.startsWith("{")) {
      try { current = JSON.parse(s); } catch { /* ok */ }
    } else if (s) {
      current = { en: s, nl: s };
    }
    current[uiLang] = text;
    setDraft(d => ({ ...d, [field]: JSON.stringify(current) }));
  };

  type ObjectionRow = { objection: string; answer: string };
  const MAX_OBJECTIONS = 5;
  const objectionRows = (): ObjectionRow[] => {
    const raw = (draft.objection_playbook ?? campaign.objection_playbook) as ObjectionRow[] | undefined;
    return raw && raw.length > 0 ? raw : [{ objection: "", answer: "" }];
  };
  const updateObjectionRow = (idx: number, patch: Partial<ObjectionRow>) => {
    const rows = [...objectionRows()];
    rows[idx] = { ...rows[idx], ...patch };
    setDraft(d => ({ ...d, objection_playbook: rows }));
  };
  const addObjectionRow = () => {
    const rows = objectionRows();
    if (rows.length >= MAX_OBJECTIONS) return;
    setDraft(d => ({ ...d, objection_playbook: [...rows, { objection: "", answer: "" }] }));
  };
  const removeObjectionRow = (idx: number) => {
    const rows = objectionRows().filter((_, i) => i !== idx);
    setDraft(d => ({ ...d, objection_playbook: rows.length > 0 ? rows : [{ objection: "", answer: "" }] }));
  };

  /* ── First Message preview ──────────────────────────────────────────────
     Live-resolves the opener with all {variable} tokens substituted, using
     the same buildMap() the AI-prompt preview uses (mirrors the engine's
     personalize_message()). Preview is the default view while editing; a
     small Edit toggle switches to the raw template. Recomputes automatically
     as Company Name / Demo Lead Name / the template text change — no manual
     refresh. Local-only — nothing is sent. */
  const session = useSession();
  const [firstMessageFocused, setFirstMessageFocused] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [nicheTerms, setNicheTerms] = useState<Record<string, Record<string, string>>>({});
  const fetchedNicheKeysRef = useRef<Set<string>>(new Set());

  // Entering edit mode always lands on the preview, not mid-edit of the raw template.
  useEffect(() => { if (isEditing) setFirstMessageFocused(false); }, [isEditing]);

  const fetchNicheTerms = async (niche: string, lang: "en" | "nl"): Promise<Record<string, string>> => {
    const defaults = DEFAULT_NICHE_TERMS[lang];
    try {
      const r = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}?lang=${lang}`);
      if (!r.ok) return defaults;
      const groups = await r.json();
      if (!groups) return defaults;
      const pick = (a?: string[]) => (Array.isArray(a) && a.length ? a[0] : "");
      const list = (a?: string[]) => (Array.isArray(a) ? a.join(", ") : "");
      return {
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
      };
    } catch {
      return defaults;
    }
  };

  // Fetches niche terms for a niche+lang pair at most once; result lands in
  // `nicheTerms` state so live-preview reads pick it up on the next render.
  const ensureNicheTerms = (niche: string, lang: "en" | "nl") => {
    const key = `${niche}|${lang}`;
    if (fetchedNicheKeysRef.current.has(key)) return;
    fetchedNicheKeysRef.current.add(key);
    fetchNicheTerms(niche, lang).then((terms) => {
      setNicheTerms((m) => ({ ...m, [key]: terms }));
    });
  };

  const termsFor = (niche: string, lang: "en" | "nl") =>
    nicheTerms[`${niche}|${lang}`] ?? DEFAULT_NICHE_TERMS[lang];

  // Maps the merged {...campaign, ...draft} snake_case/camelCase-mixed shape
  // into CampaignForPreview, mirroring the mapper in PromptsPage.tsx so this
  // preview and the AI-prompt preview never drift on field-name handling.
  const buildCampaignForPreview = (raw: Record<string, unknown>): CampaignForPreview => {
    const get = (camel: string, snake: string) => (raw[camel] ?? raw[snake] ?? null) as string | null;
    return {
      id: Number(raw.id ?? raw.Id ?? 0),
      name: String(raw.name ?? raw.Name ?? ""),
      aiModel: String(raw.aiModel ?? raw.ai_model ?? ""),
      agentName: get("agentName", "agent_name"),
      serviceName: get("serviceName", "service_name"),
      campaignService: get("campaignService", "campaign_service"),
      campaignUsp: get("campaignUsp", "campaign_usp"),
      calendarLink: get("calendarLink", "calendar_link"),
      firstMessage: (raw.firstMessage ?? raw.first_message ?? raw.First_Message ?? null) as string | null,
      whatLeadDid: get("whatLeadDid", "what_lead_did"),
      firstTouch: get("firstTouch", "first_touch"),
      inquiriesSource: get("inquiriesSource", "inquiries_source"),
      inquiryTimeframe: get("inquiryTimeframe", "inquiry_timeframe"),
      niche: (raw.niche ?? null) as string | null,
      nicheQuestion: get("nicheQuestion", "niche_question"),
      bookingMode: (raw.bookingModeOverride ?? raw.booking_mode_override ?? null) as string | null,
      positioning: (raw.positioning ?? null) as string | null,
      aiDisclosure: get("aiDisclosure", "ai_disclosure"),
      language: (raw.language ?? null) as string | null,
      demoClientName: get("demoClientName", "demo_client_name"),
      companyName: get("companyName", "company_name"),
      aiStyleOverride: get("aiStyleOverride", "ai_style_override"),
      description: (raw.description ?? null) as string | null,
      aiRole: get("aiRole", "ai_role"),
      typoCount: (raw.typoCount ?? raw.typo_count ?? null) as number | null,
      kb: (raw.kb ?? null) as string | null,
      accountsId: (raw.accountsId ?? raw.Accounts_id ?? null) as number | null,
    };
  };

  /* ── Which opener is being edited ───────────────────────────────────────
     A campaign that runs both conversation types holds one opener per type: a
     lead who was never quoted has to be asked to confirm they are the right
     person, a lead sitting on a quote already knows exactly who is writing.
     `demoMode` is only passed on such a campaign; everywhere else there is one
     First_Message and this collapses to the previous behaviour. */
  const openerField = demoMode === "scoping" ? "first_message_scoping" : "First_Message";
  const openerValue = openerField === "first_message_scoping"
    ? (draft.first_message_scoping ?? (campaign as any).first_message_scoping)
    : (draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template);

  // Merge unsaved edits over the saved campaign so a First Message the operator
  // is actively typing (or a Company Name change made moments ago) shows live.
  // First_Message is forced to the opener actually being edited so the whole
  // preview chain (buildMap -> previewMap.first_message) resolves the right one
  // without every layer below needing to know a second column exists.
  const previewRaw: Record<string, unknown> = { ...campaign, ...draft, First_Message: openerValue };
  // Send language: what the engine will actually deliver — the whole point of
  // the main preview is to catch language/token bugs before they go out.
  const sendLang: "en" | "nl" = String(previewRaw.language ?? "en").toLowerCase().startsWith("nl") ? "nl" : "en";
  const previewNiche = String(previewRaw.niche ?? "").trim() || "__default__";
  // {first_name}: Demo Lead Name wins if filled, else the logged-in user's
  // first name (Finn or Gabriel, whoever is running the screenshare).
  const sessionFirstName = session.status === "authenticated"
    ? session.user.fullName1?.split(" ")[0]
    : undefined;
  const previewFirstName = launchName?.trim() || sessionFirstName || undefined;
  const campaignForPreview = buildCampaignForPreview(previewRaw);

  useEffect(() => { ensureNicheTerms(previewNiche, sendLang); }, [previewNiche, sendLang]);

  const previewMap = buildMap(campaignForPreview, { firstName: previewFirstName }, null, sendLang, {
    nicheTerms: termsFor(previewNiche, sendLang),
  });
  const previewText = previewMap.first_message ?? "";

  // Template picker shows the CRM's own display language, not the campaign's
  // send language — it's a browse/pick UI, not a send-accuracy check.
  const templateUiLang: "en" | "nl" = uiLang === "nl" ? "nl" : "en";
  useEffect(() => {
    if (templatesOpen) ensureNicheTerms(previewNiche, templateUiLang);
  }, [templatesOpen, previewNiche, templateUiLang]);

  const resolveTemplateBody = (rawBody: string): string =>
    resolvePreviewPlainText(rawBody, campaignForPreview, { firstName: previewFirstName }, null, templateUiLang, {
      nicheTerms: termsFor(previewNiche, templateUiLang),
    });

  const handlePickTemplate = (tpl: OpenerTemplate) => {
    setDraft(d => ({ ...d, [openerField]: JSON.stringify({ en: tpl.body.en, nl: tpl.body.nl }) }));
    setFirstMessageFocused(false); // land back on the live preview showing the applied template
  };

  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      {!openerOnly && (
      <InfoRow icon={Building2} label={t("config.companyName")} value={String(draft.company_name ?? campaign.company_name ?? "")}
        {...editFor("company_name")}
        editChild={isEditing ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => setDraft(d => ({...d, company_name: v}))} placeholder="Company name…" {...focusFor("company_name")} /> : undefined}
      />
      )}

      {/* Demo lead name — transient, drives the Launch Campaign button. Always
          editable (no save needed): typed live during a discovery screenshare. */}
      {setLaunchName && (
        <InfoRow icon={UserRound} label={t("config.launchName")} value={null}
          editChild={
            <input
              type="text"
              value={launchName ?? ""}
              onChange={(e) => setLaunchName(e.target.value)}
              placeholder={t("config.launchNamePlaceholder")}
              maxLength={80}
              className="la-input"
            />
          }
        />
      )}

      {/* Conversation type for THIS run. Transient, like the demo lead name
          above: it rides along in the Launch button's /start payload and the
          engine writes it per lead. It also picks which opener the First
          Message field below edits. */}
      {demoMode && setDemoMode && (
        <InfoRow icon={GitBranch} label={t("config.demoMode")} value={null}
          description={t("config.demoModeHint")}
          editChild={
            <div className="la-seg la-seg--fill">
              {DEMO_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDemoMode(m)}
                  className={`la-seg-btn${m === demoMode ? ' on' : ''}`}
                  style={{ padding: '9px 0', fontSize: 11, letterSpacing: '0.08em' }}
                >
                  {t(`config.demoModeOptions.${m}`)}
                </button>
              ))}
            </div>
          }
        />
      )}

      {/* Lead context — free text, took Service's slot here. Service moved to the
          AI panel: it is a dropdown the prompt renders, not something you write.
          This one is prose the AI reads to know what it already knows about the
          lead, so it belongs next to the company voice fields. A per-lead value
          on Leads.lead_context overrides it row by row. */}
      {!openerOnly && (
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={Megaphone} label={t("config.leadContext")}
          value={displayText(draft.lead_context ?? campaign.lead_context)}
          description={t("config.leadContextHint")}
          {...editFor("lead_context")}
          editChild={isEditing ? (
            <EditText
              value={displayText(draft.lead_context ?? campaign.lead_context)}
              onChange={(v) => onTextChange("lead_context", draft.lead_context ?? campaign.lead_context, v)}
              multiline minRows={2}
              placeholder={t("config.leadContextPlaceholder")}
              {...focusFor("lead_context")}
            />
          ) : undefined}
        />
      </div>
      )}

      {/* USP — multilingual dropdown */}
      {!openerOnly && (
      <InfoRow icon={Award} label={t("config.usp")}
        value={displayLabel("campaign_usp", campaign.campaign_usp)}
        {...editFor("campaign_usp")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("campaign_usp", draft.campaign_usp ?? campaign.campaign_usp)}
            onChange={(store) => setDraft(d => ({...d, campaign_usp: store}))}
            options={comboOptions("campaign_usp", USP_OPTIONS)}
            {...focusFor("campaign_usp")}
          />
        ) : undefined}
      />
      )}

      {/* Knowledge base — full width. */}
      {!openerOnly && (
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={BookOpen} label={t("config.kb")}
          value={displayText(draft.kb ?? campaign.kb)} richText={true} noBorder
          {...editFor("kb")}
          editChild={isEditing ? (
            <EditText
              value={displayText(draft.kb ?? campaign.kb)}
              onChange={(v) => onTextChange("kb", draft.kb ?? campaign.kb, v)}
              multiline minRows={1}
              placeholder={placeholderFor("kb", uiLang)}
              {...focusFor("kb")}
            />
          ) : undefined}
        />
      </div>
      )}

      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). Click the
          preview to edit; blur reverts to preview (draft autosaves as-you-type). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={MessageSquare}
          label={demoMode ? t(`config.firstMessageFor.${demoMode}`) : t("config.firstMessage")}
          value={displayText(openerValue)}
          editChild={isEditing ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="la-btn la-btn--soft la-btn--icon"
                title={t("config.openerTemplatesButton")}
                style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, zIndex: 1 }}
              >
                <LayoutTemplate size={14} />
              </button>
              {firstMessageFocused ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <EditText
                    value={displayText(openerValue)}
                    onChange={(v) => onTextChange(openerField, openerValue, v)}
                    onBlur={() => setFirstMessageFocused(false)}
                    multiline
                    minRows={3}
                    autoFocus
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ alignSelf: 'flex-start' }}>
                    <CopyButton value={displayText(openerValue)} />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setFirstMessageFocused(true)}
                  style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', cursor: 'text',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 40px 10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}
                >
                  {previewText || t("config.previewEmpty")}
                </div>
              )}
            </div>
          ) : undefined}
          {...editFor("first_message_template")}
        />
      </div>

      <InfoRow icon={Bot} label={t("config.agentName")} value={campaign.agent_name}
        {...editFor("agent_name")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={String(draft.agent_name ?? campaign.agent_name ?? "")}
            onChange={(store) => setDraft(d => ({...d, agent_name: store}))}
            options={AGENT_NAME_OPTIONS}
            {...focusFor("agent_name")}
          />
        ) : undefined}
      />

      {/* AI Style — multilingual dropdown. Hidden for the universal demo: the
          persona generator sets ai_style per lead, overriding this field. */}
      {!openerOnly && (
      <InfoRow icon={Paintbrush} label={t("config.aiStyleOverride")}
        value={displayLabel("ai_style_override", campaign.ai_style_override)}
        {...editFor("ai_style_override")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("ai_style_override", draft.ai_style_override ?? campaign.ai_style_override)}
            onChange={(store) => setDraft(d => ({...d, ai_style_override: store}))}
            options={comboOptions("ai_style_override", AI_STYLE_OPTIONS)}
            {...focusFor("ai_style_override")}
          />
        ) : undefined}
      />
      )}

      {/* Objection playbook — up to 5 owner-approved objection/answer pairs,
          injected into the AI's system prompt (Part 3 of the trust-kit spec). */}
      {!openerOnly && (
      <div style={{ gridColumn: '1 / -1' }}>
        <InfoRow icon={HelpCircle} label={t("config.objectionPlaybook")} value={null}
          editChild={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md, 12px)' }}>
              {objectionRows().map((row, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: 'var(--mute-2)' }}>
                    {t("config.objectionLabel", { n: idx + 1 })}
                  </span>
                  <div className="neu-inset-crisp" style={{ borderRadius: 'var(--r-button)', overflow: 'hidden', position: 'relative' }}>
                    <input
                      value={row.objection}
                      onChange={(e) => updateObjectionRow(idx, { objection: e.target.value.slice(0, 500) })}
                      placeholder={t(OBJECTION_PLACEHOLDER_KEYS[idx])}
                      style={{
                        width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                        border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                        borderBottom: '1px solid var(--line)',
                      }}
                    />
                    <textarea
                      value={row.answer}
                      onChange={(e) => updateObjectionRow(idx, { answer: e.target.value.slice(0, 500) })}
                      rows={2}
                      placeholder={t("config.answerPlaceholder")}
                      style={{
                        width: '100%', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit',
                        border: 'none', background: 'transparent', color: 'var(--ink-soft)',
                        resize: 'none', display: 'block',
                      }}
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removeObjectionRow(idx)}
                        className="la-btn la-btn--soft la-btn--icon"
                        title={t("config.objectionRemove")}
                        style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {objectionRows().length < MAX_OBJECTIONS && (
                <button type="button" className="la-btn la-btn--inset" style={{ alignSelf: 'flex-start' }} onClick={addObjectionRow}>
                  <Plus size={13} />{t("config.objectionAdd")}
                </button>
              )}
            </div>
          }
        />
      </div>
      )}
    </div>
    <OpenerTemplatePicker
      open={templatesOpen}
      onOpenChange={setTemplatesOpen}
      uiLang={templateUiLang}
      resolveBody={resolveTemplateBody}
      onPick={handlePickTemplate}
      filterType={demoMode ?? null}
    />
    </>
  );
}
