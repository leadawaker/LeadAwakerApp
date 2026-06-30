// DesktopCalendarDetail.tsx — right-side meeting detail panel + the embedded
// Leads-style conversation thread.
import { useMemo } from "react";
import {
  Clock, Video, Phone, Mail, X, Info,
  Calendar as CalIcon,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import {
  computeMiniMsgMeta, groupMiniMessagesByThread, isAiMsg,
  MiniLeadRunWrapper, MiniAgentRunWrapper, MiniBotRunWrapper,
} from "@/features/leads/components/cardView/MiniChat";
import type { MiniMsgMeta } from "@/features/leads/components/cardView/types";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import {
  HEADER_H,
  statusMetaOf, channelOf, endClockOf,
} from "../lib/calendarDesign";
import { ScoreArcDonut } from "@/features/leads/components/cardView/atoms";
import { PipelineLeadPanel } from "@/features/leads/components/cardView/PipelineLeadPanel";
import { AiSummaryView } from "@/components/crm/AiSummaryView";
import {
  type DesktopCalendarProps, type SummaryKey,
  MONO, SERIF, SUMMARY_ICONS, NavBtn, Fact, parseAiSummary,
} from "./desktopCalendarShared";

// Leads-chat conversation thread — reuses the Leads card-view rendering pipeline
// (computeMiniMsgMeta + groupMiniMessagesByThread + run wrappers). The wrappers
// internally render MiniChatBubble, which has the `content || Content` fallback
// that fixes the previously-blank message text.
function ConversationThread({ msgs, leadName, leadAvatarColors }: {
  msgs: Interaction[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
}) {
  const session = useSession();
  const currentUser = session.status === "authenticated" ? session.user : null;

  const items = useMemo(() => {
    if (msgs.length === 0) return [];
    const all = msgs as any[];
    const metas = computeMiniMsgMeta(all);
    const idxOf = new Map<any, number>();
    all.forEach((mm, i) => idxOf.set(mm, i));

    const senderOf = (mm: any): "inbound" | "ai" | "human" =>
      String(mm.direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(mm) ? "ai" : "human";

    const out: React.ReactNode[] = [];
    const groups = groupMiniMessagesByThread(all);
    for (const group of groups) {
      const gmsgs = group.msgs;
      let i = 0;
      while (i < gmsgs.length) {
        const sk = senderOf(gmsgs[i]);
        const runMsgs: any[] = [];
        const runMetas: MiniMsgMeta[] = [];
        const startIdx = idxOf.get(gmsgs[i]) ?? i;
        while (i < gmsgs.length && senderOf(gmsgs[i]) === sk) {
          runMsgs.push(gmsgs[i]);
          runMetas.push(metas[idxOf.get(gmsgs[i]) ?? 0]);
          i++;
        }
        if (sk === "human") {
          out.push(<MiniAgentRunWrapper key={`h-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} currentUser={currentUser} />);
        } else if (sk === "inbound") {
          out.push(<MiniLeadRunWrapper key={`l-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} />);
        } else {
          out.push(<MiniBotRunWrapper key={`b-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} />);
        }
      }
    }
    return out;
  }, [msgs, leadName, leadAvatarColors, currentUser]);

  return <div className="flex flex-col">{items}</div>;
}

export function DetailPanel(p: DesktopCalendarProps) {
  const { t } = p;
  const ev = p.selectedBooking;
  if (!ev) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("design.detail.selectMeeting")}</div>;
  }

  // Reuse the pipeline lead panel for the full lead view (same as the Leads
  // pipeline). Falls back to the calendar-specific layout if no lead is linked.
  if (ev.rawLead) {
    return (
      <PipelineLeadPanel
        lead={ev.rawLead}
        onRefresh={p.onRefresh}
        accountTimezone={ev.timezone}
        onClose={() => p.onSelectBooking(null)}
      />
    );
  }

  const sm = statusMetaOf(ev, t);
  const av = getLeadStatusAvatarColor(ev.no_show ? "Lost" : (ev.status || "Contacted"));
  const rawLead = ev.rawLead as Record<string, any> | undefined;
  const aiSummaryRaw = rawLead?.ai_summary ?? rawLead?.aiSummary ?? null;
  const summary = parseAiSummary(aiSummaryRaw);

  return (
    <>
      <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 10px 0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Identity — avatar + name, opens the Leads page on click */}
        <button
          onClick={p.onOpenInLead}
          title={t("design.detail.openInLead")}
          style={{ display: "flex", gap: 11, alignItems: "center", flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <div style={{ width: 38, height: 38, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: "var(--sh-raised-crisp)" }}>{ev.lead_name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...SERIF, fontSize: 18, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.lead_name}</div>
            {ev.campaign_name && <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.campaign_name}</div>}
          </div>
        </button>
        {p.showClose && (
          <NavBtn onClick={() => p.onSelectBooking(null)} style={{ flexShrink: 0 }} title={t("design.detail.close")} aria-label={t("design.detail.close")}><X className="h-3.5 w-3.5" /></NavBtn>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* status banner */}
        {sm.key !== "booked" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-surface)", background: sm.tint, border: `1px solid ${sm.color}33` }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sm.color }} />
            <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
        )}

        {/* facts — white raised panel */}
        <div style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-card)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 14 }}>
          <Fact icon={<CalIcon className="h-3.5 w-3.5" />} label={t("design.detail.date")} value={ev.formattedDate} />
          <Fact icon={channelOf(ev) === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} label={t("design.detail.channel")} value={channelOf(ev) === "phone" ? t("design.detail.phone") : t("design.detail.googleMeet")} />
          <Fact icon={<Clock className="h-3.5 w-3.5" />} label={t("design.detail.time")} value={`${ev.time} – ${endClockOf(ev)}`} />
          <Fact icon={<Phone className="h-3.5 w-3.5" />} label={t("design.detail.phone")} value={ev.phone || "—"} />
          <Fact icon={<Mail className="h-3.5 w-3.5" />} label={t("design.detail.email")} value={ev.email || "—"} />
          {/* Lead score replaces fake attendance */}
          <div>
            <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{t("design.detail.leadScore")}</div>
            {ev.leadScore > 0 ? (
              <ScoreArcDonut score={ev.leadScore} />
            ) : (
              <span style={{ fontSize: 12, color: "var(--mute-2)" }}>—</span>
            )}
          </div>
        </div>

        {/* AI summary — real data, JSON sections or plain text fallback */}
        {summary && (
          <div>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700, marginBottom: 9 }}>{t("design.detail.aiSummary")}</div>
            {typeof summary === "string" ? (
              <AiSummaryView text={summary} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {summary.map((sec) => (
                  <div key={sec.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {SUMMARY_ICONS[sec.key as SummaryKey] ?? <Info className="h-3 w-3" />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700, marginBottom: 2 }}>
                        {t(`design.detail.summary.${sec.key}`, { defaultValue: sec.key })}
                      </div>
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-soft)" }}>{sec.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full conversation thread — admin/owner only */}
        {p.canSeeConversation && p.recentMessages.length > 0 && (
          <div>
            <div style={{ marginBottom: 9 }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700 }}>{t("design.detail.conversation")}</span>
            </div>
            <ConversationThread
              msgs={p.recentMessages}
              leadName={ev.lead_name}
              leadAvatarColors={{ bgColor: av.bg, textColor: av.text }}
            />
          </div>
        )}
      </div>
    </>
  );
}
