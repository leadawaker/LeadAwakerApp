import { useTranslation } from "react-i18next";
import {
  Ban, CalendarCheck, CircleDot, Lightbulb, MessageSquareText, PhoneCall, Receipt, Sparkles, TriangleAlert, UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { groupSummaryItems, type SummaryGroupId } from "../summaryGroups";

/** One colour per group, from the stage tokens so it matches the Chats palette. */
const GROUP_COLOR: Record<SummaryGroupId, string> = {
  wanted: "var(--stage-contacted)",
  booked: "var(--good)",
  followUp: "var(--wine)",
  other: "var(--mute)",
};

const INTENT_ICON: Record<string, LucideIcon> = {
  ask_advice: Lightbulb,
  request_quote: Receipt,
  existing_customer: UserCheck,
  complaint_or_fault: TriangleAlert,
  book_appointment: CalendarCheck,
  callback_now: PhoneCall,
  leave_message: MessageSquareText,
  do_not_contact: Ban,
  not_relevant: CircleDot,
};

function IconTile({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 26, height: 26, flexShrink: 0, borderRadius: "var(--r-button)", display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `color-mix(in srgb, ${color} 13%, transparent)`, color,
      }}
    >
      <Icon size={14} />
    </span>
  );
}

/**
 * What the call came to, in one block: the engine's one-sentence conclusion
 * (`summary.outcome`) first, then the recap items grouped into what they
 * wanted, what was booked, the follow-up and anything else, each with its
 * own colour and an icon per item.
 */
export function CallSummaryBody({ call }: { call: VoiceCallDetail }) {
  const { t } = useTranslation("voiceCalls");
  const conclusion = (call.conclusion ?? call.summary?.outcome ?? "").trim();
  const groups = groupSummaryItems(call.summary?.items ?? []);

  if (!conclusion && groups.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--mute)" }}>{t("noSummary")}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="voice-call-summary-body">
      {conclusion && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "11px 13px" }}>
          <Sparkles size={15} style={{ color: "var(--wine)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)" }}>{conclusion}</p>
        </div>
      )}
      {groups.map((g) => {
        const color = GROUP_COLOR[g.id];
        return (
          <section key={g.id} data-testid={`voice-summary-group-${g.id}`}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color, marginBottom: 8 }}>
              {t(`summaryGroups.${g.id}`)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <IconTile Icon={INTENT_ICON[item.intent] ?? CircleDot} color={color} />
                  <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, color: "var(--ink)" }}>
                      {item.interest || t(`intents.${item.intent}`, { defaultValue: item.intent })}
                    </div>
                    {item.notes && (
                      <p style={{ margin: "2px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--mute)" }}>{item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
