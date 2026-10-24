import test from "node:test";
import assert from "node:assert/strict";
import { flushAllAutosaves, registerFlush } from "./autosaveRegistry";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test("flushAllAutosaves waits for every registered flush", async () => {
  const a = deferred();
  const b = deferred();
  const calls: string[] = [];
  const offA = registerFlush(() => { calls.push("a"); return a.promise; });
  const offB = registerFlush(() => { calls.push("b"); return b.promise; });

  let done = false;
  const all = flushAllAutosaves().then(() => { done = true; });
  await Promise.resolve();
  assert.deepEqual(calls.sort(), ["a", "b"]);
  a.resolve();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(done, false, "still waiting on b");
  b.resolve();
  await all;
  assert.equal(done, true);
  offA();
  offB();
});

test("an unregistered flush is not called", async () => {
  let called = 0;
  const off = registerFlush(async () => { called++; });
  off();
  await flushAllAutosaves();
  assert.equal(called, 0);
});

test("a failing flush does not stop the others or reject", async () => {
  let other = 0;
  const offBad = registerFlush(async () => { throw new Error("save failed"); });
  const offGood = registerFlush(async () => { other++; });
  await flushAllAutosaves();
  assert.equal(other, 1);
  offBad();
  offGood();
});

test("with nothing registered it resolves at once", async () => {
  await flushAllAutosaves();
});

test("a hung save stops blocking after the timeout", async () => {
  const off = registerFlush(() => new Promise<void>(() => {}));
  const t0 = Date.now();
  await flushAllAutosaves({ timeoutMs: 50 });
  assert.ok(Date.now() - t0 < 1000);
  off();
});
