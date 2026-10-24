/**
 * Password-reset token helpers (pure, no DB): the token is 32 random bytes sent
 * to the user by email; only its sha256 is stored, in Users.preferences under
 * `password_reset`, so a DB or API leak of the preferences cannot be turned
 * back into a working link. One outstanding token per user (a new request
 * replaces it), cleared on use.
 */
import crypto from "crypto";

export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const RESET_PREF_KEY = "password_reset";
export const RESET_MIN_PASSWORD = 6; // same as accept-invite and change-password
export const RESET_MAX_PASSWORD = 1024; // keeps scrypt from hashing megabytes
/** The reset page lives on the production site (the Vercel app proxies /api to the Pi). */
const DEFAULT_RESET_BASE_URL = "https://www.leadawaker.com";

export type ResetLang = "en" | "nl" | "pt";
const LANGS: readonly string[] = ["en", "nl", "pt"];

export interface ResetRecord {
  token_hash: string;
  expires_at: string;
  created_at: string;
}

const sha256Hex = (data: string) => crypto.createHash("sha256").update(data).digest("hex");
const TOKEN_RE = /^[0-9a-f]{64}$/i;

/** A fresh token (emailed, never stored) and the record to store. */
export function createResetToken(now: number = Date.now()): { token: string; record: ResetRecord } {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    record: {
      token_hash: sha256Hex(token),
      expires_at: new Date(now + RESET_TTL_MS).toISOString(),
      created_at: new Date(now).toISOString(),
    },
  };
}

export function parsePrefs(raw: unknown): Record<string, any> {
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** True only for a well-formed, unexpired record whose hash matches the token (constant-time). */
export function verifyResetToken(rawPrefs: unknown, token: unknown, now: number = Date.now()): boolean {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return false;
  const rec = parsePrefs(rawPrefs)[RESET_PREF_KEY] as Partial<ResetRecord> | null | undefined;
  if (!rec || typeof rec.token_hash !== "string" || typeof rec.expires_at !== "string") return false;
  const expires = new Date(rec.expires_at).getTime();
  if (!Number.isFinite(expires) || now > expires) return false;
  const provided = Buffer.from(sha256Hex(token), "hex");
  const stored = Buffer.from(rec.token_hash, "hex");
  if (stored.length !== provided.length) return false;
  return crypto.timingSafeEqual(provided, stored);
}

/** The user's saved language (accept-invite stores `language`, the invite `lang`), else the request's, else en. */
export function pickResetLang(rawPrefs: unknown, requested?: unknown): ResetLang {
  const prefs = parsePrefs(rawPrefs);
  for (const v of [prefs.language, prefs.lang, requested]) {
    if (typeof v === "string" && LANGS.includes(v)) return v as ResetLang;
  }
  return "en";
}

/** Never derived from the request (a Host or body origin would let an attacker redirect the link). */
export function buildResetUrl(token: string, email: string, lang: ResetLang, base?: string): string {
  const root = (base ?? process.env.PASSWORD_RESET_BASE_URL ?? DEFAULT_RESET_BASE_URL).replace(/\/$/, "");
  return `${root}/reset-password?token=${token}&email=${encodeURIComponent(email)}&lang=${lang}`;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const e = value.trim().toLowerCase();
  return e.length > 0 && e.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) ? e : null;
}
