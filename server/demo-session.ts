import crypto from "crypto";
import { db } from "./db";
import { leads, campaigns } from "@shared/schema";
import { eq } from "drizzle-orm";

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
}): Promise<number> {
  const { token, firstName, language, campaignId } = params;
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
  const text = `Start Demo #${params.token}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
