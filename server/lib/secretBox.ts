// AES-256-GCM box for per-client channel secrets (WhatsApp token, app secret).
// Wire format, shared with automations/tools/secret_box.py:
//   "v1:" + base64(iv(12) | tag(16) | ciphertext)
// Key: 32 bytes, base64, env CHANNEL_SECRETS_KEY (same value in both repos).
// Never log or return what open() gives back.
import crypto from "node:crypto";

const PREFIX = "v1:";

function key(): Buffer {
  const raw = process.env.CHANNEL_SECRETS_KEY || "";
  if (!raw) throw new Error("CHANNEL_SECRETS_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CHANNEL_SECRETS_KEY must decode to 32 bytes");
  return buf;
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function open(sealed: string): string {
  if (!sealed.startsWith(PREFIX)) throw new Error("unknown secret box format");
  const blob = Buffer.from(sealed.slice(PREFIX.length), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), blob.subarray(0, 12));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString("utf8");
}
