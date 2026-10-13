import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldLabel, helpStyle, inputStyle } from "./voiceAtoms";
import { VOICE_REGIONS, type VoiceLine, type VoiceLinePatch, type VoiceRegion } from "./voiceApi";

/** Where the line's calls are handled: the engine places every leg of a call in this region. Saves on change. */
export function RegionSelect({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);

  const change = async (region: VoiceRegion) => {
    setError(null);
    if (!(await onSave({ region }))) setError(t("common.saveFailed"));
  };

  return (
    <div style={{ marginTop: 18 }}>
      <FieldLabel>{t("number.region.label")}</FieldLabel>
      <select
        value={line.region}
        onChange={(e) => change(e.target.value as VoiceRegion)}
        disabled={!canEdit || saving}
        aria-label={t("number.region.label")}
        data-testid="voice-region"
        style={{ ...inputStyle, width: "auto", minWidth: 200 }}
      >
        {VOICE_REGIONS.map((r) => <option key={r} value={r}>{t(`number.region.options.${r}`)}</option>)}
      </select>
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("number.region.help")}</p>
      {error && <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>{error}</p>}
    </div>
  );
}
