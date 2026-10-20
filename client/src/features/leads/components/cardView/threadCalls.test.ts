import { test } from "node:test";
import assert from "node:assert/strict";
import { callLength, splitThreadCalls } from "./threadCalls";

test("call turns collapse into one entry per call, chat messages stay", () => {
  const msgs = [
    { type: "whatsapp", created_at: "2026-10-20T09:00:00Z" },
    { type: "voice_call", conversation_thread_id: "c1", created_at: "2026-10-20T10:00:00Z" },
    { type: "voice_call", conversation_thread_id: "c1", created_at: "2026-10-20T10:02:05Z" },
    { type: "website", created_at: "2026-10-20T11:00:00Z" },
    { type: "Voice_Call", conversationThreadId: "c2", createdAt: "2026-10-20T12:00:00Z" },
  ];
  const { chat, calls } = splitThreadCalls(msgs);
  assert.equal(chat.length, 2);
  assert.deepEqual(calls.map((c) => [c.callId, c.turns]), [["c1", 2], ["c2", 1]]);
  assert.equal(callLength(calls[0]), "2:05");
  assert.equal(callLength(calls[1]), null);
});

test("a voice_call row without a call id stays in the chat", () => {
  assert.equal(splitThreadCalls([{ type: "voice_call", created_at: "x" }]).chat.length, 1);
});
