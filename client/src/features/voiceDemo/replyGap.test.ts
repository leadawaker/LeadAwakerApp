import test from "node:test";
import assert from "node:assert/strict";
import { createReplyGapTracker } from "./replyGap";

test("the gap runs from the caller's last delta to her first", () => {
  const t = createReplyGapTracker();
  t.caller(1000);
  t.caller(1400);
  assert.equal(t.agentTurnStart(1900), 500);
});

test("her opening line has no gap", () => {
  assert.equal(createReplyGapTracker().agentTurnStart(500), null);
});

test("a lagging caller delta mid-reply does not give a bogus gap to her next turn start", () => {
  const t = createReplyGapTracker();
  t.caller(1000);
  assert.equal(t.agentTurnStart(1800), 800); // first delta of her turn
  t.caller(1830); // late input transcript arrives mid-reply
  // the hook only calls agentTurnStart on a turn's first delta; her later deltas never ask
  assert.equal(t.agentTurnStart(5000), 3170); // her NEXT turn answers that caller speech
});

test("reset forgets the caller", () => {
  const t = createReplyGapTracker();
  t.caller(1000);
  t.reset();
  assert.equal(t.agentTurnStart(2000), null);
});
