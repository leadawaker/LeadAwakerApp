import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agencyBottomBar, clientBottomBar, clientMoreItems, clientNavItems, isSameRoute, myAccountLabelKey, type ClientNavFacts,
} from "./navGates";

const none: ClientNavFacts = { voiceLive: false, hasInvoices: false, hasReceptionist: true, hasChats: false, hasSocial: false };
const all: ClientNavFacts = { voiceLive: true, hasInvoices: true, hasReceptionist: true, hasChats: true, hasSocial: false };
// Account 56 (Augusto): Social switched on, no voice line, no chats.
const augusto: ClientNavFacts = { ...none, hasSocial: true };
// Account 53: phone + website chat, no invoices yet.
const thijs: ClientNavFacts = { ...none, voiceLive: true, hasChats: true };

test("with no optional facts a client sees the four basics", () => {
  assert.deepEqual(clientNavItems(none), ["home", "leads", "calendar", "myReceptionist"]);
});

test("desktop order: Home, Calls, Chats, Leads, Calendar, Account", () => {
  assert.deepEqual(clientNavItems(all), ["home", "calls", "chats", "leads", "calendar", "myReceptionist"]);
});

test("the bottom bar is Home, Calls, Calendar, Chats", () => {
  assert.deepEqual(clientBottomBar(thijs), ["home", "calls", "calendar", "chats"]);
  assert.deepEqual(clientBottomBar(all), ["home", "calls", "calendar", "chats"]);
});

test("Leads takes the Chats slot without website chat or WhatsApp", () => {
  assert.deepEqual(clientBottomBar({ ...thijs, hasChats: false }), ["home", "calls", "calendar", "leads"]);
  assert.deepEqual(clientBottomBar(none), ["home", "calendar", "leads"]);
});

test("More: Account, then Leads when not in the bar, Billing", () => {
  assert.deepEqual(clientMoreItems(thijs), ["myReceptionist", "leads"]);
  assert.deepEqual(clientMoreItems(all), ["myReceptionist", "leads", "billing"]);
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

test("Socials sits after Calendar on the desktop nav, only when Social is on", () => {
  assert.deepEqual(clientNavItems(augusto), ["home", "leads", "calendar", "social", "myReceptionist"]);
  assert.deepEqual(clientNavItems({ ...all, hasSocial: true }), ["home", "calls", "chats", "leads", "calendar", "social", "myReceptionist"]);
  assert.ok(!clientNavItems(all).includes("social"));
});

test("Socials takes the free fourth bar slot, else it goes on More", () => {
  assert.deepEqual(clientBottomBar(augusto), ["home", "calendar", "leads", "social"]);
  assert.deepEqual(clientMoreItems(augusto), ["myReceptionist"]);
  const withVoice = { ...augusto, voiceLive: true };
  assert.deepEqual(clientBottomBar(withVoice), ["home", "calls", "calendar", "leads"]);
  assert.deepEqual(clientMoreItems(withVoice), ["social", "myReceptionist"]);
});

test("Social off changes nothing in the bar or on More", () => {
  assert.deepEqual(clientBottomBar(none), ["home", "calendar", "leads"]);
  assert.deepEqual(clientMoreItems(none), ["myReceptionist"]);
});

test("the agency bar never holds Socials (it is on More)", () => {
  assert.ok(!agencyBottomBar(true).includes("social"));
  assert.ok(!agencyBottomBar(false).includes("social"));
});

test("a link to the open page counts as the same route", () => {
  assert.equal(isSameRoute("/platform/settings", "/platform/settings"), true);
  assert.equal(isSameRoute("/platform/contacts", "/platform/contacts/12"), true);
  assert.equal(isSameRoute("/platform/docs?x=1", "/platform/docs"), true);
  assert.equal(isSameRoute("/platform/chat", "/platform/home"), false);
});
