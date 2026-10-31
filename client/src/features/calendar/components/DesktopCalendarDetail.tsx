// DesktopCalendarDetail.tsx — right-side appointment detail panel.
// A booking made on a phone call shows that call the way the Voice calls page
// does (summary, player, transcript; the components are reused, not copied).
// Any other booking (WhatsApp, SMS, website chat, booking page) shows the lead's
// details and chat recap with a link to the chat on the Leads page.
import {
  Clock, Video, Phone, Mail, X, Info, MessageSquare, Loader2,
  Calendar as CalIcon,
} from "lucide-react";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { useBookingCallId, useVoiceCall } from "@/features/voiceCalls/api/voiceCallsApi";
import { CallSummary } from "@/features/voiceCalls/components/CallRecap";
import { CallConversation } from "@/features/voiceCalls/components/CallConversation";
import { AiSummaryView } from "@/components/crm/AiSummaryView";
import type { Appointment } from "../lib/calendarDesign";
import { HEADER_H, statusMetaOf, kindLabelOf, channelOf, endClockOf } from "../lib/calendarDesign";
import {
  type DesktopCalendarProps, type SummaryKey,
  MONO, SUMMARY_ICONS, NavBtn, Fact, parseAiSummary,
} from "./desktopCalendarShared";

/** The lead behind a calendar entry, if any. */
export function bookingLeadId(ev: Appointment | null | undefined): number | null {
  const id = ev?.rawLead?.id ?? ev?.rawLead?.Id;
  return id == null ? null : Number(id);
}

const BOOKED_BY_KEY: Record<string, string> = {
  phone: "bookedByPhone",
  whatsapp: "bookedByWhatsapp",
  sms: "bookedBySms",
  website: "bookedByWebsite",
  booking_page: "bookedByBookingPage",
};

/** Name, campaign and the close button; the name opens the lead on the Leads page. */
function DetailHeader({ p, ev, subtitle }: { p: DesktopCalendarProps; ev: Appointment; subtitle: string | null }) {
  const { t } = p;
  const av = getLeadStatusAvatarColor(ev.no_show ? "Lost" : (ev.status || "Contacted"));
  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 10px 0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <button
        onClick={p.onOpenInLead}
        title={t("design.detail.openInLead")}
        style={{ display: "flex", gap: 11, alignItems: "center", flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
      >
        <div style={{ width: 38, height: 38, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: "var(--sh-raised-crisp)" }}>
          {ev.lead_name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.lead_name}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
        </div>
      </button>
      {p.showClose && (
        <NavBtn onClick={() => p.onSelectBooking(null)} style={{ flexShrink: 0 }} title={t("design.detail.close")} aria-label={t("design.detail.close")}><X className="h-3.5 w-3.5" /></NavBtn>
      )}
    </div>
  );
}

function StatusBanner({ p, ev }: { p: DesktopCalendarProps; ev: Appointment }) {
  const sm = statusMetaOf(ev, p.t);
  if (ev.side) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "9px 12px", borderRadius: "var(--r-surface)", background: "var(--wine-tint)", border: "1px solid var(--line)", flexShrink: 0 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700 }}>{kindLabelOf(ev, p.t) ?? sm.label}</span>
        <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{p.t("design.kind.sideNote")}</span>
      </div>
    );
  }
  if (sm.key === "booked") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-surface)", background: sm.tint, border: `1px solid ${sm.color}33`, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: sm.color }} />
      <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: sm.color, fontWeight: 700 }}>{sm.label}</span>
    </div>
  );
}

/** Booked on a call: the call's summary, then its player and transcript. */
function CallBookingDetail({ p, ev, callId }: { p: DesktopCalendarProps; ev: Appointment; callId: string }) {
  const { t } = p;
  const { data: call, isLoading } = useVoiceCall(callId);
  const when = `${ev.formattedDate} · ${ev.time} – ${endClockOf(ev)}`;
  return (
    <>
      <DetailHeader p={p} ev={ev} subtitle={when} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }} data-testid="calendar-call-detail">
        <StatusBanner p={p} ev={ev} />
        {isLoading || call === undefined ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 30, color: "var(--mute)", fontSize: 12.5 }}>
            <Loader2 className="h-4 w-4 animate-spin" />{t("design.detail.loadingCall")}
          </div>
        ) : call ? (
          <>
            <CallSummary call={call} />
            <div style={{ flex: "1 0 auto", minHeight: 520, display: "flex" }}>
              <CallConversation key={call.callId} call={call} />
            </div>
          </>
        ) : (
          <ChatBookingBody p={p} ev={ev} />
        )}
      </div>
    </>
  );
}

/** Lead facts, the chat recap and a link to the chat. */
function ChatBookingBody({ p, ev }: { p: DesktopCalendarProps; ev: Appointment }) {
  const { t } = p;
  const rawLead = ev.rawLead as Record<string, any> | undefined;
  const summary = parseAiSummary(rawLead?.ai_summary ?? rawLead?.aiSummary ?? null);
  const bookedBy = BOOKED_BY_KEY[String(rawLead?.booking_channel ?? rawLead?.bookingChannel ?? "")];

  return (
    <>
      <div style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-card)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 14, flexShrink: 0 }}>
        <Fact icon={<CalIcon className="h-3.5 w-3.5" />} label={t("design.detail.date")} value={ev.formattedDate} />
        <Fact icon={<Clock className="h-3.5 w-3.5" />} label={t("design.detail.time")} value={`${ev.time} – ${endClockOf(ev)}`} />
        <Fact icon={channelOf(ev) === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} label={t("design.detail.channel")} value={channelOf(ev) === "phone" ? t("design.detail.phone") : t("design.detail.googleMeet")} />
        {bookedBy && <Fact icon={<MessageSquare className="h-3.5 w-3.5" />} label={t("design.detail.bookedBy")} value={t(`design.detail.${bookedBy}`)} />}
        <Fact icon={<Phone className="h-3.5 w-3.5" />} label={t("design.detail.phone")} value={ev.phone || "–"} />
        <Fact icon={<Mail className="h-3.5 w-3.5" />} label={t("design.detail.email")} value={ev.email || "–"} />
      </div>

      <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "14px 16px 16px", flexShrink: 0 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700, marginBottom: 10 }}>{t("design.detail.chatRecap")}</div>
        {!summary ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("design.detail.noChatRecap")}</p>
        ) : typeof summary === "string" ? (
          <AiSummaryView text={summary} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {summary.map((sec) => (
              <div key={sec.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {SUMMARY_ICONS[sec.key as SummaryKey] ?? <Info className="h-3 w-3" />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700, marginBottom: 2 }}>
                    {t(`design.detail.summary.${sec.key}`, { defaultValue: sec.key })}
                  </div>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-soft)" }}>{sec.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {rawLead && (
          <button type="button" onClick={p.onOpenInLead} className="la-btn la-btn--soft" style={{ marginTop: 14 }} data-testid="calendar-open-chat">
            <MessageSquare size={13} style={{ color: "var(--wine)" }} />{t("design.detail.openChat")}
          </button>
        )}
      </div>
    </>
  );
}

function ChatBookingDetail({ p, ev }: { p: DesktopCalendarProps; ev: Appointment }) {
  return (
    <>
      <DetailHeader p={p} ev={ev} subtitle={ev.campaign_name} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <StatusBanner p={p} ev={ev} />
        <ChatBookingBody p={p} ev={ev} />
      </div>
    </>
  );
}

export function DetailPanel(p: DesktopCalendarProps) {
  const { t } = p;
  const ev = p.selectedBooking;
  const leadId = bookingLeadId(ev);
  const { data: callId, isLoading } = useBookingCallId(leadId);

  if (!ev) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("design.detail.selectMeeting")}</div>;
  }
  if (leadId != null && isLoading) {
    return (
      <>
        <DetailHeader p={p} ev={ev} subtitle={ev.campaign_name} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}><Loader2 className="h-4 w-4 animate-spin" /></div>
      </>
    );
  }
  if (callId) return <CallBookingDetail p={p} ev={ev} callId={callId} />;
  return <ChatBookingDetail p={p} ev={ev} />;
}
