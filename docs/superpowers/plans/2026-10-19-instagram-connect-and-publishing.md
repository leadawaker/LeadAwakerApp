# Instagram Connect and Scheduled Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any Lead Awaker client account can connect its Instagram professional account, and agency users can schedule Reels that publish automatically after the client approves them.

**Architecture:** A new `server/social/` domain holds pure rules (approval, scheduling, token refresh), a fetch-injected Instagram Graph client, video probing, and two `setInterval` pollers (publisher every 60 s, token refresher daily) modelled on `server/reviews/poller.ts`. Routes live in `server/routes/social.ts`, storage in `server/storage/social.ts`, two new tables plus `Accounts.social_enabled`. The client gets a "Social" integrations group with a Connect Instagram card and a new "Social" account workspace tab under `client/src/features/social/`.

**Tech Stack:** Express + TypeScript, Drizzle on Postgres (NocoDB schema `p2mxx34fvbf3ll6`), node:test via tsx, ffmpeg/ffprobe on the Pi, React + react-query + react-i18next.

**Spec:** `docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md`

## Global Constraints

- Work on branch `feat/instagram-publishing` (worktree via superpowers:using-git-worktrees). `main` auto-deploys the Vercel frontend on push; do not push until Gabriel says so.
- Never run `tsc` / `npm run check` unless Gabriel asks. Never run `npm run dev`; the app runs under pm2.
- Server tests: `node --import tsx --test <file>`, using `import { test } from "node:test"` and `import assert from "node:assert/strict"`. External calls are faked by injecting `fetch` (pattern: `server/demoSocial/image.ts:12`, `image.test.ts:8-24`).
- No new npm dependencies. Uploads stream with Node streams; video tools via `execFile("ffprobe"|"ffmpeg")`.
- Every user-facing string goes through i18n in `client/src/locales/{en,nl,pt}/accounts.json`. No em dashes in any copy.
- The client never sends ISO timestamps. Scheduling sends `date: "YYYY-MM-DD"` and `time: "HH:mm"`; the server converts with the account's `timezone`.
- Tokens are stored only via `seal()` / `open()` from `server/lib/secretBox.ts` and never logged or returned to the client.
- Exact Meta URLs (already saved in the Meta dashboard):
  - Redirect: `https://app.leadawaker.com/api/social/oauth/instagram/callback`
  - Deauthorize: `https://app.leadawaker.com/api/social/instagram/deauthorize`
  - Data deletion: `https://app.leadawaker.com/api/social/instagram/data-deletion`
- Scopes, in this order: `instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights`
- Env: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` (present), `CHANNEL_SECRETS_KEY` (present), optional `SOCIAL_MEDIA_BASE_URL` (default `https://app.leadawaker.com`).
- Upload cap 100 MB (Cloudflare). Reel specs: MP4 or MOV, H.264 or HEVC, AAC audio at most 48 kHz (audio optional), 23 to 60 fps, width at most 1920, 3 s to 900 s. Caption at most 2,200 characters, 30 hashtags, 20 @ mentions.
- Do not touch `Accounts.instagram_access_token` / `instagram_user_id` or the Python engine.
- Do not run `script/add-field.ts` (it regenerates `shared/schema.ts` and drops hand-written indexes). Schema changes are raw SQL plus a hand edit of `shared/schema.ts`.
- Client work: load the `leadawaker-dev` skill and follow `UI_STANDARDS.md` (mobile first, tokens not raw colours, dark mode).
- Keep files under 500 lines.

## Review Focus

1. **Edit racing the publisher.** Agency saves an edit at the same second the poller starts publishing. Expected: the edit is refused with 409 and the post publishes as approved, never a half-edited version. Pinned in Task 6 (conditional update test).
2. **pm2 restart mid-publish.** The server restarts after a container was created but before `media_publish`. Expected: on the next tick the post resumes from its stored `ig_container_id` and is published once, not twice. Pinned in Task 7.
3. **Cross-account access.** A Manager of account A requests account B's posts, a post id from B under A's URL, or B's connection. Expected: 403/404, nothing leaks. Pinned in Task 5 (`canManageSocial`) and Task 6 (post lookups always filter by account).
4. **Oversized or aborted upload.** A 150 MB file, or the connection drops halfway. Expected: 413 or an error, and no partial file left on disk. Pinned in Task 4 (`streamToFileWithLimit`).
5. **Caption over Meta's limits.** 2,201 characters, 31 hashtags or 21 mentions. Expected: refused with a clear reason at save time, not a failure at publish time. Pinned in Task 2 (`validateCaption`) and enforced in Task 6.

---

### Task 1: Tables and schema

**Files:**
- Create: `script/create-social-tables.mjs`
- Modify: `shared/schema.ts` (add `socialEnabled` to `accounts` at :29; add two tables after `publicDemoRequests` at ~:2165)

**Interfaces:**
- Produces: drizzle tables `socialConnections`, `socialPosts`; types `SocialConnection`, `InsertSocialConnection`, `SocialPost`, `InsertSocialPost`; `accounts.socialEnabled`.

- [ ] **Step 1: Write `script/create-social-tables.mjs`** following `script/create-public-demo-tables.mjs` (pg.Pool, `IF NOT EXISTS`, prints the result from information_schema). It creates:
  - `ALTER TABLE "p2mxx34fvbf3ll6"."Accounts" ADD COLUMN IF NOT EXISTS social_enabled boolean NOT NULL DEFAULT false`
  - `Social_Connections`: `id serial pk, accounts_id integer not null, provider text not null, external_user_id text, username text, profile_picture_url text, account_type text, access_token_enc text, scopes jsonb not null default '[]', token_expires_at timestamptz, token_refreshed_at timestamptz, status text not null default 'connected', last_error text, expiry_warned_at timestamptz, connected_by_user_id integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()`
  - Unique index `social_connections_account_provider` on `(accounts_id, provider)`; partial unique index `social_connections_external_connected` on `(provider, external_user_id) WHERE status <> 'disconnected'`.
  - `Social_Posts`: `id serial pk, accounts_id integer not null, connection_id integer, media_type text not null default 'REELS', video_path text, video_public_id text, video_ext text, video_duration_s real, video_width integer, video_height integer, video_bytes bigint, caption text not null default '', share_to_feed boolean not null default true, is_ai_generated boolean not null default true, scheduled_at timestamptz not null, requires_approval boolean not null default true, approval_status text not null default 'pending', approval_note text, approved_by_user_id integer, approved_at timestamptz, approval_waived_by_user_id integer, approval_waived_at timestamptz, approval_reminder_sent_at timestamptz, status text not null default 'scheduled', ig_container_id text, publishing_started_at timestamptz, ig_media_id text, permalink text, attempts integer not null default 0, last_error text, published_at timestamptz, created_by_user_id integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()`
  - Unique index on `video_public_id`; index on `(status, scheduled_at)`; index on `accounts_id`.

- [ ] **Step 2: Run it**

Run: `node --env-file=.env script/create-social-tables.mjs`
Expected: prints `Social_Connections` and `Social_Posts` with their columns, and `social_enabled` on Accounts. Running it a second time changes nothing and does not error.

- [ ] **Step 3: Hand-edit `shared/schema.ts`.** Add `socialEnabled: boolean("social_enabled").notNull().default(false)` to `accounts`. Add `export const socialConnections = nocodb.table("Social_Connections", {...})` and `export const socialPosts = nocodb.table("Social_Posts", {...})` with camelCase property names for every column above (timestamps `timestamp(..., { withTimezone: true })`, `scopes: jsonb("scopes").$type<string[]>()`), plus `$inferSelect` / `$inferInsert` types named as in Interfaces. Match the style of `publicDemoRequests`.

- [ ] **Step 4: Verify the server still boots**

Run: `pm2 restart leadawaker && sleep 8 && pm2 logs leadawaker --lines 30 --nostream`
Expected: no import or schema errors.

- [ ] **Step 5: Commit**

```bash
git add script/create-social-tables.mjs shared/schema.ts
git commit -m "feat(social): tables for Instagram connections and scheduled posts"
```

---

### Task 2: Pure rules (approval, scheduling, captions, list sections, token refresh)

**Files:**
- Create: `shared/socialPosts.ts`, `shared/socialPosts.test.ts`
- Create: `server/social/time.ts`, `server/social/time.test.ts`
- Create: `server/social/tokenRules.ts`, `server/social/tokenRules.test.ts`

**Interfaces:**
- Produces (shared, used by server and client):
  ```ts
  export type SocialPostStatus = "scheduled" | "held" | "publishing" | "published" | "failed" | "cancelled";
  export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
  export const IG_CAPTION_MAX = 2200, IG_MAX_HASHTAGS = 30, IG_MAX_MENTIONS = 20;
  export interface PostRuleView { status: SocialPostStatus; requiresApproval: boolean; approvalStatus: ApprovalStatus; scheduledAt: Date }
  export function isApprovalSatisfied(p: Pick<PostRuleView, "requiresApproval" | "approvalStatus">): boolean
  export function approvalAfterEdit(prev: Pick<PostRuleView, "requiresApproval" | "approvalStatus">, change: { videoChanged: boolean; captionChanged: boolean; requiresApproval: boolean }): ApprovalStatus
  export type DueAction = "wait" | "hold" | "start" | "fail_disconnected";
  export function classifyScheduledPost(p: PostRuleView, now: Date, connectionStatus: string | null): DueAction
  export type CaptionCheck = { ok: true } | { ok: false; reason: "too_long" | "too_many_hashtags" | "too_many_mentions" };
  export function validateCaption(caption: string): CaptionCheck
  export type PostListSection = "needs_approval" | "upcoming" | "held" | "failed" | "published";
  export function sectionFor(p: Pick<PostRuleView, "status" | "requiresApproval" | "approvalStatus">): PostListSection | null
  ```
- Produces (server): `localToUtc(date: string, time: string, timeZone: string): Date` in `server/social/time.ts`.
- Produces (server): in `server/social/tokenRules.ts`
  ```ts
  export type RefreshDecision = "skip" | "refresh" | "expired";
  export function refreshDecision(c: { status: string; tokenExpiresAt: Date | null; tokenRefreshedAt: Date | null; createdAt: Date }, now: Date): RefreshDecision
  export function shouldWarnExpiry(c: { status: string; tokenExpiresAt: Date | null; expiryWarnedAt: Date | null }, now: Date): boolean
  ```

- [ ] **Step 1: Write the failing tests**

`shared/socialPosts.test.ts`:
```ts
const at = (iso: string) => new Date(iso);
const base = { status: "scheduled", requiresApproval: true, approvalStatus: "pending", scheduledAt: at("2026-10-27T21:00:00Z") } as const;

test("approval satisfied only when not required or approved", () => {
  assert.equal(isApprovalSatisfied({ requiresApproval: false, approvalStatus: "rejected" }), true);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "approved" }), true);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "pending" }), false);
  assert.equal(isApprovalSatisfied({ requiresApproval: true, approvalStatus: "rejected" }), false);
});

test("video or caption change resets approval to pending", () => {
  const prev = { requiresApproval: true, approvalStatus: "approved" } as const;
  assert.equal(approvalAfterEdit(prev, { videoChanged: true, captionChanged: false, requiresApproval: true }), "pending");
  assert.equal(approvalAfterEdit(prev, { videoChanged: false, captionChanged: true, requiresApproval: true }), "pending");
});

test("time-only change keeps approval", () => {
  const prev = { requiresApproval: true, approvalStatus: "approved" } as const;
  assert.equal(approvalAfterEdit(prev, { videoChanged: false, captionChanged: false, requiresApproval: true }), "approved");
});

test("switching approval off gives not_required, switching on gives pending", () => {
  assert.equal(approvalAfterEdit({ requiresApproval: true, approvalStatus: "rejected" }, { videoChanged: false, captionChanged: false, requiresApproval: false }), "not_required");
  assert.equal(approvalAfterEdit({ requiresApproval: false, approvalStatus: "not_required" }, { videoChanged: false, captionChanged: false, requiresApproval: true }), "pending");
});

test("classify: future post waits", () => {
  assert.equal(classifyScheduledPost(base, at("2026-10-27T20:59:00Z"), "connected"), "wait");
});
test("classify: due and unapproved holds, even if rejected", () => {
  assert.equal(classifyScheduledPost(base, at("2026-10-27T21:00:00Z"), "connected"), "hold");
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "rejected" }, at("2026-10-27T21:01:00Z"), "connected"), "hold");
});
test("classify: due and approved starts", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:00:30Z"), "connected"), "start");
});
test("classify: due, approved, disconnected or missing connection fails", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), "disconnected"), "fail_disconnected");
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), null), "fail_disconnected");
});
test("classify: needs_attention still tries to publish (the token may still be valid)", () => {
  assert.equal(classifyScheduledPost({ ...base, approvalStatus: "approved" }, at("2026-10-27T21:01:00Z"), "needs_attention"), "start");
});
test("classify: non-scheduled statuses always wait", () => {
  for (const s of ["held", "publishing", "published", "failed", "cancelled"] as const)
    assert.equal(classifyScheduledPost({ ...base, status: s, approvalStatus: "approved" }, at("2027-01-01T00:00:00Z"), "connected"), "wait");
});

test("caption limits", () => {
  assert.deepEqual(validateCaption("a".repeat(2200)), { ok: true });
  assert.deepEqual(validateCaption("a".repeat(2201)), { ok: false, reason: "too_long" });
  assert.deepEqual(validateCaption(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")), { ok: false, reason: "too_many_hashtags" });
  assert.deepEqual(validateCaption(Array.from({ length: 21 }, (_, i) => `@u${i}`).join(" ")), { ok: false, reason: "too_many_mentions" });
  assert.deepEqual(validateCaption("mail me at a@b.com #ok"), { ok: true });
});

test("list sections", () => {
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "pending" }), "needs_approval");
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "rejected" }), "needs_approval");
  assert.equal(sectionFor({ status: "scheduled", requiresApproval: true, approvalStatus: "approved" }), "upcoming");
  assert.equal(sectionFor({ status: "publishing", requiresApproval: false, approvalStatus: "not_required" }), "upcoming");
  assert.equal(sectionFor({ status: "held", requiresApproval: true, approvalStatus: "pending" }), "held");
  assert.equal(sectionFor({ status: "failed", requiresApproval: false, approvalStatus: "not_required" }), "failed");
  assert.equal(sectionFor({ status: "published", requiresApproval: false, approvalStatus: "not_required" }), "published");
  assert.equal(sectionFor({ status: "cancelled", requiresApproval: false, approvalStatus: "not_required" }), null);
});
```

`server/social/time.test.ts`:
```ts
test("São Paulo has no DST: 18:00 is 21:00Z", () => {
  assert.equal(localToUtc("2026-10-27", "18:00", "America/Sao_Paulo").toISOString(), "2026-10-27T21:00:00.000Z");
});
test("Amsterdam after DST ends (25 Oct 2026): 18:00 is 17:00Z", () => {
  assert.equal(localToUtc("2026-10-25", "18:00", "Europe/Amsterdam").toISOString(), "2026-10-25T17:00:00.000Z");
});
test("Amsterdam summer: 18:00 is 16:00Z", () => {
  assert.equal(localToUtc("2026-07-01", "18:00", "Europe/Amsterdam").toISOString(), "2026-07-01T16:00:00.000Z");
});
test("rejects malformed input", () => {
  assert.throws(() => localToUtc("2026-13-01", "18:00", "Europe/Amsterdam"));
  assert.throws(() => localToUtc("2026-10-01", "25:00", "Europe/Amsterdam"));
  assert.throws(() => localToUtc("2026-10-01", "18:00", "Not/AZone"));
});
```

`server/social/tokenRules.test.ts`:
```ts
const now = new Date("2026-10-19T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
test("refresh when expiring within 20 days and at least 24h old", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(19), tokenRefreshedAt: days(-41), createdAt: days(-41) }, now), "refresh");
});
test("skip when more than 20 days left", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(21), tokenRefreshedAt: days(-39), createdAt: days(-39) }, now), "skip");
});
test("skip when token younger than 24h", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(10), tokenRefreshedAt: new Date(now.getTime() - 3_600_000), createdAt: days(-50) }, now), "skip");
});
test("expired token is expired", () => {
  assert.equal(refreshDecision({ status: "connected", tokenExpiresAt: days(-1), tokenRefreshedAt: days(-61), createdAt: days(-61) }, now), "expired");
});
test("disconnected is skipped", () => {
  assert.equal(refreshDecision({ status: "disconnected", tokenExpiresAt: days(5), tokenRefreshedAt: days(-55), createdAt: days(-55) }, now), "skip");
});
test("warn within 7 days, at most once a day", () => {
  assert.equal(shouldWarnExpiry({ status: "needs_attention", tokenExpiresAt: days(6), expiryWarnedAt: null }, now), true);
  assert.equal(shouldWarnExpiry({ status: "needs_attention", tokenExpiresAt: days(6), expiryWarnedAt: new Date(now.getTime() - 3_600_000) }, now), false);
  assert.equal(shouldWarnExpiry({ status: "connected", tokenExpiresAt: days(8), expiryWarnedAt: null }, now), false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test shared/socialPosts.test.ts server/social/time.test.ts server/social/tokenRules.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three modules** with the signatures above. Notes:
  - Hashtags: count `/(^|\s)#[\p{L}\p{N}_]+/gu`. Mentions: count `/(^|\s)@[\w.]+/g` (so `a@b.com` is not a mention).
  - `localToUtc`: no library. Validate with regexes and `Intl.DateTimeFormat(undefined, { timeZone })` (throws on bad zone). Take the wall time as if UTC, compute the zone offset at that instant from `formatToParts`, subtract, then recompute the offset at the result and correct once (handles DST edges).
  - Refresh window 20 days; minimum token age 24 h (age from `tokenRefreshedAt ?? createdAt`); warning window 7 days, repeat after 24 h.

- [ ] **Step 4: Run to verify they pass**

Run: `node --import tsx --test shared/socialPosts.test.ts server/social/time.test.ts server/social/tokenRules.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/socialPosts.ts shared/socialPosts.test.ts server/social/time.ts server/social/time.test.ts server/social/tokenRules.ts server/social/tokenRules.test.ts
git commit -m "feat(social): approval, scheduling, caption and token rules"
```

---

### Task 3: Instagram Graph client and signed requests

**Files:**
- Create: `server/social/instagramApi.ts`, `server/social/instagramApi.test.ts`
- Create: `server/social/signedRequest.ts`, `server/social/signedRequest.test.ts`

**Interfaces:**
- Produces, in `instagramApi.ts`:
  ```ts
  export interface IgDeps { fetch: typeof fetch; appId: string; appSecret: string; redirectUri: string }
  export function defaultIgDeps(): IgDeps   // env INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET, redirectUri = IG_REDIRECT_URI
  export const IG_REDIRECT_URI: string       // exact redirect from Global Constraints
  export const IG_SCOPES: readonly string[]  // exact five, in order
  export class IgApiError extends Error { constructor(message: string, public code?: number, public kind?: "not_professional" | "http") }
  export function stripCodeSuffix(code: string): string
  export function buildAuthorizeUrl(state: string, deps: IgDeps): string
  export interface IgConnectResult { externalUserId: string; username: string; accountType: string; profilePictureUrl: string | null; accessToken: string; expiresAt: Date; scopes: string[] }
  export async function connectWithCode(code: string, deps: IgDeps, now?: Date): Promise<IgConnectResult>
  export async function refreshLongLivedToken(token: string, deps: IgDeps, now?: Date): Promise<{ accessToken: string; expiresAt: Date }>
  export async function createReelContainer(igUserId: string, token: string, input: { videoUrl: string; caption: string; shareToFeed: boolean; isAiGenerated: boolean }, deps: IgDeps): Promise<string>
  export async function getContainerStatus(containerId: string, token: string, deps: IgDeps): Promise<{ code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED"; message: string | null }>
  export async function publishContainer(igUserId: string, token: string, containerId: string, deps: IgDeps): Promise<string>
  export async function getPermalink(mediaId: string, token: string, deps: IgDeps): Promise<string | null>
  export async function getPublishingQuotaLeft(igUserId: string, token: string, deps: IgDeps): Promise<number | null>
  ```
- Produces, in `signedRequest.ts`: `export function parseSignedRequest(signed: string, appSecret: string): Record<string, unknown> & { user_id?: string } | null`

- [ ] **Step 1: Write the failing tests.** Use a recording fake: `fakeFetch(routes: Array<[RegExp, object, number?]>)` returns the first matching JSON response and pushes `{ url, init }` onto a `calls` array.

`instagramApi.test.ts`:
```ts
test("stripCodeSuffix removes trailing #_", () => {
  assert.equal(stripCodeSuffix("abc#_"), "abc");
  assert.equal(stripCodeSuffix("abc"), "abc");
});

test("authorize URL carries client id, exact redirect, five scopes, state, no FB login", () => {
  const u = new URL(buildAuthorizeUrl("st8", { ...deps }));
  assert.equal(u.origin + u.pathname, "https://www.instagram.com/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "123");
  assert.equal(u.searchParams.get("redirect_uri"), "https://app.leadawaker.com/api/social/oauth/instagram/callback");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("scope"), "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights");
  assert.equal(u.searchParams.get("state"), "st8");
  assert.equal(u.searchParams.get("enable_fb_login"), "false");
});

test("connectWithCode: code -> short token -> long token -> profile", async () => {
  // routes: POST api.instagram.com/oauth/access_token -> { access_token: "short", user_id: 42, permissions: [...5 scopes] }
  //         GET graph.instagram.com/.../access_token?grant_type=ig_exchange_token -> { access_token: "long", expires_in: 5184000 }
  //         GET graph.instagram.com/.../me?fields=user_id,username,account_type,profile_picture_url -> { user_id: "1784", username: "dr.augusto", account_type: "MEDIA_CREATOR", profile_picture_url: "https://x/p.jpg" }
  const r = await connectWithCode("abc#_", deps, new Date("2026-10-19T00:00:00Z"));
  assert.equal(r.accessToken, "long");
  assert.equal(r.externalUserId, "1784");
  assert.equal(r.username, "dr.augusto");
  assert.equal(r.expiresAt.toISOString(), "2026-12-18T00:00:00.000Z");
  assert.equal(r.scopes.length, 5);
  assert.match(String(calls[0].init?.body), /code=abc(&|$)/);  // suffix stripped, form-encoded, includes client_secret and redirect_uri
});

test("connectWithCode rejects non-professional accounts", async () => {
  // same routes but account_type: "PERSONAL"
  await assert.rejects(connectWithCode("abc", deps2), (e: any) => e instanceof IgApiError && e.kind === "not_professional");
});

test("Graph error body becomes IgApiError with message and code", async () => {
  // POST /media -> 400 { error: { message: "Invalid video", code: 9004 } }
  await assert.rejects(createReelContainer("1784", "t", { videoUrl: "https://m/v.mp4", caption: "c", shareToFeed: true, isAiGenerated: true }, deps3),
    (e: any) => e instanceof IgApiError && e.code === 9004 && /Invalid video/.test(e.message));
});

test("createReelContainer posts REELS with video_url, caption, share_to_feed and AI label", async () => {
  // POST /1784/media -> { id: "c1" }
  const id = await createReelContainer("1784", "t", { videoUrl: "https://m/v.mp4", caption: "olá", shareToFeed: true, isAiGenerated: true }, deps4);
  assert.equal(id, "c1");
  const body = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(body.get("media_type"), "REELS");
  assert.equal(body.get("video_url"), "https://m/v.mp4");
  assert.equal(body.get("caption"), "olá");
  assert.equal(body.get("share_to_feed"), "true");
  assert.equal(body.get(AI_LABEL_PARAM), "true");
});

test("getContainerStatus maps status_code and status message", async () => {
  // GET /c1?fields=status_code,status -> { status_code: "ERROR", status: "Error: video too long" }
  assert.deepEqual(await getContainerStatus("c1", "t", deps5), { code: "ERROR", message: "Error: video too long" });
});

test("refreshLongLivedToken uses ig_refresh_token", async () => {
  const r = await refreshLongLivedToken("old", deps6, new Date("2026-10-19T00:00:00Z"));
  assert.match(calls[0].url, /refresh_access_token\?grant_type=ig_refresh_token&access_token=old/);
  assert.equal(r.accessToken, "new");
});
```

`signedRequest.test.ts`:
```ts
import { createHmac } from "node:crypto";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
function make(payload: object, secret: string) {
  const p = b64url(JSON.stringify(payload));
  return `${b64url(createHmac("sha256", secret).update(p).digest())}.${p}`;
}
test("valid signed request returns payload", () => {
  assert.equal(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "1784" }, "s3cret"), "s3cret")?.user_id, "1784");
});
test("wrong secret, tampered payload or garbage returns null", () => {
  const good = make({ algorithm: "HMAC-SHA256", user_id: "1784" }, "s3cret");
  assert.equal(parseSignedRequest(good, "other"), null);
  assert.equal(parseSignedRequest(good.split(".")[0] + "." + b64url('{"user_id":"9"}'), "s3cret"), null);
  assert.equal(parseSignedRequest("nope", "s3cret"), null);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test server/social/instagramApi.test.ts server/social/signedRequest.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement.** Notes:
  - One constant `IG_GRAPH` = `https://graph.instagram.com/<version>`, taking the version from the URL examples on Meta's content-publishing reference page at build time. One constant `AI_LABEL_PARAM = "is_ai_generated"`, exported; confirm the field name in the IG User Media reference and change only the constant if it differs.
  - Code exchange is `POST https://api.instagram.com/oauth/access_token`, form body `client_id, client_secret, grant_type=authorization_code, redirect_uri, code`. Long-lived: `GET {IG_GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…`. `expiresAt = now + expires_in seconds`.
  - Professional means `account_type` is `BUSINESS` or `MEDIA_CREATOR`.
  - All POSTs to Graph are `application/x-www-form-urlencoded` with `access_token` in the body; GETs put it in the query. 20 s timeout via `AbortSignal.timeout(20_000)`. Non-2xx or `{ error }` throws `IgApiError(error.message, error.code, "http")`. Never include the token in error messages.
  - `parseSignedRequest`: split on the first `.`, HMAC-SHA256 the payload segment with the secret, compare with `timingSafeEqual` (length check first), JSON-parse base64url payload; any failure returns null.

- [ ] **Step 4: Run to verify they pass**

Run: `node --import tsx --test server/social/instagramApi.test.ts server/social/signedRequest.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/social/instagramApi.ts server/social/instagramApi.test.ts server/social/signedRequest.ts server/social/signedRequest.test.ts
git commit -m "feat(social): Instagram Graph client and signed request parsing"
```

---

### Task 4: Video handling (streamed upload, faststart, probe, spec check)

**Files:**
- Create: `server/social/media.ts`, `server/social/media.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SOCIAL_UPLOAD_DIR: string            // path.resolve("uploads/social")
  export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
  export async function streamToFileWithLimit(src: NodeJS.ReadableStream, destPath: string, maxBytes: number): Promise<number>  // bytes written; rejects Error("too_large") and deletes partial file; deletes partial file on any stream error
  export interface ProbeResult { formatName: string; videoCodec: string | null; audioCodec: string | null; audioSampleRate: number | null; durationS: number; width: number; height: number; fps: number }
  export async function probeVideo(path: string): Promise<ProbeResult>
  export async function remuxFaststart(path: string): Promise<void>     // ffmpeg -c copy -movflags +faststart into a temp file, then rename over the original
  export type ReelSpecReason = "format" | "video_codec" | "audio_codec" | "audio_rate" | "duration_short" | "duration_long" | "fps" | "width" | "size";
  export function checkReelSpecs(p: ProbeResult, bytes: number): { ok: true } | { ok: false; reason: ReelSpecReason }
  export function videoPathFor(accountId: number, publicId: string, ext: "mp4" | "mov"): string   // SOCIAL_UPLOAD_DIR/<accountId>/<publicId>.<ext>
  ```

- [ ] **Step 1: Write the failing tests**

```ts
const good: ProbeResult = { formatName: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", audioCodec: "aac", audioSampleRate: 44100, durationS: 58, width: 1080, height: 1920, fps: 30 };

test("spec check accepts a HeyGen-like 9:16 video", () => assert.deepEqual(checkReelSpecs(good, 40e6), { ok: true }));
test("spec check accepts hevc and no audio", () => assert.deepEqual(checkReelSpecs({ ...good, videoCodec: "hevc", audioCodec: null, audioSampleRate: null }, 1e6), { ok: true }));
test("spec check reasons", () => {
  assert.deepEqual(checkReelSpecs({ ...good, formatName: "matroska,webm" }, 1e6), { ok: false, reason: "format" });
  assert.deepEqual(checkReelSpecs({ ...good, videoCodec: "vp9" }, 1e6), { ok: false, reason: "video_codec" });
  assert.deepEqual(checkReelSpecs({ ...good, audioCodec: "opus" }, 1e6), { ok: false, reason: "audio_codec" });
  assert.deepEqual(checkReelSpecs({ ...good, audioSampleRate: 96000 }, 1e6), { ok: false, reason: "audio_rate" });
  assert.deepEqual(checkReelSpecs({ ...good, durationS: 2.9 }, 1e6), { ok: false, reason: "duration_short" });
  assert.deepEqual(checkReelSpecs({ ...good, durationS: 900.1 }, 1e6), { ok: false, reason: "duration_long" });
  assert.deepEqual(checkReelSpecs({ ...good, fps: 15 }, 1e6), { ok: false, reason: "fps" });
  assert.deepEqual(checkReelSpecs({ ...good, width: 2160 }, 1e6), { ok: false, reason: "width" });
  assert.deepEqual(checkReelSpecs(good, MAX_UPLOAD_BYTES + 1), { ok: false, reason: "size" });
});

test("streamToFileWithLimit writes under the limit", async () => {
  const dest = join(tmp, "ok.bin");
  assert.equal(await streamToFileWithLimit(Readable.from([Buffer.alloc(1000)]), dest, 2000), 1000);
  assert.equal(statSync(dest).size, 1000);
});
test("streamToFileWithLimit rejects over the limit and leaves no file", async () => {
  const dest = join(tmp, "big.bin");
  await assert.rejects(streamToFileWithLimit(Readable.from([Buffer.alloc(1500), Buffer.alloc(1500)]), dest, 2000), /too_large/);
  assert.equal(existsSync(dest), false);
});
test("streamToFileWithLimit cleans up on a broken stream", async () => {
  const dest = join(tmp, "broken.bin");
  const src = new Readable({ read() { this.push(Buffer.alloc(100)); this.destroy(new Error("aborted")); } });
  await assert.rejects(streamToFileWithLimit(src, dest, 2000));
  assert.equal(existsSync(dest), false);
});

test("probe + faststart on a real 4 s clip", async () => {
  const f = join(tmp, "clip.mp4");
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=108x192:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "4", "-c:v", "libx264", "-c:a", "aac", f], { stdio: "ignore" });
  await remuxFaststart(f);
  const p = await probeVideo(f);
  assert.equal(p.videoCodec, "h264");
  assert.equal(p.audioCodec, "aac");
  assert.equal(p.width, 108);
  assert.equal(p.height, 192);
  assert.equal(Math.round(p.fps), 30);
  assert.ok(p.durationS > 3.9 && p.durationS < 4.2);
});
```
(`tmp` from `mkdtempSync(join(tmpdir(), "social-media-"))`.)

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test server/social/media.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** `probeVideo` runs `ffprobe -v error -print_format json -show_format -show_streams <path>` via `execFile` and parses the first video and audio stream; fps from `avg_frame_rate` ("30/1"). Format is accepted when `formatName` contains `mp4` or `mov`. `remuxFaststart` always runs (cheap, no re-encode) so the moov atom is at the front.

- [ ] **Step 4: Run to verify they pass**

Run: `node --import tsx --test server/social/media.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/social/media.ts server/social/media.test.ts
git commit -m "feat(social): streamed video upload, faststart and Reel spec checks"
```

---

### Task 5: Connection storage, permissions and connect routes

**Files:**
- Create: `server/storage/social.ts` (connection methods now; post methods added in Task 6)
- Modify: `server/storage.ts` (import and spread `socialStorage` in `export const storage = {...}` at :87-121)
- Modify: `server/oauthState.ts` (carry a return origin)
- Create: `server/social/access.ts`, `server/social/access.test.ts`
- Create: `server/social/notify.ts`
- Create: `server/routes/social.ts`
- Modify: `server/routes/index.ts` (import and call `registerSocialRoutes(app)` in the list at :82-117)

**Interfaces:**
- Consumes: Task 1 tables, Task 3 `defaultIgDeps`, `buildAuthorizeUrl`, `connectWithCode`, `parseSignedRequest`, `IgApiError`; `seal`/`open`; `accountIdFor`, `wrapAsync`, `requireAuth`, `requireAgency`.
- Produces:
  ```ts
  // server/oauthState.ts (existing signatures keep working)
  export function createOAuthState(req: Request, flow: string, accountId: number, returnOrigin?: string): string
  export function consumeOAuthStateEntry(req: Request, flow: string, returnedState: unknown): { accountId: number; returnOrigin: string | null } | null
  // server/social/access.ts
  export const SOCIAL_RETURN_ORIGINS = ["https://leadawaker.com", "https://app.leadawaker.com"] as const;
  export function resolveReturnOrigin(candidate: string | undefined | null, fallback: string): string
  export function canManageSocial(user: { role: string; accountsId: number | null } | undefined, accountId: number): boolean
  export function isAgency(user: { role: string; accountsId: number | null } | undefined): boolean
  // server/social/notify.ts
  export type SocialNotifType = "social_post_needs_approval" | "social_post_held" | "social_post_failed" | "social_post_published" | "social_post_rejected" | "social_token_problem";
  export async function notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void>
  export async function notifyAccountManagers(accountId: number, n: { type: SocialNotifType; key: "needs_approval" | "published"; vars: Record<string, string>; link: string }): Promise<void>
  // server/storage/social.ts
  export const socialStorage = {
    getSocialConnection(accountId: number): Promise<SocialConnection | null>,
    getSocialConnectionByExternalId(externalUserId: string): Promise<SocialConnection | null>,
    upsertSocialConnection(accountId: number, fields: { externalUserId; username; accountType; profilePictureUrl; accessToken: string; expiresAt: Date; scopes: string[]; connectedByUserId: number | null }): Promise<SocialConnection>,  // seals token, status connected, clears last_error
    setSocialConnectionStatus(id: number, status: "connected" | "needs_attention" | "disconnected", lastError: string | null): Promise<void>,
    disconnectSocialConnection(accountId: number): Promise<void>,   // access_token_enc = null, status disconnected
    deleteSocialConnection(accountId: number): Promise<void>,
    getSocialAccessToken(conn: SocialConnection): string | null,    // open()
    updateSocialToken(id: number, accessToken: string, expiresAt: Date): Promise<void>,
    markSocialExpiryWarned(id: number, at: Date): Promise<void>,
    listSocialConnectionsForRefresh(): Promise<SocialConnection[]>,  // status <> 'disconnected'
    deleteUnpublishedSocialPosts(accountId: number): Promise<SocialPost[]>,  // DELETE … WHERE accounts_id = $1 AND status <> 'published' RETURNING *; used by data deletion to remove the files too
    setSocialEnabled(accountId: number, enabled: boolean): Promise<void>,
    getSocialEnabled(accountId: number): Promise<boolean>,
  }
  ```
- Routes (all `wrapAsync`; account routes use `accountIdFor(req, res)` from `:id`, then `canManageSocial` or `isAgency`):
  - `GET /api/social/accounts/:id/status` (requireAuth, any user of the account or agency) returns `{ enabled: boolean, connection: null | { status, username, profilePictureUrl, accountType, tokenExpiresAt, lastError, scopes } }`. Never the token.
  - `PUT /api/social/accounts/:id/enabled` (requireAuth, requireAgency) body `{ enabled: boolean }`.
  - `GET /api/social/accounts/:id/instagram/authorize?origin=<frontend origin>` (requireAuth, `canManageSocial`): `createOAuthState(req, "social:instagram", id, resolveReturnOrigin(origin, process.env.FRONTEND_URL!))`, `saveSessionThen(req, () => res.redirect(buildAuthorizeUrl(state, defaultIgDeps())))`.
  - `GET /api/social/oauth/instagram/callback` (no auth): `consumeOAuthStateEntry`; on `error`, missing code, bad state, `IgApiError` kind `not_professional`, or `getSocialConnectionByExternalId` returning a row for a different account, redirect to `${returnOrigin}/platform/accounts?instagram=error&reason=<access_denied|missing_code|invalid_state|not_professional|already_connected|failed>`; on success `upsertSocialConnection` then `?instagram=connected`.
  - `DELETE /api/social/accounts/:id/connection` (requireAuth, `canManageSocial`): `disconnectSocialConnection`.
  - `POST /api/social/instagram/deauthorize` (no auth, urlencoded `signed_request`): parse with `INSTAGRAM_APP_SECRET`; on null 400; else find by `user_id` and disconnect; 200.
  - `POST /api/social/instagram/data-deletion` (no auth): parse; delete the connection and, for that account, every post with status not `published`, plus their files; respond `{ url: "https://app.leadawaker.com/social/data-deletion/<code>", confirmation_code: <code> }` where code is a random hex id, logged with the account id via `console.log`.
  - `GET /social/data-deletion/:code` (no auth): plain HTML page saying the Instagram data for that request has been deleted, showing the code.

- [ ] **Step 1: Write the failing tests** (`server/social/access.test.ts`)

```ts
test("agency can manage any account", () => {
  assert.equal(canManageSocial({ role: "Owner", accountsId: 1 }, 77), true);
  assert.equal(canManageSocial({ role: "Admin", accountsId: 1 }, 77), true);
});
test("Manager only on own account; Viewer never", () => {
  assert.equal(canManageSocial({ role: "Manager", accountsId: 77 }, 77), true);
  assert.equal(canManageSocial({ role: "Manager", accountsId: 77 }, 78), false);
  assert.equal(canManageSocial({ role: "Viewer", accountsId: 77 }, 77), false);
  assert.equal(canManageSocial(undefined, 77), false);
});
test("return origin is allowlisted", () => {
  assert.equal(resolveReturnOrigin("https://leadawaker.com", "https://app.leadawaker.com"), "https://leadawaker.com");
  assert.equal(resolveReturnOrigin("https://evil.example", "https://app.leadawaker.com"), "https://app.leadawaker.com");
  assert.equal(resolveReturnOrigin(undefined, "https://app.leadawaker.com"), "https://app.leadawaker.com");
});
```
`isAgency` mirrors `server/auth.ts` (`accountsId === 1` or role Owner/Admin).

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test server/social/access.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `access.ts`, extend `oauthState.ts`** (add optional `returnOrigin` to `PendingOAuthState`; `consumeOAuthState` delegates to `consumeOAuthStateEntry` and returns only `accountId`), **write `server/storage/social.ts`** (pattern: `server/storage/whatsappSenders.ts`, `db` from `../db`), and add it to the `storage` barrel.

- [ ] **Step 4: Implement `notify.ts`.** Agency recipients: `(await storage.getAppUsers()).filter(u => u.accountsId === 1)` (pattern: `numberRequests.ts:205-215`). Manager recipients: users with `accountsId === accountId && role === "Manager"`. Each call goes through `createAndDispatchNotification({ type, title, body, userId, accountId, read: false, link })` with `.catch(console.error)`. Client-facing copy (`needs_approval`, `published`) comes from a small `{ en, nl, pt }` map keyed by the account's `language` (default `en`), e.g. pt needs_approval: title "Novo vídeo para aprovar", body "\"{caption}\" está agendado para {when}. Toque para ver e aprovar." Agency copy is English.

- [ ] **Step 5: Implement the routes** in `server/routes/social.ts` (`export function registerSocialRoutes(app: Express): void`) and register them in `server/routes/index.ts`. The deauthorize and data-deletion routes need `express.urlencoded`, which is already global.

- [ ] **Step 6: Run the tests, then smoke-test the routes**

Run: `node --import tsx --test server/social/access.test.ts` (PASS), then `pm2 restart leadawaker`, then:
- `curl -s -o /dev/null -w "%{http_code}" https://app.leadawaker.com/api/social/accounts/1/status` → `401`
- `curl -s -X POST -d "signed_request=garbage" -o /dev/null -w "%{http_code}" https://app.leadawaker.com/api/social/instagram/deauthorize` → `400`
- `curl -s "https://app.leadawaker.com/api/social/oauth/instagram/callback?code=x&state=bad" -o /dev/null -w "%{redirect_url}"` → ends with `/platform/accounts?instagram=error&reason=invalid_state`

- [ ] **Step 7: Commit**

```bash
git add server/storage/social.ts server/storage.ts server/oauthState.ts server/social/access.ts server/social/access.test.ts server/social/notify.ts server/routes/social.ts server/routes/index.ts
git commit -m "feat(social): Instagram connect flow, Meta callbacks and per-account switch"
```

---

### Task 6: Uploads, public media route and post routes

**Files:**
- Modify: `server/storage/social.ts` (post methods)
- Create: `server/social/postService.ts`, `server/social/postService.test.ts`
- Modify: `server/routes/social.ts` (upload, media, post routes)

**Interfaces:**
- Consumes: Task 2 rules, Task 4 media helpers, Task 5 access/notify/storage.
- Produces (storage):
  ```ts
  listSocialPosts(accountId: number): Promise<SocialPost[]>                       // excludes cancelled, newest scheduled first
  getSocialPost(accountId: number, postId: number): Promise<SocialPost | null>   // always filters by both
  getSocialPostByPublicId(publicId: string): Promise<SocialPost | null>
  insertSocialPost(row: InsertSocialPost): Promise<SocialPost>
  updateSocialPostIf(postId: number, allowedStatuses: SocialPostStatus[], fields: Partial<InsertSocialPost>): Promise<SocialPost | null>  // UPDATE … WHERE id = $1 AND status IN (…) RETURNING *; null when nothing matched
  ```
- Produces (service, pure input to storage): in `postService.ts`
  ```ts
  export interface PostEditInput { uploadId?: string; caption?: string; date?: string; time?: string; shareToFeed?: boolean; isAiGenerated?: boolean; requiresApproval?: boolean }
  export function planPostEdit(post: SocialPost, input: PostEditInput, ctx: { timeZone: string; now: Date; userId: number; newVideo?: { path: string; ext: string; durationS: number; width: number; height: number; bytes: number } }):
    { ok: true; fields: Partial<InsertSocialPost>; notifyManagers: boolean } | { ok: false; status: 409 | 422; reason: string }
  ```
  Rules: only `scheduled` or `held` posts are editable (else 409 `not_editable`); caption through `validateCaption` (422 with its reason); new `date`/`time` through `localToUtc`, must be in the future (422 `in_past`); a held post with a new future time becomes `scheduled`; `approvalStatus` from `approvalAfterEdit`; switching approval off sets `approvalWaivedByUserId`/`approvalWaivedAt`; `approvalReminderSentAt` cleared when approval goes back to pending; `notifyManagers` true when the result is `pending` and was not pending before, or the video/caption changed while approval is required.
- Routes (all under `/api/social/accounts/:id`, requireAuth + `accountIdFor`; account must be `social_enabled` except for agency):
  - `POST /uploads` (agency): `Content-Type` must be `video/mp4` or `video/quicktime` (415 otherwise); `Content-Length` over `MAX_UPLOAD_BYTES` → 413 before reading; stream with `streamToFileWithLimit` to `videoPathFor(id, randomUUID(), ext)`; `remuxFaststart`; `probeVideo`; `checkReelSpecs` (on failure delete file, 422 `{ reason }`). Responds `{ uploadId, ext, durationS, width, height, bytes }`.
  - `GET /posts` (any user of the account or agency): returns `SocialPostView[]` (the client type in Task 9): `{ id, section, status, approvalStatus, requiresApproval, caption, scheduledAt (ISO string), videoUrl, durationS, permalink, lastError, approvalNote, approvedByName, waivedByName, shareToFeed, isAiGenerated }`. `section` from `sectionFor`; `videoUrl` is the path `/media/social/<publicId>.<ext>` (the client prefixes `API_BASE`); `approvedByName` / `waivedByName` are the users' display names looked up from `approvedByUserId` / `approvalWaivedByUserId` (null when unset). Never file paths.
  - `POST /posts` (agency): body `{ uploadId, caption, date, time, shareToFeed, isAiGenerated, requiresApproval }`; the upload file must exist under that account's dir; requires a connection whose status is not `disconnected` (409 `not_connected`); same caption/time checks as `planPostEdit`; `videoPublicId = uploadId`; `approvalStatus` `pending` or `not_required`; notify Managers when pending.
  - `PATCH /posts/:postId` (agency): `planPostEdit`, then `updateSocialPostIf(postId, ["scheduled", "held"], fields)`; null → 409 `not_editable`. If the video changed, delete the old file after the update succeeds.
  - `POST /posts/:postId/approve` (`canManageSocial`): allowed when status is `scheduled` or `held` and approval is `pending` or `rejected`; sets `approved`, `approvedByUserId`, `approvedAt`.
  - `POST /posts/:postId/reject` (`canManageSocial`) body `{ note }`: allowed when status is `scheduled` and approval is `pending` or `approved`; sets `rejected` and `approvalNote`; notify agency.
  - `POST /posts/:postId/retry` (agency): only `failed`; sets `scheduled`, `scheduledAt = now`, clears `igContainerId`, `publishingStartedAt`, `lastError`, increments `attempts`.
  - `DELETE /posts/:postId` (agency): `updateSocialPostIf(postId, ["scheduled", "held", "failed"], { status: "cancelled" })`, then delete the file.
- Public route: `GET /media/social/:file` (no auth). `:file` must match `/^([0-9a-f-]{36})\.(mp4|mov)$/` (else 404); post found by public id and not `cancelled`; `res.sendFile` (supports range requests) with `Content-Type` `video/mp4` or `video/quicktime`; `Cache-Control: public, max-age=3600`.

- [ ] **Step 1: Write the failing tests** (`postService.test.ts`), building a `SocialPost` fixture with `status: "scheduled"`, `requiresApproval: true`, `approvalStatus: "approved"`, `caption: "old"`, `scheduledAt: 2026-10-27T21:00:00Z`; `ctx = { timeZone: "America/Sao_Paulo", now: new Date("2026-10-20T12:00:00Z"), userId: 5 }`.

```ts
test("publishing post is not editable", () => {
  assert.deepEqual(planPostEdit({ ...post, status: "publishing" }, { caption: "new" }, ctx), { ok: false, status: 409, reason: "not_editable" });
});
test("caption change resets approval and notifies", () => {
  const r = planPostEdit(post, { caption: "new" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "pending"); assert.equal(r.notifyManagers, true);
});
test("time change keeps approval, converts with the account zone", () => {
  const r = planPostEdit(post, { date: "2026-10-28", time: "09:30" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "approved");
  assert.equal(r.fields.scheduledAt!.toISOString(), "2026-10-28T12:30:00.000Z"); assert.equal(r.notifyManagers, false);
});
test("past time is refused", () => {
  assert.deepEqual(planPostEdit(post, { date: "2026-10-19", time: "09:00" }, ctx), { ok: false, status: 422, reason: "in_past" });
});
test("held post with a new time is scheduled again but still needs approval", () => {
  const r = planPostEdit({ ...post, status: "held", approvalStatus: "pending" }, { date: "2026-10-30", time: "18:00" }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.status, "scheduled"); assert.equal(r.fields.approvalStatus ?? "pending", "pending");
});
test("waiving approval records who and when", () => {
  const r = planPostEdit({ ...post, approvalStatus: "rejected" }, { requiresApproval: false }, ctx);
  assert.ok(r.ok); assert.equal(r.fields.approvalStatus, "not_required");
  assert.equal(r.fields.approvalWaivedByUserId, 5); assert.ok(r.fields.approvalWaivedAt instanceof Date);
});
test("caption over limits is refused at save time", () => {
  assert.deepEqual(planPostEdit(post, { caption: "a".repeat(2201) }, ctx), { ok: false, status: 422, reason: "too_long" });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test server/social/postService.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `planPostEdit`, the storage methods, and the routes above.** The Review Focus race is covered by `updateSocialPostIf` (conditional `WHERE status IN`), which the route must use for every edit, cancel and approval write.

- [ ] **Step 4: Run tests and smoke-test**

Run: `node --import tsx --test server/social/postService.test.ts` (PASS). Then `pm2 restart leadawaker` and, logged in as agency in a browser session or with the session cookie:
- Upload the Task 4 test clip to an agency test account with social enabled: `curl -b cookie.txt -H "Content-Type: video/mp4" --data-binary @clip.mp4 https://app.leadawaker.com/api/social/accounts/<id>/uploads` → JSON with `uploadId`.
- `curl -s -o /dev/null -w "%{http_code}" https://app.leadawaker.com/media/social/<uploadId>.mp4` → `404` (no post yet), and `200` after creating a post with it.
- `curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: video/webm" --data-binary @clip.mp4 …/uploads` → `415`.

- [ ] **Step 5: Commit**

```bash
git add server/storage/social.ts server/social/postService.ts server/social/postService.test.ts server/routes/social.ts
git commit -m "feat(social): video upload, public media links and post scheduling routes"
```

---

### Task 7: Publisher and token refresher pollers

**Files:**
- Create: `server/social/publisher.ts`, `server/social/publisher.test.ts`
- Create: `server/social/tokenRefresher.ts`
- Modify: `server/storage/social.ts` (`listDueSocialPosts(now)`, `listPublishingSocialPosts()`, `listPostsNeedingReminder(now)`), `server/routes/index.ts` (start both pollers next to `startPublicDemoPoller()` at :133)

**Interfaces:**
- Consumes: Task 2 `classifyScheduledPost`, `refreshDecision`, `shouldWarnExpiry`; Task 3 Graph calls; Task 5 storage/notify; Task 6 `updateSocialPostIf`.
- Produces:
  ```ts
  export interface PublisherDeps {
    now(): Date;
    listDue(now: Date): Promise<SocialPost[]>;            // status scheduled AND scheduled_at <= now
    listPublishing(): Promise<SocialPost[]>;
    listNeedingReminder(now: Date): Promise<SocialPost[]>; // scheduled, approval pending, scheduled_at within 24h, reminder not sent
    getConnection(accountId: number): Promise<{ status: string; externalUserId: string; token: string | null } | null>;
    updateIf: typeof storage.updateSocialPostIf;
    ig: { createReelContainer; getContainerStatus; publishContainer; getPermalink; getPublishingQuotaLeft };  // bound to deps
    mediaUrl(publicId: string, ext: string): string;       // `${SOCIAL_MEDIA_BASE_URL}/media/social/${publicId}.${ext}`
    notifyAgency: typeof notifyAgency;
    notifyAccountManagers: typeof notifyAccountManagers;
  }
  export async function runPublishOnce(deps: PublisherDeps): Promise<void>
  export function startSocialPublisher(): void   // 60 s interval, first run after 30 s, running guard (pattern: reviews/poller.ts)
  export function startSocialTokenRefresher(): void   // every 6 h, first run after 60 s; does the daily work when due
  ```
- `runPublishOnce` order per tick:
  1. Due posts: `classifyScheduledPost`. `hold` → `updateIf(id, ["scheduled"], { status: "held" })` and notify agency. `fail_disconnected` → `failed`, `lastError: "Instagram disconnected"`, notify agency. `start` → quota check (0 → leave scheduled, try next tick); `createReelContainer`; `updateIf(id, ["scheduled"], { status: "publishing", igContainerId, publishingStartedAt: now })`. Container errors → `failed` with the Graph message.
  2. Publishing posts: `getContainerStatus`. `FINISHED` → `publishContainer` then immediately `updateIf(id, ["publishing"], { status: "published", igMediaId, publishedAt })`, then `getPermalink` and store it, notify agency and Managers. `PUBLISHED` (already published, e.g. a restart between publish and save) → mark `published` without publishing again. `ERROR`/`EXPIRED`, or `IN_PROGRESS` 15 minutes after `publishingStartedAt` → `failed` with the message.
  3. Reminders: notify Managers once, set `approvalReminderSentAt`.
  Every post is in its own try/catch; one failure never stops the tick.
- Token refresher (daily work): for each connection, `refreshDecision`: `refresh` → `refreshLongLivedToken`, `updateSocialToken`, status `connected`; on error `needs_attention` + `last_error`, notify agency. `expired` → `needs_attention`, "Token expired, reconnect needed". Then `shouldWarnExpiry` → notify agency and `markSocialExpiryWarned`. Then delete files under `SOCIAL_UPLOAD_DIR` older than 24 h whose public id has no post.

- [ ] **Step 1: Write the failing tests** (`publisher.test.ts`) with an in-memory fake deps object (posts in an array, `updateIf` honouring `allowedStatuses`, fake `ig` recording calls, notify recorders).

```ts
test("due unapproved post is held and agency notified", async () => { /* one scheduled, pending, due */ 
  await runPublishOnce(d); assert.equal(posts[0].status, "held"); assert.equal(agencyNotes[0].type, "social_post_held"); assert.equal(ig.calls.length, 0);
});
test("due approved post creates a container with the public media URL", async () => {
  await runPublishOnce(d);
  assert.equal(posts[0].status, "publishing"); assert.equal(posts[0].igContainerId, "c1");
  assert.equal(ig.created[0].videoUrl, "https://app.leadawaker.com/media/social/0b9f1c1e-0000-4000-8000-000000000001.mp4");
});
test("finished container publishes once and stores media id", async () => {
  await runPublishOnce(d);
  assert.equal(posts[0].status, "published"); assert.equal(posts[0].igMediaId, "m1"); assert.equal(ig.publishCalls, 1);
});
test("restart case: container already PUBLISHED is marked published without publishing again", async () => {
  await runPublishOnce(d); assert.equal(posts[0].status, "published"); assert.equal(ig.publishCalls, 0);
});
test("container ERROR fails the post with Meta's message", async () => {
  await runPublishOnce(d); assert.equal(posts[0].status, "failed"); assert.match(posts[0].lastError!, /video too long/);
});
test("IN_PROGRESS after 15 minutes fails as timed out", async () => { /* publishingStartedAt = now - 16 min */
  await runPublishOnce(d); assert.equal(posts[0].status, "failed");
});
test("disconnected account fails the due post", async () => {
  await runPublishOnce(d); assert.equal(posts[0].status, "failed"); assert.equal(posts[0].lastError, "Instagram disconnected");
});
test("an edit that moved the post out of 'scheduled' wins over the publisher", async () => {
  /* updateIf fake: status changed to "cancelled" before the publisher's write */
  await runPublishOnce(d); assert.equal(posts[0].status, "cancelled");
});
test("one failing post does not stop the others", async () => {
  /* first post's createReelContainer throws a non-Graph error; second is due and approved */
  await runPublishOnce(d); assert.equal(posts[1].status, "publishing");
});
test("reminder sent once for pending posts within 24h", async () => {
  await runPublishOnce(d); await runPublishOnce(d); assert.equal(managerNotes.length, 1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test server/social/publisher.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `publisher.ts`, `tokenRefresher.ts`, the three storage queries, and start both pollers in `server/routes/index.ts`** with one-line comments in the style of the existing list (`// Instagram: publish due Reels (60s)`, `// Instagram: token refresh + upload cleanup (6h)`).

- [ ] **Step 4: Run to verify they pass, then check the pollers start**

Run: `node --import tsx --test server/social/publisher.test.ts` (PASS), then `pm2 restart leadawaker && sleep 40 && pm2 logs leadawaker --lines 40 --nostream | grep -i social`
Expected: both pollers log that they started; no errors.

- [ ] **Step 5: Commit**

```bash
git add server/social/publisher.ts server/social/publisher.test.ts server/social/tokenRefresher.ts server/storage/social.ts server/routes/index.ts
git commit -m "feat(social): Reel publisher and Instagram token refresher"
```

---

### Task 8: Client, Integrations "Social" group and Connect Instagram card

**Files:**
- Create: `client/src/features/social/api/socialApi.ts`
- Create: `client/src/features/social/components/InstagramConnectCard.tsx`
- Modify: `client/src/features/accounts/components/workspace/ConnectionsOverview.tsx` (`ConnectionGroup` at :14 gains `"social"`; tile)
- Modify: `client/src/features/accounts/components/workspace/IntegrationsPanel.tsx` (social group; readOnly visibility)
- Modify: `client/src/features/accounts/components/workspace/AccountsWorkspace.tsx` (`?instagram=` param, like `?calendar=` at :133-142)
- Modify: `client/src/locales/{en,nl,pt}/accounts.json`

**Interfaces:**
- Consumes: Task 5 routes.
- Produces (`socialApi.ts`, all via `apiFetch` from `client/src/lib/apiUtils.ts`):
  ```ts
  export interface SocialStatus { enabled: boolean; connection: null | { status: "connected" | "needs_attention" | "disconnected"; username: string | null; profilePictureUrl: string | null; accountType: string | null; tokenExpiresAt: string | null; lastError: string | null; scopes: string[] } }
  export const socialStatusKey: (accountId: number) => readonly unknown[]   // ["social-status", accountId]
  export async function fetchSocialStatus(accountId: number): Promise<SocialStatus>
  export function startInstagramConnect(accountId: number): void   // window.location.href = `${API_BASE}/api/social/accounts/${id}/instagram/authorize?origin=${encodeURIComponent(window.location.origin)}`
  export async function disconnectInstagram(accountId: number): Promise<void>
  export async function setSocialEnabled(accountId: number, enabled: boolean): Promise<void>
  ```

- [ ] **Step 1: Write the API module and the card.** Card states: not connected (button "Connect Instagram" + one line "Needs an Instagram Business or Creator account"), connected (avatar, @username, "Connected · renews automatically", Disconnect with an in-app confirm, never `window.confirm`), needs attention (`lastError`, "Reconnect"). Act buttons only when `isAdmin || userRole === "Manager"`. Agency also sees a "Social media for this account" switch calling `setSocialEnabled`.

- [ ] **Step 2: Wire the group.** Add `"social"` to `ConnectionGroup`, a tile with state `on` (connected) / `pending` (needs attention) / `off`, data from `useQuery({ queryKey: socialStatusKey(accountId), queryFn: () => fetchSocialStatus(accountId), staleTime: 30_000 })`. In `IntegrationsPanel`, readOnly users currently see only `"bookings"`: they now see `"bookings"` and, when `status.enabled`, `"social"`. Agency always sees `"social"`.

- [ ] **Step 3: Handle the return.** In `AccountsWorkspace`, when `params.has("instagram")`: `setTab("integrations")`, open the social group, show a toast for `connected` or the translated `reason`, invalidate `socialStatusKey`, delete `instagram`/`reason` from the URL with `history.replaceState`.

- [ ] **Step 4: Strings** in `accounts.json` for en, nl and pt: `integrationGroups.social.{title,help,short,hint}`, `integrationGroups.state.social.{on,pending,off}`, and `social.connect.*` (button labels, states, the six error reasons `access_denied, missing_code, invalid_state, not_professional, already_connected, failed`, enable switch). Portuguese is Brazilian Portuguese (pt-BR). No em dashes.

- [ ] **Step 5: Verify in the browser**

On `app.leadawaker.com` as agency, on a test account: the Social group shows the switch and the card; switching it on persists after reload. As a Viewer of that account (impersonation): the group shows, without Connect or Disconnect buttons. Visiting `/platform/accounts?instagram=error&reason=not_professional` shows the Integrations tab and the translated message, and the URL is cleaned.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/social client/src/features/accounts/components/workspace/ConnectionsOverview.tsx client/src/features/accounts/components/workspace/IntegrationsPanel.tsx client/src/features/accounts/components/workspace/AccountsWorkspace.tsx client/src/locales
git commit -m "feat(social): Connect Instagram card in account integrations"
```

---

### Task 9: Client, Social tab (posts list, new post, approval)

**Files:**
- Modify: `client/src/features/social/api/socialApi.ts` (post calls)
- Create: `client/src/features/social/components/SocialTab.tsx` (sections, empty state, connect card when not connected)
- Create: `client/src/features/social/components/PostCard.tsx` (preview, caption excerpt, time in account timezone, status badge, permalink, role-based actions)
- Create: `client/src/features/social/components/PostSheet.tsx` (new and edit)
- Modify: `client/src/features/accounts/components/workspace/types.ts:6` (`WorkspaceTab` gains `"social"`)
- Modify: `client/src/features/accounts/components/workspace/AccountsWorkspace.tsx:29` (`ACCOUNT_TABS`; hide `"social"` for non-agency users when `!status.enabled`)
- Modify: `client/src/features/accounts/components/workspace/OverviewTab.tsx:167-188` (`TabContent` renders `SocialTab` for `"social"`)
- Modify: `client/src/locales/{en,nl,pt}/accounts.json`

**Interfaces:**
- Consumes: Task 6 routes; `sectionFor`, `validateCaption`, `IG_CAPTION_MAX` from `@shared/socialPosts`.
- Produces (`socialApi.ts`):
  ```ts
  export interface SocialPostView { id: number; section: PostListSection; status: SocialPostStatus; approvalStatus: ApprovalStatus; requiresApproval: boolean; caption: string; scheduledAt: string; videoUrl: string; durationS: number | null; permalink: string | null; lastError: string | null; approvalNote: string | null; approvedByName: string | null; waivedByName: string | null; shareToFeed: boolean; isAiGenerated: boolean }
  export const socialPostsKey: (accountId: number) => readonly unknown[]   // ["social-posts", accountId]
  export async function fetchSocialPosts(accountId: number): Promise<SocialPostView[]>
  export function uploadSocialVideo(accountId: number, file: File, onProgress: (pct: number) => void): Promise<{ uploadId: string; ext: string; durationS: number; width: number; height: number; bytes: number }>  // XMLHttpRequest with withCredentials and API_BASE so progress events work; rejects with the server's { reason }
  export async function createSocialPost(accountId: number, body: { uploadId: string; caption: string; date: string; time: string; shareToFeed: boolean; isAiGenerated: boolean; requiresApproval: boolean }): Promise<void>
  export async function updateSocialPost(accountId: number, postId: number, body: Partial<{ uploadId: string; caption: string; date: string; time: string; shareToFeed: boolean; isAiGenerated: boolean; requiresApproval: boolean }>): Promise<void>
  export async function approveSocialPost(accountId: number, postId: number): Promise<void>
  export async function rejectSocialPost(accountId: number, postId: number, note: string): Promise<void>
  export async function retrySocialPost(accountId: number, postId: number): Promise<void>
  export async function cancelSocialPost(accountId: number, postId: number): Promise<void>
  ```
  The `GET /posts` route from Task 6 must return `approvedByName` and `waivedByName` (join to users) to fill this view.

- [ ] **Step 1: API calls and `SocialTab`.** Sections in this order with headings: needs approval, upcoming, held, failed, published (newest first). Times are shown with `Intl.DateTimeFormat(locale, { timeZone: account.timezone, dateStyle: "medium", timeStyle: "short" })`. Videos are 9:16 thumbnails using `<video preload="metadata">`, which plays inline on tap.

- [ ] **Step 2: `PostCard` actions by role.** Agency: Edit, Cancel (scheduled/held/failed), Retry (failed), Reschedule (held, opens the sheet on the time fields). Manager (and agency): Approve when `requiresApproval` and approval is `pending` or `rejected` and status is `scheduled` or `held`; Reject (with a note field) when `requiresApproval` and approval is `pending` or `approved` and status is `scheduled`. These match the server rules in Task 6. Viewer: none. Video `src` is `${API_BASE}${post.videoUrl}` (`API_BASE` from `client/src/lib/apiUtils.ts`), because the production frontend runs on a different host than the API. Show "Approved by <name>", "Approval waived by <name>", or the client's rejection note when present.

- [ ] **Step 3: `PostSheet`.** Video picker (accept `video/mp4,video/quicktime`, 100 MB check before upload, progress bar, server `reason` translated), caption with a live `n / 2200` counter and the `validateCaption` reason shown inline, date and time inputs (sent as strings; label shows the account's timezone), toggles for share to feed, AI label and requires approval (all default on). Save is disabled while uploading or while the caption is invalid. On 409 `not_editable`, show "This post is already being published" and refresh the list.

- [ ] **Step 4: Tab wiring and strings.** Add `"social"` to `WorkspaceTab` and `ACCOUNT_TABS`, render in `TabContent`, label `workspace.tabs.social`. All strings in en, nl and pt (pt-BR) under `social.posts.*`, including the Task 6 reasons (`not_editable, in_past, not_connected, too_long, too_many_hashtags, too_many_mentions, format, video_codec, audio_codec, audio_rate, duration_short, duration_long, fps, width, size`).

- [ ] **Step 5: Verify in the browser** on a test account with social on and a connected tester account (or, before Augusto connects, with the list only): create a post with the Task 4 clip for tomorrow, see it under "needs approval"; impersonate a Manager and approve it; edit the caption as agency and see it return to "needs approval"; check the layout at 375 px wide and in dark mode.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/social client/src/features/accounts/components/workspace client/src/locales
git commit -m "feat(social): Social tab with scheduling, preview and client approval"
```

---

### Task 10: First real post (with Gabriel and Augusto)

No new code; this proves the whole chain on the real account and is the recording for App Review later.

- [ ] **Step 1:** Gabriel merges `feat/instagram-publishing` into `main` and pushes (Vercel frontend), and the Pi picks up the server code (`pm2 restart leadawaker`).
- [ ] **Step 2:** Gabriel creates Augusto's account (timezone `America/Sao_Paulo`, language `pt`) and a Manager user, and switches Social on for it.
- [ ] **Step 3:** Augusto accepts the Instagram Tester invite, logs in on his phone and taps Connect Instagram. Expected: card shows his @username; `Social_Connections` row has `status = connected`, five scopes, `token_expires_at` about 60 days out, and `access_token_enc` starting with `v1:`.
- [ ] **Step 4:** From outside the home network: `curl -sI https://app.leadawaker.com/media/social/<publicId>.mp4` returns `200` with `content-type: video/mp4` and `accept-ranges: bytes`. If Cloudflare returns a challenge page, add a WAF skip rule for `/media/social/*`.
- [ ] **Step 5:** Gabriel schedules the theme 1 video about 10 minutes ahead with approval on. Augusto approves. Expected: within about 2 minutes of the time, the post shows "published" with a permalink, the Reel is on his profile with the AI label, and both get a notification.

---

## Self-review notes

- Spec coverage: connect + scopes + encrypted token (Tasks 3, 5), renewal and warnings (Tasks 2, 7), disconnect, deauthorize, data deletion (Task 5), per-account switch and roles (Tasks 5, 8, 9), approval rules incl. waiver and reminder (Tasks 2, 6, 7), hold-never-auto-publishes (Tasks 2, 7), uploads, specs, faststart, public media (Tasks 4, 6), publisher incl. quota and 15-minute timeout (Task 7), notifications in the account language (Tasks 5, 7), return origin (Task 5), one IG account per Lead Awaker account (Tasks 1, 5), files kept after publishing and cleaned when cancelled or orphaned (Tasks 6, 7), rollout (Task 10).
- Not built, by the spec: DMs, comments, insights, Augusto's studio, other media types, App Review submission.
