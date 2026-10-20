import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseSignedRequest } from "./signedRequest";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
function make(payload: object, secret: string) {
  const p = b64url(JSON.stringify(payload));
  return `${b64url(createHmac("sha256", secret).update(p).digest())}.${p}`;
}
test("valid signed request returns payload", () => {
  assert.equal(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "1784" }, "s3cret"), "s3cret")?.user_id, "1784");
});
test("wrong secret, tampered payload or garbage returns null", () => {
  const good = make({ algorithm: "HMAC-SHA256", user_id: "1784" }, "s3cret");
  assert.equal(parseSignedRequest(good, "other"), null);
  assert.equal(parseSignedRequest(good.split(".")[0] + "." + b64url('{"user_id":"9"}'), "s3cret"), null);
  assert.equal(parseSignedRequest("nope", "s3cret"), null);
});
