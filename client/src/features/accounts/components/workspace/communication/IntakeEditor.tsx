// "What the team wants to know before an appointment": one item per line,
// stored as setup.voice.intake (shared/voiceIntake.ts). Used by the onboarding
// wizard's voiceIntake step and the Voice tab's agent card.
import { useTranslation } from "react-i18next";
import { MAX_INTAKE_ITEMS, MAX_INTAKE_LINE, intakeItems } from "@shared/voiceIntake";
import { inputStyle } from "./wizardAtoms";

export function IntakeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation("communicationProfile");
  const items = intakeItems(value);
  const over = items.length > MAX_INTAKE_ITEMS || items.some((l) => l.length > MAX_INTAKE_LINE);
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("questions.voiceIntake.placeholder")}
        rows={5}
        className="neu-inset-crisp"
        style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
      />
      {over && (
        <p style={{ fontSize: 12, color: "var(--warn)", margin: "6px 0 0", lineHeight: 1.5 }}>
          {t("questions.voiceIntake.overLimit", { items: MAX_INTAKE_ITEMS, chars: MAX_INTAKE_LINE })}
        </p>
      )}
    </div>
  );
}
