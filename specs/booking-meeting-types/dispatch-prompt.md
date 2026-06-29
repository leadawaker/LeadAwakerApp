# Dispatch Prompt — Spec A: Booking Meeting Types & Calling Number

Implement the **booking-meeting-types** feature in the LeadAwaker CRM (`/home/gabriel/LeadAwakerApp`) + the self-hosted Cal.diy (`/home/gabriel/caldiy`).

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md` and both files in `specs/booking-meeting-types/` (requirements.md +
  implementation-plan.md) — the source of truth.
- Read the provisioning chain you're extending: `server/calendar/caldiy.ts`
  (`provisionCaldiyForAccount` — env vars + the best-effort/fire-and-forget pattern) and
  `/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts` (the `locations` object + the
  event-type create block).
- Read where the new fields surface: `client/src/features/accounts/components/workspace/IntegrationsPanel.tsx`
  (911 lines — add a NEW small sub-component, don't inflate it) and
  `client/src/features/accounts/components/workspace/communication/ProfileWizard.tsx` (onboarding).

## The key design decision (already made — don't silently flip it)
**Settings are account-level, with ONE source of truth**, edited from two surfaces (Integrations
panel + onboarding wizard) that both write the same Accounts columns (`meeting_type`,
`calling_number`). WhatsApp call **reuses the existing WhatsApp messaging number** — only Phone call
gets the dedicated calling-number field. Meet/Zoom are **UI-only "Coming soon"** (disabled, no
backend).

## De-risk FIRST (Task 3 in the plan)
**Verify the Cal.diy WhatsApp-call location object before building UI on it.** Check
`/home/gabriel/caldiy/packages/app-store/locations.ts` (`DefaultEventLocationTypeEnum`) for how to
render a custom "WhatsApp call" label + number on the page/email/event. If there's no clean
custom-label type, fall back to `userPhone` with the WhatsApp number + label override. Phone call is
known: `userPhone` + `hostPhoneNumber = callingNumber`.

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless asked (OOMs the Pi). Verify via `pm2 logs` + a real booking.
- **No Cal.diy rebuild** — the change path is DB/EventType writes via the provision script. NOTE: the
  current script only sets `locations` on event-type *create*; you MUST add an **update branch** so
  re-provisioning an existing client applies a meeting-type change live (see plan Task 3).
- **DB column**: add `meeting_type` / `calling_number` to Accounts via a direct `pg` SQL script run
  with `node --env-file=.env` (db:push has no TTY on the Pi).
- **Timestamps**: these are text fields — never send ISO strings for them (project rule).
- **i18n**: all strings in `client/src/locales/{en,nl,pt}/accounts.json`. PT = Brazilian PT.
- **Styling**: follow `UI_STANDARDS.md`; reuse Integrations-panel card/field tokens; no raw hex.

## Build it task by task
`implementation-plan.md` Tasks 1→7: (1) schema + DB column, (2) server persist + re-provision on
change, (3) provisioning location mapping [de-risk first], (4) `MeetingTypeCard` sub-component in
the Integrations panel, (5) onboarding-wizard step reusing it, (6) i18n, (7) manual verification.

## Verification (must do)
Set a sandbox account to Phone call + a number, re-provision, make a NEW booking, and confirm the
booking **page**, **attendee email**, and **calendar event** all read "Phone call — we'll call you
from <number>". Then switch to WhatsApp call and confirm the label renders with no calling-number
field shown. Confirm changing an existing client applies WITHOUT a Cal.diy rebuild.

## Parallel-dispatch coordination
`server/calendar/caldiy.ts` and the caldiy `scripts/` dir are also touched by other Cal.diy specs
(caldiy-ical-calendar, calendar-manual-blocks) — keep your additions isolated (new env vars + a
`buildLocation()` helper) to avoid merge conflicts.

## Hand-off boundary
This is Spec A only. Do NOT build conversational booking, vCard, reminders, or booking-page reviews
(Specs B and C). Spec B *consumes* the `calling_number` you add here, so make sure it lands on the
Accounts table and is readable server-side.
