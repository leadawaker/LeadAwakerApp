/** Emails sent by the 2FA feature: sign-in code, backup-code-used notice, admin-reset notice. */
import crypto from "crypto";
import type { Users } from "@shared/schema";
import { EMAIL_THEME as T_, sendRawEmail, escapeHtml, renderEmailLayout, renderEmailText, emailParagraph } from "../email";
import { hmacHex } from "./crypto";

type Lang = "en" | "nl" | "pt";

function userLang(user: Users): Lang {
  try {
    const l = JSON.parse(user.preferences || "{}")?.language;
    if (typeof l === "string") {
      const short = l.slice(0, 2).toLowerCase();
      if (short === "nl" || short === "pt") return short;
    }
  } catch { /* fall through */ }
  return "en";
}

const T = {
  code: {
    en: { subject: "Your Lead Awaker sign-in code", heading: "Your sign-in code", eyebrow: "Security", intro: "Use this code to finish signing in. It is valid for 10 minutes and works once.", ignore: "If this was not you, someone knows your password. Change it as soon as you can.", pre: "Your sign-in code" },
    nl: { subject: "Je inlogcode voor Lead Awaker", heading: "Je inlogcode", eyebrow: "Beveiliging", intro: "Gebruik deze code om het inloggen af te ronden. De code is 10 minuten geldig en werkt één keer.", ignore: "Was jij dit niet? Dan kent iemand je wachtwoord. Wijzig het zo snel mogelijk.", pre: "Je inlogcode" },
    pt: { subject: "Seu código de acesso ao Lead Awaker", heading: "Seu código de acesso", eyebrow: "Segurança", intro: "Use este código para concluir o login. Ele vale por 10 minutos e funciona uma vez.", ignore: "Se não foi você, alguém sabe a sua senha. Troque-a o quanto antes.", pre: "Seu código de acesso" },
  },
  backup: {
    en: { subject: "A backup code was used on your account", heading: "Backup code used", eyebrow: "Security", body: "One of your two-factor backup codes was just used to sign in to your Lead Awaker account.", ignore: "If this was not you, change your password now and generate new backup codes in Settings." },
    nl: { subject: "Er is een back-upcode gebruikt op je account", heading: "Back-upcode gebruikt", eyebrow: "Beveiliging", body: "Een van je back-upcodes voor tweestapsverificatie is zojuist gebruikt om in te loggen op je Lead Awaker-account.", ignore: "Was jij dit niet? Wijzig dan direct je wachtwoord en maak nieuwe back-upcodes aan in Instellingen." },
    pt: { subject: "Um código de backup foi usado na sua conta", heading: "Código de backup usado", eyebrow: "Segurança", body: "Um dos seus códigos de backup da verificação em duas etapas acabou de ser usado para entrar na sua conta do Lead Awaker.", ignore: "Se não foi você, troque a senha agora e gere novos códigos de backup em Configurações." },
  },
  reset: {
    en: { subject: "Two-factor authentication was reset on your account", heading: "Two-factor reset", eyebrow: "Security", body: "An administrator reset two-factor authentication on your Lead Awaker account. You can now sign in with your password only. You can set it up again in Settings.", ignore: "If you did not ask for this, contact us right away." },
    nl: { subject: "Tweestapsverificatie is gereset op je account", heading: "Tweestapsverificatie gereset", eyebrow: "Beveiliging", body: "Een beheerder heeft de tweestapsverificatie op je Lead Awaker-account gereset. Je kunt nu alleen met je wachtwoord inloggen. In Instellingen kun je het opnieuw instellen.", ignore: "Heb je hier niet om gevraagd? Neem dan direct contact met ons op." },
    pt: { subject: "A verificação em duas etapas foi redefinida na sua conta", heading: "Verificação em duas etapas redefinida", eyebrow: "Segurança", body: "Um administrador redefiniu a verificação em duas etapas da sua conta do Lead Awaker. Agora você entra só com a senha. Você pode configurá-la de novo em Configurações.", ignore: "Se você não pediu isso, fale conosco imediatamente." },
  },
} as const;

export function generateEmailCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailCode(userId: number, code: string): string {
  return hmacHex(`email:${userId}:${code}`);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

async function sendNotice(user: Users, body: string, subject: string, heading: string, eyebrow: string, bodyHtml: string, lang: Lang) {
  if (!user.email) return;
  await sendRawEmail({
    to: user.email,
    subject,
    text: renderEmailText({ heading, bodyText: body }),
    html: renderEmailLayout({ preheader: heading, eyebrow, heading, bodyHtml, lang }),
  });
}

export async function sendSignInCodeEmail(user: Users, code: string): Promise<void> {
  const lang = userLang(user);
  const t = T.code[lang];
  const codeHtml = `<p style="margin:6px 0 22px;font-family:${T_.sans};font-size:34px;font-weight:700;letter-spacing:.32em;color:${T_.wineDeep};">${escapeHtml(code)}</p>`;
  await sendNotice(
    user, `${t.intro}\n\n${code}\n\n${t.ignore}`, t.subject, t.heading, t.eyebrow,
    emailParagraph(escapeHtml(t.intro)) + codeHtml + emailParagraph(escapeHtml(t.ignore), { muted: true }), lang,
  );
}

export async function sendBackupCodeUsedEmail(user: Users): Promise<void> {
  const lang = userLang(user);
  const t = T.backup[lang];
  await sendNotice(user, `${t.body}\n\n${t.ignore}`, t.subject, t.heading, t.eyebrow,
    emailParagraph(escapeHtml(t.body)) + emailParagraph(escapeHtml(t.ignore), { muted: true }), lang);
}

export async function sendTwoFactorResetEmail(user: Users): Promise<void> {
  const lang = userLang(user);
  const t = T.reset[lang];
  await sendNotice(user, `${t.body}\n\n${t.ignore}`, t.subject, t.heading, t.eyebrow,
    emailParagraph(escapeHtml(t.body)) + emailParagraph(escapeHtml(t.ignore), { muted: true }), lang);
}
