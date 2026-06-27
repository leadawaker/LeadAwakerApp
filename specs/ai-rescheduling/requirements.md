# Requirements: AI Rescheduling + "Reschedule Call" Button

## What and Why

When a booked call needs to move (client double-booked, lead asks to change, no-show), there is no
in-platform way to handle it today. The client's only options are to edit their own calendar (which
silently desyncs everything, see the one-way gotcha below) or to do nothing.

This feature adds two complementary paths to move or recover a booked call, both of which keep the
lead, the CRM, and the calendar in sync, and neither of which double-charges the client:

1. **"Reschedule call" button** (manual) on the lead's booking section. Lets the client/admin move
   the call themselves via Cal.com's native reschedule flow (e.g. after getting the lead on the
   phone), OR hand it to the AI.
2. **AI re-engage rescheduling** (automation). The differentiator: the AI re-opens the WhatsApp
   conversation, tells the lead something came up, and walks them to pick a new time on the booking
   link. Fed the full conversation history + a structured reason. Reuses the existing re-engagement
   machinery. [[project_contact_later_reengagement]]

## Billing rule (hard requirement)

A rescheduled/rebooked call **must NOT count as a second billable booking.** The original
`BOOKING_CREATED` is the one billable event per lead. Reschedules fire `BOOKING_RESCHEDULED` and must
update the booking in place (`booked_call_date`, `previous_booked_call_date`, `re_scheduled_count++`)
without incrementing any invoice/metrics booking counter. The client charging model intentionally
charges for the booking regardless of whether the call ultimately happens, so the client has the
incentive to rebook rather than cancel, and a cancel+rebook of the same lead is still one booking.

## The one-way calendar gotcha (must be enforced in copy)

Cal.com is one-way for bookings: it writes the event into the client's Google/Outlook but does NOT
watch that calendar for edits to its own events. If a client moves a booked call inside their own
calendar, nothing syncs back: no `BOOKING_RESCHEDULED` fires, the CRM stays stale, the lead is never
told. The UI must steer clients to the Reschedule button and warn against editing the calendar directly.

## Acceptance Criteria

### Reschedule button
- [ ] A "Reschedule call" action appears on `LeadBookingSection.tsx` whenever a lead has a booked call
- [ ] It offers two choices: **"Pick a new time"** (open Cal.com reschedule flow) and **"Let AI rebook"** (trigger the automation)
- [ ] "Pick a new time" opens the Cal.com reschedule URL for the stored `calcom_booking_uid`; completing it fires `BOOKING_RESCHEDULED` → the existing webhook updates the lead in place
- [ ] After a reschedule, the booking section shows the new date, the struck-through previous date, and an incremented reschedule count (all already rendered by `LeadBookingSection.tsx`)
- [ ] A short inline warning near the action: do not move the call by editing your own calendar

### AI re-engage rescheduling
- [ ] "Let AI rebook" (and, optionally, an auto-trigger on `BOOKING_CANCELLED`) starts a rescheduling automation for that lead
- [ ] The automation is fed the full conversation + a structured `reschedule_reason` (`client_requested` / `no_show` / `lead_requested` / `cancelled`)
- [ ] The AI re-opens the WhatsApp thread with a context-aware message and drives the lead back to the booking link to pick a new time
- [ ] When the lead rebooks, the existing booking webhook handles it as a reschedule (in place, no double-bill)
- [ ] All automation steps log to `Automation_Logs` via the standard logger

### Cancellation handling
- [ ] On `BOOKING_CANCELLED`, the lead's status/booking fields are updated appropriately (not left showing a stale booked call)
- [ ] Optionally (configurable), a cancellation auto-triggers the AI re-engage rescheduling flow

## Related Features / Dependencies

- Booking webhook (already handles `BOOKING_RESCHEDULED`/`BOOKING_CANCELLED`, auto-cancels the prior
  booking, persists `calcom_booking_uid`): `/home/gabriel/automations/src/webhooks/booking_routes.py`
- Booking UI section (already renders reschedule count + previous date): [client/src/features/leads/components/leadDetail/LeadBookingSection.tsx](client/src/features/leads/components/leadDetail/LeadBookingSection.tsx)
- Lead fields already exist: `booked_call_date`, `previous_booked_call_date`, `re_scheduled_count`, `calcom_booking_uid`
- AI conversation + re-engagement engine (Python): `ai_conversation.py`, bump/re-engagement flow. Read `/home/gabriel/automations/CLAUDE.md` before touching.
- Prompt_Library is the source of truth for any new AI prompt (a `system:reschedule-reengage` entry), NOT the campaign field. [[feedback_prompt_source_of_truth]]

## Out of Scope

- Two-way calendar sync (detecting external calendar edits) — not feasible with Cal.com's model
- Reschedule analytics dashboard (the count is shown on the lead; aggregate reporting is later)
- Multiple distinct booking types per lead (one active booking per lead assumed)
