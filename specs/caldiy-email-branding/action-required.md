# Action Required: Cal.diy Email Branding

## Before Implementation

- [ ] **Ensure account logo is uploaded** — the branding uses `accounts.logoUrl`. For a client to get a branded email, they need a logo set in LeadAwaker (Accounts → profile). Without it, the email falls back to the LeadAwaker default logo. This is fine for now, but worth communicating to clients.

## During Implementation

- [ ] **Run the SQL migration manually** (Phase 1) — Prisma migrations don't work interactively on the Pi; the ALTER TABLE must be run via psql with the caldiy credentials documented in `implementation-plan.md`.
- [ ] **Run Phase 4 SQL fix** for the existing sandbox EventType (id=6) to suppress organizer emails on existing accounts.

## After Implementation

- [ ] **Rebuild Cal.diy** — email templates are compiled at build time. After patching Phase 3, run the build and `pm2 restart caldiy --update-env`. Budget 5-10 minutes on the Pi.
- [ ] **Re-provision the sandbox account** — to test branding end-to-end, trigger re-provision for sandbox account 47 so its Cal.diy User gets `brandLogoUrl` and `brandName` set. Can be done from the Integrations panel or via direct API call.
- [ ] **Make a test booking** — verify the confirmation email shows the client logo, the FROM name is "[Client Name] Booking", and no organizer email arrives at `elfronza@gmail.com`.
