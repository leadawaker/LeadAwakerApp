import test from "node:test";
import assert from "node:assert/strict";
import { agentGender, effectiveLlm, effectiveVoice, elevenVoicesFor, needsConfirm, openAiVoiceGroups, pickFits, runsOnEleven, voicesForAgent } from "./lineEngine";
import type { EngineVoice } from "@/features/demos/api/demoSettingsApi";
import type { VoiceNumber } from "./voiceApi";

const THIJMEN: EngineVoice = { id: "thijmen", label: "Thijmen", gender: "male" };
const VOICES: EngineVoice[] = [
  { id: "sanne", label: "Sanne", gender: "female" },
  { id: "daniel", label: "Daniel", gender: "male" },
  THIJMEN,
  { id: "emma", label: "Emma", gender: "female" },
];
const num = (purpose: VoiceNumber["purpose"], engine: VoiceNumber["engine"]): VoiceNumber => (
  { id: 1, phoneNumber: "+31000000000", enabled: true, status: "live", purpose, engine }
);

test("runsOnEleven needs a demo or test line on elevenlabs", () => {
  assert.equal(runsOnEleven(num("test", "elevenlabs")), true);
  assert.equal(runsOnEleven(num("demo", "elevenlabs")), true);
  assert.equal(runsOnEleven(num("client", "elevenlabs")), false);
  assert.equal(runsOnEleven(num("test", null)), false);
  assert.equal(runsOnEleven(num(undefined, undefined)), false);
  assert.equal(runsOnEleven(null), false);
});

test("agentGender follows the line voice", () => {
  assert.equal(agentGender("ripple"), "male");
  assert.equal(agentGender("marin"), "female");
  assert.equal(agentGender(null), null);
  assert.equal(agentGender("unknown"), null);
});

test("voicesForAgent keeps the agent's gender, or everything when unknown", () => {
  assert.ok(voicesForAgent(VOICES, "ripple").every((v) => v.gender === "male"));
  assert.equal(voicesForAgent(VOICES, "ripple").length, 2);
  assert.ok(voicesForAgent(VOICES, "marin").every((v) => v.gender === "female"));
  assert.equal(voicesForAgent(VOICES, null).length, VOICES.length);
});

test("pickFits flags a voice of the other gender", () => {
  assert.equal(pickFits("thijmen", VOICES, "marin"), false);
  assert.equal(pickFits("thijmen", VOICES, "ripple"), true);
  assert.equal(pickFits(null, VOICES, "marin"), true);
  assert.equal(pickFits("thijmen", VOICES, null), true);
});

test("pickFits rejects an unknown pick id when the agent's gender is known", () => {
  assert.equal(pickFits("nobody", VOICES, "marin"), false);
  assert.equal(pickFits("nobody", VOICES, "ripple"), false);
  assert.equal(pickFits("nobody", VOICES, null), true);
  assert.equal(pickFits("thijmen", [], "marin"), false);
});

test("effectiveVoice swaps a voice of the other gender like the engine", () => {
  assert.equal(effectiveVoice("marin", "male"), "vesper");
  assert.equal(effectiveVoice("ripple", "male"), "ripple");
  assert.equal(effectiveVoice("ripple", "female"), "marin");
  assert.equal(effectiveVoice("coral", "female"), "coral");
  assert.equal(effectiveVoice("ripple", null), "ripple");
  assert.equal(effectiveVoice(null, "male"), "vesper");
  assert.equal(effectiveVoice(null, null), "");
});

test("openAiVoiceGroups offers only the set gender, both when automatic", () => {
  assert.deepEqual(openAiVoiceGroups(null).map((g) => g.gender), ["female", "male"]);
  const male = openAiVoiceGroups("male");
  assert.deepEqual(male.map((g) => g.gender), ["male"]);
  assert.ok(male[0].voices.includes("ripple") && !male[0].voices.includes("marin"));
});

test("openAiVoiceGroups keeps a saved voice of the other gender visible", () => {
  const male = openAiVoiceGroups("male", "marin");
  assert.ok(male[0].voices.includes("marin"));
  assert.ok(!openAiVoiceGroups("female", "marin")[0].voices.includes("vesper"));
  assert.equal(openAiVoiceGroups(null, "marin")[0].voices.filter((v) => v === "marin").length, 1);
});

test("elevenVoicesFor follows the set gender, else the line voice, else offers all", () => {
  assert.ok(elevenVoicesFor(VOICES, "male", "marin").every((v) => v.gender === "male"));
  assert.ok(elevenVoicesFor(VOICES, "female", "ripple").every((v) => v.gender === "female"));
  assert.ok(elevenVoicesFor(VOICES, null, "ripple").every((v) => v.gender === "male"));
  assert.equal(elevenVoicesFor(VOICES, null, null).length, VOICES.length);
  assert.equal(elevenVoicesFor(VOICES, "male", null).length, 2);
});

test("elevenVoicesFor keeps a saved pick of the other gender", () => {
  const list = elevenVoicesFor(VOICES, "female", null, "thijmen");
  assert.ok(list.some((v) => v.id === "thijmen"));
  assert.equal(list.length, 3);
  assert.equal(elevenVoicesFor(VOICES, "female", null, "nobody").length, 2);
});

test("effectiveLlm is sol when unset or unknown, else the stored key for that engine", () => {
  const line = (liveLlm: unknown, elevenLlm: unknown = null) => ({ ...num("client", null), liveLlm, elevenLlm }) as VoiceNumber;
  assert.equal(effectiveLlm(line(null), "gpt-live"), "sol");
  assert.equal(effectiveLlm(line("terra"), "gpt-live"), "terra");
  assert.equal(effectiveLlm(line("luna"), "gpt-live"), "luna");
  assert.equal(effectiveLlm(line("gpt-9"), "gpt-live"), "sol");
  assert.equal(effectiveLlm({ ...num("client", null) }, "gpt-live"), "sol");
  assert.equal(effectiveLlm(null, "gpt-live"), "sol");
  assert.equal(effectiveLlm(line("terra", "luna"), "elevenlabs"), "luna");
});

test("needsConfirm: only the language model of a client line asks first", () => {
  assert.equal(needsConfirm("client", "liveLlm"), true);
  assert.equal(needsConfirm("demo", "liveLlm"), false);
  assert.equal(needsConfirm("test", "liveLlm"), false);
  assert.equal(needsConfirm(undefined, "liveLlm"), false);
});

test("elevenVoicesFor shows only the line language's voices, Portugal on the Brazilian ones", () => {
  const voices = [
    { id: "v", label: "Vincent", gender: "male", locale: "nl" },
    { id: "g", label: "George", gender: "male", locale: "en-GB" },
    { id: "p", label: "Paulo", gender: "male", locale: "pt-BR" },
  ] as const;
  assert.deepEqual(elevenVoicesFor([...voices], "male", null, null, "nl").map((v) => v.id), ["v"]);
  assert.deepEqual(elevenVoicesFor([...voices], "male", null, null, "pt-PT").map((v) => v.id), ["p"]);
  assert.deepEqual(elevenVoicesFor([...voices], "male", null, "g", "nl").map((v) => v.id), ["v", "g"]);  // the saved pick stays
});
