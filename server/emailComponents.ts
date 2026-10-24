// Content blocks for the branded email layout in server/email.ts: figure
// tiles, section cards, event rows, call list, agenda, weekly card, details.
// Email-client safe: tables, inline styles, PNG icons from
// client/public/site/img/email. Background images (tile glyphs, the weekly
// card) are a bonus: every cell also carries a flat colour for clients that
// drop them. Every `...Html` argument must already be escaped; plain-text
// arguments are escaped here.
import { EMAIL_THEME, emailAsset, escapeHtml } from "./email";

const T = EMAIL_THEME;
const e = escapeHtml;

/** One colour per kind of activity, the same in every email. `ink` is the
 *  darker shade for small text on the `tint`. */
export const EMAIL_HUES = {
  calls: { solid: "#5777AD", ink: "#46649A", tint: "#EEF2F8" },
  chats: { solid: "#4F8F7C", ink: "#3D7867", tint: "#EDF4F1" },
  contacts: { solid: "#BC6C86", ink: "#A2536E", tint: "#F9EEF2" },
  appointments: { solid: "#7C5CAB", ink: "#6B4D9A", tint: "#F3EFF8" },
  waiting: { solid: "#C4883C", ink: "#9A6A22", tint: "#FBF4E8" },
  callback: { solid: "#C9584E", ink: "#B4443B", tint: "#FBEFEC" },
  muted: { solid: "#8C8272", ink: T.mute, tint: "#F4F0EA" },
} as const;
export type EmailHue = keyof typeof EMAIL_HUES;

const img = (file: string, size: number) =>
  `<img src="${emailAsset(file)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;">`;

const kicker = (label: string, color: string) =>
  `<p style="margin:0 0 3px;font-family:${T.sans};font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;line-height:14px;color:${color};">${e(label)}</p>`;

export function emailPill(label: string, hue: EmailHue): string {
  const h = EMAIL_HUES[hue];
  return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;background-color:${h.solid};font-family:${T.sans};font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:14px;color:#FFFFFF;">${e(label)}</span>`;
}

export interface StatTile { art: string; value: number | string; label: string; hue: EmailHue }

/** Five coloured cards in one row: white figure and label, the icon large
 *  and faint behind them. Real table cells, so the row never wraps on
 *  desktop; phones get 3 + 2. */
export function emailStatTiles(tiles: StatTile[]): string {
  const cells = tiles.map((t, i) => {
    const c = EMAIL_HUES[t.hue].solid;
    const url = emailAsset(t.art);
    return `${i ? `<td class="la-tgap" width="8" style="width:8px;min-width:8px;font-size:0;line-height:0;"><div style="width:8px;height:1px;">&nbsp;</div></td>` : ""}
  <td class="la-tile" width="20%" valign="top" bgcolor="${c}" background="${url}" style="width:20%;background-color:${c};background-image:url('${url}');background-repeat:no-repeat;background-position:right top;background-size:64px 84px;border-radius:12px;padding:15px 8px 13px 13px;">
    <div style="font-family:${T.sans};font-size:30px;font-weight:700;line-height:32px;color:#FFFFFF;">${e(t.value)}</div>
    <div style="margin-top:9px;font-family:${T.sans};font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:12px;color:#FFFFFF;">${e(t.label)}</div>
  </td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr class="la-tile-row">${cells}</tr></table>`;
}

const CARD = `bgcolor="${T.card}" style="background-color:${T.card};border:1px solid ${T.line};border-radius:14px;`;

/** Serif title with an optional line icon, as used at the top of a card. */
const cardTitle = (title: string, color: string, size: number, icon?: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    ${icon ? `<td valign="middle" style="padding-right:10px;font-size:0;line-height:0;">${img(icon, 20)}</td>` : ""}
    <td valign="middle" style="font-family:${T.serif};font-size:${size}px;font-weight:600;line-height:1.25;letter-spacing:-.01em;color:${color};">${e(title)}</td>
  </tr></table>`;

/** A section of the email: an off-white card with a serif title, an optional
 *  note on the right of the title, and its content below. */
export function emailSection(s: { title: string; icon?: string; aside?: string; bodyHtml: string }): string {
  const aside = s.aside
    ? `<td align="right" valign="middle" style="white-space:nowrap;"><span style="display:inline-block;padding:3px 11px;border-radius:999px;background-color:${T.surface};border:1px solid ${T.line};font-family:${T.sans};font-size:10.5px;font-weight:600;line-height:15px;color:${T.mute};">${e(s.aside)}</span></td>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${CARD}margin:16px 0 0;"><tr>
  <td style="padding:20px 22px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle">${cardTitle(s.title, T.wineDeep, 21, s.icon)}</td>${aside}</tr></table>
    ${s.bodyHtml}
  </td>
</tr></table>`;
}

/** One thing that happened: a tinted row with a round icon, the kind in
 *  small capitals, one sentence and one line of detail. `link` adds a small
 *  "Open →" under it, to that one call or chat. */
export function emailEventRow(r: {
  icon: string; hue: EmailHue; label: string; textHtml: string; subHtml?: string; link?: { label: string; url: string };
}): string {
  const h = EMAIL_HUES[r.hue];
  const sub = r.subHtml ? `<p style="margin:4px 0 0;font-family:${T.sans};font-size:11.5px;line-height:1.5;color:${T.mute};">${r.subHtml}</p>` : "";
  const link = r.link
    ? `<p style="margin:5px 0 0;"><a href="${e(r.link.url)}" target="_blank" style="font-family:${T.sans};font-size:12px;font-weight:600;line-height:1.5;color:${h.ink};text-decoration:none;">${e(r.link.label)}&nbsp;&rarr;</a></p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${h.tint}" style="margin:12px 0 0;background-color:${h.tint};border-radius:10px;"><tr>
  <td width="36" valign="top" style="width:36px;padding:14px 0 14px 14px;font-size:0;line-height:0;">${img(r.icon, 36)}</td>
  <td valign="top" style="padding:13px 16px 14px 14px;">
    ${kicker(r.label, h.ink)}
    <p style="margin:0;font-family:${T.sans};font-size:13.5px;line-height:1.5;color:${T.ink};">${r.textHtml}</p>
    ${sub}
    ${link}
  </td>
</tr></table>`;
}

/** Quiet one-liner for a section with nothing in it. */
export function emailQuietLine(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="margin:12px 0 0;background-color:${T.surface};border-radius:10px;"><tr>
  <td width="28" valign="middle" style="width:28px;padding:11px 0 11px 14px;font-size:0;line-height:0;">${img("quiet-ok.png", 28)}</td>
  <td valign="middle" style="padding:11px 16px 11px 12px;font-family:${T.sans};font-size:12.5px;line-height:1.5;color:${T.inkSoft};">${e(text)}</td>
</tr></table>`;
}

/** `url` + `openLabel` add an "Open →" link to that one call. */
export interface CallRow { time: string; who: string; line?: string; url?: string; openLabel?: string }

/** List of calls: time, caller, one-line summary, with an optional link to
 *  the rest. */
export function emailCallList(rows: CallRow[], more?: { label: string; url: string }): string {
  const blue = EMAIL_HUES.calls.ink;
  const body = rows.map((r) => `<tr>
  <td width="28" valign="top" style="width:28px;padding:12px 0;border-top:1px solid ${T.line};font-size:0;line-height:0;">${img("call-row.png", 28)}</td>
  <td width="42" valign="top" style="width:42px;padding:12px 0 12px 12px;border-top:1px solid ${T.line};font-family:${T.sans};font-size:12px;line-height:28px;color:${T.mute};">${e(r.time)}</td>
  <td valign="top" style="padding:12px 0 12px 10px;border-top:1px solid ${T.line};">
    <p style="margin:0;font-family:${T.sans};font-size:13px;font-weight:700;line-height:1.45;color:${T.ink};">${e(r.who)}</p>
    ${r.line ? `<p style="margin:2px 0 0;font-family:${T.sans};font-size:12px;line-height:1.5;color:${T.mute};">${e(r.line)}</p>` : ""}
    ${r.url ? `<p style="margin:3px 0 0;"><a href="${e(r.url)}" target="_blank" style="font-family:${T.sans};font-size:12px;font-weight:600;line-height:1.5;color:${blue};text-decoration:none;">${e(r.openLabel ?? "Open")}&nbsp;&rarr;</a></p>` : ""}
  </td>
</tr>`).join("");
  const link = more
    ? `<tr><td colspan="3" style="padding:13px 0 0;border-top:1px solid ${T.line};"><a href="${e(more.url)}" target="_blank" style="font-family:${T.sans};font-size:12px;font-weight:600;line-height:1.5;color:${blue};text-decoration:none;">${e(more.label)}&nbsp;&rarr;</a></td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0;">${body}${link}</table>`;
}

export interface AgendaRow { dow: string; day: string; mon: string; time: string; who: string; sub?: string; pill?: string }

/** Inside of the agenda card: title, one line of context, then one tinted
 *  row per appointment with the day on the left. */
export function emailAgendaCard(c: { title: string; sub?: string; rows: AgendaRow[]; empty: string }): string {
  const h = EMAIL_HUES.appointments;
  const rows = c.rows.map((r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${h.tint}" style="margin:10px 0 0;background-color:${h.tint};border-radius:10px;"><tr>
  <td width="38" align="center" valign="middle" style="width:38px;padding:9px 0 9px 10px;font-family:${T.sans};color:${h.ink};">
    <div style="font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:11px;">${e(r.dow)}</div>
    <div style="font-size:17px;font-weight:700;line-height:20px;color:${T.ink};">${e(r.day)}</div>
    <div style="font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;line-height:11px;">${e(r.mon)}</div>
  </td>
  <td valign="middle" style="padding:10px 12px 11px 12px;border-left:1px solid #E2D9EE;">
    <p style="margin:0;font-family:${T.sans};font-size:12.5px;line-height:1.45;color:${T.ink};"><strong style="font-weight:700;">${e(r.time)}</strong>${r.time && r.who ? " &middot; " : ""}${e(r.who)}</p>
    ${r.sub ? `<p style="margin:1px 0 0;font-family:${T.sans};font-size:11px;line-height:1.45;color:${T.mute};">${e(r.sub)}</p>` : ""}
    ${r.pill ? `<div style="margin:5px 0 0;">${emailPill(r.pill, "appointments")}</div>` : ""}
  </td>
</tr></table>`).join("");
  const empty = c.rows.length ? "" : `<p style="margin:14px 0 0;font-family:${T.sans};font-size:12px;line-height:1.5;color:${T.mute};">${e(c.empty)}</p>`;
  return `${cardTitle(c.title, T.wineDeep, 18, "head-agenda.png")}
${c.sub ? `<p style="margin:5px 0 4px;font-family:${T.sans};font-size:11px;line-height:1.45;color:${T.mute};">${e(c.sub)}</p>` : ""}
${rows}${empty}`;
}

export interface WeekStat { icon: string; value: number; label: string }

/** Inside of the dark weekly card: title and one figure per line. */
export function emailWeekCard(c: { title: string; stats: WeekStat[] }): string {
  const rows = c.stats.map((s) => `<tr>
  <td width="36" valign="middle" style="width:36px;padding:12px 0 0;font-size:0;line-height:0;">${img(s.icon, 36)}</td>
  <td valign="middle" style="padding:12px 0 0 12px;font-family:${T.sans};color:#FFFFFF;">
    <div style="font-size:20px;font-weight:700;line-height:22px;">${e(s.value)}</div>
    <div style="font-size:11.5px;line-height:16px;color:#E4E6EC;">${e(s.label)}</div>
  </td>
</tr>`).join("");
  return `${cardTitle(c.title, "#FFFFFF", 18)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${rows}</table>`;
}

/** Two cards side by side, equal height (they stack on phones): a light one
 *  on the left and the dark, illustrated one on the right. With only one of
 *  them, that card takes the full width. */
export function emailSplit(leftHtml: string, rightHtml: string): string {
  const dark = "#262C3C";
  const art = emailAsset("week-bg.jpg");
  const light = `${CARD}padding:18px 18px 20px;`;
  const night = `bgcolor="${dark}" background="${art}" style="background-color:${dark};background-image:url('${art}');background-repeat:no-repeat;background-position:right bottom;background-size:cover;border-radius:14px;padding:18px 18px 22px;`;
  const cells = leftHtml && rightHtml
    ? `<td class="la-col" width="50%" valign="top" ${light}width:50%;">${leftHtml}</td>
  <td class="la-gap" width="14" style="width:14px;min-width:14px;font-size:0;line-height:0;"><div style="width:14px;height:1px;">&nbsp;</div></td>
  <td class="la-col" width="50%" valign="top" ${night}width:50%;">${rightHtml}</td>`
    : leftHtml ? `<td valign="top" ${light}">${leftHtml}</td>` : `<td valign="top" ${night}">${rightHtml}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;"><tr>
  ${cells}
</tr></table>`;
}

/** Label/value card (contact details, alert facts). `valueHtml` must already
 *  be escaped; labels are escaped here. `icon` is a file in the email image
 *  folder; give one to every row or to none. */
/** A value past this many characters runs over one line: semibold then reads as heavy. */
const LONG_VALUE = 70;

export function emailDetails(rows: Array<{ label: string; valueHtml: string; icon?: string }>): string {
  const body = rows.map((r, i) => {
    const rule = i ? `border-top:1px solid ${T.line};` : "";
    const icon = r.icon
      ? `<td width="32" valign="top" style="width:32px;padding:13px 0 13px 18px;${rule}font-size:0;line-height:0;">${img(r.icon, 32)}</td>`
      : "";
    return `<tr>
  ${icon}
  <td valign="top" style="padding:12px 18px 13px ${r.icon ? 13 : 18}px;${rule}">
    <p style="margin:0 0 2px;font-family:${T.sans};font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;line-height:14px;color:${T.mute2};">${e(r.label)}</p>
    <p style="margin:0;font-family:${T.sans};font-size:14px;font-weight:${r.valueHtml.length > LONG_VALUE ? 400 : 600};line-height:20px;color:${T.ink};">${r.valueHtml}</p>
  </td>
</tr>`;
  }).join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${CARD}margin:0 0 4px;">
${body}
</table>`;
}

/** A message a caller left, shown as a chat bubble in a card: a small-caps
 *  label, the words themselves (corner cut at top left, like a received chat
 *  message) and who said it. `textHtml` and `byHtml` must already be escaped. */
export function emailMessageBubble(m: { label: string; textHtml: string; byHtml?: string }): string {
  const h = EMAIL_HUES.callback;
  const by = m.byHtml
    ? `<p style="margin:9px 0 0 4px;font-family:${T.sans};font-size:12px;line-height:1.5;color:${T.mute};">${m.byHtml}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${CARD}margin:0 0 10px;">
<tr><td style="padding:16px 18px 16px;">
  ${kicker(m.label, h.ink)}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr>
    <td bgcolor="${h.tint}" style="background-color:${h.tint};border-radius:3px 16px 16px 16px;padding:13px 16px 14px;">
      <p style="margin:0;font-family:${T.sans};font-size:16px;line-height:1.55;color:${T.ink};">${m.textHtml}</p>
    </td>
  </tr></table>
  ${by}
</td></tr>
</table>`;
}
