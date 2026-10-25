import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewPrompt, clipTranscript, parseReviewAnswer, REVIEW_SCHEMA,
  type ReviewPromptInput,
} from "./reviewPrompt";
import { MAX_PROPOSALS, type ReviewStats } from "@shared/voiceReview";

const EM = String.fromCharCode(0x2014); // built from the code point: no em dash character in the source

const stats: ReviewStats = {
  calls: 2, byOutcome: { booked: 1, hung_up: 1 }, byEndReason: { goodbye: 1, silence: 1 },
  latencyAvgMs: 1800, latencyP90Ms: 2600, costUsd: 0.42, minutes: 6.5,
};

const input = (over: Partial<ReviewPromptInput> = {}): ReviewPromptInput => ({
  accountName: "Robben Test",
  periodStart: "2026-10-19T00:00:00.000Z",
  periodEnd: "2026-10-26T00:00:00.000Z",
  stats,
  previous: null,
  rules: "RULES: how to write ElevenLabs prompts.",
  prompts: { nl: "NL PROMPT TEXT {company}", en: "EN PROMPT TEXT {company}" },
  knowledge: [{ title: "Opening hours", content: "Mon-Fri 9 to 5" }],
  rejected: [{ find: "old find", replace: "old replace" }],
  calls: [
    {
      callId: "el_conv_aaa", startedAt: "2026-10-20T08:30:00.000Z", outcome: "booked", endReason: "goodbye",
      latencyMs: 1500, latencyP90Ms: 2100,
      tools: [{ tool: "book_slot", status: "ok", error: null, args: "{\"day\":\"monday\"}" }],
      transcript: [{ role: "caller", text: "Hallo, ik wil een afspraak" }, { role: "agent", text: "Natuurlijk" }],
    },
    {
      callId: "el_conv_bbb", startedAt: "2026-10-21T10:00:00.000Z", outcome: "hung_up", endReason: "silence",
      latencyMs: null, latencyP90Ms: null, tools: [], transcript: null,
    },
  ],
  ...over,
});

const turn = (text: string, role: "caller" | "agent" = "caller") => ({ role, text });

test("clipTranscript keeps whole turns up to the limit and appends the cut marker", () => {
  const turns = [turn("aaaa"), turn("bbbb", "agent"), turn("cccc"), turn("dddd", "agent")];
  const out = clipTranscript(turns, 8);
  assert.deepEqual(out, [turn("aaaa"), turn("bbbb", "agent"), { role: "agent", text: "[rest of the call cut]" }]);
});

test("clipTranscript stops at the first turn that does not fit, even if a later one would", () => {
  const out = clipTranscript([turn("aaaa"), turn("b".repeat(20), "agent"), turn("c")], 10);
  assert.deepEqual(out, [turn("aaaa"), { role: "agent", text: "[rest of the call cut]" }]);
});

test("clipTranscript returns the turns untouched when everything fits", () => {
  const turns = [turn("aaaa"), turn("bbbb", "agent")];
  assert.deepEqual(clipTranscript(turns, 8), turns);
});

test("buildReviewPrompt: system starts with the rules and has no em dash", () => {
  const { system } = buildReviewPrompt(input());
  assert.ok(system.startsWith("RULES: how to write ElevenLabs prompts."));
  assert.ok(!system.includes(EM));
  assert.match(system, /find/);
  assert.match(system, /No earlier review/);
});

test("buildReviewPrompt: user text carries both prompts, call ids and the missing transcript note", () => {
  const { user } = buildReviewPrompt(input());
  assert.ok(user.includes("NL PROMPT TEXT {company}"));
  assert.ok(user.includes("EN PROMPT TEXT {company}"));
  assert.ok(user.includes("el_conv_aaa"));
  assert.ok(user.includes("el_conv_bbb"));
  assert.ok(user.includes("Hallo, ik wil een afspraak"));
  assert.equal(user.split("(transcript not included)").length - 1, 1);
  assert.ok(user.includes("Opening hours"));
  assert.ok(user.includes("old find"));
  assert.ok(user.includes("book_slot"));
});

test("buildReviewPrompt: sections come in the briefed order and call times are Amsterdam time", () => {
  const { user } = buildReviewPrompt(input());
  const marks = ["Account", "Stats", "Previous review", "Live prompt NL", "Live prompt EN", "Knowledge base", "Rejected edits", "Calls"];
  let at = -1;
  for (const m of marks) {
    const i = user.indexOf(`## ${m}`);
    assert.ok(i > at, `section ${m} missing or out of order`);
    at = i;
  }
  assert.ok(user.includes("2026-10-20 10:30"), "08:30Z is 10:30 in Amsterdam (CEST)");
});

test("buildReviewPrompt: previous review is summarised, none says None", () => {
  assert.match(buildReviewPrompt(input()).user, /## Previous review\nNone/);
  const previous = {
    id: 3, accountId: 53, kind: "weekly" as const, weekKey: "2026-W42", periodStart: "a", periodEnd: "b",
    status: "done" as const, stats: null, error: null, startedAt: "a", finishedAt: "b",
    report: {
      summary: "Last week was fine", comparison: "n/a", knowledgeBase: [], droppedProposals: 0, worstCalls: [],
      problems: [{ title: "Silence at greeting", detail: "d", callIds: [] }],
    },
  };
  const { user } = buildReviewPrompt(input({ previous }));
  assert.ok(user.includes("Last week was fine"));
  assert.ok(user.includes("Silence at greeting"));
});

test("buildReviewPrompt: a missing live prompt is said so", () => {
  const { user } = buildReviewPrompt(input({ prompts: { nl: "only nl" } }));
  assert.ok(user.includes("only nl"));
  assert.match(user, /## Live prompt EN\n\(not available\)/);
});

test("REVIEW_SCHEMA limits the arrays", () => {
  const s = REVIEW_SCHEMA as any;
  assert.equal(s.additionalProperties, false);
  assert.equal(s.properties.problems.maxItems, 5);
  assert.equal(s.properties.worstCalls.maxItems, 3);
  assert.equal(s.properties.knowledgeBase.maxItems, 3);
  assert.equal(s.properties.proposals.maxItems, MAX_PROPOSALS);
  assert.deepEqual(s.required.slice().sort(), ["comparison", "knowledgeBase", "problems", "proposals", "summary", "worstCalls"]);
});

const proposal = (over: Record<string, unknown> = {}) => ({
  language: "nl", title: "Shorter greeting", reason: "Callers hang up", find: "Goedemorgen, hoe kan ik helpen?",
  replace: "Hallo!", mirrorFind: null, mirrorReplace: null, callIds: ["el_conv_aaa"], ...over,
});

const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
  summary: "Mostly fine", comparison: "No earlier review", problems: [], worstCalls: [], knowledgeBase: [],
  proposals: [], ...over,
});

test("parseReviewAnswer reads a fenced answer and keeps at most 5 of 7 problems", () => {
  const problems = Array.from({ length: 7 }, (_, i) => ({ title: `P${i}`, detail: "d", callIds: ["el_conv_aaa"] }));
  const res = parseReviewAnswer("```json\n" + answer({ problems }) + "\n```");
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.report.problems.length, 5);
  assert.equal(res.report.problems[4].title, "P4");
  assert.equal(res.report.droppedProposals, 0);
  assert.deepEqual(res.proposals, []);
});

test("parseReviewAnswer swaps an em dash in replace for a comma", () => {
  const res = parseReviewAnswer(answer({ proposals: [proposal({ replace: `a ${EM} b` })] }));
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.proposals[0].replace, "a, b");
});

test("parseReviewAnswer never touches find or mirrorFind and keeps the edges of replace and mirrorReplace", () => {
  const find = ` keep ${EM} exactly\n`;
  const mirrorFind = `\n  mirror ${EM} exactly `;
  const res = parseReviewAnswer(answer({
    proposals: [proposal({
      find, replace: `\n  new ${EM} text\n`, mirrorFind, mirrorReplace: `  mirror ${EM} new \n`,
      title: `T ${EM} U`, reason: `R ${EM} S`,
    })],
  }));
  assert.ok(res.ok);
  if (!res.ok) return;
  const p = res.proposals[0];
  assert.equal(p.find, find);
  assert.equal(p.mirrorFind, mirrorFind);
  assert.equal(p.replace, "\n  new, text\n");
  assert.equal(p.mirrorReplace, "  mirror, new \n");
  assert.equal(p.title, "T, U");
  assert.equal(p.reason, "R, S");
});

test("parseReviewAnswer cleans and clips the report text and the arrays", () => {
  const res = parseReviewAnswer(answer({
    summary: `s ${EM} ${"x".repeat(400)}`,
    comparison: "c".repeat(400),
    problems: [{ title: "t".repeat(200), detail: "d".repeat(400), callIds: ["el_conv_aaa", 7] }],
    worstCalls: Array.from({ length: 4 }, (_, i) => ({ callId: `el_conv_${i}`, why: "w".repeat(300) })),
    knowledgeBase: ["k".repeat(400), "b", "c", "d"],
    proposals: Array.from({ length: MAX_PROPOSALS + 2 }, () => proposal()),
  }));
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.report.summary.length, 300);
  assert.ok(res.report.summary.startsWith("s, x"));
  assert.equal(res.report.comparison.length, 300);
  assert.equal(res.report.problems[0].title.length, 120);
  assert.equal(res.report.problems[0].detail.length, 300);
  assert.deepEqual(res.report.problems[0].callIds, ["el_conv_aaa"]);
  assert.equal(res.report.worstCalls.length, 3);
  assert.equal(res.report.worstCalls[0].why.length, 160);
  assert.equal(res.report.knowledgeBase.length, 3);
  assert.equal(res.report.knowledgeBase[0].length, 300);
  assert.equal(res.proposals.length, MAX_PROPOSALS);
});

test("parseReviewAnswer turns an empty or missing mirror into nulls", () => {
  const res = parseReviewAnswer(answer({ proposals: [proposal({ mirrorFind: "", mirrorReplace: "stray" }), proposal({ mirrorFind: undefined })] }));
  assert.ok(res.ok);
  if (!res.ok) return;
  for (const p of res.proposals) { assert.equal(p.mirrorFind, null); assert.equal(p.mirrorReplace, null); }
});

test("parseReviewAnswer reports bad_shape and not_json", () => {
  assert.deepEqual(parseReviewAnswer(answer({ problems: "none" })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseReviewAnswer(answer({ summary: 5 })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseReviewAnswer(answer({ proposals: [proposal({ language: "fr" })] })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseReviewAnswer(answer({ proposals: [proposal({ find: 3 })] })), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseReviewAnswer("[1,2]"), { ok: false, reason: "bad_shape" });
  assert.deepEqual(parseReviewAnswer("sorry"), { ok: false, reason: "not_json" });
  assert.deepEqual(parseReviewAnswer(""), { ok: false, reason: "not_json" });
});
