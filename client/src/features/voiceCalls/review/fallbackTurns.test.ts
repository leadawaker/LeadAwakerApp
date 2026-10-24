import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackTurns } from "./fallbackTurns";

const turn = (id: number, direction: string, content: string | null, spokenAt: string | null, createdAt: string | null = spokenAt, kind: string | null = null) =>
  ({ id, who: null, direction, content, spokenAt, createdAt, kind });

const call = (turns: ReturnType<typeof turn>[], recordingStartedAt: string | null = null) => ({
  startedAt: "2026-10-24T10:00:00.000Z", recordingStartedAt, turns,
});

test("the call's own turns become caller / agent lines timed from the call start", () => {
  const out = fallbackTurns(call([
    turn(1, "outbound", "Hi, Robben here", "2026-10-24T10:00:01.000Z"),
    turn(2, "inbound", "I want to book", "2026-10-24T10:00:05.500Z"),
  ]));
  assert.deepEqual(out, [
    { i: 0, role: "agent", text: "Hi, Robben here", atS: 1, delayMs: null },
    { i: 1, role: "user", text: "I want to book", atS: 5.5, delayMs: null },
  ]);
});

test("receipts are left out, a missing time keeps the previous one, and the recording start wins", () => {
  const out = fallbackTurns(call([
    turn(1, "outbound", "Hello", "2026-10-24T10:00:04.000Z"),
    turn(2, "outbound", "Booked: Tue 10:00", null, "2026-10-24T10:00:06.000Z", "receipt"),
    turn(3, "inbound", null, null, null),
  ], "2026-10-24T10:00:02.000Z"));
  assert.deepEqual(out.map((x) => [x.i, x.role, x.text, x.atS]), [[0, "agent", "Hello", 2], [1, "user", "", 2]]);
});
