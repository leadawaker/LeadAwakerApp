import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agencyBottomBar, clientBottomBar, clientMoreItems, clientNavItems, isSameRoute, myAccountLabelKey, type ClientNavFacts,
} from "./navGates";

const none: ClientNavFacts = { voiceLive: false, hasInvoices: false, hasReactivation: false, hasReceptionist: true, hasChats: false };
const all: ClientNavFacts = { voiceLive: true, hasInvoices: true, hasReactivation: true, hasReceptionist: true, hasChats: true };
// Account 53: phone + website chat, no reactivation, no invoices yet.
const thijs: ClientNavFacts = { ...none, voiceLive: true, hasChats: true };

test("with no optional facts a client sees the four basics", () => {
  assert.deepEqual(clientNavItems(none), ["home", "leads", "calendar", "myReceptionist"]);
});

test("desktop order: Home, Calls, Chats, Leads, Calendar, Account, Billing, Campaigns", () => {
  assert.deepEqual(clientNavItems(all), ["home", "calls", "chats", "leads", "calendar", "myReceptionist", "billing", "campaigns"]);
});

test("the bottom bar is Home, Calls, Calendar, Chats", () => {
  assert.deepEqual(clientBottomBar(thijs), ["home", "calls", "calendar", "chats"]);
  assert.deepEqual(clientBottomBar(all), ["home", "calls", "calendar", "chats"]);
});

test("Leads takes the Chats slot without website chat or WhatsApp", () => {
  assert.deepEqual(clientBottomBar({ ...thijs, hasChats: false }), ["home", "calls", "calendar", "leads"]);
  assert.deepEqual(clientBottomBar(none), ["home", "calendar", "leads"]);
});

test("More: Account, then Leads when not in the bar, Billing, Campaigns", () => {
  assert.deepEqual(clientMoreItems(thijs), ["myReceptionist", "leads"]);
  assert.deepEqual(clientMoreItems(all), ["myReceptionist", "leads", "billing", "campaigns"]);
  assert.deepEqual(clientMoreItems(none), ["myReceptionist"]);
});

test("agency bar: Home, Calls, Chats, Tasks; Calendar stands in without voice", () => {
  assert.deepEqual(agencyBottomBar(true), ["home", "calls", "chats", "tasks"]);
  assert.deepEqual(agencyBottomBar(false), ["home", "chats", "calendar", "tasks"]);
});

test("the account label falls back to My account without a receptionist", () => {
  assert.equal(myAccountLabelKey(none), "sidebar.myReceptionist");
  assert.equal(myAccountLabelKey({ ...none, hasReceptionist: false }), "sidebar.myAccount");
});

test("a link to the open page counts as the same route", () => {
  assert.equal(isSameRoute("/platform/settings", "/platform/settings"), true);
  assert.equal(isSameRoute("/platform/contacts", "/platform/contacts/12"), true);
  assert.equal(isSameRoute("/platform/docs?x=1", "/platform/docs"), true);
  assert.equal(isSameRoute("/platform/chat", "/platform/home"), false);
});
