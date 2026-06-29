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

## Billing rule (hard requirement) — verified against the counting query

**`billable_booking` is the per-booking ledger.** Stamped `TRUE` on the first `BOOKING_CREATED` for
a lead, never cleared — not on reschedule, not on cancellation. One stamp per lead means rebooks
never produce a second charge. The billing query is `SELECT leads WHERE billable_booking = TRUE` (not
the live analytics metric).

The analytics metric (`COUNT(*) FILTER (WHERE "Conversion_Status" = 'Booked')`) is kept for
dashboards, but it shrinks when a lead's status leaves `Booked` — never bill off it.

**Cancellation billing rule:**

| Who cancels | Pipeline status | `billable_booking` |
|---|---|---|
| **Lead cancels** | → `Cancelled` (genuine cancellation) | preserved — the call happened, charge stands |
| **Client reschedules / AI rebooks** | unchanged (it's a reschedule, not a cancel) | unchanged — no second charge |

The trap: Cal.com's reschedule flow auto-cancels the old booking, firing `BOOKING_CANCELLED` for the
old UID. That event looks identical to a lead genuinely cancelling. If both are handled the same way,
a client moving a call wrongly marks the lead `Cancelled`. The engine must distinguish them:

- **Reschedule-driven auto-cancel:** `cancelled_uid != lead.calcom_booking_uid` → skip all state changes
- **Genuine cancellation:** `cancelled_uid == lead.calcom_booking_uid` → update pipeline status, preserve `billable_booking`

The original `BOOKING_CREATED` is the one billable event per lead; reschedules update in place; a
cancellation changes pipeline status but never touches the billing stamp.

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
- [ ] When the lead rebooks via the link, the booking webhook's auto-cancel-previous path supersedes the old slot; the AI flow itself sets `re_scheduled_count` + `previous_booked_call_date` (the link path does NOT increment them — only the native reschedule handler does)
- [ ] All automation steps log to `Automation_Logs` via the standard logger

### Cancellation handling
- [ ] **Lead cancels (genuine):** pipeline status → `Cancelled`, booking display fields cleared — but `billable_booking` and `booking_confirmed_at_` are preserved; the call was booked and stays billed
- [ ] **Client reschedules / AI rebooks (auto-cancel of old UID):** the auto-cancel `BOOKING_CANCELLED` that Cal.com fires for the previous slot is silently skipped — no status change, no billing change; it is not a cancellation
- [ ] The engine distinguishes the two by comparing `cancelled_uid` against `lead.calcom_booking_uid`: mismatch = reschedule auto-cancel (skip); match = genuine cancel (update status, preserve billing stamp)
- [ ] Optionally (configurable), a genuine cancellation auto-triggers the AI re-engage flow

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
