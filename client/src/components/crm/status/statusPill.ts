/**
 * One status system for calls, people and chats (pure, no imports so node:test runs it).
 *
 * A call ended one way: exactly one outcome. A person (caller or chat contact)
 * sits in exactly one stage of the receptionist vocabulary, plus an optional
 * "Needs you" marker while something waits on the client. Booked looks the
 * same everywhere because every surface reads the same tone below.
 */
export type CallOutcomeStatus = "booked" | "callback" | "transferred" | "answered" | "hungUp";
export type PersonStage = "newInquiry" | "answered" | "booked" | "done";
export type StatusKey = CallOutcomeStatus | PersonStage;

/** Stage colour token per status; null = the quiet, recessed look. */
export const STATUS_TONE: Record<StatusKey, string | null> = {
  booked: "var(--stage-booked)",
  callback: "var(--stage-contacted)",
  transferred: "var(--stage-multi)",
  answered: "var(--stage-responded)",
  hungUp: null,
  newInquiry: "var(--stage-new)",
  done: "var(--stage-closed)",
};

/** Raw call outcome (booked / callback / transferred / hung_up / other) to its one pill. */
export function callOutcomeStatus(outcome: unknown): CallOutcomeStatus {
  switch (outcome) {
    case "booked": return "booked";
    case "callback": return "callback";
    case "transferred": return "transferred";
    case "hung_up": return "hungUp";
    // "other": the receptionist answered the caller's questions.
    default: return "answered";
  }
}

/** Receptionist stage keys from GET /api/leads/page. DBR stages are not receptionist stages: null. */
export function personStageFromKey(stageKey: string | null | undefined): PersonStage | null {
  switch (stageKey) {
    case "rx_new": return "newInquiry";
    case "rx_answered": return "answered";
    case "Booked": return "booked";
    case "rx_done": return "done";
    default: return null;
  }
}

const DONE_STATUSES = ["Lost", "DND", "Cancelled", "Closed"];

/** A caller's one stage, from their lead status and their best call. */
export function callerStage(c: { leadStatus: string | null; dnd: boolean; bestOutcome: string }): PersonStage {
  if (c.dnd || DONE_STATUSES.includes(c.leadStatus ?? "")) return "done";
  if (c.leadStatus === "Booked" || c.bestOutcome === "booked") return "booked";
  if (c.bestOutcome === "hung_up") return "newInquiry";
  return "answered";
}

/** A callback was asked for on the latest call and nobody has reached out since. */
export function callerNeedsYou(c: { latestOutcome: string; lastCallAt: string; lastCalledBackAt: string | null }): boolean {
  if (c.latestOutcome !== "callback") return false;
  if (!c.lastCalledBackAt) return true;
  return new Date(c.lastCalledBackAt).getTime() < new Date(c.lastCallAt).getTime();
}

const STAGE_TAG_NAMES = new Set([
  "new", "new inquiry", "contacted", "responded", "answered", "multiple responses", "qualified",
  "booked", "call booked", "closed", "done", "lost", "dnd", "callback", "transferred",
]);

/** A tag that only repeats a stage is redundant next to the stage pill: hide it everywhere. */
export function isStageTag(name: string | null | undefined): boolean {
  return STAGE_TAG_NAMES.has(String(name ?? "").trim().toLowerCase());
}
