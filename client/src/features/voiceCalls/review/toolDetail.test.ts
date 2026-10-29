import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTool, formatMoment, type Say } from "./toolDetail";
import type { ToolFacts } from "./reviewMath";

// English words for the keys the readings use.
const WORDS: Record<string, string> = {
  noneFound: "None found", notInStock: "Not in stock", nothingFree: "Nothing free", booked: "Booked", moved: "Moved", notBooked: "Could not book",
  cancelled: "Cancelled", noAppointment: "No appointment found", callback: "Callback requested", notes: "Notes", ended: "Call ended",
  transferring: "Putting through", transferFailed: "Nobody free", plateNone: "Not found", plateInvalid: "Invalid plate",
  "row.name": "Name", "row.when": "When", "row.type": "Type", "row.reason": "Reason", "row.number": "Number", "kind.visit": "Visit", "kind.callback": "Callback",
};
const say: Say = (key, vars) => {
  if (key === "foundCount") return `${vars?.n} found`;
  if (key === "freeCount") return `${vars?.n} free times`;
  if (key === "more") return `+${vars?.n} more`;
  return WORDS[key] ?? `?${key}`;
};
const d = (name: string, f: ToolFacts) => describeTool(name, f, say, "en");

test("formatMoment: a local time, a date alone, and a spoken moment left as it is", () => {
  assert.match(formatMoment("2026-10-28T16:00", "en"), /Wed/);
  assert.match(formatMoment("2026-10-28T16:00", "en"), /16:00|4:00/);
  assert.doesNotMatch(formatMoment("2026-10-28", "en"), /:/);
  assert.equal(formatMoment("maandag tien uur", "nl"), "maandag tien uur");
});

test("stock search: the ask, how many, the first cars and +N more", () => {
  const r = d("search_stock", { state: "ok", query: "Porsche", items: ["A", "B", "C", "D"], total: 7 });
  assert.equal(r.line, "Porsche · 7 found");
  assert.deepEqual(r.items, ["A", "B", "C", "D"]);
  assert.equal(r.more, "+3 more");
  assert.equal(d("search_stock", { state: "none", query: "Lada", total: 0 }).line, "Lada · None found");
});

test("car details: the car, or that it is not in stock", () => {
  assert.equal(d("car_details", { state: "ok", query: "BMW", title: "BMW 5 Serie, 2022" }).line, "BMW 5 Serie, 2022");
  assert.equal(d("car_details", { state: "none", query: "Lada" }).line, "Lada · Not in stock");
});

test("availability: the day, how many free, times only in the card", () => {
  const r = d("check_availability", { state: "ok", query: "2026-10-28", items: ["2026-10-28T09:00", "2026-10-28T10:00"], total: 6 });
  assert.match(r.line, /6 free times$/);
  assert.deepEqual(r.items, ["09:00", "10:00"]);
  assert.equal(r.more, "+4 more");
  assert.match(d("check_availability", { state: "none", query: "2026-10-29", total: 0 }).line, /Nothing free$/);
});

test("booking: one line with the moment and the name, the card repeats it in full", () => {
  const r = d("book_appointment", { state: "ok", status: "booked", name: "Danique", kind: "visit", at: "2026-10-28T16:00" });
  assert.match(r.line, /^Booked · .*Wed.* · Danique$/);
  assert.deepEqual(r.rows.map((x) => x.label), ["Name", "When", "Type"]);
  assert.equal(r.rows[2].value, "Visit");
  assert.equal(d("book_appointment", { state: "ok", status: "moved", at: "morgen" }).line, "Moved · morgen");
  const bad = d("book_appointment", { state: "failed", status: "not_booked", name: "X" });
  assert.equal(bad.line, "Could not book · X");
  assert.equal(bad.failed, true);
});

test("cancel, callback, notes, end call, transfer, plate", () => {
  assert.equal(d("cancel_appointment", { state: "ok", kind: "callback", at: "dinsdag drie uur" }).line, "Cancelled · Callback · dinsdag drie uur");
  assert.equal(d("cancel_appointment", { state: "none" }).line, "No appointment found");
  const cb = d("request_callback", { state: "ok", when: "morgen", reason: "Panamera", number: "0612345678" });
  assert.equal(cb.line, "Callback requested · morgen · Panamera");
  assert.deepEqual(cb.rows.map((x) => x.label), ["When", "Reason", "Number"]);
  const notes = d("update_call_summary", { state: "ok", items: ["APK", "Lease"], total: 2 });
  assert.equal(notes.line, "Notes · APK, Lease");
  assert.deepEqual([notes.items, notes.more], [[], ""]);
  assert.equal(d("end_call", { state: "ok", reason: "klaar" }).line, "Call ended · klaar");
  assert.equal(d("transfer_to_human", { state: "failed", status: "failed", name: "G" }).line, "Nobody free · G");
  assert.equal(d("transfer_to_human", { state: "ok", status: "checking", name: "G" }).line, "Putting through · G");
  assert.equal(d("rdw_plate_lookup", { state: "ok", query: "04-XS-JZ", title: "grijze Ford" }).line, "04-XS-JZ · grijze Ford");
  assert.equal(d("rdw_plate_lookup", { state: "none", query: "ZZ" }).line, "ZZ · Not found");
});
