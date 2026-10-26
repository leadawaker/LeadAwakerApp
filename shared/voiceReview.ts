// Types shared by the voice call review and prompt coach (server and client).
export type PromptLang = "nl" | "en";
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
  language: PromptLang;
  title: string;
  reason: string;
  find: string;
  replace: string;
  mirrorFind: string | null;
  mirrorReplace: string | null;
  callIds: string[];
}

export type SuggestionStatus = "proposed" | "accepted" | "rejected" | "stale" | "live";

export interface SuggestionDto {
  id: number;
  accountId: number;
  source: "review" | "chat";
  reviewId: number | null;
  promptId: number;
  language: PromptLang;
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

export interface CoachMessageDto {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestionIds: number[];
  createdAt: string;
}

export const MAX_PROPOSALS = 5;
