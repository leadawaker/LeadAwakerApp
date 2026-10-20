import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecklist } from "./checklist";

const base = { prefs: {}, recipients: [], userEmail: null, userPhone: null, standalone: false };
const done = (r: ReturnType<typeof buildChecklist>) => r.items.map((i) => i.done);

test("empty prefs: nothing done, visible", () => {
  const r = buildChecklist(base);
  assert.deepEqual(done(r), [false, false, false, false]);
  assert.equal(r.visible, true);
  assert.equal(r.allDone, false);
});

test("alerts done on email match ignoring case and spaces", () => {
  const r = buildChecklist({ ...base, recipients: [{ email: " Thijs@Robben.NL " }], userEmail: "thijs@robben.nl" });
  assert.equal(r.items[1].done, true);
});

test("alerts done on phone match ignoring formatting", () => {
  const r = buildChecklist({ ...base, recipients: [{ phone: "+31 6 81 76 47 63" }], userPhone: "+31681764763" });
  assert.equal(r.items[1].done, true);
});

test("alerts not done when nobody matches or user has no contact", () => {
  const r = buildChecklist({ ...base, recipients: [{ email: "a@b.nl", phone: "" }] });
  assert.equal(r.items[1].done, false);
});

test("install done when standalone", () => {
  assert.equal(buildChecklist({ ...base, standalone: true }).items[3].done, true);
});

test("visible false when dismissed", () => {
  assert.equal(buildChecklist({ ...base, prefs: { dismissed: true } }).visible, false);
});

test("all done hides the card", () => {
  const r = buildChecklist({
    ...base, prefs: { visited: { receptionist: true, call: true } }, standalone: true,
    recipients: [{ email: "x@y.nl" }], userEmail: "x@y.nl",
  });
  assert.equal(r.allDone, true);
  assert.equal(r.visible, false);
});

test("order is details, alerts, call, install", () => {
  assert.deepEqual(buildChecklist(base).items.map((i) => i.key), ["details", "alerts", "call", "install"]);
});
