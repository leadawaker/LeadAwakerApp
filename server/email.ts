import nodemailer from "nodemailer";

/** Hosted email images (client/public/site/img/email). Must be absolute https
 *  URLs: Gmail blocks SVG and data URIs. The Pi serves client/public live, so
 *  app.leadawaker.com works without a Vercel deploy. */
export const EMAIL_ASSET_BASE = process.env.EMAIL_ASSET_BASE || "https://app.leadawaker.com/site/img/email";
/** Bump when an image changes under the same name: Gmail's image proxy and
 *  Cloudflare both cache by URL. */
const EMAIL_ASSET_VERSION = "9";
export const emailAsset = (file: string) => `${EMAIL_ASSET_BASE}/${file}?v=${EMAIL_ASSET_VERSION}`;
/** Wordmark PNG: the homepage logo (white LEAD with its soft shadow), transparent. */
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || emailAsset("logo.png");
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
  /** Resend only (kept 24h): a retry with the same key cannot send twice. */
  idempotencyKey?: string;
}

export interface DeliveryResult {
  provider: "resend" | "smtp";
  id?: string;
}

/** `maybeSent`: a timeout, a 5xx, or 409 (the same key still in flight). The email may be out. */
class ResendError extends Error {
  constructor(message: string, public maybeSent: boolean) { super(message); }
}

async function deliverViaResend(msg: Outgoing): Promise<DeliveryResult> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Lead Awaker <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo || undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err: any) {
    throw new ResendError(`Resend unreachable: ${err?.message ?? err}`, true);
  }
  if (!res.ok) {
    throw new ResendError(`Resend ${res.status}: ${await res.text()}`, res.status === 409 || res.status >= 500);
  }
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
    // With a key the caller retries through Resend, which dedupes. SMTP would
    // send a second copy of an email Resend may already have sent.
    if (msg.idempotencyKey && resendErr instanceof ResendError && resendErr.maybeSent) throw resendErr;
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
// homepage (client/public/site): bone surfaces, deep wine accent, Playfair
// Display for titles only, Manrope for everything else. Email-client safe:
// tables, inline styles, web-safe font fallbacks, light only (no reliance on
// dark mode).

export const EMAIL_THEME = {
  bg: "#CEC5B5", // dark cream around the email; image corners are flattened onto it
  body: "#F3EFE7", // the email itself (bone); the footer image fades into it
  card: "#FDFCFA", // section cards, a shade off white
  head: "#E5DDCF", // header panel, lighter than the page; the header image fades into it
  surface: "#F6F2EC", // tinted rows inside a card
  line: "#E8E2D7",
  ink: "#1F1A14",
  inkSoft: "#3A322A",
  mute: "#6C6354",
  mute2: "#948A77",
  wine: "#5E2230",
  wineDeep: "#4E1B27", // headings
  edge: "#BFB6A5", // outline of the email on the dark cream background
  onWine: "#F7F1E6",
  sans: "Manrope,'Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "'Playfair Display',Georgia,'Times New Roman',serif",
} as const;
const T = EMAIL_THEME;

/** Header and footer illustrations. Instant alerts use their own set so they
 *  do not look like the daily recap. */
const EMAIL_ART = {
  default: { side: "header-side.jpg", strip: "header-strip.jpg", footer: "footer.jpg" },
  alert: { side: "alert-header-side.jpg", strip: "alert-header-strip.jpg", footer: "alert-footer.jpg" },
} as const;

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
  /** Line under the heading in the header panel (plain text, escaped here). */
  subheading?: string;
  /** Date shown in small capitals at the bottom of the header (plain text). */
  dateText?: string;
  /** Which illustrations to use (default: the recap set). */
  art?: keyof typeof EMAIL_ART;
  /** Trusted HTML: escape every dynamic value before passing it in. Build it
   *  from emailParagraph and the blocks in emailComponents.ts so the styling stays consistent. */
  bodyHtml: string;
  cta?: EmailCta;
  /** Small print at the bottom of the card (plain text, escaped here). */
  footerNote?: string;
  /** Link under the small print, e.g. to the email settings. */
  footerLink?: EmailCta;
  /** Value for the html lang attribute. */
  lang?: string;
}

/** Body paragraph in the brand style. `html` must already be escaped. */
export function emailParagraph(html: string, opts: { muted?: boolean } = {}): string {
  const size = opts.muted ? 13 : 14.5;
  const color = opts.muted ? T.mute : T.inkSoft;
  return `<p style="margin:0 0 16px;font-family:${T.sans};font-size:${size}px;line-height:1.65;color:${color};">${html}</p>`;
}

/** Bulletproof pill button, centred: the colour sits on the cell, so it
 *  survives clients that strip padding or backgrounds from links. */
function emailButton(cta: EmailCta): string {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${T.wine}" style="border-radius:999px;background-color:${T.wine};">
      <a href="${escapeHtml(cta.url)}" target="_blank" style="display:block;padding:12px 34px;font-family:${T.sans};font-size:13.5px;font-weight:600;line-height:20px;color:${T.onWine};text-decoration:none;border:1px solid ${T.wine};border-radius:999px;">${escapeHtml(cta.label)}&nbsp;&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

/** Header panel: logo, eyebrow, heading, subheading and date as live text on
 *  the left, the illustration (its left edge fades into the panel colour) on
 *  the right. Phones get a wide strip of the same illustration above the text. */
function emailHeader(opts: EmailLayoutOptions): string {
  const art = EMAIL_ART[opts.art ?? "default"];
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 7px;font-family:${T.sans};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;line-height:1.4;color:${T.mute};">${escapeHtml(opts.eyebrow)}</p>`
    : "";
  const sub = opts.subheading
    ? `<p style="margin:8px 0 0;font-family:${T.sans};font-size:10px;line-height:1.55;color:${T.mute};">${escapeHtml(opts.subheading)}</p>`
    : "";
  const date = opts.dateText
    ? `<p style="margin:14px 0 0;font-family:${T.sans};font-size:7.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;line-height:12px;color:${T.mute2};">${escapeHtml(opts.dateText)}</p>`
    : "";
  return `<tr><td class="la-show-sm" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:0;line-height:0;">
  <img src="${emailAsset(art.strip)}" width="638" alt="" style="display:block;width:100%;max-width:638px;height:auto;border:0;border-radius:13px 13px 0 0;">
</td></tr>
<tr><td class="la-head-wrap" bgcolor="${T.head}" style="background-color:${T.head};border-radius:13px 13px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="la-head" valign="middle" style="padding:22px 0 22px 30px;">
      <a href="${SITE_URL}" target="_blank" style="text-decoration:none;"><img src="${EMAIL_LOGO_URL}" width="150" height="26" alt="Lead Awaker" style="display:block;width:150px;max-width:150px;height:auto;border:0;"></a>
      <div style="height:26px;line-height:26px;font-size:26px;">&nbsp;</div>
      ${eyebrow}
      <h1 class="la-h1" style="margin:0;font-family:${T.serif};font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-.015em;color:${T.wineDeep};">${escapeHtml(opts.heading)}</h1>
      ${sub}
      ${date}
    </td>
    <td class="la-hide-sm" width="330" valign="top" style="width:330px;border-radius:0 13px 0 0;font-size:0;line-height:0;">
      <img src="${emailAsset(art.side)}" width="330" height="240" alt="" style="display:block;width:330px;height:240px;border:0;border-radius:0 13px 0 0;">
    </td>
  </tr></table>
</td></tr>`;
}

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const heading = escapeHtml(opts.heading);
  // Trailing filler keeps the client from pulling body text into the preview.
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${T.bg};">${escapeHtml(opts.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`
    : "";
  const cta = opts.cta
    ? `<tr><td class="la-pad" style="padding:12px 28px 4px;">${emailButton(opts.cta)}</td></tr>`
    : "";
  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 8px;font-family:${T.sans};font-size:11px;line-height:1.6;color:${T.mute2};">${escapeHtml(opts.footerNote)}</p>`
    : "";
  const footerLink = opts.footerLink
    ? `<p style="margin:0 0 10px;font-family:${T.sans};font-size:11px;font-weight:600;line-height:1.6;"><a href="${escapeHtml(opts.footerLink.url)}" target="_blank" style="color:${T.wine};text-decoration:underline;">${escapeHtml(opts.footerLink.label)}</a></p>`
    : "";
  const footerArt = EMAIL_ART[opts.art ?? "default"].footer;

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
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${T.wine}; }
  @media only screen and (max-width:660px) {
    .la-outer { padding:12px 8px !important; }
    .la-pad { padding-left:14px !important; padding-right:14px !important; }
    .la-head { padding:20px 18px 24px !important; }
    .la-h1 { font-size:30px !important; }
    .la-head-wrap { border-radius:0 !important; }
    .la-hide-sm { display:none !important; width:0 !important; }
    .la-show-sm { display:block !important; max-height:none !important; overflow:visible !important; }
    .la-tile-row { display:block !important; text-align:center !important; }
    .la-tile { display:inline-block !important; box-sizing:border-box !important; width:30.5% !important; height:92px !important; margin:0 1% 7px !important; vertical-align:top !important; text-align:left !important; }
    .la-tgap { display:none !important; }
    .la-col { display:block !important; width:auto !important; }
    .la-gap { display:block !important; width:auto !important; height:14px !important; line-height:14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bg}" style="background-color:${T.bg};">
  <tr>
    <td class="la-outer" align="center" style="padding:28px 12px;">
      <!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
        <tr>
          <td bgcolor="${T.body}" style="background-color:${T.body};border:1px solid ${T.edge};border-radius:14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${emailHeader(opts)}
              <tr>
                <td class="la-pad" style="padding:26px 28px 14px;">
                  ${opts.bodyHtml}
                </td>
              </tr>
              ${cta}
              <tr>
                <td class="la-pad" align="center" style="padding:26px 28px 8px;">
                  <div style="border-top:1px solid ${T.line};height:20px;line-height:20px;font-size:20px;">&nbsp;</div>
                  ${footerNote}
                  ${footerLink}
                  <p style="margin:0;font-family:${T.sans};font-size:11px;line-height:1.6;color:${T.mute2};"><strong style="font-weight:700;color:${T.mute};">Lead Awaker</strong> &middot; <a href="${SITE_URL}" target="_blank" style="color:${T.mute2};text-decoration:none;">leadawaker.com</a></p>
                </td>
              </tr>
              <tr>
                <td style="font-size:0;line-height:0;border-radius:0 0 13px 13px;">
                  <img src="${emailAsset(footerArt)}" width="638" alt="" style="display:block;width:100%;max-width:638px;height:auto;border:0;border-radius:0 0 13px 13px;">
                </td>
              </tr>
            </table>
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
  footerLink?: EmailCta;
}): string {
  const parts = [opts.heading, opts.bodyText.trim()];
  if (opts.cta) parts.push(`${opts.cta.label}: ${opts.cta.url}`);
  if (opts.footerNote) parts.push(opts.footerNote);
  if (opts.footerLink) parts.push(`${opts.footerLink.label}: ${opts.footerLink.url}`);
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
  idempotencyKey?: string;
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
