import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { resolveHomeQuery } from "./homeScope";

const owner = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null });
const client = resolveVoiceAccess({ role: "Manager", accountsId: 53, impersonatedAccountId: null });
const impersonating = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: 53 });
const orphan = resolveVoiceAccess({ role: "Viewer", accountsId: null, impersonatedAccountId: null });

test("a client asking for another account gets its own", () => {
  assert.equal(resolveHomeQuery(client, { accountId: "1" }).accountId, 53);
  assert.equal(resolveHomeQuery(client, {}).accountId, 53);
  assert.equal(resolveHomeQuery(client, { accountId: "0" }).accountId, 53);
});

test("an owner viewing as a client is locked to that client", () => {
  assert.equal(resolveHomeQuery(impersonating, { accountId: "1" }).accountId, 53);
});

test("an Admin on a client account is locked to it by the guard's forced account", () => {
  const clientAdmin = resolveVoiceAccess({ role: "Admin", accountsId: 53, impersonatedAccountId: null });
  assert.equal(resolveHomeQuery(clientAdmin, { accountId: "1" }, 53).accountId, 53);
  assert.equal(resolveHomeQuery(clientAdmin, { accountId: "0" }, 53).accountId, 53);
  assert.equal(resolveHomeQuery(clientAdmin, {}, 53).accountId, 53);
});

test("no forced account leaves the role rule as it was", () => {
  assert.equal(resolveHomeQuery(owner, { accountId: "53" }, null).accountId, 53);
  assert.equal(resolveHomeQuery(owner, {}, undefined).accountId, null);
  assert.equal(resolveHomeQuery(client, { accountId: "1" }, null).accountId, 53);
});

test("agency: a picked account, or all accounts for 0, missing or junk", () => {
  assert.equal(resolveHomeQuery(owner, { accountId: "53" }).accountId, 53);
  assert.equal(resolveHomeQuery(owner, { accountId: "0" }).accountId, null);
  assert.equal(resolveHomeQuery(owner, {}).accountId, null);
  assert.equal(resolveHomeQuery(owner, { accountId: "abc" }).accountId, null);
});

test("a user with no account matches nothing, never everything", () => {
  assert.equal(resolveHomeQuery(orphan, {}).accountId, -1);
});

test("period defaults to all and ignores junk and retired periods", () => {
  assert.equal(resolveHomeQuery(owner, {}).period, "all");
  assert.equal(resolveHomeQuery(owner, { period: "week" }).period, "week");
  assert.equal(resolveHomeQuery(owner, { period: "7d" }).period, "all");
  assert.equal(resolveHomeQuery(owner, { period: "DROP TABLE" }).period, "all");
});

test("channel is one of the four channels, else all (null)", () => {
  assert.equal(resolveHomeQuery(owner, { channel: "phone" }).channel, "phone");
  assert.equal(resolveHomeQuery(owner, { channel: "website" }).channel, "website");
  assert.equal(resolveHomeQuery(owner, { channel: "all" }).channel, null);
  assert.equal(resolveHomeQuery(owner, { channel: "instagram" }).channel, null);
  assert.equal(resolveHomeQuery(owner, {}).channel, null);
});

test("campaignId is a positive integer or null", () => {
  assert.equal(resolveHomeQuery(owner, { campaignId: "71" }).campaignId, 71);
  assert.equal(resolveHomeQuery(owner, { campaignId: "-3" }).campaignId, null);
  assert.equal(resolveHomeQuery(owner, {}).campaignId, null);
});
