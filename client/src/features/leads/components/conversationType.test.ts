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

test("live comment-to-DM leads (ig: channel, no campaign) are instagram", () => {
  assert.equal(getConversationType({ channel_identifier: "ig:17841400000000001", Source: "Instagram" }, campaigns), "instagram");
  assert.equal(getConversationType({ channelIdentifier: "ig:1" }), "instagram");
  assert.equal(getConversationType({ channel_identifier: "wa:+5511" }, campaigns), "other");
});

test("website chats are widget even in a reactivation-typed campaign", () => {
  const c = new Map([[60, { campaignType: "reactivation" }], [71, { campaignType: "reactivation" }], [72, { campaignType: "reactivation", bumpMode: "receptionist" }]]);
  assert.equal(getConversationType({ Campaigns_id: 60, channel_identifier: "web-demo:abc", Source: "Web Demo" }, c), "widget");
  assert.equal(getConversationType({ Campaigns_id: 71, channel_identifier: "web:xyz", Source: "Website Chat" }, c), "widget");
  assert.equal(getConversationType({ Campaigns_id: 60, channel_identifier: "wa-demo:abc", Source: "WhatsApp Demo" }, c), "dbr");
  assert.equal(getConversationType({ Campaigns_id: 72, channel_identifier: "wa:+31" }, c), "other");
});
