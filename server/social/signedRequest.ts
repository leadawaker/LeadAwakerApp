import { createHmac, timingSafeEqual } from "node:crypto";

/** Parse and verify a Meta signed_request (deauthorize / data deletion callbacks). Returns null on any failure. */
export function parseSignedRequest(signed: string, appSecret: string): (Record<string, unknown> & { user_id?: string }) | null {
  try {
    const dot = signed.indexOf(".");
    if (dot <= 0) return null;
    const sig = Buffer.from(signed.slice(0, dot), "base64url");
    const payload = signed.slice(dot + 1);
    const expected = createHmac("sha256", appSecret).update(payload).digest();
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}
