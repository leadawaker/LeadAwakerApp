/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s step) on node:crypto. No dependency:
 * the algorithm is ~20 lines and avoids library API drift.
 */
import crypto from "crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Returns the matched 30 s step number (so the caller can reject replays), or null. */
export function verifyTotp(secret: string, code: string, now = Date.now(), window = 1): number | null {
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(now / STEP_MS);
  let matched: number | null = null;
  // No early return: keeps timing independent of which step matched.
  for (let d = -window; d <= window; d++) {
    const expected = Buffer.from(hotp(key, current + d));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) matched = current + d;
  }
  return matched;
}

export function totpKeyUri(account: string, secret: string, issuer = "Lead Awaker"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** The code for a given moment. Used by tests and probes only. */
export function totpCodeAt(secret: string, now = Date.now()): string {
  return hotp(base32Decode(secret), Math.floor(now / STEP_MS));
}
