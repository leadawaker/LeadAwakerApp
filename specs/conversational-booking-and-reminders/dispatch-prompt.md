# Dispatch Prompt — Spec B: Conversational Booking & Reminders

Implement the **conversational-booking-and-reminders** feature in the LeadAwaker **automations
engine** (`/home/gabriel/automations/`, Python) + Prompt_Library. This is engine work, not CRM UI.

## Prerequisite
**Spec A (booking-meeting-types) must be landed first** — this spec reads the per-account
`calling_number` / `meeting_type` it adds. Confirm those Accounts columns exist and are readable
server-side before starting FR2/FR3.

## Orient first (do this before any code)
- Read `/home/gabriel/automations/CLAUDE.md` — engine conventions (WAT framework, logging, pm2).
- Read both files in `specs/conversational-booking-and-reminders/` — the source of truth.
- Read what you're EXTENDING (do not rebuild): `src/webhooks/booking_routes.py` —
  `_handle_booking()` already marks the lead Booked, generates a summary, sends a **2-message**
  post-booking WhatsApp confirmation (~lines 493-559), and notifies; `_handle_reschedule()` exists.
- Read `src/scheduler/jobs.py` (where the T-1h reminder job registers alongside the existing jobs)
  and the WhatsApp send path (`src/webhooks/whatsapp_cloud_routes.py`; clients=Twilio, self=Cloud API).

## The key facts (already decided — don't re-litigate)
- **Single T-1h reminder only.** T-24h, T-10m, and "Reply YES to confirm" were explicitly dropped.
- **No named-host card** — a random rep may answer; use a generic "what to expect" recap instead.
- **Per-booked-call billing** → no-shows are a client-satisfaction risk, not revenue. Reminder must
  be strictly **idempotent** (exactly once) — double-reminding is a bad look.
- In-chat booking offers **2-3 concrete times + the link inline in the same message** (times are the
  primary CTA, link is the fallback).

## De-risk FIRST (Task 0 in the plan)
**Spike the Cal.diy API access from the engine** (availability / create-booking / reschedule + auth)
before building FR1. Output a small `src/tools/caldiy_api.py` client. FR1 (in-chat booking) depends
entirely on this; everything else (FR3 copy, FR5 verify, FR2 vCard) can proceed without it.

## Critical project rules (non-negotiable)
- **Prompt changes go to Prompt_Library**, NOT `Campaigns.ai_prompt_template` (`_load_prompt()`
  reads Prompt_Library first; the campaign field is a display cache).
- **Every automation run logs to `Automation_Logs`** via `AsyncLogStep`/`log_step`.
- **Campaign content is en/nl only** (pt-BR dropped for campaign content).
- Engine runs via pm2 as `leadawaker-engine` (port 8100); prompt/config changes may need a restart.
- **vCard differs by provider**: Cloud API native `contacts` message vs Twilio `text/vcard` media —
  verify BOTH.

## Build it task by task
`implementation-plan.md` Tasks 0→6: (0) Cal.diy API spike, (1) FR5 reschedule verify+fix, (2) FR3
confirmation copy (number + recap), (3) FR2 vCard, (4) FR1 in-chat slot proposal + book via API,
(5) FR4 T-1h reminder job, (6) end-to-end verification.

## Verification (must do, via pm2 logs)
End-to-end: AI offers 2-3 slots → lead picks → Cal.diy booking created → `_handle_booking` runs →
confirmation states the calling number + recap → lead receives a saveable vCard → exactly one
reminder fires ~1h before. Reschedule in chat moves the booking with no double-bill. All sends show
in `Automation_Logs`.

## Hand-off boundary
This is Spec B only. Do NOT touch the meeting-type UI / calling-number storage (Spec A — you only
*read* those fields) or booking-page reviews (Spec C).
