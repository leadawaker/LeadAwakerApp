import { test } from "node:test";
import assert from "node:assert/strict";
import { upsertLangSlot } from "./clientStore";

const post = (keyword: string) => ({
  handle: "h", caption: "c", keyword, cta_line: `x ${keyword}`, dm_opener: "{agent_name}{disclosure_clause}",
  offer: "o", image_prompt: "i", likes: 100,
});

test("adds a language without touching the others", () => {
  const next = upsertLangSlot({ en: post("ROOF") }, "pt", post("TELHADO"));
  assert.equal(next.en?.keyword, "ROOF");
  assert.equal(next.pt?.keyword, "TELHADO");
});

test("works from null", () => {
  assert.deepEqual(Object.keys(upsertLangSlot(null, "nl", post("DAK"))), ["nl"]);
});

test("replaces the same language", () => {
  assert.equal(upsertLangSlot({ nl: post("DAK") }, "nl", post("DAKEN")).nl?.keyword, "DAKEN");
});
