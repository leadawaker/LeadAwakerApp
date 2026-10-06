import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVoiceAccess, decideScope } from "./voiceCallsAccess";

const owner = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null });
const admin = resolveVoiceAccess({ role: "Admin", accountsId: 1, impersonatedAccountId: null });
const agencyViewer = resolveVoiceAccess({ role: "Viewer", accountsId: 1, impersonatedAccountId: null });
const client = resolveVoiceAccess({ role: "Manager", accountsId: 42, impersonatedAccountId: null });
const impersonating = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: 42 });

test("resolve: owner is owner and agency, unlocked", () => {
  assert.deepEqual(owner, { isOwner: true, isAgency: true, lockedAccountId: null });
});

test("resolve: admin is agency, not owner", () => {
  assert.deepEqual(admin, { isOwner: false, isAgency: true, lockedAccountId: null });
});

test("resolve: any user on account 1 is agency", () => {
  assert.deepEqual(agencyViewer, { isOwner: false, isAgency: true, lockedAccountId: null });
});

test("resolve: client is locked to its own account", () => {
  assert.deepEqual(client, { isOwner: false, isAgency: false, lockedAccountId: 42 });
});

test("resolve: an Admin role on a client account is still agency (matches requireAgency)", () => {
  const a = resolveVoiceAccess({ role: "Admin", accountsId: 42, impersonatedAccountId: null });
  assert.equal(a.isAgency, true);
  assert.equal(a.isOwner, false);
});

test("resolve: impersonation drops owner and agency and locks to the client", () => {
  assert.deepEqual(impersonating, { isOwner: false, isAgency: false, lockedAccountId: 42 });
});

test("resolve: Owner viewing as Admin (no account) is agency but loses Owner powers", () => {
  const a = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null, impersonatedRole: "Admin" });
  assert.deepEqual(a, { isOwner: false, isAgency: true, lockedAccountId: null });
  assert.deepEqual(decideScope(a, { scope: "demo" }), { ok: false, status: 403 });
});

test("resolve: a client with no account locks to an impossible account, never to all", () => {
  const a = resolveVoiceAccess({ role: "Manager", accountsId: null, impersonatedAccountId: null });
  assert.equal(a.isAgency, false);
  assert.notEqual(a.lockedAccountId, null);
});

test("scope: owner demo ok", () => {
  assert.deepEqual(decideScope(owner, { scope: "demo" }), { ok: true, scope: "demo", accountId: null });
});

test("scope: admin demo is 403", () => {
  assert.deepEqual(decideScope(admin, { scope: "demo" }), { ok: false, status: 403 });
});

test("scope: client demo is 403", () => {
  assert.deepEqual(decideScope(client, { scope: "demo" }), { ok: false, status: 403 });
});

test("scope: impersonating owner demo is 403", () => {
  assert.deepEqual(decideScope(impersonating, { scope: "demo" }), { ok: false, status: 403 });
});

test("scope: impersonating owner live is locked to the impersonated account", () => {
  assert.deepEqual(decideScope(impersonating, { scope: "live", accountId: "7" }), { ok: true, scope: "live", accountId: 42 });
});

test("scope: client accountId=99 is ignored, locked to own account", () => {
  assert.deepEqual(decideScope(client, { scope: "live", accountId: "99" }), { ok: true, scope: "live", accountId: 42 });
});

test("scope: missing or garbage scope becomes live", () => {
  assert.deepEqual(decideScope(owner, {}), { ok: true, scope: "live", accountId: null });
  assert.deepEqual(decideScope(owner, { scope: "everything" }), { ok: true, scope: "live", accountId: null });
  assert.deepEqual(decideScope(client, { scope: ["demo"] }), { ok: true, scope: "live", accountId: 42 });
});

test("scope: owner accountId=7 honored, garbage accountId ignored", () => {
  assert.deepEqual(decideScope(owner, { scope: "live", accountId: "7" }), { ok: true, scope: "live", accountId: 7 });
  assert.deepEqual(decideScope(owner, { scope: "live", accountId: "abc" }), { ok: true, scope: "live", accountId: null });
  assert.deepEqual(decideScope(owner, { scope: "live", accountId: "-3" }), { ok: true, scope: "live", accountId: null });
  assert.deepEqual(decideScope(admin, { scope: "live", accountId: "7" }), { ok: true, scope: "live", accountId: 7 });
});
