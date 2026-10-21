# Action Required: Two-Factor Authentication

Manual steps that must be completed by a human.

## Before Implementation
- [x] **Confirm `CLAUDE_ENCRYPTION_KEY` is set on the Pi and on any future cloud server** - the TOTP secret reuses it. If it is ever rotated, every enrolled authenticator breaks. Do not rotate it casually.
- [x] **Confirm Resend is live in production** (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`) - email codes and the recovery path depend on it. In dev without it, codes are only logged.

- [ ] **Decide your admin-reset routine** - before using Phase 7, agree with yourself how you verify a person (call, video, known WhatsApp number) before pressing Reset. The tool trusts you completely.
- [ ] **Pick the rollout order for the policy** - suggested: turn on "admins" first with a 7-day grace, check the audit log, then consider "everyone" per client account.

## During Implementation
- [x] **Run the DB migration on the Pi** (one script creates the tables for all eight phases) - `node --env-file=.env scripts/migrate-two-factor.mjs` (drizzle-kit push needs a TTY, so a direct `pg` script is used). It is idempotent.
- [x] **Add env vars (Phase 3 only)** - `WEBAUTHN_RP_ID=leadawaker.com` and `WEBAUTHN_ORIGINS=https://leadawaker.com,https://www.leadawaker.com,https://app.leadawaker.com` to `.env` / `ecosystem.config.cjs` env, then `pm2 restart` (the server only auto-reloads on file changes, not on env edits).
- [ ] **Enroll your own account first** and test login in a private window before telling anyone else about it.

## After Implementation
- [ ] **Check cookie behaviour on the live domains** - the trusted-device cookie `la_td` must be sent from `leadawaker.com`/`app.leadawaker.com` to `api.leadawaker.com`; test "trust this device" in a fresh browser on production, not just on the Pi dev host.
- [ ] **Do one full reset drill** - make a throwaway user, enroll, reset as Owner, confirm the user can log in with password only and the audit log shows it.
- [ ] **Add the new strings review** - read the `nl` and `pt` copy once; machine-quality translations of security wording are easy to get subtly wrong.
- [ ] **Commit and push** when satisfied (`leadawaker.com` auto-deploys `login.html` from `main` on Vercel; the API change must already be live on `api.leadawaker.com` first, otherwise the new login page talks to an old API. The old API ignores unknown fields, so the order API first, then push is safe.)
- [ ] **Tell client users** it exists (optional, one line in the next update).
