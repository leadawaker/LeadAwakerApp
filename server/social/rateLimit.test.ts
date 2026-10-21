import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rateLimit";

test("allows max hits per window per key, then frees up as the window slides", () => {
  const rl = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(rl.take("u1", 0), true);
  assert.equal(rl.take("u1", 100), true);
  assert.equal(rl.take("u1", 200), false);
  assert.equal(rl.take("u2", 200), true, "other keys are separate");
  assert.equal(rl.retryAfterS("u1", 200), 1);
  assert.equal(rl.take("u1", 1001), true, "the first hit left the window");
  assert.equal(rl.retryAfterS("u2", 300), 0);
});
