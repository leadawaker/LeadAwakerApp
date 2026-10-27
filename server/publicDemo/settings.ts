// Public website demo settings (specs/public-website-demo): one Demo_Settings
// row, service "public_demo", merged over these defaults. The engine reads
// the same row (tools/public_demo.py), so the two share one set of limits.
import { eq } from "drizzle-orm";
import { db } from "../db";
import { demoSettings } from "@shared/schema";

export const PUBLIC_DEMO_SERVICE = "public_demo";
export const PUBLIC_DEMO_SOURCE = "Public Website Demo";

export interface PublicDemoSettings {
  enabled: boolean;
  allowedCountryCodes: string[];
  dailyBudgetEur: number;
  maxDemosPerDay: number;
  maxRequestsPerIpPerDay: number;
  phoneCooldownDays: number;
  domainCacheDays: number;
  voiceMaxMinutesPerSession: number;
  voiceMaxSessionsPerDemo: number;
  unknownCallerMaxMinutes: number;
  whatsappIdleCompleteMinutes: number;
  feedbackMessage: { enabled: boolean; delayMinutes: number };
  costEstimates: { buildEur: number; voiceMinuteEur: number; chatTurnEur: number };
  /** The demo voice line shown on the page; null hides "Or call her". */
  callNumber: string | null;
  /** Where "Book a call instead" points; null lets the page use its own link. */
  bookingUrl: string | null;
}

export const DEFAULT_PUBLIC_DEMO_SETTINGS: PublicDemoSettings = {
  enabled: true,
  allowedCountryCodes: ["31", "44", "55"],
  dailyBudgetEur: 10,
  maxDemosPerDay: 40,
  maxRequestsPerIpPerDay: 3,
  phoneCooldownDays: 30,
  domainCacheDays: 30,
  voiceMaxMinutesPerSession: 5,
  voiceMaxSessionsPerDemo: 3,
  unknownCallerMaxMinutes: 2,
  whatsappIdleCompleteMinutes: 30,
  feedbackMessage: { enabled: false, delayMinutes: 120 },
  costEstimates: { buildEur: 0.08, voiceMinuteEur: 0.2, chatTurnEur: 0.01 },
  callNumber: null,
  bookingUrl: null,
};

const TTL_MS = 30_000;
let cache: { at: number; value: PublicDemoSettings } | null = null;

export async function getPublicDemoSettings(): Promise<PublicDemoSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const [row] = await db
      .select()
      .from(demoSettings)
      .where(eq(demoSettings.service, PUBLIC_DEMO_SERVICE))
      .limit(1);
    const saved = (row?.settings as Partial<PublicDemoSettings>) || {};
    const value: PublicDemoSettings = {
      ...DEFAULT_PUBLIC_DEMO_SETTINGS,
      ...saved,
      feedbackMessage: { ...DEFAULT_PUBLIC_DEMO_SETTINGS.feedbackMessage, ...(saved.feedbackMessage || {}) },
      costEstimates: { ...DEFAULT_PUBLIC_DEMO_SETTINGS.costEstimates, ...(saved.costEstimates || {}) },
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("[public-demo] settings read failed", (err as Error).message);
    return cache?.value ?? DEFAULT_PUBLIC_DEMO_SETTINGS;
  }
}

/** Merge a partial update into the row and drop the cache. */
export async function savePublicDemoSettings(patch: Partial<PublicDemoSettings>): Promise<PublicDemoSettings> {
  const current = await getPublicDemoSettings();
  const next = { ...current, ...patch };
  await db
    .insert(demoSettings)
    .values({ service: PUBLIC_DEMO_SERVICE, settings: next as any, updatedAt: new Date() })
    .onConflictDoUpdate({ target: demoSettings.service, set: { settings: next as any, updatedAt: new Date() } });
  cache = null;
  return next;
}
