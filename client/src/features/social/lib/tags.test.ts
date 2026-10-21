import { test } from "node:test";
import assert from "node:assert/strict";
import { TAG_COLORS } from "@shared/socialStudio";
import { findTagByName, nextTagColor, tagsFor, TAG_COLOR_VAR, toggleTagId } from "./tags";

const tags = [
  { id: 3, name: "Dica rápida", color: "warn" as const },
  { id: 2, name: "Mitos", color: "brick" as const },
  { id: 1, name: "Saúde", color: "good" as const },
];

test("every palette color has a CSS token", () => {
  for (const c of TAG_COLORS) assert.match(TAG_COLOR_VAR[c], /^var\(--[a-z-]+\)$/);
});

test("tagsFor keeps the account's order and skips unknown ids", () => {
  assert.deepEqual(tagsFor([1, 99, 3], tags).map((t) => t.id), [3, 1]);
  assert.deepEqual(tagsFor([], tags), []);
});

test("toggleTagId adds and removes", () => {
  assert.deepEqual(toggleTagId([1], 2), [1, 2]);
  assert.deepEqual(toggleTagId([1, 2], 1), [2]);
});

test("nextTagColor picks an unused color first", () => {
  assert.equal(nextTagColor([]), TAG_COLORS[0]);
  assert.ok(!["warn", "brick", "good"].includes(nextTagColor(tags)));
});

test("findTagByName ignores case and spaces", () => {
  assert.equal(findTagByName(tags, "  mitos ")?.id, 2);
  assert.equal(findTagByName(tags, "dica  RÁPIDA")?.id, 3);
  assert.equal(findTagByName(tags, "Novo"), undefined);
});
