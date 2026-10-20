// Chats page recap card: what the lead wants, the key facts, the booking and
// the next step. Same layout as the Voice calls recap (CallRecap): a flat Card
// with stacked sections. Built from the lead's own fields plus its AI summary
// (labeled "Interest: / Pain points: / Outcome:" text, or the JSON shape).
import { useTranslation } from "react-i18next";
import { CalendarCheck, Globe, MessageCircle } from "lucide-react";
import { resolveLang } from "@shared/langField";
import { parseSummary } from "@/components/crm/AiSummaryView";
import { Card, CardLabel } from "./designPrimitives";
import { getChatChannel } from "../chatChannel";

type Fact = { label: string; body: string };
type Recap = { wanted: string; facts: Fact[]; outcome: string; prose: string[] };

const SECTION_HEAD: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 };
const BODY: React.CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)" };
const NOTE: React.CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--mute)" };
const CHIP: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
  borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px", color: "var(--ink-soft)", fontSize: 11.5, fontWeight: 600,
  whiteSpace: "nowrap", maxWidth: "100%",
};

/** Split the AI summary into the recap's sections. */
function buildRecap(raw: unknown, lang: "en" | "nl", factLabel: (label: string) => string): Recap {
  const recap: Recap = { wanted: "", facts: [], outcome: "", prose: [] };
  if (!raw) return recap;
  // JSON shape: { headline, keyPoints: [{ text }], nextStep, outcome }
  let obj: any = typeof raw === "object" ? raw : null;
  if (!obj && typeof raw === "string" && raw.trim().startsWith("{")) {
    try { obj = JSON.parse(raw); } catch { obj = null; }
  }
  if (obj && (obj.headline || obj.keyPoints || obj.nextStep)) {
    recap.wanted = String(obj.headline || "");
    recap.facts = (Array.isArray(obj.keyPoints) ? obj.keyPoints : [])
      .map((p: any) => ({ label: "", body: String(p?.text ?? p ?? "") }))
      .filter((f: Fact) => f.body);
    recap.outcome = String(obj.nextStep || obj.outcome || "");
    return recap;
  }
  const parsed = parseSummary(resolveLang(raw, lang));
  if (parsed.mode === "prose") { if (parsed.text) recap.prose = [parsed.text]; return recap; }
  if (parsed.mode === "bullets") { recap.prose = parsed.items; return recap; }
  for (const s of parsed.sections) {
    const n = s.label.toLowerCase();
    if (/^(interest|interesse)/.test(n)) recap.wanted = s.body;
    else if (/^(outcome|uitkomst|resultaat|resultado)/.test(n)) recap.outcome = s.body;
    else recap.facts.push({ label: factLabel(s.label), body: s.body });
  }
  return recap;
}

function formatInZone(d: Date, locale: string, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions): string {
  try { return d.toLocaleString(locale, { ...opts, timeZone }); } catch { return d.toLocaleString(locale, opts); }
}

export function LeadRecap({ lead, timeZone }: { lead: Record<string, any>; timeZone?: string }) {
  const { t, i18n } = useTranslation("leads");
  const locale = i18n.language || "en";
  const uiLang: "en" | "nl" = locale.toLowerCase().startsWith("nl") ? "nl" : "en";

  const factLabel = (label: string) => {
    const n = label.toLowerCase();
    if (/^(pain|pijn|dor)/.test(n)) return t("detail.summarySections.painPoints");
    if (/^(qualif|kwalif)/.test(n)) return t("detail.summarySections.qualification");
    if (/^sentiment/.test(n)) return t("detail.summarySections.sentiment");
    return label;
  };
  const recap = buildRecap(lead.ai_summary ?? lead.aiSummary, uiLang, factLabel);
  const wanted = recap.wanted || String(lead.lead_context || lead.leadContext || lead.what_has_the_lead_done || "");

  // Booking
  const bookedRaw = lead.booked_call_date || lead.bookedCallDate;
  const booked = bookedRaw ? new Date(bookedRaw) : null;
  const bookedValid = booked && !isNaN(booked.getTime()) ? booked : null;
  const cancelled = Boolean(lead.booking_cancelled_at || lead.bookingCancelledAt);
  const noShow = Boolean(lead.no_show ?? lead.noShow);
  const bookingChannel = String(lead.booking_channel || lead.bookingChannel || "");

  // Next step: what happens now, from the lead's state; the summary's outcome otherwise.
  const now = Date.now();
  const nextSteps: string[] = [];
  if (lead.manual_takeover ?? lead.manualTakeover) {
    const reason = String(lead.handoff_reason || lead.handoffReason || "");
    nextSteps.push(reason ? `${t("chatRecap.handoff")}: ${reason}` : t("chatRecap.handoff"));
  }
  if (bookedValid && !cancelled && bookedValid.getTime() > now) {
    nextSteps.push(t("chatRecap.appointment", { date: formatInZone(bookedValid, locale, timeZone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }));
  }
  const nextActionRaw = lead.next_action_at || lead.nextActionAt;
  const nextAction = nextActionRaw ? new Date(nextActionRaw) : null;
  if (nextAction && !isNaN(nextAction.getTime()) && nextAction.getTime() > now) {
    nextSteps.push(t("chatRecap.followUp", { date: formatInZone(nextAction, locale, timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }));
  }

  const channel = getChatChannel(lead);
  const ChannelIcon = channel === "website" ? Globe : MessageCircle;
  const received = Number(lead.message_count_received ?? lead.messageCountReceived ?? 0);
  const sent = Number(lead.message_count_sent ?? lead.messageCountSent ?? 0);
  const language = String(lead.language || "");
  const meta = [language ? language.toUpperCase() : null, received || sent ? t("chatRecap.messageCounts", { received, sent }) : null].filter(Boolean).join(" · ");
  const hasSummary = Boolean(wanted || recap.facts.length || recap.outcome || recap.prose.length);

  return (
    <Card
      variant="flat"
      headLeft={<CardLabel>{t("chatRecap.title")}</CardLabel>}
      headRight={channel ? (
        <span style={CHIP} data-testid="chat-recap-channel">
          <ChannelIcon className="h-[12px] w-[12px]" style={{ color: "var(--wine)" }} />
          {t(`chatChannel.${channel}`)}
        </span>
      ) : undefined}
      style={{ minWidth: 0 }}
      bodyStyle={{ padding: 0, gap: 0 }}
    >
      {bookedValid && (
        <section style={{ padding: "16px 16px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: cancelled || noShow ? "var(--mute)" : "var(--good)", marginBottom: 8 }}>
            <CalendarCheck className="h-[13px] w-[13px]" />
            {cancelled ? t("chatRecap.cancelled") : noShow ? t("chatRecap.noShow") : t("chatRecap.booked")}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: "var(--ink)", textDecoration: cancelled ? "line-through" : undefined }}>
            {formatInZone(bookedValid, locale, timeZone, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>
            {formatInZone(bookedValid, locale, timeZone, { hour: "2-digit", minute: "2-digit" })}
            {bookingChannel && ` · ${t("chatRecap.via", { channel: t(`chatRecap.bookingChannel.${bookingChannel}`, { defaultValue: bookingChannel }) })}`}
          </div>
        </section>
      )}

      <section style={{ padding: "16px 16px 8px" }}>
        <div style={SECTION_HEAD}>{t("chatRecap.wanted")}</div>
        {wanted ? <p style={BODY}>{wanted}</p> : !hasSummary ? <p style={NOTE}>{t("chatRecap.noSummary")}</p> : null}
        {recap.prose.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: wanted ? 8 : 0 }}>
            {recap.prose.map((p, i) => <p key={i} style={NOTE}>{p}</p>)}
          </div>
        )}
      </section>

      {recap.facts.length > 0 && (
        <section style={{ padding: "8px 16px 8px" }}>
          <div style={SECTION_HEAD}>{t("chatRecap.facts")}</div>
          {recap.facts.map((f, i) => (
            <div key={i} style={{ padding: "8px 0 10px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              {f.label && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wine)", marginBottom: 3 }}>{f.label}</div>}
              <p style={{ ...BODY, fontSize: 13 }}>{f.body}</p>
            </div>
          ))}
        </section>
      )}

      {(nextSteps.length > 0 || recap.outcome) && (
        <section style={{ padding: "8px 16px 16px" }}>
          <div style={{ background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wine)", marginBottom: 4 }}>{t("chatRecap.nextStep")}</div>
            {nextSteps.map((s, i) => <p key={i} style={{ ...BODY, fontSize: 13 }}>{s}</p>)}
            {recap.outcome && <p style={{ ...NOTE, marginTop: nextSteps.length ? 6 : 0, color: "var(--ink-soft)" }}>{recap.outcome}</p>}
          </div>
        </section>
      )}

      {meta && (
        <div style={{ padding: "0 16px 16px", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--mute)" }}>{meta}</div>
      )}
    </Card>
  );
}
