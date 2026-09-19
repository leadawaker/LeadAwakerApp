import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Calendar } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import { useVoiceCall, type VoiceCallDetail as Detail } from "../api/voiceCallsApi";
import { formatDateTime, formatDuration } from "../format";
import { callStatus } from "../status";
import { CallAvatar, callerInitials } from "./bits";
import { CallConversation } from "./CallConversation";
import { CallRecap } from "./CallRecap";

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 1100);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return narrow;
}

/** Same header card as the Chats page: who called, when, and how it ended. */
function DetailHeader({ call, narrow }: { call: Detail; narrow: boolean }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const when = call.bookedIso ? new Date(call.bookedIso) : null;
  const outcome = call.summary?.outcome;
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", overflow: "hidden", flexShrink: 0 }}>
      <div style={{ padding: narrow ? "14px 16px" : "16px 20px", display: "flex", alignItems: "center", gap: narrow ? 12 : 16 }}>
        <CallAvatar ini={callerInitials(call.callerName, t("webCaller"))} status={callStatus(call)} size={narrow ? 42 : 50} radius={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: narrow ? 22 : 27, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.01em" }}>
              {call.callerName || t("webCaller")}
            </span>
            {call.bookedSlot && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--good-tint)", borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px", color: "var(--good)", fontSize: 11.5, fontWeight: 600 }}>
                <Calendar className="h-[12px] w-[12px]" />
                {t("booked")}
                {when && `, ${when.toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" })} ${when.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, color: "var(--mute)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--wine)", fontWeight: 600 }}>
              <AudioLines size={13} />{t("voiceCall")}
            </span>
            <span>{formatDateTime(call.startedAt, i18n.language)}</span>
            <span>{formatDuration(call.durationSeconds)}</span>
            <span>{t("turns", { count: call.turnCount })}</span>
            {call.language && <span>{call.language.toUpperCase()}</span>}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", padding: narrow ? "12px 16px 14px" : "14px 20px 16px", display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mute)", flexShrink: 0 }}>{t("sections.outcome")}</span>
        <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: narrow ? 15 : 16.5, lineHeight: 1.45, color: outcome ? "var(--ink)" : "var(--mute)" }}>
          {outcome || t("noSummary")}
        </p>
      </div>
    </div>
  );
}

export function VoiceCallDetail({ callId }: { callId: string }) {
  const { t } = useTranslation("voiceCalls");
  const { data: call, isLoading } = useVoiceCall(callId);
  const narrow = useNarrow();

  if (isLoading) return null;
  if (!call) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MonoLabel>{t("notFound")}</MonoLabel>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: "column", gap: 14, overflowY: narrow ? "auto" : "hidden" }}>
      <DetailHeader call={call} narrow={narrow} />
      <div style={{ flex: narrow ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column-reverse" : "row", gap: 14 }}>
        <div style={{ flex: narrow ? undefined : 1, minWidth: 0, minHeight: narrow ? 760 : 0, display: "flex" }}>
          <CallConversation key={call.callId} call={call} />
        </div>
        <div style={{ width: narrow ? "auto" : 290, flexShrink: 0, minHeight: narrow ? "auto" : 0, display: "flex" }}>
          <CallRecap call={call} />
        </div>
      </div>
    </div>
  );
}
