# Dispatch Prompt — Spec 3: AI Rescheduling + "Reschedule Call" Button

Implement the **ai-rescheduling** feature in the LeadAwaker CRM (`/home/gabriel/LeadAwakerApp`). Spans the React CRM, Express server, AND the Python engine.

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md`, `/home/gabriel/automations/CLAUDE.md`, and all three files in `specs/ai-rescheduling/` — the source of truth.
- Read before coding: `client/src/features/leads/components/leadDetail/LeadBookingSection.tsx` (the button's home, already renders reschedule count + previous date) and `/home/gabriel/automations/src/webhooks/booking_routes.py` (`_handle_booking`, auto-cancel-previous ~line 377, `_handle_reschedule` ~line 664).

## The critical billing logic (verified — do not get this wrong)
Bookings are counted by **lead status**: `COUNT(*) FILTER (WHERE "Conversion_Status"='Booked')` (`/home/gabriel/automations/tools/db/leads.py:304`). Consequences:
- **Rebooks already can't double-count** (same lead stays Booked). Phase 3 is *verify status never leaves Booked*, not a new guard.
- **A cancellation must NOT erase the charge** (Gabriel wants cancelled calls still billed). Bill off a **durable signal** (`booking_confirmed_at` / a new `billable_booking` flag), NOT live `Conversion_Status`. On a genuine cancel, move pipeline status but PRESERVE the durable signal.

## The two reschedule mechanisms (don't conflate — see plan table)
- **"Pick a new time"** → Cal.com `/reschedule/{uid}` → `BOOKING_RESCHEDULED` → `_handle_reschedule` (increments `re_scheduled_count`).
- **AI rebook via booking link** → fresh `BOOKING_CREATED` (new UID) → `_handle_booking` + auto-cancel-previous, which does NOT bump `re_scheduled_count`. **The AI flow must set `re_scheduled_count` + `previous_booked_call_date` itself.**
- Distinguish the reschedule-driven auto-cancel of the previous booking from a genuine `BOOKING_CANCELLED` (only the latter changes lead state).

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless asked (OOMs the Pi). Verify via `pm2 logs`. New Python modules need a manual engine restart.
- **Prompt_Library is the source of truth** for the new `system:reschedule-reengage` prompt — NOT `Campaigns.ai_prompt_template`. en + nl only (no pt-BR in campaign content).
- **Timestamps server-side** (`new Date()`); any new column via a direct `pg` script, not `db:push`.
- **i18n**: button/warning strings in `client/src/locales/{en,nl,pt}/leads.json`. Include the "don't move the call by editing your own calendar — it won't sync" warning.

## Build it phase by phase
`implementation-plan.md` Phases 1→4: (1) reschedule button + Cal.com reschedule URL, (2) AI re-engage automation (Python, new prompt), (3) durable billable signal, (4) cancellation handling. Check off each `- [ ]`.

## Parallel-dispatch coordination
**notification-settings-overhaul** also edits `server/routes/leads.ts` and the Python engine — coordinate / expect conflicts. Reuse the contact-later re-engagement machinery rather than building a new sender.
