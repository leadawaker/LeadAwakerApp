import { test } from "node:test";
import assert from "node:assert/strict";
import { goLinkQuery, parseGoLinkParams } from "./goLinkParams";

test("known targets pass, everything else is dropped", () => {
  assert.deepEqual(parseGoLinkParams("?to=settings"), { to: "settings" });
  assert.deepEqual(parseGoLinkParams("?to=calls"), { to: "calls" });
  assert.deepEqual(parseGoLinkParams("?call=CA_12-ab"), { call: "CA_12-ab" });
  assert.deepEqual(parseGoLinkParams("?to=admin"), {});
  assert.deepEqual(parseGoLinkParams("?call=../x"), {});
  assert.deepEqual(parseGoLinkParams("?call=<script>"), {});
});

test("round trip", () => {
  assert.equal(goLinkQuery(parseGoLinkParams("?call=abc123&x=1")), "?call=abc123");
  assert.equal(goLinkQuery(parseGoLinkParams("?to=calls")), "?to=calls");
  assert.equal(goLinkQuery({}), "");
});
