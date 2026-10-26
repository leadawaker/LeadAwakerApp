/**
 * The ElevenLabs browser test's relay to the engine. Pure on purpose (no
 * Express, no database): the request rules and the status pass-through are
 * tested on their own (voiceElevenTest.test.ts).
 */
import { z } from "zod";

/** E.164: a plus, then 8 to 15 digits, the first not 0. */
const E164 = /^\+[1-9]\d{7,14}$/;

export const elevenTestSchema = z.object({
  accountId: z.number().int().positive(),
  // The Voice_Numbers row, which must be accountId's own line, on any engine (the engine 403s otherwise).
  lineId: z.number().int().positive(),
  // The browser caller rings the line "from" this number: caller memory and the line's real diary.
  callerNumber: z.string().regex(E164, "callerNumber must be E.164, like +31612345678").optional(),
  // The prompt coach's "Test draft": the unsaved draft prompt, every write tool faked by the engine.
  draft: z.boolean().optional(),
});

export const startedSchema = z.object({
  // What the browser's SDK says the conversation is (getId()); the engine only compares it.
  conversationId: z.string().min(1).max(200).optional(),
});

export const releaseSchema = z.object({
  // The account the CRM user is testing: the engine frees the session only if it is this account's.
  accountId: z.number().int().positive(),
});

/** A path segment the engine minted (conv_...): letters, digits, _ and - only. */
export const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,200}$/;

export interface RelayResult { status: number; body: unknown }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * POST to the engine with the internal key and hand back its status and JSON.
 * The engine's own statuses pass through (403 not an ElevenLabs demo or test
 * line, 409 not set up, 422 bad caller number, 429 one already live, 502
 * ElevenLabs failed), except 401: that is our internal key, not the user, and
 * a 401 would send the browser to /login, so it becomes 502.
 */
export async function relayToEngine(
  base: string, path: string, payload: unknown, key: string, fetchImpl: FetchLike = fetch,
): Promise<RelayResult> {
  let resp: Response;
  try {
    resp = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { status: 502, body: { message: "The voice engine could not be reached." } };
  }
  if (resp.status === 204) return { status: 204, body: null };
  const data = await resp.json().catch(() => ({}));
  if (resp.ok) return { status: resp.status, body: data };
  const detail = (data as { detail?: unknown })?.detail;
  const message = typeof detail === "string" && detail ? detail : "The browser test could not be started.";
  // Never log the key itself: only that the engine refused it.
  if (resp.status === 401) console.warn(`[voice-eleven-test] engine refused the internal key on ${path}`);
  const status = resp.status === 401 ? 502 : resp.status;
  return { status, body: { message, engineStatus: resp.status } };
}
