import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FieldLabel, helpStyle } from "./voiceAtoms";
import { wiringError, type VoiceLine, type VoiceLinePatch } from "./voiceApi";

/** The office sound under her voice on the phone. Saves on flip; the engine then rewires the number. */
export function OfficeSoundSwitch({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);

  const flip = async (on: boolean) => {
    setError(null);
    if (!(await onSave({ officeSound: on }))) setError(t("common.saveFailed"));
  };
  const wiring = wiringError(line);

  return (
    <div style={{ marginTop: 18 }}>
      <FieldLabel>{t("number.officeSound.label")}</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Switch checked={line.officeSound} onCheckedChange={flip} disabled={!canEdit || saving}
          aria-label={t("number.officeSound.label")} />
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {t(line.officeSound ? "number.officeSound.on" : "number.officeSound.off")}
        </span>
        {saving && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      </div>
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("number.officeSound.help")}</p>
      {(error || wiring) && (
        <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>
          {error ?? t("transfer.wiringFailed", { error: wiring })}
        </p>
      )}
    </div>
  );
}
