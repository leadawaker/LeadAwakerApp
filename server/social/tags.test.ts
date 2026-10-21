import { test } from "node:test";
import assert from "node:assert/strict";
import { TAG_COLORS, TAG_IDS_MAX, TAG_NAME_MAX } from "@shared/socialStudio";
import { normalizeTagName, parseNewTagBody, parseTagEditBody, parseTagIdsBody, sameTagName, toTagView } from "./tags";

test("normalizeTagName: trims, collapses inner spaces, keeps accents and case", () => {
  assert.equal(normalizeTagName("  Dica   rápida \n"), "Dica rápida");
  assert.equal(normalizeTagName("Saúde"), "Saúde");
});

test("normalizeTagName: empty, blank, too long or not a string is null", () => {
  assert.equal(normalizeTagName(""), null);
  assert.equal(normalizeTagName("   "), null);
  assert.equal(normalizeTagName("x".repeat(TAG_NAME_MAX + 1)), null);
  assert.equal(normalizeTagName("x".repeat(TAG_NAME_MAX)), "x".repeat(TAG_NAME_MAX));
  assert.equal(normalizeTagName(42), null);
});

test("sameTagName ignores case", () => {
  assert.ok(sameTagName("Mitos", "mitos"));
  assert.ok(!sameTagName("Mitos", "Mito"));
});

test("parseNewTagBody: name required, color from the palette, first color by default", () => {
  assert.deepEqual(parseNewTagBody({ name: " Mitos " }), { ok: true, input: { name: "Mitos", color: TAG_COLORS[0] } });
  assert.deepEqual(parseNewTagBody({ name: "Mitos", color: "brick" }), { ok: true, input: { name: "Mitos", color: "brick" } });
  assert.equal(parseNewTagBody({ name: "Mitos", color: "#ff0000" }).ok, false);
  assert.equal(parseNewTagBody({ name: "" }).ok, false);
  assert.equal(parseNewTagBody(null).ok, false);
  assert.equal(parseNewTagBody([]).ok, false);
});

test("parseTagEditBody: a rename, a recolor or both; nothing is refused", () => {
  assert.deepEqual(parseTagEditBody({ name: "Novo" }), { ok: true, input: { name: "Novo" } });
  assert.deepEqual(parseTagEditBody({ color: "teal" }), { ok: true, input: { color: "teal" } });
  assert.equal(parseTagEditBody({}).ok, false);
  assert.equal(parseTagEditBody({ name: "  " }).ok, false);
  assert.equal(parseTagEditBody({ color: "red" }).ok, false);
});

test("parseTagIdsBody: only the account's tags, repeats dropped, empty list allowed", () => {
  const mine = new Set([1, 2, 3]);
  assert.deepEqual(parseTagIdsBody({ tagIds: [2, 1, 2] }, mine), { ok: true, input: [2, 1] });
  assert.deepEqual(parseTagIdsBody({ tagIds: [] }, mine), { ok: true, input: [] });
  assert.equal(parseTagIdsBody({ tagIds: [9] }, mine).ok, false);
  assert.equal(parseTagIdsBody({ tagIds: [1.5] }, mine).ok, false);
  assert.equal(parseTagIdsBody({ tagIds: ["1"] }, mine).ok, false);
  assert.equal(parseTagIdsBody({ tagIds: 1 }, mine).ok, false);
  const many = new Set(Array.from({ length: TAG_IDS_MAX + 1 }, (_, i) => i + 1));
  assert.equal(parseTagIdsBody({ tagIds: [...many] }, many).ok, false);
});

test("toTagView: an unknown stored color falls back to wine", () => {
  const row = { id: 7, accountsId: 56, name: "Saúde", color: "neon", createdAt: new Date() };
  assert.deepEqual(toTagView(row), { id: 7, name: "Saúde", color: "wine" });
  assert.equal(toTagView({ ...row, color: "good" }).color, "good");
});
