import crypto from "crypto";

/**
 * A short-lived proof, minted here and checked by the automations engine, that
 * the caller is signed into the CRM as agency staff.
 *
 * The /voice-demo page talks to the engine directly from the browser, so the
 * engine never sees the CRM session cookie (the DBR demos get around that by
 * proxying through Express and adding x-demo-unlimited). This is the same
 * "staff are unlimited" rule for a route that cannot be proxied: the page asks
 * Express for a pass, then hands it to the engine with the session request.
 *
 * Stateless on purpose: `<expiry-ms>.<hmac>`, signed with INTERNAL_API_KEY,
 * which both processes already hold. The engine's copy of the format lives in
 * automations/src/automations/voice/rate_limit.py; keep the two in step.
 */
const PASS_TTL_MS = 12 * 60 * 60 * 1000;

export function mintVoiceDemoPass(now = Date.now()): string | null {
  const key = process.env.INTERNAL_API_KEY || "";
  if (!key) return null;
  const exp = String(now + PASS_TTL_MS);
  const sig = crypto.createHmac("sha256", key).update(`voice-demo-admin:${exp}`).digest("hex");
  return `${exp}.${sig}`;
}
