import { useTranslation } from "react-i18next";
import {
  Clock, Bot, Building2, HelpCircle,
  MousePointerClick, MapPin, Award, Megaphone, BookOpen, Paintbrush,
} from "lucide-react";
import {
  EditText, EditSelect, InfoRow,
} from "../formFields";

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
  const { t } = useTranslation("campaigns");

  const editFor = (field: string) =>
    onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField(field) } : {};
  const focusFor = (field: string) => ({ autoFocus: focusField === field });

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
      <InfoRow icon={MousePointerClick} label="Stage of Sales Process" value={campaign.what_lead_did}
        {...editFor("what_lead_did")}
        editChild={isEditing ? <EditSelect value={String(draft.what_lead_did ?? "")} onChange={(v) => setDraft(d => ({...d, what_lead_did: v}))} options={["", "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase", "Declined / went with another provider"]} {...focusFor("what_lead_did")} /> : undefined}
      />
      <InfoRow icon={Paintbrush} label="AI Style" value={campaign.ai_style_override}
        {...editFor("ai_style_override")}
        editChild={isEditing ? <EditSelect value={String(draft.ai_style_override ?? "")} onChange={(v) => setDraft(d => ({...d, ai_style_override: v}))} options={["", "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"]} {...focusFor("ai_style_override")} /> : undefined}
      />
      <InfoRow icon={Clock} label="Inquiry date" value={campaign.inquiry_timeframe}
        {...editFor("inquiry_timeframe")}
        editChild={isEditing ? <EditText value={String(draft.inquiry_timeframe ?? "")} onChange={(v) => setDraft(d => ({...d, inquiry_timeframe: v}))} placeholder="e.g. Last 6 months, 2+ years ago" {...focusFor("inquiry_timeframe")} /> : undefined}
      />
      <InfoRow icon={Megaphone} label={t("config.service")} value={campaign.service_name}
        {...editFor("service_name")}
        editChild={isEditing ? <EditSelect value={String(draft.service_name ?? "")} onChange={(v) => setDraft(d => ({...d, service_name: v}))} options={["", "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"]} {...focusFor("service_name")} /> : undefined}
      />
      <InfoRow icon={HelpCircle} label={t("config.nicheQuestion")} value={campaign.niche_question}
        {...editFor("niche_question")}
        editChild={isEditing ? <EditText value={String(draft.niche_question ?? "")} onChange={(v) => setDraft(d => ({...d, niche_question: v}))} placeholder="e.g. Are you still looking for…?" {...focusFor("niche_question")} /> : undefined}
      />
      <InfoRow icon={Award} label={t("config.usp")} value={campaign.campaign_usp}
        {...editFor("campaign_usp")}
        editChild={isEditing ? <EditSelect value={String(draft.campaign_usp ?? "")} onChange={(v) => setDraft(d => ({...d, campaign_usp: v}))} options={["", "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"]} {...focusFor("campaign_usp")} /> : undefined}
      />
      <InfoRow icon={Building2} label={t("config.businessDescription")} value={campaign.description} richText={true}
        {...editFor("description")}
        editChild={isEditing ? <EditText value={String(draft.description ?? "")} onChange={(v) => setDraft(d => ({...d, description: v}))} multiline minRows={1} placeholder="Business description…" {...focusFor("description")} /> : undefined}
      />
      <InfoRow icon={BookOpen} label={t("config.kb")} value={campaign.kb} richText={true}
        {...editFor("kb")}
        editChild={isEditing ? <EditText value={String(draft.kb ?? "")} onChange={(v) => setDraft(d => ({...d, kb: v}))} multiline minRows={1} placeholder="Key facts, stats, achievements the AI should know about this business…" {...focusFor("kb")} /> : undefined}
      />
    </div>
  );
}
