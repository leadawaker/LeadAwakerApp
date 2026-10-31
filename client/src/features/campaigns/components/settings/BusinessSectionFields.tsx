import { useTranslation } from "react-i18next";
import {
  Bot, Building2,
  Award, Megaphone, BookOpen, Paintbrush, UserRound,
  GitBranch,
} from "lucide-react";
import {
  EditText, InfoRow,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";
import { OpenerField } from "./OpenerField";
import { AiDisclosureField } from "./AiDisclosureField";
import { ObjectionPlaybookField } from "./ObjectionPlaybookField";
import { DEMO_MODES, type DemoMode } from "../../demoMode";

// The four built-in assistant personas (same set as the onboarding wizard). The
// operator picks one or types a custom name — it's a pick-or-type combobox.
const AGENT_NAME_OPTIONS = ["Thomas", "Mark", "Sophie", "Lisa"].map((n) => ({ label: n, store: n }));

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

      {/* AI disclosure — moved here from the Behavior tab. It sits directly
          above the opener because that is what it rewrites: its "what changes"
          reveal shows the exact clause each mode splices into the first
          sentence. Rendered in openerOnly mode too, which is how it reaches the
          universal demo's first tab (that campaign hides Business entirely). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <AiDisclosureField
          campaign={campaign}
          isEditing={isEditing}
          draft={draft}
          setDraft={setDraft}
          focusField={focusField}
          onStartEditField={onStartEditField}
        />
      </div>

      {/* First Message: the opener template, with its live preview (OpenerField). */}
      <div style={{ gridColumn: '1 / -1' }}>
        <OpenerField campaign={campaign} isEditing={isEditing} draft={draft} setDraft={setDraft}
          launchName={launchName} demoMode={demoMode} editProps={editFor("first_message_template")} />
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

      {/* Objection playbook (ObjectionPlaybookField): up to 5 owner-approved
          objection/answer pairs, injected into the AI's system prompt. */}
      {!openerOnly && (
      <div style={{ gridColumn: '1 / -1' }}>
        <ObjectionPlaybookField campaign={campaign} draft={draft} setDraft={setDraft} />
      </div>
      )}
    </div>
    </>
  );
}
