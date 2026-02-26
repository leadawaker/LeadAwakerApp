import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOGO_CID = "logo@leadawaker.com";
const logoPath = join(__dirname, "../client/src/assets/Lead_Awaker_side_logo.png");
const logoBuffer = (() => {
  try { return readFileSync(logoPath); } catch { return null; }
})();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || "Lead Awaker <admin@leadawaker.com>";

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

/** Call once at server startup to verify SMTP credentials are working. */
export async function verifySmtp(): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP_USER/SMTP_PASS not set — email sending disabled.");
    return;
  }
  try {
    await transporter.verify();
    console.log(`[email] SMTP connected — sending as ${process.env.SMTP_USER}`);
  } catch (err: any) {
    console.error(`[email] SMTP connection failed: ${err.message}`);
    console.error("[email] Check SMTP_USER, SMTP_PASS, and that Gmail 2FA + App Passwords are enabled.");
  }
}

export async function sendInviteEmail(params: {
  to: string;
  inviteLink: string;
  role: string;
  invitedBy: string;
  lang?: Lang;
}): Promise<void> {
  const t = TRANSLATIONS[params.lang ?? "en"];
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[email] SMTP not configured — skipping send.`);
    console.log(`[email] Would send invite to: ${params.to}`);
    console.log(`[email] Link: ${params.inviteLink}`);
    return;
  }
  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: t.subject,
    html: buildInviteHtml(params, t),
    text: buildInviteText(params, t),
    attachments: logoBuffer ? [{
      filename: "logo.png",
      content: logoBuffer,
      contentType: "image/png",
      cid: LOGO_CID,
    }] : [],
  });
}

function buildInviteHtml(
  params: { to: string; inviteLink: string; role: string; invitedBy: string },
  t: Translations
): string {
  // Build the body line with bold wrapping for invitedBy and role.
  // Get the plain sentence then replace the first occurrence of invitedBy
  // with a bold-wrapped version, and role with a bold-wrapped version.
  const plainLine = t.bodyLine1(params.invitedBy, params.role);
  const htmlLine = plainLine
    .replace(params.invitedBy, `<strong>${params.invitedBy}</strong>`)
    .replace(params.role, `<strong>${params.role}</strong>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#131B49;padding:20px 40px;">
              <img src="cid:${LOGO_CID}" alt="Lead Awaker" width="220" height="auto"
                   style="display:block;max-height:52px;width:auto;object-fit:contain;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#131B49;font-size:20px;font-weight:700;">${t.heading}</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                ${htmlLine}.
              </p>
              <p style="margin:0 0 32px;color:#6b7280;font-size:14px;line-height:1.6;">
                ${t.bodyLine2}
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#4F46E5;">
                    <a href="${params.inviteLink}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.1px;">
                      ${t.cta}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                ${t.footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInviteText(
  params: { to: string; inviteLink: string; role: string; invitedBy: string },
  t: Translations
): string {
  return `${t.heading}

${t.bodyLine1(params.invitedBy, params.role)}.

${t.bodyLine2}
${params.inviteLink}

${t.footer}

— Lead Awaker
`;
}
