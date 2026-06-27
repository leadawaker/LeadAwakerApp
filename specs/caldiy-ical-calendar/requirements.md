# Requirements: Apple / iCal (CalDAV) Calendar Support

## What and Why

Today a client can only connect a **Google** or **Outlook** calendar to their Cal.diy booking
page (via the one-click token injection built in the booking-automation work). Clients who live in
**Apple Calendar / iCloud** (or any CalDAV-compatible service) have no way to feed their real
busy-times into the booking page, so leads can be offered slots the client is actually busy.

This feature adds a **third connect option: Apple / iCal (CalDAV)**. Unlike Google/Outlook there is
no OAuth: the client provides an Apple ID + an app-specific password, which we hand to Cal.diy's
existing `apple_calendar` / `caldav_calendar` integration so it can **read free/busy** and block
those periods on the booking page.

**Read-only by design.** We connect it as a busy-time source only (`SelectedCalendar`), NOT as a
write destination (`DestinationCalendar`). Bookings are still created inside Cal.diy and the
attendee + client are emailed, but the event is **not pushed back** into the Apple calendar. This is
the explicitly chosen scope: write-back is a trivial future add (CalDAV supports it) but is not a
priority now.

## Acceptance Criteria

- [ ] Client (read-only Accounts view) sees an **"Apple / iCal"** option alongside Google/Outlook in the connect control
- [ ] Choosing it opens a small form: Apple ID (email) + app-specific password, with a help link explaining how to generate an app password at appleid.apple.com
- [ ] On submit, LeadAwaker writes a `Credential` (`type: "apple_calendar"`, `appId: "apple-calendar"`) + a `SelectedCalendar` row into the Cal.diy DB for that account's Cal.diy user, with the key encrypted using Cal.diy's `CALENDSO_ENCRYPTION_KEY`
- [ ] Cal.diy validates the credentials (lists calendars) before saving; bad credentials surface a clear error and nothing is persisted
- [ ] After connecting, real busy events on the client's Apple calendar remove the corresponding slots from the booking page
- [ ] No `DestinationCalendar` row is created (no write-back); bookings still land in Cal.diy + email + LeadAwaker webhook as today
- [ ] Generic CalDAV (custom server URL) is supported as an advanced sub-option (same flow, `type: "caldav_calendar"`, user supplies the server URL)
- [ ] Reconnecting refreshes the stored credential (idempotent, no duplicate rows)

## Related Features / Dependencies

- Builds on the Cal.diy token-injection mechanism in [server/calendar/caldiy.ts](server/calendar/caldiy.ts) and the connect UI in `IntegrationsPanel.tsx`
- Cal.diy already ships the `apple_calendar` and `caldav_calendar` apps (`packages/app-store/applecalendar`, `packages/app-store/caldavcalendar`) — we reuse their credential shape and `BuildCalendarService` validation, no Cal.diy rebuild required (these are runtime DB writes)
- The "manual blocks" feature (`specs/calendar-manual-blocks/`) is the complementary path for clients who have **no** syncable calendar at all

## Out of Scope

- Two-way write-back (pushing the booked event into the Apple calendar) — feasible later via `DestinationCalendar`, not now
- OAuth for iCloud (Apple does not offer it for CalDAV; app-specific password is the only path)
- Storing the Apple credential on the LeadAwaker side (it lives only in Cal.diy, same as Google/Outlook tokens)
