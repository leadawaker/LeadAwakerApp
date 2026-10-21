import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTopicLines, TOPIC_LINE_MAX, TOPICS_PER_SUBMIT } from "./topicLines";
import { parseNewTopicBody } from "./scripts";

test("splitTopicLines: a single line stays one idea, even with several sentences", () => {
  assert.deepEqual(splitTopicLines("  Sono e fome. Tambem menopausa.  "), ["Sono e fome. Tambem menopausa."]);
});

test("splitTopicLines: one idea per line, blank lines dropped, Windows newlines", () => {
  assert.deepEqual(splitTopicLines("one\r\n\r\n  two  \r\n\r\n\r\nthree\n"), ["one", "two", "three"]);
  assert.deepEqual(splitTopicLines("a\rb"), ["a", "b"]);
});

test("splitTopicLines: strips bullets and numbering", () => {
  assert.deepEqual(splitTopicLines("- one\n* two\n• three\n1. four\n2) five\n  12. six"), ["one", "two", "three", "four", "five", "six"]);
});

test("splitTopicLines: keeps text that only looks like a bullet", () => {
  assert.deepEqual(splitTopicLines("-5 graus\n1.5 litros de agua\n2024 foi um ano"), ["-5 graus", "1.5 litros de agua", "2024 foi um ano"]);
});

test("splitTopicLines: a bullet with nothing after it is dropped", () => {
  assert.deepEqual(splitTopicLines("- \n-\nreal idea\n1."), ["real idea"]);
});

test("splitTopicLines: a long line among several is cut at 500, a lone long line is kept whole", () => {
  const long = "palavra ".repeat(120).trim();
  const [a, b] = splitTopicLines(`${long}\nshort`);
  assert.ok(a.length <= TOPIC_LINE_MAX && a.endsWith("…"));
  assert.equal(b, "short");
  assert.equal(splitTopicLines(long)[0], long);
});

test("splitTopicLines: at most 50 per submit, in order", () => {
  const out = splitTopicLines(Array.from({ length: 80 }, (_, i) => `idea ${i + 1}`).join("\n"));
  assert.equal(out.length, TOPICS_PER_SUBMIT);
  assert.equal(out[0], "idea 1");
  assert.equal(out[49], "idea 50");
});

test("parseNewTopicBody: ideas from the text, source kept, empty and oversized refused", () => {
  const ok = parseNewTopicBody({ text: "- a\n- b", source: "voice" });
  assert.ok(ok.ok && ok.input.texts.length === 2 && ok.input.source === "voice");
  assert.equal(parseNewTopicBody({ text: " \n - \n " }).ok, false);
  assert.equal(parseNewTopicBody({ text: "x".repeat(2001) }).ok, false);
  assert.equal(parseNewTopicBody({ text: `${"x".repeat(2001)}\nshort` }).ok, true);
  assert.equal(parseNewTopicBody({ text: "x\n".repeat(20_000) }).ok, false);
  assert.equal(parseNewTopicBody("nope").ok, false);
});
