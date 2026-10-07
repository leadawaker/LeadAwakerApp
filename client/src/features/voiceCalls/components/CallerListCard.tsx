import { useTranslation } from "react-i18next";
import { PhoneOutgoing, Users } from "lucide-react";
import type { VoiceCaller } from "../api/voiceCallsApi";
import { callerStatus, maskVoiceCaller, relativeFromNow } from "../callers";
import { formatListTime } from "../format";
import { CallAvatar, callerIni, callerTitle } from "./bits";
import { OutcomePill } from "./OutcomePill";

interface Props {
  caller: VoiceCaller;
  active: boolean;
  masked: boolean;
  /** Live only: which client account the caller rang (Demo rows show the persona instead). */
  showAccount: boolean;
  onClick: () => void;
}

const META: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em", minWidth: 0 };

/** One row per person, same look as a call row. */
export function CallerListCard({ caller: rawCaller, active, masked, showAccount, onClick }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const caller = maskVoiceCaller(rawCaller, masked);
  const who = { callerName: caller.name, callerNumber: caller.phone };
  const title = callerTitle(who, t("webCaller"));
  const count = t("callers.callCount", { count: caller.callCount });
  const second = [caller.personaCompany, showAccount ? caller.accountName : null].filter(Boolean).join(" · ");
  const calledBack = caller.lastCalledBackAt
    ? t("callers.calledBackBy", { name: caller.lastCalledBackBy || "", when: relativeFromNow(caller.lastCalledBackAt, i18n.language) })
    : null;
  return (
    <div
      onClick={onClick}
      data-testid="voice-caller-row"
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
        <CallAvatar ini={callerIni(who, t("webCaller"))} status={callerStatus(caller)} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: "var(--ink)", fontWeight: active ? 600 : 400, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {calledBack && (
                <span title={calledBack} aria-label={calledBack} data-testid="voice-caller-called-back" style={{ display: "inline-flex", color: "var(--wine)" }}>
                  <PhoneOutgoing size={11} />
                </span>
              )}
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.04em" }}>
                {formatListTime(caller.lastCallAt, i18n.language)}
              </span>
            </span>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.45, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {second ? `${second} · ${count}` : count}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={META}>
              <Users size={11} style={{ color: "var(--wine)", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {caller.name && caller.phone ? caller.phone : t("voiceCall")}
              </span>
            </span>
            <OutcomePill outcome={caller.latestOutcome} bookedSlot={caller.bookedSlot} bookedIso={caller.bookedIso} small={!active} />
          </div>
        </div>
      </div>
    </div>
  );
}
