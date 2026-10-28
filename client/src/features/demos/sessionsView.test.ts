import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SORT,
  ariaSort,
  compareRows,
  dateSections,
  groupsByDate,
  nextSort,
  type SessionSort,
  type SortKey,
} from "./sessionsView";
import { row, session, surface } from "./demoTestFixtures";

const asc = (key: SortKey): SessionSort => ({ key, dir: "asc" });
const desc = (key: SortKey): SessionSort => ({ key, dir: "desc" });
const order = (rows: ReturnType<typeof row>[], sort: SessionSort) => [...rows].sort(compareRows(sort)).map((r) => r.key);

test("the default sort is Sent, newest first", () => {
  assert.deepEqual(DEFAULT_SORT, { key: "sent", dir: "desc" });
});

test("Sent sorts by when the newest link went out, a missing date last in either direction", () => {
  const a = row({ key: "a", createdAt: "2026-10-01T00:00:00Z" });
  const b = row({ key: "b", createdAt: "2026-10-03T00:00:00Z" });
  const c = row({ key: "c", createdAt: null });
  assert.deepEqual(order([a, b, c], desc("sent")), ["b", "a", "c"]);
  assert.deepEqual(order([a, b, c], asc("sent")), ["a", "b", "c"]);
});

test("Last activity sorts by date, a missing date last in either direction", () => {
  const a = row({ key: "a", lastActivityAt: null });
  const b = row({ key: "b", lastActivityAt: "2026-10-05T00:00:00Z" });
  const c = row({ key: "c", lastActivityAt: "2026-10-09T00:00:00Z" });
  assert.deepEqual(order([a, b, c], desc("lastActivity")), ["c", "b", "a"]);
  assert.deepEqual(order([a, b, c], asc("lastActivity")), ["b", "c", "a"]);
});

test("text columns sort A to Z or Z to A, an empty value last in either direction", () => {
  const a = row({ key: "a", firstName: "Zoe", companyName: "Acme" });
  const b = row({ key: "b", firstName: "adam", companyName: "" });
  const c = row({ key: "c", firstName: "Mia", companyName: "Mid" });
  assert.deepEqual(order([a, b, c], asc("prospect")), ["b", "c", "a"]);
  assert.deepEqual(order([a, b, c], desc("prospect")), ["a", "c", "b"]);
  assert.deepEqual(order([a, b, c], asc("company")), ["a", "c", "b"]);
  assert.deepEqual(order([a, b, c], desc("company")), ["c", "a", "b"]);
});

const opened = { ...surface, opened: true, openedAt: "2026-10-02T00:00:00Z" };
const replied = { ...opened, replies: 1 };

test("a link column ranks no link < expired < never opened < opened < replied", () => {
  const none = row({ key: "none" });
  const expired = row({ key: "expired", byService: { speed: session({ expired: true }) } });
  const never = row({ key: "never", byService: { speed: session() } });
  const open = row({ key: "open", byService: { speed: session({ browser: opened }) } });
  const reply = row({ key: "reply", byService: { speed: session({ browser: replied }) } });
  const all = [open, none, reply, never, expired];
  assert.deepEqual(order(all, asc("speed")), ["none", "expired", "never", "open", "reply"]);
  assert.deepEqual(order(all, desc("speed")), ["reply", "open", "never", "expired", "none"]);
});

test("the DBR / Quote column ranks by the further of its two links", () => {
  const dbrOnly = row({ key: "dbr", byService: { dbr: session({ browser: opened }) } });
  const both = row({ key: "both", byService: { dbr: session(), quote: session({ browser: replied }) } });
  const never = row({ key: "never", byService: { quote: session() } });
  assert.deepEqual(order([never, dbrOnly, both], desc("dbrQuote")), ["both", "dbr", "never"]);
});

test("equal values fall back to the newest sent first, whatever the direction", () => {
  const a = row({ key: "a", firstName: "Sam", createdAt: "2026-10-01T00:00:00Z" });
  const b = row({ key: "b", firstName: "Sam", createdAt: "2026-10-03T00:00:00Z" });
  assert.deepEqual(order([a, b], asc("prospect")), ["b", "a"]);
  assert.deepEqual(order([a, b], desc("prospect")), ["b", "a"]);
});

test("nextSort: a new column starts text A to Z and dates, link columns newest or furthest first; the same column flips", () => {
  assert.deepEqual(nextSort(DEFAULT_SORT, "prospect"), asc("prospect"));
  assert.deepEqual(nextSort(DEFAULT_SORT, "company"), asc("company"));
  assert.deepEqual(nextSort(asc("prospect"), "lastActivity"), desc("lastActivity"));
  assert.deepEqual(nextSort(asc("prospect"), "voice"), desc("voice"));
  assert.deepEqual(nextSort(asc("prospect"), "prospect"), desc("prospect"));
  assert.deepEqual(nextSort(desc("prospect"), "prospect"), asc("prospect"));
  assert.deepEqual(nextSort(DEFAULT_SORT, "sent"), asc("sent"));
});

test("ariaSort names the direction on the sorted column and none elsewhere", () => {
  assert.equal(ariaSort(asc("company"), "company"), "ascending");
  assert.equal(ariaSort(desc("company"), "company"), "descending");
  assert.equal(ariaSort(desc("company"), "prospect"), "none");
});

// Wednesday 28 October 2026, 12:00 UTC.
const now = new Date("2026-10-28T12:00:00Z");
const opts = { now, timeZone: "UTC", locale: "en" };
const dated = (key: string, createdAt: string | null) => row({ key, createdAt });
const sample = [
  dated("today", "2026-10-28T09:00:00Z"),
  dated("yesterday", "2026-10-27T09:00:00Z"),
  dated("week", "2026-10-26T09:00:00Z"),
  dated("last", "2026-10-21T09:00:00Z"),
  dated("sept", "2026-09-10T09:00:00Z"),
  dated("none", null),
];

test("dateSections groups newest first, a row with no date in the last group", () => {
  const groups = dateSections([...sample].sort(compareRows(DEFAULT_SORT)), DEFAULT_SORT, opts);
  assert.deepEqual(groups.map((g) => g.key), ["today", "yesterday", "thisWeek", "lastWeek", "2026-09", "unknown"]);
  assert.deepEqual(groups.map((g) => g.items.map((r) => r.key)), [["today"], ["yesterday"], ["week"], ["last"], ["sept"], ["none"]]);
  assert.equal(groups[4].monthLabel, "September 2026");
});

test("dateSections runs oldest group first for Sent oldest first, the undated group still last", () => {
  const groups = dateSections([...sample].sort(compareRows(asc("sent"))), asc("sent"), opts);
  assert.deepEqual(groups.map((g) => g.key), ["2026-09", "lastWeek", "thisWeek", "yesterday", "today", "unknown"]);
});

test("under another sort the groups stay newest first and the rows inside follow the sort", () => {
  const rows = [
    row({ key: "z", firstName: "Zoe", createdAt: "2026-10-28T09:00:00Z" }),
    row({ key: "a", firstName: "Ann", createdAt: "2026-10-28T08:00:00Z" }),
    row({ key: "old", firstName: "Bo", createdAt: "2026-10-21T08:00:00Z" }),
  ];
  const groups = dateSections(rows.sort(compareRows(asc("prospect"))), asc("prospect"), opts);
  assert.deepEqual(groups.map((g) => g.key), ["today", "lastWeek"]);
  assert.deepEqual(groups[0].items.map((r) => r.key), ["a", "z"]);
});

test("the table shows date groups only while it is sorted by Sent", () => {
  assert.equal(groupsByDate(desc("sent")), true);
  assert.equal(groupsByDate(asc("sent")), true);
  assert.equal(groupsByDate(asc("prospect")), false);
  assert.equal(groupsByDate(desc("lastActivity")), false);
});
