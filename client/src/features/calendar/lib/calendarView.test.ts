import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCalendarView, isCalendarView } from "./calendarView";

test("phones default to the list", () => {
  assert.equal(defaultCalendarView(390), "list");
  assert.equal(defaultCalendarView(767), "list");
});
test("768 and wider default to week", () => {
  assert.equal(defaultCalendarView(768), "week");
});
test("isCalendarView accepts the three views only", () => {
  assert.equal(isCalendarView("list"), true);
  assert.equal(isCalendarView("month"), true);
  assert.equal(isCalendarView("week"), true);
  assert.equal(isCalendarView("day"), false);
  assert.equal(isCalendarView(undefined), false);
});

import { coerceCalendarView, clientSafeCampaignKey } from "./calendarView";

test("a restored list becomes week on wider screens only", () => {
  assert.equal(coerceCalendarView("list", false), "week");
  assert.equal(coerceCalendarView("list", true), "list");
  assert.equal(coerceCalendarView("month", false), "month");
});
test("clients fall back from campaign grouping and sorting", () => {
  assert.equal(clientSafeCampaignKey("campaign", false, "date"), "date");
  assert.equal(clientSafeCampaignKey("campaign_asc", false, "time_desc"), "time_desc");
  assert.equal(clientSafeCampaignKey("campaign", true, "date"), "campaign");
  assert.equal(clientSafeCampaignKey("status", false, "date"), "status");
});
