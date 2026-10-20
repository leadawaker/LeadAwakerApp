import { test } from "node:test";
import assert from "node:assert/strict";
import { readLastTab, writeLastTab } from "./lastTab";

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

test("the first visit opens on the fallback", () => {
  assert.equal(readLastTab("calls", ["stats", "people"] as const, "stats", memory({ leadawaker_user_id: "7" })), "stats");
});

test("each user and page keeps its own last tab", () => {
  const s = memory({ leadawaker_user_id: "7" });
  writeLastTab("calls", "people", s);
  assert.equal(readLastTab("calls", ["stats", "people"] as const, "stats", s), "people");
  assert.equal(readLastTab("chats", ["stats", "chats"] as const, "stats", s), "stats");
  s.m.set("leadawaker_user_id", "8");
  assert.equal(readLastTab("calls", ["stats", "people"] as const, "stats", s), "stats");
});

test("a stored tab that is not allowed (any more) falls back", () => {
  const s = memory({ leadawaker_user_id: "7", "la.lastTab.7.calls": "calls" });
  assert.equal(readLastTab("calls", ["stats", "people"] as const, "stats", s), "stats");
});

test("a throwing or missing storage never breaks the page", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readLastTab("calls", ["stats"] as const, "stats", broken), "stats");
  writeLastTab("calls", "people", broken);
  assert.equal(readLastTab("calls", ["stats"] as const, "stats", null), "stats");
});
