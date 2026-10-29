import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canDeletePersona,
  formatPersonaDate,
  groupPersonas,
  listLayout,
  parseGroupBy,
  personaDate,
  sortNewest,
} from "./personaView";

const mk = (niche: string, over: Record<string, unknown> = {}) =>
  ({
    id: 1, niche, label: niche, companyName: "", category: null, createdAt: null, updatedAt: null,
    isDemoClient: true, isLive: false, ...over,
  }) as any;

const NOW = new Date("2026-10-28T12:00:00Z");

test("a persona is dated by when it was saved, else when it last changed, else not at all", () => {
  assert.equal(personaDate(mk("a", { createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" })), "2026-10-01T00:00:00Z");
  assert.equal(personaDate(mk("a", { updatedAt: "2026-10-20T00:00:00Z" })), "2026-10-20T00:00:00Z");
  assert.equal(personaDate(mk("a")), "");
});

test("newest first, undated last, ties by name; the input is not changed", () => {
  const a = mk("alpha", { createdAt: "2026-10-01T00:00:00Z" });
  const b = mk("bravo", { createdAt: "2026-10-26T00:00:00Z" });
  const c = mk("charlie");
  const d = mk("delta", { createdAt: "2026-10-26T00:00:00Z" });
  const input = [c, a, d, b];
  assert.deepEqual(sortNewest(input).map((x) => x.niche), ["bravo", "delta", "alpha", "charlie"]);
  assert.deepEqual(input.map((x) => x.niche), ["charlie", "alpha", "delta", "bravo"]);
});

test("by category: sections A to Z with Uncategorized last, newest first inside each", () => {
  const items = [
    mk("old auto", { category: "Automotive", createdAt: "2026-09-01T00:00:00Z" }),
    mk("none", { category: null, createdAt: "2026-10-27T00:00:00Z" }),
    mk("new auto", { category: "Automotive", createdAt: "2026-10-26T00:00:00Z" }),
    mk("kitchens", { category: "Kitchens", createdAt: "2026-06-25T00:00:00Z" }),
    mk("blank", { category: "  ", createdAt: "2026-10-01T00:00:00Z" }),
  ];
  const groups = groupPersonas(items, "category", { now: NOW });
  assert.deepEqual(groups.map((g) => g.key), ["Automotive", "Kitchens", "__uncategorized__"]);
  assert.deepEqual(groups[0].items.map((x) => x.niche), ["new auto", "old auto"]);
  assert.deepEqual(groups[2].items.map((x) => x.niche), ["none", "blank"]);
  assert.equal(groups[0].kind, "category");
  assert.equal(groups[0].category, "Automotive");
  assert.equal(groups[2].category, null);
});

test("a category a user names Uncategorized does not collide with the empty bucket", () => {
  const groups = groupPersonas([mk("x", { category: "Uncategorized" }), mk("y")], "category", { now: NOW });
  assert.deepEqual(groups.map((g) => g.key), ["Uncategorized", "__uncategorized__"]);
});

test("by date: Today, Yesterday, This week, then months, newest first; undated last", () => {
  const items = [
    mk("june", { createdAt: "2026-06-25T10:00:00Z", category: "Home" }),
    mk("today", { createdAt: "2026-10-28T08:00:00Z" }),
    mk("yesterday", { createdAt: "2026-10-27T08:00:00Z" }),
    mk("undated"),
    mk("oct early", { createdAt: "2026-10-02T08:00:00Z" }),
    mk("oct late", { createdAt: "2026-10-12T08:00:00Z" }),
  ];
  const groups = groupPersonas(items, "date", { now: NOW, timeZone: "UTC", locale: "en" });
  assert.deepEqual(groups.map((g) => g.key), ["today", "yesterday", "2026-10", "2026-06", "unknown"]);
  assert.deepEqual(groups[2].items.map((x) => x.niche), ["oct late", "oct early"]);
  assert.equal(groups[2].kind, "date");
  assert.equal(groups[2].monthLabel, "October 2026");
  assert.equal(groups[0].monthLabel, null);
  assert.equal(groups[0].category, null);
});

test("no personas, no groups", () => {
  assert.deepEqual(groupPersonas([], "category", { now: NOW }), []);
  assert.deepEqual(groupPersonas([], "date", { now: NOW }), []);
});

test("the remembered grouping falls back to date for anything else", () => {
  assert.equal(parseGroupBy("date"), "date");
  assert.equal(parseGroupBy("category"), "category");
  assert.equal(parseGroupBy(null), "date");
  assert.equal(parseGroupBy("weeks"), "date");
});

test("the row date is day and month, with the year only when it is not this year", () => {
  assert.equal(formatPersonaDate("2026-10-26T10:00:00Z", NOW, "en"), "26 Oct");
  assert.match(formatPersonaDate("2025-03-03T10:00:00Z", NOW, "en"), /2025/);
  assert.equal(formatPersonaDate("", NOW, "en"), "");
  assert.equal(formatPersonaDate("not a date", NOW, "en"), "");
});

test("only a saved, non-live persona can be deleted from the list", () => {
  assert.equal(canDeletePersona(mk("a")), true);
  assert.equal(canDeletePersona(mk("pack", { isDemoClient: false })), false);
  assert.equal(canDeletePersona(mk("live", { isLive: true })), false);
  assert.equal(canDeletePersona({ ...mk("old"), isDemoClient: undefined }), false);
});

test("the list is cards side by side until a persona is open, then a vertical list beside the editor", () => {
  assert.equal(listLayout(null), "cards");
  assert.equal(listLayout("dental-clinic"), "rows");
  // An empty string is no persona (the editor needs a real niche to open).
  assert.equal(listLayout(""), "cards");
});
