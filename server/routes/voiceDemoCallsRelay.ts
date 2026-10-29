/**
 * Demo phone calls ("Sara calls now", "Call me + prospect"): the request rules
 * and the relay to the engine's /voice/demo-calls. Pure on purpose (no Express,
 * no database), tested in voiceDemoCalls.test.ts.
 */
import { z } from "zod";
import { ELEVEN_DEMO_LOCALES } from "./demoVoiceSchemas";

/** E.164: a plus, then 8 to 15 digits, the first not 0. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** A minted demo token, as /voice-demo accepts it. */
const TOKEN = /^[A-Za-z0-9]{4,64}$/;

export const startDemoCallSchema = z.object({
  token: z.string().regex(TOKEN, "Not a demo token"),
  // Typed by hand on the Demos page; the route turns it into E.164 (forgetE164) first.
  toNumber: z.string().trim().min(1).max(30),
  mode: z.enum(["sara", "bridge"]),
  // Bridge mode: ring the owner's phone (the default) or this browser (WebRTC).
  ring: z.enum(["phone", "browser"]).optional(),
  locale: z.enum(ELEVEN_DEMO_LOCALES).optional(),
  voice: z.string().trim().max(40).optional(),
});
export type StartDemoCall = z.infer<typeof startDemoCallSchema>;

export const saraSchema = z.object({ action: z.enum(["join", "leave"]) });

/** The engine's demo call id: letters, digits, _ and - only, so it is safe in a path. */
export const DEMO_CALL_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * The engine's body for POST /voice/demo-calls. `owner_number` only in bridge
 * mode: it is the phone that rings first (Gabriel's, from settings).
 */
export function engineStartBody(
  input: StartDemoCall & { toNumber: string }, ownerNumber: string | null,
): Record<string, unknown> {
  return {
    token: input.token,
    to_number: input.toNumber,
    mode: input.mode,
    ...(input.mode === "bridge" ? { owner_number: ownerNumber } : {}),
    ...(input.mode === "bridge" && input.ring === "browser" ? { ring: "browser" } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.voice ? { voice: input.voice } : {}),
  };
}

export function isE164(n: string): boolean {
  return E164.test(n);
}

export interface RelayResult { status: number; body: unknown }
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Call the engine with the internal key and hand back its status and JSON.
 * The engine's statuses pass through (400 bad number, 404 unknown token, 409
 * another demo call is live, 503 not set up), except 401: that is our
 * internal key, not the user, and a 401 would send the browser to /login.
 */
export async function relayDemoCall(
  base: string, method: "GET" | "POST", path: string, payload: unknown, key: string, fetchImpl: FetchLike = fetch,
): Promise<RelayResult> {
  let resp: Response;
  try {
    resp = await fetchImpl(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Internal-Key": key },
      ...(method === "POST" ? { body: JSON.stringify(payload ?? {}) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { status: 502, body: { message: "The voice engine could not be reached." } };
  }
  if (resp.status === 204) return { status: 204, body: null };
  const data = await resp.json().catch(() => ({}));
  if (resp.ok) return { status: resp.status, body: data };
  const detail = (data as { detail?: unknown })?.detail;
  const message = typeof detail === "string" && detail ? detail : "The demo call could not be placed.";
  if (resp.status === 401) console.warn(`[voice-demo-calls] engine refused the internal key on ${path}`);
  return { status: resp.status === 401 ? 502 : resp.status, body: { message, engineStatus: resp.status } };
}
