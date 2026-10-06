import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Building2 } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import { useVoiceCall, type VoiceCallDetail as Detail } from "../api/voiceCallsApi";
import { formatDateTime, formatDuration } from "../format";
import { callStatus } from "../status";
import { CallAvatar, callerIni, callerTitle, maskCaller } from "./bits";
import { CallConversation } from "./CallConversation";
import { CallRecap } from "./CallRecap";
import { OutcomePill } from "./OutcomePill";

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
  const demo = call.scope === "demo";
  const conclusion = call.conclusion ?? call.summary?.outcome ?? null;
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", overflow: "hidden", flexShrink: 0 }}>
      <div style={{ padding: narrow ? "14px 16px" : "16px 20px", display: "flex", alignItems: "center", gap: narrow ? 12 : 16 }}>
        <CallAvatar ini={callerIni(call, t("webCaller"))} status={callStatus(call)} size={narrow ? 42 : 50} radius={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: narrow ? 22 : 27, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.01em" }}>
              {callerTitle(call, t("webCaller"))}
            </span>
            <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} />
            {demo && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px", color: "var(--ink-soft)", fontSize: 11.5, fontWeight: 600 }}>
                <Building2 className="h-[12px] w-[12px]" style={{ color: "var(--wine)" }} />
                {call.personaCompany || t("persona.universal")}
                {call.personaNiche && <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${call.personaNiche}`}</span>}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, color: "var(--mute)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--wine)", fontWeight: 600 }}>
              <AudioLines size={13} />{t("voiceCall")}
            </span>
            {call.callerName && call.callerNumber && <span style={{ fontFamily: "var(--mono)" }}>{call.callerNumber}</span>}
            <span>{formatDateTime(call.startedAt, i18n.language)}</span>
            <span>{formatDuration(call.durationSeconds)}</span>
            <span>{t("turns", { count: call.turnCount })}</span>
            {call.language && <span>{call.language.toUpperCase()}</span>}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", padding: narrow ? "12px 16px 14px" : "14px 20px 16px", display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mute)", flexShrink: 0 }}>{t("sections.outcome")}</span>
        <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: narrow ? 15 : 16.5, lineHeight: 1.45, color: conclusion ? "var(--ink)" : "var(--mute)" }}>
          {conclusion || t("noSummary")}
        </p>
      </div>
    </div>
  );
}

export function VoiceCallDetail({ callId, masked }: { callId: string; masked: boolean }) {
  const { t } = useTranslation("voiceCalls");
  const { data: rawCall, isLoading } = useVoiceCall(callId);
  const call = rawCall ? maskCaller(rawCall, masked) : rawCall;
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
