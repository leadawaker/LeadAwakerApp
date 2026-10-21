# Implementation Plan: Two-Factor Authentication

## Overview
Optional per-user 2FA with three methods (TOTP, email code, passkey), plus backup codes, trusted devices, an Owner-controlled require-2FA policy, an Owner-only admin reset and an Owner-only audit log (Phases 4 to 8). The password step stops issuing a session when the user has any method enrolled; a "pending 2FA" record lives in the server session until a second factor passes, and only then `req.logIn` runs. Built in three phases. Phase 1 also lays the shared plumbing, so Phases 2 and 3 only add a method.

**Single source of truth.** Anything not written here is lost.

Conventions to respect (from CLAUDE.md): timestamps are set server-side with `new Date()` (never ISO strings from the client); all strings through i18n; no `process.exit()`; do not run `npx tsc --noEmit` unless Gabriel asks; keep files under ~500 lines (`server/auth.ts` is already 532 lines, so put new code in new modules and only wire it in); server methods go into a domain module under `server/storage/` (the barrel `server/storage.ts` stays the only consumer-facing API); routes are registered from `server/routes/index.ts`.

## Phase 1: Foundation + authenticator app (TOTP)

### Tasks
- [x] Add dependencies: `otplib` (TOTP). `qrcode` is already in package.json (`^1.5.4`), reuse it.
- [x] DB migration script `scripts/migrate-two-factor.mjs` (idempotent, direct `pg`, same style as `scripts/migrate-leads-hubspot-contact-id.mjs`) adding the Users columns below and creating ALL tables the whole feature needs so there is one migration: `User_Passkeys` (Phase 3), `User_Backup_Codes` (Phase 4), `User_Trusted_Devices` (Phase 5), `Security_Policy` + `Accounts.require_2fa` + `Users.two_factor_required_since` (Phase 6), `Security_Events` (Phase 8). SQL for the Phase 4 to 8 tables is in each phase's Technical Details.
- [x] Update `shared/schema.ts`: add the new `users` columns and a `userPasskeys` table + insert schema + types.
- [x] Add `encryptSecret` / `decryptSecret` aliases in `server/encryption.ts` (same AES implementation as `encryptApiKey` / `decryptApiKey`, which are misnamed for this use). Do not change the old names.
- [x] Storage: new module `server/storage/twoFactor.ts` with the methods in Technical Details, exposed through the `server/storage.ts` barrel.
- [x] New server module `server/twoFactor/pending.ts`: pending-2FA session helpers (create, read, count attempt, clear) and the shared `completeLogin(req, user)` that does `req.logIn`, records `lastLoginAt`, returns the safe user. Move the existing login success logic out of the `/api/auth/login` handler into this helper so both paths share it. [complex]
- [x] Add `toSafeUser(user)` helper (strips `passwordHash`, `totpSecretEnc`, `encryptedClaudeApiKey`, adds `twoFactor` summary). Replace the inline `const { passwordHash: _, ...safeUser } = user` in `/api/auth/login` and use it in `GET /api/auth/me`. Grep `passwordHash` in `server/routes/users.ts` and anywhere else a user object is returned and apply it there too, so the new secret column can never leak.
- [x] Change `POST /api/auth/login` in `server/auth.ts`: after Passport validates the password, if `twoFactorMethods(user).length > 0` do NOT call `req.logIn`. Instead create the pending record and respond `200 { twoFactorRequired: true, methods: [...] }`. Otherwise behave exactly as today.
- [x] New routes file `server/routes/twoFactor.ts`, registered in `server/routes/index.ts`:
  - `POST /api/auth/2fa/verify` (public, needs pending record): `{ method: "totp"|"email"|"passkey", code }`, completes login on success.
  - `GET /api/auth/2fa/status` (requireAuth): the summary for the Settings card.
  - `POST /api/auth/2fa/totp/setup` (requireAuth, body `{ password }`): creates a pending secret, returns `{ otpauthUri, qrDataUrl, secretBase32 }`.
  - `POST /api/auth/2fa/totp/enable` (requireAuth, body `{ code }`): confirms the first code, persists the secret, sets `totpEnabledAt`.
  - `POST /api/auth/2fa/totp/disable` (requireAuth, body `{ password, code }`).
- [x] TOTP replay guard: store `totpLastStep` (the 30 s step number of the last accepted code) on the user; reject a code whose step is <= that value.
- [x] Rate limits: reuse the in-memory pattern from `checkLoginRateLimit` (per IP) for `/2fa/verify`, plus the per-pending-record attempt cap (5). Failing the cap clears the pending record, the user must enter the password again.
- [x] `client/public/login.html`: after `res.ok`, if `data.twoFactorRequired`, hide the password form and show a second panel (code input, a method switcher if more than one method, an "Email me a code" link, a "Back" link). On success, run the same post-login block that exists today (localStorage writes, `leadawaker_return_to`, redirect). Extract that block into a function `finishLogin(user)` so both paths call it. Add the strings to this page's own i18n dictionary (en/nl/pt). [complex]
- [x] React Settings UI: new `client/src/features/settings/components/TwoFactorCard.tsx` rendered next to every `<SecurityCard` usage (grep for it; there is a desktop and a mobile profile page). States: off, setup (password prompt -> QR + manual key -> confirm code), on (list of methods with remove buttons), disable (password + code). Follow `UI_STANDARDS.md` and `UI_PATTERNS.md`, use `SectionCard`, tokens only, dark mode safe, mobile friendly (min tap size 44px like SecurityCard's `min-h-11`).
- [x] i18n: add a `twoFactor.*` block to `client/src/locales/{en,nl,pt}/settings.json`. Brazilian Portuguese for `pt`.
- [x] Update `FILE_MAP.md` with the new files.

### Technical Details
**Users columns** (schema `p2mxx34fvbf3ll6`, table `"Users"`):
```sql
ALTER TABLE p2mxx34fvbf3ll6."Users" ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE p2mxx34fvbf3ll6."Users" ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE p2mxx34fvbf3ll6."Users" ADD COLUMN IF NOT EXISTS totp_last_step integer;
ALTER TABLE p2mxx34fvbf3ll6."Users" ADD COLUMN IF NOT EXISTS email_2fa_enabled_at timestamptz;
```
Drizzle: `totpSecretEnc: text("totp_secret_enc")`, `totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true })`, `totpLastStep: integer("totp_last_step")`, `email2faEnabledAt: timestamp("email_2fa_enabled_at", { withTimezone: true })`.

**User_Passkeys** (created now, used in Phase 3):
```sql
CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."User_Passkeys" (
  id serial PRIMARY KEY,
  users_id integer NOT NULL,
  credential_id text NOT NULL UNIQUE,   -- base64url
  public_key text NOT NULL,             -- base64url of the COSE key
  counter bigint NOT NULL DEFAULT 0,
  transports text,                      -- JSON array string
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_users_idx ON p2mxx34fvbf3ll6."User_Passkeys"(users_id);
```
Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/migrate-two-factor.mjs`, then verify columns via `information_schema.columns` like the existing script does. The server auto-reloads under pm2 watch (about 5-8 s).

**Storage methods** (`server/storage/twoFactor.ts`):
`getTwoFactorStatus(userId)`, `setTotpSecret(userId, enc, enabledAt: Date)`, `clearTotp(userId)`, `setTotpLastStep(userId, step)`, `setEmail2fa(userId, enabledAt: Date | null)`, `listPasskeys(userId)`, `addPasskey(...)`, `updatePasskeyCounter(id, counter, usedAt: Date)`, `removePasskey(userId, id)`. After any write call `invalidateUserCache(userId)` (exported from `server/auth.ts`; `deserializeUser` caches users for 60 s).

**Method list helper:**
```ts
export function twoFactorMethods(u: Users, passkeyCount: number): ("totp"|"email"|"passkey")[] {
  const m: ("totp"|"email"|"passkey")[] = [];
  if (u.totpSecretEnc && u.totpEnabledAt) m.push("totp");
  if (u.email2faEnabledAt) m.push("email");
  if (passkeyCount > 0) m.push("passkey");
  return m;
}
```
The email fallback is offered whenever `m.length > 0`, independent of `"email"` being in the list.

**Session shape** (augment `SessionData` in `server/auth.ts` next to `impersonation`, or in the new `pending.ts` with its own `declare module`):
```ts
pending2fa?: {
  userId: number;
  expiresAt: number;        // Date.now() + 10 * 60_000
  attempts: number;         // wrong tries, cap 5
  emailCode?: { hash: string; expiresAt: number; attempts: number; sentAt: number[] };
  passkeyChallenge?: string; // Phase 3
  totpSetupSecretEnc?: string; // only for the enrollment of an already logged-in user, see below
};
```
Pending enrollment secrets for the Settings flow are kept in `req.session.totpSetup = { secretEnc, expiresAt }` (a separate key), not in `pending2fa`.

**Login response contract:**
- No 2FA: `200 { user }` (unchanged).
- 2FA needed: `200 { twoFactorRequired: true, methods: ["totp","email","passkey"] }` plus `emailFallback: true`. No user object, no session `passport` key.
- `POST /api/auth/2fa/verify` success: `200 { user }` (same shape as login). Failure: `401 { message: "Invalid code" }`; expired or missing pending: `401 { message: "Session expired, sign in again", restart: true }`.

**TOTP with otplib:**
```ts
import { authenticator } from "otplib";
authenticator.options = { digits: 6, step: 30, window: 1 };
const secret = authenticator.generateSecret();            // base32
const uri = authenticator.keyuri(user.email!, "Lead Awaker", secret);
const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
// verify + replay guard
const delta = authenticator.checkDelta(code, secret);     // null when invalid
const step = Math.floor(Date.now() / 30_000) + (delta ?? 0);
if (delta === null || (user.totpLastStep != null && step <= user.totpLastStep)) fail();
```
Store `encryptSecret(secret)` in `totp_secret_enc`, decrypt only inside verify.

**Enrollment guard:** `setup` and `enable` require `req.isAuthenticated()` AND, for `setup`, the current password checked with the exported `verifyPassword` (export it from `server/auth.ts`; it is currently module-private). Do not allow enrollment while impersonating (`req.session.impersonation` set): return 403.

**login.html** facts: the login page is static plain JS (`client/public/login.html`, form `#login-form`, error box `#err`, helpers `showError`, `clearError`, `setLoading`, fields `#email`, `#password`, `#remember`). It posts to `/api/auth/login` with `credentials: 'include'`. Keep the markup/CSS in the same visual language as the existing card; no new fonts or colours.

**Locale keys** (settings.json, `twoFactor` namespace), at minimum: `title`, `description`, `statusOn`, `statusOff`, `enable`, `disable`, `passwordPrompt`, `scanQr`, `manualKey`, `enterCode`, `confirm`, `enabled`, `disabled`, `invalidCode`, `methods.totp`, `methods.email`, `methods.passkey`, `remove`, plus `login.*` keys for the challenge screen.

## Phase 2: Email code

### Tasks
- [x] Server: `POST /api/auth/2fa/email/send` (public, needs pending record) generates and emails a 6-digit code. Rate limit: 3 sends per 15 minutes per user, 60 s minimum gap between sends.
- [x] Server: email-code verification inside `POST /api/auth/2fa/verify` when `method === "email"`.
- [x] Email template using `renderEmailLayout` / `renderEmailText` (see `server/routes/auth.ts` contact form for a working example). Subject "Your Lead Awaker sign-in code". Big code, "valid for 10 minutes", "If this was not you, change your password". Follow the client email design rules in memory (`project_client_email_design_2026_10_13`). Localize by the user's preference language if available, else English.
- [x] Settings: `POST /api/auth/2fa/email/enable` (requireAuth, body `{ password }`) sends a confirmation code to the user's own email, then `POST /api/auth/2fa/email/confirm` (`{ code }`) sets `email2faEnabledAt`. `POST /api/auth/2fa/email/disable` (`{ password, code }`).
- [x] login.html: "Email me a code" link calls `/api/auth/2fa/email/send`, shows "Sent to j***@domain.com" (masked), switches the input to the email method, adds a "Resend" with a 60 s countdown.
- [x] TwoFactorCard: email method row (enable, disable) and the i18n strings.
- [x] Dev fallback: when email is not configured, log the code to the pm2 log (`[2fa] dev email code for <id>: 123456`) only when `NODE_ENV !== "production"`.

### Technical Details
Code generation and storage (never store the code in clear):
```ts
const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const hash = crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(`${userId}:${code}`).digest("hex");
pending.emailCode = { hash, expiresAt: Date.now() + 10 * 60_000, attempts: 0, sentAt: [...] };
```
Compare with `crypto.timingSafeEqual` on equal-length buffers. A new send replaces the previous code. Success deletes `emailCode`. Send via `sendRawEmail({ to: user.email, subject, text, html })` from `server/email.ts`, which returns a `DeliveryResult` and throws on failure: on failure respond 502 `{ message: "Could not send the email" }` and do not count it against the user's send quota.

Masking helper: `j***@domain.com` (first char of local part, domain intact).

Enrolling email as a method confirms the mailbox works, which matters because it is also the recovery path for everyone. Make the Settings copy say so.

## Phase 3: Passkeys (WebAuthn)

### Tasks
- [x] Add dependencies: `@simplewebauthn/server` (server) and `@simplewebauthn/browser` (React Settings card). Pin versions that support the installed Node version; check `node -v` on the Pi first.
- [x] Env: `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` (comma separated), `WEBAUTHN_RP_NAME` (default "Lead Awaker"). Read once in a small `server/twoFactor/webauthn.ts` config module; fail loudly in production if `WEBAUTHN_RP_ID` is missing.
- [x] Registration routes (requireAuth, password re-check on the options call): `POST /api/auth/2fa/passkey/register/options`, `POST /api/auth/2fa/passkey/register/verify` (`{ response, deviceLabel }`), `DELETE /api/auth/2fa/passkey/:id`, `PATCH /api/auth/2fa/passkey/:id` (rename).
- [x] Authentication routes (public, need pending record): `POST /api/auth/2fa/passkey/auth/options`, and `method: "passkey"` in `/api/auth/2fa/verify` with `{ response }`.
- [x] login.html: passkey button, using native `navigator.credentials.get` with small base64url helpers (no bundler on this static page; the page cannot import npm packages). Server options use `@simplewebauthn/server` and the JSON is converted client side. [complex]
- [x] TwoFactorCard: passkey list (label, created, last used), "Add passkey" button using `@simplewebauthn/browser` `startRegistration`, rename and remove.
- [x] Feature-detect `window.PublicKeyCredential`; hide passkey UI when unsupported.
- [x] Counter handling: update `counter` and `last_used_at` (a `Date`) after every successful authentication; some authenticators always report 0, so only reject when both stored and new counters are non-zero and new <= stored.

### Technical Details
```ts
import { generateRegistrationOptions, verifyRegistrationResponse,
         generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
const rpID = process.env.WEBAUTHN_RP_ID!;            // "leadawaker.com"
const expectedOrigin = process.env.WEBAUTHN_ORIGINS!.split(",").map(s => s.trim());
// registration options
generateRegistrationOptions({ rpName, rpID, userName: user.email!, userID: new TextEncoder().encode(String(user.id)),
  attestationType: "none", excludeCredentials: existing.map(p => ({ id: p.credentialId, transports: JSON.parse(p.transports ?? "[]") })),
  authenticatorSelection: { residentKey: "preferred", userVerification: "required" } });
// store options.challenge in req.session.pending2fa.passkeyChallenge (auth) or req.session.passkeyRegChallenge (registration)
```
RP ID: the login page is served from `leadawaker.com` / `www.leadawaker.com` (Vercel) and the app from `app.leadawaker.com`; the API is `api.leadawaker.com`. A WebAuthn RP ID must be a registrable suffix of the page origin (not the API host), so `leadawaker.com` covers all three page origins. Expected origins must list all three with `https://`. The apex redirects to www (see memory `reference_leadawaker_apex_redirects_www`), so include both.

Challenge handling: one challenge per attempt, stored in the session, deleted after use (success or failure). Credentials are stored base64url (`credential_id`, `public_key`). `verifyAuthenticationResponse` needs `expectedChallenge`, `expectedOrigin`, `expectedRPID`, `credential: { id, publicKey, counter, transports }`, and `requireUserVerification: true`.

Cross-origin cookie note: when the page is on Vercel and the API is `api.leadawaker.com`, the session cookie is `SameSite=None; Secure` with `COOKIE_DOMAIN` already set (see `setupAuth`). The pending 2FA record rides on that same session, so no extra cookie work is needed; just keep `credentials: 'include'` on every 2FA fetch.

## Phase 4: Backup codes

### Tasks
- [x] Server: `POST /api/auth/2fa/backup-codes/generate` (requireAuth, body `{ password }`, requires at least one other method enrolled). Replaces any existing set, returns the 10 plain codes once.
- [x] Server: `GET /api/auth/2fa/backup-codes/status` returns `{ remaining }` only (also folded into `/api/auth/2fa/status`).
- [x] Verification: `method: "backup"` in `POST /api/auth/2fa/verify`. Mark the code used with a `Date`, never reuse. On success, also tell the client how many remain.
- [x] login.html: "Use a backup code" link on the challenge screen, input accepts the code with or without the dash, case-insensitive.
- [x] TwoFactorCard: generate or regenerate (password prompt), one-time display with Copy and Download .txt buttons and a "I saved these" confirm, remaining count, low-count warning.
- [x] Email the user when a backup code is used ("a backup code was used to sign in") so a stolen code is noticed.
- [x] i18n (en/nl/pt).

### Technical Details
```sql
CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."User_Backup_Codes" (
  id serial PRIMARY KEY,
  users_id integer NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_backup_codes_users_idx ON p2mxx34fvbf3ll6."User_Backup_Codes"(users_id);
```
Generation: 10 codes of 10 characters from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` using `crypto.randomInt`, displayed `XXXXX-XXXXX`. Store `HMAC-SHA256(SESSION_SECRET, userId + ":" + normalizedCode)` hex, normalized = upper-case, dashes and spaces removed. Verify by hashing the input and comparing with `timingSafeEqual` against each unused row's hash for that user. Counts toward the 5-attempt pending cap.

Backup codes are NOT a method that triggers the challenge by themselves: `twoFactorMethods()` stays TOTP / email / passkey. The challenge screen offers "backup code" only when the user has unused codes (include `backup: true` in the login response, no count).

## Phase 5: Trusted devices (30 days)

### Tasks
- [x] Server: after a successful `/api/auth/2fa/verify` with `trustDevice: true`, create a trusted-device row and set the `la_td` cookie.
- [x] Server: in `/api/auth/login`, after the password is valid and the user has methods, check the `la_td` cookie. If it matches a non-expired row for that user, skip the challenge: call `completeLogin`, bump `last_used_at`. Otherwise start the challenge as normal.
- [x] Revocation hooks: delete all rows for a user on password change (`/api/auth/change-password`), on password reset completion, on disabling the last method, and on admin reset. Add `revokeAllTrustedDevices(userId)` to the storage module.
- [x] Routes: `GET /api/auth/2fa/devices` (list, flags the current one), `DELETE /api/auth/2fa/devices/:id`, `DELETE /api/auth/2fa/devices` (all).
- [x] login.html: checkbox "Trust this device for 30 days" on the challenge screen, unchecked by default.
- [x] TwoFactorCard: trusted devices list with revoke buttons.
- [x] Policy interaction: trusted-device skipping is still allowed when the require policy is on (the user already has a method). It is not allowed to skip enrollment.
- [x] i18n (en/nl/pt).

### Technical Details
```sql
CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."User_Trusted_Devices" (
  id serial PRIMARY KEY,
  users_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,   -- sha256 hex of the cookie value
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS user_trusted_devices_users_idx ON p2mxx34fvbf3ll6."User_Trusted_Devices"(users_id);
```
Cookie: name `la_td`, value `crypto.randomBytes(32).toString("base64url")`, options mirror the session cookie in `setupAuth` (`httpOnly: true`, `secure: NODE_ENV === "production" || !!CORS_ORIGIN`, `sameSite: CORS_ORIGIN ? "none" : "lax"`, `domain: COOKIE_DOMAIN || undefined`) with `maxAge: 30 * 24 * 60 * 60 * 1000`. Read it from `req.headers.cookie` with a tiny parser (or `cookie-parser` if it is already installed; check `package.json` first). Store only the sha256 hash. Match on `token_hash` AND `users_id`. Prune expired rows when a user logs in. Browser label: a short regex over the user agent (Chrome / Safari / Firefox / Edge on Windows / macOS / iOS / Android / Linux), stored as the raw trimmed UA (max 300 chars) and labelled client-side.

## Phase 6: Require-2FA policy (global + per account)

### Tasks
- [x] Storage: `getSecurityPolicy()`, `setSecurityPolicy(...)`, `getEffectiveRequirement(user)` in `server/storage/twoFactor.ts`.
- [x] Owner routes (requireOwner): `GET /api/admin/security-policy`, `PUT /api/admin/security-policy` (`{ requireTwoFactor, graceDays }`), and per-account `PATCH /api/admin/accounts/:id/require-2fa` (`{ requireTwoFactor: "off"|"admins"|"everyone"|null }`). Each change writes an audit event with old and new values.
- [x] Grace tracking: at login (after password, before or after the challenge), if the effective requirement applies to the user and they have no method, set `Users.two_factor_required_since = new Date()` only when it is null. Clear it once they enroll or the requirement no longer applies.
- [x] `/api/auth/me` additions: `twoFactor.required: boolean`, `twoFactor.graceEndsAt: string | null` (computed on the server, display only), `twoFactor.enrollRequired: boolean`.
- [x] Enforcement middleware `enforceTwoFactorEnrollment` registered once after `passport.session()` and before the domain routers: when `req.isAuthenticated()`, the user is under a requirement with no method, `two_factor_required_since + graceDays` has passed, and the request is not impersonated and not internal-key authenticated, then allow only `/api/auth/*` (including `/api/auth/2fa/*`, `/api/auth/me`, `/api/auth/logout`) and respond `403 { code: "2FA_ENROLL_REQUIRED" }` for everything else. [complex]
- [x] Client: global handler for `403 2FA_ENROLL_REQUIRED` in `apiFetch` (`client/src/lib/apiUtils.ts`) navigating to Settings > Security; a grace banner in `CrmShell.tsx` showing days left with a link to Settings; the card auto-opens in setup state.
- [x] Owner UI: `TwoFactorPolicyCard.tsx` in Settings (Owner only, next to `OwnerToolsCard`) with a global select (Off / Admins / Everyone) and grace days input; a per-account override select added to the account's settings panel (find the existing account edit UI under `client/src/features/accounts` or the Accounts page and follow its pattern).
- [x] i18n (en/nl/pt).

### Technical Details
```sql
CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."Security_Policy" (
  id integer PRIMARY KEY DEFAULT 1,
  require_2fa text NOT NULL DEFAULT 'off',      -- off | admins | everyone
  grace_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz,
  updated_by integer,
  CONSTRAINT security_policy_single CHECK (id = 1)
);
INSERT INTO p2mxx34fvbf3ll6."Security_Policy" (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE p2mxx34fvbf3ll6."Accounts" ADD COLUMN IF NOT EXISTS require_2fa text;   -- NULL = inherit global
ALTER TABLE p2mxx34fvbf3ll6."Users" ADD COLUMN IF NOT EXISTS two_factor_required_since timestamptz;
```
Effective requirement for a user: `account.require_2fa ?? policy.require_2fa`. "admins" means `user.role` in `Owner`, `Admin`. Timestamps are `new Date()` server-side. Cache the policy in memory for 30 s and bust it on write (same idea as `_userCache` / `invalidateUserCache`). Existing roles seen in code: Owner, Admin, Manager, Viewer; confirm the role list in `shared/schema.ts` before hardcoding.

## Phase 7: Owner admin reset

### Tasks
- [x] Route `POST /api/admin/users/:id/2fa/reset` (requireOwner). Refuse when impersonating. Steps in one function `resetTwoFactor(targetUserId, actorId)`: clear TOTP columns, `email_2fa_enabled_at`, delete passkeys, backup codes and trusted devices, set `two_factor_required_since = null`, `invalidateUserCache`, delete the target's rows from the `session` table, email the target user, write the audit event.
- [x] Email to the target user ("Two-factor authentication was reset on your account by an administrator. If you did not ask for this, contact us at once."), using `renderEmailLayout`.
- [x] UI: "Reset 2FA" action in the existing user management UI (find where team users are listed and edited, likely under the Accounts or Users admin area; grep for the invite-user flow that calls `sendInviteEmail`). Owner only. Confirmation dialog stating what is removed. Only enabled when the target actually has 2FA (use `twoFactor` summary from the users list API; make sure `toSafeUser` summary is included there).
- [x] i18n (en/nl/pt).

### Technical Details
End a user's sessions (connect-pg-simple table `session`, columns `sid`, `sess` json, `expire`):
```sql
DELETE FROM session WHERE (sess::jsonb -> 'passport' ->> 'user')::int = $1;
```
Run through the existing `pool` from `server/db.ts`. If the `session` table lives in a different schema than the default search path, check `setupAuth` (`tableName: "session"`, public schema) and qualify as `public.session`. The reset does not touch the password. The Owner can still do a normal password reset separately.

## Phase 8: Audit log

### Tasks
- [x] Storage + helper `logSecurityEvent(req, event, opts)` in `server/twoFactor/audit.ts`: fire-and-forget, wrapped in try/catch, never throws, never awaited on the login path. Reads IP from `req.ip`, UA from the header (trimmed to 300 chars).
- [x] Instrument every route from Phases 1 to 7 plus `/api/auth/login` (success, failed password, rate limited), `/api/auth/change-password`, `/api/auth/accept-invite`. Event names listed below.
- [x] Owner route `GET /api/admin/security-events` (requireOwner) with query `userId`, `event`, `from`, `to`, `limit` (max 100, default 50), `before` (id cursor).
- [x] Pruning: delete rows older than 180 days once a day (`setInterval` with `.unref()` started from the audit module, plus once at boot).
- [x] Owner UI `SecurityLogCard.tsx` in Settings (Owner only): filters (user, event type, date range), 50 rows per page with "Load more", colour-coded failure events using existing tokens (no new colours), mobile friendly (cards on phone, table on desktop; follow `UI_PATTERNS.md`).
- [x] i18n (en/nl/pt) for every event label.

### Technical Details
```sql
CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."Security_Events" (
  id bigserial PRIMARY KEY,
  users_id integer,              -- subject (NULL when email unknown)
  actor_users_id integer,        -- who did it (differs on admin reset / impersonation)
  accounts_id integer,
  event text NOT NULL,
  ip text,
  user_agent text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON p2mxx34fvbf3ll6."Security_Events"(created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_users_idx ON p2mxx34fvbf3ll6."Security_Events"(users_id, created_at DESC);
```
Event names: `login_success`, `login_failed`, `login_rate_limited`, `challenge_started`, `challenge_success`, `challenge_failed`, `challenge_locked`, `method_enabled`, `method_disabled` (meta `{ method }`), `email_code_sent`, `backup_codes_generated`, `backup_code_used`, `trusted_device_added`, `trusted_device_used`, `trusted_device_revoked`, `passkey_added`, `passkey_removed`, `password_changed`, `admin_reset`, `policy_changed` (meta `{ scope, from, to }`), `enrollment_forced`.

Never put a code, secret, token, password or full cookie in `meta`. For `login_failed` on an unknown email, log `users_id = null` and `meta: { email_hash }` (sha256 of the lowercased email, not the email), so the log does not become a list of typed credentials.
