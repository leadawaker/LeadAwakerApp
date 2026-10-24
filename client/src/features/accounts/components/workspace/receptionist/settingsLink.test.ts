import { test } from "node:test";
import assert from "node:assert/strict";
import { nextLinkedAccount } from "./settingsLink";

test("the link's section binds to the first account shown", () => {
  assert.equal(nextLinkedAccount(undefined, undefined), undefined);
  assert.equal(nextLinkedAccount(undefined, 53), 53);
  assert.equal(nextLinkedAccount(53, 53), 53);
  assert.equal(nextLinkedAccount(53, undefined), 53);
});

test("switching to another account uses the link up for good", () => {
  assert.equal(nextLinkedAccount(53, 1), null);
  assert.equal(nextLinkedAccount(null, 53), null);
  assert.equal(nextLinkedAccount(null, 1), null);
});
