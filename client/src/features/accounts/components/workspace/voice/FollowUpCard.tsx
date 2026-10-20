// After-call follow-up (engine after_call_followup.py): the switch that sends
// callers a WhatsApp 30 seconds after a call, and the name the one-off SMS
// fallback is sent from when their number is not on WhatsApp.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVoiceT } from "./voiceGender";
import { MessageSquareText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import {
  SMS_SENDER_MAX, cleanSmsSender, validSmsSender,
  type VoiceLine, type VoiceLinePatch,
} from "./voiceApi";

export function FollowUpCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
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

      <MessagePreview accountId={line.accountId} locale={line.locale} />

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

// The exact message, from the engine (after_call_followup.preview via
// /api/accounts/:id/voice/follow-up-preview), so the words and the link shape
// cannot drift from what is sent.
interface FollowUpPreview {
  business: string;
  calendar_url: string | null;
  link: string | null;
  link_kind: "short" | "custom_domain" | "none";
  languages: string[];
  messages: Record<string, { booked: string; followup: string | null }>;
}

type PreviewKind = "followup" | "booked";

function MessagePreview({ accountId, locale }: { accountId: number; locale: string | null }) {
  const { t } = useVoiceT();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["voice-follow-up-preview", accountId],
    queryFn: async (): Promise<FollowUpPreview> => {
      const res = await apiFetch(`/api/accounts/${accountId}/voice/follow-up-preview`);
      if (!res.ok) throw new Error(`preview ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
  const [lang, setLang] = useState<string | null>(null);
  const [kind, setKind] = useState<PreviewKind>("followup");

  if (isLoading) return <p style={{ ...helpStyle, margin: "16px 0 0" }}>{t("followUp.preview.loading")}</p>;
  if (isError || !data) return <p style={{ ...helpStyle, margin: "16px 0 0" }}>{t("followUp.preview.error")}</p>;

  const langs = data.languages;
  const lineLang = (locale ?? "").slice(0, 2).toLowerCase();
  const shown = lang ?? (langs.includes(lineLang) ? lineLang : langs[0]);
  const text = data.messages[shown]?.[kind] ?? null;
  const calendar = (data.calendar_url ?? "").replace(/^https?:\/\//, "");
  const linkNote = data.link_kind === "none"
    ? t("followUp.preview.link.none")
    : t(`followUp.preview.link.${data.link_kind === "custom_domain" ? "custom" : "short"}`, { calendar });

  // The link stands out in the bubble, the way WhatsApp shows it.
  const parts = text && data.link && kind === "followup" ? text.split(data.link) : [text ?? ""];

  return (
    <div style={{ marginTop: 18 }} data-testid="follow-up-preview">
      <FieldLabel>{t("followUp.preview.title")}</FieldLabel>
      <p style={helpStyle}>{t("followUp.preview.help")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div className="la-seg" role="tablist" aria-label={t("followUp.preview.kindLabel")}>
          {(["followup", "booked"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k}
              className={cn("la-seg-btn", kind === k && "on")} onClick={() => setKind(k)}>
              {t(`followUp.preview.kind.${k}`)}
            </button>
          ))}
        </div>
        <div className="la-seg" role="tablist" aria-label={t("followUp.preview.languageLabel")}>
          {langs.map((l) => (
            <button key={l} type="button" role="tab" aria-selected={shown === l}
              className={cn("la-seg-btn", shown === l && "on")} onClick={() => setLang(l)}>
              {t(`followUp.preview.lang.${l}`, { defaultValue: l.toUpperCase() })}
            </button>
          ))}
        </div>
      </div>
      {text ? (
        <div className="neu-inset-crisp" style={{
          padding: "12px 14px", borderRadius: "var(--r-card)", fontSize: 13.5, lineHeight: 1.55,
          color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: 520,
        }}>
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {i < parts.length - 1 && <span style={{ color: "var(--wine)", fontWeight: 600 }}>{data.link}</span>}
            </span>
          ))}
        </div>
      ) : (
        <p role="note" style={{ ...helpStyle, color: "var(--ink-soft)", fontWeight: 600 }}>{t("followUp.preview.link.none")}</p>
      )}
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>
        {kind === "followup" ? linkNote : t("followUp.preview.bookedNote")}
      </p>
      <p style={{ ...helpStyle, margin: "4px 0 0" }}>{t("followUp.preview.otherLanguages")}</p>
    </div>
  );
}
