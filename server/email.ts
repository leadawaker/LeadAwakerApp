import nodemailer from "nodemailer";

/** Hosted PNG of the brand wordmark, flattened onto the card colour. Must be an
 *  absolute https URL: Gmail blocks SVG and data URIs. The Pi serves
 *  client/public live, so app.leadawaker.com works without a Vercel deploy. */
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || "https://app.leadawaker.com/site/img/email-logo.png";
const SITE_URL = "https://www.leadawaker.com";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SMTP_FROM = process.env.SMTP_FROM || "Lead Awaker <admin@leadawaker.com>";

/** Resend is used only when EMAIL_PROVIDER=resend AND a key is set. SMTP stays
 *  configured as a fallback for when Resend rejects or is unreachable. */
const useResend = () => process.env.EMAIL_PROVIDER === "resend" && !!process.env.RESEND_API_KEY;
const smtpConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const emailConfigured = () => useResend() || smtpConfigured();

/** Escape a value for interpolation into email HTML (text and attributes). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Outgoing {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface DeliveryResult {
  provider: "resend" | "smtp";
  id?: string;
}

async function deliverViaResend(msg: Outgoing): Promise<DeliveryResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Lead Awaker <onboarding@resend.dev>",
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      reply_to: msg.replyTo || undefined,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  console.log(`[email] Resend sent id=${data.id ?? "unknown"} to=${msg.to}`);
  return { provider: "resend", id: data.id };
}

async function deliverViaSmtp(msg: Outgoing): Promise<DeliveryResult> {
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    replyTo: msg.replyTo || undefined,
  });
  console.log(`[email] SMTP sent id=${info.messageId ?? "unknown"} to=${msg.to}`);
  return { provider: "smtp", id: info.messageId };
}

/** Send via Resend when enabled; if Resend fails, retry once over SMTP. Throws
 *  when every configured provider failed, so callers can report the failure. */
async function deliver(msg: Outgoing): Promise<DeliveryResult> {
  if (!useResend()) return deliverViaSmtp(msg);
  try {
    return await deliverViaResend(msg);
  } catch (resendErr: any) {
    console.error(`[email] Resend failed for ${msg.to}: ${resendErr.message}`);
    if (!smtpConfigured()) throw resendErr;
    try {
      const result = await deliverViaSmtp(msg);
      console.warn(`[email] Delivered to ${msg.to} via SMTP fallback after Resend failure`);
      return result;
    } catch (smtpErr: any) {
      console.error(`[email] SMTP fallback also failed for ${msg.to}: ${smtpErr.message}`);
      throw new Error(`Resend: ${resendErr.message} | SMTP: ${smtpErr.message}`);
    }
  }
}

// ─── Branded layout ──────────────────────────────────────────────────────
// One layout for every transactional email. Colours and fonts mirror the
// homepage (client/public/site): paper background, deep wine accent, Playfair
// Display headings, Manrope body. Email-client safe: tables, inline styles,
// web-safe font fallbacks, light only (no reliance on dark mode).

export const EMAIL_THEME = {
  bg: "#F3EFE8",
  card: "#FDFCF9", // the logo PNG is flattened onto this colour
  surface: "#F6F1EA",
  line: "#E7E0D4",
  ink: "#1F1A14",
  inkSoft: "#3A322A",
  mute: "#6C6354",
  mute2: "#948A77",
  wine: "#5E2230",
  onWine: "#F7F1E6",
  sans: "Manrope,'Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "'Playfair Display',Georgia,'Times New Roman',serif",
} as const;
const T = EMAIL_THEME;

export interface EmailCta {
  label: string;
  url: string;
}

export interface EmailLayoutOptions {
  /** Inbox preview line (plain text, escaped here). */
  preheader?: string;
  /** Small uppercase label above the heading (plain text, escaped here). */
  eyebrow?: string;
  /** Plain text, escaped here. */
  heading: string;
  /** Trusted HTML: escape every dynamic value before passing it in. Build it
   *  from emailParagraph / emailDetails so the styling stays consistent. */
  bodyHtml: string;
  cta?: EmailCta;
  /** Small print at the bottom of the card (plain text, escaped here). */
  footerNote?: string;
  /** Value for the html lang attribute. */
  lang?: string;
}

/** Body paragraph in the brand style. `html` must already be escaped. */
export function emailParagraph(html: string, opts: { muted?: boolean } = {}): string {
  const size = opts.muted ? 14 : 15;
  const color = opts.muted ? T.mute : T.inkSoft;
  return `<p style="margin:0 0 16px;font-family:${T.sans};font-size:${size}px;line-height:1.65;color:${color};">${html}</p>`;
}

/** Label/value block (contact details, recap figures). `valueHtml` must
 *  already be escaped; labels are escaped here. */
export function emailDetails(rows: Array<{ label: string; valueHtml: string }>): string {
  const body = rows
    .map(
      (r, i) => `<tr>
  <td valign="top" style="padding:${i === 0 ? 14 : 8}px 16px ${i === rows.length - 1 ? 14 : 8}px;width:110px;font-family:${T.sans};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;line-height:20px;color:${T.mute2};">${escapeHtml(r.label)}</td>
  <td valign="top" style="padding:${i === 0 ? 14 : 8}px 16px ${i === rows.length - 1 ? 14 : 8}px 0;font-family:${T.sans};font-size:15px;line-height:1.55;color:${T.ink};">${r.valueHtml}</td>
</tr>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.surface}" style="margin:4px 0 16px;background-color:${T.surface};border-radius:10px;">
${body}
</table>`;
}

/** Bulletproof button: the colour sits on the cell, so it survives clients
 *  that strip padding or backgrounds from links. */
function emailButton(cta: EmailCta): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" bgcolor="${T.wine}" style="border-radius:8px;background-color:${T.wine};">
      <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${T.sans};font-size:15px;font-weight:600;line-height:20px;color:${T.onWine};text-decoration:none;border:1px solid ${T.wine};border-radius:8px;">${escapeHtml(cta.label)}</a>
    </td>
  </tr>
</table>`;
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const heading = escapeHtml(opts.heading);
  // Trailing filler keeps the client from pulling body text into the preview.
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${T.bg};">${escapeHtml(opts.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`
    : "";
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${T.sans};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1.4;color:${T.wine};">${escapeHtml(opts.eyebrow)}</p>`
    : "";
  const cta = opts.cta
    ? `<tr><td class="la-pad" style="padding:8px 40px 8px;">${emailButton(opts.cta)}</td></tr>`
    : "";
  const footerNote = opts.footerNote
    ? `<tr><td class="la-pad" style="padding:24px 40px 0;"><p style="margin:0;padding-top:20px;border-top:1px solid ${T.line};font-family:${T.sans};font-size:12.5px;line-height:1.6;color:${T.mute2};">${escapeHtml(opts.footerNote)}</p></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.lang || "en")}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${T.wine}; }
  @media only screen and (max-width:620px) {
    .la-pad { padding-left:24px !important; padding-right:24px !important; }
    .la-h1 { font-size:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bg}" style="background-color:${T.bg};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td bgcolor="${T.card}" style="background-color:${T.card};border:1px solid ${T.line};border-radius:14px;padding-bottom:36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="la-pad" style="padding:34px 40px 0;">
                  <a href="${SITE_URL}" target="_blank" style="text-decoration:none;"><img src="${EMAIL_LOGO_URL}" width="180" height="32" alt="Lead Awaker" style="display:block;width:180px;max-width:180px;height:auto;border:0;"></a>
                </td>
              </tr>
              <tr>
                <td class="la-pad" style="padding:26px 40px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${T.wine}" style="width:32px;height:2px;line-height:2px;font-size:2px;background-color:${T.wine};">&nbsp;</td></tr></table>
                </td>
              </tr>
              <tr>
                <td class="la-pad" style="padding:24px 40px 8px;">
                  ${eyebrow}
                  <h1 class="la-h1" style="margin:0 0 18px;font-family:${T.serif};font-size:28px;line-height:1.2;font-weight:400;letter-spacing:-.01em;color:${T.ink};">${heading}</h1>
                  ${opts.bodyHtml}
                </td>
              </tr>
              ${cta}
              ${footerNote}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 24px 0;font-family:${T.sans};font-size:12px;line-height:1.6;color:${T.mute2};">
            Lead Awaker &middot; <a href="${SITE_URL}" target="_blank" style="color:${T.mute};text-decoration:underline;">leadawaker.com</a>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text alternative matching renderEmailLayout. Every email sends one. */
export function renderEmailText(opts: {
  heading: string;
  bodyText: string;
  cta?: EmailCta;
  footerNote?: string;
}): string {
  const parts = [opts.heading, opts.bodyText.trim()];
  if (opts.cta) parts.push(`${opts.cta.label}: ${opts.cta.url}`);
  if (opts.footerNote) parts.push(opts.footerNote);
  parts.push(`Lead Awaker\n${SITE_URL}`);
  return parts.join("\n\n") + "\n";
}

type Lang = "en" | "pt" | "nl";

interface Translations {
  subject: string;
  heading: string;
  /** Returns the full body line 1 sentence. `{invitedBy}` and `{role}` are
   *  plain-text placeholders; HTML callers must do their own bold wrapping. */
  bodyLine1: (invitedBy: string, role: string) => string;
  bodyLine2: string;
  cta: string;
  footer: string;
}

const TRANSLATIONS: Record<Lang, Translations> = {
  en: {
    subject: "You're invited to Lead Awaker",
    heading: "You're invited to Lead Awaker",
    bodyLine1: (invitedBy, role) =>
      `${invitedBy} has invited you to join as a ${role}`,
    bodyLine2: "Click the button below to set up your account and get started.",
    cta: "Set Up Your Account",
    footer:
      "This invite link expires in 72 hours. If you did not expect this invitation, you can safely ignore this email.",
  },
  pt: {
    subject: "Você foi convidado para o Lead Awaker",
    heading: "Você foi convidado para o Lead Awaker",
    bodyLine1: (invitedBy, role) =>
      `${invitedBy} convidou você para se juntar como ${role}`,
    bodyLine2: "Clique no botão abaixo para configurar sua conta e começar.",
    cta: "Configurar Minha Conta",
    footer:
      "Este link expira em 72 horas. Se você não esperava este convite, ignore este e-mail.",
  },
  nl: {
    subject: "Je bent uitgenodigd voor Lead Awaker",
    heading: "Je bent uitgenodigd voor Lead Awaker",
    bodyLine1: (invitedBy, role) =>
      `${invitedBy} heeft je uitgenodigd om deel te nemen als ${role}`,
    bodyLine2:
      "Klik op de knop hieronder om je account in te stellen en te beginnen.",
    cta: "Account Instellen",
    footer:
      "Deze uitnodigingslink verloopt over 72 uur. Als je deze uitnodiging niet verwachtte, kun je deze e-mail veilig negeren.",
  },
};

/** Check the active email provider. Logs the outcome and throws when no
 *  provider is configured or the SMTP connection fails, so callers (the admin
 *  test endpoint) can report a broken config. The startup call swallows it. */
export async function verifySmtp(): Promise<void> {
  if (useResend()) {
    console.log(`[email] Resend enabled, sending as ${process.env.RESEND_FROM || "onboarding@resend.dev"}${smtpConfigured() ? " (SMTP fallback ready)" : ""}`);
    return;
  }
  if (!smtpConfigured()) {
    console.warn("[email] SMTP_USER/SMTP_PASS not set and Resend not enabled: email sending disabled.");
    throw new Error("Email is not configured");
  }
  try {
    await transporter.verify();
    console.log(`[email] SMTP connected, sending as ${process.env.SMTP_USER}`);
  } catch (err: any) {
    console.error(`[email] SMTP connection failed: ${err.message}`);
    console.error("[email] Check SMTP_USER, SMTP_PASS, and that Gmail 2FA + App Passwords are enabled.");
    throw err;
  }
}

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<DeliveryResult> {
  return deliver(opts);
}

/** Returns the delivery result, or null when email is not configured (dev
 *  mode: the link is logged instead). Throws when delivery failed. */
export async function sendInviteEmail(params: {
  to: string;
  inviteLink: string;
  role: string;
  invitedBy: string;
  lang?: Lang;
}): Promise<DeliveryResult | null> {
  const t = TRANSLATIONS[params.lang ?? "en"] ?? TRANSLATIONS.en;
  if (!emailConfigured()) {
    console.log(`[email] Email not configured, skipping send.`);
    console.log(`[email] Would send invite to: ${params.to}`);
    console.log(`[email] Link: ${params.inviteLink}`);
    return null;
  }
  return deliver({
    to: params.to,
    subject: t.subject,
    html: buildInviteHtml(params, t),
    text: buildInviteText(params, t),
  });
}

type InviteParams = { to: string; inviteLink: string; role: string; invitedBy: string; lang?: Lang };

function buildInviteHtml(params: InviteParams, t: Translations): string {
  // Body line with bold, HTML-escaped invitedBy and role (both can come from
  // user input, so they must never reach the markup raw).
  const htmlLine = t.bodyLine1(
    `<strong style="color:${T.ink};">${escapeHtml(params.invitedBy)}</strong>`,
    `<strong style="color:${T.ink};">${escapeHtml(params.role)}</strong>`,
  );
  return renderEmailLayout({
    lang: params.lang ?? "en",
    preheader: `${t.bodyLine1(params.invitedBy, params.role)}.`,
    heading: t.heading,
    bodyHtml: emailParagraph(`${htmlLine}.`) + emailParagraph(escapeHtml(t.bodyLine2), { muted: true }),
    cta: { label: t.cta, url: params.inviteLink },
    footerNote: t.footer,
  });
}

function buildInviteText(params: InviteParams, t: Translations): string {
  return renderEmailText({
    heading: t.heading,
    bodyText: `${t.bodyLine1(params.invitedBy, params.role)}.\n\n${t.bodyLine2}`,
    cta: { label: t.cta, url: params.inviteLink },
    footerNote: t.footer,
  });
}
