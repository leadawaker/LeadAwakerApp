import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearIdentityCache,
  displayName,
  identityFromUser,
  initialsFor,
  mergeProfileIntoMe,
  shortName,
  syncIdentityCache,
} from "./userIdentity";

function memory(init: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(init));
  return {
    m,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const gabriel = { id: 1, fullName1: "Gabriel Fronza", email: "g@x.nl", avatarUrl: "data:image/png;base64,GAB" };
const finn = { id: 2, fullName1: null, email: "finn@x.nl", avatarUrl: null };

test("identityFromUser: no user means no identity (never a stale one)", () => {
  assert.equal(identityFromUser(null), null);
  assert.equal(identityFromUser(undefined), null);
  assert.equal(identityFromUser({ id: null, email: "a@b.c" }), null);
});

test("identityFromUser: carries the server photo, name and email, blanks for missing", () => {
  assert.deepEqual(identityFromUser(gabriel), {
    userId: "1",
    name: "Gabriel Fronza",
    email: "g@x.nl",
    avatar: "data:image/png;base64,GAB",
  });
  assert.deepEqual(identityFromUser(finn), { userId: "2", name: "", email: "finn@x.nl", avatar: "" });
});

test("displayName: name, then email, then User", () => {
  assert.equal(displayName(identityFromUser(gabriel)), "Gabriel Fronza");
  assert.equal(displayName(identityFromUser(finn)), "finn@x.nl");
  assert.equal(displayName(null), "User");
});

test("initialsFor and shortName", () => {
  assert.equal(initialsFor("Gabriel Fronza"), "GF");
  assert.equal(initialsFor("Gabriel de Souza Fronza"), "GD");
  assert.equal(initialsFor("finn@x.nl"), "F");
  assert.equal(initialsFor("  "), "U");
  assert.equal(shortName("Gabriel Fronza"), "Gabriel F.");
  assert.equal(shortName("Gabriel"), "Gabriel");
  assert.equal(shortName(""), "User");
});

test("syncIdentityCache writes the current user and reports an avatar change", () => {
  const s = memory();
  assert.equal(syncIdentityCache(s, gabriel), true);
  assert.equal(s.m.get("leadawaker_user_avatar"), "data:image/png;base64,GAB");
  assert.equal(s.m.get("leadawaker_user_name"), "Gabriel Fronza");
  assert.equal(s.m.get("leadawaker_user_email"), "g@x.nl");
  assert.equal(s.m.get("leadawaker_user_id"), "1");
  assert.equal(syncIdentityCache(s, gabriel), false, "same user and photo again is not a change");
});

test("a different user never inherits the previous user's photo or name", () => {
  const s = memory();
  syncIdentityCache(s, gabriel);
  assert.equal(syncIdentityCache(s, finn), true);
  assert.equal(s.m.has("leadawaker_user_avatar"), false);
  assert.equal(s.m.has("leadawaker_user_name"), false, "no name for finn: the old name is removed, not kept");
  assert.equal(s.m.get("leadawaker_user_email"), "finn@x.nl");
  assert.equal(s.m.get("leadawaker_user_id"), "2");
});

test("syncIdentityCache with no user changes nothing", () => {
  const s = memory({ leadawaker_user_avatar: "x" });
  assert.equal(syncIdentityCache(s, null), false);
  assert.equal(s.m.get("leadawaker_user_avatar"), "x");
});

test("clearIdentityCache drops photo, name, email and id", () => {
  const s = memory({
    leadawaker_user_avatar: "x",
    leadawaker_user_name: "n",
    leadawaker_user_email: "e",
    leadawaker_user_id: "1",
    leadawaker_lang: "nl",
  });
  assert.equal(clearIdentityCache(s), true);
  assert.deepEqual([...s.m.keys()], ["leadawaker_lang"]);
  assert.equal(clearIdentityCache(s), false, "nothing left to clear");
});

test("mergeProfileIntoMe patches only the same user in the cached /api/auth/me", () => {
  const me = { user: { ...gabriel, role: "Owner" }, impersonation: null };
  const out = mergeProfileIntoMe(me, { id: 1, fullName1: "G F", email: "g@x.nl", avatarUrl: null });
  assert.equal(out?.user?.fullName1, "G F");
  assert.equal(out?.user?.avatarUrl, null);
  assert.equal(out?.user?.role, "Owner", "other fields stay");
  assert.equal(mergeProfileIntoMe(me, { id: 9, fullName1: "Other", email: null, avatarUrl: "y" }), me);
  assert.equal(mergeProfileIntoMe(null, { id: 1, fullName1: "x", email: null, avatarUrl: null }), null);
});
