import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Phone, TriangleAlert, X } from "lucide-react";
import { useCallBack, type CallBackChannel, type VoiceCaller } from "../api/voiceCallsApi";
import { dialDigits, lastContactAttempt } from "../callers";
import { SOFT_RAISED } from "./bits";

interface Props {
  /** The unmasked caller: the number is dialled, never shown here. */
  caller: VoiceCaller;
  /** Which side the buttons and the "called back" line hug. */
  align?: "start" | "end";
}

/**
 * A human calls the person back by phone or messages them on WhatsApp. The
 * press is logged on the lead (the call or chat itself is not tracked), and the
 * line under the buttons says what was opened, by whom and when. DND and
 * out-of-hours callers get a warning first and need a second click.
 */
export function CallBackButton({ caller, align = "start" }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const callBack = useCallBack();
  const [pending, setPending] = useState<CallBackChannel | null>(null);
  const digits = dialDigits(caller.phone);
  const disabled = !digits;
  const warn = caller.dnd || caller.outOfHours;

  const last = lastContactAttempt(callBack.data ?? caller, t, i18n.language);

  const go = (channel: CallBackChannel) => {
    if (!digits) return;
    setPending(null);
    if (channel === "phone") window.location.href = `tel:${(caller.phone ?? "").replace(/[^\d+]/g, "")}`;
    else window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    if (caller.leadsId != null) callBack.mutate({ leadsId: caller.leadsId, channel });
  };
  const click = (channel: CallBackChannel) => (warn ? setPending(channel) : go(channel));

  const noNumber = disabled ? t("callers.noNumber") : undefined;
  const off: React.CSSProperties = disabled ? { opacity: 0.45, cursor: "not-allowed", transform: "none" } : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "end" ? "flex-end" : "flex-start", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span title={noNumber} style={{ display: "inline-flex" }}>
          <button
            type="button"
            className="la-btn la-btn--wine"
            disabled={disabled}
            onClick={() => click("phone")}
            data-testid="voice-caller-call-back"
            style={{ height: 32, ...off }}
          >
            <Phone className="h-4 w-4 shrink-0" />
            {t("callers.callBack")}
          </button>
        </span>
        <span title={noNumber ?? t("callers.whatsappHint")} style={{ display: "inline-flex" }}>
          <button
            type="button"
            className="la-btn la-btn--soft"
            disabled={disabled}
            onClick={() => click("whatsapp")}
            data-testid="voice-caller-whatsapp"
            style={{ ...SOFT_RAISED, height: 32, ...off }}
          >
            <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "var(--good)" }} />
            {t("callers.whatsapp")}
          </button>
        </span>
      </div>

      {pending && (
        <div
          role="alert"
          data-testid="voice-caller-warning"
          style={{ alignSelf: "stretch", display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px 9px 12px", textAlign: "left", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
        >
          <TriangleAlert size={14} style={{ color: "var(--wine)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, fontSize: 12, lineHeight: 1.45, color: "var(--ink-soft)" }}>
            {caller.dnd && <span>{t("callers.warnDnd")}</span>}
            {caller.outOfHours && <span>{t("callers.warnOutOfHours")}</span>}
            <button
              type="button"
              className="la-btn la-btn--soft"
              onClick={() => go(pending)}
              data-testid="voice-caller-call-anyway"
              style={{ alignSelf: "flex-start", marginTop: 4, height: 28 }}
            >
              {t("callers.callAnyway")}
            </button>
          </div>
          <button
            type="button"
            className="la-btn la-btn--soft la-btn--icon"
            aria-label={t("callers.dismiss")}
            title={t("callers.dismiss")}
            onClick={() => setPending(null)}
            style={{ width: 26, height: 26, flexShrink: 0 }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {last && (
        <span data-testid="voice-caller-last-call-back" title={t("callers.lastAttempt.hint")} style={{ fontSize: 11.5, color: "var(--mute)" }}>
          {last}
        </span>
      )}
    </div>
  );
}
