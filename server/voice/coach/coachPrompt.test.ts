import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCoachPrompt, callIdsIn, COACH_SCHEMA, COACH_TIMEOUT_MS, COACH_TRANSCRIPT_CHARS, MAX_COACH_TRANSCRIPTS,
  parseCoachAnswer, type CoachPromptInput,
} from "./coachPrompt";
import { PROPOSAL_ITEM_SCHEMA, REVIEW_SCHEMA } from "../review/reviewPrompt";
import type { ReviewDto } from "@shared/voiceReview";

const DASH = String.fromCharCode(0x2014);

test("limits and the schema reuse the review's proposal item", () => {
  assert.equal(COACH_TIMEOUT_MS, 180_000);
  assert.equal(MAX_COACH_TRANSCRIPTS, 10);
  assert.equal(COACH_TRANSCRIPT_CHARS, 4000);
  assert.deepEqual(COACH_SCHEMA.required, ["reply", "proposals"]);
  assert.equal(COACH_SCHEMA.properties.proposals.maxItems, 5);
  assert.equal(COACH_SCHEMA.properties.proposals.items, PROPOSAL_ITEM_SCHEMA);
  assert.equal(REVIEW_SCHEMA.properties.proposals.items, PROPOSAL_ITEM_SCHEMA);
});

test("callIdsIn gives the unique ElevenLabs call ids in order of appearance", () => {
  assert.deepEqual(callIdsIn("see el_conv_abc12 and el_conv_abc12, el_x"), ["el_conv_abc12"]);
  assert.deepEqual(callIdsIn("el_conv_bbbb2 then (el_conv_aaaa1) and el_conv_bbbb2."), ["el_conv_bbbb2", "el_conv_aaaa1"]);
  assert.deepEqual(callIdsIn("live_abc123 and xel_conv_abc12 and nothing"), []);
  assert.deepEqual(callIdsIn(""), []);
});

const review: ReviewDto = {
  id: 9, accountId: 53, kind: "weekly", weekKey: "2026-W43", periodStart: "2026-10-12T22:00:00.000Z",
  periodEnd: "2026-10-19T22:00:00.000Z", status: "done", stats: null, error: null,
  startedAt: "2026-10-19T05:00:00.000Z", finishedAt: "2026-10-19T05:10:00.000Z",
  report: {
    summary: "Greeting too long on most calls", comparison: "Worse than last week",
    problems: [{ title: "Long greeting", detail: "Callers talk over it", callIds: ["el_conv_aaaa1"] }],
    worstCalls: [{ callId: "el_conv_bbbb2", why: "hung up after the greeting" }],
    knowledgeBase: ["Add the opening hours"], droppedProposals: 0,
  },
};

const input = (over: Partial<CoachPromptInput> = {}): CoachPromptInput => ({
  rules: "RULES TEXT",
  lineLanguage: "nl",
  drafts: {
    nl: { live: "LIVE NL goedemorgen", draft: "DRAFT NL goedendag" },
    en: { live: "LIVE EN good morning", draft: "DRAFT EN good day" },
  },
  review,
  callIndex: [{ callId: "el_conv_aaaa1", startedAt: "2026-10-20T08:00:00.000Z", outcome: "booked", endReason: "goodbye" }],
  transcripts: [{
    callId: "el_conv_aaaa1", startedAt: "2026-10-20T08:00:00.000Z",
    turns: [{ role: "caller", text: "Hallo" }, { role: "agent", text: "Goedendag, waarmee kan ik helpen?" }],
  }],
  history: [
    { role: "user", content: "FIRST QUESTION" },
    { role: "assistant", content: "FIRST ANSWER" },
  ],
  message: "SECOND QUESTION",
  ...over,
});

test("buildCoachPrompt: the system text is the rules then the coach brief", () => {
  const { system } = buildCoachPrompt(input());
  assert.ok(system.startsWith("RULES TEXT"));
  assert.match(system, /prompt coach/);
  assert.match(system, /DRAFT/);
  assert.match(system, /language Gabriel writes in/);
  assert.match(system, /call index/);
  assert.ok(!system.includes(DASH));
});

test("buildCoachPrompt: the user text carries both languages' draft and live, the review, the index, transcripts and the history in order", () => {
  const { user } = buildCoachPrompt(input());
  for (const t of ["LIVE NL goedemorgen", "DRAFT NL goedendag", "LIVE EN good morning", "DRAFT EN good day"]) {
    assert.ok(user.includes(t), t);
  }
  assert.ok(user.includes("Greeting too long on most calls"));
  assert.ok(user.includes("Worse than last week"));
  assert.ok(user.includes("Long greeting"));
  assert.ok(user.includes("el_conv_bbbb2"));
  assert.ok(user.includes("el_conv_aaaa1"));
  assert.ok(user.includes("booked"));
  assert.ok(user.includes("Caller: Hallo"));
  assert.ok(user.includes("Agent: Goedendag, waarmee kan ik helpen?"));
  const at = (t: string) => user.indexOf(t);
  assert.ok(at("FIRST QUESTION") !== -1 && at("FIRST QUESTION") < at("FIRST ANSWER"));
  assert.ok(at("FIRST ANSWER") < at("SECOND QUESTION"));
  assert.ok(user.trimEnd().endsWith("SECOND QUESTION"));
});

test("buildCoachPrompt: no review, no calls and no history still build a prompt", () => {
  const { user } = buildCoachPrompt(input({ review: null, callIndex: [], transcripts: [], history: [], drafts: {} }));
  assert.ok(user.includes("SECOND QUESTION"));
  assert.match(user, /No review yet/);
  assert.match(user, /no phone calls/i);
  assert.match(user, /not available/);
});

test("buildCoachPrompt: a draft equal to live is sent once and says so", () => {
  const { user } = buildCoachPrompt(input({ drafts: { nl: { live: "SAME NL TEXT", draft: "SAME NL TEXT" } } }));
  assert.equal(user.split("SAME NL TEXT").length - 1, 1);
  assert.match(user, /same as the live prompt/i);
});

test("buildCoachPrompt: says which language the editor shows", () => {
  assert.match(buildCoachPrompt(input({ lineLanguage: "en" })).user, /editor shows the EN prompt/);
});

const proposal = (over: Record<string, unknown> = {}) => ({
  language: "nl", title: "Shorter greeting", reason: "Callers talk over it", find: "goedendag",
  replace: "hallo", mirrorFind: "good day", mirrorReplace: "hello", callIds: ["el_conv_aaaa1"], ...over,
});

test("parseCoachAnswer: a plain reply with no proposals", () => {
  const r = parseCoachAnswer(JSON.stringify({ reply: "  It was too long.  ", proposals: [] }));
  assert.deepEqual(r, { ok: true, reply: "It was too long.", proposals: [] });
});

test("parseCoachAnswer: cleans em dashes in the reply and the proposal copy but never in find", () => {
  const r = parseCoachAnswer(JSON.stringify({
    reply: `Ja ${DASH} dat klopt`,
    proposals: [proposal({
      title: `Kort ${DASH} sneller`, reason: `Te lang ${DASH} bellers praten erdoorheen`,
      find: `a ${DASH} b`, replace: `c ${DASH} d`, mirrorFind: `e ${DASH} f`, mirrorReplace: `g ${DASH} h`,
    })],
  }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.reply, "Ja, dat klopt");
  assert.equal(r.proposals.length, 1);
  const p = r.proposals[0];
  assert.equal(p.title, "Kort, sneller");
  assert.equal(p.reason, "Te lang, bellers praten erdoorheen");
  assert.equal(p.find, `a ${DASH} b`);
  assert.equal(p.mirrorFind, `e ${DASH} f`);
  assert.equal(p.replace, "c, d");
  assert.equal(p.mirrorReplace, "g, h");
});

test("parseCoachAnswer: replace keeps its edge whitespace", () => {
  const r = parseCoachAnswer(JSON.stringify({ reply: "ok", proposals: [proposal({ find: "x ", replace: ` y${DASH}z ` })] }));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.proposals[0].replace, " y, z ");
});

test("parseCoachAnswer: the reply is cut to 4000 characters", () => {
  const r = parseCoachAnswer(JSON.stringify({ reply: "a".repeat(5000), proposals: [] }));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.reply.length, 4000);
});

test("parseCoachAnswer: a malformed proposal is skipped, the reply and the other proposals stay", () => {
  const r = parseCoachAnswer(JSON.stringify({
    reply: "ok",
    proposals: [{ language: "de", title: "x" }, "nope", proposal({ title: "Good one" }), proposal({ mirrorFind: "good day", mirrorReplace: null })],
  }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.proposals.map((p) => p.title), ["Good one", "Shorter greeting"]);
  assert.equal(r.proposals[1].mirrorFind, null);
  assert.equal(r.proposals[1].mirrorReplace, null);
});

test("parseCoachAnswer: only the first 5 proposals are read", () => {
  const r = parseCoachAnswer(JSON.stringify({ reply: "ok", proposals: Array.from({ length: 8 }, (_, i) => proposal({ title: `P${i}` })) }));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.proposals.length, 5);
});

test("parseCoachAnswer: not json and bad shape", () => {
  assert.deepEqual(parseCoachAnswer("sorry, no json here"), { ok: false, reason: "not_json" });
  assert.deepEqual(parseCoachAnswer("{ broken"), { ok: false, reason: "not_json" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify({ proposals: [] })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify({ reply: "ok" })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify({ reply: "ok", proposals: "none" })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify({ reply: 5, proposals: [] })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify({ reply: "   ", proposals: [] })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseCoachAnswer(JSON.stringify([1, 2])), { ok: false, reason: "bad_shape" });
});

test("parseCoachAnswer: finds the object when the model wraps it in a code fence", () => {
  const r = parseCoachAnswer("```json\n" + JSON.stringify({ reply: "fenced", proposals: [] }) + "\n```");
  assert.deepEqual(r, { ok: true, reply: "fenced", proposals: [] });
});
