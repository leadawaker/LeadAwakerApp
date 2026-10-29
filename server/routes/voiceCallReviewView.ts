/**
 * Who sees what of a call review (GET /api/voice-calls/:callId/review). Pure, so the rule
 * tests without Express or a database (voiceCallReviewView.test.ts).
 *
 * Anyone who may open the call on the Calls page may open its review: the same reach as
 * GET /api/voice-calls/:callId (clients only their own account's live calls, never test
 * or demo calls; browser test calls any agency user; real demo calls the Owner).
 * A client sees the timeline, not our plumbing: tools keep their name, time, latency and
 * `facts` (the few main findings, picked field by field in storage/voiceToolFacts.ts) but
 * lose arguments and results, and the engine is left out. What a call costs us stays the
 * Owner's number only.
 */
import type { CallReview } from "../storage/voiceCallReview";
import { callReach, hidesTestData, type VoiceAccess } from "./voiceCallsAccess";

/** The call lookup the route runs: the Calls page's own rule (storage.getVoiceCall options). */
export function reviewCallQuery(access: VoiceAccess) {
  return {
    accountId: access.lockedAccountId,
    ...callReach(access),
    hideTest: hidesTestData(access),
    // Tool events place the markers; for clients they are cut down below, never sent raw.
    includeEvents: true,
  };
}

/** A review as a client may see it: no engine, no tool arguments or results, no cost. */
export type ClientCallReview = Omit<CallReview, "engine" | "stereo">;

export function clientReview(review: CallReview): ClientCallReview {
  const { engine: _engine, stereo: _stereo, ...rest } = review;
  return {
    ...rest,
    tools: review.tools.map((x) => ({ name: x.name, atS: x.atS, ms: x.ms, args: "", result: "", facts: x.facts })),
    cost: null,
  };
}

/** The body for this viewer: agency gets the full review (cost only for the Owner), clients the cut-down one. */
export function reviewForViewer(access: VoiceAccess, review: CallReview): CallReview | ClientCallReview {
  if (!access.isAgency) return clientReview(review);
  return access.isOwner ? review : { ...review, cost: null };
}

type CallLoader<C> = (callId: string, opts: ReturnType<typeof reviewCallQuery>) => Promise<C | undefined>;

/** The whole route minus Express: 404 when the call is out of reach (never 403, so it does not leak). */
export async function respondReview<C>(
  access: VoiceAccess,
  callId: string,
  loadCall: CallLoader<C>,
  loadReview: (call: C) => Promise<CallReview>,
): Promise<{ status: 200; body: CallReview | ClientCallReview } | { status: 404; body: { message: string } }> {
  const call = await loadCall(callId, reviewCallQuery(access));
  if (!call) return { status: 404, body: { message: "Call not found" } };
  return { status: 200, body: reviewForViewer(access, await loadReview(call)) };
}
