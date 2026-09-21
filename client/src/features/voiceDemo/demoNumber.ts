import type { VoiceLocale } from "./types";

/**
 * A made-up caller number for the demo, so the AI hears a number the way it
 * would from a real phone line and the call shows up in the CRM as its own
 * caller instead of "Web caller". It looks local to the call's language.
 *
 * Kept per browser and per locale, so the same visitor calling again is the
 * same caller. The engine files these leads without queueing any outreach:
 * a Dutch or Brazilian number made up here may well belong to someone.
 * The UK and US formats use the ranges set aside for fiction (Ofcom's
 * 07700 900xxx, and 555-01xx), so those cannot reach anyone at all.
 */
const STORAGE_PREFIX = "leadawaker.voiceDemo.demoNumber.";

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// Real US area codes, so the number reads as a place.
const US_AREAS = ["212", "305", "312", "415", "512", "617", "713", "303", "404", "206"];

const MAKERS: Record<VoiceLocale, () => string> = {
  "pt-BR": () => { const d = digits(8); return `(47) 9${d.slice(0, 4)}-${d.slice(4)}`; },
  "pt-PT": () => { const d = digits(7); return `91${d[0]} ${d.slice(1, 4)} ${d.slice(4)}`; },
  nl: () => `06-${1 + Math.floor(Math.random() * 6)}${digits(7)}`,
  "en-GB": () => `+44 7700 900${digits(3)}`,
  "en-US": () => `+1 (${pick(US_AREAS)}) 555-01${digits(2)}`,
};

/** This browser's made-up number for a locale, created on first use. */
export function demoCallerNumber(locale: VoiceLocale): string {
  const key = STORAGE_PREFIX + locale;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch {
    /* private mode: a fresh number per call is fine */
  }
  const made = (MAKERS[locale] ?? MAKERS["en-GB"])();
  try { localStorage.setItem(key, made); } catch { /* private mode */ }
  return made;
}
