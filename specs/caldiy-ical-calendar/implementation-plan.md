# Implementation Plan: Apple / iCal (CalDAV) Calendar Support

## Overview

Add a no-OAuth "Apple / iCal" connect path. The client submits an Apple ID + app-specific password
(or, advanced, a CalDAV server URL). LeadAwaker validates and writes a Cal.diy `Credential` +
`SelectedCalendar` (read-only busy source, no `DestinationCalendar`). Mirrors the existing
Google/Outlook injection but with username/password instead of an OAuth token, and a UI form instead
of a redirect.

No Cal.diy rebuild required — all changes are runtime DB writes + a LeadAwaker form. The Cal.diy
encryption key (`CALENDSO_ENCRYPTION_KEY` in `/home/gabriel/caldiy/.env`) must be readable from the
injection script.

---

## Phase 1: Cal.diy injection script for CalDAV credentials

A new Prisma script (run by Express, same pattern as `inject-calendar-credential`) that writes the
Apple/CalDAV `Credential` + `SelectedCalendar`, validating first.

### Tasks

- [x] Create `/home/gabriel/caldiy/scripts/inject-caldav-credential.ts` [complex]
  - [x] Read inputs from env: `LA_EMAIL` (to locate the Cal.diy user), `CALDAV_USERNAME`, `CALDAV_PASSWORD`, `CALDAV_URL` (default `https://caldav.icloud.com` for Apple), `CALDAV_KIND` (`apple` | `caldav`)
  - [x] Locate the Cal.diy `User` by `email = LA_EMAIL`; error to stderr + exit 1 if missing
  - [x] Build the encrypted key: `symmetricEncrypt(JSON.stringify({ username, password, url }), process.env.CALENDSO_ENCRYPTION_KEY)`
  - [x] Validate before persisting: instantiate the calendar service and call `listCalendars()` (mirror `caldavcalendar/api/add.ts`); on failure, print a clean error to stdout JSON `{ ok:false, error }` and exit 1 WITHOUT writing
  - [x] Upsert the `Credential` (find existing by `userId` + `type`; update key if present, else create)
  - [x] Create a `SelectedCalendar` for the discovered primary calendar's `externalId` (read-only busy source)
  - [x] Print `{ ok:true, integration, externalId, credentialId }` JSON on stdout
- [x] Create shell wrapper `/home/gabriel/caldiy/inject-caldav-credential.sh` (mirrors `provision-leadawaker.sh`: loads `.env`, runs the tsx script, passes env through)

### Technical Details

**Credential shape (Apple)** — from `packages/app-store/applecalendar/api/add.ts`:
```ts
{
  type: "apple_calendar",
  appId: "apple-calendar",
  key: symmetricEncrypt(JSON.stringify({ username, password, url }), CALENDSO_ENCRYPTION_KEY),
  userId,
  teamId: null,
  invalid: false,
  delegationCredentialId: null,
}
// url for Apple/iCloud: https://caldav.icloud.com
```

**Credential shape (generic CalDAV)** — from `packages/app-store/caldavcalendar/api/add.ts`:
```ts
{ type: "caldav_calendar", appId: "caldav-calendar", key: symmetricEncrypt(JSON.stringify({ username, password, url }), ...), userId, ... }
// url = the client-supplied CalDAV server URL
```

**Validation pattern** (copy from `caldavcalendar/api/add.ts` lines 38-44):
```ts
const dav = BuildCalendarService({ id: 0, ...data, user: { email: user.email }, encryptedKey: null });
await dav?.listCalendars(); // throws on bad creds — catch, report, do not persist
```
`BuildCalendarService` lives in `packages/app-store/caldavcalendar/lib` (Apple reuses the CalDAV
service). Confirm the exact import path in the script.

**SelectedCalendar (read-only busy source):**
```ts
await prisma.selectedCalendar.create({
  data: { userId, integration: "apple_calendar", externalId: <primary cal externalId>, credentialId: credential.id },
});
```
Get `externalId` from the `listCalendars()` result (the primary/default calendar). Whether to ALSO
create a `DestinationCalendar` (write-back) is the Phase 4 decision — recommended ON for Apple so the
client sees their bookings. Drive it from a script flag (e.g. `CALDAV_WRITEBACK=1`) so both paths are
supported without code changes.

**Encryption key:** `CALENDSO_ENCRYPTION_KEY` is in `/home/gabriel/caldiy/.env`; the shell wrapper
already sources `.env`, so `symmetricEncrypt` picks it up via `process.env`.

---

## Phase 2: LeadAwaker server — call the injection script

### Tasks

- [x] Add `injectCaldavCredentialToCaldiy(account, { kind, username, password, url })` to [server/calendar/caldiy.ts](server/calendar/caldiy.ts)
  - [x] Spawn `inject-caldav-credential.sh` with env vars (`LA_EMAIL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD`, `CALDAV_URL`, `CALDAV_KIND`), same child-process pattern as the existing inject/provision helpers
  - [x] Parse the stdout JSON; throw on `{ ok:false }` so the caller can surface the validation error to the client
- [x] Add a route in [server/routes/calendar.ts](server/routes/calendar.ts): `POST /api/calendar/connect-caldav`
  - [x] Body: `{ accountId, kind: "apple"|"caldav", username, password, url? }`
  - [x] Auth: same guard as the other connect routes; client (read-only) user must be allowed for their own account
  - [x] Resolve the account, call `injectCaldavCredentialToCaldiy`, return `{ ok, integration }` or a 400 with the validation error message
  - [x] Never log the password

### Technical Details

- Reuse the child-process spawn + `LA_*` env convention already in `server/calendar/caldiy.ts`
  (look at how `provisionCaldiyForAccount` / the Google inject path build `env` and read stdout).
- The account's Cal.diy user is keyed by the account email (`LA_EMAIL`), consistent with the
  provision script's `findUnique({ where: { email } })`.
- This endpoint does the calendar connection only; it does NOT change LeadAwaker schema (the Apple
  credential lives solely in Cal.diy, exactly like Google/Outlook tokens).

---

## Phase 3: Client UI — Apple / iCal connect form

### Tasks

- [x] Add an "Apple / iCal" entry to the connect control in `IntegrationsPanel.tsx` (the same place
      Google/Outlook are offered — `CalendarConnectCard`)
  - [x] Selecting it opens a small inline form: Apple ID (email) + app-specific password,
        plus an "Advanced: custom CalDAV server" disclosure that reveals a URL field and switches
        `kind` to `caldav`
  - [x] Submit POSTs to `/api/calendar/connect-caldav`; on success show the same "connected" state
        as Google/Outlook; on error show the returned validation message inline
  - [x] Help text + link: "Generate an app-specific password at appleid.apple.com → Sign-In and
        Security → App-Specific Passwords" (i18n)
- [x] Add i18n strings to `client/src/locales/{en,nl,pt}/accounts.json` (labels, help text, errors)
- [x] Reflect connection state: once a CalDAV credential exists, show it in the connected-calendars
      list with a disconnect action (existing connected-calendars list shows it automatically)

### Technical Details

- Follow the existing connect-card markup/tokens (`UI_STANDARDS.md`); do not introduce new colors.
- The form is the only place a password is handled — send over HTTPS to the connect route, never
  store it in LeadAwaker state beyond the request.
- Apple app-specific passwords are formatted like `xxxx-xxxx-xxxx-xxxx`; accept with or without
  dashes (Cal.diy handles either).

---

## Phase 4: write-back (RECOMMENDED for Apple, not optional)

Unlike Google/Outlook, an Apple read-only connection means the client never sees their bookings in
their own calendar. Because CalDAV supports write, the recommendation is to enable write-back for
Apple by default.

### Tasks (recommended path)

- [x] In the Phase 1 injection script, also create a `DestinationCalendar` row for the same
      `userId` / `integration` / `externalId` / `credentialId`, so Cal.com writes the booked event
      into the Apple calendar (driven by `CALDAV_WRITEBACK=1` env flag, default ON for Apple)
- [ ] Confirm the user-level / event-type destination picks up this `DestinationCalendar` (the
      provision script's 30min event type should inherit the user-level destination — verify, same
      open item noted for Google/Outlook)

### Fallback path (if Gabriel chooses read-only first)

- [x] `CALDAV_WRITEBACK=0` skips `DestinationCalendar` creation (auto for caldav kind)
- [x] Apple-only caveat surfaced in the "Advanced CalDAV" disclosure: connecting with a custom
      URL uses caldav kind (no write-back) and the note text explains bookings won't appear in Apple calendar.
