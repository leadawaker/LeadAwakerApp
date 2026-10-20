import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageSocial, isAgency, resolveReturnOrigin } from "./access";

test("agency can manage any account", () => {
  assert.equal(canManageSocial({ role: "Owner", accountsId: 1 }, 77), true);
  assert.equal(canManageSocial({ role: "Admin", accountsId: 1 }, 77), true);
});
test("Manager only on own account; Viewer never", () => {
  assert.equal(canManageSocial({ role: "Manager", accountsId: 77 }, 77), true);
  assert.equal(canManageSocial({ role: "Manager", accountsId: 77 }, 78), false);
  assert.equal(canManageSocial({ role: "Viewer", accountsId: 77 }, 77), false);
  assert.equal(canManageSocial(undefined, 77), false);
});
test("return origin is allowlisted", () => {
  assert.equal(resolveReturnOrigin("https://leadawaker.com", "https://app.leadawaker.com"), "https://leadawaker.com");
  assert.equal(resolveReturnOrigin("https://www.leadawaker.com", "https://app.leadawaker.com"), "https://www.leadawaker.com");
  assert.equal(resolveReturnOrigin("https://evil.example", "https://app.leadawaker.com"), "https://app.leadawaker.com");
  assert.equal(resolveReturnOrigin(undefined, "https://app.leadawaker.com"), "https://app.leadawaker.com");
});
test("isAgency mirrors requireAgency: agency account or Owner/Admin role", () => {
  assert.equal(isAgency({ role: "Viewer", accountsId: 1 }), true);
  assert.equal(isAgency({ role: "Admin", accountsId: 53 }), true);
  assert.equal(isAgency({ role: "Manager", accountsId: 53 }), false);
  assert.equal(isAgency({ role: "Viewer", accountsId: null }), false);
  assert.equal(isAgency(undefined), false);
});
test("return origin rejects lookalikes and tolerates a trailing slash", () => {
  assert.equal(resolveReturnOrigin("https://leadawaker.com.evil.example", "https://app.leadawaker.com"), "https://app.leadawaker.com");
  assert.equal(resolveReturnOrigin("http://leadawaker.com", "https://app.leadawaker.com"), "https://app.leadawaker.com");
  assert.equal(resolveReturnOrigin("https://leadawaker.com/", "https://app.leadawaker.com"), "https://leadawaker.com");
  assert.equal(resolveReturnOrigin(null, "https://app.leadawaker.com"), "https://app.leadawaker.com");
});
