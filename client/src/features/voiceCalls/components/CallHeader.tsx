import { useTranslation } from "react-i18next";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { callerStatus } from "../callers";
import { formatDateTime, formatDuration } from "../format";
import { callStatus } from "../status";
import { CallAvatar, callerIni, callerTitle } from "./bits";
import { CallBackButton } from "./CallBackButton";
import type { CallerContext } from "./CallSidebar";
import { HubspotPushButton } from "./HubspotPushButton";
import { OutcomePill } from "./OutcomePill";

/**
 * The top of the lead panel: who, how the selected call ended, when, how long,
 * then the caller actions (Callers view).
 */
export function CallHeader({ call, narrow, caller }: { call: VoiceCallDetail; narrow: boolean; caller?: CallerContext }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const who = caller ? { callerName: caller.caller.name, callerNumber: caller.caller.phone } : call;
  const status = caller ? callerStatus(caller.caller) : callStatus(call);
  const phone = who.callerName && who.callerNumber ? who.callerNumber : null;

  const identity = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
      <CallAvatar ini={callerIni(who, t("webCaller"))} status={status} size={56} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: narrow ? 20 : 22, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
          {callerTitle(who, t("webCaller"))}
        </span>
        <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} />
      </div>
    </div>
  );

  return (
    <div data-testid="voice-call-header" style={{ padding: narrow ? "12px 14px" : "16px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      {caller ? (
        <CallBackButton
          caller={caller.rawCaller}
          before={identity}
          // The HubSpot push is a demo of the CRM handoff: Demo calls only.
          after={caller.isOwner && call.scope === "demo" ? <HubspotPushButton caller={caller.rawCaller} /> : null}
        />
      ) : identity}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--mute)" }}>
        {phone && <span style={{ fontFamily: "var(--mono)" }}>{phone}</span>}
        <span>{formatDateTime(call.startedAt, i18n.language)}</span>
        <span>{formatDuration(call.durationSeconds)}</span>
      </div>
    </div>
  );
}
