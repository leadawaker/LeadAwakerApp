// The two agency-only cards of Settings: caption style and voice guide. The server rejects a
// non-agency write to these anyway; SocialSettingsSection simply never renders them for a client.
// Both carry "Upgrade with AI": an inline panel that proposes new versions into the editor; the
// card's own Save stores whatever version is shown.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { saveSocialSettings, type SocialSettingsView } from "../../api/studioApi";
import { SettingsTextCard } from "./SettingsTextCard";
import { useSettingsField } from "./useSettingsField";
import { UpgradePanel } from "./upgrade/UpgradePanel";
import { VersionBar } from "./upgrade/VersionBar";
import { useUpgradeVersions } from "./upgrade/useUpgradeVersions";
import type { UpgradeField } from "./upgrade/upgradeState";

interface CardProps { accountId: number; data: SocialSettingsView; minHeight?: number }

interface UpgradeableProps extends CardProps {
  field: UpgradeField;
  id: string;
  serverValue: string;
  saveFn: (text: string) => Promise<SocialSettingsView>;
  title: string;
  help: string;
  max: number;
  testIds: { card: string; text: string; save: string };
}

function UpgradeableTextCard(p: UpgradeableProps) {
  const { t } = useTranslation("social");
  const f = useSettingsField(p.accountId, p.serverValue, p.saveFn);
  const versions = useUpgradeVersions(p.accountId, p.field, p.serverValue, f.setText);
  const [open, setOpen] = useState(false);
  const action = (
    <button type="button" className="la-btn la-btn--soft" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid={`${p.testIds.card}-upgrade`}>
      {open ? <X size={12} /> : <Sparkles size={12} />}{open ? t("upgrade.close") : t("upgrade.open")}
    </button>
  );
  const before = (
    <>
      {open && <UpgradePanel accountId={p.accountId} field={p.field} currentText={f.text} onResult={versions.add} />}
      <VersionBar state={versions.state} onSelect={versions.select} dirty={f.dirty} />
    </>
  );
  return (
    <SettingsTextCard id={p.id} title={p.title} help={p.help} text={f.text} onChange={f.setText} max={p.max} dirty={f.dirty} save={f.save}
      saveLabel={t("settings.save")} savedLabel={t("settings.saved")} mono minHeight={p.minHeight} headerAction={action} beforeEditor={before} testIds={p.testIds} />
  );
}

export function CaptionStyleCard({ accountId, data, minHeight }: CardProps) {
  const { t } = useTranslation("social");
  return (
    <UpgradeableTextCard accountId={accountId} data={data} minHeight={minHeight} field="caption_style" id="caption-style" serverValue={data.captionStyle ?? ""}
      saveFn={(captionStyle) => saveSocialSettings(accountId, { captionStyle })} title={t("settings.captionStyle")} help={t("settings.captionStyleHelp")}
      max={TEXT_LIMITS.captionStyle} testIds={{ card: "settings-caption-style-card", text: "settings-caption-style", save: "settings-caption-style-save" }} />
  );
}

export function VoiceGuideCard({ accountId, data, minHeight }: CardProps) {
  const { t } = useTranslation("social");
  return (
    <UpgradeableTextCard accountId={accountId} data={data} minHeight={minHeight} field="voice_guide" id="voice-guide" serverValue={data.voiceGuide ?? ""}
      saveFn={(voiceGuide) => saveSocialSettings(accountId, { voiceGuide })} title={t("settings.voiceGuide")} help={t("settings.voiceGuideHelp")}
      max={TEXT_LIMITS.voiceGuide} testIds={{ card: "settings-voice-guide-card", text: "settings-voice-guide", save: "settings-voice-guide-save" }} />
  );
}
