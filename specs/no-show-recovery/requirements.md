# Requirements: No-Show Recovery

## What & Why

When a lead books a call and doesn't show up, that lead is currently only recovered if someone manually presses "Let AI rebook". This feature makes no-show recovery part of the system:

1. **Client-facing no-show reporting.** The client (account user) reports a no-show themselves via a button in the CRM, with one of three reasons. This doubles as the "claim" for the 48h no-show window (billing dispute clock): the claim is timestamped, attributed to the reporting user, and auditable.
2. **Reason-mapped follow-up automations.** Each reason triggers a different automated response, so recovery runs without Gabriel or the client having to do anything further.
3. **48h post-call autonomous window.** After a conversation completes (booked + goodbye), the AI keeps answering inbound messages until `booked_call_date + 48h`. After that, the AI goes quiet, but the system stays autonomous: a cheap intent classifier routes clear rebook requests into the reschedule flow automatically; everything else generates a notification for a human, with no automated reply.

## The three reasons

| Reason (stored value) | Client-facing label | Automated follow-up |
|---|---|---|
| `not_interested` | "They told me they're no longer interested" | Mark lead Lost + automation completed. No outbound message. |
| `wants_other_time` | "They want a different time" | Existing reschedule re-engagement flow (`reschedule_reengage`, reason `no_show`): AI-drafted message with booking link. |
| `no_reason` | "They simply didn't show up" | New two-step recovery ladder: gentle "maybe you got busy, still interested?" check-in first (no link), booking link only on a positive reply or after 24h of silence. |

## Button placement (all three open the same dialog)

1. **Calendar page**: booking detail panel (`DesktopCalendarDetail.tsx`), for bookings whose start time has passed.
2. **Leads/Conversations chat**: the booking section of the lead detail panel (`LeadBookingSection.tsx`, next to the existing "Let AI rebook" button). This covers both the chat view and the Contacts detail view, since both render the lead detail panel.
3. **Contacts page**: row action in the table/pipeline for leads with `Conversion_Status = 'Booked'`.

Visibility rule (same everywhere): lead is Booked, `booked_call_date` is in the past, within the 48h claim window, and `no_show` is not already set. After reporting, the button is replaced by a claimed-state badge ("No-show reported: {reason}, {date}").

## Acceptance criteria

- [ ] Client can report a no-show with a reason from calendar, chat, and contacts; all three hit the same endpoint.
- [ ] Claim is rejected (client-side hidden + server-side 409) outside the 48h window after `booked_call_date`.
- [ ] Claim stores reason, timestamp, and reporting user id on the lead (audit trail).
- [ ] Each reason triggers exactly its mapped automation, and nothing else.
- [ ] `no_reason` ladder: check-in message within a minute of the claim; booking-link message only if the lead hasn't replied after 24h; ladder stops permanently once the lead replies (normal AI conversation takes over) or after the second message.
- [ ] Completed booked leads who message within `booked_call_date + 48h` still get a normal (classic/Live) AI reply, unchanged from today.
- [ ] Past 48h: no AI reply; if the message has clear rebook intent, the reschedule flow triggers automatically; otherwise the client gets a notification (via `broadcastToUser`, never `broadcast`).
- [ ] All new UI strings i18n'd (en + nl). All messages sent to leads localized via `lead.language`.
- [ ] Follow-ups skip leads with `opted_out`, `manual_takeover`, or DNC.
- [ ] A new booking (BOOKING_CREATED) resets all no-show claim state, so a rebooked lead gets a fresh claim window and any pending ladder step is cancelled.

## Dependencies / related

- Existing: `reschedule_reengage.py` (reason `no_show` already supported), engine endpoint `POST /api/leads/{id}/reschedule-reengage`, Express proxy pattern in `server/routes/leads.ts:391`.
- Existing Leads columns: `no_show` (boolean), `booked_call_date`, `billable_booking`.
- Scheduler framework in the automations engine (for the 24h ladder step).
- Notification SSE (`broadcastToUser`).
- Related open question (business, not build): whether a claimed no-show flips `billable_booking` — see action-required.md.
