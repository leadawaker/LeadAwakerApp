# Booking Reminders (24h + 1h) and In-Chat Cancel

**Date:** 2026-07-02
**Status:** Design (approved scope, implementation on hold)
**Service:** Python automation engine (`/home/gabriel/automations/`)

## Context and Problem

We now book calls mostly verbally in the WhatsApp chat: the AI proposes days, then times, and only offers the Cal.diy link as a fallback. When the lead books this way, the current follow-through has four gaps:

1. **Single reminder rung.** Only a T-1h WhatsApp reminder exists (`src/automations/booking_reminder.py`), keyed off `booked_call_date` with a single `booking_reminder_sent_at` flag. We want a 24h + 1h ladder (the reminder is effectively a booking-triggered bump).
2. **Reschedule does not reset the reminder.** The reschedule path (`ai_conversation.py`) updates `booked_call_date` but never clears `booking_reminder_sent_at`. A call rescheduled *after* a reminder already fired gets no reminder for the new time. This is rare with one rung today, but becomes common once a 24h rung exists.
3. **No in-chat cancel.** The engine has a Groq reschedule tool (`conversation/reschedule.py`) but no cancel tool. If a lead says "cancel," the AI ad-libs, the Cal.diy booking stays live, status stays `Booked`, and reminders keep firing at a call that will not happen.
4. **No fallback for intent detection.** Reschedule (and the new cancel) rely solely on Groq tool-calling. A Groq outage or timeout silently drops the intent.

## Goals

- Two-rung reminder ladder: **T-24h + T-1h**.
- **36h guard:** suppress the 24h rung for last-minute bookings so a freshly-booked call does not get a redundant "it's tomorrow" ping shortly after confirming.
- **Reschedule and cancel both reset** the reminder ladder so the new (or cleared) state is correct.
- **Cancel-via-chat tool** with a fixed **cancel-then-offer** posture (cancel immediately on a clear request, then warmly offer to rebook).
- **Groq to OpenAI fallback** for intent detection, shared by reschedule and cancel.

## Non-Goals

- `.ics` calendar invite (separate spec: `2026-07-02-booking-ics-calendar-invite-design.md`).
- WhatsApp Flow booking (separate spec: `2026-07-02-whatsapp-flow-booking-fallback-design.md`).
- Per-campaign cancel-posture config. YAGNI: ship the single sensible default (cancel-then-offer) and only add a dial if a client asks for save-first.

## Design

### Schema changes (`shared/schema.ts` + DB migration)

Current booking columns on `Leads`: `conversionStatus`, `bookedCallDate`, `bookingConfirmationSent`, `previousBookedCallDate`, `reScheduledCount`, `calcomBookingUid`, `bookingReminderSentAt`.

Add three nullable columns:

- `booking_reminder_24h_sent_at timestamptz` — 24h rung idempotency flag.
- `booking_reminder_1h_sent_at timestamptz` — 1h rung idempotency flag.
- `booked_at timestamptz` — when the current booking was created. Required for the 36h guard (gap between booking time and call time).

The legacy `booking_reminder_sent_at` is left in place but no longer read or written. New logic uses the two new flags.

Migration: `npm run db:push` fails on the Pi (no TTY), so add the columns via a direct `pg` SQL script run with `node --env-file=.env` (per project convention).

### Reminder ladder (`booking_reminder.py`)

The scheduler runs every 5 minutes. Two independent windows, each idempotent (mark the flag before the send, as today):

- **1h rung:** `booked_call_date` in `[now + 50m, now + 70m]` and `booking_reminder_1h_sent_at IS NULL`. Existing copy.
- **24h rung:** `booked_call_date` in `[now + 23h50m, now + 24h10m]` and `booking_reminder_24h_sent_at IS NULL` **and** `(booked_call_date - booked_at) >= 36h`. New copy ("Your call is tomorrow at HH:MM...").

**36h guard cases:**
- Booked less than 36h before the call: skip the 24h rung, send only the 1h reminder.
- Booked 36h or more before the call: send both rungs.
- `booked_at` NULL (legacy bookings): skip the 24h rung (send only 1h). Legacy rows are transient.

Copy is en/nl only (default nl), and both rungs keep the existing calling-number line ("we'll call you from X").

### Reschedule and cancel reset (`ai_conversation.py`)

- **On new booking** (`conversation/slot_booking.py::_create_booking_from_slot`): set `booked_at = NOW()` alongside `booked_call_date`.
- **On reschedule** (`ai_conversation.py` reschedule execution): in the update, also set `booking_reminder_24h_sent_at = NULL`, `booking_reminder_1h_sent_at = NULL`, and `booked_at = NOW()` (the reschedule time is the new reference for the 36h guard). The new call time gets a fresh ladder.

### Cancel-via-chat tool (new)

New module `conversation/cancel.py`, mirroring `conversation/reschedule.py`:

- **Detection:** a Groq `cancel_booking` tool (optional `reason` arg). Fires only on a clear cancel/no-attend intent, not vague replies ("sim", "ok", a question). Uses the shared fallback helper below.
- **Execution** (orchestrated in `ai_conversation.py`, only when the lead has `booked_call_date` or `calcom_booking_uid`):
  1. Call `caldiy_api.cancel_booking(uid, api_key)` (already exists: `POST /v2/bookings/{uid}/cancel`).
  2. On success, update the lead: `Conversion_Status = 'Cancelled'`, `previous_booked_call_date = booked_call_date`, `booked_call_date = NULL`, `calcom_booking_uid = NULL`, `booking_confirmation_sent = NULL`, both reminder flags = `NULL`, `booked_at = NULL`.
  3. Inject a `[CANCELLATION CONTEXT]` block into the system prompt instructing the AI: confirm the cancellation warmly, do **not** be pushy, then offer to find another time if they would like. If the lead then names a new time, the existing booking/reschedule flow handles the rebooking.
- **Webhook interaction:** Cal.diy will also emit a `BOOKING_CANCELLED` webhook. The existing handler (`src/webhooks/booking_routes.py::_handle_cancellation`) skips when the cancelled uid does not match the lead's current uid (`is_auto_cancel`). Because we NULL `calcom_booking_uid` in step 2, the webhook self-skips and does not re-clobber the status we set. Requirement: clear the uid so this guard holds.

### Intent-detection fallback helper (shared)

Add `detect_intent_with_tool(messages, tool_def, ...)` (in `conversation/helpers.py` or `tools/ai_service.py`):

- Try Groq `llama-3.3-70b-versatile` tool-calling first (fast, cheap).
- On exception, timeout, or empty `tool_calls`, retry the **identical** call against an OpenAI mini/nano model on the EU endpoint (`settings.intent_fallback_model`, a `gpt-5.x-mini`/`nano` tier). Both run through the same OpenAI-compatible `AsyncOpenAI` client already in `ai_service.py`, so the tool definition carries over unchanged.
- Return parsed args or `None`.

Refactor both the existing reschedule detection and the new cancel detection to use this helper, so reschedule also gains the fallback.

## Data Flow (cancel example)

```
lead: "I need to cancel our call"
  -> inbound_handler -> ai_conversation
  -> detect_intent_with_tool(cancel)  [Groq, OpenAI fallback]
  -> caldiy_api.cancel_booking(uid)
  -> update lead: status=Cancelled, clear booked_call_date + uid + reminder flags + booked_at
  -> inject [CANCELLATION CONTEXT] into prompt
  -> AI replies: warm confirmation + offer to rebook
  -> interaction logged; Cal.diy webhook self-skips
```

## Error Handling

- **`cancel_booking` API failure:** do not clear the booking fields or status; the AI apologizes and offers the booking link fallback (mirror the reschedule failure path).
- **Reminder send failure:** the flag is already set (idempotent), so the lead is not re-reminded (we prefer one missed reminder over a duplicate, matching current behavior).

## Testing

- Window math and the 36h guard (booked at 30h, 36h, 48h out).
- Flag idempotency (no duplicate sends across scheduler ticks).
- Cancel intent detection: true cases ("cancel", "I can't come anymore") vs false ("thanks", "what time again?").
- Reschedule resets both flags and `booked_at`.
- Chat cancel: webhook self-skips (no status re-clobber).
- Fallback helper: Groq failure path routes to OpenAI and still returns the intent.

## Rollout Notes

- DB columns via direct `pg` SQL script (no `db:push` on Pi).
- Engine runs via pm2 as `leadawaker-engine`; confirm whether the change needs a manual restart.
- **Do not deploy during live demos.** Hold implementation until Gabriel gives the all-clear.
