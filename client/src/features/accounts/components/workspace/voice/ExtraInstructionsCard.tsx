import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";
import { VoiceCardShell, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import { EXTRA_INSTRUCTIONS_MAX, type VoiceLine, type VoiceLinePatch } from "./voiceApi";

export function ExtraInstructionsCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const server = useMemo(() => line.extraInstructions ?? "", [line]);
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const [error, setError] = useState<string | null>(null);
  const over = draft.length > EXTRA_INSTRUCTIONS_MAX;

  const submit = async () => {
    setError(null);
    if (!(await onSave({ extraInstructions: draft }))) setError(t("common.saveFailed"));
  };

  return (
    <VoiceCardShell card="extra" icon={<NotebookPen size={17} />} title={t("extra.title")}>
      <p style={helpStyle}>{t("extra.help")}</p>
      {canEdit ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("extra.placeholder")}
            rows={6}
            className="neu-inset-crisp"
            style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
            aria-label={t("extra.title")}
          />
          <div
            data-testid="voice-extra-counter"
            style={{
              marginTop: 6, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em",
              color: over ? "var(--stage-lost)" : "var(--mute)",
            }}
          >
            {draft.length} / {EXTRA_INSTRUCTIONS_MAX}
          </div>
          <SaveRow dirty={dirty} saving={saving} canSave={!over} error={error} onSave={submit} onReset={() => { setError(null); reset(); }} />
        </>
      ) : (
        <ReadOnlyValue value={draft} />
      )}
    </VoiceCardShell>
  );
}
