import { test } from "node:test";
import assert from "node:assert/strict";
import { accountEditLevel, pickClientAccountPatch } from "./clientEditAccess";

test("agency users edit everything", () => {
  assert.equal(accountEditLevel({ role: "Owner", accountsId: 1 }, 53), "agency");
  assert.equal(accountEditLevel({ role: "Admin", accountsId: 1 }, 53), "agency");
});

test("a Manager edits only their own account, and only at client level", () => {
  assert.equal(accountEditLevel({ role: "Manager", accountsId: 53 }, 53), "client");
  assert.equal(accountEditLevel({ role: "Manager", accountsId: 53 }, 52), "none");
});

test("a Viewer edits nothing", () => {
  assert.equal(accountEditLevel({ role: "Viewer", accountsId: 53 }, 53), "none");
});

test("impersonation wins over the real role", () => {
  const owner = { role: "Owner", accountsId: 1 };
  assert.equal(accountEditLevel({ ...owner, impersonatedRole: "Manager", impersonatedAccountId: 53 }, 53), "client");
  assert.equal(accountEditLevel({ ...owner, impersonatedRole: "Viewer", impersonatedAccountId: 53 }, 53), "none");
  assert.equal(accountEditLevel({ ...owner, impersonatedRole: "Admin" }, 53), "agency");
  assert.equal(accountEditLevel({ ...owner, impersonatedRole: "Manager", impersonatedAccountId: 53 }, 1), "none");
});

test("client patch keeps the hours fields", () => {
  const r = pickClientAccountPatch({ businessHoursStart: "09:00", businessHoursEnd: "18:00" });
  assert.deepEqual(r, { ok: true, patch: { businessHoursStart: "09:00", businessHoursEnd: "18:00" } });
});

test("client patch refuses anything else", () => {
  assert.deepEqual(
    pickClientAccountPatch({ businessHoursStart: "09:00", status: "Inactive", maxDailySends: 9 }),
    { ok: false, disallowed: ["status", "maxDailySends"] },
  );
});

test("an empty client patch is refused", () => {
  assert.deepEqual(pickClientAccountPatch({}), { ok: false, disallowed: [] });
});

test("client patch refuses malformed hours", () => {
  for (const bad of ["9:00", "24:00", "09:60", "09:00:60", "9:00:00", "abc", "", 900, null]) {
    const r = pickClientAccountPatch({ businessHoursStart: bad });
    assert.equal(r.ok, false, `start ${String(bad)}`);
    assert.deepEqual((r as any).invalid, ["businessHoursStart"]);
  }
  assert.deepEqual((pickClientAccountPatch({ businessHoursEnd: "7pm" }) as any).invalid, ["businessHoursEnd"]);
  assert.equal(pickClientAccountPatch({ businessHoursStart: "00:00", businessHoursEnd: "23:59" }).ok, true);
  for (const ok of ["09:00:00", "23:59:59", "00:00"]) {
    assert.equal(pickClientAccountPatch({ businessHoursStart: ok }).ok, true, `start ${ok}`);
  }
});

test("client patch refuses malformed open days", () => {
  for (const bad of [[7], [-1], [1, 1], [1.5], ["1"], "1,2", null, 3]) {
    const r = pickClientAccountPatch({ openDays: bad });
    assert.equal(r.ok, false, `days ${JSON.stringify(bad)}`);
    assert.deepEqual((r as any).invalid, ["openDays"]);
  }
  assert.equal(pickClientAccountPatch({ openDays: [0, 1, 2, 3, 4, 5, 6] }).ok, true);
  assert.equal(pickClientAccountPatch({ openDays: [] }).ok, true);
});
