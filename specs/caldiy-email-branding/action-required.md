# Action Required: Cal.diy Email Branding

## Before Implementation

- [x] **Ensure account logo is uploaded** — the branding uses `accounts.logoUrl`. For a client to get a branded email, they need a logo set in LeadAwaker (Accounts → profile). Without it, the email falls back to the LeadAwaker default logo. This is fine for now, but worth communicating to clients. (Sandbox account 47 already has a logo; verified served via the new `/public/account-logo/:id` endpoint.)

> **Note (logo format):** account logos are stored as base64 `data:` URIs, which Gmail/Outlook block in emails. Implemented a public LeadAwaker route `GET /public/account-logo/:id` ([server/routes/accounts.ts](../../server/routes/accounts.ts)) that decodes them to real image bytes; provision passes that URL (not the raw data URI). Falls back to `app.leadawaker.com/premium/logo-icon.png` when an account has no logo.

## During Implementation

- [x] **Run the SQL migration manually** (Phase 1) — done via psql against the `users` table (caldiy maps `User` → `users`). Columns `brandLogoUrl`/`brandName` added.
- [x] **Run Phase 4 SQL fix** — applied to EventTypes **6 and 7** (both provisioned LeadAwaker clients), not just id=6, setting `disableStandardEmails.confirmation.host=true`.

## After Implementation

- [x] **Rebuild Cal.diy** — done. The full `npm run build` OOM'd on `@calcom/web`; rebuilt `apps/web` directly with `NODE_OPTIONS=--max-old-space-size=4096`, then `pm2 restart caldiy --update-env`. Cal.diy is online and serving (sandbox booking page returns 200).
- [x] **Re-provision the sandbox account** — equivalent done directly: backfilled caldiy user 5 (account 47) with `brandName="Sandbox Client"` + the logo-endpoint URL via SQL. (Re-provisioning from the Integrations panel will now also set these via the updated provision script.)
- [ ] **Make a test booking** — verify the confirmation email shows the client logo, the FROM name is "Sandbox Client Booking", and no organizer email arrives at `elfronza@gmail.com`. (Manual, by Gabriel.)
