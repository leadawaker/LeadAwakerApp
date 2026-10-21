import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImprovePrompt, IMPROVE_NOTES_MAX, normalizeParagraphs, parseImproveAnswer, parseImproveBody } from "./scriptImprove";

const prompt = (over: Partial<Parameters<typeof buildImprovePrompt>[0]>) =>
  buildImprovePrompt({ voiceGuide: "GUIDE", aboutMe: "CRM 123", language: "Portuguese", title: "Menopausa", notes: "", body: "", closesUsed: [], ...over });

test("improve body: text and notes trimmed, limits enforced, title optional", () => {
  assert.deepEqual(parseImproveBody({ body: " Olá\r\nmundo ", notes: " mais curto " }), { ok: true, input: { body: "Olá\nmundo", notes: "mais curto", title: null } });
  assert.deepEqual(parseImproveBody({}), { ok: true, input: { body: "", notes: "", title: null } });
  const t = parseImproveBody({ title: " Novo título " });
  assert.ok(t.ok && t.input.title === "Novo título");
  assert.equal(parseImproveBody({ notes: "x".repeat(IMPROVE_NOTES_MAX + 1) }).ok, false);
  assert.equal(parseImproveBody({ body: "x".repeat(20_001) }).ok, false);
  assert.equal(parseImproveBody({ body: 5 }).ok, false);
  assert.equal(parseImproveBody([]).ok, false);
});

test("improve prompt: voice guide first, About me kept, paragraphs asked for, notes followed", () => {
  const p = prompt({ body: "Texto atual", notes: "abrir com uma pergunta", closesUsed: ["Close A"] });
  assert.match(p.system, /^GUIDE/);
  assert.match(p.system, /CRM 123/);
  assert.match(p.system, /Brazilian Portuguese/);
  assert.match(p.system, /separated by one blank line/);
  assert.match(p.user, /^Improve the current script/);
  assert.match(p.user, /<notes>\nabrir com uma pergunta\n<\/notes>/);
  assert.match(p.user, /<draft>\nTexto atual\n<\/draft>/);
  assert.match(p.user, /Theme: Menopausa/);
  assert.match(p.user, /- Close A/);
  assert.doesNotMatch(p.user, /Notes from the agency/, "the notes appear once");
});

test("improve prompt: an empty body is written from the title and notes", () => {
  const p = prompt({ notes: "falar de sono" });
  assert.match(p.user, /^There is no text yet: write the script from the theme and the notes/);
  assert.doesNotMatch(p.user, /<draft>/);
  assert.doesNotMatch(prompt({}).user, /<notes>/);
});

test("paragraphs: blank lines kept as one, single breaks become paragraphs, long block split in pairs", () => {
  assert.equal(normalizeParagraphs("Um.  \r\n\r\n\r\n  Dois.\n\nTrês."), "Um.\n\nDois.\n\nTrês.");
  assert.equal(normalizeParagraphs("Um.\nDois.\nTrês."), "Um.\n\nDois.\n\nTrês.");
  assert.equal(normalizeParagraphs("Linha um\nlinha dois\n\nOutro."), "Linha um\nlinha dois\n\nOutro.", "breaks inside a paragraph stay");
  assert.equal(normalizeParagraphs("Você sabia? Eu sou médico. Hoje falo de sono. Durma bem! Até logo."),
    "Você sabia? Eu sou médico.\n\nHoje falo de sono. Durma bem!\n\nAté logo.");
  assert.equal(normalizeParagraphs("Curto. Muito curto."), "Curto. Muito curto.", "short text stays one paragraph");
  assert.equal(normalizeParagraphs("Isso \u2014 sim \u2014 importa."), "Isso, sim, importa.");
  assert.equal(normalizeParagraphs("   \n  "), "");
});

test("improve answer: JSON parsed, body in paragraphs, empty body refused", () => {
  assert.deepEqual(parseImproveAnswer('{"title":"Sono","body":"Um.\\nDois."}'), { title: "Sono", body: "Um.\n\nDois." });
  assert.equal(parseImproveAnswer('{"title":"Sono","body":"  "}'), null);
  assert.equal(parseImproveAnswer("nope"), null);
});
