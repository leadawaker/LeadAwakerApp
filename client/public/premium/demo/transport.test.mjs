// client/public/premium/demo/transport.test.mjs
// Run with: node client/public/premium/demo/transport.test.mjs
import { createTransport } from "./transport.js";

let failed = 0;
function ok(label, cond) { console.log((cond ? "  ok  " : "  FAIL ") + label); if (!cond) failed++; }

function fakeServer() {
  const calls = [];
  let state = { messages: [{ role: "ai", text: "Hi" }], stage: "new", done: false };
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });
    if (url.endsWith("/message")) {
      const { text } = JSON.parse(opts.body);
      state = { ...state, messages: [...state.messages, { role: "visitor", text }, { role: "ai", text: "reply" }] };
      return new Response("{}", { status: 200 });
    }
    if (url.endsWith("/restart")) {
      state = { messages: [{ role: "ai", text: "Hi again" }], stage: "new", done: false };
      return new Response("{}", { status: 200 });
    }
    if (url.endsWith("/recap")) return new Response(JSON.stringify({ summary: "S", brief: [] }), { status: 200 });
    return new Response(JSON.stringify(state), { status: 200 });
  };
  return { calls, fetchImpl, setDone() { state = { ...state, done: true }; } };
}

const manualTimers = () => {
  let queue = [];
  return {
    setTimer: (fn, ms) => { const t = { fn, ms }; queue.push(t); return t; },
    clearTimer: (t) => { queue = queue.filter((x) => x !== t); },
    async flush() { const q = queue; queue = []; for (const t of q) await t.fn(); await new Promise((r) => setTimeout(r, 0)); },
    delays: () => queue.map((t) => t.ms),
  };
};

console.log("transport");
{
  const srv = fakeServer(); const tm = manualTimers(); const states = [];
  const tr = createTransport({ token: "abcd1234", fetchImpl: srv.fetchImpl, ...tm, onState: (s, m) => states.push([s, m]), onRecap() {}, onError() {} });
  const [a, b] = [tr.load(), tr.load()];
  ok("load is single-flight", a === b);
  await a;
  ok("one GET for two loads", srv.calls.filter((c) => c.method === "GET").length === 1);
  ok("GET hits the token base", srv.calls[0].url === "/api/web-demo/abcd1234");
  ok("state delivered", states.at(-1)[0].messages.length === 1);

  await tr.send("  hello  ");
  const optimistic = states.find(([s, m]) => m.pending && s.messages.some((x) => x.role === "visitor" && x.text === "hello"));
  ok("optimistic visitor bubble while pending", !!optimistic);
  ok("message POST body trimmed", JSON.parse(srv.calls.find((c) => c.url.endsWith("/message")).body).text === "hello");
  ok("next poll scheduled fast while pending", tm.delays().some((d) => d <= 1600));
  await tm.flush();
  ok("pending cleared once the reply arrives", tr.isPending() === false && tr.getState().messages.length === 3);

  await tr.send("   ");
  ok("blank send is ignored", srv.calls.filter((c) => c.url.endsWith("/message")).length === 1);

  await tr.restart(null);
  ok("restart replaces state", tr.getState().messages[0].text === "Hi again");

  srv.setDone(); await tm.flush();
  ok("done schedules idle poll", tm.delays().includes(15000));
}
{
  let recapCalls = 0;
  const srv = fakeServer(); srv.setDone(); const tm = manualTimers();
  const tr = createTransport({ token: "t0k3n", fetchImpl: srv.fetchImpl, ...tm, onState() {}, onRecap: () => recapCalls++, onError() {} });
  await tr.load(); await tm.flush(); await tm.flush();
  ok("recap loaded exactly once", recapCalls === 1);
}
{
  const tm = manualTimers(); let err = null;
  const fetchImpl = async () => new Response(JSON.stringify({ message: "gone", code: "not_found" }), { status: 404 });
  const tr = createTransport({ token: "gone1", fetchImpl, ...tm, onState() {}, onRecap() {}, onError: (e) => { err = e; } });
  await tr.load().catch(() => {});
  ok("404 reaches onError with status", err && err.status === 404);
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
