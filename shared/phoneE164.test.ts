import test from "node:test";
import assert from "node:assert/strict";
import { toE164 } from "./phoneE164";

test("Dutch local numbers get +31", () => {
  assert.equal(toE164("06-28139119"), "+31628139119");
  assert.equal(toE164("06 28 13 91 19"), "+31628139119");
  assert.equal(toE164("073-8519847"), "+31738519847");
});

test("international forms are cleaned, not changed", () => {
  assert.equal(toE164("+44 7700 900131"), "+447700900131");
  assert.equal(toE164("+31 (0)6 2813 9119"), "+31628139119");
  assert.equal(toE164("0031628139119"), "+31628139119");
  assert.equal(toE164("+31627458300"), "+31627458300");
});

test("other default country", () => {
  assert.equal(toE164("07700 900131", "GB"), "+447700900131");
  assert.equal(toE164("(11) 98765-4321", "BR"), "+5511987654321");
});

test("not a number gives null", () => {
  assert.equal(toE164("web"), null);
  assert.equal(toE164(""), null);
  assert.equal(toE164(null), null);
  assert.equal(toE164("123"), null);
  assert.equal(toE164("wa-demo:abc"), null);
  assert.equal(toE164("+1234567890123456"), null);
});
