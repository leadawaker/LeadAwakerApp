import { test } from "node:test";
import assert from "node:assert/strict";
import { toolFacts } from "./voiceToolFacts";

// Shapes as the engine wrote them (Voice_Call_Events, 2026-10).

test("search_stock: the filters or text asked, the first cars without plates, how many there were", () => {
  const cars = [1, 2, 3, 4, 5].map((n) => `Porsche Cayenne ${n}, 2021, 132.878 km, zwart, € 55.490, kenteken K-285-KP`);
  const f = toolFacts("search_stock", { query: "Porsche" }, { cars, count: 7, status: "ok" });
  assert.equal(f?.state, "ok");
  assert.equal(f?.query, "Porsche");
  assert.equal(f?.items?.length, 4);
  assert.equal(f?.items?.[0], "Porsche Cayenne 1, 2021, 132.878 km, zwart, € 55.490");
  assert.equal(f?.total, 7);
});

test("search_stock: no text falls back to the filters; nothing found is none", () => {
  const f = toolFacts("search_stock", { fuel: "diesel", max_km: 80000, max_price: 0, min_price: 0, query: "" }, { cars: [], count: 0, status: "none" });
  assert.equal(f?.state, "none");
  assert.equal(f?.query, "diesel, ≤ 80.000 km");
  assert.equal(f?.total, 0);
  assert.equal(f?.items, undefined);
});

test("car_details: the title from the truncated result, plate cut", () => {
  const truncated = JSON.stringify({ status: "found", car: "status: te koop\n# BMW 5 Serie Touring, 2022, 57.826 km, € 42.990, kenteken HXZ-54-X\npagina: https://x.test/" }).slice(0, 120);
  const f = toolFacts("car_details", { query: "BMW 5" }, { truncated, status: undefined });
  assert.equal(f?.title, "BMW 5 Serie Touring, 2022, 57.826 km, € 42.990");
  const whole = toolFacts("car_details", { query: "BMW 5" }, { status: "found", car: "# Volvo XC90, 2022\nrest" });
  assert.equal(whole?.title, "Volvo XC90, 2022");
  assert.equal(toolFacts("car_details", { query: "x" }, { status: "not_found" })?.state, "none");
});

test("check_availability: the date, the first free times, how many; a full day is none", () => {
  const free_slots = Array.from({ length: 9 }, (_, i) => ({ say: "spoken", start: `2026-10-28T${String(8 + i).padStart(2, "0")}:00` }));
  const f = toolFacts("check_availability", { date: "2026-10-28", kind: "visit" }, { status: "ok", free_slots });
  assert.equal(f?.query, "2026-10-28");
  assert.deepEqual(f?.items, ["2026-10-28T08:00", "2026-10-28T09:00", "2026-10-28T10:00", "2026-10-28T11:00"]);
  assert.equal(f?.total, 9);
  assert.equal(JSON.stringify(f).includes("spoken"), false);
  assert.equal(toolFacts("check_availability", { date: "2026-10-29" }, { status: "day_full", free_slots: [] })?.state, "none");
});

test("book_appointment: name, kind and the local time; spoken slot when that is all there is; not_booked fails", () => {
  const f = toolFacts("book_appointment", { kind: "visit", name: "Danique", start: "2026-10-28T16:00" },
    { iso: "2026-10-28T16:00:00+01:00", kind: "visit", slot: "woensdag acht", start: "2026-10-28T16:00", status: "booked" });
  assert.deepEqual(f, { state: "ok", status: "booked", name: "Danique", kind: "visit", at: "2026-10-28T16:00" });
  const spoken = toolFacts("book_appointment", { name: "Gabriel", preferred_day: "maandag" }, { slot: "maandag zesentwintig oktober om tien uur", status: "booked" });
  assert.equal(spoken?.at, "maandag zesentwintig oktober om tien uur");
  assert.equal(toolFacts("book_appointment", { name: "X" }, { status: "not_booked" })?.state, "failed");
  assert.equal(toolFacts("book_appointment", { name: "X" }, { status: "moved", start: "2026-10-30T10:00" })?.status, "moved");
});

test("cancel_appointment and request_callback", () => {
  assert.deepEqual(toolFacts("cancel_appointment", { kind: "visit", reason: "changed mind" }, { slot: "dinsdag drie uur", status: "cancelled" }),
    { state: "ok", status: "cancelled", kind: "visit", at: "dinsdag drie uur", reason: "changed mind" });
  assert.equal(toolFacts("cancel_appointment", { kind: "visit" }, { detail: "No upcoming appointment", status: "none" })?.state, "none");
  const cb = toolFacts("request_callback", { when: "morgen", reason: "terugbellen", callback_number: "" },
    { detail: "Tell the caller ... do not call it booked.", status: "noted" });
  assert.deepEqual(cb, { state: "ok", status: "noted", when: "morgen", reason: "terugbellen" });
  // The AI's instructions in `detail` never reach the facts.
  assert.equal(JSON.stringify(cb).includes("Tell the caller"), false);
});

test("update_call_summary, end_call, transfer_to_human, rdw_plate_lookup", () => {
  const notes = toolFacts("update_call_summary", { name: "Denise", items: [{ intent: "callback_now", interest: "Buying a pick-up", notes: "long private notes" }] }, { ok: true });
  assert.deepEqual(notes, { state: "ok", name: "Denise", items: ["Buying a pick-up"], total: 1 });
  assert.equal(JSON.stringify(notes).includes("private"), false);
  assert.deepEqual(toolFacts("end_call", { reason: "klaar", kind: "robocall" }, { ok: true }), { state: "ok", reason: "klaar" });
  assert.deepEqual(toolFacts("transfer_to_human", { reason: "Audi A6", caller_name: "Gabriel" }, { status: "failed", message: "Er is niemand vrij" }),
    { state: "failed", status: "failed", name: "Gabriel", reason: "Audi A6" });
  assert.equal(toolFacts("transfer_to_human", { reason: "x" }, { status: "checking", detail: "..." })?.state, "ok");
  const plate = toolFacts("rdw_plate_lookup", { plate: "04XSJZ" }, { car: { make: "Ford" }, plate: "04-XS-JZ", status: "found", summary: "grijze Ford Fiesta uit 2007, benzine", reply_hint: "secret" });
  assert.deepEqual(plate, { state: "ok", status: "found", query: "04-XS-JZ", title: "grijze Ford Fiesta uit 2007, benzine" });
  assert.equal(toolFacts("rdw_plate_lookup", { plate: "ZZ" }, { status: "invalid_plate" })?.state, "failed");
});

test("an error fails the tool; results as JSON text and namespaced names work; unknown tools give null", () => {
  assert.equal(toolFacts("end_call", { reason: "x" }, null, "boom")?.state, "failed");
  assert.equal(toolFacts("functions.Book_Appointment", { name: "A" }, JSON.stringify({ status: "booked", slot: "morgen" }))?.at, "morgen");
  assert.equal(toolFacts("get_opening_hours", {}, { ok: true }), null);
  assert.equal(toolFacts(null, {}, {}), null);
});

test("long text is cut short and secrets in other fields are never copied", () => {
  const f = toolFacts("request_callback", { when: "asap", reason: "x".repeat(400), api_key: "sk-123", headers: { authorization: "Bearer y" } }, { status: "noted" });
  assert.ok((f?.reason ?? "").length <= 160);
  const json = JSON.stringify(f);
  assert.equal(json.includes("sk-123"), false);
  assert.equal(json.includes("Bearer"), false);
});
