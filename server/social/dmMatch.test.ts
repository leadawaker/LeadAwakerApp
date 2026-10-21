import { test } from "node:test";
import assert from "node:assert/strict";
import { isStopMessage, keywordNorm, matchesKeyword, renderFirstMessage } from "./dmMatch";

test("matches like the Socials demo (same cases as client/public/social-demo/social.test.mjs)", () => {
  assert.ok(matchesKeyword("ROOF", "ROOF"));
  assert.ok(matchesKeyword("roof", "ROOF"));
  assert.ok(matchesKeyword("Roof!!", "ROOF"));
  assert.ok(matchesKeyword("roof please 🙏", "ROOF"));
  assert.ok(matchesKeyword("telhádo", "TELHADO"));
  assert.ok(matchesKeyword("telhado", "TELHÁDO"));
  assert.ok(!matchesKeyword("roofing", "ROOF"));
  assert.ok(!matchesKeyword("hello", "ROOF"));
  assert.ok(!matchesKeyword("", "ROOF"));
});

test("the spec's own example: kozijn! matches KOZIJN; digits count; an unusable keyword never matches", () => {
  assert.ok(matchesKeyword("kozijn!", "KOZIJN"));
  assert.ok(matchesKeyword("Quero o GUIA2026 por favor", "guia2026"));
  assert.equal(keywordNorm(" Guia-2026! "), "GUIA2026");
  assert.ok(!matchesKeyword("!!!", "!!!"));
});

test("stop words: alone or almost alone, any case; a sentence that mentions stop is not an opt-out", () => {
  for (const t of ["PARAR", "parar.", "Stop", "sair!", "pare", "stop pls"]) assert.ok(isStopMessage(t), t);
  for (const t of ["", "não quero parar de comer pão, o que faço?", "quando sair o resultado?"]) assert.ok(!isStopMessage(t), t);
});

test("first message template", () => {
  assert.equal(renderFirstMessage("Oi {username}! Aqui está o guia.", { username: "maria.s" }), "Oi @maria.s! Aqui está o guia.");
  assert.equal(renderFirstMessage("Oi {username}! {unknown}Guia.", { username: null }), "Oi ! Guia.");
});
