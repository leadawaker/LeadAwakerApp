import crypto from "crypto";

const secret = () => process.env.SESSION_SECRET || "leadawaker-dev-secret-change-in-production";

/** Keyed hash for one-time codes: a DB leak alone cannot be turned back into codes. */
export function hmacHex(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("hex");
}

export function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
