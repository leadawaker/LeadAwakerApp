import test from "node:test";
import assert from "node:assert/strict";
import { runCoachTurn, type CoachDeps, type CoachStore } from "./runCoach";
import type { AiComplete } from "../review/runReview";
import type { ReviewCallRow } from "../review/reviewStats";
import type { NewSuggestion } from "../../storage/voicePromptDrafts";
import type { CoachMessageDto, DraftView, PromptLang, ReviewDto, SuggestionDto } from "@shared/voiceReview";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const LIVE_NL = "Goedemorgen. Ik help u graag. Tot ziens.";
const LIVE_EN = "Good morning. Happy to help. Goodbye.";
// The draft already differs from live: "Waarmee kan ik helpen?" exists only in the draft.
const DRAFT_NL = "Goedemorgen. Waarmee kan ik helpen? Tot ziens.";
const DRAFT_EN = "Good morning. How can I help? Goodbye.";

const view = (promptId: number, language: PromptLang, liveText: string, draftText: string): DraftView => ({
  promptId, useCase: `eleven_layer_${language}`, language, liveText, liveUpdatedAt: null, draftText,
  hasDraft: draftText !== liveText, liveMoved: false, acceptedIds: [], updatedAt: null,
});

const call = (callId: string): ReviewCallRow => ({
  callId, startedAt: "2026-10-20T08:00:00.000Z", endedAt: "2026-10-20T08:02:00.000Z", outcome: "booked",
  endReason: "goodbye", costUsd: 0.2, latencyMs: 1500, latencyP90Ms: 2000, toolErrors: 0,
});

const msg = (id: number, role: "user" | "assistant", content: string): CoachMessageDto => ({
  id, role, content, suggestionIds: [], createdAt: "2026-10-24T10:00:00.000Z",
});

const reviewWith = (problemCallIds: string[][]): ReviewDto => ({
  id: 9, accountId: 53, kind: "weekly", weekKey: "2026-W43", periodStart: "2026-10-12T22:00:00.000Z",
  periodEnd: "2026-10-19T22:00:00.000Z", status: "done", stats: null, error: null,
  startedAt: "2026-10-19T05:00:00.000Z", finishedAt: "2026-10-19T05:10:00.000Z",
  report: {
    summary: "Greeting too long", comparison: "Same as before",
    problems: problemCallIds.map((callIds, i) => ({ title: `Problem ${i}`, detail: "d", callIds })),
    worstCalls: [], knowledgeBase: [], droppedProposals: 0,
  },
});

const proposal = (over: Record<string, unknown> = {}) => ({
  language: "nl", title: "Shorter offer", reason: "Callers hang up", find: "Waarmee kan ik helpen?",
  replace: "Zeg het maar.", mirrorFind: "How can I help?", mirrorReplace: "Tell me.",
  callIds: ["el_conv_aaaa1"], ...over,
});

const answer = (reply = "Here you go.", proposals: unknown[] = []) => ({ reply, proposals });

interface Log {
  added: { accountId: number; role: string; content: string; by: string | null }[];
  suggestionsSet: { messageId: number; ids: number[] }[];
  inserted: NewSuggestion[][];
  transcriptAsked: string[][];
  aiCalls: Parameters<AiComplete>[0][];
  indexRange: { since: Date; until: Date }[];
}

function setup(opts: {
  history?: CoachMessageDto[];
  calls?: ReviewCallRow[];
  review?: ReviewDto | null;
  drafts?: Partial<Record<PromptLang, DraftView>>;
  rejected?: { find: string; replace: string }[];
  transcripts?: Map<string, { role: "caller" | "agent"; text: string }[]>;
  ai?: AiComplete;
  aiAnswer?: unknown;
  aiResult?: Awaited<ReturnType<AiComplete>>;
} = {}) {
  const log: Log = { added: [], suggestionsSet: [], inserted: [], transcriptAsked: [], aiCalls: [], indexRange: [] };
  const messages = [...(opts.history ?? [])];
  const cards: SuggestionDto[] = [];
  let nextMessageId = 500;
  let nextCardId = 900;
  const store: CoachStore = {
    history: async () => [...messages],
    addMessage: async (accountId, role, content, by) => {
      log.added.push({ accountId, role, content, by });
      const m = msg(nextMessageId++, role, content);
      messages.push(m);
      return { ...m };
    },
    setSuggestions: async (messageId, ids) => { log.suggestionsSet.push({ messageId, ids }); },
    drafts: async () => opts.drafts ?? { nl: view(130, "nl", LIVE_NL, DRAFT_NL), en: view(131, "en", LIVE_EN, DRAFT_EN) },
    latestReview: async () => opts.review ?? null,
    callIndex: async (_a, since, until) => { log.indexRange.push({ since, until }); return opts.calls ?? []; },
    transcripts: async (ids) => {
      log.transcriptAsked.push(ids);
      return new Map(ids.map((id) => [id, opts.transcripts?.get(id) ?? [{ role: "caller" as const, text: `hello from ${id}` }]]));
    },
    rejected: async () => opts.rejected ?? [],
    insertSuggestions: async (rows) => {
      log.inserted.push(rows);
      return rows.map((r) => {
        const id = nextCardId++;
        cards.push({
          id, accountId: r.accountId, source: r.source, reviewId: r.reviewId, promptId: r.promptId,
          language: r.proposal.language, title: r.proposal.title, reason: r.proposal.reason, find: r.proposal.find,
          replace: r.proposal.replace, mirrorPromptId: r.mirrorPromptId, mirrorFind: r.proposal.mirrorFind,
          mirrorReplace: r.proposal.mirrorReplace, callIds: r.proposal.callIds, status: "proposed", statusNote: null,
          createdAt: NOW.toISOString(), decidedAt: null,
        });
        return id;
      });
    },
    // Every card of the account, like the real list: the turn must pick out its own.
    suggestions: async () => [
      { ...cards[0], id: 1, title: "An older card" } as SuggestionDto,
      ...cards,
    ].filter(Boolean),
  };
  const ai: AiComplete = opts.ai ?? (async (o) => {
    log.aiCalls.push(o);
    return opts.aiResult ?? { text: JSON.stringify(opts.aiAnswer ?? answer()) };
  });
  const deps: CoachDeps = { ai, rules: () => "RULES", store, now: () => NOW };
  return { deps, log, messages };
}

const turn = (message: string, by: string | null = "gabriel@example.com") =>
  ({ accountId: 53, lineLanguage: "nl" as PromptLang, message, by });

// A failed turn is logged on purpose: keep the test output clean.
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try { return await fn(); } finally { console.error = error; console.warn = warn; }
}

test("runCoachTurn: the user message stays stored when the model fails, and the answer is 502", async () => {
  const { deps, log, messages } = setup({ aiResult: { error: "Claude sonnet timed out after 180s" } });
  const r = await quiet(() => runCoachTurn(deps, turn("Why so long?")));
  assert.deepEqual(r, { status: 502, message: "The coach could not answer. Try again." });
  assert.deepEqual(log.added, [{ accountId: 53, role: "user", content: "Why so long?", by: "gabriel@example.com" }]);
  assert.equal(messages.length, 1);
  assert.equal(log.inserted.length, 0);
  assert.equal(log.suggestionsSet.length, 0);
});

test("runCoachTurn: an answer that is not valid is a 502 too and stores no assistant message", async () => {
  for (const text of ["I am sorry, no json", JSON.stringify({ proposals: [] })]) {
    const { deps, log } = setup({ aiResult: { text } });
    const r = await quiet(() => runCoachTurn(deps, turn("Hi")));
    assert.equal(r.status, 502);
    assert.deepEqual(log.added.map((a) => a.role), ["user"]);
  }
});

test("runCoachTurn: stores the user message before it calls the model", async () => {
  const order: string[] = [];
  const base = setup();
  const addMessage = base.deps.store.addMessage;
  base.deps.store.addMessage = async (...args) => { order.push(`add ${args[1]}`); return addMessage(...args); };
  base.deps.ai = async () => { order.push("ai"); return { text: JSON.stringify(answer()) }; };
  await runCoachTurn(base.deps, turn("Hi"));
  assert.deepEqual(order, ["add user", "ai", "add assistant"]);
});

test("runCoachTurn: a reply with no proposals gives the two messages and no cards", async () => {
  const { deps, log } = setup({ aiAnswer: answer("It was fine.") });
  const r = await runCoachTurn(deps, turn("How was Tuesday?"));
  assert.equal(r.status, 200);
  if (r.status !== 200) return;
  assert.deepEqual(r.messages.map((m) => [m.role, m.content]), [["user", "How was Tuesday?"], ["assistant", "It was fine."]]);
  assert.deepEqual(r.messages.map((m) => m.suggestionIds), [[], []]);
  assert.deepEqual(r.suggestions, []);
  assert.equal(log.inserted.length, 0);
  assert.equal(log.suggestionsSet.length, 0);
  assert.equal(log.added[1].by, null);
});

test("runCoachTurn: a proposal that exists in the draft but not in live is accepted and inserted as a chat card", async () => {
  const { deps, log } = setup({
    calls: [call("el_conv_aaaa1")],
    aiAnswer: answer("Softer, as a card.", [proposal({ callIds: ["el_conv_aaaa1", "el_conv_ghost9"] })]),
  });
  const r = await runCoachTurn(deps, turn("Make the offer softer"));
  assert.equal(r.status, 200);
  if (r.status !== 200) return;

  assert.equal(log.inserted.length, 1);
  assert.equal(log.inserted[0].length, 1);
  const s = log.inserted[0][0];
  const assistant = r.messages[1];
  assert.equal(s.source, "chat");
  assert.equal(s.accountId, 53);
  assert.equal(s.reviewId, null);
  assert.equal(s.coachMessageId, assistant.id);
  assert.equal(s.promptId, 130);
  assert.equal(s.mirrorPromptId, 131);
  assert.equal(s.proposal.find, "Waarmee kan ik helpen?");
  assert.deepEqual(s.proposal.callIds, ["el_conv_aaaa1"]);

  assert.deepEqual(log.suggestionsSet, [{ messageId: assistant.id, ids: [900] }]);
  assert.deepEqual(assistant.suggestionIds, [900]);
  assert.deepEqual(r.messages[0].suggestionIds, []);
  assert.deepEqual(r.suggestions.map((c) => c.id), [900]);
  assert.equal(r.suggestions[0].title, "Shorter offer");
});

test("runCoachTurn: a proposal that exists in live but not in the draft is dropped", async () => {
  const { deps, log } = setup({
    aiAnswer: answer("A card.", [proposal({ find: "Ik help u graag.", replace: "Zeg het maar.", mirrorFind: null, mirrorReplace: null })]),
  });
  const r = await runCoachTurn(deps, turn("Change it"));
  assert.equal(r.status, 200);
  if (r.status !== 200) return;
  assert.equal(log.inserted.length, 0);
  assert.deepEqual(r.suggestions, []);
  assert.deepEqual(r.messages[1].suggestionIds, []);
  assert.equal(r.messages[1].content, "A card.");
});

test("runCoachTurn: a proposal Gabriel already rejected is dropped, the others are kept", async () => {
  const { deps, log } = setup({
    rejected: [{ find: "Waarmee kan ik helpen?", replace: "Zeg  het maar." }],
    aiAnswer: answer("Two ideas.", [
      proposal(),
      proposal({ title: "Other", find: "Tot ziens.", replace: "Fijne dag.", mirrorFind: "Goodbye.", mirrorReplace: "Have a nice day." }),
    ]),
  });
  const r = await runCoachTurn(deps, turn("Ideas?"));
  assert.equal(r.status, 200);
  assert.deepEqual(log.inserted[0].map((s) => s.proposal.title), ["Other"]);
});

test("runCoachTurn: a mirror edit that does not apply to the other draft drops the proposal", async () => {
  const { deps, log } = setup({ aiAnswer: answer("A card.", [proposal({ mirrorFind: "Happy to help." })]) });
  const r = await runCoachTurn(deps, turn("Change it"));
  assert.equal(r.status, 200);
  assert.equal(log.inserted.length, 0);
});

test("runCoachTurn: calls sonnet with the coach schema, the rules and the draft in the prompt", async () => {
  const { deps, log } = setup({ review: reviewWith([]) });
  await runCoachTurn(deps, turn("What do you think?"));
  assert.equal(log.aiCalls.length, 1);
  const c = log.aiCalls[0];
  assert.equal(c.model, "sonnet");
  assert.equal(c.timeoutMs, 180_000);
  assert.ok(c.jsonSchema);
  assert.ok(c.system.startsWith("RULES"));
  assert.ok(c.user.includes(DRAFT_NL));
  assert.ok(c.user.includes(LIVE_NL));
  assert.ok(c.user.includes(DRAFT_EN));
  assert.ok(c.user.includes("Greeting too long"));
  assert.ok(c.user.trimEnd().endsWith("What do you think?"));
});

test("runCoachTurn: the call index covers the last 14 days of the account", async () => {
  const { deps, log } = setup();
  await runCoachTurn(deps, turn("Hi"));
  assert.equal(log.indexRange.length, 1);
  assert.equal(log.indexRange[0].until.toISOString(), NOW.toISOString());
  assert.equal(log.indexRange[0].since.toISOString(), "2026-10-11T12:00:00.000Z");
});

test("runCoachTurn: loads transcripts for ids in the message and the review's problems, never for an id outside the index", async () => {
  const { deps, log } = setup({
    calls: [call("el_conv_aaaa1"), call("el_conv_bbbb2"), call("el_conv_cccc3")],
    review: reviewWith([["el_conv_bbbb2", "el_conv_old999"], ["el_conv_cccc3", "el_conv_bbbb2"]]),
  });
  const r = await runCoachTurn(deps, turn("What happened on el_conv_aaaa1 and on el_conv_other77?"));
  assert.equal(r.status, 200);
  assert.deepEqual(log.transcriptAsked, [["el_conv_aaaa1", "el_conv_bbbb2", "el_conv_cccc3"]]);
  assert.ok(log.aiCalls[0].user.includes("hello from el_conv_aaaa1"));
  assert.ok(log.aiCalls[0].user.includes("hello from el_conv_bbbb2"));
  assert.ok(!log.aiCalls[0].user.includes("hello from el_conv_other77"));
  assert.ok(!log.aiCalls[0].user.includes("hello from el_conv_old999"));
});

test("runCoachTurn: an id named in the last 6 history messages loads, an older one does not", async () => {
  const history: CoachMessageDto[] = [
    msg(1, "user", "about el_conv_ancient1"),
    ...Array.from({ length: 6 }, (_, i) => msg(2 + i, i % 2 ? "assistant" : "user", i === 3 ? "that was el_conv_recent2" : `filler ${i}`)),
  ];
  const { deps, log } = setup({ history, calls: [call("el_conv_ancient1"), call("el_conv_recent2")] });
  await runCoachTurn(deps, turn("yes, that one"));
  assert.deepEqual(log.transcriptAsked, [["el_conv_recent2"]]);
});

test("runCoachTurn: at most 10 transcripts, each cut to 4000 characters, and no lookup when there is nothing to load", async () => {
  const ids = Array.from({ length: 12 }, (_, i) => `el_conv_many${String(i).padStart(2, "0")}`);
  const long = Array.from({ length: 10 }, (_, i) => ({ role: "caller" as const, text: `turn ${i} ${"x".repeat(990)}` }));
  const { deps, log } = setup({
    calls: ids.map(call),
    transcripts: new Map(ids.map((id) => [id, long])),
  });
  await runCoachTurn(deps, turn(ids.join(" ")));
  assert.equal(log.transcriptAsked[0].length, 10);
  assert.deepEqual(log.transcriptAsked[0], ids.slice(0, 10));
  const user = log.aiCalls[0].user;
  assert.ok(user.includes("turn 3 "));
  assert.ok(!user.includes("turn 4 "), "the fifth turn would pass 4000 characters");
  assert.ok(user.includes("[rest of the call cut]"));

  const none = setup({ calls: [call("el_conv_aaaa1")] });
  await runCoachTurn(none.deps, turn("no ids here"));
  assert.equal(none.log.transcriptAsked.length, 0);
});

test("runCoachTurn: the history is the 12 messages before the new one, in order", async () => {
  const history = Array.from({ length: 20 }, (_, i) => msg(i + 1, i % 2 ? "assistant" : "user", `old message ${i}`));
  const { deps, log } = setup({ history });
  await runCoachTurn(deps, turn("brand new question"));
  const user = log.aiCalls[0].user;
  assert.ok(!user.includes("old message 7\n") && !user.includes("old message 7 "), "message 7 is older than the last 12");
  assert.ok(user.includes("old message 8"));
  assert.ok(user.includes("old message 19"));
  assert.ok(user.indexOf("old message 8") < user.indexOf("old message 19"));
  // The new message is in "Gabriel's message", not repeated in the history.
  assert.equal(user.split("brand new question").length - 1, 1);
});
