import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_CATEGORIES, parsePromptCategoryInput } from "./promptCategories";

test("every known area is accepted, trimmed and lowercased", () => {
  for (const c of PROMPT_CATEGORIES) {
    assert.deepEqual(parsePromptCategoryInput(c), { ok: true, value: c });
  }
  assert.deepEqual(parsePromptCategoryInput("  voice "), { ok: true, value: "voice" });
  assert.deepEqual(parsePromptCategoryInput("CRM"), { ok: true, value: "crm" });
});

test("a missing category is left alone, an empty one clears it", () => {
  assert.deepEqual(parsePromptCategoryInput(undefined), { ok: true, value: undefined });
  assert.deepEqual(parsePromptCategoryInput(null), { ok: true, value: null });
  assert.deepEqual(parsePromptCategoryInput("   "), { ok: true, value: null });
});

test("unknown areas and non-strings are rejected", () => {
  for (const bad of ["campaign", "system", "niche", "chat2", 5, true, {}, ["chat"]]) {
    assert.equal(parsePromptCategoryInput(bad).ok, false, String(bad));
  }
});
