import { test } from "node:test";
import assert from "node:assert/strict";
import { changedSettings, failedMessages, prospectCounts, settingsOf } from "./prospectDetail";
import { row, session, surface } from "./demoTestFixtures";

const anna = row({ firstName: "Anna", companyName: "Jansen BV", clientNiche: "Bakery", language: "nl", aiDisclosure: "opener", market: "uk" });

test("settingsOf reads the six editable settings off the row", () => {
  assert.deepEqual(settingsOf(anna), {
    firstName: "Anna", companyName: "Jansen BV", clientNiche: "Bakery", language: "nl", aiDisclosure: "opener", market: "uk",
  });
});

test("changedSettings sends only what differs from the row", () => {
  assert.deepEqual(changedSettings(anna, settingsOf(anna)), {});
  assert.deepEqual(changedSettings(anna, { ...settingsOf(anna), language: "pt", market: "" }), { language: "pt", market: "" });
});

test("changedSettings compares and sends names trimmed", () => {
  assert.deepEqual(changedSettings(anna, { ...settingsOf(anna), firstName: "  Anna ", companyName: " Jansen BV" }), {});
  assert.deepEqual(changedSettings(anna, { ...settingsOf(anna), firstName: " Bea " }), { firstName: "Bea" });
});

test("changedSettings keeps the edit after a partial failure: the row still holds the old settings, so the same patch comes out again", () => {
  const edited = { ...settingsOf(anna), clientNiche: "Florist", language: "en" as const };
  const first = changedSettings(anna, edited);
  const retry = changedSettings(anna, edited);
  assert.deepEqual(first, { clientNiche: "Florist", language: "en" });
  assert.deepEqual(retry, first);
});

test("prospectCounts counts links, opened links and replies over the history too", () => {
  const opened = { ...surface, opened: true, replies: 2 };
  const live = session({ token: "live0001", browser: opened });
  const never = session({ token: "live0002", service: "speed", campaignId: 67 });
  const old = session({ token: "old00001", revokedAt: "2026-10-21T09:00:00Z", whatsapp: { ...surface, opened: true, replies: 3 } });
  const r = row({ byService: { dbr: live, speed: never }, extra: [], history: [old], replies: 5 });
  assert.deepEqual(prospectCounts(r), { links: 3, opened: 2, replies: 5 });
});

test("prospectCounts counts links held outside a service column", () => {
  const extra = session({ token: "extra001", browser: { ...surface, opened: true } });
  assert.deepEqual(prospectCounts(row({ extra: [extra] })), { links: 1, opened: 1, replies: 0 });
  assert.deepEqual(prospectCounts(row()), { links: 0, opened: 0, replies: 0 });
});

test("failedMessages lists each distinct message once, in order", () => {
  assert.deepEqual(
    failedMessages([
      { token: "a", message: "Persona has no Dutch version." },
      { token: "b", message: "Persona has no Dutch version." },
      { token: "c", message: "Timed out." },
    ]),
    ["Persona has no Dutch version.", "Timed out."],
  );
  assert.deepEqual(failedMessages([]), []);
});
