// The two agency-only cards of Settings: caption style and voice guide. The server rejects a
// non-agency write to these anyway; SocialSettingsSection simply never renders them for a client.
import { useTranslation } from "react-i18next";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { saveSocialSettings, type SocialSettingsView } from "../../api/studioApi";
import { SettingsTextCard } from "./SettingsTextCard";
import { useSettingsField } from "./useSettingsField";

export function CaptionStyleCard({ accountId, data }: { accountId: number; data: SocialSettingsView }) {
  const { t } = useTranslation("social");
  const f = useSettingsField(accountId, data.captionStyle ?? "", (captionStyle) => saveSocialSettings(accountId, { captionStyle }));
  return (
    <SettingsTextCard id="caption-style" title={t("settings.captionStyle")} help={t("settings.captionStyleHelp")} text={f.text} onChange={f.setText}
      max={TEXT_LIMITS.captionStyle} dirty={f.dirty} save={f.save} saveLabel={t("settings.save")} savedLabel={t("settings.saved")} mono
      testIds={{ card: "settings-caption-style-card", text: "settings-caption-style", save: "settings-caption-style-save" }} />
  );
}

export function VoiceGuideCard({ accountId, data }: { accountId: number; data: SocialSettingsView }) {
  const { t } = useTranslation("social");
  const f = useSettingsField(accountId, data.voiceGuide ?? "", (voiceGuide) => saveSocialSettings(accountId, { voiceGuide }));
  return (
    <SettingsTextCard id="voice-guide" title={t("settings.voiceGuide")} help={t("settings.voiceGuideHelp")} text={f.text} onChange={f.setText}
      max={TEXT_LIMITS.voiceGuide} dirty={f.dirty} save={f.save} saveLabel={t("settings.save")} savedLabel={t("settings.saved")} mono
      testIds={{ card: "settings-voice-guide-card", text: "settings-voice-guide", save: "settings-voice-guide-save" }} />
  );
}
