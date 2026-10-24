/**
 * A phone line's purpose and, on demo and test lines only, its ElevenLabs pick
 * (Voice_Numbers.purpose / engine / engine_voice, plus live_llm / eleven_llm, written by
 * scripts/migrate_add_voice_number_purpose.py in the automations repo).
 * A client line always stays on GPT Live: it never holds an engine pick.
 *
 * The rules are pure (`lineEngineUpdate`) so they test without a database;
 * `saveLineEngine` loads the db and the Voice tab reader lazily for the same reason.
 */
import type { VoiceLine } from "./voiceLines";

export const LINE_PURPOSES = ["client", "demo", "test"] as const;
export type LinePurpose = (typeof LINE_PURPOSES)[number];

/** The reasoning-model keys a line stores (engine llm_choice.py LLM_MODELS); NULL = sol. */
export const LLM_KEYS = ["sol", "terra", "luna"] as const;
export type LlmKey = (typeof LLM_KEYS)[number];

/**
 * Mirrors ELEVEN_LLM_SUPPORTED in the engine's src/automations/voice/llm_choice.py: ElevenLabs
 * (Eleven Realtime) manages its own LLM, so a stored eleven_llm would be ignored. Change both together.
 */
export const ELEVEN_LLM_SUPPORTED = false;

/**
 * Mirrors CLIENT_ELEVEN_ALLOWED in the engine's src/automations/voice/line_purpose.py: whether a
 * client line's ElevenLabs pick reaches its real callers. Change both together.
 */
export const CLIENT_ELEVEN_ALLOWED = false;

export interface LineEngineFields {
  purpose: LinePurpose;
  /** null = GPT Live. */
  engine: "elevenlabs" | null;
  engineVoice: string | null;
  /** GPT Live's reasoning model; null = sol. Applies to a client line's real calls too. */
  liveLlm: LlmKey | null;
  /** ElevenLabs' LLM; null = sol. Ignored by the engine while ELEVEN_LLM_SUPPORTED is false. */
  elevenLlm: LlmKey | null;
}

export interface LineEnginePatch {
  purpose?: LinePurpose;
  engine?: "gpt-live" | "elevenlabs";
  engineVoice?: string | null;
  liveLlm?: LlmKey | null;
  elevenLlm?: LlmKey | null;
}

/** What a number holds once it is released from an account. */
export const DETACHED_LINE: LineEngineFields = {
  purpose: "client", engine: null, engineVoice: null, liveLlm: null, elevenLlm: null,
};

type Result = { ok: true; set: LineEngineFields } | { ok: false; message: string };

const asLlm = (v: unknown): LlmKey | null => (LLM_KEYS as readonly unknown[]).includes(v) ? (v as LlmKey) : null;

export const lineFieldsOf = (row: {
  purpose: string; engine: string | null; engineVoice: string | null;
  liveLlm?: string | null; elevenLlm?: string | null;
}): LineEngineFields => ({
  purpose: asPurpose(row.purpose),
  engine: row.engine === "elevenlabs" ? "elevenlabs" : null,
  engineVoice: row.engineVoice ?? null,
  liveLlm: asLlm(row.liveLlm),
  elevenLlm: asLlm(row.elevenLlm),
});

const asPurpose = (v: unknown): LinePurpose => (LINE_PURPOSES as readonly unknown[]).includes(v) ? (v as LinePurpose) : "client";

export function lineEngineUpdate(current: LineEngineFields, patch: LineEnginePatch): Result {
  const purpose = patch.purpose ?? asPurpose(current.purpose);
  if (patch.elevenLlm != null && !ELEVEN_LLM_SUPPORTED) {
    return { ok: false, message: "ElevenLabs manages its own language model." };
  }
  // The real-call LLM belongs to every line, whatever its engine.
  const liveLlm = patch.liveLlm === undefined ? asLlm(current.liveLlm) : patch.liveLlm;
  const wantsEleven = patch.engine === "elevenlabs" || patch.engineVoice != null;
  if (purpose === "client" && !CLIENT_ELEVEN_ALLOWED) {
    if (wantsEleven) return { ok: false, message: "Engine choice is for demo and test lines only." };
    return { ok: true, set: { ...DETACHED_LINE, liveLlm } };
  }
  const engine = patch.engine === undefined ? current.engine : patch.engine === "elevenlabs" ? "elevenlabs" : null;
  if (engine !== "elevenlabs") {
    return { ok: true, set: { purpose, engine: null, engineVoice: null, liveLlm, elevenLlm: null } };
  }
  return {
    ok: true,
    set: {
      purpose,
      engine,
      engineVoice: patch.engineVoice === undefined ? current.engineVoice : patch.engineVoice,
      liveLlm,
      elevenLlm: patch.elevenLlm === undefined ? asLlm(current.elevenLlm) : patch.elevenLlm,
    },
  };
}

/**
 * Whether a save can move the number to another Telnyx route (engine line_wiring.py): only
 * the engine or the line type. A voice or LLM change, or the same values sent again, cannot.
 */
export function movesWiring(before: LineEngineFields, after: LineEngineFields): boolean {
  return before.engine !== after.engine || before.purpose !== after.purpose;
}

/**
 * Save the line settings on the account's own number. 404: not that account's real number; 400: refused.
 * `wiringChanged`: the stored engine or line type changed (movesWiring), so the caller re-syncs the wiring.
 */
export async function saveLineEngine(
  accountId: number, numberId: number, patch: LineEnginePatch,
): Promise<{ line: VoiceLine | null; wiringChanged: boolean }> {
  const [{ and, eq, sql }, { db }, { voiceNumbers }, { VoiceLineError, voiceLinesStorage }] = await Promise.all([
    import("drizzle-orm"), import("../db"), import("@shared/schema"), import("./voiceLines"),
  ]);
  const [row] = await db.select().from(voiceNumbers).where(and(
    eq(voiceNumbers.id, numberId), eq(voiceNumbers.accountsId, accountId),
    sql`${voiceNumbers.phoneNumber} ~ '^[+][0-9]+$'`,
  ));
  if (!row) throw new VoiceLineError(404, "No such number.");
  const before = lineFieldsOf(row);
  const result = lineEngineUpdate(before, patch);
  if (!result.ok) throw new VoiceLineError(400, result.message);
  // The account again in the WHERE: a number detached since the read keeps its reset.
  const updated = await db.update(voiceNumbers).set({ ...result.set, updatedAt: new Date() })
    .where(and(eq(voiceNumbers.id, numberId), eq(voiceNumbers.accountsId, accountId)))
    .returning({ id: voiceNumbers.id });
  if (!updated.length) throw new VoiceLineError(404, "No such number.");
  return { line: await voiceLinesStorage.getVoiceLine(accountId), wiringChanged: movesWiring(before, result.set) };
}
