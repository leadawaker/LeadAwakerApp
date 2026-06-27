# Implementation Plan: Manual Busy Blocks on the LeadAwaker Calendar Page

## Overview

Add a LeadAwaker-owned `calendar_blocks` table. Surface CRUD on the Calendar page. On every
block change, resync the account's Cal.diy schedule so the booking page hides those slots. The resync
is done by emitting Cal.com **date-override** `Availability` rows = (working window for that weekday)
minus (blocks on that date). This reuses the existing schedule-resync mechanism and needs no new
Cal.com concept and no Cal.diy rebuild.

---

## Phase 1: LeadAwaker schema — calendar_blocks table

### Tasks

- [ ] Add a `calendarBlocks` table to [shared/schema.ts](shared/schema.ts)
  - Columns: `id` (serial pk), `accountId` (fk → accounts), `startsAt` (timestamp), `endsAt`
    (timestamp), `allDay` (boolean default false), `label` (text, nullable), `createdBy` (int,
    nullable), `createdAt`/`updatedAt` (timestamps, server-set)
  - Index on `(accountId, startsAt)`
- [ ] Create the table on the Pi via a direct `pg` SQL script (NOT `db:push` — no TTY on Pi)

### Technical Details

**Timestamps:** store as real `timestamp` columns; per the project rule, set `createdAt`/`updatedAt`
server-side with `new Date()` objects, never ISO strings from the client (Drizzle-Zod `z.date()`).
`startsAt`/`endsAt` are the block's actual datetimes — also construct them server-side from the
client-sent date + time strings, or validate/coerce to `Date` before insert.

**Table creation on Pi** (memory: `db:push` fails without TTY):
```bash
node --env-file=.env -e '<pg client INSERT of CREATE TABLE ...>'
```
Mirror an existing manual-table script in the repo for the exact `pg` boilerplate.

---

## Phase 2: Server — blocks CRUD + resync trigger

### Tasks

- [ ] Add storage methods in the appropriate `server/storage/` domain module (e.g. a new
      `calendarBlocks.ts` or fold into the calendar/accounts module): `listBlocks(accountId)`,
      `createBlock(...)`, `updateBlock(...)`, `deleteBlock(id)`. Export via the `storage` barrel.
- [ ] Add routes in [server/routes/calendar.ts](server/routes/calendar.ts):
  - `GET /api/calendar/blocks?accountId=` → list
  - `POST /api/calendar/blocks` → create
  - `PATCH /api/calendar/blocks/:id` → update
  - `DELETE /api/calendar/blocks/:id` → delete
  - Auth guard: account-scoped; client (read-only) user allowed for their own account's blocks
- [ ] After any create/update/delete, fire-and-forget `resyncCaldiySchedule(accountId)` (best-effort,
      logged) so the Cal.diy booking page updates

### Technical Details

- Set timestamps server-side (`new Date()`); accept only date + time strings from the client and
  build the `Date` objects on the server.
- Resync is best-effort: a resync failure must not fail the block write (the block still persists and
  shows on the Calendar page). Log and move on, same pattern as the existing inject/resync callers.

---

## Phase 3: Resync — emit Cal.com date-override rows

Extend the schedule-resync path so it accounts for manual blocks, not just the recurring working
window.

### Tasks

- [ ] Extend `resyncCaldiySchedule()` in [server/calendar/caldiy.ts](server/calendar/caldiy.ts) to
      pass the account's blocks (next ~60–90 days) to the Cal.diy resync script as JSON env/arg
- [ ] Update `/home/gabriel/caldiy/scripts/resync-schedule.ts` + `_schedule.ts` to write **date
      override** `Availability` rows for each blocked date [complex]
  - [ ] For each date that has ≥1 block, compute available intervals = weekday working window MINUS
        the union of that date's blocks
  - [ ] Emit one override `Availability` row per remaining interval, with `date` set to that day and
        `startTime`/`endTime` to the interval (UTC-time-of-day convention, same as `_schedule.ts`)
  - [ ] If a date is fully blocked (no remaining interval), emit a single "unavailable" override row
        for that date
  - [ ] Replace the user's schedule rows transactionally: keep the recurring weekday rows, replace
        the date-override rows for the affected window (delete old overrides in range, insert new)

### Technical Details

**Cal.com availability model** (`@calcom/lib/availability`, `Availability` table):
- Recurring rows carry `days` (weekday array), `startTime`, `endTime`, `date = null`.
- **Date-override rows carry `date` (the specific day)** plus `startTime`/`endTime`; they override
  the weekday default for that single date.
- Existing helper `availabilityFromHours()` in `_schedule.ts` builds the recurring rows; add a
  sibling `dateOverridesFromBlocks(workingStart, workingEnd, blocks)` that returns override rows.

**Interval subtraction (block 12:00–14:00 on a 09:00–17:00 day):**
```
working:  [09:00, 17:00]
block:    [12:00, 14:00]
result overrides for that date: [09:00, 12:00] and [14:00, 17:00]
```
Use the same `setUTCHours` time-of-day convention as `timeRange()` in `_schedule.ts`.

**Fully-blocked date representation — VERIFY before coding:** confirm how Cal.com marks a date
override as fully unavailable. In current Cal.com this is an `Availability` row with `date` set and a
zero-length interval (`startTime === endTime`, both at 00:00). Check `getAvailabilityFromSchedule` /
the date-override read path in `@calcom/lib/availability` and the Cal.com UI's "Unavailable" override
behavior to confirm the exact row shape, then mirror it.

**Transactional replace:** in `resync-schedule.ts`, within the existing schedule-update transaction,
delete date-override rows whose `date` falls in the resync window and insert the freshly computed
ones. Leave recurring weekday rows untouched (they come from business hours).

---

## Phase 4: Calendar page UI

### Tasks

- [ ] On [client/src/pages/Calendar.tsx](client/src/pages/Calendar.tsx), add an "Add busy block"
      action and render blocks on the grid distinctly from booked calls
  - [ ] Create-block form/dialog: date, start, end, "all day" toggle, optional label
  - [ ] Optional: click-drag on the time grid to pre-fill a range (nice-to-have; the form is the
        minimum)
  - [ ] Edit/delete affordances on an existing block
  - [ ] Fetch via TanStack Query (`GET /api/calendar/blocks`); mutations invalidate the query and
        optimistically update
- [ ] Distinct styling for blocks vs booked calls (use existing tokens; do not hardcode colors —
      `UI_STANDARDS.md`)
- [ ] i18n strings in `client/src/locales/{en,nl,pt}/calendar.json`

### Technical Details

- Reuse the page's existing data-loading guards (note the skeleton-flash fix already applied:
  guard on `loading && data.length === 0`, not bare `loading`).
- Blocks and booked calls share the grid; differentiate visually (e.g. blocks as a muted hatched
  band, bookings as solid cards) using design tokens.
