import test from "node:test";
import assert from "node:assert/strict";
import { defaultTestPrefs, loadTestPrefs, prefsKey, saveTestPrefs, type PrefsStorage } from "./testPanelPrefs";
import type { VoiceNumber } from "../voiceApi";

const num = (over: Partial<VoiceNumber> = {}): VoiceNumber => (
  { id: 7, phoneNumber: "+31000000000", enabled: true, status: "live", purpose: "test", ...over }
);

function memory(): PrefsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
  };
}

const throwing: PrefsStorage = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
};

test("defaults follow the line's saved engine and LLM", () => {
  assert.deepEqual(defaultTestPrefs(num({ engine: "elevenlabs", liveLlm: "terra" })),
    { engine: "elevenlabs", llm: "terra" });
  assert.deepEqual(defaultTestPrefs(num({ engine: "gpt-live", liveLlm: null })),
    { engine: "gpt-live", llm: "sol" });
  assert.deepEqual(defaultTestPrefs(null), { engine: "gpt-live", llm: "sol" });
});

test("nothing stored: the line's defaults", () => {
  const d = defaultTestPrefs(num({ engine: "elevenlabs", liveLlm: "luna" }));
  assert.deepEqual(loadTestPrefs(memory(), "k", d), d);
});

test("a throwing localStorage falls back to the defaults and never throws", () => {
  const d = defaultTestPrefs(num({ liveLlm: "terra" }));
  assert.deepEqual(loadTestPrefs(throwing, "k", d), d);
  assert.doesNotThrow(() => saveTestPrefs(throwing, "k", { engine: "elevenlabs", llm: "luna" }, d));
  assert.deepEqual(loadTestPrefs(null, "k", d), d);
  assert.doesNotThrow(() => saveTestPrefs(null, "k", d, d));
});

test("a saved pick survives a reload", () => {
  const s = memory();
  const d = defaultTestPrefs(num());
  const picked = { engine: "elevenlabs", llm: "luna" } as const;
  saveTestPrefs(s, "k", picked, d);
  assert.deepEqual(loadTestPrefs(s, "k", d), picked);
});

test("a changed line setting wins over a pick made against the old one", () => {
  const s = memory();
  const before = defaultTestPrefs(num({ liveLlm: "sol" }));
  saveTestPrefs(s, "k", { ...before, engine: "elevenlabs", llm: "luna" }, before);
  // The line's LLM moved to Terra since: the panel follows it, the other pick stays.
  const after = defaultTestPrefs(num({ liveLlm: "terra" }));
  assert.deepEqual(loadTestPrefs(s, "k", after), { engine: "elevenlabs", llm: "terra" });
});

test("garbage or unknown values in storage are ignored field by field", () => {
  const s = memory();
  const d = defaultTestPrefs(num());
  s.setItem("k", "{not json");
  assert.deepEqual(loadTestPrefs(s, "k", d), d);
  s.setItem("k", JSON.stringify({ picks: { engine: "xai", llm: "luna" }, from: d }));
  assert.deepEqual(loadTestPrefs(s, "k", d), { ...d, llm: "luna" });
});

test("the key is per account and line", () => {
  assert.notEqual(prefsKey(1, 7), prefsKey(1, 8));
  assert.notEqual(prefsKey(1, null), prefsKey(2, null));
});
