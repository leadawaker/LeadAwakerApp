import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Building2, CalendarCheck, UserRound } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import type { VoiceCaller, VoiceCallListItem } from "../api/voiceCallsApi";
import { callerStatus, callsOfCaller, maskVoiceCaller } from "../callers";
import { formatDateTime, formatDuration } from "../format";
import { CallAvatar, callerIni, callerTitle } from "./bits";
import { CallBackButton } from "./CallBackButton";
import { HubspotPushButton } from "./HubspotPushButton";
import { OutcomePill, slotLabel } from "./OutcomePill";
import { VoiceCallDetail } from "./VoiceCallDetail";

/** Below this the pane scrolls as one column instead of pinning the header. */
const STACK_BELOW = 1100;

function useStacked(): boolean {
  const [stacked, setStacked] = useState(typeof window !== "undefined" && window.innerWidth < STACK_BELOW);
  useEffect(() => {
    const onR = () => setStacked(window.innerWidth < STACK_BELOW);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return stacked;
}

const CHIP: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
  borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px", color: "var(--ink-soft)", fontSize: 11.5, fontWeight: 600,
  textDecoration: "none", whiteSpace: "nowrap",
};

function CallRow({ call, active, onClick }: { call: VoiceCallListItem; active: boolean; onClick: () => void }) {
  const { i18n } = useTranslation("voiceCalls");
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="voice-caller-call"
      aria-pressed={active}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer",
        padding: "7px 10px", borderRadius: "var(--r-surface)", fontFamily: "var(--sans)",
        background: active ? "var(--wine-tint)" : "transparent", color: "var(--ink)",
      }}
    >
      <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} small />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {call.conclusion || ""}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", flexShrink: 0 }}>{formatDuration(call.durationSeconds)}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", flexShrink: 0, minWidth: 92, textAlign: "right" }}>
        {formatDateTime(call.startedAt, i18n.language)}
      </span>
    </button>
  );
}

interface Props {
  caller: VoiceCaller;
  calls: VoiceCallListItem[];
  masked: boolean;
  isOwner: boolean;
}

/** One person: who they are, what Sara created for them, the two actions, then their calls. */
export function CallerDetail({ caller: rawCaller, calls, masked, isOwner }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const stacked = useStacked();
  const caller = maskVoiceCaller(rawCaller, masked);
  const who = { callerName: caller.name, callerNumber: caller.phone };
  const mine = useMemo(() => callsOfCaller(calls, rawCaller), [calls, rawCaller]);
  const [callId, setCallId] = useState<string>(rawCaller.lastCallId);
  const slot = caller.bookedSlot || caller.bookedIso ? slotLabel(caller.bookedIso, caller.bookedSlot, i18n.language) : null;

  const header = (
    <div className="neu-raised" data-testid="voice-caller-header" style={{ borderRadius: "var(--r-card)", background: "var(--card)", overflow: "hidden", flexShrink: 0 }}>
      <div style={{ padding: stacked ? "14px 16px" : "16px 20px", display: "flex", alignItems: "flex-start", gap: stacked ? 12 : 16, flexWrap: "wrap" }}>
        <CallAvatar ini={callerIni(who, t("webCaller"))} status={callerStatus(caller)} size={stacked ? 42 : 50} radius={14} />
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: stacked ? 22 : 27, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: 6, overflowWrap: "anywhere" }}>
            {callerTitle(who, t("webCaller"))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--mute)" }}>
            {caller.name && caller.phone && <span style={{ fontFamily: "var(--mono)", marginRight: 4 }}>{caller.phone}</span>}
            {caller.leadsId != null && (
              <Link href={`/platform/contacts/${caller.leadsId}`} style={CHIP} data-testid="voice-caller-lead-chip">
                <UserRound className="h-[12px] w-[12px]" style={{ color: "var(--wine)" }} />
                {t("callers.lead")}
              </Link>
            )}
            {slot && (
              <span style={CHIP} data-testid="voice-caller-booking-chip">
                <CalendarCheck className="h-[12px] w-[12px]" style={{ color: "var(--good)" }} />
                {t("callers.booked")}
                <span style={{ fontWeight: 400, color: "var(--mute)" }}>{`· ${slot}`}</span>
              </span>
            )}
            {caller.personaCompany && (
              <span style={CHIP}>
                <Building2 className="h-[12px] w-[12px]" style={{ color: "var(--wine)" }} />
                {caller.personaCompany}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: stacked ? "flex-start" : "flex-end", gap: 8, flex: stacked ? "1 1 100%" : "0 1 auto", minWidth: 0 }}>
          <CallBackButton caller={rawCaller} align={stacked ? "start" : "end"} />
          {isOwner && <HubspotPushButton caller={rawCaller} />}
        </div>
      </div>
      {mine.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", padding: stacked ? "10px 10px 12px" : "10px 14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 6px" }}>
            <MonoLabel>{t("callers.calls")}</MonoLabel>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{mine.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: stacked ? 220 : 146, overflowY: "auto" }}>
            {mine.map((c) => (
              <CallRow key={c.callId} call={c} active={c.callId === callId} onClick={() => setCallId(c.callId)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Desktop: header pinned, the call detail fills the rest. Narrow: one scrolling column.
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: stacked ? "auto" : "hidden" }}>
      <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>{header}</div>
      <div style={{ flex: stacked ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <VoiceCallDetail key={callId} callId={callId} masked={masked} />
      </div>
    </div>
  );
}
