/**
 * The voice demo's settings and per-demo voice pick, as pure zod schemas and
 * helpers (no Express, no database) so the rules are tested on their own
 * (demoVoiceSchemas.test.ts). Used by demoSettings.ts, demo.ts and
 * voiceDemoCalls.ts.
 */
import { z } from "zod";
import { toE164, type PhoneCountry } from "@shared/phoneE164";

/** The locales ElevenLabs demos have voices for (engine eleven_voices.LOCALE_VOICES). pt-PT uses pt-BR. */
export const ELEVEN_DEMO_LOCALES = ["nl", "en-GB", "en-US", "pt-BR"] as const;
export type ElevenDemoLocale = (typeof ELEVEN_DEMO_LOCALES)[number];

/** Which engine answers a demo call. Missing in the row means ElevenLabs. */
export const DEMO_ENGINES = ["elevenlabs", "gpt-live"] as const;
export type DemoEngine = (typeof DEMO_ENGINES)[number];

/** Gabriel's phones for "Call me + prospect", until settings say otherwise. */
export const DEFAULT_OWNER_PHONE = "+31684446349";
export const DEFAULT_OWNER_PHONE_BACKUP = "+31737044356";

// A number typed without +country code is read as Dutch, then British, then
// Brazilian: the markets the demo line serves.
const FORGET_COUNTRIES: PhoneCountry[] = ["NL", "GB", "BR"];
export const forgetE164 = (raw: string): string | null =>
  FORGET_COUNTRIES.map((c) => toE164(raw, c)).find(Boolean) ?? null;

/**
 * PUT /api/demo-settings/voice. Strict on purpose: only these keys reach the
 * Demo_Settings row the engine reads.
 */
export const voiceSettingsSchema = z.object({
  defaultVoices: z.record(z.string().max(40), z.string().trim().max(40)).optional(),
  // Stored as typed. The engine casefolds and strips accents on both sides,
  // so "Olá" and "ola" are the same word at the door.
  passwords: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  // null clears it back to the engine's default.
  maxCallMinutes: z.number().int().min(1).max(30).nullable().optional(),
  // Numbers Sara never remembers as returning callers (on every line), so a
  // demo from your own phone always starts fresh. Stored as E.164 (see
  // FORGET_COUNTRIES): the engine compares them with the caller's number.
  forgetNumbers: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  // Engine tests: a tester's own phone number gets this engine (GPT-Live,
  // Grok or ElevenLabs), voice, prompt variant and reasoning on a conference-route line;
  // every other caller keeps the line's setup. Read per call by the engine
  // (src/automations/voice/voice_engines.py), which ignores a voice id the
  // chosen engine does not have. Stored as E.164, like forgetNumbers.
  engineTests: z.array(z.object({
    number: z.string().trim().min(1).max(30),
    label: z.string().trim().max(40).optional(),
    enabled: z.boolean().optional(),
    engine: z.enum(["gpt-live", "xai", "elevenlabs"]),
    voice: z.string().trim().max(40).optional(),
    prompt: z.enum(["standard", "lean"]).optional(),
    reasoning: z.enum(["high", "none"]).optional(),
    // Memory off, any engine: the call is heard as a first-time caller's (no
    // memory, stored language or appointment; the booking tools see no booking)
    // and writes no name or language back. Bookings still land on the lead.
    freshCaller: z.boolean().optional(),
  })).max(10).optional(),
  // Which engine minted demos (/voice-demo?token= and demo phone calls) run on.
  demoEngine: z.enum(DEMO_ENGINES).optional(),
  // The ElevenLabs voice per demo locale; an empty pick is removed (the
  // locale's female default then answers).
  elevenVoices: z.record(z.enum(ELEVEN_DEMO_LOCALES), z.string().trim().max(40)).optional(),
  // "Call me + prospect" rings one of these first. Stored as E.164; null clears.
  ownerPhone: z.string().trim().max(30).nullable().optional(),
  ownerPhoneBackup: z.string().trim().max(30).nullable().optional(),
  ownerPhoneUse: z.enum(["primary", "backup"]).optional(),
});
export type VoiceSettingsInput = z.infer<typeof voiceSettingsSchema>;

/**
 * Normalise the phone numbers in a parsed voice settings patch to E.164.
 * Returns the numbers that could not be read, or the cleaned patch.
 */
export function normaliseVoicePhones(data: VoiceSettingsInput): { bad: string[] } | { data: VoiceSettingsInput } {
  const bad: string[] = [];
  const out: VoiceSettingsInput = { ...data };
  if (out.forgetNumbers) {
    bad.push(...out.forgetNumbers.filter((n) => !forgetE164(n)));
    out.forgetNumbers = Array.from(new Set(out.forgetNumbers.map((n) => forgetE164(n)).filter((n): n is string => !!n)));
  }
  if (out.engineTests) {
    bad.push(...out.engineTests.filter((t) => !forgetE164(t.number)).map((t) => t.number));
    out.engineTests = out.engineTests.map((t) => ({ ...t, number: forgetE164(t.number) ?? t.number }));
  }
  for (const key of ["ownerPhone", "ownerPhoneBackup"] as const) {
    const raw = out[key];
    if (raw === undefined || raw === null) continue;
    if (raw === "") { out[key] = null; continue; }
    const e164 = forgetE164(raw);
    if (!e164) bad.push(raw);
    else out[key] = e164;
  }
  return bad.length ? { bad } : { data: out };
}

/** The phone "Call me + prospect" rings first: the one settings say to use, else the other, else the defaults. */
export function ownerNumberFrom(settings: Record<string, unknown> | undefined): string {
  const s = settings || {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const primary = str(s.ownerPhone);
  const backup = str(s.ownerPhoneBackup);
  if (s.ownerPhoneUse === "backup") return backup ?? primary ?? DEFAULT_OWNER_PHONE_BACKUP;
  return primary ?? backup ?? DEFAULT_OWNER_PHONE;
}

/** The per-demo voice fields of POST /api/demo/create-link. */
export const createLinkVoiceFields = {
  // An engine voice id (ElevenLabs or GPT-Live, whichever demoEngine is); the
  // engine ignores one it does not know. Empty = the settings default.
  voice: z.string().trim().max(40).optional(),
  voiceLocale: z.enum(ELEVEN_DEMO_LOCALES).optional(),
};

/** Stamp the voice pick on the persona blob, as `voice` and `voice_locale`. */
export function applyVoicePick(
  persona: Record<string, unknown>,
  pick: { voice?: string; voiceLocale?: ElevenDemoLocale },
): Record<string, unknown> {
  const out = { ...persona };
  if (pick.voice) out.voice = pick.voice;
  if (pick.voiceLocale) out.voice_locale = pick.voiceLocale;
  return out;
}
