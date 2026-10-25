import { test } from "node:test";
import assert from "node:assert/strict";
import { draftBodySchema, langQuery } from "./voicePromptDraftsSchemas";

test("draftBodySchema accepts an empty text for a valid language", () => {
  const r = draftBodySchema.safeParse({ lang: "nl", text: "" });
  assert.equal(r.success, true);
});

test("draftBodySchema accepts both languages", () => {
  for (const lang of ["nl", "en"]) assert.equal(draftBodySchema.safeParse({ lang, text: "x" }).success, true, lang);
});

test("draftBodySchema rejects a language that has no ElevenLabs prompt", () => {
  assert.equal(draftBodySchema.safeParse({ lang: "pt", text: "x" }).success, false);
});

test("draftBodySchema allows 60 000 characters and rejects 60 001", () => {
  assert.equal(draftBodySchema.safeParse({ lang: "en", text: "a".repeat(60_000) }).success, true);
  assert.equal(draftBodySchema.safeParse({ lang: "en", text: "a".repeat(60_001) }).success, false);
});

test("draftBodySchema rejects a missing text or language", () => {
  assert.equal(draftBodySchema.safeParse({ lang: "nl" }).success, false);
  assert.equal(draftBodySchema.safeParse({ text: "x" }).success, false);
});

test("langQuery takes nl or en and rejects undefined", () => {
  assert.equal(langQuery.safeParse("nl").success, true);
  assert.equal(langQuery.safeParse("en").success, true);
  assert.equal(langQuery.safeParse(undefined).success, false);
  assert.equal(langQuery.safeParse("pt").success, false);
});
