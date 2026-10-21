/** WebAuthn configuration (specs/two-factor-auth Phase 3). */

export function webauthnConfig() {
  const rpID = process.env.WEBAUTHN_RP_ID || (process.env.NODE_ENV === "production" ? "" : "localhost");
  if (!rpID) throw new Error("WEBAUTHN_RP_ID is required in production");
  const origins = (process.env.WEBAUTHN_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    rpID,
    rpName: process.env.WEBAUTHN_RP_NAME || "Lead Awaker",
    origins: origins.length ? origins : ["http://localhost:5000"],
  };
}

export function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b = Buffer.from(s, "base64url");
  const out = new Uint8Array(new ArrayBuffer(b.length));
  out.set(b);
  return out;
}
