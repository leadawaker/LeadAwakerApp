import { test } from "node:test";
import assert from "node:assert/strict";
import { isSocialBlob, overrideHandle, snapshotFromPost, rehandleSnapshot, clientCompanyNames } from "./snapshot";

const row = { companyNameTemplate: { en: "Van Dijk Roofing", nl: "Van Dijk Dakwerken" }, socialImagePath: "0123456789abcdef.webp" };
const fields = { social_post: { handle: "vandijk.roofing", caption: "c", keyword: "ROOF", cta_line: "ROOF", offer: "o", likes: 1 }, social_dm_opener: "x" };

test("isSocialBlob by service or by post", () => {
  assert.equal(isSocialBlob({ service: "socials" }), true);
  assert.equal(isSocialBlob({ social_post: {} }), true);
  assert.equal(isSocialBlob({ service: "dbr" }), false);
  assert.equal(isSocialBlob(null), false);
});

test("the Client's own name in any language is not an override", () => {
  const own = clientCompanyNames(row);
  assert.equal(overrideHandle("Van Dijk Roofing", own), "");
  assert.equal(overrideHandle("van dijk dakwerken ", own), "");
  assert.equal(overrideHandle("", own), "");
  assert.equal(overrideHandle("Acme Daken B.V.", own), "acmedakenb.v.");
});

test("snapshot carries the override handle and the image, leaving the input alone", () => {
  const out = snapshotFromPost(row, fields, "Acme Daken");
  assert.equal((out.social_post as any).handle, "acmedaken");
  assert.equal(out.social_image_path, "0123456789abcdef.webp");
  assert.equal(fields.social_post.handle, "vandijk.roofing");
  const plain = snapshotFromPost({ ...row, socialImagePath: null }, fields, "Van Dijk Roofing");
  assert.equal((plain.social_post as any).handle, "vandijk.roofing");
  assert.equal("social_image_path" in plain, false);
});

test("rehandle follows the company and reverts when cleared", () => {
  const own = clientCompanyNames(row);
  const blob = { social_post: { handle: "vandijk.roofing" } };
  assert.equal((rehandleSnapshot(blob, "Acme", "vandijk.roofing", own)!.social_post as any).handle, "acme");
  assert.equal(rehandleSnapshot(blob, "", "vandijk.roofing", own), null);
  const overridden = { social_post: { handle: "acme" } };
  assert.equal((rehandleSnapshot(overridden, "", "vandijk.roofing", own)!.social_post as any).handle, "vandijk.roofing");
  assert.equal(rehandleSnapshot({}, "Acme", "x", own), null);
});
