import { test } from "node:test";
import assert from "node:assert/strict";
import { DATE_EMOJI, FALLBACK_EMOJI, UNCATEGORIZED_EMOJI, categoryEmoji } from "./categoryEmoji";

test("every category in the library today has its own fitting emoji", () => {
  const expected: Record<string, string> = {
    Automotive: "🚗",
    "Kitchens & Interiors": "🛋️",
    "Home & Trades": "🛠️",
    "Home Services": "🛠️",
    "Business Services": "💼",
    "Wellness & Leisure": "🧘",
    "Climate & Energy": "⚡",
    "Ciclismo & Mobilidade": "🚴",
    "Marcenaria & Móveis": "🛋️",
    "Coach Training": "🎯",
    "Life-coaching": "🎯",
    "Financial Services": "💰",
  };
  for (const [name, emoji] of Object.entries(expected)) assert.equal(categoryEmoji(name), emoji, name);
});

test("the common niches a new persona may be filed under are covered", () => {
  const expected: Record<string, string> = {
    Dental: "🦷",
    Healthcare: "🩺",
    Clinics: "🩺",
    "Beauty & Hair": "💇",
    "Real estate": "🏠",
    Hospitality: "🍽️",
    Restaurants: "🍽️",
    Fitness: "🏋️",
    Legal: "⚖️",
    Education: "🎓",
    Retail: "🛍️",
  };
  for (const [name, emoji] of Object.entries(expected)) assert.equal(categoryEmoji(name), emoji, name);
});

test("matching ignores case, accents and padding, and also reads Dutch and Portuguese names", () => {
  assert.equal(categoryEmoji("  AUTOMOTIVE "), "🚗");
  assert.equal(categoryEmoji("Tandarts"), "🦷");
  assert.equal(categoryEmoji("Saúde"), "🩺");
  assert.equal(categoryEmoji("Imobiliária"), "🏠");
  assert.equal(categoryEmoji("Educação"), "🎓");
});

test("a word only counts at the start of a word", () => {
  // "author" must not read as "auto"; "legalese" is still legal.
  assert.equal(categoryEmoji("Authors"), FALLBACK_EMOJI);
});

test("unknown names get the fallback, a missing or blank category the folder", () => {
  assert.equal(categoryEmoji("Something new"), FALLBACK_EMOJI);
  assert.equal(categoryEmoji(null), UNCATEGORIZED_EMOJI);
  assert.equal(categoryEmoji(undefined), UNCATEGORIZED_EMOJI);
  assert.equal(categoryEmoji("   "), UNCATEGORIZED_EMOJI);
  assert.equal(DATE_EMOJI, "📅");
});
