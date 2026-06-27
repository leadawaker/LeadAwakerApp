# Requirements: Manual Busy Blocks on the LeadAwaker Calendar Page

## What and Why

Clients need a way to mark themselves busy without touching (or even having) an external calendar. A
client might use a paper calendar, an unsupported calendar service, or simply want to block a single
afternoon or a whole day without editing their Google/Outlook schedule.

This feature lets a client (or admin) **drop a busy block directly on the LeadAwaker Calendar page**.
That block immediately removes the corresponding slots from the client's Cal.diy booking page, so
the AI never offers a lead a time the client has manually marked off.

This solves three cases at once:
1. **No syncable calendar** — the only way these clients can convey availability.
2. **Unsupported calendar** (HubSpot, etc.) — same as above; we tell them "block time in LeadAwaker."
3. **Has Google/Outlook but wants a one-off** — block a whole day or a window without opening their
   external calendar.

Blocks are a LeadAwaker-owned concept. They layer on top of (do not replace) any connected
calendar's real busy-times: a slot is bookable only if it is inside working hours AND not covered by
a connected-calendar event AND not covered by a manual block.

## Acceptance Criteria

- [ ] The Calendar page has an "Add busy block" action (button, and/or click-drag a range on the grid)
- [ ] A block has: date, start time, end time (or "all day"), and an optional label/reason
- [ ] Blocks are stored in a new LeadAwaker table scoped to the account
- [ ] Creating, editing, or deleting a block resyncs the client's Cal.diy schedule so the booking
      page reflects it within seconds
- [ ] A full-day block removes the entire day from the booking page; a partial block removes only
      the covered window, leaving the rest of the working day bookable
- [ ] Blocks are visible on the Calendar page distinctly from booked calls (different styling)
- [ ] Works for accounts with NO connected calendar (the primary case) and for accounts WITH a
      connected calendar (blocks are additive to real busy-times)
- [ ] Deleting a block restores those slots on the booking page
- [ ] Recurring blocks are NOT required for v1 (single-date blocks only); note as future work

## Related Features / Dependencies

- Reuses the existing schedule resync plumbing: `resyncCaldiySchedule()` in
  [server/calendar/caldiy.ts:127](server/calendar/caldiy.ts) and `availabilityFromHours()` in
  `/home/gabriel/caldiy/scripts/_schedule.ts`, extended to emit Cal.com **date-override** rows.
- Complements `specs/caldiy-ical-calendar/` (sync path for clients who DO have a calendar); manual
  blocks are the path for clients who do not, plus one-off overrides for those who do.
- Lives on the existing Calendar page ([client/src/pages/Calendar.tsx](client/src/pages/Calendar.tsx)).

## Out of Scope

- Recurring blocks (every Wednesday, etc.) — future; v1 is single-date.
- Editing the recurring weekly working-hours window (that already exists as business hours on the account).
- Pushing blocks into the client's external calendar (blocks are LeadAwaker-internal busy-times
  only). NOTE: because a block is a Cal.com schedule date-override and NOT a calendar event, a
  client with Google/Outlook connected will NOT see the block in their actual calendar — only on the
  booking page and the LeadAwaker Calendar page. Writing a real busy event into the connected
  calendar is a clean opt-in future toggle (write via the connected credential) if clients ask for
  it; not in v1.
