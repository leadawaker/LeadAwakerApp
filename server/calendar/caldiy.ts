// Cal.diy provisioning: creates a self-hosted Cal.com booking page for an
// account's client. Shells into the caldiy repo (see server/routes/calendar.ts
// for the manual re-provision/credential-reveal endpoints).
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { storage } from "../storage";
import { encryptSecret, decryptSecret } from "./crypto";

const execFile = promisify(execFileCb);

const CALDIY = "/home/gabriel/caldiy";

function parseLastJsonLine<T>(stdout: string): T {
  const lastLine = stdout.trim().split("\n").pop() || "";
  return JSON.parse(lastLine) as T;
}

const resyncDebounce = new Map<number, ReturnType<typeof setTimeout>>();

export function debouncedResyncCaldiySchedule(accountId: number): void {
  const existing = resyncDebounce.get(accountId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    resyncDebounce.delete(accountId);
    resyncCaldiySchedule(accountId).catch((err) =>
      console.error(`[calendar-blocks] resync failed:`, err)
    );
  }, 600);
  resyncDebounce.set(accountId, t);
}

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
          // Per-client booking-email branding: client's own logo + business name.
          // Logos are stored as base64 data URIs (blocked by email clients), so we
          // point at the public endpoint that re-serves them as real images and
          // falls back to the LeadAwaker logo when the account has none.
          LA_BRAND_LOGO_URL: `https://api.leadawaker.com/public/account-logo/${accountId}`,
          LA_BRAND_NAME: account.name || "",
          LA_TIMEZONE: account.timezone || "Europe/Amsterdam",
          ...(account.businessHoursStart ? { LA_BUSINESS_HOURS_START: account.businessHoursStart } : {}),
          ...(account.businessHoursEnd ? { LA_BUSINESS_HOURS_END: account.businessHoursEnd } : {}),
          LA_WEBHOOK_URL: "https://webhooks.leadawaker.com/webhooks/booking",
          LA_WEBAPP_URL: "https://cal.leadawaker.com",
          // Meeting type configuration for Cal.diy location object.
          LA_MEETING_TYPE: (account as any).meetingType || "phone_call",
          ...((account as any).callingNumber ? { LA_CALLING_NUMBER: (account as any).callingNumber } : {}),
          ...((account as any).twilioDefaultFromNumber ? { LA_WHATSAPP_NUMBER: (account as any).twilioDefaultFromNumber } : {}),
        },
        timeout: 60000,
      },
    );
    const creds = parseLastJsonLine<CaldiyCredentials>(stdout);

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
 * Connects an Apple / CalDAV calendar for an account's client by writing a
 * Cal.diy Credential + SelectedCalendar (+ DestinationCalendar for write-back)
 * directly into the Cal.diy DB. Validates credentials first — throws with a
 * user-facing error message if validation fails or if no booking page exists.
 * Never logs the password.
 */
export async function injectCaldavCredentialToCaldiy(
  accountId: number,
  opts: { kind: "apple" | "caldav"; username: string; password: string; url?: string },
): Promise<{ integration: string; externalId: string; credentialId: number }> {
  const account = await storage.getAccountById(accountId);
  if (!account?.ownerEmail) throw new Error("Account has no owner email");

  const caldiy = await storage.getCalendarConnection(accountId, "caldiy");
  if (!caldiy) throw new Error("No Cal.diy booking page for this account — provision it first");

  const { stdout, stderr } = await execFile(
    `${CALDIY}/inject-caldav-credential.sh`,
    [],
    {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        CALDAV_KIND: opts.kind,
        CALDAV_USERNAME: opts.username,
        CALDAV_PASSWORD: opts.password,
        ...(opts.url ? { CALDAV_URL: opts.url } : {}),
        CALDAV_WRITEBACK: opts.kind === "apple" ? "1" : "0",
      },
      timeout: 60000,
    },
  );

  if (stderr) console.error(`[caldiy] inject-caldav:`, stderr);

  const result = parseLastJsonLine<{
    ok: boolean;
    error?: string;
    integration?: string;
    externalId?: string;
    credentialId?: number;
  }>(stdout);

  if (!result.ok) throw new Error(result.error || "Failed to connect Apple / CalDAV calendar");

  return {
    integration: result.integration!,
    externalId: result.externalId!,
    credentialId: result.credentialId!,
  };
}

/**
 * Best-effort: rewrites the account's Cal.diy user "Working Hours" schedule to a
 * new window/day-set and inserts date-override rows for any manual busy blocks in
 * the next 90 days. Called when businessHoursStart/End/openDays change OR when a
 * manual block is created/updated/deleted. No-op if no Cal.diy booking page exists.
 * Fire-and-forget.
 */
export async function resyncCaldiySchedule(accountId: number): Promise<void> {
  try {
    const account = await storage.getAccountById(accountId);
    if (!account?.ownerEmail) return;
    const caldiy = await storage.getCalendarConnection(accountId, "caldiy");
    if (!caldiy) return;

    // Fetch manual blocks for the next 90 days to embed in the resync.
    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const blocks = await storage.listCalendarBlocks(accountId, now, horizon);
    const blocksJson = JSON.stringify(
      blocks.map((b) => ({
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        allDay: b.allDay,
      }))
    );

    await execFile(`${CALDIY}/resync-schedule.sh`, [], {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        ...(account.businessHoursStart ? { LA_BUSINESS_HOURS_START: account.businessHoursStart } : {}),
        ...(account.businessHoursEnd ? { LA_BUSINESS_HOURS_END: account.businessHoursEnd } : {}),
        ...(account.timezone ? { LA_TIMEZONE: account.timezone } : {}),
        ...(account.openDays && account.openDays.length
          ? { LA_OPEN_DAYS: account.openDays.join(",") }
          : {}),
        LA_BLOCKS: blocksJson,
      },
      timeout: 60000,
    });
    console.error(`[caldiy] resynced schedule for account ${accountId} (${blocks.length} block(s))`);
  } catch (err) {
    console.error(`[caldiy] schedule resync failed for account ${accountId}:`, err);
  }
}
