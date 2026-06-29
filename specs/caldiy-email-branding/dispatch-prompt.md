# Dispatch Prompt — Spec 5: Cal.diy Per-Client Email Branding

Implement the **caldiy-email-branding** feature in the self-hosted Cal.diy (`/home/gabriel/caldiy`) + a small LeadAwaker provision change (`/home/gabriel/LeadAwakerApp`).

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md` and all three files in `specs/caldiy-email-branding/` — the source of truth.
- Read before editing: `/home/gabriel/caldiy/packages/emails/src/components/EmailBodyLogo.tsx`, `packages/emails/email-manager.ts`, `packages/types/Calendar.d.ts`, and `/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts`. Trace the `EmailBodyLogo` → `BaseEmailHtml` → `BaseScheduledEmail` call chain before patching.

## ⚠️ This spec REQUIRES a Cal.diy rebuild (budget 5-10 min on the Pi)
React Email templates compile at build time. After Phase 3 template edits: `cd /home/gabriel/caldiy && npm run build && pm2 restart caldiy --update-env`. Run the build in a tmux/background session. Provision-script changes (runtime) do NOT need a rebuild.

## Scope note baked into the spec (don't over-suppress)
Phase 4 suppresses ONLY Cal.diy's own **organizer** confirmation email (via EventType `metadata.disableStandardEmails.confirmation.host = true`). This is independent of the LeadAwaker Python webhook's own confirmations and the in-app/email booking notification — leave those alone. Keep `confirmation.attendee = false` so the lead still gets their branded confirmation.

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless asked (OOMs the Pi).
- **Run the Cal.diy SQL via psql** with the caldiy creds in `implementation-plan.md` (ALTER TABLE `"User"` add `brandLogoUrl`/`brandName`; patch sandbox EventType id=6 metadata). Prisma migrations don't run interactively on the Pi.
- Branding source = the account's `logoUrl` (avatar) + `name` from LeadAwaker `Accounts`. If no logo, fall back to the LeadAwaker default logo.
- The caldiy repo needs `git config user.email/user.name` set before committing (it's a separate repo).

## Build it phase by phase
`implementation-plan.md` Phases 1→5: (1) Cal.diy `User` brand columns, (2) thread into `CalendarEvent`, (3) patch email templates + FROM name, (4) suppress organizer email, (5) provision script wiring + rebuild. Check off each `- [ ]`.

## Parallel-dispatch coordination
Build this LAST — it's the only spec needing a Cal.diy rebuild, so batch it after the no-rebuild specs land. Minimal overlap with the others (Cal.diy email package + provision script).
