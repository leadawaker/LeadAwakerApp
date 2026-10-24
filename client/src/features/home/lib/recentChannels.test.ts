import { test } from "node:test";
import assert from "node:assert/strict";
import type { HomeServices } from "@shared/homeTypes";
import { recentChannels } from "./recentChannels";

const none: HomeServices = { phone: false, whatsapp: false, website: false, reactivation: false, reputation: false, social: false, sms: false };

test("only phone, WhatsApp and website chat have a recent list, in that order", () => {
  assert.deepEqual(recentChannels({ ...none, website: true, phone: true, whatsapp: true }), ["phone", "whatsapp", "website"]);
  assert.deepEqual(recentChannels({ ...none, whatsapp: true }), ["whatsapp"]);
});

test("SMS-only or reactivation-only accounts have none, so the column is hidden", () => {
  assert.deepEqual(recentChannels({ ...none, sms: true }), []);
  assert.deepEqual(recentChannels({ ...none, reactivation: true }), []);
  assert.deepEqual(recentChannels({ ...none, sms: true, reactivation: true }), []);
});
