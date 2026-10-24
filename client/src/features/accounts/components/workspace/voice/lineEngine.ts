// Which engine answers a phone line, and which ElevenLabs voices suit its agent.
// Pure: the Voice tab's line engine card and its tests share this.
import type { EngineVoice } from "@/features/demos/api/demoSettingsApi";
import { FEMININE_VOICE_OPTIONS, MASCULINE_VOICE_OPTIONS, isMasculineVoice } from "../communication/setupConstants";
import type { AgentGender, LineEngine, LinePurpose, VoiceNumber } from "./voiceApi";
import { asLlmKey, type LlmKey } from "./llmOptions";

/** Whether real calls on this line run on ElevenLabs: demo and test lines only, when their engine pick is elevenlabs. */
export function runsOnEleven(n?: VoiceNumber | null): boolean {
  return (n?.purpose === "demo" || n?.purpose === "test") && n.engine === "elevenlabs";
}

/** The language model real callers get on this engine: the stored pick, else Sol. */
export function effectiveLlm(n: VoiceNumber | null | undefined, engine: LineEngine): LlmKey {
  return asLlmKey(engine === "elevenlabs" ? n?.elevenLlm : n?.liveLlm);
}

/** Line settings the card can change on one click (voiceApi's line engine patch fields). */
export type LineEngineField = "purpose" | "engine" | "engineVoice" | "liveLlm";

/** Whether a change asks first: the language model real callers get on a client line. Demo and test lines save at once. */
export function needsConfirm(purpose: LinePurpose | undefined, field: LineEngineField): boolean {
  return purpose === "client" && field === "liveLlm";
}

/** The gender of the line's own (GPT-Live) voice, or null when it is not set or unknown. */
export function agentGender(lineVoice?: string | null): "male" | "female" | null {
  if (!lineVoice) return null;
  if (isMasculineVoice(lineVoice)) return "male";
  return (FEMININE_VOICE_OPTIONS as readonly string[]).includes(lineVoice) ? "female" : null;
}

/** The voices of the agent's gender; all of them when the gender is unknown. */
export function voicesForAgent(voices: EngineVoice[], lineVoice?: string | null): EngineVoice[] {
  const g = agentGender(lineVoice);
  return g ? voices.filter((v) => v.gender === g) : voices;
}

/** Whether the pick matches the agent's gender (the engine swaps a mismatch for its default). */
export function pickFits(voiceId: string | null | undefined, voices: EngineVoice[], lineVoice?: string | null): boolean {
  if (!voiceId) return true;
  return voicesForAgent(voices, lineVoice).some((v) => v.id === voiceId) || agentGender(lineVoice) === null;
}

/** The GPT Live voice the engine ends up with: a set gender swaps a voice of the other gender for marin / vesper. */
export function effectiveVoice(voice: string | null | undefined, gender?: AgentGender | null): string {
  const v = voice ?? "";
  if (gender === "male") return !v || !isMasculineVoice(v) ? "vesper" : v;
  if (gender === "female") return !v || isMasculineVoice(v) ? "marin" : v;
  return v;
}

/** The OpenAI voices on offer: only the set gender's, or both groups when automatic. The saved voice stays visible. */
export function openAiVoiceGroups(gender: AgentGender | null | undefined, current?: string | null) {
  const groups = [
    { gender: "female" as const, voices: [...FEMININE_VOICE_OPTIONS] as string[] },
    { gender: "male" as const, voices: [...MASCULINE_VOICE_OPTIONS] as string[] },
  ].filter((g) => !gender || g.gender === gender);
  if (current && !groups.some((g) => g.voices.includes(current))) {
    const own = agentGender(current);
    const g = groups.find((x) => x.gender === own) ?? groups[0];
    g.voices.push(current);
  }
  return groups;
}

/** ElevenLabs voices on offer: the set gender's (else the GPT Live voice's), plus the saved pick wherever it sits. */
export function elevenVoicesFor<T extends EngineVoice>(voices: T[], gender: AgentGender | null | undefined, lineVoice: string | null | undefined, pick?: string | null): T[] {
  const shown = voicesForAgent(voices, effectiveVoice(lineVoice, gender) || (gender ?? null));
  if (!pick || shown.some((v) => v.id === pick)) return shown;
  const saved = voices.find((v) => v.id === pick);
  return saved ? [...shown, saved] : shown;
}
