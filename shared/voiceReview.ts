// Types shared by the voice call review and prompt coach (server and client).
export type PromptLang = "nl" | "en";
/** Where a change card belongs: the shared prompt, one client's own text, a knowledge entry, or a Voice tab setting. */
export type CardScope = "shared" | "client" | "knowledge" | "setting";
/** "add" appends a rule (client) or creates an entry (knowledge); "replace" is a find/replace or a new value. */
export type CardOp = "replace" | "add";
export type ReviewKind = "weekly" | "manual";
export type ReviewStatus = "running" | "done" | "failed";

export interface ReviewStats {
  calls: number;
  byOutcome: Record<string, number>;
  byEndReason: Record<string, number>;
  latencyAvgMs: number | null;
  latencyP90Ms: number | null;
  costUsd: number;
  minutes: number;
  /** Browser test calls were counted too (a review run with "include browser tests"). */
  withTests?: boolean;
}

export interface ReviewProblem { title: string; detail: string; callIds: string[] }
export interface ReviewWorstCall { callId: string; why: string }

export interface ReviewReport {
  summary: string;
  comparison: string;
  problems: ReviewProblem[];
  worstCalls: ReviewWorstCall[];
  knowledgeBase: string[];
  droppedProposals: number;
}

/** A cited call as the page names it: the lead's name, else the caller's number, and when it started. */
export interface CallLabelDto { callId: string; startedAt: string; name: string | null; number: string | null }

export interface ReviewDto {
  id: number;
  accountId: number;
  kind: ReviewKind;
  weekKey: string | null;
  periodStart: string;
  periodEnd: string;
  status: ReviewStatus;
  stats: ReviewStats | null;
  report: ReviewReport | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ProposalInput {
  /** null for client, knowledge and setting cards: only the shared prompt has a language. */
  language: PromptLang | null;
  title: string;
  reason: string;
  find: string;
  replace: string;
  mirrorFind: string | null;
  mirrorReplace: string | null;
  callIds: string[];
  /** Absent means "shared". */
  scope?: CardScope;
  op?: CardOp;
  kbId?: number | null;
  kbTitle?: string | null;
  kbCategory?: string | null;
  settingKey?: string | null;
  /** The value as text: plain for greeting and intake, JSON for the rest (server/voice/review/settingCards.ts). */
  settingValue?: string | null;
}

export type SuggestionStatus = "proposed" | "accepted" | "rejected" | "stale" | "live" | "undone" | "done";

/** Use case of an account's own ElevenLabs prompt row in Prompt_Library. */
export const CLIENT_USE_CASE_PREFIX = "eleven_client_";
export const clientUseCase = (accountId: number): string => `${CLIENT_USE_CASE_PREFIX}${accountId}`;
/** The client text counter warns above this; saving still works. */
export const CLIENT_TEXT_SOFT_MAX = 3000;
/** The draft route refuses more than this. */
export const CLIENT_TEXT_MAX = 20_000;

export interface SuggestionDto {
  id: number;
  accountId: number;
  source: "review" | "chat";
  reviewId: number | null;
  /** The shared or client prompt row the edit applies to; null for knowledge and setting cards. */
  promptId: number | null;
  language: PromptLang | null;
  scope: CardScope;
  op: CardOp;
  kbId: number | null;
  kbTitle: string | null;
  kbCategory: string | null;
  settingKey: string | null;
  settingOld: unknown;
  settingNew: unknown;
  /** A setting card whose key is on the apply whitelist (applies on Accept); other settings are note cards. */
  settingApplies: boolean;
  title: string;
  reason: string;
  find: string;
  replace: string;
  mirrorPromptId: number | null;
  mirrorFind: string | null;
  mirrorReplace: string | null;
  callIds: string[];
  status: SuggestionStatus;
  statusNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface DraftView {
  promptId: number;
  useCase: string;
  language: PromptLang;
  liveText: string;
  liveUpdatedAt: string | null;
  draftText: string;
  hasDraft: boolean;
  liveMoved: boolean;
  acceptedIds: number[];
  updatedAt: string | null;
}

/** One account's own phone instructions: the live client row (if any) and the draft on it. */
export interface ClientDraftView {
  accountId: number;
  accountName: string;
  promptId: number | null;
  useCase: string;
  liveText: string;
  liveUpdatedAt: string | null;
  draftText: string;
  hasDraft: boolean;
  liveMoved: boolean;
  acceptedIds: number[];
  updatedAt: string | null;
}

export interface CoachMessageDto {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestionIds: number[];
  createdAt: string;
}

export const MAX_PROPOSALS = 5;
