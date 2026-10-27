import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTranslatePrompt,
  coerceTranslation,
  translateSource,
  validateTranslation,
  type TranslateSource,
} from "./demoTranslate";

const src: TranslateSource = {
  text: { kbTemplate: "Open ma-za.", firstMessage: "Hoi {first_name}" },
  terms: { project: ["auto"] },
  products: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
};

test("the prompt names the target language and keeps placeholders", () => {
  const p = buildTranslatePrompt(src, "nl", "pt");
  assert.match(p.system, /Brazilian Portuguese/);
  assert.match(p.system, /Dutch/);
  assert.match(p.system, /never European/);
  assert.match(p.user, /\{first_name\}/);
  assert.match(buildTranslatePrompt(src, "nl", "en").system, /into English/);
  assert.match(buildTranslatePrompt(src, "en", "nl").system, /from English into Dutch/);
});

test("the prompt carries no em dash", () => {
  const p = buildTranslatePrompt(src, "nl", "pt");
  assert.equal((p.system + p.user).includes(String.fromCharCode(0x2014)), false);
});

test("validateTranslation accepts the same keys and rejects a mismatch", () => {
  const ok = validateTranslation(src);
  assert.equal(
    ok({
      text: { kbTemplate: "Abre", firstMessage: "Oi {first_name}" },
      terms: { project: ["carro"] },
      products: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
    }),
    null,
  );
  assert.notEqual(ok({ text: { kbTemplate: "Abre" }, terms: {}, products: [] }), null);
});

test("validateTranslation rejects non-objects, blank text, non-array terms and bad products", () => {
  const ok = validateTranslation(src);
  const good = {
    text: { kbTemplate: "Abre", firstMessage: "Oi {first_name}" },
    terms: { project: ["carro"] },
    products: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
  };
  assert.notEqual(ok(null), null);
  assert.notEqual(ok({ ...good, text: { kbTemplate: "  ", firstMessage: "Oi" } }), null);
  assert.notEqual(ok({ ...good, text: { kbTemplate: 3, firstMessage: "Oi" } }), null);
  assert.notEqual(ok({ ...good, terms: { project: "carro" } }), null);
  assert.notEqual(ok({ ...good, terms: {} }), null);
  assert.notEqual(ok({ ...good, products: [{ name: "" }] }), null);
  assert.notEqual(ok({ ...good, products: [] }), null);
});

test("validateTranslation allows a source with no products or terms", () => {
  const bare: TranslateSource = { text: { kbTemplate: "Open" }, terms: {}, products: [] };
  assert.equal(validateTranslation(bare)({ text: { kbTemplate: "Abre" }, terms: {}, products: [] }), null);
});

test("coerceTranslation cleans products and drops empty text and terms", () => {
  assert.equal(coerceTranslation({ text: {}, terms: {}, products: [{ name: " A " }] }).products[0].name, "A");
  const out = coerceTranslation({
    text: { kbTemplate: " Abre ", firstMessage: "  ", bogus: "x" },
    terms: { project: [" carro ", "", "carro"], bogus: ["x"] },
    products: [],
  });
  assert.deepEqual(out.text, { kbTemplate: "Abre" });
  assert.deepEqual(out.terms, { project: ["carro"] });
});

test("translateSource keeps only the non-empty slots of the source language", () => {
  const editable = {
    text: {
      kbTemplate: { nl: "Open ma-za.", en: "Open Mon-Sat." },
      firstMessage: { nl: "  " },
      usp: { en: "Fast" },
    },
    terms: {
      project: { nl: ["auto", " ", "wagen"], en: [] },
      proposal: { nl: [], en: ["quote"] },
    },
    products: {
      nl: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
      en: [],
    },
  } as never;
  assert.deepEqual(translateSource(editable, "nl"), {
    text: { kbTemplate: "Open ma-za." },
    terms: { project: ["auto", "wagen"] },
    products: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
  });
  assert.deepEqual(translateSource(editable, "en"), {
    text: { kbTemplate: "Open Mon-Sat.", usp: "Fast" },
    terms: { proposal: ["quote"] },
    products: [],
  });
});

test("validateTranslation rejects an answer that drops a {placeholder} or adds a key", () => {
  const ok = validateTranslation(src);
  const good = {
    text: { kbTemplate: "Abre", firstMessage: "Oi {first_name}" },
    terms: { project: ["carro"] },
    products: [{ name: "Golf 8", detail: "2021", price: "€ 1" }],
  };
  assert.match(ok({ ...good, text: { ...good.text, firstMessage: "Oi {nome}" } }) ?? "", /first_name/);
  assert.match(ok({ ...good, text: { ...good.text, usp: "Rapido" } }) ?? "", /usp/);
  assert.match(ok({ ...good, terms: { ...good.terms, visit: ["visita"] } }) ?? "", /visit/);
});

test("coerceTranslation keeps the source price on each product", () => {
  const out = coerceTranslation(
    { text: {}, terms: {}, products: [{ name: "Golf 8", detail: "2021", price: "EUR 1,00" }] },
    src,
  );
  assert.deepEqual(out.products, [{ name: "Golf 8", detail: "2021", price: "€ 1" }]);
});

test("the prompt asks for the register of the target language", () => {
  assert.match(buildTranslatePrompt(src, "en", "nl").system, /informal "je"/);
  assert.match(buildTranslatePrompt(src, "nl", "pt").system, /você/);
});
