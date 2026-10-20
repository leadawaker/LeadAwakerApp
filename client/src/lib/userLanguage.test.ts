import { test } from "node:test";
import assert from "node:assert/strict";
import { languageFromPrefs, shouldHydrateLanguage } from "./userLanguage";

test("reads lang from a JSON string", () => {
  assert.equal(languageFromPrefs('{"lang":"nl"}'), "nl");
});
test("language wins over lang, objects accepted", () => {
  assert.equal(languageFromPrefs({ language: "pt", lang: "nl" }), "pt");
});
test("unsupported language is null", () => {
  assert.equal(languageFromPrefs('{"lang":"de"}'), null);
});
test("bad json and null are null", () => {
  assert.equal(languageFromPrefs("not json"), null);
  assert.equal(languageFromPrefs(null), null);
});

test("shouldHydrateLanguage: only when nothing is stored", () => {
  assert.equal(shouldHydrateLanguage(null, "nl"), "nl");
  assert.equal(shouldHydrateLanguage("", "nl"), "nl");
  assert.equal(shouldHydrateLanguage("en", "nl"), null);
  assert.equal(shouldHydrateLanguage(null, null), null);
});
