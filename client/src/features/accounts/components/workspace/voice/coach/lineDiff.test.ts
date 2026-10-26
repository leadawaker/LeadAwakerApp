import test from "node:test";
import assert from "node:assert/strict";
import { diffCounts, lineDiff } from "./lineDiff";

test("identical texts give only unchanged lines", () => {
  const lines = lineDiff("a\nb\nc", "a\nb\nc");
  assert.ok(lines.length === 3);
  assert.ok(lines.every((l) => l.kind === "same"));
});

test("a changed line is a deletion followed by an addition", () => {
  assert.deepEqual(lineDiff("a\nb\nc", "a\nx\nc"), [
    { kind: "same", text: "a" },
    { kind: "del", text: "b" },
    { kind: "add", text: "x" },
    { kind: "same", text: "c" },
  ]);
});

test("an empty text before gives only additions", () => {
  assert.deepEqual(lineDiff("", "a"), [{ kind: "add", text: "a" }]);
});

test("an empty text after gives only deletions", () => {
  assert.deepEqual(lineDiff("a\nb", ""), [{ kind: "del", text: "a" }, { kind: "del", text: "b" }]);
});

test("diffCounts counts added and removed lines", () => {
  assert.deepEqual(diffCounts(lineDiff("a\nb\nc", "a\nx\nc")), { added: 1, removed: 1 });
  assert.deepEqual(diffCounts(lineDiff("a", "a")), { added: 0, removed: 0 });
});

test("deletions come before additions across a longer change", () => {
  const kinds = lineDiff("keep\nold1\nold2\nend", "keep\nnew1\nend").map((l) => l.kind);
  assert.deepEqual(kinds, ["same", "del", "del", "add", "same"]);
});
