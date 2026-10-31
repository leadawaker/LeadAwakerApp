// Gemini Live in the test panel: which accounts get it, its voices and their
// Dutch preview samples (made by automations/tools/gemini_voice_samples.py).
// Kept in step with the engine's gemini_live_test.GEMINI_VOICES.

/** The Robben Rosmalen (experiment) account only (2026-10-31). */
export const GEMINI_TEST_ACCOUNT_IDS: readonly number[] = [59];

export function geminiAvailable(accountId: number, isAgencyUser: boolean): boolean {
  return isAgencyUser && GEMINI_TEST_ACCOUNT_IDS.includes(accountId);
}

export type VoiceGender = "female" | "male";

export const GEMINI_TEST_VOICES: { name: string; gender: VoiceGender }[] = [
  ..."Zephyr Kore Leda Aoede Callirrhoe Autonoe Despina Erinome Laomedeia Achernar Gacrux Pulcherrima Vindemiatrix Sulafat"
    .split(" ").map((name) => ({ name, gender: "female" as const })),
  ..."Puck Charon Fenrir Orus Enceladus Iapetus Umbriel Algieba Algenib Rasalgethi Alnilam Schedar Achird Zubenelgenubi Sadachbia Sadaltager"
    .split(" ").map((name) => ({ name, gender: "male" as const })),
];

export const DEFAULT_GEMINI_VOICE = "Charon";

export function geminiSampleUrl(voice: string): string {
  return `/voice-samples/gemini/nl/${voice}.mp3`;
}

const VOICE_KEY = "leadawaker.voiceTest.geminiVoice";

export function loadGeminiVoice(): string {
  try {
    const v = window.localStorage.getItem(VOICE_KEY);
    if (v && GEMINI_TEST_VOICES.some((x) => x.name === v)) return v;
  } catch { /* private mode */ }
  return DEFAULT_GEMINI_VOICE;
}

export function saveGeminiVoice(v: string): void {
  try { window.localStorage.setItem(VOICE_KEY, v); } catch { /* private mode */ }
}
