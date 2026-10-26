import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CELLS, diffCounts, lineDiff } from "./lineDiff";

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

test("a change too big for the table shows the middle as all removed, then all added", () => {
  const common = Array.from({ length: 2098 }, (_, i) => `line ${i}`);
  const before = ["x", ...common, "y"].join("\n");
  const after = ["p", ...common, "q"].join("\n");
  assert.ok(2100 * 2100 > MAX_CELLS);
  const lines = lineDiff(`keep\n${before}\nend`, `keep\n${after}\nend`);
  assert.equal(lines.length, 2 + 2100 + 2100);
  assert.deepEqual(lines[0], { kind: "same", text: "keep" });
  assert.ok(lines.slice(1, 2101).every((l) => l.kind === "del"));
  assert.ok(lines.slice(2101, 4201).every((l) => l.kind === "add"));
  assert.deepEqual(lines[4201], { kind: "same", text: "end" });
  assert.deepEqual(diffCounts(lines), { added: 2100, removed: 2100 });
});
