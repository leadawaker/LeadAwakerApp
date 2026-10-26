/**
 * Runs one voice call review: reads the period's ElevenLabs phone calls, asks Claude opus for the
 * report and its proposed prompt edits, stores the report and inserts the valid proposals as change
 * cards. It only ever proposes: nothing here writes the live prompt.
 *
 * Pure of the db at import time (the live wiring loads storage lazily), so the whole flow is tested
 * with an in-memory store and a fake model.
 */
import type { PromptLang, ProposalInput, ReviewDto, ReviewReport, ReviewStats } from "@shared/voiceReview";
import { claudeJson } from "../../aiTextHelper";
import { loadPromptRules } from "../promptRules";
import type { ToolEventLite, TranscriptTurn } from "../../storage/voiceReviews";
import type { NewSuggestion } from "../../storage/voicePromptDrafts";
import { validateProposal } from "./promptEdits";
import {
  buildReviewPrompt, clipTranscript, MAX_TRANSCRIPT_CALLS, parseReviewAnswer, REVIEW_SCHEMA, REVIEW_TIMEOUT_MS,
  TRANSCRIPT_CHARS_PER_CALL, type ReviewCallForPrompt,
} from "./reviewPrompt";
import { computeStats, pickTranscriptCalls, type ReviewCallRow } from "./reviewStats";

export type AiComplete = typeof import("../../aiTextHelper").claudeJson;

export interface ReviewStore {
  listCalls(accountId: number, start: Date, end: Date, withTests: boolean): Promise<ReviewCallRow[]>;
  transcripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>>;
  toolEvents(callIds: string[]): Promise<Map<string, ToolEventLite[]>>;
  knowledge(accountId: number): Promise<{ title: string; content: string }[]>;
  accountName(accountId: number): Promise<string>;
  previous(accountId: number, beforeReviewId: number): Promise<ReviewDto | null>;
  livePrompts(): Promise<Partial<Record<PromptLang, { id: number; text: string }>>>;
  rejected(accountId: number): Promise<{ find: string; replace: string }[]>;
  /** Removes the undecided cards (proposed or stale) an earlier attempt of this review left. */
  clearReviewSuggestions(reviewId: number): Promise<void>;
  insertSuggestions(rows: NewSuggestion[]): Promise<number[]>;
  finish(reviewId: number, out: { stats: ReviewStats; report: ReviewReport; model: string | null }): Promise<void>;
  fail(reviewId: number, error: string): Promise<void>;
}

export interface ReviewDeps { ai: AiComplete; rules: () => string; store: ReviewStore }
/** `withTests`: browser test calls count too (they ran the live prompt, or a draft on "Test draft"). */
export interface ReviewJob { reviewId: number; accountId: number; periodStart: Date; periodEnd: Date; withTests?: boolean }

const MODEL = "opus";
const LANGS: PromptLang[] = ["nl", "en"];
const otherLang = (l: PromptLang): PromptLang => (l === "nl" ? "en" : "nl");

const noCallsReport = (): ReviewReport => ({
  summary: "No ElevenLabs phone calls in this period.", comparison: "", problems: [], worstCalls: [],
  knowledgeBase: [], droppedProposals: 0,
});

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Ends the review as failed. A failure to even record that is logged: the runner never throws. */
async function failReview(deps: ReviewDeps, reviewId: number, error: string): Promise<"failed"> {
  console.error(`[voice-review] review ${reviewId} failed: ${error}`);
  try { await deps.store.fail(reviewId, error); }
  catch (err) { console.error(`[voice-review] could not record the failure of review ${reviewId}: ${messageOf(err)}`); }
  return "failed";
}

function callsForPrompt(
  calls: ReviewCallRow[],
  transcripts: Map<string, TranscriptTurn[]>,
  tools: Map<string, ToolEventLite[]>,
): ReviewCallForPrompt[] {
  return calls.map((c) => {
    const turns = transcripts.get(c.callId);
    return {
      callId: c.callId, startedAt: c.startedAt, outcome: c.outcome, endReason: c.endReason,
      latencyMs: c.latencyMs, latencyP90Ms: c.latencyP90Ms,
      tools: tools.get(c.callId) ?? [],
      transcript: turns ? clipTranscript(turns, TRANSCRIPT_CHARS_PER_CALL) : null,
    };
  });
}

async function execute(deps: ReviewDeps, job: ReviewJob): Promise<"done" | "failed"> {
  const { store } = deps;
  const { reviewId, accountId } = job;

  const withTests = job.withTests === true;
  const calls = await store.listCalls(accountId, job.periodStart, job.periodEnd, withTests);
  const stats: ReviewStats = { ...computeStats(calls), ...(withTests ? { withTests } : {}) };
  if (calls.length === 0) {
    await store.finish(reviewId, { stats, report: noCallsReport(), model: null });
    return "done";
  }

  const callIds = new Set(calls.map((c) => c.callId));
  const [transcripts, tools, knowledge, accountName, previous, live, rejected] = await Promise.all([
    store.transcripts(pickTranscriptCalls(calls, MAX_TRANSCRIPT_CALLS)),
    store.toolEvents(calls.map((c) => c.callId)),
    store.knowledge(accountId),
    store.accountName(accountId),
    store.previous(accountId, reviewId),
    store.livePrompts(),
    store.rejected(accountId),
  ]);
  const texts: Partial<Record<PromptLang, string>> = {};
  for (const l of LANGS) { const row = live[l]; if (row) texts[l] = row.text; }

  const answer = await deps.ai({
    ...buildReviewPrompt({
      accountName, periodStart: job.periodStart.toISOString(), periodEnd: job.periodEnd.toISOString(),
      stats, previous, rules: deps.rules(), prompts: texts, knowledge, rejected,
      calls: callsForPrompt(calls, transcripts, tools),
    }),
    model: MODEL,
    timeoutMs: REVIEW_TIMEOUT_MS,
    jsonSchema: REVIEW_SCHEMA,
  });
  if ("error" in answer) return failReview(deps, reviewId, answer.error);
  const parsed = parseReviewAnswer(answer.text);
  if (!parsed.ok) return failReview(deps, reviewId, `parse: ${parsed.reason}`);

  // The model may cite a call that is not in the period: keep only real ids.
  const known = (ids: string[]) => ids.filter((id) => callIds.has(id));
  const suggestions: NewSuggestion[] = [];
  let dropped = parsed.report.droppedProposals;
  for (const p of parsed.proposals) {
    const proposal: ProposalInput = { ...p, callIds: known(p.callIds) };
    const row = live[p.language];
    const mirror = proposal.mirrorFind ? live[otherLang(p.language)] : undefined;
    // A valid mirror edit means the other language's prompt exists, so `mirror` is set whenever there is one.
    if (!row || !validateProposal(proposal, texts, rejected).ok) { dropped++; continue; }
    suggestions.push({
      accountId, source: "review", reviewId, coachMessageId: null,
      promptId: row.id, mirrorPromptId: mirror ? mirror.id : null, proposal,
    });
  }
  // A retry of the same review (a weekly row that failed after its cards were inserted) must not list them twice.
  await store.clearReviewSuggestions(reviewId);
  if (suggestions.length) await store.insertSuggestions(suggestions);

  const report: ReviewReport = {
    ...parsed.report,
    problems: parsed.report.problems.map((p) => ({ ...p, callIds: known(p.callIds) })),
    worstCalls: parsed.report.worstCalls.filter((w) => callIds.has(w.callId)),
    droppedProposals: dropped,
  };
  await store.finish(reviewId, { stats, report, model: MODEL });
  return "done";
}

/** Never throws: any error ends the review as failed. */
export async function runReview(deps: ReviewDeps, job: ReviewJob): Promise<"done" | "failed"> {
  try {
    return await execute(deps, job);
  } catch (err) {
    return failReview(deps, job.reviewId, messageOf(err));
  }
}

/** The real model, rules document and storage. Storage loads on first use, so importing this file never opens the db. */
export function liveReviewDeps(): ReviewDeps {
  const storage = async () => (await import("../../storage")).storage;
  return {
    ai: claudeJson,
    rules: loadPromptRules,
    store: {
      listCalls: async (a, s, e, w) => (await storage()).listReviewCalls(a, s, e, w),
      transcripts: async (ids) => (await storage()).loadReviewTranscripts(ids),
      toolEvents: async (ids) => (await storage()).loadReviewToolEvents(ids),
      knowledge: async (a) => (await storage()).loadAccountKnowledge(a),
      accountName: async (a) => (await storage()).accountNameOf(a),
      previous: async (a, before) => (await storage()).previousVoiceReview(a, before),
      livePrompts: async () => {
        const { elevenPromptRow } = await import("../../storage/voiceAccountPrompts");
        const out: Partial<Record<PromptLang, { id: number; text: string }>> = {};
        await Promise.all(LANGS.map(async (l) => {
          const row = await elevenPromptRow(l);
          if (row) out[l] = { id: row.id, text: row.promptText };
        }));
        return out;
      },
      rejected: async (a) => (await storage()).recentRejectedSuggestions(a),
      clearReviewSuggestions: async (id) => (await storage()).clearReviewSuggestions(id),
      insertSuggestions: async (rows) => (await storage()).insertVoiceSuggestions(rows),
      finish: async (id, out) => (await storage()).finishVoiceReview(id, out),
      fail: async (id, error) => (await storage()).failVoiceReview(id, error),
    },
  };
}
