import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone, Loader2, Unlink } from "lucide-react";
import { VoiceCardShell, FieldLabel, helpStyle, inputStyle } from "./voiceAtoms";
import { useUnassignedNumbers } from "./useVoiceLine";
import { E164, normalizePhone, type NumberStatus, type VoiceLine, type VoiceLinePatch } from "./voiceApi";

const STATUS_TONE: Record<NumberStatus, { bg: string; fg: string }> = {
  not_set: { bg: "var(--surface)", fg: "var(--mute)" },
  pending: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  live: { bg: "var(--good-tint)", fg: "var(--good)" },
};

export function NumberStatusChip({ status }: { status: NumberStatus }) {
  const { t } = useTranslation("voiceTab");
  const tone = STATUS_TONE[status];
  return (
    <span data-testid="voice-number-status" style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--r-pill)",
      background: tone.bg, color: tone.fg, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em",
      textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.fg }} />
      {t(`number.status.${status}`)}
    </span>
  );
}

export function NumberCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const { data: free = [], isLoading } = useUnassignedNumbers(canEdit);
  const [pickedId, setPickedId] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const status: NumberStatus = line.number?.status ?? "not_set";

  const attach = async () => {
    setError(null);
    let patch: VoiceLinePatch;
    if (typed.trim()) {
      const phone = normalizePhone(typed);
      if (!E164.test(phone)) { setError(t("number.invalid")); return; }
      patch = { phoneNumber: phone };
    } else if (pickedId) {
      patch = { numberId: Number(pickedId) };
    } else return;
    if (await onSave(patch)) { setPickedId(""); setTyped(""); }
    else setError(t("common.saveFailed"));
  };

  const detach = async () => {
    setError(null);
    if (!(await onSave({ numberId: null }))) setError(t("common.saveFailed"));
  };

  return (
    <VoiceCardShell card="number" icon={<Phone size={17} />} title={t("number.title")} action={<NumberStatusChip status={status} />}>
      <p style={helpStyle}>{t("number.help")}</p>
      <div style={{ marginBottom: canEdit ? 18 : 0 }}>
        <FieldLabel>{t("number.current")}</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--ink)" }} data-testid="voice-number-value">
            {line.number?.phoneNumber ?? "—"}
          </span>
          {canEdit && line.number && (
            <button type="button" className="la-btn la-btn--soft" onClick={detach} disabled={saving}>
              <Unlink size={12} />{t("number.detach")}
            </button>
          )}
        </div>
      </div>

      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>{t("number.pickLabel")}</FieldLabel>
            <select
              value={pickedId}
              onChange={(e) => { setPickedId(e.target.value); setTyped(""); }}
              className="neu-inset-crisp"
              style={inputStyle}
              disabled={isLoading || free.length === 0}
              aria-label={t("number.pickLabel")}
            >
              <option value="">{free.length === 0 && !isLoading ? t("number.noneFree") : t("number.pickPlaceholder")}</option>
              {free.map((n) => (
                <option key={n.id} value={n.id}>{n.phoneNumber}{n.label ? ` · ${n.label}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>{t("number.typeLabel")}</FieldLabel>
            <input
              type="tel"
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setPickedId(""); }}
              placeholder="+31 85 123 4567"
              className="neu-inset-crisp"
              style={inputStyle}
              aria-label={t("number.typeLabel")}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--wine" onClick={attach} disabled={saving || (!pickedId && !typed.trim())}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
              {t("number.attach")}
            </button>
            {error && <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</span>}
          </div>
        </div>
      )}
    </VoiceCardShell>
  );
}
