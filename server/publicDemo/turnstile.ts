// Cloudflare Turnstile check for the landing page's website demo form.
// Fails closed: no secret, a network error or any non-success answer is "no".
import { randomUUID } from "crypto";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** The widget on the landing page renders with data-action="public_demo". */
export const TURNSTILE_ACTION = "public_demo";

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[public-demo] TURNSTILE_SECRET_KEY is not set; refusing every request");
    return false;
  }
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip, idempotency_key: randomUUID() }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("[public-demo] turnstile rejected", data["error-codes"]);
      return false;
    }
    if (data.action && data.action !== TURNSTILE_ACTION) {
      console.warn("[public-demo] turnstile action mismatch", data.action);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[public-demo] turnstile verify failed", (err as Error).message);
    return false;
  }
}
