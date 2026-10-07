import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserRound, Loader2, Sparkles } from "lucide-react";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, helpStyle } from "./voiceAtoms";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";

export function PersonaCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);
  const persona = line.persona;

  const create = async () => {
    setError(null);
    if (!(await onSave({ createPersona: true }))) setError(t("common.saveFailed"));
  };

  return (
    <VoiceCardShell card="persona" icon={<UserRound size={17} />} title={t("persona.title")}>
      <p style={helpStyle}>{t("persona.help")}</p>
      {persona ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="voice-persona">
          <div>
            <FieldLabel>{t("persona.company")}</FieldLabel>
            <ReadOnlyValue value={persona.companyName} />
          </div>
          <div>
            <FieldLabel>{t("persona.description")}</FieldLabel>
            <ReadOnlyValue value={persona.description} />
          </div>
          <div>
            <FieldLabel>{t("persona.usp")}</FieldLabel>
            <ReadOnlyValue value={persona.usp} />
          </div>
          <p style={{ ...helpStyle, margin: 0, fontStyle: "italic" }}>{t("persona.generatedNote")}</p>
        </div>
      ) : (
        <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "22px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("persona.emptyTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--mute)", margin: "6px auto 0", maxWidth: 320, lineHeight: 1.5 }}>
            {t("persona.emptyHelp")}
          </div>
          {canEdit && (
            <button type="button" className="la-btn la-btn--wine" style={{ marginTop: 14 }} onClick={create} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {t("persona.create")}
            </button>
          )}
          {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</div>}
        </div>
      )}
    </VoiceCardShell>
  );
}
