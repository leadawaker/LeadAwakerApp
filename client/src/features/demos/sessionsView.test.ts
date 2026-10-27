import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FILTERS, compareRows, folderGroups, isFilterActive, rowMatches, visibleRows } from "./sessionsView";
import { row, session } from "./demoTestFixtures";

const live = row({ key: "live", hasLinks: true, expired: false });
const dead = row({ key: "dead", hasLinks: true, expired: true });
const empty = row({ key: "empty", hasLinks: false });

test("the default filter hides rows whose links are all expired and keeps empty rows", () => {
  assert.deepEqual([live, dead, empty].filter((r) => rowMatches(r, DEFAULT_FILTERS, "")), [live, empty]);
});

test("the Expired filter shows only expired rows", () => {
  assert.deepEqual([live, dead, empty].filter((r) => rowMatches(r, { ...DEFAULT_FILTERS, expired: true }, "")), [dead]);
});

test("search is trimmed, case-insensitive, and covers first name, company and client", () => {
  assert.equal(rowMatches(row({ companyName: "Smit Dental" }), DEFAULT_FILTERS, "  smit "), true);
  assert.equal(rowMatches(row({ firstName: "Anna" }), DEFAULT_FILTERS, "ANN"), true);
  assert.equal(rowMatches(row({ clientNiche: "Bakery" }), DEFAULT_FILTERS, "bak"), true);
  assert.equal(rowMatches(row({ firstName: "Anna", companyName: "X", clientNiche: "Y" }), DEFAULT_FILTERS, "zzz"), false);
});

test("activity filters", () => {
  const never = row({ hasLinks: true, opened: false });
  const opened = row({ hasLinks: true, opened: true });
  const replied = row({ hasLinks: true, opened: true, replies: 2 });
  const f = (activity: "opened" | "replied" | "never") => ({ ...DEFAULT_FILTERS, activity });
  assert.equal(rowMatches(never, f("never"), ""), true);
  assert.equal(rowMatches(opened, f("never"), ""), false);
  assert.equal(rowMatches(opened, f("opened"), ""), true);
  assert.equal(rowMatches(never, f("opened"), ""), false);
  assert.equal(rowMatches(replied, f("replied"), ""), true);
  assert.equal(rowMatches(opened, f("replied"), ""), false);
  assert.equal(rowMatches(empty, f("never"), ""), false);
});

test("client and service filters", () => {
  assert.equal(rowMatches(row({ clientNiche: "Bakery" }), { ...DEFAULT_FILTERS, client: "Bakery" }, ""), true);
  assert.equal(rowMatches(row({ clientNiche: "Dental" }), { ...DEFAULT_FILTERS, client: "Bakery" }, ""), false);
  assert.equal(rowMatches(row({ byService: {} }), { ...DEFAULT_FILTERS, service: "voice" }, ""), false);
  assert.equal(rowMatches(row({ byService: { voice: session() } }), { ...DEFAULT_FILTERS, service: "voice" }, ""), true);
});

test("isFilterActive is false only for the defaults", () => {
  assert.equal(isFilterActive(DEFAULT_FILTERS), false);
  assert.equal(isFilterActive({ ...DEFAULT_FILTERS, activity: "opened" }), true);
  assert.equal(isFilterActive({ ...DEFAULT_FILTERS, expired: true }), true);
  assert.equal(isFilterActive({ ...DEFAULT_FILTERS, client: "x" }), true);
  assert.equal(isFilterActive({ ...DEFAULT_FILTERS, service: "dbr" }), true);
});

test("sorts: newest, prospect, company, activity (nulls last)", () => {
  const a = row({ key: "a", firstName: "Zoe", companyName: "Acme", createdAt: "2026-10-01T00:00:00Z", lastActivityAt: null });
  const b = row({ key: "b", firstName: "Adam", companyName: "Zed", createdAt: "2026-10-03T00:00:00Z", lastActivityAt: "2026-10-05T00:00:00Z" });
  const c = row({ key: "c", firstName: "Mia", companyName: "Mid", createdAt: null, lastActivityAt: "2026-10-09T00:00:00Z" });
  const keys = (sort: "newest" | "prospect" | "company" | "activity") => [a, b, c].sort(compareRows(sort)).map((r) => r.key);
  assert.deepEqual(keys("newest"), ["b", "a", "c"]);
  assert.deepEqual(keys("prospect"), ["b", "c", "a"]);
  assert.deepEqual(keys("company"), ["a", "c", "b"]);
  assert.deepEqual(keys("activity"), ["c", "b", "a"]);
});

test("visibleRows filters then sorts, flat", () => {
  assert.deepEqual(
    visibleRows([row({ key: "a", lastActivityAt: null }), row({ key: "b", lastActivityAt: "2026-10-01T00:00:00Z" })], DEFAULT_FILTERS, "", "activity").map((r) => r.key),
    ["b", "a"],
  );
  assert.deepEqual(visibleRows([live, dead, empty], DEFAULT_FILTERS, "", "newest").map((r) => r.key).sort(), ["empty", "live"]);
});

test("folderGroups groups by client, sorted by name, with the no-client group last", () => {
  const groups = folderGroups([row({ key: "1", clientNiche: "" }), row({ key: "2", clientNiche: "Bakery" }), row({ key: "3", clientNiche: "Alpha" })], DEFAULT_FILTERS, "", "newest");
  assert.deepEqual([...groups.keys()], ["Alpha", "Bakery", ""]);
  assert.deepEqual(groups.get("")!.map((r) => r.key), ["1"]);
});
