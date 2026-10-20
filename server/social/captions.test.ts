import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaptionPrompt, languageName, parseCaptionOptions, suggestCaptions, type AiComplete } from "./captions";

const style = "Hook: a patient question in quotes. 3 to 5 hashtags. Close: agende sua avaliação (link na bio).";

test("the prompt carries the style, the profile, the language and the script", () => {
  const p = buildCaptionPrompt({ source: { kind: "script", text: "Você em casa que está tentando emagrecer..." }, captionStyle: style, aboutMe: "CRM 28148/SC", language: "Portuguese" });
  assert.match(p.system, /Brazilian Portuguese/);
  assert.match(p.system, /agende sua avaliação/);
  assert.match(p.system, /CRM 28148\/SC/);
  assert.match(p.system, /Never promise results/);
  assert.match(p.user, /The video's script/);
  assert.match(p.user, /Você em casa/);
});

test("without a saved style the prompt still asks for a sober caption, and a topic line is labelled as such", () => {
  const p = buildCaptionPrompt({ source: { kind: "about", text: "Fome e sono" }, captionStyle: "  ", aboutMe: "", language: null });
  assert.match(p.system, /No style saved yet/);
  assert.match(p.system, /in English/);
  assert.doesNotMatch(p.system, /About the account holder/);
  assert.match(p.user, /What the video is about/);
});

test("languageName maps account languages", () => {
  assert.equal(languageName("pt-BR"), "Brazilian Portuguese");
  assert.equal(languageName("Dutch"), "Dutch");
  assert.equal(languageName(undefined), "English");
});

test("parses three options from plain or fenced JSON", () => {
  assert.deepEqual(parseCaptionOptions('{"options":["a #x","b","c"]}'), ["a #x", "b", "c"]);
  assert.deepEqual(parseCaptionOptions('Here you go:\n```json\n{"options":[" one ","two","three"]}\n```'), ["one", "two", "three"]);
});

test("drops empty, duplicate, non-string and over-limit options, keeps at most three", () => {
  const tooManyTags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
  const text = JSON.stringify({ options: ["", "same", "same", 7, tooManyTags, "x".repeat(2201), "ok 1", "ok 2", "ok 3"] });
  assert.deepEqual(parseCaptionOptions(text), ["same", "ok 1", "ok 2"]);
});

test("garbage gives no options", () => {
  assert.deepEqual(parseCaptionOptions("Sorry, I cannot help"), []);
  assert.deepEqual(parseCaptionOptions('{"captions":["a"]}'), []);
});

test("suggestCaptions: fake model, success and every failure", async () => {
  const calls: Array<{ model: string; jsonSchema?: object }> = [];
  const ok: AiComplete = async (o) => { calls.push(o); return { text: '{"options":["1","2","3"]}' }; };
  const input = { source: { kind: "script" as const, text: "texto" }, captionStyle: style, aboutMe: "", language: "pt" };
  assert.deepEqual(await suggestCaptions(ok, input), { ok: true, options: ["1", "2", "3"] });
  assert.equal(calls[0].model, "sonnet");
  assert.ok(calls[0].jsonSchema);

  assert.deepEqual(await suggestCaptions(ok, { ...input, source: { kind: "about", text: "  " } }), { ok: false, reason: "no_input" });
  assert.equal(calls.length, 1, "no model call without input");
  assert.deepEqual(await suggestCaptions(async () => ({ error: "timed out" }), input), { ok: false, reason: "ai_failed" });
  assert.deepEqual(await suggestCaptions(async () => ({ text: "nope" }), input), { ok: false, reason: "no_options" });
});
