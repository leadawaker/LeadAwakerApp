import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import type { VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDuration, formatListTime } from "../format";
import { callStatus } from "../status";
import { BookedPill, CallAvatar, callerIni, callerTitle } from "./bits";

interface Props {
  call: VoiceCallListItem;
  active: boolean;
  onClick: () => void;
}

export function VoiceCallListCard({ call, active, onClick }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const title = callerTitle(call, t("webCaller"));
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
        <CallAvatar ini={callerIni(call, t("webCaller"))} status={callStatus(call)} size={38} />
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
            {call.outcome || t("noSummary")}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em" }}>
              <AudioLines size={11} style={{ color: "var(--wine)" }} />
              {t("voiceCall")} · {formatDuration(call.durationSeconds)}
            </span>
            {call.bookedSlot && <BookedPill small={!active} />}
          </div>
        </div>
      </div>
    </div>
  );
}
