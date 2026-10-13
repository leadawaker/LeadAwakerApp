import { test } from "node:test";
import assert from "node:assert/strict";
import { manualReplyChannel } from "./interactionChannel";

test("a web lead is website, whatever the campaign says", () => {
  assert.equal(manualReplyChannel({ channelIdentifier: "web:abc123" }, "whatsapp"), "website");
});

test("a web-demo lead is website", () => {
  assert.equal(manualReplyChannel({ channelIdentifier: "web-demo:abc123" }, "whatsapp"), "website");
});

test("a WhatsApp campaign is whatsapp, even when the lead resolved to sms", () => {
  // resolved_channel is ignored: the CRM delivers over the campaign's channel.
  const lead = { channelIdentifier: "+31612345678", resolvedChannel: "sms" };
  assert.equal(manualReplyChannel(lead, "whatsapp"), "whatsapp");
  assert.equal(manualReplyChannel(lead, "whatsapp_cloud"), "whatsapp");
});

test("a wa: identifier is delivered over WhatsApp whatever the campaign channel", () => {
  assert.equal(manualReplyChannel({ channelIdentifier: "wa:31612345678" }, "sms"), "whatsapp");
});

test("a telegram campaign or lead is left unclassified", () => {
  assert.equal(manualReplyChannel({ channelIdentifier: "tg:12345" }, "telegram"), null);
  assert.equal(manualReplyChannel({ channelIdentifier: "tg:12345" }, "whatsapp"), null);
  assert.equal(manualReplyChannel({ channelIdentifier: "+3161" }, "telegram"), null);
});

test("an unknown or missing campaign channel is left unclassified", () => {
  assert.equal(manualReplyChannel({ channelIdentifier: "+3161" }, "sms"), null);
  assert.equal(manualReplyChannel({ channelIdentifier: "+3161" }, "instagram"), null);
  assert.equal(manualReplyChannel({}, null), null);
});
