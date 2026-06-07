import crypto from "crypto";
import { db } from "./db";
import { leads, campaigns, promptLibrary } from "@shared/schema";
import { eq } from "drizzle-orm";

export const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

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
}

const NICHE_GENERATOR_SYSTEM_FALLBACK = `You generate realistic demo context for a lead reactivation AI demo.
Given a business niche description, output a JSON object with these exact keys:
- company_name: a realistic local company name for that niche (e.g. "Huis & Haard Makelaars", "SolarMax NL")
- what_lead_did: what a typical lead for this niche would have done (e.g. "een afspraak had staan voor een tandartscontrole", "interesse had in zonnepanelen via onze website", "zich had ingeschreven voor een gratis proefles")
- when_label: a natural time reference (e.g. "een tijdje geleden", "some time ago", "há um tempo")
- niche_question: ONE sharp qualifying question that reconnects the lead with their original intent (e.g. "Heb je inmiddels een andere tandarts gevonden, of ben je nog op zoek?", "Are you still thinking about going solar this year?")
- niche_label: a short 1-2 word label for the niche in the output language (e.g. "real estate", "solar", "tandheelkunde")
- first_message: the Sophie opener — format exactly: "Hi, this is {agent_name} from [company_name]. Is this the same {first_name} who [what_lead_did] [when_label]?" — adapt to the output language (e.g. Dutch: "Hi, dit is {agent_name} van [company_name]. Ben jij dezelfde {first_name} die [what_lead_did] [when_label]?") — the name {first_name} appears ONLY ONCE in the identity question, never in the greeting

Output language will be specified in the user message. Return ONLY valid JSON, no markdown.`;

export async function generateNicheContext(
  niche: string,
  language: "en" | "nl" | "pt",
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

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
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
          { role: "user", content: `Business niche: ${niche}\nOutput language: ${langLabel}` },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as any;
    const raw = (json?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw) as NicheContext;
    parsed.raw = niche;
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
    return parsed;
  } catch {
    return null;
  }
}

export function buildFallbackNicheContext(niche: string, language: "en" | "nl" | "pt"): NicheContext {
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
  return {
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
  };
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
