// Client alert and daily recap emails, rendered with the branded layout in
// server/email.ts and the blocks in server/emailComponents.ts. Every dynamic
// value is escaped here. The engine sends the facts (times already formatted
// in the account timezone and language, e.g. "do 16 okt 14:30").
import { EMAIL_THEME as T, escapeHtml, renderEmailLayout, renderEmailText } from "../email";
import {
  emailAgendaCard, emailCallList, emailDetails, emailEventRow, emailQuietLine, emailSection,
  emailSplit, emailStatTiles, emailWeekCard, type AgendaRow, type EmailHue,
} from "../emailComponents";
import { copyFor, type AlertEmailType } from "./emailCopy";

export interface AlertEmailInput {
  type: AlertEmailType | "daily_recap";
  language: string;
  accountName: string;
  link: string;
  data: Record<string, any>;
}

export interface RenderedEmail { subject: string; html: string; text: string }

type Copy = ReturnType<typeof copyFor>;
type CardKind = keyof Copy["cards"];

const e = escapeHtml;
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown): number => Number(v) || 0;
const join = (...parts: string[]) => parts.filter(Boolean).join(", ");
const dot = (...parts: string[]) => parts.filter(Boolean).join(" · ");

/** Dutch numbers the way people write them: +31612345678 -> 06 12 34 56 78,
 *  +31735210099 -> 073 521 0099. Anything else is left as it came. */
export function displayPhone(raw: unknown): string {
  const s = str(raw).trim();
  const digits = s.replace(/[\s().-]/g, "");
  const m = /^(?:\+|00)31(\d{9})$/.exec(digits);
  if (!m) return s;
  const n = `0${m[1]}`;
  return n.startsWith("06")
    ? `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8)}`
    : `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** "do 16 okt 14:30" -> ["do 16 okt", "14:30"]. Anything else stays whole. */
function splitWhen(text: string): [day: string, time: string] {
  const m = /^(.*\S)\s+(\d{1,2}:\d{2})$/.exec(text.trim());
  return m ? [m[1], m[2]] : [text, ""];
}

const CARD_STYLE: Record<CardKind, { icon: string; hue: EmailHue }> = {
  booked: { icon: "ev-booked.png", hue: "appointments" },
  rescheduled: { icon: "ev-rescheduled.png", hue: "appointments" },
  cancelled: { icon: "ev-cancelled.png", hue: "muted" },
  callback: { icon: "ev-callback.png", hue: "callback" },
  reply: { icon: "ev-reply.png", hue: "waiting" },
};

/** One row of the recap's "today" section plus its plain-text line. `at` is
 *  used by appointment kinds only. */
function eventRow(c: Copy, kind: CardKind, f: { name: string; at?: string; sub?: string }) {
  const s = CARD_STYLE[kind];
  const name = f.name || c.someone;
  const k = c.cards[kind];
  const text = kind === "callback" || kind === "reply" ? c.cards[kind].text(name) : c.cards[kind].text(name, f.at ?? "");
  return {
    html: emailEventRow({ icon: s.icon, hue: s.hue, label: k.title, textHtml: e(text), subHtml: f.sub ? e(f.sub) : undefined }),
    text: `${k.title}: ${text}${f.sub ? ` (${f.sub})` : ""}`,
  };
}

type Fact = [label: string, value: string, icon: string];

/** The footer's "choose which emails you get": the same /go link, opening
 *  the account's Recaps & alerts tab (GoLink, /api/go/:code). */
const settingsLink = (c: Copy, link: string) => ({ label: c.manage, url: `${link}?to=settings` });

function renderAlert(input: AlertEmailInput & { type: AlertEmailType }): RenderedEmail {
  const c = copyFor(input.language);
  const d = input.data;
  const L = c.labels;
  const name = str(d.customerName) || c.unknown;
  const phone = displayPhone(d.customer?.phone);
  const time = str(d.startText);
  const [day, clock] = splitWhen(time);
  // The call recap first: it says what the rest is about.
  const facts: Fact[] = [[L.summary, str(d.summary).slice(0, 400), "d-summary.png"],
    [L.customer, name, "d-person.png"], [L.phone, phone, "d-phone.png"], [L.email, str(d.customer?.email), "d-mail.png"]];
  if (input.type === "appointment_booked" || input.type === "appointment_cancelled" || input.type === "appointment_rescheduled") {
    facts.push([L.when, dot(day, clock), "d-date.png"]);
  }
  if (input.type === "appointment_rescheduled" && d.oldStartText && d.oldStartText !== time) {
    facts.push([L.oldWhen, str(d.oldStartText), "d-history.png"]);
  }
  if (input.type === "appointment_booked") facts.push([L.source, str(d.sourceText), "d-source.png"]);
  if (input.type === "callback_requested") facts.push([L.about, str(d.about), "d-note.png"]);
  if (input.type === "lead_needs_reply") {
    facts.push([L.reason, str(d.reasonText), "d-reason.png"], [L.lastMessage, str(d.message).slice(0, 300), "d-chat.png"],
      [L.since, str(d.sinceText), "d-since.png"]);
  }
  const kept = facts.filter(([, v]) => v);
  const note = c.notes[input.type];
  const bodyHtml = emailDetails(kept.map(([label, v, icon]) => ({ label, valueHtml: e(v), icon })))
    + (note ? `<p style="margin:12px 4px 0;font-family:${T.sans};font-size:12px;line-height:1.5;color:${T.mute};">${e(note)}</p>` : "");
  const intro = c.intro[input.type](input.accountName);
  const heading = c.heading[input.type];
  const cta = { label: c.cta, url: input.link };
  const footerNote = c.footer(input.accountName);
  const footerLink = settingsLink(c, input.link);
  return {
    subject: c.subject[input.type](name, time, phone || c.unknown),
    html: renderEmailLayout({
      lang: input.language, preheader: intro, eyebrow: input.accountName, heading, art: "alert",
      bodyHtml, cta, footerNote, footerLink,
    }),
    text: renderEmailText({
      heading, cta, footerNote, footerLink,
      bodyText: `${intro}\n\n${kept.map(([label, v]) => `${label}: ${v}`).join("\n")}${note ? `\n\n${note}` : ""}`,
    }),
  };
}

/** One agenda row from an engine item ("do 16 okt 14:30"). */
function agendaRow(c: Copy, item: any): AgendaRow {
  const [when, time] = splitWhen(str(item.atText));
  const parts = when.split(" ");
  const [dow, day, mon] = parts.length === 3 ? parts : ["", when, ""];
  const pill = item.change === "new" ? c.pills.new : item.change === "moved" ? c.pills.moved : undefined;
  return { dow, day, mon, time, who: str(item.name) || c.unknown, sub: displayPhone(item.phone) || undefined, pill };
}

/** Calls shown in the email; the rest is one link away. */
const CALLS_SHOWN = 5;

function renderRecap(input: AlertEmailInput): RenderedEmail {
  const c = copyFor(input.language);
  const R = c.recap;
  const d = input.data;
  const counts = d.counts ?? {};
  const html: string[] = [];
  const text: string[] = [];

  html.push(emailStatTiles([
    { art: "tile-bg-calls.png", value: num(counts.calls), label: R.calls, hue: "calls" },
    { art: "tile-bg-chats.png", value: num(counts.conversations), label: R.conversations, hue: "chats" },
    { art: "tile-bg-contacts.png", value: num(counts.new_contacts), label: R.newContacts, hue: "contacts" },
    { art: "tile-bg-appointments.png", value: num(counts.new_appointments), label: R.newAppointments, hue: "appointments" },
    { art: "tile-bg-waiting.png", value: num(counts.waiting), label: R.waiting, hue: "waiting" },
  ]));
  text.push([
    `${R.calls}: ${num(counts.calls)}`, `${R.conversations}: ${num(counts.conversations)}`,
    `${R.newContacts}: ${num(counts.new_contacts)}`, `${R.newAppointments}: ${num(counts.new_appointments)}`,
    `${R.waiting}: ${num(counts.waiting)}`,
  ].join("\n"));

  // Today in brief: what needs the team first, then today's appointment changes. Each item once.
  const rows = [
    ...(d.waiting ?? []).map((w: any) => eventRow(c, w.type === "reply" ? "reply" : "callback", {
      name: str(w.name), sub: dot(displayPhone(w.phone), str(w.about), splitWhen(str(w.atText))[1]),
    })),
    ...(d.appointments ?? []).map((a: any) => eventRow(c, (["booked", "rescheduled", "cancelled"].includes(a.kind) ? a.kind : "booked") as CardKind, {
      name: str(a.name), at: str(a.atText), sub: dot(displayPhone(a.phone), a.sourceText ? c.via(str(a.sourceText)) : ""),
    })),
  ];
  html.push(emailSection({ title: R.sectionToday, bodyHtml: rows.length ? rows.map((k) => k.html).join("") : emailQuietLine(R.quiet) }));
  text.push(`${R.sectionToday}\n${rows.length ? rows.map((k) => `- ${k.text}`).join("\n") : R.quiet}`);

  const calls = (d.calls ?? []) as any[];
  if (calls.length) {
    const total = Math.max(num(counts.calls), calls.length);
    const callRows = calls.map((k) => ({
      time: splitWhen(str(k.atText))[1],
      who: dot(str(k.name) || R.unknownCaller, displayPhone(k.phone)),
      line: str(k.line) || undefined,
    }));
    const more = total > CALLS_SHOWN
      ? { label: R.allCalls(total), url: `${new URL(input.link).origin}/platform/voice-calls` }
      : undefined;
    html.push(emailSection({
      title: R.sectionCalls, icon: "head-calls.png", aside: R.callsToday(total),
      bodyHtml: emailCallList(callRows.slice(0, CALLS_SHOWN), more),
    }));
    text.push(`${R.sectionCalls} (${R.callsToday(total)})\n${callRows.map((r) => `- ${join(r.time, r.who, r.line ?? "")}`).join("\n")}`);
  }

  // Agenda for the rest of this week (all of next week on a Sunday; tomorrow
  // only from an older engine) beside the last-7-days figures.
  const hasWeek = Array.isArray(d.week);
  const next = d.week_scope === "next";
  const agendaItems = ((hasWeek ? d.week : d.tomorrow) ?? []) as any[];
  const agendaTitle = !hasWeek ? R.sectionTomorrow : next ? R.sectionNextWeek : R.sectionWeek;
  const agendaHtml = hasWeek || agendaItems.length
    ? emailAgendaCard({
      title: agendaTitle, sub: !hasWeek ? undefined : next ? R.nextWeekSub : R.weekSub,
      rows: agendaItems.map((a) => agendaRow(c, a)), empty: R.weekEmpty,
    })
    : "";
  if (agendaHtml) {
    const lines = agendaItems.map((a) => `- ${join(str(a.atText), str(a.name) || c.unknown, displayPhone(a.phone))}`);
    text.push(`${agendaTitle}\n${lines.length ? lines.join("\n") : R.weekEmpty}`);
  }
  const wk = d.week_counts ?? {};
  const stats = ([["appointments", "wk-appointments.png"], ["calls", "wk-calls.png"], ["conversations", "wk-chats.png"]] as const)
    .map(([key, icon]) => {
      const value = num(wk[key]);
      return { icon, value, label: R.weekStats[key][value === 1 ? 0 : 1] };
    })
    .filter((s) => s.value > 0);
  if (stats.length) text.push(`${R.weekTitle}\n${stats.map((s) => `- ${s.value} ${s.label}`).join("\n")}`);
  if (agendaHtml || stats.length) {
    html.push(emailSplit(agendaHtml, stats.length ? emailWeekCard({ title: R.weekTitle, stats }) : ""));
  }

  const intro = R.intro(input.accountName);
  const heading = c.heading.daily_recap;
  const cta = { label: c.cta, url: input.link };
  const footerNote = c.footer(input.accountName);
  const footerLink = settingsLink(c, input.link);
  return {
    subject: c.subject.daily_recap(input.accountName, str(d.dateText)),
    html: renderEmailLayout({
      lang: input.language, preheader: intro, eyebrow: input.accountName, heading,
      subheading: R.subheading, dateText: str(d.dateLong) || str(d.dateText) || undefined,
      bodyHtml: html.join(""), cta, footerNote, footerLink,
    }),
    text: renderEmailText({ heading, cta, footerNote, footerLink, bodyText: [intro, ...text].join("\n\n") }),
  };
}

export function renderClientAlertEmail(input: AlertEmailInput): RenderedEmail {
  return input.type === "daily_recap" ? renderRecap(input) : renderAlert(input as AlertEmailInput & { type: AlertEmailType });
}
