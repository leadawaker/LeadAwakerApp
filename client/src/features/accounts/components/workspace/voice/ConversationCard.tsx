// What she asks a caller before booking an appointment, and what she does
// when someone calls outside opening hours.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { Chip } from "../communication/wizardAtoms";
import { AFTER_HOURS } from "../communication/setupConstants";
import { IntakeEditor } from "../communication/IntakeEditor";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, useDraft } from "./voiceAtoms";
import type { AfterHoursMode, VoiceLine, VoiceLinePatch } from "./voiceApi";

export function ConversationCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation(["voiceTab", "communicationProfile"]);
  const cp = (k: string) => t(`communicationProfile:questions.${k}`);
  const server = useMemo(
    () => ({ intake: line.intake ?? "", afterHours: (line.afterHours ?? "") as AfterHoursMode | "" }),
    [line],
  );
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    setFailed(false);
    if (!(await onSave({ intake: draft.intake, afterHours: draft.afterHours || null }))) setFailed(true);
  };

  return (
    <VoiceCardShell card="conversation" icon={<MessagesSquare size={17} />} title={t("voiceTab:conversation.title")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <FieldLabel>{t("voiceTab:agent.intake")}</FieldLabel>
          {canEdit ? (
            <>
              <p style={helpStyle}>{cp("voiceIntake.help")}</p>
              <IntakeEditor value={draft.intake} onChange={(intake) => setDraft((d) => ({ ...d, intake }))} />
            </>
          ) : <ReadOnlyValue value={draft.intake} />}
        </div>

        <div>
          <FieldLabel>{cp("voiceAfterHours.short")}</FieldLabel>
          {canEdit ? (
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {AFTER_HOURS.map((k) => (
                <Chip key={k} selected={draft.afterHours === k} onClick={() => setDraft((d) => ({ ...d, afterHours: k }))} label={cp(`voiceAfterHours.options.${k}.label`)} />
              ))}
            </div>
          ) : <ReadOnlyValue value={draft.afterHours ? cp(`voiceAfterHours.options.${draft.afterHours}.label`) : ""} />}
          {draft.afterHours && (
            <p style={{ ...helpStyle, margin: "8px 0 0" }}>{cp(`voiceAfterHours.options.${draft.afterHours}.help`)}</p>
          )}
        </div>
      </div>
      {canEdit && <SaveRow dirty={dirty} saving={saving} error={failed ? t("voiceTab:common.saveFailed") : null} onSave={submit} onReset={reset} />}
    </VoiceCardShell>
  );
}
