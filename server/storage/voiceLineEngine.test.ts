import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_ELEVEN_ALLOWED, DETACHED_LINE, ELEVEN_LLM_SUPPORTED, LLM_KEYS, lineEngineUpdate, lineFieldsOf,
  type LineEngineFields,
} from "./voiceLineEngine";

const THIJMEN = "Thijmen01";
const NO_LLM = { liveLlm: null, elevenLlm: null };
const CLIENT: LineEngineFields = { purpose: "client", engine: null, engineVoice: null, ...NO_LLM };
const ELEVEN_TEST: LineEngineFields = { purpose: "test", engine: "elevenlabs", engineVoice: THIJMEN, ...NO_LLM };

test("a client line refuses an engine pick", () => {
  assert.equal(lineEngineUpdate(CLIENT, { engine: "elevenlabs" }).ok, false);
  assert.equal(lineEngineUpdate(CLIENT, { engineVoice: THIJMEN }).ok, false);
});

test("becoming client clears the pick", () => {
  const r = lineEngineUpdate(ELEVEN_TEST, { purpose: "client" });
  assert.deepEqual(r.ok && r.set, DETACHED_LINE);
});

test("purpose and pick in one patch", () => {
  const r = lineEngineUpdate(CLIENT, { purpose: "test", engine: "elevenlabs", engineVoice: THIJMEN, ...NO_LLM });
  assert.deepEqual(r.ok && r.set, { purpose: "test", engine: "elevenlabs", engineVoice: THIJMEN, ...NO_LLM });
});

test("gpt-live clears the voice", () => {
  const r = lineEngineUpdate(ELEVEN_TEST, { engine: "gpt-live" });
  assert.deepEqual(r.ok && r.set, { purpose: "test", engine: null, engineVoice: null, ...NO_LLM });
});

test("only the five line columns are written (ElevenLabs has one agent: no model column)", () => {
  const r = lineEngineUpdate(ELEVEN_TEST, { engineVoice: THIJMEN });
  assert.deepEqual(r.ok && Object.keys(r.set).sort(), ["elevenLlm", "engine", "engineVoice", "liveLlm", "purpose"]);
});

test("a detached line is client with no pick", () => {
  assert.deepEqual(DETACHED_LINE, { purpose: "client", engine: null, engineVoice: null, ...NO_LLM });
});

test("a purpose change alone keeps a demo line's pick", () => {
  const r = lineEngineUpdate(ELEVEN_TEST, { purpose: "demo" });
  assert.deepEqual(r.ok && r.set, { ...ELEVEN_TEST, purpose: "demo" });
});

test("a client line may be set to gpt-live or cleared", () => {
  const r = lineEngineUpdate(CLIENT, { engine: "gpt-live", engineVoice: null });
  assert.deepEqual(r.ok && r.set, CLIENT);
});

test("an unknown stored purpose counts as client", () => {
  const odd = { ...ELEVEN_TEST, purpose: "weird" } as unknown as LineEngineFields;
  assert.equal(lineEngineUpdate(odd, { engine: "elevenlabs" }).ok, false);
});

test("the LLM keys are sol, terra and luna", () => {
  assert.deepEqual([...LLM_KEYS], ["sol", "terra", "luna"]);
});

test("a client line may pick the real-call LLM and keeps it when the pick is cleared", () => {
  const r = lineEngineUpdate(CLIENT, { liveLlm: "terra" });
  assert.deepEqual(r.ok && r.set, { ...CLIENT, liveLlm: "terra" });
  const again = lineEngineUpdate({ ...CLIENT, liveLlm: "terra" }, { engine: "gpt-live" });
  assert.deepEqual(again.ok && again.set.liveLlm, "terra");
  const toNull = lineEngineUpdate({ ...CLIENT, liveLlm: "terra" }, { liveLlm: null });
  assert.deepEqual(toNull.ok && toNull.set.liveLlm, null);
});

test("a demo or test line keeps its LLM when the engine flips to gpt-live", () => {
  const r = lineEngineUpdate({ ...ELEVEN_TEST, liveLlm: "luna" }, { engine: "gpt-live" });
  assert.deepEqual(r.ok && r.set, { purpose: "test", engine: null, engineVoice: null, liveLlm: "luna", elevenLlm: null });
});

test("an ElevenLabs LLM pick is refused while ElevenLabs manages its own", () => {
  assert.equal(ELEVEN_LLM_SUPPORTED, false);
  assert.equal(lineEngineUpdate(ELEVEN_TEST, { elevenLlm: "terra" }).ok, false);
  assert.equal(lineEngineUpdate(ELEVEN_TEST, { elevenLlm: null }).ok, true);
});

test("a client line may pick ElevenLabs only when the engine allows it", () => {
  assert.equal(CLIENT_ELEVEN_ALLOWED, false);
  assert.equal(lineEngineUpdate(CLIENT, { engine: "elevenlabs" }).ok, false);
});

test("lineFieldsOf reads the LLM columns and treats unknown keys as unset", () => {
  const row = { purpose: "client", engine: null, engineVoice: null };
  assert.deepEqual(lineFieldsOf({ ...row, liveLlm: "luna", elevenLlm: "bogus" }), { ...CLIENT, liveLlm: "luna" });
  assert.deepEqual(lineFieldsOf({ ...row, liveLlm: null, elevenLlm: null }), CLIENT);
});

test("only an engine or line type change moves the wiring", async () => {
  const { movesWiring } = await import("./voiceLineEngine");
  const DEMO_GPT: LineEngineFields = { purpose: "demo", engine: null, engineVoice: null, ...NO_LLM };
  // Same engine and type sent again, a voice or an LLM change: no Telnyx re-sync.
  assert.equal(movesWiring(ELEVEN_TEST, { ...ELEVEN_TEST }), false);
  assert.equal(movesWiring(ELEVEN_TEST, { ...ELEVEN_TEST, engineVoice: "Other01" }), false);
  assert.equal(movesWiring(CLIENT, { ...CLIENT, liveLlm: "terra" }), false);
  // A real engine or type change does.
  assert.equal(movesWiring(DEMO_GPT, { ...DEMO_GPT, engine: "elevenlabs", engineVoice: THIJMEN }), true);
  assert.equal(movesWiring(ELEVEN_TEST, { ...ELEVEN_TEST, purpose: "demo" }), true);
  assert.equal(movesWiring(ELEVEN_TEST, DETACHED_LINE), true);
});
