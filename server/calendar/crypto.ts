// AES-256-GCM encryption for calendar secrets (OAuth tokens, API keys).
// Reuses the same secret as Gmail (GMAIL_TOKEN_SECRET) so the Pi only needs one
// key in .env; CALENDAR_TOKEN_SECRET overrides it if set.
import crypto from "crypto";

const SECRET = process.env.CALENDAR_TOKEN_SECRET || process.env.GMAIL_TOKEN_SECRET || "";

export function encryptSecret(value: unknown): string {
  if (!SECRET) throw new Error("CALENDAR_TOKEN_SECRET or GMAIL_TOKEN_SECRET env var is required");
  const key = crypto.scryptSync(SECRET, "calendar-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(JSON.stringify(value), "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${enc}`;
}

export function decryptSecret<T = Record<string, unknown>>(encrypted: string): T {
  if (!SECRET) throw new Error("CALENDAR_TOKEN_SECRET or GMAIL_TOKEN_SECRET env var is required");
  const key = crypto.scryptSync(SECRET, "calendar-salt", 32);
  const [ivHex, tagHex, data] = encrypted.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(data, "hex", "utf8");
  dec += decipher.final("utf8");
  return JSON.parse(dec) as T;
}
