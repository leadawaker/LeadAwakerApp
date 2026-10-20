// Chat > Behaviour and Chat > Knowledge: the receptionist-relevant campaign
// fields (see specs/account-service-settings, requirement 1). Every change
// lands in the shared campaign draft and saves with its 1.5s autosave.
import { useTranslation } from "react-i18next";
import { Bot, BookOpen, Ban } from "lucide-react";
import { EditSelect, EditText, InfoRow } from "@/features/campaigns/components/formFields";
import { ChatCard, SwitchRow, helpStyle, useLocalized, type ChatEdit } from "./chatAtoms";

const LANGS = ["en", "nl", "pt"];
const VOICE_MODES = ["off", "smart", "voice_reply"];
const REPLY_COUNTS = ["1", "2", "3", "4"];

export function ChatBehaviour(p: ChatEdit) {
  const { t } = useTranslation("chatTab");
  const { draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));
  const langLabels = Object.fromEntries(LANGS.map((l) => [l, t(`behaviour.languages.${l}`)]));
  const voiceLabels = Object.fromEntries(VOICE_MODES.map((m) => [m, t(`behaviour.voiceModes.${m}`)]));
  const lang = String(draft.language || "en");
  const voice = String(draft.voice_reply_mode || "off");
  const replies = String(draft.max_messages_per_reply ?? 1);

  return (
    <>
      <ChatCard icon={<Bot size={17} />} title={t("behaviour.whoTitle")} testId="chat-card-who">
        <InfoRow
          label={t("behaviour.agentName")} value={String(draft.agent_name || "") || null} description={t("behaviour.agentNameHelp")}
          editChild={canEdit ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => set("agent_name", v)} placeholder={t("behaviour.agentNamePlaceholder")} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.language")} value={langLabels[lang] ?? lang} description={t("behaviour.languageHelp")}
          editChild={canEdit ? <EditSelect value={lang} onChange={(v) => set("language", v)} options={LANGS} labels={langLabels} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.tone")} value={loc.get("ai_style_override") || null} description={t("behaviour.toneHelp")}
          editChild={canEdit ? <EditText value={loc.get("ai_style_override")} onChange={(v) => loc.set("ai_style_override", v)} multiline minRows={2} placeholder={t("behaviour.tonePlaceholder")} /> : undefined}
        />
      </ChatCard>

      <ChatCard icon={<Bot size={17} />} title={t("behaviour.howTitle")} testId="chat-card-how">
        <InfoRow
          label={t("behaviour.replies")} value={replies} description={t("behaviour.repliesHelp")}
          editChild={canEdit ? <EditSelect value={replies} onChange={(v) => set("max_messages_per_reply", Number(v))} options={REPLY_COUNTS} /> : undefined}
        />
        <InfoRow
          label={t("behaviour.voice")} value={voiceLabels[voice] ?? voice} description={t("behaviour.voiceHelp")}
          editChild={canEdit ? <EditSelect value={voice} onChange={(v) => set("voice_reply_mode", v)} options={VOICE_MODES} labels={voiceLabels} /> : undefined}
        />
        <SwitchRow
          checked={!!draft.handoff_on_first_request} onChange={(v) => set("handoff_on_first_request", v)} disabled={!canEdit}
          label={t("behaviour.handoff")} help={t("behaviour.handoffHelp")} testId="chat-handoff-switch"
        />
      </ChatCard>

      <ChatCard icon={<Ban size={17} />} title={t("behaviour.stopTitle")} testId="chat-card-stop">
        <p style={{ ...helpStyle, margin: 0 }}>{t("behaviour.stopHelp")}</p>
      </ChatCard>
    </>
  );
}

export function ChatKnowledge(p: ChatEdit) {
  const { t } = useTranslation("chatTab");
  const { draft, setDraft, canEdit } = p;
  const loc = useLocalized(p);
  const set = (field: string, v: unknown) => setDraft((d) => ({ ...d, [field]: v }));

  return (
    <ChatCard icon={<BookOpen size={17} />} title={t("knowledge.title")} testId="chat-card-knowledge">
      <InfoRow
        label={t("knowledge.description")} value={loc.get("description") || null} description={t("knowledge.descriptionHelp")}
        editChild={canEdit ? <EditText value={loc.get("description")} onChange={(v) => loc.set("description", v)} multiline minRows={3} /> : undefined}
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
        label={t("knowledge.bookingLink")} value={String(draft.calendar_link_override || "") || null} description={t("knowledge.bookingLinkHelp")}
        editChild={canEdit ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => set("calendar_link_override", v)} placeholder="https://" /> : undefined}
      />
    </ChatCard>
  );
}
