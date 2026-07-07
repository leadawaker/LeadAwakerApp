# Multi-Account Gmail Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each CRM user (Gabriel = user 4, Finn = user 31) connect their OWN Gmail account and send/draft prospect emails as themselves, replacing today's single hardcoded `leadawaker@gmail.com` connection.

**Architecture:** The `Gmail_Sync_State` table gains a `user_id` owner plus `send_as_email`/`send_as_name` identity columns. The OAuth flow binds the connection to the logged-in user (same nonce pattern as `server/oauthState.ts` already used by calendar). All send/read routes resolve the caller's own connection instead of the hardcoded email. Send logic is extracted into a reusable `sendGmailAsUser(userId, opts)` helper (the follow-up scheduler in the companion plan reuses it). The 5-minute sync loop iterates over all connected accounts.

**Tech Stack:** Express + Drizzle ORM + PostgreSQL (NocoDB schema `p2mxx34fvbf3ll6`), googleapis, React + TanStack-style fetch via `apiFetch`, react-i18next (en + nl only).

## Global Constraints

- **No test framework exists in this repo.** Do NOT add one. Each task verifies via live API calls (the pm2 `tsx watch` server auto-reloads ~5–8s after save), direct DB queries with `node --env-file=.env`, and `pm2 logs leadawaker --lines 50 --nostream`.
- **Never run `npx tsc --noEmit`** unless Gabriel explicitly asks.
- **Never run `npm run dev`** — the app is already served by pm2.
- **Timestamps:** always `new Date()` objects server-side, never ISO strings from the client.
- **i18n:** every new user-facing string goes in `client/src/locales/{en,nl}/` (pt is retired — do not touch pt files).
- **DB migrations:** `npm run db:push` fails (no TTY). Use a one-off `node --env-file=.env scripts/<name>.mjs` script with the `pg` package.
- **Never use em dashes** in any copy or comments. Use colons, commas, or parentheses.
- **Login for API verification:** `POST /api/auth/login` with `{"email":"leadawaker@gmail.com","password":"Admin1234"}` (resolves to Gabriel, user 4, Owner). Use `curl -c /tmp/claude-1000/cookies.txt` / `-b` to hold the session.
- Verification base URL: `http://localhost:5000` (check `ecosystem.config.cjs` / `pm2 describe leadawaker` if the port differs; use the port the Express server listens on).

**Known DB facts (verified 2026-07-06):**
- `p2mxx34fvbf3ll6."Gmail_Sync_State"` has exactly one row: `id=1, account_email='leadawaker@gmail.com'` (Gabriel's mailbox; sends as `gabriel@leadawaker.com` via a Gmail send-as alias).
- `Users`: Gabriel = `id 4, email gabriel@leadawaker.com, role Owner, full_name_1 'Gabriel B. Fronza'`; Finn = `id 31, email finn@leadawaker.com, role Admin, full_name_1 'Finn Zijlstra'`.

**Action required from Gabriel (not automatable, do at any point before Finn connects):**
In Google Cloud Console → the OAuth consent screen used by `GOOGLE_CLIENT_ID`, add `finn@leadawaker.com` as a test user (if the app is in Testing mode). Otherwise Finn's consent screen will refuse. The redirect URI does not change.

---

### Task 1: Schema columns + migration for per-user Gmail connections

**Files:**
- Modify: `shared/schema.ts:1470-1480` (gmailSyncState table)
- Create: `scripts/add-gmail-multi-account.mjs`

**Interfaces:**
- Produces: `gmailSyncState` Drizzle table with new columns `userId` (`user_id` integer), `sendAsEmail` (`send_as_email` varchar 255), `sendAsName` (`send_as_name` text). Types `GmailSyncState` / `InsertGmailSyncState` pick these up automatically via `$inferSelect` / `createInsertSchema`.

- [ ] **Step 1: Add the three columns to the Drizzle table**

In `shared/schema.ts`, change the `gmailSyncState` definition to:

```ts
export const gmailSyncState = nocodb.table("Gmail_Sync_State", {
  id: serial("id").primaryKey(),
  accountEmail: varchar("account_email", { length: 255 }).notNull(),
  // CRM user who owns this connection. One Gmail connection per user.
  userId: integer("user_id"),
  // From-identity: the address/name outgoing mail is sent as (a Gmail
  // send-as alias of accountEmail, or accountEmail itself).
  sendAsEmail: varchar("send_as_email", { length: 255 }),
  sendAsName: text("send_as_name"),
  lastHistoryId: varchar("last_history_id", { length: 100 }),
  lastFullSyncAt: timestamp("last_full_sync_at", { withTimezone: true }),
  oauthTokensEncrypted: text("oauth_tokens_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("gmail_sync_state_account_email_idx").on(t.accountEmail),
  index("gmail_sync_state_user_id_idx").on(t.userId),
]);
```

(`integer` is already imported at the top of schema.ts.)

- [ ] **Step 2: Write the migration script**

Create `scripts/add-gmail-multi-account.mjs`:

```js
// Adds per-user ownership + send-as identity to Gmail_Sync_State and
// backfills the existing single connection to Gabriel (user 4).
// Run: node --env-file=.env scripts/add-gmail-multi-account.mjs
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const S = "p2mxx34fvbf3ll6";

const sql = `
ALTER TABLE ${S}."Gmail_Sync_State"
  ADD COLUMN IF NOT EXISTS user_id integer,
  ADD COLUMN IF NOT EXISTS send_as_email varchar(255),
  ADD COLUMN IF NOT EXISTS send_as_name text;

CREATE INDEX IF NOT EXISTS gmail_sync_state_user_id_idx
  ON ${S}."Gmail_Sync_State" (user_id);

UPDATE ${S}."Gmail_Sync_State"
SET user_id = 4,
    send_as_email = 'gabriel@leadawaker.com',
    send_as_name = 'Gabriel Barbosa Fronza'
WHERE account_email = 'leadawaker@gmail.com' AND user_id IS NULL;
`;

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT id, account_email, user_id, send_as_email, send_as_name FROM ${S}."Gmail_Sync_State"`
  );
  console.log("Gmail_Sync_State rows:", JSON.stringify(rows, null, 2));
} finally {
  await pool.end();
}
```

- [ ] **Step 3: Run the migration**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/add-gmail-multi-account.mjs`

Expected output: one row printed with `user_id: 4`, `send_as_email: 'gabriel@leadawaker.com'`, `send_as_name: 'Gabriel Barbosa Fronza'`.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts scripts/add-gmail-multi-account.mjs
git commit -m "feat(gmail): add per-user ownership + send-as identity to Gmail_Sync_State"
```

---

### Task 2: Storage methods for per-user lookup, listing, and upsert

**Files:**
- Modify: `server/storage/misc.ts:163-187` (the Gmail Sync State section)

**Interfaces:**
- Consumes: new schema columns from Task 1.
- Produces (on the exported `misc` storage object, surfaced through the `storage` barrel in `server/storage.ts`):
  - `getGmailSyncState(accountEmail: string): Promise<GmailSyncState | undefined>` (unchanged)
  - `getGmailSyncStateByUserId(userId: number): Promise<GmailSyncState | undefined>`
  - `listGmailSyncStates(): Promise<GmailSyncState[]>`
  - `upsertGmailSyncState(data: InsertGmailSyncState): Promise<GmailSyncState>` (now keys on `userId` when present, else `accountEmail`)
  - `deleteGmailSyncStateByUserId(userId: number): Promise<boolean>`
  - `deleteGmailSyncState(accountEmail: string): Promise<boolean>` (unchanged)

- [ ] **Step 1: Replace the Gmail Sync State section in `server/storage/misc.ts`**

Replace the block from the `// ─── Gmail Sync State ───` comment through the closing brace of `deleteGmailSyncState` with:

```ts
  // ─── Gmail Sync State ──────────────────────────────────────────────────────

  async getGmailSyncState(accountEmail: string): Promise<GmailSyncState | undefined> {
    const [row] = await db.select().from(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail));
    return row;
  },

  async getGmailSyncStateByUserId(userId: number): Promise<GmailSyncState | undefined> {
    const [row] = await db.select().from(gmailSyncState).where(eq(gmailSyncState.userId, userId));
    return row;
  },

  async listGmailSyncStates(): Promise<GmailSyncState[]> {
    return db.select().from(gmailSyncState);
  },

  // One connection per user: when userId is present, that row is replaced;
  // otherwise falls back to the legacy accountEmail key (gmail-sync cursor writes).
  async upsertGmailSyncState(data: InsertGmailSyncState): Promise<GmailSyncState> {
    const existing = data.userId != null
      ? await this.getGmailSyncStateByUserId(data.userId)
      : await this.getGmailSyncState(data.accountEmail);
    if (existing) {
      const [row] = await db.update(gmailSyncState)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(gmailSyncState.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(gmailSyncState).values(data as any).returning();
    return row;
  },

  async deleteGmailSyncState(accountEmail: string): Promise<boolean> {
    const result = await db.delete(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail)).returning();
    return result.length > 0;
  },

  async deleteGmailSyncStateByUserId(userId: number): Promise<boolean> {
    const result = await db.delete(gmailSyncState).where(eq(gmailSyncState.userId, userId)).returning();
    return result.length > 0;
  },
};
```

(Keep the existing imports; `eq`, `db`, `gmailSyncState`, and the types are already imported in this file.)

- [ ] **Step 2: Verify the server reloaded cleanly and methods work**

Wait ~8s for tsx watch to reload, then:

Run: `pm2 logs leadawaker --lines 15 --nostream | tail -8`
Expected: no TypeScript/module errors after the reload line.

Run:
```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query('SELECT user_id, account_email FROM p2mxx34fvbf3ll6.\"Gmail_Sync_State\"').then(r => { console.log(r.rows); process.exit(0); });"
```
Expected: `[ { user_id: 4, account_email: 'leadawaker@gmail.com' } ]`

- [ ] **Step 3: Commit**

```bash
git add server/storage/misc.ts
git commit -m "feat(gmail): per-user sync-state storage methods (byUserId, list, keyed upsert)"
```

---

### Task 3: Parameterize the email signature per sender

**Files:**
- Modify: `server/gmail.ts:88-115` (signature section)

**Interfaces:**
- Produces: `getSignatureForLanguage(language?: string, sender?: { name?: string | null; whatsapp?: string | null }): string`. Existing callers that pass only `language` keep working (defaults to Gabriel's identity).

- [ ] **Step 1: Replace the signature section in `server/gmail.ts`**

Replace everything from `// ─── Email Signature ───` to the end of the file with:

```ts
// ─── Email Signature ─────────────────────────────────────────────────────────

const DEFAULT_SIGNATURE_NAME = "Gabriel Barbosa Fronza";
const DEFAULT_WHATSAPP_NL = "(+31)62745-8300";
const DEFAULT_WHATSAPP_BR = "+55 84 8111-8224";

const SIGNATURE_TEMPLATE = (name: string, whatsappNumber: string) => `
<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-bottom:8px;">
      <img src="https://app.leadawaker.com/5.SideLogo.svg" alt="Lead Awaker" width="300" style="display:block;">
    </td>
  </tr>
  <tr>
    <td style="border-left:3px solid #4f46e5;padding-left:14px;padding-top:0;padding-bottom:0;">
      <span style="font-size:14px;color:#1a1a1a;"><strong>${name}</strong></span><br>
      <a href="https://www.leadawaker.com" style="color:#4f46e5;text-decoration:none;">www.leadawaker.com</a><br>
      <span style="color:#666;">WhatsApp: ${whatsappNumber}</span>
    </td>
  </tr>
</table>`.trim();

/** Signature for the given language and sender. Defaults to Gabriel's identity. */
export function getSignatureForLanguage(
  language?: string,
  sender?: { name?: string | null; whatsapp?: string | null },
): string {
  const name = sender?.name || DEFAULT_SIGNATURE_NAME;
  const whatsapp = sender?.whatsapp || (language === "pt" ? DEFAULT_WHATSAPP_BR : DEFAULT_WHATSAPP_NL);
  return SIGNATURE_TEMPLATE(name, whatsapp);
}
```

Note: this deletes the exported `BRANDED_SIGNATURE` / `BRANDED_SIGNATURE_BR` constants. Check for other importers first:

Run: `grep -rn "BRANDED_SIGNATURE" server/ client/ shared/`
Expected: no matches outside `server/gmail.ts`. If any exist, update them to call `getSignatureForLanguage()` instead.

- [ ] **Step 2: Verify reload**

Run: `pm2 logs leadawaker --lines 15 --nostream | tail -5`
Expected: clean reload, no import errors.

- [ ] **Step 3: Commit**

```bash
git add server/gmail.ts
git commit -m "feat(gmail): parameterize email signature by sender name and whatsapp"
```

---

### Task 4: Extract `sendGmailAsUser` helper (single send path)

**Files:**
- Create: `server/gmailSend.ts`

**Interfaces:**
- Consumes: `storage.getGmailSyncStateByUserId` (Task 2), `getGmailClient` / `getSignatureForLanguage` from `server/gmail.ts` (Task 3), `users` table from `@shared/schema`, `broadcast` from `server/sse.ts`.
- Produces:
  ```ts
  export class GmailNotConnectedError extends Error {}
  export interface GmailSendOptions {
    to: string;
    subject: string;
    htmlBody: string;
    prospectId?: number;
    replyToMessageId?: string;
    threadId?: string;
    language?: string;
    // set by the follow-up scheduler (companion plan); stored in metadata
    sequenceStep?: number;
  }
  export interface GmailSendResult {
    interaction: any | null;
    gmailMessageId: string;
    gmailThreadId: string;
    fromEmail: string;
  }
  export async function sendGmailAsUser(userId: number, opts: GmailSendOptions): Promise<GmailSendResult>
  ```
  The companion plan (2026-07-06-outreach-followups-and-tracking.md) extends this same function with tracking injection: keep it as the ONLY place raw MIME is built for sends.

- [ ] **Step 1: Create `server/gmailSend.ts`**

```ts
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getGmailClient, getSignatureForLanguage } from "./gmail";
import { broadcast } from "./sse";

export class GmailNotConnectedError extends Error {
  constructor(userId: number) {
    super(`Gmail not connected for user ${userId}. Connect it in Settings first.`);
    this.name = "GmailNotConnectedError";
  }
}

export interface GmailSendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  prospectId?: number;
  replyToMessageId?: string;
  threadId?: string;
  language?: string;
  sequenceStep?: number;
}

export interface GmailSendResult {
  interaction: any | null;
  gmailMessageId: string;
  gmailThreadId: string;
  fromEmail: string;
}

/** Resolve the user's connected Gmail + send-as identity, or throw. */
export async function getSenderIdentity(userId: number) {
  const state = await storage.getGmailSyncStateByUserId(userId);
  if (!state?.oauthTokensEncrypted) throw new GmailNotConnectedError(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const sendAsEmail = state.sendAsEmail || state.accountEmail;
  const sendAsName = state.sendAsName || user?.fullName1 || sendAsEmail;
  return { state, user, sendAsEmail, sendAsName };
}

/**
 * Send an email through the user's own connected Gmail account.
 * Creates the outbound Interaction, updates the prospect's contact tracking
 * fields, and broadcasts the interaction over SSE. This is the single send
 * path: the /api/gmail/send route and the follow-up scheduler both call it.
 */
export async function sendGmailAsUser(userId: number, opts: GmailSendOptions): Promise<GmailSendResult> {
  const { state, user, sendAsEmail, sendAsName } = await getSenderIdentity(userId);
  const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted!);

  const signature = getSignatureForLanguage(opts.language, {
    name: sendAsName,
    whatsapp: user?.phone,
  });
  const fullHtml = `${opts.htmlBody}\n${signature}`;

  const fromHeader = `${sendAsName} <${sendAsEmail}>`;
  const messageParts = [
    `From: ${fromHeader}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
  ];
  if (opts.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${opts.replyToMessageId}`);
    messageParts.push(`References: ${opts.replyToMessageId}`);
  }
  messageParts.push("", fullHtml);
  const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

  const sendParams: { userId: string; requestBody: { raw: string; threadId?: string } } = {
    userId: "me",
    requestBody: { raw: rawMessage },
  };
  if (opts.threadId) sendParams.requestBody.threadId = opts.threadId;

  const sent = await gmailClient.users.messages.send(sendParams);
  const gmailMessageId = sent.data.id || "";
  const gmailThreadId = sent.data.threadId || opts.threadId || "";

  let interaction: any = null;
  if (opts.prospectId) {
    interaction = await storage.createInteraction({
      type: "email",
      direction: "outbound",
      status: "delivered",
      content: opts.htmlBody,
      metadata: {
        gmailMessageId,
        gmailThreadId,
        subject: opts.subject,
        from: fromHeader,
        to: opts.to,
        fromEmail: sendAsEmail,
        toEmail: opts.to,
        sentByUserId: userId,
        ...(opts.sequenceStep != null ? { sequenceStep: opts.sequenceStep } : {}),
      },
      prospectId: opts.prospectId,
      sentAt: new Date(),
      conversationThreadId: gmailThreadId || null,
      accountId: 1,
    } as any);

    const prospect = await storage.getProspectById(opts.prospectId);
    if (prospect) {
      const updates: Record<string, unknown> = {
        lastContactedAt: new Date(),
        contactMethod: "email",
        outreachStatus: "email_sent",
        followUpCount: (prospect.followUpCount ?? 0) + 1,
      };
      if (prospect.status === "New") updates.status = "Contacted";
      if (!prospect.firstContactedAt) updates.firstContactedAt = new Date();
      await storage.updateProspect(opts.prospectId, updates as any);
    }

    broadcast(1, "new_interaction", interaction);
  }

  return { interaction, gmailMessageId, gmailThreadId, fromEmail: sendAsEmail };
}

/** Create a Gmail draft in the user's own mailbox. Returns draft/message/thread ids. */
export async function draftGmailAsUser(userId: number, opts: GmailSendOptions) {
  const { state, user, sendAsEmail, sendAsName } = await getSenderIdentity(userId);
  const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted!);

  const signature = getSignatureForLanguage(opts.language, {
    name: sendAsName,
    whatsapp: user?.phone,
  });
  const fullHtml = `${opts.htmlBody}\n${signature}`;
  const fromHeader = `${sendAsName} <${sendAsEmail}>`;
  const messageParts = [
    `From: ${fromHeader}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
  ];
  if (opts.replyToMessageId) {
    messageParts.push(`In-Reply-To: ${opts.replyToMessageId}`);
    messageParts.push(`References: ${opts.replyToMessageId}`);
  }
  messageParts.push("", fullHtml);
  const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

  const draftParams: { userId: string; requestBody: { message: { raw: string; threadId?: string } } } = {
    userId: "me",
    requestBody: { message: { raw: rawMessage } },
  };
  if (opts.threadId) draftParams.requestBody.message.threadId = opts.threadId;

  const draft = await gmailClient.users.drafts.create(draftParams);
  return {
    draftId: draft.data.id,
    messageId: draft.data.message?.id,
    threadId: draft.data.message?.threadId,
  };
}
```

- [ ] **Step 2: Verify reload**

Run: `pm2 logs leadawaker --lines 15 --nostream | tail -5`
Expected: clean reload (file is not imported yet; this just catches syntax errors when Task 5 wires it in, so a clean log is sufficient here).

- [ ] **Step 3: Commit**

```bash
git add server/gmailSend.ts
git commit -m "feat(gmail): extract sendGmailAsUser/draftGmailAsUser per-user send helpers"
```

---

### Task 5: Rewrite Gmail routes for per-user OAuth and per-user send/read

**Files:**
- Modify: `server/routes/gmail.ts` (full rewrite of the account-resolution parts)

**Interfaces:**
- Consumes: `sendGmailAsUser`, `draftGmailAsUser`, `GmailNotConnectedError` from `server/gmailSend.ts` (Task 4); `storage.getGmailSyncStateByUserId` / `deleteGmailSyncStateByUserId` / `upsertGmailSyncState` (Task 2); `createOAuthState` / `consumeOAuthState` / `saveSessionThen` from `server/oauthState.ts` (unchanged).
- Produces: same endpoint URLs as today, now per-user:
  - `GET /api/gmail/oauth/authorize` (Owner or Admin, binds `req.user.id`)
  - `GET /api/gmail/oauth/callback` (recovers userId from nonce)
  - `GET /api/gmail/oauth/status` → `{ connected, email?, sendAs? }` for the CALLER
  - `POST /api/gmail/oauth/disconnect` (own connection only)
  - `POST /api/gmail/send` and `POST /api/gmail/draft` (send as the caller; internal-key callers pass `senderUserId` in the body)
  - message read/search/delete endpoints resolve the caller's own mailbox

- [ ] **Step 1: Rewrite `server/routes/gmail.ts`**

Replace the entire file content with:

```ts
import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, requireAdminOrOwner } from "../auth";
import { wrapAsync } from "./_helpers";
import { getAuthUrl, exchangeCode, encryptTokens, getGmailClient } from "../gmail";
import { createOAuthState, consumeOAuthState, saveSessionThen } from "../oauthState";
import { sendGmailAsUser, draftGmailAsUser, GmailNotConnectedError } from "../gmailSend";

const GMAIL_OAUTH_FLOW = "gmail";

/**
 * Which CRM user is acting? Session user normally; Python automations calling
 * with x-internal-key have no session user and must pass senderUserId.
 */
function resolveActingUserId(req: Request): number | null {
  if (req.user?.id != null) return req.user.id;
  const fromBody = Number((req.body as any)?.senderUserId);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  return null;
}

/** Load the acting user's own Gmail client, or answer 400 and return null. */
async function getCallerGmail(req: Request, res: any) {
  const userId = resolveActingUserId(req);
  if (!userId) {
    res.status(400).json({ message: "No acting user: log in or pass senderUserId" });
    return null;
  }
  const state = await storage.getGmailSyncStateByUserId(userId);
  if (!state?.oauthTokensEncrypted) {
    res.status(400).json({ message: "Gmail not connected. Please connect your Gmail account first." });
    return null;
  }
  const { gmail } = await getGmailClient(state.oauthTokensEncrypted);
  return gmail;
}

export function registerGmailRoutes(app: Express): void {
  // ─── Gmail OAuth (per CRM user: Owner and Admin can each connect their own) ──

  app.get("/api/gmail/oauth/authorize", requireAdminOrOwner, wrapAsync(async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ message: "Session required" });
    const state = createOAuthState(req, GMAIL_OAUTH_FLOW, req.user.id);
    const url = getAuthUrl(state);
    saveSessionThen(req, () => res.redirect(url));
  }));

  app.get("/api/gmail/oauth/callback", wrapAsync(async (req, res) => {
    const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const dest = (status: string, extra = "") => `${base}/platform/settings?gmail=${status}${extra}`;

    const error = req.query.error as string;
    if (error) {
      console.error("[Gmail OAuth] Google returned error:", error);
      return res.redirect(dest("error", `&reason=${encodeURIComponent(error)}`));
    }

    const code = req.query.code as string;
    const userId = consumeOAuthState(req, GMAIL_OAUTH_FLOW, req.query.state);
    if (!code) return res.redirect(dest("error", "&reason=missing_code"));
    if (!userId) return res.redirect(dest("error", "&reason=invalid_state"));

    try {
      const { tokens, email } = await exchangeCode(code);
      const encrypted = encryptTokens(tokens);
      const user = await (await import("../db")).db
        .select()
        .from((await import("@shared/schema")).users)
        .where((await import("drizzle-orm")).eq((await import("@shared/schema")).users.id, userId));
      const u = user[0];

      // Default From-identity: the user's CRM login address (a send-as alias
      // of the connected mailbox, or the mailbox itself). Editable in DB later.
      await storage.upsertGmailSyncState({
        userId,
        accountEmail: email,
        sendAsEmail: u?.email || email,
        sendAsName: u?.fullName1 || null,
        oauthTokensEncrypted: encrypted,
        lastHistoryId: null,
        lastFullSyncAt: null,
      });

      res.redirect(dest("connected"));
    } catch (err: any) {
      console.error("[Gmail OAuth] Callback error:", err);
      res.redirect(dest("error"));
    }
  }));

  app.get("/api/gmail/oauth/status", requireAuth, wrapAsync(async (req, res) => {
    if (!req.user?.id) return res.json({ connected: false });
    const state = await storage.getGmailSyncStateByUserId(req.user.id);
    if (state?.oauthTokensEncrypted) {
      res.json({ connected: true, email: state.accountEmail, sendAs: state.sendAsEmail || state.accountEmail });
    } else {
      res.json({ connected: false });
    }
  }));

  app.post("/api/gmail/oauth/disconnect", requireAuth, wrapAsync(async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ message: "Session required" });
    await storage.deleteGmailSyncStateByUserId(req.user.id);
    res.json({ ok: true });
  }));

  // Manual sync trigger (all connected accounts)
  app.post("/api/gmail/sync", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    const { syncEmails } = await import("../gmail-sync");
    await syncEmails();
    res.json({ ok: true });
  }));

  // ─── Gmail Send ────────────────────────────────────────────────────────

  app.post("/api/gmail/send", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { to, subject, htmlBody, prospectId, replyToMessageId, threadId, language } = req.body;

    if (!to || !subject || !htmlBody || !prospectId) {
      return res.status(400).json({ message: "Missing required fields: to, subject, htmlBody, prospectId" });
    }

    const userId = resolveActingUserId(req);
    if (!userId) return res.status(400).json({ message: "No acting user: log in or pass senderUserId" });

    try {
      const result = await sendGmailAsUser(userId, {
        to, subject, htmlBody, prospectId, replyToMessageId, threadId, language,
      });
      res.status(201).json(result.interaction);
    } catch (err) {
      if (err instanceof GmailNotConnectedError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  }));

  // ─── Gmail: Create Draft ─────────────────────────────────────────────────

  app.post("/api/gmail/draft", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { to, subject, htmlBody, replyToMessageId, threadId, language } = req.body;

    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ message: "Missing required fields: to, subject, htmlBody" });
    }

    const userId = resolveActingUserId(req);
    if (!userId) return res.status(400).json({ message: "No acting user: log in or pass senderUserId" });

    try {
      const draft = await draftGmailAsUser(userId, { to, subject, htmlBody, replyToMessageId, threadId, language });
      res.json(draft);
    } catch (err) {
      if (err instanceof GmailNotConnectedError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  }));

  // ─── Gmail: Delete/Trash Email ────────────────────────────────────────────

  app.delete("/api/gmail/messages/:messageId", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { messageId } = req.params;
    const { permanent } = req.query;

    const gmailClient = await getCallerGmail(req, res);
    if (!gmailClient) return;

    if (permanent === "true") {
      await gmailClient.users.messages.delete({ userId: "me", id: messageId });
    } else {
      await gmailClient.users.messages.trash({ userId: "me", id: messageId });
    }

    res.json({ ok: true, action: permanent === "true" ? "deleted" : "trashed" });
  }));

  // ─── Gmail: Get Email by ID ──────────────────────────────────────────────

  app.get("/api/gmail/messages/:messageId", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { messageId } = req.params;

    const gmailClient = await getCallerGmail(req, res);
    if (!gmailClient) return;

    const msg = await gmailClient.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    res.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      snippet: msg.data.snippet,
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      labels: msg.data.labelIds,
    });
  }));

  // ─── Gmail: Search Emails ──────────────────────────────────────────────

  app.get("/api/gmail/search", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { q, maxResults } = req.query;

    if (!q) {
      return res.status(400).json({ message: "Missing required query parameter: q" });
    }

    const gmailClient = await getCallerGmail(req, res);
    if (!gmailClient) return;

    const result = await gmailClient.users.messages.list({
      userId: "me",
      q: q as string,
      maxResults: Math.min(parseInt(maxResults as string) || 20, 100),
    });

    const messages = result.data.messages || [];

    const summaries = await Promise.all(
      messages.map(async (m) => {
        try {
          const full = await gmailClient.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });
          const headers = full.data.payload?.headers || [];
          const getH = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          return {
            id: full.data.id,
            threadId: full.data.threadId,
            snippet: full.data.snippet,
            from: getH("From"),
            to: getH("To"),
            subject: getH("Subject"),
            date: getH("Date"),
          };
        } catch {
          return { id: m.id, error: "Could not fetch" };
        }
      })
    );

    res.json({
      total: result.data.resultSizeEstimate,
      messages: summaries,
    });
  }));

  // ─── interactions/mark-read (Gmail-adjacent) ─────────────────────────────

  app.patch("/api/interactions/mark-read", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { prospectId } = req.body;
    if (!prospectId) return res.status(400).json({ message: "prospectId required" });
    await storage.markProspectInteractionsRead(Number(prospectId));
    res.json({ ok: true });
  }));
}
```

Then clean up the awkward dynamic-import chain in the callback: replace the `const user = await (await import("../db")).db ...` block with static imports at the top of the file:

```ts
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
```

and in the callback body:

```ts
      const [u] = await db.select().from(users).where(eq(users.id, userId));
```

(Write the file with the static-import version directly; the dynamic version above is shown only so no step depends on unstated context.)

- [ ] **Step 2: Verify per-user status endpoint as Gabriel**

```bash
curl -s -c /tmp/claude-1000/cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"leadawaker@gmail.com","password":"Admin1234"}' | head -c 200
curl -s -b /tmp/claude-1000/cookies.txt http://localhost:5000/api/gmail/oauth/status
```
Expected: `{"connected":true,"email":"leadawaker@gmail.com","sendAs":"gabriel@leadawaker.com"}`

- [ ] **Step 3: Verify a real send as Gabriel (to himself)**

```bash
curl -s -b /tmp/claude-1000/cookies.txt -X POST http://localhost:5000/api/gmail/send \
  -H 'Content-Type: application/json' \
  -d '{"to":"gabriel@leadawaker.com","subject":"Multi-account send test","htmlBody":"<p>Test from the per-user send path.</p>","prospectId":1}'
```
Expected: HTTP 201 with an interaction JSON whose `metadata.fromEmail` is `gabriel@leadawaker.com` and `metadata.sentByUserId` is 4. (prospectId 1 must exist; if not, pick any real id via `SELECT id FROM p2mxx34fvbf3ll6."Prospects" LIMIT 1`.)

- [ ] **Step 4: Verify authorize is reachable for an Admin (302, not 403)**

There is no Finn password available; instead verify the middleware change directly: the route now uses `requireAdminOrOwner`, so assert Gabriel (Owner) still gets a redirect:

```bash
curl -s -o /dev/null -w "%{http_code}" -b /tmp/claude-1000/cookies.txt "http://localhost:5000/api/gmail/oauth/authorize"
```
Expected: `302`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/gmail.ts
git commit -m "feat(gmail): per-user OAuth binding and per-user send/draft/read routes"
```

---

### Task 6: Multi-account sync loop

**Files:**
- Modify: `server/gmail-sync.ts`

**Interfaces:**
- Consumes: `storage.listGmailSyncStates()` (Task 2).
- Produces: `syncEmails(): Promise<void>` (same export, now syncs every connected account). `startGmailSync`/`stopGmailSync` unchanged.

- [ ] **Step 1: Make outbound detection per-account and loop over connections**

In `server/gmail-sync.ts`:

1. Delete lines 9-10 (`const ACCOUNT_EMAIL = ...` and `const SEND_AS = ...`).

2. Change `isOutbound` (line 25-28) to take the account's own addresses:

```ts
function isOutbound(from: string, ownAddresses: string[]): boolean {
  const addr = extractEmailAddress(from);
  return ownAddresses.some((a) => addr === a.toLowerCase());
}
```

3. Thread `ownAddresses` through `parseGmailMessage` and `processMessage`. In `parseGmailMessage`, change the signature to `function parseGmailMessage(msg: gmail_v1.Schema$Message, ownAddresses: string[]): ParsedEmail` and the direction line to:

```ts
    direction: isOutbound(from, ownAddresses) ? "outbound" : "inbound",
```

In `processMessage`, change the signature to:

```ts
async function processMessage(gmail: gmail_v1.Gmail, messageId: string, ownAddresses: string[]): Promise<void> {
```

and the parse call to `const parsed = parseGmailMessage(msg.data, ownAddresses);`.

4. Thread `ownAddresses` through `initialSync` and `incrementalSync` the same way (add a `ownAddresses: string[]` parameter, pass it to every `processMessage` call, and pass it along in the history-expired fallback `return initialSync(gmail, ownAddresses);`).

5. Replace the `syncEmails` function (lines 288-312) with:

```ts
export async function syncEmails(): Promise<void> {
  const states = await storage.listGmailSyncStates();

  for (const syncState of states) {
    if (!syncState.oauthTokensEncrypted) continue;
    try {
      const ownAddresses = [syncState.accountEmail, syncState.sendAsEmail]
        .filter((a): a is string => !!a)
        .map((a) => a.toLowerCase());

      const { gmail, getUpdatedTokens } = await getGmailClient(syncState.oauthTokensEncrypted);

      let newHistoryId: string | undefined;
      if (syncState.lastHistoryId) {
        newHistoryId = await incrementalSync(gmail, syncState.lastHistoryId, ownAddresses);
      } else {
        newHistoryId = await initialSync(gmail, ownAddresses);
      }

      const updatedTokens = getUpdatedTokens();
      await storage.upsertGmailSyncState({
        userId: syncState.userId,
        accountEmail: syncState.accountEmail,
        sendAsEmail: syncState.sendAsEmail,
        sendAsName: syncState.sendAsName,
        lastHistoryId: newHistoryId || syncState.lastHistoryId || "",
        lastFullSyncAt: !syncState.lastHistoryId ? new Date() : syncState.lastFullSyncAt,
        oauthTokensEncrypted: encryptTokens(updatedTokens),
      });
    } catch (err: any) {
      console.error(`[Gmail Sync] Account ${syncState.accountEmail} failed:`, err.message);
    }
  }
}
```

(One account failing must not block the others: that is what the per-account try/catch is for.)

- [ ] **Step 2: Verify a sync pass over the loop**

```bash
curl -s -b /tmp/claude-1000/cookies.txt -X POST http://localhost:5000/api/gmail/sync
pm2 logs leadawaker --lines 30 --nostream | grep -i "gmail sync" | tail -5
```
Expected: `{"ok":true}` and log lines showing a sync pass with no errors (incremental sync for `leadawaker@gmail.com`).

- [ ] **Step 3: Commit**

```bash
git add server/gmail-sync.ts
git commit -m "feat(gmail): sync loop iterates all connected accounts with per-account send-as detection"
```

---

### Task 7: Settings UI: each agency user manages their own Gmail connection

**Files:**
- Modify: `client/src/features/settings/components/ProfileSection.tsx:654-743`
- Modify: `client/src/locales/en/settings.json`, `client/src/locales/nl/settings.json`

**Interfaces:**
- Consumes: `GET /api/gmail/oauth/status` now returns `{ connected, email?, sendAs? }` (Task 5). `isAgencyUser` and `isOwner` already come from `useWorkspace()` at line 34.

- [ ] **Step 1: Extend the Gmail status state to include sendAs**

At line 134, change the state type:

```ts
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string; sendAs?: string } | null>(null);
```

- [ ] **Step 2: Show the Gmail card to all agency users, not just the Owner**

Currently the Gmail card is the third cell inside the `{isOwner && ...}` grid (lines 654-743). Restructure:

1. Extract the Gmail card JSX (lines 707-740, the `<div className="rounded-lg border border-border bg-card p-4 space-y-3">...` block for Gmail) into a local variable ABOVE the return's `isOwner` block:

```tsx
          {/* Gmail card: every agency user connects their own mailbox */}
          {(() => null)()}
```

Concretely, inside the component body (before the `return`), define:

```tsx
  const gmailCard = (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
        <Mail className="h-4 w-4 text-brand-indigo" />
        {t("gmail.title")}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("gmail.description")}
      </p>
      {gmailStatus?.connected ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-foreground">{gmailStatus.email}</span>
            </div>
            <button
              onClick={handleGmailDisconnect}
              disabled={gmailLoading}
              className="text-xs text-red-500 hover:text-red-600 transition-colors font-medium"
            >
              {gmailLoading ? "..." : t("gmail.disconnect")}
            </button>
          </div>
          {gmailStatus.sendAs && gmailStatus.sendAs !== gmailStatus.email && (
            <p className="text-xs text-muted-foreground">
              {t("gmail.sendingAs", { email: gmailStatus.sendAs })}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleGmailConnect}
          disabled={gmailLoading}
          className="la-btn la-btn--wine"
        >
          <Mail className="h-4 w-4" />
          {gmailLoading ? "..." : t("gmail.connect")}
        </button>
      )}
    </div>
  );
```

2. In the `{isOwner && ...}` grid, replace the inline Gmail card block (lines 707-740) with `{gmailCard}`.

3. Directly after the closing of the `{isOwner && ...}` block (after line 743), add a non-Owner agency variant:

```tsx
          {!isOwner && isAgencyUser && (
            <div className="grid grid-cols-3 gap-4">
              {gmailCard}
            </div>
          )}
```

- [ ] **Step 3: Add the new i18n key**

In `client/src/locales/en/settings.json`, inside the `"gmail"` object, add:

```json
    "sendingAs": "Sends as {{email}}"
```

In `client/src/locales/nl/settings.json`, inside the `"gmail"` object, add:

```json
    "sendingAs": "Verzendt als {{email}}"
```

- [ ] **Step 4: Verify in the browser**

Use playwright-cli against `https://app.leadawaker.com`: log in as `leadawaker@gmail.com` / `Admin1234`, open Settings → Profile, and screenshot. Expected: Gmail card shows the green dot, `leadawaker@gmail.com`, and the line "Sends as gabriel@leadawaker.com".

- [ ] **Step 5: Commit**

```bash
git add client/src/features/settings/components/ProfileSection.tsx client/src/locales/en/settings.json client/src/locales/nl/settings.json
git commit -m "feat(settings): per-user Gmail connect card visible to all agency users"
```

---

### Task 8: End-to-end verification and handover notes

**Files:**
- No code changes. Produces a short verification report in the final message.

- [ ] **Step 1: Full flow check as Gabriel**

1. `GET /api/gmail/oauth/status` with Gabriel's session → connected true, sendAs gabriel@leadawaker.com.
2. Send a test email to `gabriel@leadawaker.com` via `POST /api/gmail/send` (any real prospectId). Confirm 201.
3. Within ~5 minutes (or via `POST /api/gmail/sync`), confirm the sync loop still records interactions: `pm2 logs leadawaker --nostream | grep "Gmail Sync" | tail -3` shows no errors.

- [ ] **Step 2: Confirm Finn's path is unblocked (without his password)**

```bash
node --env-file=.env -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query('SELECT id, email, role FROM p2mxx34fvbf3ll6.\"Users\" WHERE id = 31').then(r => { console.log(r.rows); process.exit(0); });"
```
Expected: Finn is Admin. The authorize route is `requireAdminOrOwner`, so his session will pass. His actual OAuth consent is a human step.

- [ ] **Step 3: Report to Gabriel**

State plainly in the final message:
1. What Finn must do: log in at app.leadawaker.com → Settings → Profile → Connect Gmail → approve consent for `finn@leadawaker.com`.
2. What Gabriel must do first: add `finn@leadawaker.com` as a test user on the Google Cloud OAuth consent screen (if app is in Testing mode).
3. Reminder: cold-email volume ramp still applies (start 5-10/day per sender, +20% max day-over-day).
