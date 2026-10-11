// After-call follow-up (engine after_call_followup.py): the switch that sends
// callers a WhatsApp 30 seconds after a call, and the name the one-off SMS
// fallback is sent from when their number is not on WhatsApp.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquareText, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import {
  SMS_SENDER_MAX, cleanSmsSender, validSmsSender,
  type VoiceLine, type VoiceLinePatch,
} from "./voiceApi";

export function FollowUpCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const followUp = line.followUp ?? { enabled: false, smsSenderId: null, whatsappConnected: false };
  const server = useMemo(() => ({ sender: followUp.smsSenderId ?? "" }), [followUp.smsSenderId]);
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const [error, setError] = useState<string | null>(null);

  // The switch saves on flip, like the unwanted-call switches.
  const flip = async (on: boolean) => {
    setError(null);
    if (!(await onSave({ followUpEnabled: on }))) setError(t("common.saveFailed"));
  };

  const submit = async () => {
    setError(null);
    const sender = draft.sender.trim();
    if (!validSmsSender(sender)) { setError(t("followUp.sms.invalid")); return; }
    if (!(await onSave({ smsSenderId: sender || null }))) setError(t("common.saveFailed"));
  };

  return (
    <VoiceCardShell card="followUp" icon={<MessageSquareText size={17} />} title={t("followUp.title")}>
      <p style={helpStyle}>{t("followUp.help")}</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Switch checked={followUp.enabled} onCheckedChange={flip} disabled={!canEdit || saving}
          aria-label={t("followUp.switch.label")} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {t("followUp.switch.label")}
            {saving && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
          </div>
          <div style={{ ...helpStyle, margin: "2px 0 0" }}>{t("followUp.switch.help")}</div>
        </div>
      </div>
      {!followUp.whatsappConnected && (
        <p role="note" style={{ ...helpStyle, margin: "12px 0 0", color: "var(--ink-soft)", fontWeight: 600 }}>
          {t("followUp.notConnected")}
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("followUp.sms.label")}</FieldLabel>
        {canEdit ? (
          <input
            value={draft.sender}
            onChange={(e) => setDraft({ sender: cleanSmsSender(e.target.value) })}
            maxLength={SMS_SENDER_MAX}
            placeholder={t("followUp.sms.placeholder")}
            className="neu-inset-crisp"
            style={{ ...inputStyle, maxWidth: 260 }}
            aria-label={t("followUp.sms.label")}
            autoComplete="off"
            spellCheck={false}
          />
        ) : <ReadOnlyValue value={draft.sender} />}
        <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("followUp.sms.help")}</p>
      </div>
      {canEdit && <SaveRow dirty={dirty} saving={saving} error={error} onSave={submit} onReset={() => { setError(null); reset(); }} />}
      {!canEdit && error && <p role="alert" style={{ ...helpStyle, margin: "12px 0 0", color: "var(--stage-lost)" }}>{error}</p>}
    </VoiceCardShell>
  );
}
