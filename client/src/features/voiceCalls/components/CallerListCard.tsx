import { useTranslation } from "react-i18next";
import { PhoneOutgoing } from "lucide-react";
import type { VoiceCaller } from "../api/voiceCallsApi";
import { callerStatus, lastContactAttempt, maskVoiceCaller } from "../callers";
import { formatListTime } from "../format";
import { CallAvatar, callerIni, callerTitle, ROW_META, ROW_NAME, ROW_TIME, useRowAvatar } from "./bits";
import { callerNeedsYou, callerStage, NeedsYouMarker, StatusPill } from "@/components/crm/status/StatusPill";
import { slotLabel } from "./OutcomePill";

interface Props {
  caller: VoiceCaller;
  active: boolean;
  masked: boolean;
  /** All-accounts view (agency, Live): which client account the caller rang, after the name. */
  showAccount: boolean;
  /** The latest call's recap: shown as an extra line while the row is hovered (hover-capable devices). */
  recap?: string | null;
  onClick: () => void;
}

/**
 * One row per person, two rows like a call: name (· account) | last call, then number | status.
 * On hover a third line slides open with the latest call's recap, as the All calls rows grow theirs.
 */
export function CallerListCard({ caller: rawCaller, active, masked, showAccount, recap, onClick }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const caller = maskVoiceCaller(rawCaller, masked);
  const who = { callerName: caller.name, callerNumber: caller.phone };
  const title = callerTitle(who, t("webCaller"));
  const account = showAccount ? caller.accountName : null;
  const calledBack = lastContactAttempt(caller, t, i18n.language);
  // One stage per person, plus "Needs you" while a callback waits.
  const stage = callerStage(rawCaller);
  const needsYou = callerNeedsYou(rawCaller);
  const avatar = useRowAvatar();
  return (
    <div
      onClick={onClick}
      data-testid="voice-caller-row"
      // The Chats row: inside `.la-cards--flat` a flat WhatsApp-style row (see components.css).
      className={active ? "la-camp-card active group" : "la-camp-card group"}
      style={{ display: "block", padding: 0 }}
    >
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <CallAvatar ini={callerIni(who, t("webCaller"))} status={callerStatus(caller)} size={avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25 }}>
              <span style={ROW_NAME}>{title}</span>
              {account && <span style={{ fontSize: 13, color: "var(--mute)" }}>{` · ${account}`}</span>}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, alignSelf: "center" }}>
              {calledBack && (
                <span title={calledBack} aria-label={calledBack} data-testid="voice-caller-called-back" style={{ display: "inline-flex", color: "var(--wine)" }}>
                  <PhoneOutgoing size={12} />
                </span>
              )}
              <span style={ROW_TIME}>{formatListTime(caller.lastCallAt, i18n.language)}</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ ...ROW_META, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {caller.name && caller.phone ? caller.phone : t("voiceCall")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {needsYou && <NeedsYouMarker small />}
              <StatusPill status={stage} detail={stage === "booked" ? slotLabel(caller.bookedIso, caller.bookedSlot, i18n.language) : null} bare />
            </span>
          </div>
          {recap && (
            // Closed at rest; hover opens it (max-height animates, hover-capable devices only).
            <div className="max-h-0 overflow-hidden transition-[max-height] duration-200 ease-out group-hover:max-h-[1.9em]" data-testid="voice-caller-recap">
              <p className="truncate" style={{ ...ROW_META, margin: 0, paddingTop: 3 }}>{recap}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
