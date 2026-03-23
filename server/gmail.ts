import { google } from "googleapis";
import crypto from "crypto";

// ─── OAuth Config ────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://app.leadawaker.com/api/gmail/oauth/callback";
const GMAIL_TOKEN_SECRET = process.env.GMAIL_TOKEN_SECRET || "";
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

function getOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

// ─── Token Encryption (AES-256-GCM) ─────────────────────────────────────────

export function encryptTokens(tokens: object): string {
  if (!GMAIL_TOKEN_SECRET) throw new Error("GMAIL_TOKEN_SECRET env var is required");
  const key = crypto.scryptSync(GMAIL_TOKEN_SECRET, "gmail-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(tokens), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptTokens(encrypted: string): Record<string, unknown> {
  if (!GMAIL_TOKEN_SECRET) throw new Error("GMAIL_TOKEN_SECRET env var is required");
  const key = crypto.scryptSync(GMAIL_TOKEN_SECRET, "gmail-salt", 32);
  const [ivHex, authTagHex, data] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// ─── OAuth Flow ──────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent", // force refresh token
  });
}

export async function exchangeCode(code: string): Promise<{
  tokens: Record<string, unknown>;
  email: string;
}> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get the authenticated user's email
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress || "";

  return { tokens: tokens as Record<string, unknown>, email };
}

export async function getGmailClient(encryptedTokens: string) {
  const tokens = decryptTokens(encryptedTokens);
  const client = getOAuth2Client();
  client.setCredentials(tokens);

  // Handle token refresh
  client.on("tokens", (newTokens) => {
    // Merge new tokens with existing (refresh_token is only sent on first auth)
    Object.assign(tokens, newTokens);
  });

  return {
    gmail: google.gmail({ version: "v1", auth: client }),
    client,
    getUpdatedTokens: () => tokens,
  };
}

// ─── Email Signature ─────────────────────────────────────────────────────────

const SIGNATURE_TEMPLATE = (whatsappNumber: string) => `
<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-bottom:8px;">
      <img src="https://app.leadawaker.com/5.SideLogo.svg" alt="Lead Awaker" width="300" style="display:block;">
    </td>
  </tr>
  <tr>
    <td style="border-left:3px solid #4f46e5;padding-left:14px;padding-top:0;padding-bottom:0;">
      <span style="font-size:14px;color:#1a1a1a;"><strong>Gabriel Barbosa Fronza</strong></span><br>
      <a href="https://www.leadawaker.com" style="color:#4f46e5;text-decoration:none;">www.leadawaker.com</a><br>
      <span style="color:#666;">WhatsApp: ${whatsappNumber}</span>
    </td>
  </tr>
</table>`.trim();

/** Dutch/NL signature — default for NL and EN outreach */
export const BRANDED_SIGNATURE = SIGNATURE_TEMPLATE("(+31)62745-8300");

/** Brazilian signature — for PT outreach */
export const BRANDED_SIGNATURE_BR = SIGNATURE_TEMPLATE("+55 47 7400-2162");

/** Pick the right signature based on email language. Defaults to NL/EN. */
export function getSignatureForLanguage(language?: string): string {
  return language === "pt" ? BRANDED_SIGNATURE_BR : BRANDED_SIGNATURE;
}
