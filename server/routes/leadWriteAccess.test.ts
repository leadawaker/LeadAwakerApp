import { test } from "node:test";
import assert from "node:assert/strict";
import { disallowedClientLeadFields, leadWriteLevel, leadWriteLevelForRequest } from "./leadWriteAccess";

const owner = { role: "Owner", accountsId: 1 };
const thijs = { role: "Manager", accountsId: 53 };
const viewer = { role: "Viewer", accountsId: 53 };

test("the agency writes anywhere", () => {
  assert.equal(leadWriteLevel(owner, 53), "agency");
  assert.equal(leadWriteLevel({ role: "Admin", accountsId: 1 }, 12), "agency");
  assert.equal(leadWriteLevel({ role: "Manager", accountsId: 1 }, 12), "agency");
});

test("a Manager writes only to leads of their own account", () => {
  assert.equal(leadWriteLevel(thijs, 53), "client");
  assert.equal(leadWriteLevel(thijs, 54), "none");
  assert.equal(leadWriteLevel(thijs, null), "none");
});

test("a Viewer never writes", () => {
  assert.equal(leadWriteLevel(viewer, 53), "readonly");
  assert.equal(leadWriteLevel(viewer, 54), "none");
});

test("the Owner viewing as a client gets exactly that client's rights", () => {
  const asThijs = { ...owner, impersonatedRole: "Manager", impersonatedAccountId: 53 };
  assert.equal(leadWriteLevel(asThijs, 53), "client");
  assert.equal(leadWriteLevel(asThijs, 54), "none");
  assert.equal(leadWriteLevel({ ...owner, impersonatedRole: "Viewer", impersonatedAccountId: 53 }, 53), "readonly");
  assert.equal(leadWriteLevel({ ...owner, impersonatedRole: "Admin" }, 54), "agency");
});

test("no session user is the internal key: agency", () => {
  assert.equal(leadWriteLevelForRequest({}, 53), "agency");
  assert.equal(leadWriteLevelForRequest({ user: thijs, session: {} }, 54), "none");
  assert.equal(leadWriteLevelForRequest({ user: owner, session: { impersonation: { role: "Manager", accountId: 53 } } }, 54), "none");
});

test("clients may only send the fields their UI sends", () => {
  assert.deepEqual(disallowedClientLeadFields({ manualTakeover: true, notes: "x" }), []);
  assert.deepEqual(disallowedClientLeadFields({ manualTakeover: true, accountsId: 54, isTest: true }), ["accountsId", "isTest"]);
});
