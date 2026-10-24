/** The "reset your password" email: branded layout, copy in en/nl/pt. */
import { sendRawEmail, renderEmailLayout, renderEmailText, emailParagraph, escapeHtml } from "./email";
import type { ResetLang } from "./passwordReset";

interface ResetCopy {
  subject: string;
  heading: string;
  line1: string;
  line2: string;
  cta: string;
  footer: string;
}

const COPY: Record<ResetLang, ResetCopy> = {
  en: {
    subject: "Reset your Lead Awaker password",
    heading: "Reset your password",
    line1: "We received a request to reset the password for your Lead Awaker account.",
    line2: "Click the button below to choose a new password.",
    cta: "Choose a New Password",
    footer: "This link expires in 1 hour and can be used once. If you did not request this, you can safely ignore this email: your password will not change.",
  },
  nl: {
    subject: "Stel je Lead Awaker-wachtwoord opnieuw in",
    heading: "Wachtwoord opnieuw instellen",
    line1: "We hebben een verzoek ontvangen om het wachtwoord van je Lead Awaker-account opnieuw in te stellen.",
    line2: "Klik op de knop hieronder om een nieuw wachtwoord te kiezen.",
    cta: "Nieuw Wachtwoord Kiezen",
    footer: "Deze link verloopt over 1 uur en werkt één keer. Als je dit niet hebt aangevraagd, kun je deze e-mail veilig negeren: je wachtwoord verandert niet.",
  },
  pt: {
    subject: "Redefina sua senha do Lead Awaker",
    heading: "Redefina sua senha",
    line1: "Recebemos um pedido para redefinir a senha da sua conta do Lead Awaker.",
    line2: "Clique no botão abaixo para escolher uma nova senha.",
    cta: "Escolher Nova Senha",
    footer: "Este link expira em 1 hora e só pode ser usado uma vez. Se você não pediu isso, ignore este e-mail: sua senha não será alterada.",
  },
};

/** Subject, HTML and plain text for one language (pure, so it can be rendered without sending). */
export function buildResetEmail(lang: ResetLang, resetUrl: string): { subject: string; html: string; text: string } {
  const c = COPY[lang] ?? COPY.en;
  const cta = { label: c.cta, url: resetUrl };
  return {
    subject: c.subject,
    html: renderEmailLayout({
      lang,
      preheader: c.line1,
      heading: c.heading,
      bodyHtml: emailParagraph(escapeHtml(c.line1)) + emailParagraph(escapeHtml(c.line2), { muted: true }),
      cta,
      footerNote: c.footer,
    }),
    text: renderEmailText({ heading: c.heading, bodyText: `${c.line1}\n\n${c.line2}`, cta, footerNote: c.footer }),
  };
}

/** Throws when delivery fails. The link is never logged. */
export async function sendPasswordResetEmail(to: string, lang: ResetLang, resetUrl: string): Promise<void> {
  const mail = buildResetEmail(lang, resetUrl);
  await sendRawEmail({ to, ...mail });
}
