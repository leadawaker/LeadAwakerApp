// "Sobre mim": a short profile the account holder keeps up to date (bio facts, credentials, services,
// things never to say). It goes into every caption and script prompt as extra context.
// Agency and the account's Managers edit; Viewers read.
import { useTranslation } from "react-i18next";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { saveAboutMe, type SocialSettingsView } from "../../api/studioApi";
import { SettingsTextCard } from "./SettingsTextCard";
import { useSettingsField } from "./useSettingsField";

export function AboutMeCard({ accountId, data, canEdit }: { accountId: number; data: SocialSettingsView; canEdit: boolean }) {
  const { t } = useTranslation("social");
  const f = useSettingsField(accountId, data.aboutMe, (text) => saveAboutMe(accountId, text));
  return (
    <SettingsTextCard id="about-me" title={t("about.title")} help={t(canEdit ? "about.help" : "about.helpReadOnly")} text={f.text} onChange={f.setText}
      max={TEXT_LIMITS.aboutMe} dirty={f.dirty} save={f.save} saveLabel={t("about.save")} savedLabel={t("about.saved")} placeholder={t("about.placeholder")}
      readOnly={!canEdit} emptyLabel={t("about.empty")}
      testIds={{ card: "about-section", text: "about-text", save: "about-save" }} />
  );
}
