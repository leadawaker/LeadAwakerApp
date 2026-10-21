# Requirements: Two-Factor Authentication

## What and why
The CRM signs users in with email + password only (Passport local, session cookie in Postgres via connect-pg-simple). There is no second factor. The CRM holds client lead data and can message real people on WhatsApp, so a stolen password is a full account takeover. This feature adds optional two-factor authentication (2FA) that each user enables for themselves in Settings.

## Decisions (confirmed with Gabriel, 2026-10-20)
- **Methods, all three available:** authenticator app (TOTP), email code, passkey (WebAuthn). A user can enable one or more.
- **Optional per user by default.** Enrollment is forced only where the Owner turns on the require-2FA policy (Phase 6).
- **Everyone:** all CRM users, including client-account users. They share one login system.
- **Recovery, four layers (updated 2026-10-20):** email code (always offered), 10 one-time backup codes, trusted-device skip, and an Owner-only admin reset as the last resort.
- **Trust this device for 30 days:** optional checkbox after a successful second factor.
- **Require-2FA policy:** Owner sets a global default (off / admins / everyone) with a per-account override and a grace period (default 7 days).
- **Audit log:** security events are recorded and shown in an Owner-only log in Settings.
- **Admin reset and audit log are Owner role only.**
- **2FA on the internal API key: DROPPED.** The key is used by machines (Python engine, booking Worker) that cannot type a code. It stays as is.
- **Build order:** Phase 1 TOTP (plus the shared login-challenge plumbing), Phase 2 email code, Phase 3 passkeys, Phase 4 backup codes, Phase 5 trusted devices, Phase 6 require-2FA policy, Phase 7 Owner admin reset, Phase 8 audit log.

## User stories
- As a user, I turn on 2FA in Settings > Security by scanning a QR code with my authenticator app and confirming one code.
- As a user with 2FA on, after a correct password I am asked for a second factor before I get a session.
- As a user, I can add an email code and/or a passkey as extra methods, and remove any method.
- As a user who lost my phone, I click "Email me a code" on the challenge screen and get in.
- As a user, I can turn 2FA off again (after proving it is me).

## Acceptance criteria
1. A user with no 2FA logs in exactly as today. No extra step, no behaviour change.
2. A user with at least one 2FA method does NOT get an authenticated session after the password step. `GET /api/auth/me` returns 401 until the second factor passes.
3. The pending state is server-side (session), expires after 10 minutes, and allows at most 5 wrong attempts before the user must re-enter the password.
4. TOTP: RFC 6238, SHA-1, 6 digits, 30 s step, window of +-1 step, secret stored encrypted. A code already used cannot be replayed within its window.
5. Email code: 6 digits, 10 minute expiry, single use, stored hashed, max 5 attempts, max 3 sends per 15 minutes per user. Sent through the existing Resend/SMTP path (`sendRawEmail`) using the shared email layout.
6. Passkey: WebAuthn registration and authentication with user verification required. Multiple passkeys per user, each nameable and removable. Works on `leadawaker.com`, `www.leadawaker.com` and `app.leadawaker.com` with one RP ID.
7. The "Email me a code" fallback is offered on the challenge screen to every user who has any 2FA method enabled, even if they never enabled email as a method.
8. Enabling or changing any method requires the current password. Turning 2FA off requires the password plus one valid second factor.
9. Secrets (TOTP secret) never leave the server after setup. `/api/auth/login`, `/api/auth/me` and the users routes never return them. They return a safe summary instead: `twoFactor: { totp: boolean, email: boolean, passkeys: number }`.
10. Changing the password, impersonation, the internal API key bypass (`x-internal-key`) and invite acceptance keep working. Impersonation (Owner only) is not 2FA-gated again.
11. Every user-facing string is in i18n (`en`, `nl`, `pt`; Brazilian Portuguese) in the Settings locale files and in the dictionary used by `client/public/login.html`.
12. Wrong-code and rate-limit failures give generic messages that do not reveal which method exists for the account before the password step has passed.

## Known tradeoffs (accepted)
- Because email is a recovery path for everyone, anyone who controls a user's mailbox AND knows their password can bypass TOTP and passkey. 2FA here protects against a leaked or guessed password, not against a compromised mailbox.
- A trusted-device cookie skips the second factor for 30 days on that browser. Anyone using that browser with the password gets in. Trust is revoked on password change, 2FA disable, admin reset, and from the Settings device list.
- Admin reset is only as safe as the Owner's check that the requester is who they claim to be. Verify out of band (call or message) before resetting.

## Out of scope
- SMS codes, 2FA on the internal API key (dropped, see Decisions), client-admin reset, a per-user security log for client users, exporting the audit log.

## Related features and dependencies
- `server/auth.ts` (Passport local strategy, `/api/auth/login`, `/api/auth/me`, rate limiter).
- `client/public/login.html` (static login page with plain JS, NOT the React `legacy/pages/Login.tsx`).
- `client/src/features/settings/components/SecurityCard.tsx` (change password) is the neighbour for the new card.
- `server/email.ts` (`sendRawEmail`, `renderEmailLayout`) and the client email look (see memory: client email design).
- `server/encryption.ts` (AES key from `CLAUDE_ENCRYPTION_KEY`) reused for the TOTP secret.

## Acceptance criteria for the added items (Phases 4 to 8)
13. **Backup codes:** a user with 2FA can generate 10 codes (format `XXXXX-XXXXX`). They are shown once, stored only as hashes, each works once, and regenerating invalidates all older codes. Codes are accepted on the challenge screen as a method. The Settings card shows how many remain and warns at 2 or fewer. Generating requires the password.
14. **Trusted device:** after a valid second factor the user may tick "Trust this device for 30 days". Later password logins from that browser skip the challenge until expiry. The cookie is random, httpOnly, stored server-side only as a hash, and bound to one user. The Settings card lists trusted devices (browser label, last used) and lets the user revoke one or all. Trust is revoked automatically on password change, 2FA disable and admin reset.
15. **Policy:** the Owner can set the global requirement to off, admins (roles Owner and Admin) or everyone, set a grace period in days, and override the requirement per client account (inherit / off / admins / everyone). A user under a requirement who has no method sees a countdown banner during grace. After grace, the session after password login is restricted to enrollment: every API route except auth and 2FA setup returns 403 `2FA_ENROLL_REQUIRED` until a method is enrolled. The internal API key and impersonation are not affected.
16. **Admin reset:** only the Owner role. It removes TOTP, email 2FA, all passkeys, all backup codes and all trusted devices for the target user, ends that user's active sessions, emails the user that 2FA was reset by an administrator, and writes an audit event. The user must sign in with the password only, and is prompted to re-enroll if the policy applies.
17. **Audit log:** security events are written for login success and failure, challenge started, second factor success and failure, method enabled or disabled, backup codes generated or used, trusted device added, used or revoked, passkey added or removed, email code sent, password changed, admin reset, and policy changes. Each row has time, user, actor, account, event, IP, short browser label and non-secret details. Codes, secrets and tokens are never logged. Logging never blocks or fails a login. Rows older than 180 days are pruned.
18. The audit log is viewable only by the Owner in Settings, filterable by user, event type and date range, 50 rows per page.
