import type { VoiceLang } from "./types";

/**
 * The /voice-demo door: the shared password, the demo brands, and where this
 * browser remembers them.
 *
 * Split out of the old Realtime hook when the demo moved to GPT-Live, so the
 * door outlived the call stack it was written inside. Nothing here knows
 * anything about a call.
 */

export const DEMO_COMPANY: Record<VoiceLang, string> = {
  en: "Brightside Solar",
  nl: "Zonnedak",
  pt: "Sol Maior",
};

export const PHONE_STORAGE_KEY = "leadawaker.voiceDemo.callerNumber";

/**
 * The /voice-demo door password. Deliberately weak and shared (told to
 * prospects, not secret) — it keeps opportunistic bots and randoms off a page
 * that mints real, billable OpenAI Realtime sessions. The engine enforces the
 * same three words server-side (settings.voice_demo_password), so bypassing
 * this gate in devtools still 401s at /voice/token.
 */
export const VOICE_DEMO_PASSWORDS = ["hello", "ola", "hoi"];
export const VOICE_DEMO_UNLOCK_KEY = "leadawaker.voiceDemo.password";

const COMBINING_DIACRITICS_RE = /[\u0300-\u036f]/g;

/** Casefold + strip diacritics, so "Olá" and "ola" are the same word. */
export function normalizeVoicePassword(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS_RE, "");
}

export function isValidVoicePassword(raw: string): boolean {
  return VOICE_DEMO_PASSWORDS.includes(normalizeVoicePassword(raw));
}


/** The stored password, or "" if this browser never unlocked the page. */
export function storedVoicePassword(): string {
  try {
    return localStorage.getItem(VOICE_DEMO_UNLOCK_KEY) || "";
  } catch {
    return "";
  }
}
