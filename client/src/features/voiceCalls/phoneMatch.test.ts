import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneMatches } from "./phoneMatch";

test("national, international and bare forms find an international number", () => {
  for (const q of ["0612345678", "+31612345678", "0031612345678", "612345678", "06 12 34"]) {
    assert.equal(phoneMatches("+31 6 12345678", q), true, q);
  }
});

test("an international query finds a number stored in national form", () => {
  assert.equal(phoneMatches("0612345678", "+31612345678"), true);
  assert.equal(phoneMatches("0612345678", "+31 6123"), false);
});

test("non-matching or empty queries do not match", () => {
  assert.equal(phoneMatches("+31612345678", "0699"), false);
  assert.equal(phoneMatches("+31612345678", "abc"), false);
  assert.equal(phoneMatches(null, "0612"), false);
});
