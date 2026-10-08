import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PhoneForwarded } from "lucide-react";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import { Chip } from "../communication/wizardAtoms";
import {
  E164, TRANSFER_MODES, TRANSFER_WAITING, normalizePhone,
  type VoiceLine, type VoiceLinePatch,
} from "./voiceApi";

export function TransferCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const server = useMemo(
    () => ({
      mode: line.transferMode ?? "screened",
      number: line.transferNumber ?? "",
      name: line.transferName ?? "",
      waiting: line.transferWaiting ?? "sara",
    }),
    [line],
  );
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const number = normalizePhone(draft.number);
    if (number && !E164.test(number)) { setError(t("transfer.invalid")); return; }
    const ok = await onSave({
      transferMode: draft.mode,
      transferNumber: number || null,
      transferName: draft.name.trim() || null,
      transferWaiting: draft.waiting,
    });
    if (!ok) setError(t("common.saveFailed"));
  };

  return (
    <VoiceCardShell card="transfer" icon={<PhoneForwarded size={17} />} title={t("transfer.title")}>
      <p style={helpStyle}>{t("transfer.help")}</p>
      <div style={{ marginBottom: 16 }}>
        <FieldLabel>{t("transfer.mode.label")}</FieldLabel>
        {canEdit ? (
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {TRANSFER_MODES.map((k) => (
              <Chip key={k} selected={draft.mode === k} onClick={() => setDraft((d) => ({ ...d, mode: k }))} label={t(`transfer.mode.${k}`)} />
            ))}
          </div>
        ) : <ReadOnlyValue value={t(`transfer.mode.${draft.mode}`)} />}
        <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t(`transfer.mode.${draft.mode}Help`)}</p>
      </div>
      {draft.mode !== "off" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div>
            <FieldLabel>{t("transfer.number")}</FieldLabel>
            {canEdit ? (
              <input
                type="tel"
                value={draft.number}
                onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
                placeholder="+31 6 12345678"
                className="neu-inset-crisp"
                style={inputStyle}
                aria-label={t("transfer.number")}
              />
            ) : <ReadOnlyValue value={draft.number} />}
          </div>
          <div>
            <FieldLabel>{t("transfer.name")}</FieldLabel>
            {canEdit ? (
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={t("transfer.namePlaceholder")}
                className="neu-inset-crisp"
                style={inputStyle}
                aria-label={t("transfer.name")}
              />
            ) : <ReadOnlyValue value={draft.name} />}
          </div>
        </div>
      )}
      {draft.mode === "screened" && (
        <div style={{ marginTop: 16 }}>
          <FieldLabel>{t("transfer.waiting.label")}</FieldLabel>
          {canEdit ? (
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {TRANSFER_WAITING.map((k) => (
                <Chip key={k} selected={draft.waiting === k} onClick={() => setDraft((d) => ({ ...d, waiting: k }))} label={t(`transfer.waiting.${k}`)} />
              ))}
            </div>
          ) : <ReadOnlyValue value={t(`transfer.waiting.${draft.waiting}`)} />}
          <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("transfer.waiting.help")}</p>
        </div>
      )}
      {canEdit && <SaveRow dirty={dirty} saving={saving} error={error} onSave={submit} onReset={() => { setError(null); reset(); }} />}
    </VoiceCardShell>
  );
}
