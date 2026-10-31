// The test panel's picks (engine tab, GPT Live LLM), per browser and
// per line. Test only: they never change what real callers get. They start from the
// line's saved settings; a pick is kept until the line's own setting for that field
// changes, then the panel follows the line again. Pure apart from the storage passed in.
import { effectiveLlm } from "../lineEngine";
import { LLM_KEYS, type LlmKey } from "../llmOptions";
import type { VoiceNumber } from "../voiceApi";

export type TestEngine = "gpt-live" | "elevenlabs";
export const TEST_ENGINES: TestEngine[] = ["gpt-live", "elevenlabs"];

export interface TestPrefs {
  engine: TestEngine;
  llm: LlmKey;
}

/** The part of Storage this needs, so the tests can pass their own (or a throwing one). */
export type PrefsStorage = Pick<Storage, "getItem" | "setItem">;

/** What is stored: the picks, and the line settings they were made against. */
interface StoredPrefs { picks: Partial<TestPrefs>; from: Partial<TestPrefs> }

const VALID: { [K in keyof TestPrefs]: readonly TestPrefs[K][] } = {
  engine: TEST_ENGINES,
  llm: LLM_KEYS,
};
const FIELDS = Object.keys(VALID) as (keyof TestPrefs)[];

export function prefsKey(accountId: number, lineId: number | null | undefined): string {
  return `leadawaker.voiceTest.prefs.${accountId}.${lineId ?? "none"}`;
}

/** The line's saved settings as test picks. */
export function defaultTestPrefs(n: VoiceNumber | null | undefined): TestPrefs {
  return {
    engine: n?.engine === "elevenlabs" ? "elevenlabs" : "gpt-live",
    llm: effectiveLlm(n, "gpt-live"),
  };
}

/** localStorage, or null where reading it throws (private mode, blocked site data). */
export function browserStorage(): PrefsStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function valid<K extends keyof TestPrefs>(field: K, v: unknown): v is TestPrefs[K] {
  return (VALID[field] as readonly unknown[]).includes(v);
}

/** Copies one stored field if it is valid and still made against the line's current setting. */
function keep<K extends keyof TestPrefs>(out: TestPrefs, stored: StoredPrefs, defaults: TestPrefs, field: K): void {
  const pick = stored.picks[field];
  if (valid(field, pick) && stored.from?.[field] === defaults[field]) out[field] = pick;
}

export function loadTestPrefs(storage: PrefsStorage | null, key: string, defaults: TestPrefs): TestPrefs {
  let stored: StoredPrefs | null = null;
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") stored = parsed as StoredPrefs;
  } catch {
    stored = null;
  }
  const out = { ...defaults };
  if (!stored?.picks) return out;
  // A pick is kept only while the line still has the setting it was made against.
  for (const f of FIELDS) keep(out, stored, defaults, f);
  return out;
}

export function saveTestPrefs(storage: PrefsStorage | null, key: string, prefs: TestPrefs, defaults: TestPrefs): void {
  const value: StoredPrefs = { picks: prefs, from: defaults };
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: the pick holds for this visit only */
  }
}
