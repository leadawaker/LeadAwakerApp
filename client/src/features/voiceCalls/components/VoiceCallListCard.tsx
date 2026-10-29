import { useTranslation } from "react-i18next";
import { callOutcomeStatus } from "@/components/crm/status/StatusPill";
import type { VoiceCallListItem } from "../api/voiceCallsApi";
import { formatListTime, formatRowDuration } from "../format";
import { callStatus, normalizeOutcome } from "../status";
import { CallAvatar, callerIni, callerTitle, maskCaller, ROW_META, ROW_NAME, ROW_TIME, useRowAvatar } from "./bits";
import { OutcomePill, slotLabel } from "./OutcomePill";

interface Props {
  call: VoiceCallListItem;
  active: boolean;
  masked: boolean;
  /** All-accounts view (agency): the client account rides after the name. */
  showAccount: boolean;
  onClick: () => void;
}

/**
 * One call, two rows: caller (· account) | length + outcome tag, then the recap | date (bold).
 * The recap is one line; on hover (devices that hover) the card grows to a second line.
 */
export function VoiceCallListCard({ call: rawCall, active, masked, showAccount, onClick }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const call = maskCaller(rawCall, masked);
  const demo = call.scope === "demo";
  // Row 1 is always who called; the muted tail is the client account (all-accounts view)
  // or, on Demo, the business the AI answered for.
  const title = callerTitle(call, t("webCaller"));
  const ini = callerIni(call, t("webCaller"));
  const avatar = useRowAvatar();
  // "4s" under a minute, "1:00" / "12:34" from there.
  const duration = call.durationSeconds == null ? null : formatRowDuration(call.durationSeconds, (s) => t("duration.sec", { s }));
  const when = formatListTime(call.startedAt, i18n.language);
  // Row 2 is the recap on every scope.
  const recap = call.conclusion || t("noSummary");
  // "Answered" is what most calls are: no tag for it.
  const showOutcome = callOutcomeStatus(normalizeOutcome(call.outcome)) !== "answered";
  // The card tag stays short ("Booked"): the slot is in the tooltip and in the detail.
  const slot = slotLabel(call.bookedIso, call.bookedSlot, i18n.language);
  const account = demo ? call.personaCompany || t("persona.universal") : showAccount ? call.accountName : null;
  return (
    <div
      onClick={onClick}
      data-testid="voice-call-row"
      // The Chats row: inside `.la-cards--flat` a flat WhatsApp-style row (see components.css).
      className={active ? "la-camp-card active group" : "la-camp-card group"}
      style={{ display: "block", padding: 0 }}
    >
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <CallAvatar ini={ini} status={callStatus(call)} size={avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25 }}>
              <span style={ROW_NAME}>{title}</span>
              {account && <span style={{ fontSize: 13, color: "var(--mute)" }}>{` · ${account}`}</span>}
            </span>
            {(duration || showOutcome) && (
              <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                {duration && <span style={{ ...ROW_TIME, whiteSpace: "nowrap" }}>{duration}</span>}
                {showOutcome && (
                  <span title={slot ?? undefined} style={{ display: "inline-flex" }}>
                    <OutcomePill outcome={call.outcome} bare />
                  </span>
                )}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            {/* One line at rest; hover grows it to two (max-height animates, hover-capable devices only).
                Smaller on desktop (12.75px), the phone keeps the readable 13.5px. */}
            <p
              className="line-clamp-1 max-h-[1.4em] text-[13.5px] md:text-[12.75px] transition-[max-height] duration-200 ease-out group-hover:line-clamp-2 group-hover:max-h-[2.8em]"
              style={{ lineHeight: ROW_META.lineHeight, color: ROW_META.color, flex: 1, minWidth: 0, margin: 0 }}
            >
              {recap}
            </p>
            <span style={{ ...ROW_TIME, flexShrink: 0, whiteSpace: "nowrap", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{when}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
