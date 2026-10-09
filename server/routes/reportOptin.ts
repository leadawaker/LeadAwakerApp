import type { Express, Request } from "express";
import { and, eq, or, sql } from "drizzle-orm";
import { prospects } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { sendRawEmail, escapeHtml, renderEmailLayout, renderEmailText, emailParagraph } from "../email";
import { wrapAsync } from "./_helpers";

// ─── "The Report" lead magnet opt-in (public) ────────────────────────────
// leadawaker.com/report → popup form → POST here. The person lands in the
// agency's Prospects pipeline (account 1), gets the PDF link by email, and the
// agency users get an in-app notification. The website calls the relative
// /api path, which Vercel forwards to api.leadawaker.com, so no CORS needed.

const AGENCY_ACCOUNT_ID = 1;
const SOURCE = "Report download";
const NOTIFICATION_TYPE = "report_download";
const MAX = { firstName: 80, email: 254 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// Links in the email point back at whichever of our hosts the form was sent
// from, so a test on app.leadawaker.com gets working links before a deploy.
const SITE_ORIGINS = new Set([
  "https://www.leadawaker.com",
  "https://leadawaker.com",
  "https://app.leadawaker.com",
]);
const DEFAULT_ORIGIN = "https://www.leadawaker.com";

// Each language has its own PDF, Leak Audit page and email (Dutch and
// Brazilian Portuguese editions: script/report/lang/).
type Lang = "en" | "nl" | "pt";
type Copy = {
  label: string; pdf: string; audit: string; subject: string; heading: (name: string) => string; cta: string;
  intro: string; chapter: [string, string]; auditLine: [string, string]; sign: string; footer: string; preheader: string; eyebrow: string;
};
const COPY: Record<Lang, Copy> = {
  en: {
    label: "English", pdf: "/site/the-report.pdf", audit: "/audit",
    subject: "Your copy of The Report",
    heading: n => `Here's your Report, ${n}`,
    cta: "Download The Report (PDF)",
    intro: "Thanks for asking for The Report. It's 25 pages, and you can read the headlines alone in five minutes.",
    chapter: ["If you only read one chapter, make it ", "Leak 01 on page 6. The missed call is the leak almost every business has, and the easiest one to plug."],
    auditLine: ["When you're done, run your own numbers in the ", "Leak Audit. Two minutes, and it tells you which leak is costing you most."],
    sign: "Gabriel, founder of Lead Awaker",
    footer: "You're getting this because you asked for The Report on leadawaker.com. Just reply if you have a question; it comes straight to me.",
    preheader: "The four places service businesses leak revenue, and how to plug each one.",
    eyebrow: "The Report · 2026 edition",
  },
  nl: {
    label: "Dutch", pdf: "/site/het-rapport.pdf", audit: "/nl/lekcheck",
    subject: "Je exemplaar van Het Rapport",
    heading: n => `Hier is je Rapport, ${n}`,
    cta: "Download Het Rapport (pdf)",
    intro: "Bedankt voor je aanvraag. Het Rapport telt 25 pagina's, en alleen de koppen lees je al in vijf minuten.",
    chapter: ["Lees je maar één hoofdstuk, maak het dan ", "Lek 01 op pagina 6. Het gemiste telefoontje is het lek dat bijna elk bedrijf heeft, en het makkelijkst te dichten."],
    auditLine: ["Klaar met lezen? Reken dan je eigen cijfers door in de ", "Lekcheck. Twee minuten, en je ziet welk lek jou het meest kost."],
    sign: "Gabriel, oprichter van Lead Awaker",
    footer: "Je krijgt deze mail omdat je Het Rapport hebt aangevraagd op leadawaker.com. Vragen? Beantwoord gewoon deze mail, dan komt hij direct bij mij.",
    preheader: "De vier lekken waardoor dienstverleners omzet mislopen, en hoe je ze dicht.",
    eyebrow: "Het Rapport · editie 2026",
  },
  pt: {
    label: "Portuguese", pdf: "/site/o-relatorio.pdf", audit: "/pt/raio-x",
    subject: "O seu exemplar de O Relatório",
    heading: n => `Aqui está o seu Relatório, ${n}`,
    cta: "Baixar O Relatório (PDF)",
    intro: "Obrigado por pedir O Relatório. São 25 páginas, e só os títulos você lê em cinco minutos.",
    chapter: ["Se for ler um capítulo só, leia o ", "Vazamento 01, na página 6. A ligação perdida é o vazamento que quase toda empresa tem, e o mais fácil de tapar."],
    auditLine: ["Depois, faça as suas contas no ", "Raio-X dos Vazamentos. Dois minutos, e você vê qual vazamento sai mais caro."],
    sign: "Gabriel, fundador da Lead Awaker",
    footer: "Você recebeu este e-mail porque pediu O Relatório em leadawaker.com. Tem alguma dúvida? É só responder, chega direto para mim.",
    preheader: "Os quatro furos por onde o faturamento de uma empresa de serviços escorre, e como tapar cada um.",
    eyebrow: "O Relatório · edição 2026",
  },
};
const toLang = (v: unknown): Lang => (v === "nl" || v === "pt" ? v : "en");

// In-memory per-IP limiter, same approach as the contact form: 5 per hour.
const attempts = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const recent = (attempts.get(ip) || []).filter(t => now - t < window);
  if (recent.length >= 5) {
    attempts.set(ip, recent);
    return false;
  }
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) {
    for (const [key, times] of attempts) {
      if (!times.some(t => now - t < window)) attempts.delete(key);
    }
  }
  return true;
}

function siteOrigin(req: Request): string {
  const origin = String(req.get("origin") || "").replace(/\/$/, "");
  return SITE_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
}

async function upsertProspect(firstName: string, email: string, consent: boolean, lang: Lang): Promise<{ id: number; isNew: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  const line = `${today}: downloaded The Report (${COPY[lang].label}). Follow-up emails: ${consent ? "yes, consented on the form" : "no"}.`;
  const lower = email.toLowerCase();

  const [existing] = await db
    .select({ id: prospects.id, notes: prospects.notes })
    .from(prospects)
    .where(
      and(
        eq(prospects.accountsId, AGENCY_ACCOUNT_ID),
        or(sql`lower(${prospects.email}) = ${lower}`, sql`lower(${prospects.contactEmail}) = ${lower}`),
      ),
    )
    .limit(1);

  if (existing) {
    await storage.updateProspect(existing.id, {
      notes: existing.notes ? `${existing.notes}\n${line}` : line,
      updatedAt: new Date(),
    } as any);
    return { id: existing.id, isNew: false };
  }

  const row = await storage.createProspect({
    name: firstName,
    contactName: firstName,
    email,
    contactEmail: email,
    source: SOURCE,
    status: "New",
    notes: line,
    accountsId: AGENCY_ACCOUNT_ID,
  } as any);
  return { id: row.id, isNew: true };
}

async function sendReport(firstName: string, email: string, origin: string, lang: Lang): Promise<void> {
  const c = COPY[lang];
  const pdfUrl = `${origin}${c.pdf}`;
  const auditUrl = `${origin}${c.audit}`;
  const heading = c.heading(firstName);
  const cta = { label: c.cta, url: pdfUrl };
  const [chapterLead, chapterRest] = c.chapter;
  const [auditLead, auditRest] = c.auditLine;
  const [chapterBold, ...chapterTail] = chapterRest.split(". ");
  const [auditName, ...auditTail] = auditRest.split(". ");
  const bodyText = [
    c.intro,
    `${chapterLead}${chapterRest}`,
    `${auditLead}${auditName}: ${auditUrl}`,
    c.sign,
  ].join("\n\n");
  const bodyHtml = [
    emailParagraph(escapeHtml(c.intro)),
    emailParagraph(`${escapeHtml(chapterLead)}<strong>${escapeHtml(chapterBold)}</strong>. ${escapeHtml(chapterTail.join(". "))}`),
    emailParagraph(`${escapeHtml(auditLead)}<a href="${escapeHtml(auditUrl)}">${escapeHtml(auditName)}</a>. ${escapeHtml(auditTail.join(". "))}`),
    emailParagraph(escapeHtml(c.sign), { muted: true }),
  ].join("");

  await sendRawEmail({
    to: email,
    subject: c.subject,
    text: renderEmailText({ heading, bodyText, cta, footerNote: c.footer }),
    html: renderEmailLayout({
      preheader: c.preheader,
      eyebrow: c.eyebrow,
      heading,
      bodyHtml,
      cta,
      footerNote: c.footer,
    }),
    replyTo: "gabriel@leadawaker.com",
  });
}

async function notifyAgency(firstName: string, email: string, prospectId: number, isNew: boolean, consent: boolean, lang: Lang): Promise<void> {
  const users = (await storage.getAppUsers()).filter((u: any) => u.accountsId === AGENCY_ACCOUNT_ID);
  for (const user of users) {
    try {
      await createAndDispatchNotification({
        type: NOTIFICATION_TYPE,
        title: `${firstName} downloaded The Report${lang === "en" ? "" : ` (${COPY[lang].label})`}`,
        body: `${email}${isNew ? "" : " (already a prospect)"}${consent ? " · wants follow-up emails" : ""}`,
        userId: user.id!,
        accountId: AGENCY_ACCOUNT_ID,
        read: false,
        link: `/platform/prospects/${prospectId}`,
      } as any);
    } catch (err: any) {
      console.error(`[report-optin] notify user ${user.id} failed:`, err.message);
    }
  }
}

export function registerReportOptinRoutes(app: Express): void {
  app.post("/api/report/optin", wrapAsync(async (req, res) => {
    const ip = String(req.get("x-forwarded-for") || "").split(",")[0].trim() || req.ip || "unknown";
    if (!allow(ip)) return res.status(429).json({ message: "Too many requests. Please try again later." });

    const { firstName, email, consent, website, lang: rawLang } = req.body ?? {};
    const lang = toLang(rawLang);
    // Honeypot: real people never see or fill this field. Pretend it worked.
    if (typeof website === "string" && website.trim()) return res.json({ ok: true });

    if (typeof firstName !== "string" || typeof email !== "string") {
      return res.status(400).json({ message: "First name and email are required." });
    }
    const cleanName = firstName.replace(/[\r\n<>]+/g, " ").trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail) return res.status(400).json({ message: "First name and email are required." });
    if (cleanName.length > MAX.firstName || cleanEmail.length > MAX.email) return res.status(400).json({ message: "That's a bit long. Please shorten it." });
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ message: "That email address doesn't look right." });
    const wantsFollowUp = consent === true;

    const { id, isNew } = await upsertProspect(cleanName, cleanEmail, wantsFollowUp, lang);

    // Email and notifications must not fail the opt-in: the thank-you page
    // offers the download directly, so the person always gets the PDF.
    try {
      await sendReport(cleanName, cleanEmail, siteOrigin(req), lang);
    } catch (err: any) {
      console.error("[report-optin] email failed:", err.message);
    }
    notifyAgency(cleanName, cleanEmail, id, isNew, wantsFollowUp, lang).catch(err =>
      console.error("[report-optin] notify failed:", err.message),
    );

    res.json({ ok: true });
  }));
}
