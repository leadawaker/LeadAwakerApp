import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import type { VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDuration, formatListTime } from "../format";
import { callStatus } from "../status";
import { Pill } from "@/components/crm/primitives";
import { CallAvatar, callerIni, callerInitials, callerTitle, maskCaller } from "./bits";
import { OutcomePill } from "./OutcomePill";

interface Props {
  call: VoiceCallListItem;
  active: boolean;
  masked: boolean;
  onClick: () => void;
}

const META: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em", minWidth: 0 };

export function VoiceCallListCard({ call: rawCall, active, masked, onClick }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const call = maskCaller(rawCall, masked);
  const demo = call.scope === "demo";
  const caller = callerTitle(call, t("webCaller"));
  // Demo rows are titled by the business the AI answered for, Live rows by who called.
  const title = demo ? call.personaCompany || t("persona.universal") : caller;
  const ini = demo ? callerInitials(title, t("persona.universal")) : callerIni(call, t("webCaller"));
  const duration = formatDuration(call.durationSeconds);
  return (
    <div
      onClick={onClick}
      data-testid="voice-call-row"
      style={{
        borderRadius: "var(--r-surface)", position: "relative", cursor: "pointer",
        background: active ? "var(--card)" : "transparent",
        boxShadow: active ? "var(--sh-raised-medium), inset 0 0 0 1px var(--line-strong)" : "none",
        transform: active ? "translateX(2px)" : "none",
        transition: "background 130ms, transform 130ms, box-shadow 130ms",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--wine-tint)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {active && (
        <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0" }} />
      )}
      <div style={{ padding: "9px 12px", display: "flex", gap: 10 }}>
        <CallAvatar ini={ini} status={callStatus(call)} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: "var(--ink)", fontWeight: active ? 600 : 400, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", flexShrink: 0, letterSpacing: "0.04em" }}>
              {formatListTime(call.startedAt, i18n.language)}
            </span>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.45, color: "var(--mute)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
            {demo ? `${caller} · ${duration}` : call.conclusion || t("noSummary")}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {demo ? (
              <span style={META}>
                {call.personaNiche && (
                  <Pill style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 7px", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", boxShadow: "var(--sh-inset-crisp)", background: "var(--bg)", color: "var(--mute)" }}>
                    {call.personaNiche}
                  </Pill>
                )}
              </span>
            ) : (
              <span style={META}>
                <AudioLines size={11} style={{ color: "var(--wine)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {call.accountName ? `${call.accountName} · ${duration}` : `${t("voiceCall")} · ${duration}`}
                </span>
              </span>
            )}
            <OutcomePill outcome={call.outcome} bookedSlot={call.bookedSlot} bookedIso={call.bookedIso} small={!active} />
          </div>
        </div>
      </div>
    </div>
  );
}
