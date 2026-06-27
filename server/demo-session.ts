import crypto from "crypto";
import { db } from "./db";
import { leads, campaigns, promptLibrary } from "@shared/schema";
import { eq } from "drizzle-orm";

export const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

/** Scenario picked on the homepage toggle. Maps onto Prompt 93's lead_stage. */
export type DemoScenario = "inquired" | "deciding" | "declined";

/** Canonical English phrasing per scenario; derive_lead_stage (engine) keys off these. */
const SCENARIO_WHAT_LEAD_DID: Record<DemoScenario, string> = {
  inquired: "Inquired about a quote",
  deciding: "In the decision phase",
  declined: "Declined / went with another provider",
};

export interface NicheContext {
  raw: string;
  niche_label: string;
  company_name: string;
  service_name: string;
  usp: string;
  business_description: string;
  booking_mode_call: boolean;
  what_lead_did: string;
  when_label: string;
  niche_question: string;
  first_message: string;
  // Knowledge-base facts for the conversation prompt ({kb}).
  kb: string;
  // Per-niche vocabulary for Prompt 93 substitution.
  advisor_term: string;
  project_term: string;
  proposal_term: string;
  visit_term: string;
  // Reactivation context. lead_stage comes from the scenario toggle; the other
  // three are fixed demo defaults applied in code, not produced by the model.
  lead_stage: DemoScenario;
  inquiry_timeframe: string;
  first_touch: string;
  ai_style: string;
}

/** Localized "six months ago" default for {inquiry_timeframe}. */
const INQUIRY_TIMEFRAME_DEFAULT: Record<string, string> = {
  en: "six months ago",
  nl: "zes maanden geleden",
  pt: "seis meses atrás",
};

/**
 * Apply the fixed reactivation defaults Gabriel specified for the universal demo:
 * AI style = Practical, inquiry timeframe = six months ago, first touch = the
 * niche's own visit term (e.g. "showroom visit" for kitchens), and the chosen
 * scenario as both lead_stage and a canonical what_lead_did the engine can map.
 */
function applyDemoDefaults(ctx: NicheContext, language: string, scenario: DemoScenario): NicheContext {
  ctx.lead_stage = scenario;
  ctx.what_lead_did = SCENARIO_WHAT_LEAD_DID[scenario];
  ctx.inquiry_timeframe = INQUIRY_TIMEFRAME_DEFAULT[language] ?? INQUIRY_TIMEFRAME_DEFAULT.en;
  ctx.first_touch = ctx.visit_term || (language === "nl" ? "bezoek" : language === "pt" ? "visita" : "visit");
  ctx.ai_style = "Practical";
  return ctx;
}

const NICHE_GENERATOR_SYSTEM_FALLBACK = `You generate realistic demo context for a lead reactivation AI demo.
Given a business niche description, output a JSON object with these exact keys:
- company_name: a realistic local company name for that niche (e.g. "Huis & Haard Makelaars", "SolarMax NL")
- what_lead_did: what a typical lead for this niche would have done (e.g. "een afspraak had staan voor een tandartscontrole", "interesse had in zonnepanelen via onze website", "zich had ingeschreven voor een gratis proefles")
- when_label: a natural time reference (e.g. "een tijdje geleden", "some time ago", "há um tempo")
- niche_question: ONE sharp qualifying question that reconnects the lead with their original intent (e.g. "Heb je inmiddels een andere tandarts gevonden, of ben je nog op zoek?", "Are you still thinking about going solar this year?")
- niche_label: a short 1-2 word label for the niche in the output language (e.g. "real estate", "solar", "tandheelkunde")
- service_name: what this business wants the lead to buy (e.g. "solar panel installation", "a dental check-up")
- usp: the company's key value proposition in one short phrase
- business_description: 1-2 sentence company description referencing the USP
- kb: 4-6 concrete knowledge-base facts the AI should know (numbers, timelines, guarantees, objection rebuttals), newline-separated, NOT an array
- advisor_term: the human role a lead would book a call/appointment with for this niche (e.g. "solar advisor", "dental hygienist", "personal trainer", "kitchen designer")
- project_term: what the engagement is about (e.g. "solar installation", "dental treatment", "fitness plan", "kitchen")
- proposal_term: what this niche calls its offer document (e.g. "quote", "treatment plan", "membership offer", "design proposal")
- visit_term: the on-location first touch for this niche (e.g. "site visit", "clinic visit", "gym tour", "showroom visit")
- first_message: the Sophie opener — format exactly: "Hi, this is {agent_name} from [company_name]. Is this the same {first_name} who [what_lead_did] [when_label]?" — adapt to the output language (e.g. Dutch: "Hi, dit is {agent_name} van [company_name]. Ben jij dezelfde {first_name} die [what_lead_did] [when_label]?") — the name {first_name} appears ONLY ONCE in the identity question, never in the greeting

The advisor_term, project_term, proposal_term and visit_term MUST be in the output language and natural for the niche. Output language will be specified in the user message. Return ONLY valid JSON, no markdown.`;

export async function generateNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "inquired",
): Promise<NicheContext | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  const langLabel = { en: "English", nl: "Dutch", pt: "Portuguese" }[language];

  // Load system prompt from Prompt Library so it's editable from the UI.
  // Falls back to the hardcoded string if the DB entry is missing.
  let system = NICHE_GENERATOR_SYSTEM_FALLBACK;
  try {
    const [row] = await db
      .select({ promptText: promptLibrary.promptText })
      .from(promptLibrary)
      .where(eq(promptLibrary.useCase, "universal_demo_niche_generator"))
      .limit(1);
    if (row?.promptText) system = row.promptText;
  } catch {
    // silently fall back
  }
  system = system + `\n\nOutput language: ${langLabel}.`;

  // Hint the model so what_lead_did / first_message / niche_question match the
  // scenario the visitor chose. lead_stage itself is set authoritatively in code.
  const scenarioHint = {
    inquired: "The lead only INQUIRED and has NOT received a quote/proposal yet.",
    deciding: "The lead already received a quote/proposal and is actively deciding between options.",
    declined: "The lead leaned toward another provider or went quiet after comparing.",
  }[scenario];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Business niche: ${niche}\nOutput language: ${langLabel}\nLead scenario: ${scenarioHint}` },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw) as NicheContext;
    parsed.raw = niche;
    // Coerce kb from array to newline string if the model returned a list.
    if (Array.isArray((parsed as any).kb)) (parsed as any).kb = (parsed as any).kb.join("\n");
    // Ensure {agent_name} and {first_name} placeholders are present
    if (parsed.first_message && !parsed.first_message.includes("{agent_name}")) {
      parsed.first_message = parsed.first_message.replace(/\bSophie\b/, "{agent_name}");
    }
    if (parsed.first_message && !parsed.first_message.includes("{first_name}")) {
      // Try to replace a literal name in the "same <word> who/die/que" pattern first.
      // GPT sometimes writes "same Alex who" instead of "same {first_name} who".
      const fixed = parsed.first_message.replace(
        /\b(same|zelfde|mesmo|mesma)\s+\S+\s+(who|die|que)\b/gi,
        "$1 {first_name} $2",
      );
      if (fixed.includes("{first_name}")) {
        parsed.first_message = fixed;
      } else {
        parsed.first_message = parsed.first_message.trimEnd().replace(/\??\s*$/, "") +
          `, is this {first_name}?`;
      }
    }
    // Guarantee niche-term keys exist even if the model omitted them.
    parsed.advisor_term = (parsed.advisor_term || "").trim();
    parsed.project_term = (parsed.project_term || parsed.niche_label || niche).trim();
    parsed.proposal_term = (parsed.proposal_term || "").trim();
    parsed.visit_term = (parsed.visit_term || "").trim();
    parsed.kb = (parsed.kb || "").toString();
    return applyDemoDefaults(parsed, language, scenario);
  } catch {
    return null;
  }
}

export function buildFallbackNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
  scenario: DemoScenario = "inquired",
): NicheContext {
  const templates = {
    en: {
      first_message: `Hi, this is {agent_name} from our ${niche} team. Is this the same {first_name} who reached out about ${niche} recently?`,
      niche_question: `Are you still looking for ${niche} services?`,
    },
    nl: {
      first_message: `Hi, dit is {agent_name} van ons ${niche} team. Ben jij dezelfde {first_name} die onlangs contact had over ${niche}?`,
      niche_question: `Ben je nog op zoek naar ${niche} diensten?`,
    },
    pt: {
      first_message: `Oi, aqui é {agent_name} da nossa equipe de ${niche}. Você é o mesmo {first_name} que entrou em contato sobre ${niche} recentemente?`,
      niche_question: `Você ainda está procurando serviços de ${niche}?`,
    },
  };
  const t = templates[language] ?? templates.en;
  const visit = language === "nl" ? "bezoek" : language === "pt" ? "visita" : "visit";
  return applyDemoDefaults({
    raw: niche,
    company_name: "",
    service_name: niche,
    usp: "",
    business_description: "",
    booking_mode_call: true,
    what_lead_did: `showed interest in ${niche}`,
    when_label: language === "nl" ? "onlangs" : language === "pt" ? "recentemente" : "recently",
    niche_label: niche,
    niche_question: t.niche_question,
    first_message: t.first_message,
    kb: "",
    advisor_term: language === "nl" ? "adviseur" : language === "pt" ? "consultor" : "advisor",
    project_term: niche,
    proposal_term: language === "nl" ? "offerte" : language === "pt" ? "orçamento" : "quote",
    visit_term: visit,
    lead_stage: scenario,
    inquiry_timeframe: "",
    first_touch: "",
    ai_style: "",
  }, language, scenario);
}

export const DEMO_ACCOUNT_ID = 1;
export const DEMO_WHATSAPP_NUMBER = "+31627458300";

export const DEMO_CAMPAIGNS: Array<{ id: number; key: string; niche: string; emoji: string }> = [
  { id: 47, key: "solar", niche: "Solar installer follow-up", emoji: "☀️" },
  { id: 50, key: "coaching", niche: "Coaching enrollment", emoji: "🎓" },
  { id: 57, key: "gym", niche: "Gym membership reactivation", emoji: "🏋️" },
  { id: 58, key: "dental", niche: "Dental checkup reactivation", emoji: "🦷" },
  { id: 59, key: "legal", niche: "Accident claim reactivation", emoji: "⚖️" },
];

export function isValidDemoCampaignId(id: number): boolean {
  return DEMO_CAMPAIGNS.some((c) => c.id === id);
}

/**
 * Broader check used by the admin /create-link endpoint: ANY campaign flagged
 * is_demo=true is valid, not just the 5 hardcoded for the public /try page.
 * Lets an admin mint links for custom per-prospect demo campaigns.
 */
export async function isDemoCampaign(campaignId: number): Promise<boolean> {
  const rows = await db
    .select({ id: campaigns.id, isDemo: campaigns.isDemo })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  const row = rows[0];
  return !!(row && (row as any).isDemo === true);
}

type RateEntry = { count: number; firstAt: number };
const rateLimits = new Map<string, RateEntry>();
let globalCount = 0;
let globalWindowStart = Date.now();

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_IP = 5;
const RATE_MAX_GLOBAL = 100;

/**
 * Whitelist of IP or phone identifiers that bypass all demo rate limits.
 * Currently used for the founder's own testing and his girlfriend's number
 * which acts as an always-on demo harness. Matched loose (substring) so we
 * don't care about IPv4/IPv6 shape on the IP side.
 */
export const DEMO_VIP_IPS: string[] = [];
export const DEMO_VIP_PHONES = new Set<string>([
  "+31617862359", // Danique (girlfriend) — unlimited demo uses for internal dogfooding
  "+554774002162", // Gabriel (founder) — unlimited demos + /commands from his phone
]);

export function isVipPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const normalized = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
  return DEMO_VIP_PHONES.has(normalized);
}

function rotateGlobalWindow(now: number) {
  if (now - globalWindowStart > RATE_WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
}

export type RateDenyReason = "ip" | "global";

export function checkRateLimit(ip: string): { ok: true } | { ok: false; reason: RateDenyReason } {
  const now = Date.now();
  rotateGlobalWindow(now);

  if (DEMO_VIP_IPS.some((v) => ip.includes(v))) return { ok: true };

  if (globalCount >= RATE_MAX_GLOBAL) return { ok: false, reason: "global" };

  const entry = rateLimits.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    rateLimits.set(ip, { count: 0, firstAt: now });
  }
  const cur = rateLimits.get(ip)!;
  if (cur.count >= RATE_MAX_PER_IP) return { ok: false, reason: "ip" };

  cur.count += 1;
  globalCount += 1;
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits.entries()) {
    if (now - entry.firstAt > RATE_WINDOW_MS) rateLimits.delete(ip);
  }
  rotateGlobalWindow(now);
}, 10 * 60 * 1000).unref?.();

export function generateToken(): { token: string } {
  // 16 hex chars = 64 bits of entropy. Treated as a secret — never log it,
  // never display it, never put it in URLs or UI other than the pre-filled
  // WhatsApp text the user sends to claim their pending session.
  return { token: crypto.randomBytes(8).toString("hex") };
}

export async function createPendingDemoLead(params: {
  token: string;
  firstName: string;
  language: string;
  campaignId: number;
  demoNiche?: string;
}): Promise<number> {
  const { token, firstName, language, campaignId, demoNiche } = params;
  const now = new Date();
  const [row] = await db
    .insert(leads)
    .values({
      accountsId: DEMO_ACCOUNT_ID,
      campaignsId: campaignId,
      firstName,
      language,
      source: "WhatsApp Demo",
      channelIdentifier: `wa-demo:${token}`,
      conversionStatus: "New",
      // Explicitly NOT 'queued' so the campaign launcher never picks it up.
      // The demo flow sends First_Message itself in demo_recap.py.
      automationStatus: "demo_pending",
      ...(demoNiche ? { demoNiche } : {}),
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning({ id: leads.id });
  return row.id as number;
}

export async function findPendingLeadByToken(token: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.channelIdentifier, `wa-demo:${token}`))
    .limit(1);
  return rows[0] ?? null;
}

export function buildWhatsAppLink(params: { token: string }): string {
  const number = DEMO_WHATSAPP_NUMBER.replace(/\D/g, "");
  const text = `Press Send to start the demo (code #${params.token})`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export interface CampaignContext {
  company_name: string;
  niche_label: string;
  service_name: string;
  usp: string;
  business_description: string;
  booking_mode_call: boolean;
  what_lead_did: string;
  niche_question: string;
  agent_name: string;
  first_message: string;
  bump_1_template: string;
  bump_2_template: string;
  kb: string;
}

const CAMPAIGN_GENERATOR_SYSTEM = `You generate a complete demo campaign configuration for a lead reactivation AI tool.
Given a business niche, output a JSON object with these exact keys:
- company_name: a realistic company name for that niche (e.g. "BrightSmile Dentistry", "SolarMax", "PeakFit Gym")
- niche_label: 2-3 word label (e.g. "dental care", "solar energy", "gym membership")
- service_name: the specific service being offered (e.g. "dental checkup", "solar panel installation", "gym membership reactivation")
- usp: one sentence unique selling point for this business
- business_description: 2 sentences describing what the business does and who it serves
- booking_mode_call: boolean. true if closing requires a phone or video call with a specialist (solar, coaching, online consulting, financial services, insurance). false if the client books a direct in-person appointment at a physical location (dental checkup, physio, hair salon, gym class, doctor visit).
- what_lead_did: what a typical lapsed lead did in the past (e.g. "had a dental checkup scheduled", "requested a solar quote on our website", "signed up for a free trial class")
- niche_question: ONE sharp qualifying question that reconnects the lead with their original intent (e.g. "Have you found another dentist in the meantime, or are you still looking?", "Are you still thinking about going solar this year?")
- agent_name: a realistic first name for the AI outreach agent (e.g. "Sarah", "Emily", "Alex", "Jordan")
- first_message: the opener — format exactly: "Hi, this is {agent_name} from [company_name]. Is this the same {first_name} who [what_lead_did] a while back?" — {first_name} appears ONLY ONCE in the identity question, never in the greeting
- bump_1_template: a gentle follow-up for no response after 24h. Short, curious tone, reference the service. No greeting.
- bump_2_template: a second follow-up 48h later, different angle, slight urgency or a soft offer. Short.
- kb: a single string of 4-6 specific, detailed facts the AI should know when talking to leads about this business. Each line should be a concrete talking point the AI can use — include numbers, timelines, guarantees, differentiators, and common objections with rebuttals. Example for solar: "Average savings: 40% on energy bills with payback in 4-6 years.\n25-year panel warranty + 10-year inverter warranty included.\nFree site survey and quote within 48h, no obligation.\nGovernment feed-in tariff still available — we handle all paperwork.\nCommon objection: 'too expensive upfront' — rebuttal: $0-down financing available, payments start lower than current power bill." Separate each point with a newline. NOT an array.

Return ONLY valid JSON, no markdown.`;

export async function generateCampaignContext(niche: string): Promise<CampaignContext | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: CAMPAIGN_GENERATOR_SYSTEM },
          { role: "user", content: `Business niche: ${niche}` },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw) as CampaignContext;

    // Enforce {agent_name} placeholder in first_message
    if (parsed.first_message && !parsed.first_message.includes("{agent_name}")) {
      parsed.first_message = parsed.first_message.replace(/\bSophie\b|\bEmily\b|\bSarah\b|\bAlex\b|\bJordan\b/g, "{agent_name}");
    }
    // Enforce {first_name} placeholder in first_message
    if (parsed.first_message && !parsed.first_message.includes("{first_name}")) {
      const fixed = parsed.first_message.replace(
        /\b(same|same person)\s+\S+\s+(who)\b/gi,
        "$1 {first_name} $2",
      );
      parsed.first_message = fixed.includes("{first_name}")
        ? fixed
        : parsed.first_message.trimEnd().replace(/\??\s*$/, "") + ", is this {first_name}?";
    }
    // Coerce kb from array to string if the model returned one
    if (Array.isArray((parsed as any).kb)) {
      (parsed as any).kb = (parsed as any).kb.join("\n");
    }

    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bilingual context generation (Phase 4)
// ---------------------------------------------------------------------------

/** Index-aligned dropdown options (mirrors fieldLocale.ts client-side). */
const DROPDOWN_OPTIONS = {
  campaign_usp: {
    en: ["", "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"],
    nl: ["", "Natuurlijke materialen", "Slimme technologie-integratie", "Snelle levering: keuken klaar in 6 weken", "Made in Germany", "Made in Italy", "Eigen ontwerper: van begin tot eind", "Verlengde garantie: 10 jaar"],
  },
  ai_style_override: {
    en: ["", "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"],
    nl: ["", "Professioneel & adviserend", "Warm & informatief", "Direct & resultaatgericht", "Vriendelijk & geruststellend", "Premium & exclusief"],
  },
  what_lead_did: {
    en: ["", "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase", "Declined / went with another provider"],
    nl: ["", "Heeft een offerte aangevraagd", "Heeft een offerte ontvangen", "Heeft een bezoek / keuring gehad", "In de beslissingsfase", "Afgewezen / naar een andere aanbieder"],
  },
  service_name: {
    en: ["", "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"],
    nl: ["", "Ontwerp en productie inclusief installatie", "Ontwerp en productie exclusief installatie", "Levering en installatie", "Alleen ontwerpadvies"],
  },
};

/** Given an EN dropdown value, return the stored {en, nl} JSON string. */
function dropdownStore(field: keyof typeof DROPDOWN_OPTIONS, enValue: string): string {
  const table = DROPDOWN_OPTIONS[field];
  const idx = table.en.indexOf(enValue);
  if (idx !== -1) return JSON.stringify({ en: table.en[idx], nl: table.nl[idx] });
  return JSON.stringify({ en: enValue, nl: enValue });
}

/** Parse a stored field (plain string or JSON) to {en?, nl?}. */
export function parseLang(raw: unknown): { en?: string; nl?: string } {
  if (!raw) return {};
  const s = String(raw).trim();
  if (s.startsWith("{")) {
    try {
      const p = JSON.parse(s);
      if (typeof p === "object" && p !== null) return p;
    } catch { /* ok */ }
  }
  return { en: s, nl: s };
}

export interface BilingualFields {
  description?: string;
  niche_question?: string;
  kb?: string;
  campaign_usp?: string;
  ai_style_override?: string;
  what_lead_did?: string;
  service_name?: string;
}

const BILINGUAL_GENERATOR_SYSTEM = `You generate campaign context fields in both English and Dutch for a B2B/B2C lead reactivation AI tool.

Given a business niche, output a JSON object with these exact keys:
- description_en / description_nl: 2-sentence business description
- niche_question_en / niche_question_nl: one sharp qualifying question for lapsed leads
- kb_en / kb_nl: 4-6 specific knowledge base facts the AI should know (numbers, timelines, objection rebuttals). Newline-separated, NOT an array.
- usp_en: one of these exact options: "Naturally sourced materials", "Smart technology integration", "Fast delivery: kitchen ready in 6 weeks", "Made in Germany", "Made in Italy", "Dedicated designer: start to finish", "Extended warranty: 10 years"
- ai_style_en: one of: "Professional & consultative", "Warm & educational", "Direct & results-focused", "Friendly & reassuring", "Premium & exclusive"
- what_lead_did_en: one of: "Inquired about a quote", "Received a quote", "Had a site visit / assessment", "In the decision phase"
- service_name_en: one of: "Design and manufacturing including installation", "Design and manufacturing not including installation", "Supply and installation", "Design consultancy only"

Return ONLY valid JSON, no markdown.`;

const TRANSLATE_SYSTEM = `You translate campaign context fields between English and Dutch.
Return ONLY valid JSON with the translated values — same keys as the input, no extra keys.`;

export async function generateBilingualContext(niche: string): Promise<BilingualFields | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: BILINGUAL_GENERATOR_SYSTEM },
          { role: "user", content: `Business niche: ${niche}` },
        ],
        max_tokens: 900,
        temperature: 0.7,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const data = JSON.parse(raw) as Record<string, string>;

    return {
      description: JSON.stringify({ en: data.description_en ?? "", nl: data.description_nl ?? "" }),
      niche_question: JSON.stringify({ en: data.niche_question_en ?? "", nl: data.niche_question_nl ?? "" }),
      kb: JSON.stringify({ en: data.kb_en ?? "", nl: data.kb_nl ?? "" }),
      campaign_usp: dropdownStore("campaign_usp", data.usp_en ?? ""),
      ai_style_override: dropdownStore("ai_style_override", data.ai_style_en ?? ""),
      what_lead_did: dropdownStore("what_lead_did", data.what_lead_did_en ?? ""),
      service_name: dropdownStore("service_name", data.service_name_en ?? ""),
    };
  } catch {
    return null;
  }
}

/** Translate a set of plain-string values from one lang to the other. Returns {field: translatedValue}. */
export async function translateFields(
  values: Record<string, string>,
  fromLang: "en" | "nl",
  toLang: "en" | "nl",
): Promise<Record<string, string>> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey || !Object.keys(values).length) return {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const langName = (l: string) => (l === "nl" ? "Dutch" : "English");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TRANSLATE_SYSTEM },
          { role: "user", content: `Translate from ${langName(fromLang)} to ${langName(toLang)}:\n${JSON.stringify(values, null, 2)}` },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return {};
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
