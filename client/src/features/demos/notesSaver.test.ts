import { test } from "node:test";
import assert from "node:assert/strict";
import { createNotesSaver } from "./notesSaver";

/** A send whose calls finish only when the test says so, so ordering can be observed. */
function controlledSend() {
  const calls: { text: string; finish: () => void; fail: (e: Error) => void }[] = [];
  const send = (text: string) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ text, finish: resolve, fail: reject });
    });
  return { calls, send };
}

const tick = () => new Promise<void>((r) => setImmediate(r));

test("unchanged text sends nothing", async () => {
  const sent: string[] = [];
  const saver = createNotesSaver("hello", { send: async (t) => void sent.push(t), onError: () => {} });
  await saver.save();
  saver.set("hello");
  await saver.save();
  assert.deepEqual(sent, []);
});

test("changed text is sent once, however often save runs", async () => {
  const sent: string[] = [];
  const saver = createNotesSaver("", { send: async (t) => void sent.push(t), onError: () => {} });
  saver.set("called back");
  await Promise.all([saver.save(), saver.save()]);
  await saver.save();
  assert.deepEqual(sent, ["called back"]);
});

test("save resolves only after its send finished: a delete that awaits it comes after the note", async () => {
  const { calls, send } = controlledSend();
  const saver = createNotesSaver("", { send, onError: () => {} });
  saver.set("note");
  let settled = false;
  const pending = saver.save().then(() => {
    settled = true;
  });
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(settled, false);
  calls[0].finish();
  await pending;
  assert.equal(settled, true);
});

test("a save started while another is in flight waits for it, so notes reach the server in order", async () => {
  const { calls, send } = controlledSend();
  const saver = createNotesSaver("", { send, onError: () => {} });
  saver.set("first");
  const a = saver.save();
  saver.set("second");
  const b = saver.save();
  await tick();
  assert.deepEqual(calls.map((c) => c.text), ["first"]);
  calls[0].finish();
  await tick();
  assert.deepEqual(calls.map((c) => c.text), ["first", "second"]);
  calls[1].finish();
  await Promise.all([a, b]);
});

test("a failed send reports the error, never rejects, and the same text is sent again next time", async () => {
  const errors: unknown[] = [];
  let fail = true;
  const sent: string[] = [];
  const saver = createNotesSaver("", {
    send: async (t) => {
      sent.push(t);
      if (fail) throw new Error("offline");
    },
    onError: (e) => errors.push(e),
  });
  saver.set("note");
  await saver.save();
  assert.equal(errors.length, 1);
  fail = false;
  await saver.save();
  assert.deepEqual(sent, ["note", "note"]);
  assert.equal(errors.length, 1);
});

test("discard counts the text as saved, so nothing is sent after a delete", async () => {
  const sent: string[] = [];
  const saver = createNotesSaver("", { send: async (t) => void sent.push(t), onError: () => {} });
  saver.set("never mind");
  saver.discard();
  await saver.save();
  assert.deepEqual(sent, []);
});
