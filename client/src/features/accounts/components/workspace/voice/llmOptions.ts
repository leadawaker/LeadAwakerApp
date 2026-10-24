// The GPT Live language models a line can run (keys match the engine's LLM_KEYS).
// Pure: the Voice tab's line settings card, the test panel and their tests share this.
import type { TFunction } from "i18next";

export const LLM_KEYS = ["sol", "terra", "luna"] as const;
export type LlmKey = (typeof LLM_KEYS)[number];

/** A stored key as a valid LlmKey; anything else (null, unknown) is Sol, the default. */
export function asLlmKey(v: unknown): LlmKey {
  return (LLM_KEYS as readonly unknown[]).includes(v) ? (v as LlmKey) : "sol";
}

/** The pick's display name (voiceTab namespace). */
export function llmLabel(t: TFunction, key: LlmKey): string {
  return t(`lineEngine.llm.${key}`);
}
