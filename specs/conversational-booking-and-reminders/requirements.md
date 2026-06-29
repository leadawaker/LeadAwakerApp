# Conversational Booking & Reminders — Requirements

**Status:** Draft (design approved 2026-06-28)
**Domain:** Automations engine (`/home/gabriel/automations/`, Python) + Prompt_Library
**Related:** Spec A = *booking-meeting-types* (produces the per-account `callingNumber` this spec consumes), Spec C = *booking-page-reviews* (separate). Read `/home/gabriel/automations/CLAUDE.md` first.

## Problem

The booking experience leaks conversions and pickups at the points we *can* control:
1. **Friction to book.** The AI sends a booking link; the lead must context-switch to a web page,
   load it, and fill a form. Every tap away from WhatsApp costs bookings.
2. **Unknown calling number.** Leads don't recognise the incoming voice number (different from the
   WhatsApp number), so they don't answer. We never make the number easy to *save*.
3. **No-shows.** Reactivated leads forget. There's no reminder on the channel they actually read.
4. **Reschedule path unverified** against the new Cal.diy setup.

Business model context: we charge **per booked call**, so no-shows are a *client-satisfaction*
risk, not a revenue mechanic. Making "our side" airtight (reminders, easy save, easy reschedule)
is what justifies the price.

## Goal

Move booking into the WhatsApp conversation, maximise call pickup via a saveable contact, and
reduce no-shows with a single well-timed reminder — reusing the existing booking webhook and
scheduler infrastructure.

## What already exists (extend, don't rebuild)
- `src/webhooks/booking_routes.py` → `_handle_booking()` already: marks the lead Booked, generates
  a lead summary, sends a **2-message** post-booking WhatsApp confirmation, and notifies. Also
  `_handle_reschedule()` exists for `BOOKING_RESCHEDULED`.
- `src/scheduler/jobs.py` registers the scheduled jobs (campaign_launcher, bump_scheduler,
  task_reminders, nightly_summary, etc.). The reminder is a NEW job here.
- WhatsApp send path exists (`whatsapp_cloud_routes.py`; clients on Twilio, self on Cloud API).
- Prompt_Library is the source of truth for conversation prompts (NOT `Campaigns.ai_prompt_template`).

## Scope

### In scope
1. **In-chat slot proposal (FR1).** The AI offers 2-3 concrete times *and* the booking link inline
   in the same message; books on reply via the Cal.diy API.
2. **vCard contact card (FR2).** After booking, send a tappable WhatsApp contact card carrying the
   client's calling number so the lead saves it in one tap.
3. **Post-booking confirmation copy (FR3).** Extend the existing 2-message confirmation with the
   calling number + a short "what to expect" recap (no named host — a random rep may answer).
4. **T-1h reminder (FR4).** A single reminder ~1 hour before the booked call, as a new scheduler job.
5. **Reschedule-via-chat verification (FR5).** Verify the AI can reschedule a Cal.diy booking via
   API and that a reschedule does **not** double-bill.

### Out of scope
- Meeting-type config / calling-number storage → **Spec A** (this spec consumes those fields).
- Booking-page reviews → **Spec C**.
- T-24h / T-10m reminders and "Reply YES to confirm" — explicitly dropped (single T-1h only).
- Named-host "who you're meeting" card — dropped (host is non-deterministic).

## Functional Requirements

### FR1 — In-chat slot proposal
- When the AI reaches the booking moment, it proposes **2-3 concrete slots** (drawn from Cal.diy
  availability) in the message, with the booking link inline as a soft fallback ("…or pick another
  time here: <link>"). Times are the primary CTA.
- On the lead picking a slot in chat, the engine **creates the booking via the Cal.diy API**
  (mapping to the account's configured meeting type / location from Spec A).
- If the lead rejects all offered slots, the AI proposes more (or the lead uses the link).
- Availability + booking go through Cal.diy so the existing `BOOKING_CREATED` webhook still fires
  and `_handle_booking()` runs unchanged.

### FR2 — vCard contact card
- After a successful booking (phone-call meeting type), send a WhatsApp **contact card** (vCard)
  whose number = the account's `callingNumber` (Spec A) and whose name = the client business name.
- Implementation differs by provider: WhatsApp Cloud API has a native `contacts` message type;
  Twilio sends a `text/vcard` media attachment. **Verify both paths.**
- WhatsApp-call meeting type: vCard carries the WhatsApp number instead (or is skipped — decide in
  planning; the lead already has that number in-thread).

### FR3 — Post-booking confirmation copy
- Extend `_handle_booking()`'s existing confirmation messages to include:
  - the calling number ("we'll call you from <number> — save it so you don't miss us 📲"), and
  - a short, niche-aware "what to expect" recap line.
- Keep it bilingual (en/nl) consistent with current `_handle_booking` language handling. Copy lives
  where the current confirmation copy lives (verify: inline vs Prompt_Library).

### FR4 — T-1h reminder
- New scheduler job in `src/scheduler/jobs.py` (+ a new module, e.g.
  `src/automations/booking_reminder.py`) that runs frequently (e.g. every 5-10 min), finds bookings
  whose `booked_call_date` is ~1 hour out and not yet reminded, and sends one WhatsApp reminder.
- Idempotent: mark a booking as reminded (a claim/flag) so it fires exactly once. Log every send to
  `Automation_Logs` via `AsyncLogStep`/`log_step`.
- Reminder echoes the "what to expect" line + the calling number.

### FR5 — Reschedule via chat (verify)
- Confirm the current "message us anytime to reschedule" flow reschedules a **Cal.diy** booking via
  API (updates `calcom_booking_uid` + `booked_call_date`, fires `BOOKING_RESCHEDULED` →
  `_handle_reschedule`).
- Confirm a reschedule does **not** create a second billable booked-call event.
- Mostly a verification + fix-if-broken task, not new architecture.

## Non-Functional / Constraints
- Read `/home/gabriel/automations/CLAUDE.md` before touching engine code.
- All automation runs MUST log to `Automation_Logs` via `AsyncLogStep`/`log_step`.
- Prompt changes go to **Prompt_Library**, not `Campaigns.ai_prompt_template`.
- Engine runs via pm2 as `leadawaker-engine` (port 8100); prompt/config changes may need a restart.
- Campaign content is en/nl only (pt-BR dropped for campaign content).

## Acceptance Criteria
1. At the booking moment the AI offers 2-3 concrete times + the link inline; replying with a choice
   creates a Cal.diy booking and the normal `_handle_booking()` flow runs.
2. After a phone-call booking, the lead receives a vCard they can save in one tap (verified on both
   Cloud API and Twilio).
3. The post-booking confirmation states the calling number + a what-to-expect recap, bilingually.
4. Exactly one reminder fires ~1h before the call; it's idempotent and logged to `Automation_Logs`.
5. A reschedule requested in chat updates the Cal.diy booking and does not double-bill.

## Open Implementation Questions (resolve during planning)
- Cal.diy API endpoints/auth for availability + create-booking + reschedule from the engine
  (what credentials the engine uses; confirm against Cal.diy's API).
- vCard mechanism per provider (Cloud API `contacts` vs Twilio media) and how the WhatsApp-call
  case is handled.
- Where the current post-booking copy lives (inline in `booking_routes.py` vs Prompt_Library) and
  the cleanest place to extend it.
- Reminder dedupe storage (a `reminded_at` column/flag vs a claim key like the channel-fallback
  `wa-fallback:<sid>` pattern).
