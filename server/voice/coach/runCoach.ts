/**
 * One turn of the prompt coach chat: stores Gabriel's message, asks Claude sonnet with the draft and live
 * prompt, the latest review, a 14-day call index and the transcripts he or the review points at, stores the
 * answer and turns its proposals into change cards. It only ever proposes: nothing here writes the draft or
 * the live prompt (Gabriel accepts a card, then saves).
 *
 * Pure of the db at import time (the live wiring loads storage lazily), so the whole flow is tested with an
 * in-memory store and a fake model.
 */
import type {
  CoachMessageDto, DraftView, PromptLang, ProposalInput, ReviewDto, SuggestionDto,
} from "@shared/voiceReview";
import { claudeJson } from "../../aiTextHelper";
import { loadPromptRules } from "../promptRules";
import type { TranscriptTurn } from "../../storage/voiceReviews";
import type { NewSuggestion } from "../../storage/voicePromptDrafts";
import { validateProposal } from "../review/promptEdits";
import { clipTranscript } from "../review/reviewPrompt";
import type { AiComplete } from "../review/runReview";
import type { ReviewCallRow } from "../review/reviewStats";
import {
  buildCoachPrompt, callIdsIn, COACH_SCHEMA, COACH_TIMEOUT_MS, COACH_TRANSCRIPT_CHARS, MAX_COACH_TRANSCRIPTS,
  parseCoachAnswer, type CoachPromptInput,
} from "./coachPrompt";

export interface CoachStore {
  history(accountId: number): Promise<CoachMessageDto[]>;
  addMessage(accountId: number, role: "user" | "assistant", content: string, by: string | null): Promise<CoachMessageDto>;
  setSuggestions(messageId: number, ids: number[]): Promise<void>;
  drafts(): Promise<Partial<Record<PromptLang, DraftView>>>;
  latestReview(accountId: number): Promise<ReviewDto | null>;
  callIndex(accountId: number, since: Date, until: Date): Promise<ReviewCallRow[]>;
  transcripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>>;
  rejected(accountId: number): Promise<{ find: string; replace: string }[]>;
  insertSuggestions(rows: NewSuggestion[]): Promise<number[]>;
  suggestions(accountId: number): Promise<SuggestionDto[]>;
}

export interface CoachDeps { ai: AiComplete; rules: () => string; store: CoachStore; now: () => Date }

export type CoachTurnResult =
  | { status: 200; messages: CoachMessageDto[]; suggestions: SuggestionDto[] }
  | { status: 502; message: string };

const MODEL = "sonnet";
const LANGS: PromptLang[] = ["nl", "en"];
const otherLang = (l: PromptLang): PromptLang => (l === "nl" ? "en" : "nl");
const HISTORY_MESSAGES = 12;
/** Call ids named in this many of the latest history messages stay in view (a "yes, that one" answer). */
const HISTORY_ID_MESSAGES = 6;
const INDEX_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const FAILED = { status: 502 as const, message: "The coach could not answer. Try again." };

/** The calls whose transcript goes into the prompt: named in the message, then in the recent chat (newest first), then cited by the review; only calls of the index. */
function transcriptIds(message: string, history: CoachMessageDto[], review: ReviewDto | null, known: Set<string>): string[] {
  const wanted = [
    ...callIdsIn(message),
    ...history.slice(-HISTORY_ID_MESSAGES).reverse().flatMap((m) => callIdsIn(m.content)),
    ...(review?.report?.problems.flatMap((p) => p.callIds) ?? []),
  ];
  return [...new Set(wanted)].filter((id) => known.has(id)).slice(0, MAX_COACH_TRANSCRIPTS);
}

export async function runCoachTurn(
  deps: CoachDeps,
  input: { accountId: number; lineLanguage: PromptLang; message: string; by: string | null },
): Promise<CoachTurnResult> {
  const { store } = deps;
  const { accountId } = input;

  // The question is kept even when the answer fails, so Gabriel sees what he asked.
  const userMessage = await store.addMessage(accountId, "user", input.message, input.by);
  const history = (await store.history(accountId)).filter((m) => m.id !== userMessage.id).slice(-HISTORY_MESSAGES);

  const until = deps.now();
  const since = new Date(until.getTime() - INDEX_DAYS * DAY_MS);
  const [drafts, review, calls, rejected] = await Promise.all([
    store.drafts(), store.latestReview(accountId), store.callIndex(accountId, since, until), store.rejected(accountId),
  ]);

  const known = new Map(calls.map((c) => [c.callId, c]));
  const ids = transcriptIds(input.message, history, review, new Set(known.keys()));
  const turns = ids.length ? await store.transcripts(ids) : new Map<string, TranscriptTurn[]>();
  const transcripts = ids.flatMap((callId) => {
    const t = turns.get(callId);
    return t ? [{ callId, startedAt: known.get(callId)!.startedAt, turns: clipTranscript(t, COACH_TRANSCRIPT_CHARS) }] : [];
  });

  const promptTexts: CoachPromptInput["drafts"] = {};
  for (const l of LANGS) { const d = drafts[l]; if (d) promptTexts[l] = { live: d.liveText, draft: d.draftText }; }

  const answer = await deps.ai({
    ...buildCoachPrompt({
      rules: deps.rules(),
      lineLanguage: input.lineLanguage,
      drafts: promptTexts,
      review,
      callIndex: calls.map((c) => ({ callId: c.callId, startedAt: c.startedAt, outcome: c.outcome, endReason: c.endReason })),
      transcripts,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      message: input.message,
    }),
    model: MODEL,
    timeoutMs: COACH_TIMEOUT_MS,
    jsonSchema: COACH_SCHEMA,
  });
  if ("error" in answer) {
    console.error(`[voice-coach] account ${accountId}: ${answer.error}`);
    return FAILED;
  }
  const parsed = parseCoachAnswer(answer.text);
  if (!parsed.ok) {
    console.error(`[voice-coach] account ${accountId}: parse ${parsed.reason}`);
    return FAILED;
  }

  const assistant = await store.addMessage(accountId, "assistant", parsed.reply, null);

  // Edits are judged against the DRAFT, the text Gabriel is working on (an accepted card edits it).
  const draftTexts: Partial<Record<PromptLang, string>> = {};
  for (const l of LANGS) { const d = drafts[l]; if (d) draftTexts[l] = d.draftText; }
  const rows: NewSuggestion[] = [];
  for (const p of parsed.proposals) {
    // The model may cite a call that is not in the index: keep only real ids.
    const proposal: ProposalInput = { ...p, callIds: p.callIds.filter((id) => known.has(id)) };
    const row = drafts[p.language];
    // A valid mirror edit means the other language's draft exists, so `mirror` is set whenever there is one.
    const mirror = proposal.mirrorFind ? drafts[otherLang(p.language)] : undefined;
    if (!row || !validateProposal(proposal, draftTexts, rejected).ok) continue;
    rows.push({
      accountId, source: "chat", reviewId: null, coachMessageId: assistant.id,
      promptId: row.promptId, mirrorPromptId: mirror ? mirror.promptId : null, proposal,
    });
  }

  let cardIds: number[] = [];
  let cards: SuggestionDto[] = [];
  if (rows.length) {
    cardIds = await store.insertSuggestions(rows);
    await store.setSuggestions(assistant.id, cardIds);
    const made = new Set(cardIds);
    cards = (await store.suggestions(accountId)).filter((c) => made.has(c.id));
  }
  return { status: 200, messages: [userMessage, { ...assistant, suggestionIds: cardIds }], suggestions: cards };
}

/** The real model, rules document and storage. Storage loads on first use, so importing this file never opens the db. */
export function liveCoachDeps(): CoachDeps {
  const storage = async () => (await import("../../storage")).storage;
  return {
    ai: claudeJson,
    rules: loadPromptRules,
    now: () => new Date(),
    store: {
      history: async (a) => (await storage()).listCoachMessages(a, HISTORY_MESSAGES + 1),
      addMessage: async (a, role, content, by) => (await storage()).addCoachMessage(a, role, content, by),
      setSuggestions: async (id, ids) => (await storage()).setCoachMessageSuggestions(id, ids),
      drafts: async () => {
        const s = await storage();
        const out: Partial<Record<PromptLang, DraftView>> = {};
        await Promise.all(LANGS.map(async (l) => { const v = await s.getElevenDraftView(l); if (v) out[l] = v; }));
        return out;
      },
      latestReview: async (a) => (await storage()).latestDoneVoiceReview(a),
      callIndex: async (a, since, until) => (await storage()).listReviewCalls(a, since, until),
      transcripts: async (ids) => (await storage()).loadReviewTranscripts(ids),
      rejected: async (a) => (await storage()).recentRejectedSuggestions(a),
      insertSuggestions: async (rows) => (await storage()).insertVoiceSuggestions(rows),
      suggestions: async (a) => (await storage()).listVoiceSuggestions(a),
    },
  };
}
