# Booking Availability Onboarding — Design

Date: 2026-07-13

## Problem

Today the earliest slot a lead can book is hardcoded in the automation engine
(`slot_booking.py`): the offer window always starts at "tomorrow 00:00 UTC",
regardless of what a client actually wants. Some clients are fine with
same-day bookings given a few hours' notice; others need 48h. There is no way
to configure this per client, and no onboarding question that captures it.

Separately, call duration (`campaigns.defaultCallDurationMinutes`) and
business hours (`accounts.businessHoursStart/End`) already exist as fields
but are either unused in any UI (duration) or only editable in the
agency-facing account admin view (hours) — never asked of the client
directly, even though the client never touches cal.com themselves.

## Goal

Add a new **Availability** section to the client-facing onboarding wizard
(`ProfileWizard.tsx`) that asks, in one screen:

1. Opening time
2. Closing time
3. Call duration (minutes)
4. Minimum booking notice (hours)

All four are account-level settings. Business hours already push to the
client's real cal.diy schedule via the existing `resyncCaldiySchedule`
pipeline; the notice and duration fields are new plumbing described below.

## Data model changes

`shared/schema.ts`, `accounts` table:

```ts
minBookingNoticeHours: integer("min_booking_notice_hours").default(16),
defaultCallDurationMinutes: integer("default_call_duration_minutes").default(30),
```

- `minBookingNoticeHours`: hours between "now" and the earliest slot the AI
  will offer a lead. `0` = no minimum. Default `16` — chosen so a mid-afternoon
  booking still lands in the next morning (preserves today's de facto
  "starts tomorrow" behavior) without hard-blocking same-day bookings for
  clients who want them.
- `defaultCallDurationMinutes`: default call length in minutes, used as an
  account-level fallback. Default `30` (existing implicit default).
- `businessHoursStart` / `businessHoursEnd` (existing `time` columns) —
  unchanged, no migration needed.
- `openDays`: `integer[]` (or `smallint[]`), default `{1,2,3,4,5}` (Mon–Fri,
  `0=Sun...6=Sat` to match JS `Date.getDay()` / cal.com's `days` convention).
  **New column** — see "Weekday selection" below.

`timezone` (existing column, line 41): add `.default("Europe/Amsterdam")`.
All of Gabriel's clients are Netherlands-based, so rather than adding a
timezone picker to the wizard, every account is simply correct by default
from creation. This closes the silent-fallback gap identified in review
(`resync-schedule.ts` resolving `LA_TIMEZONE || user.timeZone ||
"Europe/Amsterdam"` when `account.timezone` was never set) without adding a
question the client would never meaningfully answer differently.

No migration script needed beyond `DEFAULT` values on the new columns
(applied via a direct `pg` script per this repo's convention — `db:push` has
no TTY on the Pi).

## Booking-notice logic (engine)

`automations/src/automations/conversation/slot_booking.py`, where
`campaign_account` is already loaded (it already reads `account_timezone` /
`timezone`):

```python
min_notice_hours = campaign_account.get("min_booking_notice_hours", 16)
window_start = (now + timedelta(hours=min_notice_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
```

This replaces the hardcoded `now + timedelta(days=1)`. `window_end` stays
`now + 8 days`, unaffected.

This is a **pure floor** — the AI still asks cal.diy for real availability in
`[window_start, window_end]`, so the client's actual working hours (pushed
via `resyncCaldiySchedule`) always win. Example: notice = 4h, now = 13:00,
client closes at 17:00 → floor is 17:00, but cal.diy has no room for a slot
that lands exactly at closing, so the AI naturally offers tomorrow. Notice =
4h, now = 11:00 → floor is 15:00, and if cal.diy has 15:00/16:00 open, the AI
offers same-day. No special-casing needed; the existing day/time bucketing
(3 days × 3 times) in `slot_booking.py` is untouched.

Null-safety: `campaign_account.get("min_booking_notice_hours") or 16` in case
of a legacy row somehow missing the default.

**Other `window_start` call sites in this module — do not touch:**
- `conversation/reschedule.py:284` computes `requested_dt - timedelta(days=1)`
  to bracket a lead-*requested* reschedule date, not "now + notice". Unrelated
  to the initial-booking floor; leave as-is.
- `slot_booking.py:379` (`_fetch_day_slots`-style helper) computes the end of
  a day the lead already picked (stage 2 of the day→time flow), not an offer
  floor. Leave as-is.
- Only the `window_start` at `slot_booking.py:177` (the initial 3-day-offer
  fetch) is in scope for this change.

## Call duration wiring

`server/routes/leads.ts:222`, extend the existing fallback chain used when
pushing the booked event to the client's connected calendar:

```ts
const durationMin =
  lead.callDurationMinutes ||
  campaign?.defaultCallDurationMinutes ||
  account?.defaultCallDurationMinutes ||
  30;
```

(`account` needs to be fetched alongside `campaign` in that handler if not
already in scope.)

## Business hours & weekday selection

`businessHoursStart`/`businessHoursEnd` are already account fields; the
accounts PATCH route already calls `resyncCaldiySchedule(account.id)`
whenever either field changes (`server/routes/accounts.ts:93-94`). This
spec adds a third trigger field, `openDays`, and threads it through the
same pipeline so clients can mark which days they're open (e.g. including
Saturday) instead of the current hardcoded Mon–Fri.

**`server/routes/accounts.ts`**: extend the resync-trigger condition to
also fire on `openDays` changes:

```ts
if ("businessHoursStart" in parsed.data || "businessHoursEnd" in parsed.data || "openDays" in parsed.data) {
  void resyncCaldiySchedule(account.id!);
}
```

**`server/calendar/caldiy.ts` (`resyncCaldiySchedule`)**: pass the account's
`openDays` through as a new env var, e.g. `LA_OPEN_DAYS` (JSON array or
comma-separated `"1,2,3,4,5"`), alongside the existing
`LA_BUSINESS_HOURS_START/END`/`LA_TIMEZONE`.

**`~/caldiy/scripts/_schedule.ts` (`availabilityFromHours`)**: currently
hardcodes `const schedule: Schedule = [[], [range], [range], [range],
[range], [range], []]` (index 0=Sun, 6=Sat always empty). Change the
signature to accept an `openDays: number[]` parameter and build the
per-index array from it instead of the fixed literal:

```ts
export function availabilityFromHours(
  start?: string | null,
  end?: string | null,
  openDays: number[] = [1, 2, 3, 4, 5],
): Availability[] {
  if (!start || !end) return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  const range = timeRange(start, end);
  if (!range || range.start.getTime() >= range.end.getTime()) {
    return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  }
  const schedule: Schedule = [0, 1, 2, 3, 4, 5, 6].map((day) =>
    openDays.includes(day) ? [range] : []
  ) as Schedule;
  return getAvailabilityFromSchedule(schedule);
}
```

**`~/caldiy/scripts/resync-schedule.ts`**: read `LA_OPEN_DAYS`, parse to
`number[]`, pass through to `availabilityFromHours(start, end, openDays)`.
Default to `[1,2,3,4,5]` if unset (keeps the current Mon–Fri behavior for
any account that predates this change, until the account is re-saved).

This touches the separate `~/caldiy` repo, not just `LeadAwakerApp` — flag
this explicitly in the implementation plan so it isn't missed as "just a
CRM change."

One opening/closing time pair applies uniformly to every selected day
(no per-day hour variation, e.g. shorter Saturday hours) — matches the
scope decision to keep this a single time range + day toggle set, not a
per-day schedule grid.

Only the wizard-side UI is new for `businessHoursStart`/`End`/`openDays` —
this is the sole write path for business hours since clients never log
into cal.com/cal.diy directly.

## Account PATCH route

`server/routes/accounts.ts`: extend the accepted/validated body fields to
include `minBookingNoticeHours`, `defaultCallDurationMinutes`, and
`openDays`. `minBookingNoticeHours`/`defaultCallDurationMinutes` don't
affect the cal.diy schedule (no resync trigger needed); `openDays` does
(see "Business hours & weekday selection" above).

## Frontend: wizard section

`client/src/features/accounts/components/workspace/communication/profileConstants.ts`:

```ts
export type SectionKey = "tone" | "identity" | "availability" | "sales" | "facts" | "booking";
export const SECTIONS: SectionKey[] = ["tone", "identity", "availability", "sales", "facts", "booking"];
```

New step added to the merged step list, positioned in the `"availability"`
section (before `"sales"` / "Sales arguments"):

```ts
{ key: "availabilityHours", kind: "custom", section: "availability" },
```

`ProfileWizard.tsx`: extend the `kind === "custom"` render branch to handle
`def.key === "availabilityHours"`, rendering a new `AvailabilityCard`
component with `accountId`.

## New component: `AvailabilityCard.tsx`

Location: `client/src/features/accounts/components/workspace/AvailabilityCard.tsx`
(sibling to the existing `MeetingTypeCard.tsx`, same section/card shell —
`IntegSection`, `SectionHead`, `IconTile`).

Same pattern as `MeetingTypeCard`: local state seeded from props, PATCH
`/api/accounts/{accountId}` on change/blur, saving/justSaved/error
indicators.

Fields:
- **Open days** — 7 toggle pills (Mon Tue Wed Thu Fri Sat Sun), Mon–Fri
  pre-checked by default → `openDays` (`int[]`, `0=Sun...6=Sat`)
- **Opening time** — time input → `businessHoursStart`
- **Closing time** — time input → `businessHoursEnd`
- **Call duration (minutes)** — number input → `defaultCallDurationMinutes`
- **Minimum booking notice (hours)** — number input, clamped 0–168 →
  `minBookingNoticeHours`

One shared opening/closing time applies to all checked days — no per-day
hour variation in this version (see "Business hours & weekday selection").

Each field autosaves independently on blur/change, consistent with
`MeetingTypeCard`'s per-field PATCH calls (not one combined submit).

## Validation

- `minBookingNoticeHours`: clamp to `0–168` (1 week ceiling) server-side in
  the PATCH route validation. Non-integer/empty falls back to stored value
  rather than erroring the save.
- `defaultCallDurationMinutes`: reasonable bounds, e.g. `5–240`, same
  clamp-and-fallback approach.
- Opening/closing time: standard `time` column validation already handled by
  Drizzle-Zod; no new logic.

## i18n

New keys under the `accounts` namespace section already used by the wizard
(`meetingType.*` sibling → `availability.*`), `en` and `nl` only (no `pt`,
per existing project-wide PT deprecation). Section label
`sections.availability` alongside the existing `sections.sales` /
`sections.booking` keys in `communicationProfile.json`.

## Gaps found during review — resolved

- **Days-of-week hardcoded to Mon–Fri** → resolved by adding `openDays` and
  threading it through `_schedule.ts`/`resync-schedule.ts` (see "Business
  hours & weekday selection"). Clients can now mark Saturday (or any day)
  open.
- **No timezone field / silent fallback risk** → resolved by defaulting
  `accounts.timezone` to `"Europe/Amsterdam"` at the column level instead of
  adding a wizard question. All of Gabriel's clients are Netherlands-based,
  so there is no real per-client value asked; this just removes the gap
  where an unset `account.timezone` silently fell back inside
  `resync-schedule.ts`. If Lead Awaker ever takes on non-NL clients, this
  default will need revisiting (flagged here for future-self, not
  actionable now).

## Out of scope / explicitly deferred

- **Per-day hour variation** (e.g. Saturday 10:00–14:00 vs weekday
  09:00–17:00) — one shared time range applies to all open days. Real
  clients with shorter weekend hours would need to either accept the
  overlap or a future per-day-hours iteration.

- No campaign-level override for any of these four fields — account-level
  only, matches how the client will actually be asked ("what are your
  hours", not "what are your hours for this specific campaign").
- No changes to the existing `"booking"` section / `MeetingTypeCard` (how the
  call happens — phone/WhatsApp/etc.) — stays a separate section, unrelated
  concern.
- No product-tour/wizard-engine work — the scattered `data-onboarding`
  markers elsewhere in the app have no consumer and are out of scope here.
- Email notification on booking confirmation already works today
  (`notification_service.py`, `booking_confirmed` type has `email: True`
  wired) — not part of this spec, flagged separately if a specific client
  isn't receiving it.

## Testing / verification

- Manual: run through the wizard, confirm the Availability card sits before
  Sales arguments, confirm each field autosaves and matches DB state.
- Manual: change business hours in the wizard, confirm
  `resyncCaldiySchedule` fires (check pm2 logs / cal.diy schedule) same as
  it already does from the account admin view.
- Manual: toggle Saturday on with hours 10:00–14:00, confirm cal.diy's
  schedule actually shows Saturday as bookable (query the schedule via
  Prisma/cal.diy admin, or attempt to fetch a Saturday slot through
  `caldiy_get_availability`) and that Sunday remains closed.
- Manual: confirm a newly created account has `timezone` = `Europe/Amsterdam`
  by default with no wizard interaction, and that `resync-schedule.ts` logs
  show it using that value (not a cal.diy-user fallback).
- Manual: with a test campaign/lead, verify the AI does not offer a slot
  earlier than `now + minBookingNoticeHours`, and that same-day slots are
  offered when the notice window and cal.diy availability both allow it.
- Manual: confirm a booked call pushed to the connected calendar uses the
  correct duration fallback chain (lead → campaign → account → 30min).
