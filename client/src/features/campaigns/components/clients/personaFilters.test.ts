import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PERSONA_FILTERS,
  hasActiveFilters,
  hasMenuFilters,
  languageCounts,
  personaCategories,
  personaMatches,
} from "./personaFilters";

const c = { niche: "Meure Auto", label: "Car dealer", companyName: "Meure", category: "Automotive", languages: ["nl"], source: "website", liveTokens: 0 } as any;
const kitchen = { niche: "kitchens", label: "Kitchens", companyName: "", category: "Home & Trades", languages: ["en", "nl"], source: "manual", liveTokens: 2 } as any;
const bare = { niche: "words", label: "", companyName: "", category: null, languages: [], source: "manual", liveTokens: 0 } as any;

test("the default filters match everything", () => {
  assert.equal(personaMatches(c, DEFAULT_PERSONA_FILTERS), true);
  assert.equal(personaMatches(bare, DEFAULT_PERSONA_FILTERS), true);
});

test("source narrows to website or manual", () => {
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, source: "manual" }), false);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, source: "website" }), true);
});

test("category must equal the persona's category, empty means any", () => {
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, category: "Home & Trades" }), false);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, category: "Automotive" }), true);
  assert.equal(personaMatches(bare, { ...DEFAULT_PERSONA_FILTERS, category: "Automotive" }), false);
});

test("language keeps personas written in it", () => {
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, lang: "en" }), false);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, lang: "nl" }), true);
});

test("search covers niche, label, company and category, ignoring case and padding", () => {
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, search: "meure" }), true);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, search: "  CAR DEALER " }), true);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, search: "automo" }), true);
  assert.equal(personaMatches(c, { ...DEFAULT_PERSONA_FILTERS, search: "bakery" }), false);
});

test("extra texts (a persona's prospects) also match the search, and only the search", () => {
  const search = (q: string) => ({ ...DEFAULT_PERSONA_FILTERS, search: q });
  assert.equal(personaMatches(c, search("anna"), ["Anna", "Smit Dental"]), true);
  assert.equal(personaMatches(c, search("  SMIT "), ["Anna", "Smit Dental"]), true);
  assert.equal(personaMatches(c, search("zoe"), ["Anna", "Smit Dental"]), false);
  assert.equal(personaMatches(c, search("meure"), ["Anna"]), true);
  assert.equal(personaMatches(c, DEFAULT_PERSONA_FILTERS, ["Anna"]), true);
  // Language, source and category still apply to a persona found through a prospect.
  assert.equal(personaMatches(c, { ...search("anna"), lang: "en" }, ["Anna"]), false);
});

test("all four filters combine", () => {
  const f = { search: "meure", category: "Automotive", lang: "nl", source: "website" } as const;
  assert.equal(personaMatches(c, f), true);
  assert.equal(personaMatches(c, { ...f, source: "manual" }), false);
});

test("categories are the distinct filed names, sorted, without blanks", () => {
  assert.deepEqual(personaCategories([c, kitchen, bare, { ...c, niche: "x" }]), ["Automotive", "Home & Trades"]);
});

test("language counts cover every persona once per language", () => {
  assert.deepEqual(languageCounts([c, kitchen, bare]), { all: 3, en: 1, nl: 2, pt: 0 });
});

test("hasActiveFilters ignores padding in the search", () => {
  assert.equal(hasActiveFilters(DEFAULT_PERSONA_FILTERS), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_PERSONA_FILTERS, search: "  " }), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_PERSONA_FILTERS, source: "manual" }), true);
});

test("the Filter button's dot ignores the search, which has its own field", () => {
  assert.equal(hasMenuFilters(DEFAULT_PERSONA_FILTERS), false);
  assert.equal(hasMenuFilters({ ...DEFAULT_PERSONA_FILTERS, search: "meure" }), false);
  assert.equal(hasMenuFilters({ ...DEFAULT_PERSONA_FILTERS, lang: "nl" }), true);
  assert.equal(hasMenuFilters({ ...DEFAULT_PERSONA_FILTERS, category: "Automotive" }), true);
  assert.equal(hasMenuFilters({ ...DEFAULT_PERSONA_FILTERS, source: "website" }), true);
});
