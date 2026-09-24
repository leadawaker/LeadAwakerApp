import { test } from "node:test";
import assert from "node:assert/strict";
import { getConversationType, CONVERSATION_TYPES } from "./conversationType";

const campaigns = new Map([[70, { campaignType: "social_reply" }], [67, { campaignType: "speed_to_lead" }]]);

test("social_reply campaign leads are instagram", () => {
  assert.equal(getConversationType({ Campaigns_id: 70, channel_identifier: "web-demo:abc" }, campaigns), "instagram");
});

test("instagram is a listed type", () => {
  assert.ok(CONVERSATION_TYPES.includes("instagram"));
});

test("existing types unchanged", () => {
  assert.equal(getConversationType({ Source: "Website Chat" }, campaigns), "widget");
  assert.equal(getConversationType({ Campaigns_id: 67 }, campaigns), "dbr");
});
