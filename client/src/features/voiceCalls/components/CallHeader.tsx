import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useSetCallTest, useVoiceCapabilities, type VoiceCallDetail } from "../api/voiceCallsApi";
import { callerStatus } from "../callers";
import { formatDateTime, formatDuration } from "../format";
import { callStatus } from "../status";
import { CallAvatar, callerIni, callerTitle } from "./bits";
import { CallBackButton } from "./CallBackButton";
import type { CallerContext } from "./CallSidebar";
import { HubspotPushButton } from "./HubspotPushButton";
import { OutcomePill } from "./OutcomePill";

/**
 * The one header above the transcript: who, how the selected call ended, when,
 * how long. On the right: the caller actions (Callers view) and, for the
 * Owner only, the "Test data" switch that hides the call from clients.
 */
export function CallHeader({ call, narrow, caller }: { call: VoiceCallDetail; narrow: boolean; caller?: CallerContext }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const who = caller ? { callerName: caller.caller.name, callerNumber: caller.caller.phone } : call;
  const status = caller ? callerStatus(caller.caller) : callStatus(call);
  const phone = who.callerName && who.callerNumber ? who.callerNumber : null;
  // The server grants `demo` only to the Owner who is not impersonating.
  const isOwner = useVoiceCapabilities().data?.demo === true;
  const setTest = useSetCallTest();

  return (
    <div className="neu-raised" data-testid="voice-call-header" style={{ borderRadius: "var(--r-card)", background: "var(--card)", flexShrink: 0, padding: narrow ? "12px 14px" : "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <CallAvatar ini={callerIni(who, t("webCaller"))} status={status} size={42} radius={13} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: narrow ? 20 : 22, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
            {callerTitle(who, t("webCaller"))}
          </span>
          <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 4, fontSize: 12, color: "var(--mute)" }}>
          {phone && <span style={{ fontFamily: "var(--mono)" }}>{phone}</span>}
          <span>{formatDateTime(call.startedAt, i18n.language)}</span>
          <span>{formatDuration(call.durationSeconds)}</span>
        </div>
      </div>
      {caller && (
        <div data-testid="voice-caller-header" style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <CallBackButton caller={caller.rawCaller} align={narrow ? "start" : "end"} />
          {/* The HubSpot push is a demo of the CRM handoff: Demo calls only. */}
          {caller.isOwner && call.scope === "demo" && <HubspotPushButton caller={caller.rawCaller} />}
        </div>
      )}
      {isOwner && (
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground" style={{ flexShrink: 0 }} data-testid="voice-test-toggle">
          <span>{t("testData.label")}</span>
          <Switch
            checked={call.isTest}
            disabled={setTest.isPending}
            onCheckedChange={(isTest) => setTest.mutate({ callId: call.callId, isTest })}
            aria-label={t("testData.label")}
          />
        </label>
      )}
    </div>
  );
}
