import { test } from "node:test";
import assert from "node:assert/strict";
import { clientNavItems, clientBottomBar, clientMoreItems, myAccountLabelKey, type ClientNavFacts } from "./navGates";

const none: ClientNavFacts = { voiceLive: false, hasInvoices: false, hasReactivation: false, hasReceptionist: true };
const all: ClientNavFacts = { voiceLive: true, hasInvoices: true, hasReactivation: true, hasReceptionist: true };

test("with no optional facts a client sees the four basics", () => {
  assert.deepEqual(clientNavItems(none), ["home", "leads", "calendar", "myReceptionist"]);
});

test("voice, invoices and reactivation add Calls, Billing and Campaigns in order", () => {
  assert.deepEqual(clientNavItems(all), ["home", "calls", "leads", "calendar", "myReceptionist", "billing", "campaigns"]);
});

test("the bottom bar never changes", () => {
  assert.deepEqual(clientBottomBar(none), ["home", "leads", "calendar", "myReceptionist"]);
  assert.deepEqual(clientBottomBar(all), ["home", "leads", "calendar", "myReceptionist"]);
});

test("More holds the gated extras", () => {
  assert.deepEqual(clientMoreItems({ ...none, voiceLive: true, hasInvoices: true }), ["calls", "billing"]);
  assert.deepEqual(clientMoreItems(none), []);
  assert.deepEqual(clientMoreItems(all), ["calls", "billing", "campaigns"]);
});

test("the account label falls back to My account without a receptionist", () => {
  assert.equal(myAccountLabelKey(none), "sidebar.myReceptionist");
  assert.equal(myAccountLabelKey({ ...none, hasReceptionist: false }), "sidebar.myAccount");
});
