import { useTranslation } from "react-i18next";
import {
  Clock, Bot, Building2, HelpCircle,
  MousePointerClick, Award, Megaphone, BookOpen, Paintbrush,
} from "lucide-react";
import {
  EditText, InfoRow,
} from "../formFields";
import { LocalizedCombo } from "../formFields/LocalizedCombo";
import {
  asCampaignLang,
  USP_OPTIONS, AI_STYLE_OPTIONS, WHAT_LEAD_DID_OPTIONS, SERVICE_OPTIONS,
  placeholderFor, optionLabel, optionStore,
} from "./fieldLocale";
import { resolveLang } from "@shared/langField";

interface BusinessSectionFieldsProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
}

export function BusinessSectionFields({
  campaign, isEditing, draft, setDraft,
  focusField, onStartEditField,
}: BusinessSectionFieldsProps) {
  const { t, i18n } = useTranslation("campaigns");

  // Campaign language: controls free-text display/edit
  const campaignLang = asCampaignLang(draft.language ?? campaign.language);
  // UI language: controls dropdown labels
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

  // Resolve a free-text field to the campaign-language variant
  const displayText = (raw: unknown) => resolveLang(raw, campaignLang);

  // OnChange for free-text fields: write the campaign-language slot
  const onTextChange = (field: string, raw: unknown, text: string) => {
    // Import setLang inline to avoid circular issues with the shared helper
    let current: Record<string, string> = {};
    const s = String(raw ?? "").trim();
    if (s.startsWith("{")) {
      try { current = JSON.parse(s); } catch { /* ok */ }
    } else if (s) {
      current = { en: s };
    }
    current[campaignLang] = text;
    setDraft(d => ({ ...d, [field]: JSON.stringify(current) }));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <InfoRow icon={Building2} label={t("config.companyName")} value={campaign.company_name}
        {...editFor("company_name")}
        editChild={isEditing ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => setDraft(d => ({...d, company_name: v}))} placeholder="Company name…" {...focusFor("company_name")} /> : undefined}
      />
      <InfoRow icon={Bot} label="Agent Name" value={campaign.agent_name}
        {...editFor("agent_name")}
        editChild={isEditing ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => setDraft(d => ({...d, agent_name: v}))} {...focusFor("agent_name")} /> : undefined}
      />

      {/* Stage of Sales Process — multilingual dropdown */}
      <InfoRow icon={MousePointerClick} label="Stage of Sales Process"
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
      <InfoRow icon={Paintbrush} label="AI Style"
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

      <InfoRow icon={Clock} label="Inquiry date" value={campaign.inquiry_timeframe}
        {...editFor("inquiry_timeframe")}
        editChild={isEditing ? <EditText value={String(draft.inquiry_timeframe ?? "")} onChange={(v) => setDraft(d => ({...d, inquiry_timeframe: v}))} placeholder="e.g. Last 6 months, 2+ years ago" {...focusFor("inquiry_timeframe")} /> : undefined}
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

      <InfoRow icon={HelpCircle} label={t("config.nicheQuestion")}
        value={displayText(campaign.niche_question)}
        {...editFor("niche_question")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.niche_question ?? campaign.niche_question)}
            onChange={(v) => onTextChange("niche_question", draft.niche_question ?? campaign.niche_question, v)}
            placeholder={placeholderFor("niche_question", campaignLang)}
            {...focusFor("niche_question")}
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
        value={displayText(campaign.description)} richText={true}
        {...editFor("description")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.description ?? campaign.description)}
            onChange={(v) => onTextChange("description", draft.description ?? campaign.description, v)}
            multiline minRows={1}
            placeholder={placeholderFor("business_description", campaignLang)}
            {...focusFor("description")}
          />
        ) : undefined}
      />

      <InfoRow icon={BookOpen} label={t("config.kb")}
        value={displayText(campaign.kb)} richText={true}
        {...editFor("kb")}
        editChild={isEditing ? (
          <EditText
            value={displayText(draft.kb ?? campaign.kb)}
            onChange={(v) => onTextChange("kb", draft.kb ?? campaign.kb, v)}
            multiline minRows={1}
            placeholder={placeholderFor("kb", campaignLang)}
            {...focusFor("kb")}
          />
        ) : undefined}
      />
    </div>
  );
}
