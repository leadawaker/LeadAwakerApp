# Dispatch Prompt — Spec 4: Apple / iCal (CalDAV) Calendar Support

Implement the **caldiy-ical-calendar** feature in the LeadAwaker CRM (`/home/gabriel/LeadAwakerApp`) + the self-hosted Cal.diy (`/home/gabriel/caldiy`).

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md` and all three files in `specs/caldiy-ical-calendar/` — the source of truth.
- Read the credential shapes you're mirroring: `/home/gabriel/caldiy/packages/app-store/applecalendar/api/add.ts` and `caldavcalendar/api/add.ts`. Read the existing injection pattern in `server/calendar/caldiy.ts` (the Google/Outlook token-injection helpers) — you're replicating it for CalDAV.

## The key design decision (already made in the spec — don't silently flip it)
**Write-back is RECOMMENDED ON for Apple.** Read-only (no `DestinationCalendar`) means an Apple-only client NEVER sees their bookings in their own calendar (unlike Google/Outlook which get the event written). Implement write-back behind a `CALDAV_WRITEBACK` flag (default on for Apple). If Gabriel chooses read-only, you MUST add the "bookings won't appear in your Apple calendar" caveat to the connect UI. See Phase 4.

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless asked (OOMs the Pi). Verify via `pm2 logs` + a real connect test.
- **No Cal.diy rebuild needed** — all changes are runtime DB writes (Credential + SelectedCalendar [+ DestinationCalendar]) + a LeadAwaker form. Do NOT rebuild Cal.diy.
- Encrypt the CalDAV password with Cal.diy's `CALENDSO_ENCRYPTION_KEY` (in `/home/gabriel/caldiy/.env`); the shell wrapper must source `.env`. **Never log the password.**
- **Validate before persisting**: call `listCalendars()` (mirror `caldavcalendar/api/add.ts`); on failure report a clean error and write nothing.
- **i18n**: connect-form strings in `client/src/locales/{en,nl,pt}/accounts.json`. Apple app-password help link to appleid.apple.com.
- **Styling**: follow `UI_STANDARDS.md` connect-card tokens; no raw hex.

## Build it phase by phase
`implementation-plan.md` Phases 1→4: (1) Cal.diy CalDAV injection script + shell wrapper, (2) Express `POST /api/calendar/connect-caldav`, (3) client Apple/iCal connect form, (4) write-back decision. Check off each `- [ ]`.

## Parallel-dispatch coordination
**calendar-manual-blocks** also touches `server/calendar/caldiy.ts` and the caldiy `scripts/` dir — expect a possible merge conflict; keep your CalDAV additions isolated (new script + new helper fn).
