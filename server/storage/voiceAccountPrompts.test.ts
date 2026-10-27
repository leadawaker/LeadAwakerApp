import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://test@127.0.0.1:1/none"; // never connected: no query runs here
const { elevenLangOf } = await import("./voiceAccountPrompts");

test("each locale shows the ElevenLabs row the engine reads (eleven_template.template_lang)", () => {
  assert.equal(elevenLangOf("nl"), "nl");
  assert.equal(elevenLangOf("en-GB"), "en");
  assert.equal(elevenLangOf("pt-BR"), "pt");
  assert.equal(elevenLangOf("pt-PT"), "pt");
});
