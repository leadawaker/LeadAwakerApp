import { test } from "node:test";
import assert from "node:assert/strict";
import type { EditableDemoClient } from "../../api/demoClientsApi";
import { buildDraft, buildPatch, draftsEqual, mergeTranslation, shouldApplyTranslation, translateSources } from "./clientDraft";

const emptyText = { en: "", nl: "", pt: "" };
const FIELDS = [
  "nicheLabel", "companyNameTemplate", "serviceName", "usp", "descriptionTemplate", "kbTemplate",
  "nicheQuestion", "enquiryContext", "quoteContext", "quoteSubject", "quoteWhen", "scopingLadder",
  "openerPhrase", "firstMessage", "questionBank", "objectionExamples", "whenLabel",
] as const;
const GROUPS = ["project", "proposal", "decision", "advisor", "visit"] as const;

const editableFixture = {
  id: 7,
  niche: "Meure Auto",
  label: "Car dealer",
  companyName: "Meure",
  category: "Automotive",
  emoji: "🚗",
  bookingModeCall: false,
  isDemoClient: true,
  updatedAt: null,
  screenshot: null,
  socialPost: null,
  socialImage: null,
  products: {},
  stockUrl: null,
  city: null,
  phone: null,
  websiteUrl: null,
  text: Object.fromEntries(FIELDS.map((f) => [f, { ...emptyText }])),
  terms: Object.fromEntries(GROUPS.map((g) => [g, { en: [], nl: [], pt: [] }])),
} as unknown as EditableDemoClient;

function withText(client: EditableDemoClient, field: string, lang: "en" | "nl" | "pt", value: string): EditableDemoClient {
  return { ...client, text: { ...client.text, [field]: { ...(client.text as any)[field], [lang]: value } } } as EditableDemoClient;
}

test("a draft carries products, stock URL, city and phone", () => {
  const d = buildDraft({ ...editableFixture, products: { nl: [{ name: "Golf", detail: "", price: "" }] }, stockUrl: "https://g.nl/v", city: "Rosmalen", phone: null });
  assert.equal(d.products.nl?.[0].name, "Golf");
  assert.equal(d.stockUrl, "https://g.nl/v");
  assert.equal(d.city, "Rosmalen");
  assert.equal(d.phone, "");
  const p = buildPatch(d);
  assert.equal(p.city, "Rosmalen");
  assert.equal(p.phone, null);
  assert.equal(p.stockUrl, "https://g.nl/v");
  assert.deepEqual(p.products, { nl: [{ name: "Golf", detail: "", price: "" }] });
  assert.equal("emoji" in p, false);
});

test("the draft has no emoji", () => {
  assert.equal("emoji" in buildDraft(editableFixture), false);
});

test("blank stock URL, city and phone are sent as null", () => {
  const p = buildPatch({ ...buildDraft(editableFixture), stockUrl: "  ", city: " ", phone: "" });
  assert.equal(p.stockUrl, null);
  assert.equal(p.city, null);
  assert.equal(p.phone, null);
});

test("a stored phone survives an unrelated edit (the editor does not show it)", () => {
  const d = buildDraft({ ...editableFixture, phone: "+31 6 1234 5678" });
  assert.equal(buildPatch(d).phone, "+31 6 1234 5678");
});

test("the draft owns its product rows", () => {
  const client = { ...editableFixture, products: { en: [{ name: "Golf", detail: "", price: "" }] } } as EditableDemoClient;
  const d = buildDraft(client);
  d.products.en![0].name = "Polo";
  assert.equal(client.products.en![0].name, "Golf");
});

test("draftsEqual sees a product edit", () => {
  const a = buildDraft({ ...editableFixture, products: { en: [{ name: "Golf", detail: "", price: "" }] } });
  const b = buildDraft({ ...editableFixture, products: { en: [{ name: "Golf", detail: "", price: "9" }] } });
  assert.equal(draftsEqual(a, a), true);
  assert.equal(draftsEqual(a, b), false);
});

test("translateSources: EN and NL when both exist, the one that exists otherwise", () => {
  const en = withText(editableFixture, "usp", "en", "Family run");
  const both = withText(en, "usp", "nl", "Familiebedrijf");
  assert.deepEqual(translateSources(both, "pt"), ["en", "nl"]);
  assert.deepEqual(translateSources(en, "pt"), ["en"]);
  assert.deepEqual(translateSources(en, "nl"), ["en"]);
  assert.deepEqual(translateSources(withText(editableFixture, "usp", "nl", "x"), "en"), ["nl"]);
});

test("translateSources: the target itself and an empty persona give nothing", () => {
  assert.deepEqual(translateSources(withText(editableFixture, "usp", "nl", "x"), "nl"), []);
  assert.deepEqual(translateSources(editableFixture, "pt"), []);
});

test("translateSources counts terms and products as content", () => {
  const terms = { ...editableFixture, terms: { ...editableFixture.terms, project: { en: [], nl: ["keuken"], pt: [] } } } as EditableDemoClient;
  assert.deepEqual(translateSources(terms, "en"), ["nl"]);
  const products = { ...editableFixture, products: { en: [{ name: "Golf", detail: "", price: "" }] } } as EditableDemoClient;
  assert.deepEqual(translateSources(products, "nl"), ["en"]);
});

test("mergeTranslation fills the empty slots of the target language", () => {
  const d = buildDraft(withText(editableFixture, "usp", "en", "Family run"));
  const next = mergeTranslation(d, "nl", {
    text: { usp: "Familiebedrijf", kbTemplate: "Kennis" },
    terms: { project: ["keuken", "keukenproject"] },
    products: [{ name: "Golf", detail: "5 deurs", price: "EUR 20.000" }],
  });
  assert.equal(next.text.usp?.nl, "Familiebedrijf");
  assert.equal(next.text.usp?.en, "Family run");
  assert.equal(next.text.kbTemplate?.nl, "Kennis");
  assert.equal(next.terms.project?.nl, "keuken, keukenproject");
  assert.equal(next.terms.project?.en, "");
  assert.deepEqual(next.products.nl, [{ name: "Golf", detail: "5 deurs", price: "EUR 20.000" }]);
  assert.equal(draftsEqual(d, next), false);
});

test("mergeTranslation never overwrites what is already there", () => {
  let d = buildDraft(withText(editableFixture, "usp", "nl", "Mijn eigen tekst"));
  d = { ...d, terms: { ...d.terms, project: { ...d.terms.project, nl: "eigen" } }, products: { nl: [{ name: "Mijn", detail: "", price: "" }] } };
  const next = mergeTranslation(d, "nl", {
    text: { usp: "Machine tekst" },
    terms: { project: ["machine"] },
    products: [{ name: "Machine", detail: "", price: "" }],
  });
  assert.equal(next.text.usp?.nl, "Mijn eigen tekst");
  assert.equal(next.terms.project?.nl, "eigen");
  assert.equal(next.products.nl?.[0].name, "Mijn");
});

test("mergeTranslation ignores blank answers and leaves the draft untouched", () => {
  const d = buildDraft(editableFixture);
  const next = mergeTranslation(d, "pt", { text: { usp: "  " }, terms: { project: [] }, products: [] });
  assert.equal(draftsEqual(d, next), true);
  assert.equal(next.products.pt, undefined);
});

test("shouldApplyTranslation: only while the persona that asked is still the one open", () => {
  assert.equal(shouldApplyTranslation("Meure Auto", "Meure Auto"), true);
  assert.equal(shouldApplyTranslation("Meure Auto", "Kitchens"), false);
  assert.equal(shouldApplyTranslation("Meure Auto", ""), false);
});
