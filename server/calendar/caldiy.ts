// Cal.diy provisioning: creates a self-hosted Cal.com booking page for an
// account's client. Shells into the caldiy repo (see server/routes/calendar.ts
// for the manual re-provision/credential-reveal endpoints).
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { storage } from "../storage";
import { encryptSecret } from "./crypto";

const execFile = promisify(execFileCb);

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
      "/home/gabriel/caldiy/provision-leadawaker.sh",
      [],
      {
        env: {
          ...process.env,
          LA_EMAIL: account.ownerEmail,
          LA_NAME: account.name || account.ownerEmail,
          LA_TIMEZONE: account.timezone || "Europe/Amsterdam",
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
