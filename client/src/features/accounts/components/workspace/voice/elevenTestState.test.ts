import test from "node:test";
import assert from "node:assert/strict";
import { elevenTestReducer, errorKeyForStatus, initialElevenTestState as idle, type ElevenTestState } from "./elevenTestState";

const live = (over: Partial<ElevenTestState> = {}): ElevenTestState => ({ ...idle, status: "listening", ...over });

test("start: idle to connecting, clears old lines and error", () => {
  const s = elevenTestReducer({ status: "error", lines: [{ role: "user", text: "hi" }], error: "busy" }, { type: "start" });
  assert.deepEqual(s, { status: "connecting", lines: [], error: null });
});

test("connect: connecting to listening", () => {
  assert.equal(elevenTestReducer({ ...idle, status: "connecting" }, { type: "connected" }).status, "listening");
});

test("mode change: listening to speaking and back", () => {
  const speaking = elevenTestReducer(live(), { type: "mode", mode: "speaking" });
  assert.equal(speaking.status, "speaking");
  assert.equal(elevenTestReducer(speaking, { type: "mode", mode: "listening" }).status, "listening");
});

test("mode change after the call ended is ignored", () => {
  assert.equal(elevenTestReducer({ ...idle, status: "ended" }, { type: "mode", mode: "speaking" }).status, "ended");
});

test("onMessage appends a line", () => {
  const a = elevenTestReducer(live(), { type: "message", role: "agent", text: "Good morning" });
  const b = elevenTestReducer(a, { type: "message", role: "user", text: "Hello" });
  assert.deepEqual(b.lines, [{ role: "agent", text: "Good morning" }, { role: "user", text: "Hello" }]);
});

test("an empty message adds no line", () => {
  assert.deepEqual(elevenTestReducer(live(), { type: "message", role: "agent", text: "  " }).lines, []);
});

test("disconnect from any state ends", () => {
  for (const status of ["idle", "connecting", "listening", "speaking", "ended", "error"] as const) {
    assert.equal(elevenTestReducer({ ...idle, status }, { type: "disconnected" }).status, "ended", status);
  }
});

test("disconnect keeps the lines", () => {
  const lines = [{ role: "agent" as const, text: "Bye" }];
  assert.deepEqual(elevenTestReducer(live({ lines }), { type: "disconnected" }).lines, lines);
});

test("error state keeps lines and records the key", () => {
  const lines = [{ role: "user" as const, text: "Hi" }];
  const s = elevenTestReducer(live({ lines }), { type: "error", error: "dropped" });
  assert.deepEqual(s, { status: "error", lines, error: "dropped" });
});

test("status to error key", () => {
  assert.equal(errorKeyForStatus(429), "busy");
  assert.equal(errorKeyForStatus(403), "notEleven");
  assert.equal(errorKeyForStatus(409), "notSetUp");
  assert.equal(errorKeyForStatus(422), "badCaller");
  assert.equal(errorKeyForStatus(502), "eleven");
  assert.equal(errorKeyForStatus(500), "generic");
});

test("hang up while connecting: ends, and a late connect or mode change does not revive it", () => {
  const ended = elevenTestReducer({ ...idle, status: "connecting" }, { type: "disconnected" });
  assert.equal(ended.status, "ended");
  assert.equal(elevenTestReducer(ended, { type: "connected" }).status, "ended");
  assert.equal(elevenTestReducer(ended, { type: "mode", mode: "speaking" }).status, "ended");
});

test("a new start after an early end connects again", () => {
  const s = elevenTestReducer(elevenTestReducer({ ...idle, status: "ended" }, { type: "start" }), { type: "connected" });
  assert.equal(s.status, "listening");
});
