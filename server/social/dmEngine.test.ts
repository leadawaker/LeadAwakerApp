// Comment-to-DM engine against in-memory fakes. The send functions are the REAL guarded ones from
// igMessaging.ts with a counting fetch, so "no network call without both switches" is proven end to end.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SocialDmRule } from "@shared/schema";
import { deliverManualReply, parseWebhookPayload, pickRule, processWebhookEvents, type DmConnection, type DmDeps, type LogRow } from "./dmEngine";
import { sendDirectMessage, sendPrivateReply } from "./igMessaging";

const NOW = new Date("2026-10-20T12:00:00Z");
const IG = "17841000000000056";
const A = 7;

let settings: { dmMode: string; dmHourlyCap: number } | null;
let env: NodeJS.ProcessEnv;
let rules: SocialDmRule[];
let events: Map<string, string | null>;
let logs: Array<LogRow & { id: number; createdAt: Date }>;
let optOuts: Set<string>;
let leads: Map<string, number>;
let interactions: Array<{ leadId: number; direction: string; content: string; kind: string }>;
let optedOutLeads: number[];
let fetchCalls: Array<{ url: string; body: any }>;
let fetchFails: boolean;
let notes: string[];
let conn: DmConnection | null;

const rule = (over: Partial<SocialDmRule>): SocialDmRule => ({
  id: 1, accountsId: A, postId: null, igMediaId: null, keyword: "GUIA", keywordNorm: "GUIA", firstMessage: "Oi {username}! Aqui está o guia: link",
  aiFollowUp: false, active: true, createdByUserId: 1, createdAt: NOW, updatedAt: NOW, ...over,
});

const fetchImpl = (async (url: any, init?: RequestInit) => {
  fetchCalls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "null")) });
  if (fetchFails) return new Response(JSON.stringify({ error: { message: "User cannot receive messages", code: 10 } }), { status: 400 });
  return new Response(JSON.stringify({ message_id: `m.${fetchCalls.length}` }), { status: 200 });
}) as typeof fetch;

const deps: DmDeps = {
  now: () => NOW,
  env: () => env,
  async findConnection(id) { return id === IG ? conn : null; },
  async findConnectionForAccount(id) { return id === A ? conn : null; },
  async getSettings() { return settings; },
  async claimEvent(key) { if (events.has(key)) return false; events.set(key, null); return true; },
  async finishEvent(key, outcome) { events.set(key, outcome); },
  async listActiveRules() { return rules.filter((r) => r.active); },
  async isOptedOut(_a, u) { return optOuts.has(u); },
  async addOptOut(_a, u) { optOuts.add(u); },
  async countSentSince(_a, since) { return logs.filter((l) => (l.kind === "private_reply" || l.kind === "reply") && (l.status === "sent" || l.status === "would_send") && l.createdAt >= since).length; },
  async insertLog(row) {
    if (row.kind === "private_reply" && logs.some((l) => l.kind === "private_reply" && l.commentId === row.commentId)) return null;
    const r = { ...row, id: logs.length + 1, createdAt: NOW };
    logs.push(r);
    return { id: r.id };
  },
  async updateLog(id, fields) { Object.assign(logs.find((l) => l.id === id)!, fields); },
  async findPrivateReply(_a, u) { const l = [...logs].reverse().find((x) => x.kind === "private_reply" && x.igUserId === u && x.status !== "skipped"); return l ? { ruleId: l.ruleId ?? null, status: l.status, mode: l.mode } : null; },
  async lastInboundAt(_a, u) { return logs.filter((l) => l.kind === "inbound" && l.igUserId === u).length ? NOW : null; },
  async hasInbound(_a, u) { return logs.some((l) => l.kind === "inbound" && l.igUserId === u); },
  crm: {
    async findOrCreateLead(_a, u) { if (!leads.has(u)) leads.set(u, 100 + leads.size); return { id: leads.get(u)! }; },
    async findLead(_a, u) { return leads.has(u) ? { id: leads.get(u)! } : null; },
    async addInteraction(row) { interactions.push(row); return { id: interactions.length }; },
    async markOptedOut(id) { optedOutLeads.push(id); },
  },
  send: {
    privateReply: (c, mode, commentId, text) => sendPrivateReply({ accountMode: mode, igUserId: c.igUserId, token: c.token!, deps: { fetch: fetchImpl }, env }, commentId, text),
    directMessage: (c, mode, to, text) => sendDirectMessage({ accountMode: mode, igUserId: c.igUserId, token: c.token!, deps: { fetch: fetchImpl }, env }, to, text),
  },
  notifyAgency: async (n) => { notes.push(n.title); },
};

beforeEach(() => {
  settings = { dmMode: "live", dmHourlyCap: 20 };
  env = { INSTAGRAM_DM_LIVE: "1" };
  rules = [rule({})];
  events = new Map();
  logs = [];
  optOuts = new Set();
  leads = new Map();
  interactions = [];
  optedOutLeads = [];
  fetchCalls = [];
  fetchFails = false;
  notes = [];
  conn = { accountId: A, igUserId: IG, username: "draugustobfronza", status: "connected", token: "tok" };
});

const commentPayload = (o: { id?: string; text?: string; from?: string; username?: string; media?: string; time?: number } = {}) => ({
  object: "instagram",
  entry: [{ id: IG, time: o.time ?? NOW.getTime() / 1000, changes: [{ field: "comments", value: { id: o.id ?? "c1", text: o.text ?? "guia!", from: { id: o.from ?? "u1", username: o.username ?? "maria" }, media: { id: o.media ?? "m1" } } }] }],
});
const messagePayload = (o: { mid?: string; text?: string; from?: string; echo?: boolean } = {}) => ({
  object: "instagram",
  entry: [{ id: IG, time: NOW.getTime(), messaging: [{ sender: { id: o.from ?? "u1" }, recipient: { id: IG }, timestamp: NOW.getTime(), message: { mid: o.mid ?? "mid1", text: o.text ?? "Quero sim", ...(o.echo ? { is_echo: true } : {}) } }] }],
});
const run = (payload: unknown) => processWebhookEvents(deps, parseWebhookPayload(payload, NOW));

// ─── Parsing ─────────────────────────────────────────────────────────────────

test("parses comments and messages; ignores other objects and junk", () => {
  const ev = parseWebhookPayload(commentPayload(), NOW);
  assert.equal(ev.length, 1);
  assert.deepEqual({ ...ev[0], at: undefined }, { field: "comments", igAccountId: IG, commentId: "c1", text: "guia!", fromId: "u1", fromUsername: "maria", mediaId: "m1", at: undefined });
  assert.equal(parseWebhookPayload(messagePayload({ echo: true }), NOW)[0].field, "messages");
  assert.deepEqual(parseWebhookPayload({ object: "page", entry: [] }, NOW), []);
  assert.deepEqual(parseWebhookPayload(null, NOW), []);
  assert.deepEqual(parseWebhookPayload({ object: "instagram", entry: [{ id: IG, changes: [{ field: "comments", value: { text: "no id" } }] }] }, NOW), []);
});

test("a post's own rule wins over an all-posts rule; inactive rules never match", () => {
  const all = rule({ id: 1, keyword: "GUIA", keywordNorm: "GUIA", firstMessage: "all" });
  const own = rule({ id: 2, igMediaId: "m1", keyword: "GUIA", keywordNorm: "GUIA", firstMessage: "own" });
  assert.equal(pickRule([all, own], "m1", "guia")?.id, 2);
  assert.equal(pickRule([all, own], "m2", "guia")?.id, 1);
  assert.equal(pickRule([rule({ active: false })], "m1", "guia"), null);
});

// ─── The switches ────────────────────────────────────────────────────────────

test("off by default: no settings row means nothing happens and nothing is logged", async () => {
  settings = null;
  assert.deepEqual(await run(commentPayload()), ["off"]);
  assert.equal(logs.length + fetchCalls.length + interactions.length, 0);
});

test("dry run: matches, logs what it would send, sends nothing, writes nothing to the CRM", async () => {
  settings = { dmMode: "dry_run", dmHourlyCap: 20 };
  assert.deepEqual(await run(commentPayload()), ["would_send"]);
  assert.equal(logs[0].status, "would_send");
  assert.equal(logs[0].text, "Oi @maria! Aqui está o guia: link");
  assert.equal(fetchCalls.length, 0);
  assert.equal(leads.size, 0);
  assert.equal(interactions.length, 0);
});

test("account live but INSTAGRAM_DM_LIVE not set: it behaves as dry run, no network call", async () => {
  env = {};
  assert.deepEqual(await run(commentPayload()), ["would_send"]);
  assert.equal(logs[0].mode, "dry_run");
  assert.equal(fetchCalls.length, 0);
});

test("live with both switches: one private reply, the conversation lands in the CRM", async () => {
  assert.deepEqual(await run(commentPayload()), ["sent"]);
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(fetchCalls[0].body, { recipient: { comment_id: "c1" }, message: { text: "Oi @maria! Aqui está o guia: link" } });
  assert.equal(logs[0].status, "sent");
  assert.equal(leads.get("u1"), 100);
  assert.deepEqual(interactions.map((i) => [i.direction, i.kind]), [["inbound", "instagram_comment"], ["outbound", "instagram_private_reply"]]);
});

// ─── Guards ──────────────────────────────────────────────────────────────────

test("the same comment delivered twice is processed once; a second comment by the same person on the same comment id is refused", async () => {
  assert.deepEqual(await run(commentPayload()), ["sent"]);
  assert.deepEqual(await run(commentPayload()), ["duplicate"]);
  events.clear(); // even if the event table lost it, the one-private-reply index holds
  assert.deepEqual(await run(commentPayload()), ["already_replied"]);
  assert.equal(fetchCalls.length, 1);
});

test("the account's own comments, unknown accounts, no keyword", async () => {
  assert.deepEqual(await run(commentPayload({ from: IG })), ["own_comment"]);
  assert.deepEqual(await run(commentPayload({ id: "c2", from: "u5", username: "DrAugustoBFronza" })), ["own_comment"]);
  assert.deepEqual(await run({ ...commentPayload(), entry: [{ ...commentPayload().entry[0], id: "999" }] }), ["unknown_account"]);
  assert.deepEqual(await run(commentPayload({ id: "c3", text: "lindo vídeo" })), ["no_match"]);
  assert.equal(fetchCalls.length, 0);
});

test("opted out, older than 7 days, hourly cap: logged as skipped, nothing sent", async () => {
  optOuts.add("u1");
  assert.deepEqual(await run(commentPayload({ id: "c1" })), ["opted_out"]);
  assert.deepEqual(await run(commentPayload({ id: "c2", from: "u2", time: NOW.getTime() / 1000 - 8 * 86400 })), ["window_closed"]);
  settings = { dmMode: "live", dmHourlyCap: 1 };
  assert.deepEqual(await run(commentPayload({ id: "c3", from: "u3" })), ["sent"]);
  assert.deepEqual(await run(commentPayload({ id: "c4", from: "u4" })), ["hourly_cap"]);
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(logs.filter((l) => l.status === "skipped").map((l) => l.reason), ["opted_out", "window_closed", "hourly_cap"]);
});

test("a send error is recorded, agency told, never retried", async () => {
  fetchFails = true;
  assert.deepEqual(await run(commentPayload()), ["failed"]);
  assert.match(logs[0].reason!, /cannot receive/);
  assert.deepEqual(notes, ["Instagram private reply failed"]);
  assert.deepEqual(await run(commentPayload()), ["duplicate"]);
  assert.equal(fetchCalls.length, 1);
  assert.equal(leads.size, 0, "no CRM lead for a message that never arrived");
});

test("a disconnected connection fails the reply without a call", async () => {
  conn = { ...conn!, token: null, status: "disconnected" };
  assert.deepEqual(await run(commentPayload()), ["not_connected"]);
  assert.equal(fetchCalls.length, 0);
});

// ─── Replies in DM ───────────────────────────────────────────────────────────

test("a DM reply from someone the flow wrote to lands in Chats; agency told once; others are ignored", async () => {
  await run(commentPayload());
  assert.deepEqual(await run(messagePayload()), ["received"]);
  assert.deepEqual(await run(messagePayload({ mid: "mid2", text: "E o preço?" })), ["received"]);
  assert.equal(interactions.filter((i) => i.kind === "instagram_dm").length, 2);
  assert.deepEqual(notes, ["Instagram DM reply"]);
  assert.deepEqual(await run(messagePayload({ mid: "mid3", from: "stranger" })), ["not_in_flow"]);
  assert.deepEqual(await run(messagePayload({ mid: "mid4", echo: true })), ["echo"]);
  assert.deepEqual(await run(messagePayload({ mid: "mid2" })), ["duplicate"]);
});

test("a stop word opts the person out: no more automated messages, the lead is marked", async () => {
  await run(commentPayload());
  assert.deepEqual(await run(messagePayload({ text: "PARAR" })), ["opted_out"]);
  assert.ok(optOuts.has("u1"));
  assert.deepEqual(optedOutLeads, [100]);
  assert.deepEqual(await run(commentPayload({ id: "c9" })), ["opted_out"]);
  assert.equal(fetchCalls.length, 1, "only the first private reply ever went out");
});

test("AI follow-up on: recorded as not connected to the engine, nothing sent", async () => {
  rules = [rule({ aiFollowUp: true })];
  await run(commentPayload());
  await run(messagePayload());
  const ai = logs.find((l) => l.kind === "ai_follow_up");
  assert.equal(ai?.status, "skipped");
  assert.equal(ai?.reason, "engine_not_connected");
  assert.equal(fetchCalls.length, 1);
});

test("live mode never pulls a dry-run conversation into the CRM", async () => {
  settings = { dmMode: "dry_run", dmHourlyCap: 20 };
  await run(commentPayload());
  settings = { dmMode: "live", dmHourlyCap: 20 };
  assert.deepEqual(await run(messagePayload()), ["not_in_flow"]);
  assert.equal(leads.size, 0);
});

// ─── A reply typed in Chats ──────────────────────────────────────────────────

test("manual reply: delivered only inside 24 h, never to an opted-out person, dry run sends nothing", async () => {
  await run(commentPayload());
  assert.deepEqual(await deliverManualReply(deps, { accountId: A, igUserId: "u1", leadId: 100, text: "Olá!" }), { status: "failed", reason: "window_closed" });
  await run(messagePayload());
  assert.deepEqual(await deliverManualReply(deps, { accountId: A, igUserId: "u1", leadId: 100, text: "Olá!" }), { status: "delivered" });
  assert.deepEqual(fetchCalls.at(-1)?.body, { recipient: { id: "u1" }, message: { text: "Olá!" } });
  env = {};
  const before = fetchCalls.length;
  assert.deepEqual(await deliverManualReply(deps, { accountId: A, igUserId: "u1", leadId: 100, text: "x" }), { status: "dry_run" });
  assert.equal(fetchCalls.length, before);
  env = { INSTAGRAM_DM_LIVE: "1" };
  optOuts.add("u1");
  assert.deepEqual(await deliverManualReply(deps, { accountId: A, igUserId: "u1", leadId: 100, text: "x" }), { status: "failed", reason: "opted_out" });
  settings = { dmMode: "off", dmHourlyCap: 20 };
  assert.deepEqual(await deliverManualReply(deps, { accountId: A, igUserId: "u1", leadId: 100, text: "x" }), { status: "failed", reason: "dm_off" });
  assert.equal(fetchCalls.length, before);
});
