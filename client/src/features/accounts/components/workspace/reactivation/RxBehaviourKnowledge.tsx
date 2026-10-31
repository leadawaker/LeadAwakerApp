// Reactivation > Behaviour and Knowledge: who writes, how, and what it knows.
// Service and "what they did" keep the Campaigns page's pick-or-type lists
// (fieldLocale), because the prompts read their stored values as {variables}.
import { useTranslation } from "react-i18next";
import { Bot, BookOpen, HelpCircle, Users } from "lucide-react";
import { EditSelect, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { LocalizedCombo } from "@/features/campaigns/components/formFields/LocalizedCombo";
import { ObjectionPlaybookField } from "@/features/campaigns/components/settings/ObjectionPlaybookField";
import { SERVICE_OPTIONS, WHAT_LEAD_DID_OPTIONS, asCampaignLang, optionLabel, optionStore } from "@/features/campaigns/components/settings/fieldLocale";
import { ChatCard, SwitchRow, helpStyle, useLocalized, type ChatEdit } from "../chat/chatAtoms";

const LANGS = ["en", "nl", "pt"];
const VOICE_MODES = ["off", "smart", "voice_reply"];
const REPLY_COUNTS = ["1", "2", "3", "4"];

/** A pick-or-type field whose options come from fieldLocale (stored in a language-neutral form). */
export function useCombo(draft: Record<string, unknown>, setDraft: ChatEdit["setDraft"]) {
  const { i18n } = useTranslation();
  const uiLang = asCampaignLang(i18n.language);
  return (field: string, table: Record<string, string[]>) => (
    <LocalizedCombo
      displayValue={optionLabel(field, draft[field], uiLang)}
      onChange={(store) => setDraft((d) => ({ ...d, [field]: store }))}
      options={(table[uiLang] ?? table.en).map((label) => ({ label, store: optionStore(field, label, uiLang) }))}
    />
  );
}

export function RxBehaviour(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { campaign, draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const langLabels = Object.fromEntries(LANGS.map((l) => [l, t(`behaviour.languages.${l}`)]));
  const voiceLabels = Object.fromEntries(VOICE_MODES.map((m) => [m, t(`behaviour.voiceModes.${m}`)]));
  const lang = String(draft.language || "en");
  const voice = String(draft.voice_reply_mode || "off");
  const replies = String(draft.max_messages_per_reply || 1);

  return (
    <>
      <ChatCard icon={<Bot size={17} />} title={t("behaviour.whoTitle")} testId="rx-card-who">
        <InfoRow
          label={t("behaviour.agentName")} value={String(draft.agent_name || "") || null} description={t("behaviour.agentNameHelp")}
          editChild={canEdit ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => set("agent_name", v)} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.language")} value={langLabels[lang] ?? lang} description={t("behaviour.languageHelp")}
          editChild={canEdit ? <EditSelect value={lang} onChange={(v) => set("language", v)} options={LANGS} labels={langLabels} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.tone")} value={loc.get("ai_style_override") || null} description={t("behaviour.toneHelp")} noBorder
          editChild={canEdit ? <EditText value={loc.get("ai_style_override")} onChange={(v) => loc.set("ai_style_override", v)} multiline minRows={2} placeholder={t("behaviour.tonePlaceholder")} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<Bot size={17} />} title={t("behaviour.howTitle")} testId="rx-card-how">
        <InfoRow
          label={t("behaviour.replies")} value={replies} description={t("behaviour.repliesHelp")}
          editChild={canEdit ? <EditSelect value={replies} onChange={(v) => set("max_messages_per_reply", Number(v))} options={REPLY_COUNTS} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.voice")} value={voiceLabels[voice] ?? voice} description={t("behaviour.voiceHelp")} noBorder
          editChild={canEdit ? <EditSelect value={voice} onChange={(v) => set("voice_reply_mode", v)} options={VOICE_MODES} labels={voiceLabels} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<HelpCircle size={17} />} title={t("behaviour.objectionsTitle")} testId="rx-card-objections">
        <p style={helpStyle}>{t("behaviour.objectionsHelp")}</p>
        <ObjectionPlaybookField campaign={campaign} draft={draft} setDraft={setDraft} disabled={!canEdit} />
      </ChatCard>
    </>
  );
}

export function RxKnowledge(p: ChatEdit) {
  const { t } = useTranslation("reactivationSettings");
  const { i18n } = useTranslation();
  const { draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const combo = useCombo(draft, setDraft);
  const uiLang = asCampaignLang(i18n.language);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));

  return (
    <>
      <ChatCard icon={<BookOpen size={17} />} title={t("knowledge.businessTitle")} testId="rx-card-business">
        <InfoRow
          label={t("knowledge.company")} value={String(draft.company_name || "") || null} description={t("knowledge.companyHelp")}
          editChild={canEdit ? <EditText value={String(draft.company_name ?? "")} onChange={(v) => set("company_name", v)} /> : undefined}
        />
        <InfoRow
          label={t("knowledge.description")} value={loc.get("description") || null} description={t("knowledge.descriptionHelp")}
          editChild={canEdit ? <EditText value={loc.get("description")} onChange={(v) => loc.set("description", v)} multiline minRows={3} /> : undefined}
        />
        <InfoRow
          label={t("knowledge.service")} value={optionLabel("service_name", draft.service_name, uiLang) || null} description={t("knowledge.serviceHelp")}
          editChild={canEdit ? combo("service_name", SERVICE_OPTIONS) : undefined}
        />
        <InfoRow
          label={t("knowledge.kb")} value={loc.get("kb") || null} description={t("knowledge.kbHelp")}
          editChild={canEdit ? <EditText value={loc.get("kb")} onChange={(v) => loc.set("kb", v)} multiline minRows={8} /> : undefined}
        />
        <SwitchRow
          checked={draft.use_account_kb !== false} onChange={(v) => set("use_account_kb", v)} disabled={!canEdit}
          label={t("knowledge.accountKb")} help={t("knowledge.accountKbHelp")}
        />
        <InfoRow
          label={t("knowledge.bookingLink")} value={String(draft.calendar_link_override || "") || null} description={t("knowledge.bookingLinkHelp")} noBorder
          editChild={canEdit ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => set("calendar_link_override", v)} placeholder="https://" /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<Users size={17} />} title={t("knowledge.leadsTitle")} testId="rx-card-leads">
        <InfoRow
          label={t("knowledge.leadContext")} value={loc.get("lead_context") || null} description={t("knowledge.leadContextHelp")}
          editChild={canEdit ? <EditText value={loc.get("lead_context")} onChange={(v) => loc.set("lead_context", v)} multiline minRows={2} /> : undefined}
        />
        <InfoRow
          label={t("knowledge.whatLeadDid")} value={optionLabel("what_lead_did", draft.what_lead_did, uiLang) || null} description={t("knowledge.whatLeadDidHelp")}
          editChild={canEdit ? combo("what_lead_did", WHAT_LEAD_DID_OPTIONS) : undefined}
        />
        <InfoRow
          label={t("knowledge.when")} value={loc.get("inquiry_timeframe") || null} description={t("knowledge.whenHelp")} noBorder
          editChild={canEdit ? <EditText value={loc.get("inquiry_timeframe")} onChange={(v) => loc.set("inquiry_timeframe", v)} /> : undefined}
        />
      </ChatCard>
    </>
  );
}
