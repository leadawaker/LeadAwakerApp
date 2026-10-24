import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewViewerKey } from "./reviewViewer";

test("the same user on their own sees one cache entry", () => {
  assert.equal(reviewViewerKey("7", null), reviewViewerKey("7", null));
});

test("viewing as a client, another client, or a sandbox each get their own entry", () => {
  const own = reviewViewerKey("7", null);
  const asClient = reviewViewerKey("7", { role: "Manager", accountId: 53, sandbox: false });
  const asOther = reviewViewerKey("7", { role: "Manager", accountId: 56, sandbox: false });
  const asViewer = reviewViewerKey("7", { role: "Viewer", accountId: 53, sandbox: false });
  const sandbox = reviewViewerKey("7", { role: "Manager", accountId: 53, sandbox: true });
  assert.equal(new Set([own, asClient, asOther, asViewer, sandbox]).size, 5);
});

test("another user on this browser never reads the first one's review", () => {
  assert.notEqual(reviewViewerKey("7", null), reviewViewerKey("8", null));
  assert.notEqual(reviewViewerKey(null, null), reviewViewerKey("7", null));
});
