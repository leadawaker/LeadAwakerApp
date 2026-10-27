import { test } from "node:test";
import assert from "node:assert/strict";
import { PROSPECT_GROUP_RE, prospectCreateSchema, prospectPatchSchema } from "./demoProspectSchemas";

test("create: a minimal body passes and takes the defaults", () => {
  const r = prospectCreateSchema.safeParse({ prospectGroup: "3f2a-uuid-like", firstName: "Anna" });
  assert.equal(r.success, true);
  if (r.success) {
    assert.deepEqual(r.data, {
      prospectGroup: "3f2a-uuid-like",
      firstName: "Anna",
      companyName: "",
      clientNiche: "",
      language: "en",
      aiDisclosure: "",
      market: "",
      notes: "",
      websiteUrl: "",
    });
  }
});

test("create: the group key and first name are checked", () => {
  assert.equal(prospectCreateSchema.safeParse({ prospectGroup: "a b", firstName: "Anna" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ prospectGroup: "abc", firstName: "Anna" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ prospectGroup: "token:abcd1234", firstName: "" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ prospectGroup: "token:abcd1234", firstName: "   " }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ prospectGroup: "token:abcd1234", firstName: "x".repeat(81) }).success, false);
  assert.equal(PROSPECT_GROUP_RE.test("token:abcd1234"), true);
});

test("create: enums and lengths are enforced", () => {
  const base = { prospectGroup: "token:abcd1234", firstName: "Anna" };
  assert.equal(prospectCreateSchema.safeParse({ ...base, language: "de" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, aiDisclosure: "always" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, market: "de" }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, notes: "n".repeat(4001) }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, clientNiche: "n".repeat(301) }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, websiteUrl: "u".repeat(501) }).success, false);
  assert.equal(prospectCreateSchema.safeParse({ ...base, language: "pt", aiDisclosure: "second_message", market: "us" }).success, true);
});

test("patch: an empty change is refused", () => {
  assert.equal(prospectPatchSchema.safeParse({}).success, false);
  const r = prospectPatchSchema.safeParse({});
  if (!r.success) assert.equal(r.error.issues[0].message, "Nothing to change.");
  assert.equal(prospectPatchSchema.safeParse({ prospectGroup: "g123" }).success, false);
});

test("patch: a Client cannot be cleared", () => {
  assert.equal(prospectPatchSchema.safeParse({ clientNiche: "" }).success, false);
  assert.equal(prospectPatchSchema.safeParse({ clientNiche: "   " }).success, false);
  assert.equal(prospectPatchSchema.safeParse({ clientNiche: "Kitchens" }).success, true);
});

test("patch: a single field passes and no defaults are filled in", () => {
  const r = prospectPatchSchema.safeParse({ notes: "Called back Tuesday" });
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data, { notes: "Called back Tuesday" });
  assert.equal(prospectPatchSchema.safeParse({ market: "de" }).success, false);
});
