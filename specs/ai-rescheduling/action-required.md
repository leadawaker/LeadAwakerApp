# Action Required: AI Rescheduling + "Reschedule Call" Button

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Read `/home/gabriel/automations/CLAUDE.md`** before touching the Python engine (rescheduling
      flow, send path, logging conventions).
- [ ] **Confirm the Cal.com reschedule URL format** for the self-hosted Cal.diy build — expected
      `{webappUrl}/reschedule/{bookingUid}`. Verify by opening it for a real `calcom_booking_uid`.

## During Implementation

- [ ] **Create the `system:reschedule-reengage` prompt in Prompt_Library** (en + nl) — this is the
      source of truth for the AI re-engage message, NOT the campaign field.
- [ ] **Engine restart** if a new scheduler/endpoint module is added (the engine needs a manual
      restart to pick up new modules, per prior notes).

## After Implementation

- [ ] **Decide the durable billable signal** — confirm whether to reuse `booking_confirmed_at` or add
      a `billable_booking` boolean. Billing must NOT key off live `Conversion_Status = 'Booked'`
      alone, or a cancellation erases the charge.
- [ ] **Verify billing across the full lifecycle** — book → reschedule twice → cancel; confirm the
      billable count for that lead stays exactly 1 (rebooks don't add, cancel doesn't remove) and the
      booking section shows reschedule count = 2.
- [ ] **Verify the one-way warning** — confirm the inline "don't edit your calendar directly" copy is
      visible on the reschedule action.
- [ ] **Test AI re-engage end to end** — trigger "Let AI rebook", confirm the lead receives a
      context-aware WhatsApp message and that rebooking via the link updates in place (no new billable booking).
