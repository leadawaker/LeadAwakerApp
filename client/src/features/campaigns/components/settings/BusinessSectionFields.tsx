import { useTranslation } from "react-i18next";
import {
  Clock, Bot, Building2,
  MousePointerClick, Award, Megaphone, BookOpen, Paintbrush, MapPin, UserRound,
} from "lucide-react";
import {
  EditText, InfoRow,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS, WHAT_LEAD_DID_OPTIONS, SERVICE_OPTIONS, FIRST_TOUCH_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";

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
}

export function BusinessSectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
  launchName, setLaunchName,
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <InfoRow icon={Building2} label={t("config.companyName")} value={String(draft.company_name ?? campaign.company_name ?? "")}
        {...editFor("company_name")}
        editChild={isEditing ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => setDraft(d => ({...d, company_name: v}))} placeholder="Company name…" {...focusFor("company_name")} /> : undefined}
      />

      {/* Demo lead name — transient, drives the Launch Campaign button. Always
          editable (no save needed): typed live during a discovery screenshare. */}
      {setLaunchName && (
        <InfoRow icon={UserRound} label={t("config.launchName")} value={null}
          description={t("config.launchNameHint")}
          editChild={
            <input
              type="text"
              value={launchName ?? ""}
              onChange={(e) => setLaunchName(e.target.value)}
              placeholder={t("config.launchNamePlaceholder")}
              maxLength={80}
              className="la-input"
              style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            />
          }
        />
      )}

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

      {/* Stage of Sales Process — multilingual dropdown */}
      <InfoRow icon={MousePointerClick} label={t("config.whatLeadDid")}
        value={displayLabel("what_lead_did", campaign.what_lead_did)}
        {...editFor("what_lead_did")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("what_lead_did", draft.what_lead_did ?? campaign.what_lead_did)}
            onChange={(store) => setDraft(d => ({...d, what_lead_did: store}))}
            options={comboOptions("what_lead_did", WHAT_LEAD_DID_OPTIONS)}
            {...focusFor("what_lead_did")}
          />
        ) : undefined}
      />

      {/* AI Style — multilingual dropdown */}
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

      <InfoRow icon={Clock} label={t("config.inquiryDate")} value={displayText(campaign.inquiry_timeframe)}
        {...editFor("inquiry_timeframe")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.inquiry_timeframe ?? campaign.inquiry_timeframe)}
            onChange={(v) => onTextChange("inquiry_timeframe", draft.inquiry_timeframe ?? campaign.inquiry_timeframe, v)}
            placeholder="e.g. Last 6 months, 2+ years ago"
            {...focusFor("inquiry_timeframe")}
          />
        ) : undefined}
      />

      {/* First Touch — how the lead first contacted the business */}
      <InfoRow icon={MapPin} label={t("config.firstTouch")}
        value={displayLabel("first_touch", campaign.first_touch)}
        {...editFor("first_touch")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("first_touch", draft.first_touch ?? campaign.first_touch)}
            onChange={(store) => setDraft(d => ({...d, first_touch: store}))}
            options={comboOptions("first_touch", FIRST_TOUCH_OPTIONS)}
            {...focusFor("first_touch")}
          />
        ) : undefined}
      />

      {/* Service — multilingual dropdown */}
      <InfoRow icon={Megaphone} label={t("config.service")}
        value={displayLabel("service_name", campaign.service_name)}
        {...editFor("service_name")}
        editChild={isEditing ? (
          <LocalizedCombo
            displayValue={displayLabel("service_name", draft.service_name ?? campaign.service_name)}
            onChange={(store) => setDraft(d => ({...d, service_name: store}))}
            options={comboOptions("service_name", SERVICE_OPTIONS)}
            {...focusFor("service_name")}
          />
        ) : undefined}
      />

      {/* USP — multilingual dropdown */}
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

      <InfoRow icon={Building2} label={t("config.businessDescription")}
        value={displayText(draft.description ?? campaign.description)} richText={true} noBorder
        {...editFor("description")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.description ?? campaign.description)}
            onChange={(v) => onTextChange("description", draft.description ?? campaign.description, v)}
            multiline minRows={4}
            placeholder={placeholderFor("business_description", uiLang)}
            {...focusFor("description")}
          />
        ) : undefined}
      />

      {/* Knowledge base — full width, alone at the bottom. */}
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
    </div>
  );
}
