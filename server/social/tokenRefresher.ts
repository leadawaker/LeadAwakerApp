// Instagram token refresher (spec "Token renewal"), every 6 h:
//   - refresh connected tokens that expire within 20 days and are at least 24 h old,
//   - mark failures and expired tokens needs_attention and tell the agency (once per problem),
//   - warn the agency daily once a token is within 7 days of expiry,
//   - delete uploads older than 24 h that never became a post.
// The rules are in tokenRules.ts; the token is opened and sealed by storage and never logged.
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { refreshDecision, shouldWarnExpiry } from "./tokenRules";
import type { SocialNotifType } from "./notify";

const TICK_MS = 6 * 3_600_000;
const FIRST_RUN_MS = 60_000;
const ORPHAN_AGE_MS = 24 * 3_600_000;
const UPLOAD_FILE = /^([0-9a-f-]{36})\.(mp4|mov)$/;
const POST_LINK = "/platform/accounts?tab=integrations";

export interface RefreshableConnection {
  id: number;
  accountsId: number;
  username: string | null;
  status: string;
  tokenExpiresAt: Date | null;
  tokenRefreshedAt: Date | null;
  createdAt: Date;
  expiryWarnedAt: Date | null;
  lastError: string | null;
}

export interface RefresherDeps {
  now(): Date;
  listConnections(): Promise<RefreshableConnection[]>;
  getToken(c: RefreshableConnection): string | null;
  refresh(token: string): Promise<{ accessToken: string; expiresAt: Date }>;
  updateToken(id: number, token: string, expiresAt: Date): Promise<void>;
  setStatus(id: number, status: "connected" | "needs_attention", lastError: string | null): Promise<void>;
  markWarned(id: number, at: Date): Promise<void>;
  notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void>;
}

function who(c: RefreshableConnection): string {
  return `${c.username ? `@${c.username}` : "Instagram"} (account ${c.accountsId})`;
}

/** Marks the connection needs_attention; the agency hears about it only when it was fine before. */
async function problem(d: RefresherDeps, c: RefreshableConnection, reason: string): Promise<void> {
  await d.setStatus(c.id, "needs_attention", reason);
  if (c.status === "needs_attention") return;
  c.status = "needs_attention";
  await d.notifyAgency({
    type: "social_token_problem",
    title: "Instagram connection needs attention",
    body: `${who(c)}: ${reason}`,
    accountId: c.accountsId,
    link: POST_LINK,
  });
}

async function refreshOne(d: RefresherDeps, c: RefreshableConnection, now: Date): Promise<void> {
  const decision = refreshDecision(c, now);
  if (decision === "expired") {
    await problem(d, c, "Token expired, reconnect needed");
  } else if (decision === "refresh") {
    const token = d.getToken(c);
    if (!token) {
      await problem(d, c, "Token unavailable, reconnect needed");
    } else {
      try {
        const next = await d.refresh(token);
        await d.updateToken(c.id, next.accessToken, next.expiresAt);
        await d.setStatus(c.id, "connected", null);
        c.status = "connected";
        c.tokenExpiresAt = next.expiresAt;
        c.expiryWarnedAt = null;
        console.log(`[social-tokens] refreshed ${who(c)}`);
      } catch (err: any) {
        await problem(d, c, `Token refresh failed: ${String(err?.message ?? err).slice(0, 300)}`);
      }
    }
  }

  if (shouldWarnExpiry(c, now)) {
    const daysLeft = c.tokenExpiresAt ? Math.ceil((c.tokenExpiresAt.getTime() - now.getTime()) / 86_400_000) : 0;
    await d.notifyAgency({
      type: "social_token_problem",
      title: "Instagram token about to expire",
      body: daysLeft > 0
        ? `${who(c)}: the token expires in ${daysLeft} day(s) and has not been renewed. Reconnect to keep posting.`
        : `${who(c)}: the token has expired. The client must reconnect Instagram.`,
      accountId: c.accountsId,
      link: POST_LINK,
    });
    await d.markWarned(c.id, now);
  }
}

export async function runTokenRefreshOnce(d: RefresherDeps): Promise<void> {
  const now = d.now();
  for (const c of await d.listConnections()) {
    try {
      await refreshOne(d, c, now);
    } catch (err: any) {
      console.error(`[social-tokens] connection ${c.id}: ${err?.message ?? err}`);
    }
  }
}

/**
 * Deletes <root>/<accountId>/<uuid>.<mp4|mov> files older than 24 h whose id has no post
 * (abandoned uploads, a replacement video whose edit was refused). Returns how many were deleted.
 */
export async function cleanupOrphanUploads(root: string, hasPost: (publicId: string) => Promise<boolean>, now: Date): Promise<number> {
  let accountDirs: string[];
  try {
    accountDirs = await readdir(root);
  } catch {
    return 0;
  }
  let deleted = 0;
  for (const dir of accountDirs.filter((n) => /^\d+$/.test(n))) {
    let files: string[];
    try {
      files = await readdir(join(root, dir));
    } catch {
      continue;
    }
    for (const name of files) {
      const m = UPLOAD_FILE.exec(name);
      if (!m) continue;
      const path = join(root, dir, name);
      try {
        const s = await stat(path);
        if (!s.isFile() || now.getTime() - s.mtimeMs < ORPHAN_AGE_MS) continue;
        if (await hasPost(m[1])) continue;
        await unlink(path);
        deleted++;
      } catch (err: any) {
        if (err?.code !== "ENOENT") console.error(`[social-tokens] cleanup of ${path} failed: ${err?.message ?? err}`);
      }
    }
  }
  return deleted;
}

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { liveRefresherDeps, liveCleanup } = await import("./liveDeps");
    await runTokenRefreshOnce(liveRefresherDeps());
    const n = await liveCleanup();
    if (n > 0) console.log(`[social-tokens] deleted ${n} unused upload(s)`);
  } catch (err: any) {
    console.error(`[social-tokens] tick failed: ${err?.message ?? err}`);
  } finally {
    running = false;
  }
}

export function startSocialTokenRefresher(): void {
  console.log("[social-tokens] started (6h)");
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, FIRST_RUN_MS);
}
