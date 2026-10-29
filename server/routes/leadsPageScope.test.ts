import { test } from "node:test";
import assert from "node:assert/strict";
import { chatsScope } from "./leadsPageScope";
import { resolveVoiceAccess } from "./voiceCallsAccess";

const owner = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null });
const admin = resolveVoiceAccess({ role: "Admin", accountsId: 1, impersonatedAccountId: null });
const client = resolveVoiceAccess({ role: "Manager", accountsId: 7, impersonatedAccountId: null });
const viewAs = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: 7 });

test("the Owner gets Demo when asked, else Live", () => {
  assert.equal(chatsScope(owner, true, "demo"), "demo");
  assert.equal(chatsScope(owner, true, "live"), "live");
  assert.equal(chatsScope(owner, true, undefined), "live");
  assert.equal(chatsScope(owner, true, "garbage"), "live");
});

test("Admin, clients and a view-as Owner always get Live", () => {
  for (const access of [admin, client, viewAs]) assert.equal(chatsScope(access, true, "demo"), "live");
});

test("other pages ask for no scope and keep every lead", () => {
  assert.equal(chatsScope(owner, false, "demo"), undefined);
  assert.equal(chatsScope(client, false, undefined), undefined);
});
