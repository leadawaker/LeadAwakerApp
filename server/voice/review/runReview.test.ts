import test from "node:test";
import assert from "node:assert/strict";
import { runReview, type AiComplete, type ReviewDeps, type ReviewJob, type ReviewStore } from "./runReview";
import type { ReviewCallRow } from "./reviewStats";
import type { NewSuggestion } from "../../storage/voicePromptDrafts";
import type { ReviewReport, ReviewStats } from "@shared/voiceReview";

const NL = "Goedemorgen. Ik help u graag. Tot ziens.";
const EN = "Good morning. Happy to help. Goodbye.";

const job: ReviewJob = {
  reviewId: 7, accountId: 53,
  periodStart: new Date("2026-10-18T22:00:00Z"), periodEnd: new Date("2026-10-25T23:00:00Z"),
};

const call = (callId: string, over: Partial<ReviewCallRow> = {}): ReviewCallRow => ({
  callId, startedAt: "2026-10-20T08:00:00.000Z", endedAt: "2026-10-20T08:02:00.000Z", outcome: "booked",
  endReason: "goodbye", costUsd: 0.2, latencyMs: 1500, latencyP90Ms: 2000, toolErrors: 0, ...over,
});

interface Log {
  finished: { id: number; stats: ReviewStats; report: ReviewReport; model: string | null }[];
  failed: { id: number; error: string }[];
  inserted: NewSuggestion[][];
  transcriptAsked: string[][];
  aiCalls: Parameters<AiComplete>[0][];
}

function setup(opts: {
  calls?: ReviewCallRow[];
  answer?: unknown;
  aiResult?: Awaited<ReturnType<AiComplete>>;
  store?: Partial<ReviewStore>;
  ai?: AiComplete;
} = {}) {
  const log: Log = { finished: [], failed: [], inserted: [], transcriptAsked: [], aiCalls: [] };
  const store: ReviewStore = {
    listCalls: async () => opts.calls ?? [],
    transcripts: async (ids) => {
      log.transcriptAsked.push(ids);
      return new Map(ids.map((id) => [id, [{ role: "caller" as const, text: `hello from ${id}` }]]));
    },
    toolEvents: async () => new Map(),
    knowledge: async () => [{ title: "Hours", content: "9 to 5" }],
    accountName: async () => "Robben Test",
    previous: async () => null,
    livePrompts: async () => ({ nl: { id: 130, text: NL }, en: { id: 131, text: EN } }),
    rejected: async () => [],
    insertSuggestions: async (rows) => { log.inserted.push(rows); return rows.map((_, i) => 900 + i); },
    finish: async (id, out) => { log.finished.push({ id, ...out }); },
    fail: async (id, error) => { log.failed.push({ id, error }); },
    ...opts.store,
  };
  const ai: AiComplete = opts.ai ?? (async (o) => {
    log.aiCalls.push(o);
    return opts.aiResult ?? { text: JSON.stringify(opts.answer ?? baseAnswer()) };
  });
  const deps: ReviewDeps = { ai, rules: () => "RULES", store };
  return { deps, log };
}

const baseAnswer = (over: Record<string, unknown> = {}) => ({
  summary: "Fine", comparison: "No earlier review", problems: [], worstCalls: [], knowledgeBase: [], proposals: [], ...over,
});

const proposal = (over: Record<string, unknown> = {}) => ({
  language: "nl", title: "Warmer offer", reason: "Callers hang up", find: "Ik help u graag.",
  replace: "Waarmee kan ik helpen?", mirrorFind: "Happy to help.", mirrorReplace: "How can I help?",
  callIds: ["el_x"], ...over,
});

test("runReview: no calls stores a done review with the empty report and never calls the model", async () => {
  const { deps, log } = setup({ calls: [] });
  assert.equal(await runReview(deps, job), "done");
  assert.equal(log.aiCalls.length, 0);
  assert.equal(log.failed.length, 0);
  assert.equal(log.finished.length, 1);
  const f = log.finished[0];
  assert.equal(f.id, 7);
  assert.equal(f.stats.calls, 0);
  assert.equal(f.model, null);
  assert.deepEqual(f.report, {
    summary: "No ElevenLabs phone calls in this period.", comparison: "", problems: [], worstCalls: [],
    knowledgeBase: [], droppedProposals: 0,
  });
  assert.equal(log.inserted.length, 0);
});

test("runReview: inserts the valid proposal as a card, drops the one that does not apply, and filters call ids", async () => {
  const { deps, log } = setup({
    calls: [call("el_x"), call("el_y")],
    answer: baseAnswer({
      summary: "Two calls",
      problems: [{ title: "Long greeting", detail: "d", callIds: ["el_x", "el_zzz"] }],
      worstCalls: [{ callId: "el_x", why: "hung up" }, { callId: "el_zzz", why: "invented" }],
      proposals: [proposal({ callIds: ["el_x", "el_zzz"] }), proposal({ title: "Ghost", find: "This text is not in the prompt" })],
    }),
  });
  assert.equal(await runReview(deps, job), "done");

  assert.equal(log.aiCalls.length, 1);
  assert.equal(log.aiCalls[0].model, "opus");
  assert.equal(log.aiCalls[0].timeoutMs, 600_000);
  assert.ok(log.aiCalls[0].jsonSchema);
  assert.ok(log.aiCalls[0].system.startsWith("RULES"));
  assert.ok(log.aiCalls[0].user.includes("hello from el_x"));
  assert.ok(log.aiCalls[0].user.includes(NL));

  assert.equal(log.inserted.length, 1);
  assert.equal(log.inserted[0].length, 1);
  const s = log.inserted[0][0];
  assert.equal(s.source, "review");
  assert.equal(s.reviewId, 7);
  assert.equal(s.accountId, 53);
  assert.equal(s.coachMessageId, null);
  assert.equal(s.promptId, 130);
  assert.equal(s.mirrorPromptId, 131);
  assert.equal(s.proposal.title, "Warmer offer");
  assert.deepEqual(s.proposal.callIds, ["el_x"]);

  assert.equal(log.finished.length, 1);
  const f = log.finished[0];
  assert.equal(f.model, "opus");
  assert.equal(f.stats.calls, 2);
  assert.equal(f.report.summary, "Two calls");
  assert.equal(f.report.droppedProposals, 1);
  assert.deepEqual(f.report.problems[0].callIds, ["el_x"]);
  assert.deepEqual(f.report.worstCalls, [{ callId: "el_x", why: "hung up" }]);
});

test("runReview: a proposal in English with no mirror gets the English prompt id and no mirror prompt id", async () => {
  const { deps, log } = setup({
    calls: [call("el_x")],
    answer: baseAnswer({
      proposals: [proposal({ language: "en", find: "Happy to help.", replace: "Glad to help.", mirrorFind: null, mirrorReplace: null })],
    }),
  });
  assert.equal(await runReview(deps, job), "done");
  const s = log.inserted[0][0];
  assert.equal(s.promptId, 131);
  assert.equal(s.mirrorPromptId, null);
  assert.equal(s.proposal.mirrorFind, null);
});

test("runReview: droppedProposals adds the validation drops to the ones the parser already skipped", async () => {
  const { deps, log } = setup({
    calls: [call("el_x")],
    answer: baseAnswer({
      proposals: [proposal(), proposal({ language: "fr" }), proposal({ title: "Ghost", find: "not in the prompt" })],
    }),
  });
  assert.equal(await runReview(deps, job), "done");
  assert.equal(log.inserted[0].length, 1);
  assert.equal(log.finished[0].report.droppedProposals, 2);
});

test("runReview: an edit that was rejected before is dropped, not inserted again", async () => {
  const { deps, log } = setup({
    calls: [call("el_x")],
    answer: baseAnswer({ proposals: [proposal()] }),
    store: { rejected: async () => [{ find: "Ik help u graag.", replace: "Waarmee kan ik helpen?" }] },
  });
  assert.equal(await runReview(deps, job), "done");
  assert.equal(log.inserted.length, 0);
  assert.equal(log.finished[0].report.droppedProposals, 1);
});

test("runReview: a live prompt that is missing drops the proposals for that language", async () => {
  const { deps, log } = setup({
    calls: [call("el_x")],
    answer: baseAnswer({ proposals: [proposal({ mirrorFind: null, mirrorReplace: null })] }),
    store: { livePrompts: async () => ({ en: { id: 131, text: EN } }) },
  });
  assert.equal(await runReview(deps, job), "done");
  assert.equal(log.inserted.length, 0);
  assert.equal(log.finished[0].report.droppedProposals, 1);
});

test("runReview: transcripts only for the picked calls, tool events for all", async () => {
  const calls = [call("el_a"), call("el_b", { outcome: "hung_up", endReason: "silence" })];
  let toolIds: string[] = [];
  const { deps, log } = setup({
    calls,
    store: { toolEvents: async (ids) => { toolIds = ids; return new Map(); } },
  });
  assert.equal(await runReview(deps, job), "done");
  assert.deepEqual(log.transcriptAsked, [["el_b", "el_a"]]);
  assert.deepEqual(toolIds.sort(), ["el_a", "el_b"]);
});

test("runReview: a model error fails the review with that text", async () => {
  const { deps, log } = setup({ calls: [call("el_x")], aiResult: { error: "timed out" } });
  assert.equal(await runReview(deps, job), "failed");
  assert.deepEqual(log.failed, [{ id: 7, error: "timed out" }]);
  assert.equal(log.finished.length, 0);
  assert.equal(log.inserted.length, 0);
});

test("runReview: an answer that does not parse fails the review with the reason", async () => {
  const notJson = setup({ calls: [call("el_x")], aiResult: { text: "sorry, no" } });
  assert.equal(await runReview(notJson.deps, job), "failed");
  assert.deepEqual(notJson.log.failed, [{ id: 7, error: "parse: not_json" }]);

  const badShape = setup({ calls: [call("el_x")], aiResult: { text: JSON.stringify({ summary: 5 }) } });
  assert.equal(await runReview(badShape.deps, job), "failed");
  assert.deepEqual(badShape.log.failed, [{ id: 7, error: "parse: bad_shape" }]);
  assert.equal(badShape.log.inserted.length, 0);
});

test("runReview never throws: a store, model or insert error ends in fail", async () => {
  const listBroken = setup({ store: { listCalls: async () => { throw new Error("db down"); } } });
  assert.equal(await runReview(listBroken.deps, job), "failed");
  assert.deepEqual(listBroken.log.failed, [{ id: 7, error: "db down" }]);

  const aiBroken = setup({ calls: [call("el_x")], ai: async () => { throw new Error("spawn failed"); } });
  assert.equal(await runReview(aiBroken.deps, job), "failed");
  assert.deepEqual(aiBroken.log.failed, [{ id: 7, error: "spawn failed" }]);

  const insertBroken = setup({
    calls: [call("el_x")], answer: baseAnswer({ proposals: [proposal()] }),
    store: { insertSuggestions: async () => { throw new Error("insert failed"); } },
  });
  assert.equal(await runReview(insertBroken.deps, job), "failed");
  assert.deepEqual(insertBroken.log.failed, [{ id: 7, error: "insert failed" }]);
  assert.equal(insertBroken.log.finished.length, 0);

  const notAnError = setup({ store: { listCalls: async () => { throw "plain string"; } } });
  assert.equal(await runReview(notAnError.deps, job), "failed");
  assert.deepEqual(notAnError.log.failed, [{ id: 7, error: "plain string" }]);
});

test("runReview never throws even when fail itself throws", async () => {
  const { deps } = setup({
    calls: [call("el_x")], aiResult: { error: "boom" },
    store: { fail: async () => { throw new Error("db gone"); } },
  });
  assert.equal(await runReview(deps, job), "failed");
});
