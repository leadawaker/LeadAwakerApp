// Cal.diy provisioning: creates a self-hosted Cal.com booking page for an
// account's client. Shells into the caldiy repo (see server/routes/calendar.ts
// for the manual re-provision/credential-reveal endpoints).
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { storage } from "../storage";
import { encryptSecret, decryptSecret } from "./crypto";

const execFile = promisify(execFileCb);

const CALDIY = "/home/gabriel/caldiy";

/** Cal.com credential type/appId for each LeadAwaker OAuth calendar provider. */
const CALDIY_CRED_META: Record<string, { type: string; appId: string }> = {
  google: { type: "google_calendar", appId: "google-calendar" },
  outlook: { type: "office365_calendar", appId: "office365-calendar" },
};

export interface CaldiyCredentials {
  username: string;
  password: string;
  bookingUrl: string;
}

/** Best-effort: provisions a Cal.diy page for an account. Returns null (and logs) on any failure. */
export async function provisionCaldiyForAccount(accountId: number): Promise<CaldiyCredentials | null> {
  try {
    const account = await storage.getAccountById(accountId);
    if (!account || !account.ownerEmail) return null;

    const { stdout } = await execFile(
      `${CALDIY}/provision-leadawaker.sh`,
      [],
      {
        env: {
          ...process.env,
          LA_EMAIL: account.ownerEmail,
          LA_NAME: account.name || account.ownerEmail,
          LA_TIMEZONE: account.timezone || "Europe/Amsterdam",
          ...(account.businessHoursStart ? { LA_BUSINESS_HOURS_START: account.businessHoursStart } : {}),
          ...(account.businessHoursEnd ? { LA_BUSINESS_HOURS_END: account.businessHoursEnd } : {}),
          LA_WEBHOOK_URL: "https://webhooks.leadawaker.com/webhooks/booking",
          LA_WEBAPP_URL: "https://cal.leadawaker.com",
        },
        timeout: 60000,
      },
    );
    const lastLine = stdout.trim().split("\n").pop() || "";
    const creds: CaldiyCredentials = JSON.parse(lastLine);

    await storage.upsertCalendarConnection({
      accountId,
      provider: "caldiy",
      status: "connected",
      externalId: creds.username,
      displayName: creds.bookingUrl,
      apiKeyEncrypted: encryptSecret(creds.password),
    } as any);

    return creds;
  } catch (err) {
    console.error(`[caldiy] auto-provision failed for account ${accountId}:`, err);
    return null;
  }
}

/**
 * Best-effort: pushes an OAuth calendar credential that LeadAwaker just obtained
 * (Google/Outlook) into the account's Cal.diy user, so Cal.com can read free/busy
 * and write booking events into the client's own calendar. Fire-and-forget — a
 * failure never breaks the LeadAwaker-side connection. Idempotent (reconnecting
 * just refreshes the token). Provider must be "google" or "outlook".
 */
export async function injectCalendarCredentialToCaldiy(accountId: number, provider: string): Promise<void> {
  const meta = CALDIY_CRED_META[provider];
  if (!meta) return;
  try {
    const account = await storage.getAccountById(accountId);
    if (!account?.ownerEmail) return;
    // Only inject if a Cal.diy booking page exists for this account.
    const caldiy = await storage.getCalendarConnection(accountId, "caldiy");
    if (!caldiy) return;

    const conn = await storage.getCalendarConnection(accountId, provider);
    if (!conn?.oauthTokensEncrypted) return;
    const tokens = decryptSecret<Record<string, any>>(conn.oauthTokensEncrypted);

    // Build the credential key in the exact shape Cal.com's CalendarService expects.
    let key: Record<string, unknown>;
    if (provider === "google") {
      // LeadAwaker stores the raw googleapis token object — already the right shape.
      key = tokens;
    } else {
      // Outlook: transform LeadAwaker's { access_token, refresh_token, expires_at(ms) }
      // into Cal.com's office365 shape (expiry_date in epoch seconds, + email/scope).
      key = {
        token_type: "Bearer",
        scope: "offline_access Calendars.Read Calendars.ReadWrite",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Math.round((tokens.expires_at ?? Date.now()) / 1000),
        email: conn.displayName || account.ownerEmail,
      };
    }

    await execFile(`${CALDIY}/inject-calendar-credential.sh`, [], {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        LA_CRED_TYPE: meta.type,
        LA_CRED_APPID: meta.appId,
        LA_CRED_KEY: JSON.stringify(key),
      },
      timeout: 60000,
    });
    console.error(`[caldiy] injected ${provider} credential for account ${accountId}`);
  } catch (err) {
    console.error(`[caldiy] credential injection failed for account ${accountId} (${provider}):`, err);
  }
}

/**
 * Best-effort: rewrites the account's Cal.diy user "Working Hours" schedule to a
 * new window. Called when businessHoursStart/End change on the account. No-op if
 * the account has no Cal.diy booking page or no hours set. Fire-and-forget.
 */
export async function resyncCaldiySchedule(accountId: number): Promise<void> {
  try {
    const account = await storage.getAccountById(accountId);
    if (!account?.ownerEmail) return;
    if (!account.businessHoursStart || !account.businessHoursEnd) return;
    const caldiy = await storage.getCalendarConnection(accountId, "caldiy");
    if (!caldiy) return;

    await execFile(`${CALDIY}/resync-schedule.sh`, [], {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        LA_BUSINESS_HOURS_START: account.businessHoursStart,
        LA_BUSINESS_HOURS_END: account.businessHoursEnd,
        ...(account.timezone ? { LA_TIMEZONE: account.timezone } : {}),
      },
      timeout: 60000,
    });
    console.error(`[caldiy] resynced schedule for account ${accountId}`);
  } catch (err) {
    console.error(`[caldiy] schedule resync failed for account ${accountId}:`, err);
  }
}
