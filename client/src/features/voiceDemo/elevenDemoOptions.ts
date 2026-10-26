import { ENGINE_BASE_URL } from "./engine";
import type { ElevenDemoLocale, ElevenDemoOptions, LiveOptions, VoiceLocale } from "./types";

/** The ElevenLabs voices and defaults per demo locale, straight from the engine (public). */
export async function fetchElevenDemoOptions(): Promise<ElevenDemoOptions> {
  const res = await fetch(`${ENGINE_BASE_URL}/voice/eleven/demo/options`);
  if (!res.ok) throw new Error("Could not reach the voice engine.");
  return (await res.json()) as ElevenDemoOptions;
}

/** The ElevenLabs locale a page or demo locale speaks: pt-PT uses the pt-BR voices. */
export function elevenLocaleOf(locale: VoiceLocale | string): ElevenDemoLocale {
  if (locale === "nl" || locale === "en-GB" || locale === "en-US" || locale === "pt-BR") return locale;
  if (locale.startsWith("pt")) return "pt-BR";
  if (locale.startsWith("nl")) return "nl";
  return "en-GB";
}

/**
 * The ElevenLabs options in the shape the /voice-demo settings gear reads
 * (LiveOptions), for one locale: the page's locale list stays, the voices are
 * that locale's ElevenLabs ones, and the default names its voice.
 */
export function elevenAsLiveOptions(
  eleven: ElevenDemoOptions | null, live: LiveOptions | null, locale: VoiceLocale,
): LiveOptions | null {
  if (!eleven) return live;
  const voices = eleven.voices[elevenLocaleOf(locale)] ?? [];
  const labelOf = (l: VoiceLocale) => {
    const id = eleven.defaults[elevenLocaleOf(l)];
    return eleven.voices[elevenLocaleOf(l)]?.find((v) => v.id === id)?.label ?? id ?? "";
  };
  const locales = (live?.locales ?? []).map((l) => ({ ...l, voice: labelOf(l.id), needs_listening_test: false }));
  return {
    default_locale: live?.default_locale ?? "en-GB",
    locales,
    // CallSettings prints "id — label"; ElevenLabs ids are opaque, so both carry the name.
    voices: voices.map((v) => ({ id: v.id, label: v.label, gender: v.gender })),
    max_call_minutes: live?.max_call_minutes,
  };
}
