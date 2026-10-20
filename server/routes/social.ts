/**
 * Instagram connect, the per-account Social switch, and Meta's deauthorize and
 * data-deletion callbacks (docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md).
 *
 * Auth on /api/social/accounts/:id/...: requireAuth, then accountIdFor (a client
 * user only reaches their own account), then the action's own rule. A request
 * let in by the internal API key has no req.user: it may read the status
 * (agency-level, like accountIdFor), but every action below needs a signed-in
 * user, so canManageSocial / isAgency answer false and the route sends 403.
 *
 * Tokens never leave the server: the status route returns display fields only.
 */
import crypto from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Express, Request } from "express";
import type { SocialConnection } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { accountIdFor, wrapAsync } from "./_helpers";
import { createOAuthState, consumeOAuthStateEntry, saveSessionThen } from "../oauthState";
import { buildAuthorizeUrl, connectWithCode, defaultIgDeps, IgApiError } from "../social/instagramApi";
import { parseSignedRequest } from "../social/signedRequest";
import { SOCIAL_UPLOAD_DIR } from "../social/media";
import { canManageSocial, isAgency, resolveReturnOrigin } from "../social/access";

const IG_OAUTH_FLOW = "social:instagram";
const DEFAULT_FRONTEND = "https://app.leadawaker.com";
const DATA_DELETION_PAGE = "https://app.leadawaker.com/social/data-deletion";
const CONFIRMATION_CODE = /^[0-9a-f]{32}$/;

type ConnectErrorReason = "access_denied" | "missing_code" | "invalid_state" | "not_professional" | "already_connected" | "failed";

function frontendFallback(): string {
  return process.env.FRONTEND_URL || DEFAULT_FRONTEND;
}

/** What the CRM may show about a connection. Never the token. */
function publicConnection(c: SocialConnection) {
  return {
    status: c.status,
    username: c.username,
    profilePictureUrl: c.profilePictureUrl,
    accountType: c.accountType,
    tokenExpiresAt: c.tokenExpiresAt,
    lastError: c.lastError,
    scopes: c.scopes,
  };
}

/** Meta's verified signed_request payload, or null when it is missing, forged, or the app secret is not set. */
function readSignedRequest(req: Request): (Record<string, unknown> & { user_id?: string }) | null {
  const signed = req.body?.signed_request;
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (typeof signed !== "string" || !signed || !secret) return null;
  return parseSignedRequest(signed, secret);
}

function signedUserId(data: { user_id?: unknown }): string {
  const id = data.user_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

/** Deletes a post's video, only inside SOCIAL_UPLOAD_DIR. A missing file is fine. */
async function removeVideoFile(path: string | null): Promise<void> {
  if (!path) return;
  const full = resolve(path);
  if (!full.startsWith(SOCIAL_UPLOAD_DIR + sep)) return;
  try {
    await unlink(full);
  } catch (err: any) {
    if (err?.code !== "ENOENT") console.error(`[social] could not delete ${full}: ${err?.message ?? err}`);
  }
}

function dataDeletionPage(code: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Data deletion request</title>
<style>
  body { margin: 0; background: #f7f7f8; color: #18181b; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  code { display: inline-block; padding: 4px 8px; background: #ececef; border-radius: 6px; font-size: 14px; word-break: break-all; }
  @media (prefers-color-scheme: dark) {
    body { background: #18181b; color: #f4f4f5; }
    code { background: #27272a; }
  }
</style>
</head>
<body>
<main>
  <h1>Your Instagram data has been deleted</h1>
  <p>Lead Awaker has deleted the Instagram data connected to this request.</p>
  <p>Confirmation code: <code>${code}</code></p>
</main>
</body>
</html>`;
}

export function registerSocialRoutes(app: Express): void {
  // ─── Status: any user of the account, or agency ───────────────────────────
  app.get("/api/social/accounts/:id/status", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return;
    const [enabled, conn] = await Promise.all([storage.getSocialEnabled(accountId), storage.getSocialConnection(accountId)]);
    res.json({ enabled, connection: conn ? publicConnection(conn) : null });
  }));

  // ─── Per-account switch: agency users only ────────────────────────────────
  app.put("/api/social/accounts/:id/enabled", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return;
    if (!isAgency(req.user)) return res.status(403).json({ message: "Agency access required" });
    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") return res.status(400).json({ message: "enabled must be a boolean" });
    if (!(await storage.getAccountById(accountId))) return res.status(404).json({ message: "Account not found" });
    await storage.setSocialEnabled(accountId, enabled);
    res.json({ enabled });
  }));

  // ─── OAuth: start. Agency, or a Manager of the account (Social switched on) ──
  app.get("/api/social/accounts/:id/instagram/authorize", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return;
    if (!canManageSocial(req.user, accountId)) return res.status(403).json({ message: "Forbidden" });
    if (!isAgency(req.user) && !(await storage.getSocialEnabled(accountId))) {
      return res.status(403).json({ message: "Instagram is not enabled for this account" });
    }
    const deps = defaultIgDeps();
    if (!deps.appId || !deps.appSecret) return res.status(501).json({ message: "Instagram is not configured" });
    const origin = typeof req.query.origin === "string" ? req.query.origin : undefined;
    const state = createOAuthState(req, IG_OAUTH_FLOW, accountId, resolveReturnOrigin(origin, frontendFallback()));
    saveSessionThen(req, () => res.redirect(buildAuthorizeUrl(state, deps)));
  }));

  // ─── OAuth: callback ──────────────────────────────────────────────────────
  // No auth guard: a browser redirect from Instagram. The account and the
  // frontend to return to come from the single-use state in the session.
  app.get("/api/social/oauth/instagram/callback", wrapAsync(async (req, res) => {
    const entry = consumeOAuthStateEntry(req, IG_OAUTH_FLOW, req.query.state);
    const base = entry?.returnOrigin || frontendFallback();
    const fail = (reason: ConnectErrorReason) => res.redirect(`${base}/platform/accounts?instagram=error&reason=${reason}`);

    if (req.query.error) return fail("access_denied");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) return fail("missing_code");
    if (!entry) return fail("invalid_state");

    try {
      const ig = await connectWithCode(code, defaultIgDeps());
      const owner = await storage.getSocialConnectionByExternalId(ig.externalUserId);
      if (owner && owner.accountsId !== entry.accountId) return fail("already_connected");
      await storage.upsertSocialConnection(entry.accountId, { ...ig, connectedByUserId: req.user?.id ?? null });
      console.log(`[social] Instagram connected: account ${entry.accountId} (@${ig.username})`);
      return res.redirect(`${base}/platform/accounts?instagram=connected`);
    } catch (err: any) {
      if (err instanceof IgApiError && err.kind === "not_professional") return fail("not_professional");
      console.error(`[social] Instagram connect failed for account ${entry.accountId}: ${err?.message ?? "unknown error"}`);
      return fail("failed");
    }
  }));

  // ─── Disconnect: agency, or a Manager of the account ──────────────────────
  app.delete("/api/social/accounts/:id/connection", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId === null) return;
    if (!canManageSocial(req.user, accountId)) return res.status(403).json({ message: "Forbidden" });
    await storage.disconnectSocialConnection(accountId);
    res.json({ ok: true });
  }));

  // ─── Meta: deauthorize (the user removed the app in Instagram) ────────────
  app.post("/api/social/instagram/deauthorize", wrapAsync(async (req, res) => {
    const data = readSignedRequest(req);
    if (!data) return res.status(400).json({ message: "Invalid signed_request" });
    const userId = signedUserId(data);
    const conns = userId ? await storage.listSocialConnectionsByMetaUserId(userId) : [];
    for (const conn of conns.filter((c) => c.status !== "disconnected")) {
      await storage.disconnectSocialConnection(conn.accountsId);
      console.log(`[social] Instagram deauthorized: account ${conn.accountsId} disconnected`);
    }
    res.sendStatus(200);
  }));

  // ─── Meta: data deletion ──────────────────────────────────────────────────
  // Deletes the connection and the account's posts that never went live, with
  // their video files. Published posts stay: they live on Instagram already.
  app.post("/api/social/instagram/data-deletion", wrapAsync(async (req, res) => {
    const data = readSignedRequest(req);
    if (!data) return res.status(400).json({ message: "Invalid signed_request" });
    const code = crypto.randomBytes(16).toString("hex");
    const userId = signedUserId(data);
    const conns = userId ? await storage.listSocialConnectionsByMetaUserId(userId) : [];
    for (const conn of conns) {
      const posts = await storage.deleteUnpublishedSocialPosts(conn.accountsId);
      await storage.deleteSocialConnection(conn.accountsId);
      await Promise.all(posts.map((p) => removeVideoFile(p.videoPath)));
      console.log(`[social] Instagram data deletion ${code}: account ${conn.accountsId}, connection and ${posts.length} unpublished post(s) deleted`);
    }
    if (conns.length === 0) console.log(`[social] Instagram data deletion ${code}: no connection found`);
    res.json({ url: `${DATA_DELETION_PAGE}/${code}`, confirmation_code: code });
  }));

  // ─── Data deletion status page (public; shows the code and nothing else) ──
  app.get("/social/data-deletion/:code", (req, res) => {
    const code = String(req.params.code ?? "").toLowerCase();
    if (!CONFIRMATION_CODE.test(code)) return res.status(404).type("text/plain").send("Not found");
    res.type("html").send(dataDeletionPage(code));
  });
}
