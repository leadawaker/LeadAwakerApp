# Action Required: Apple / iCal (CalDAV) Calendar Support

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Confirm `CALENDSO_ENCRYPTION_KEY` is set** in `/home/gabriel/caldiy/.env` — the injection
      script encrypts the CalDAV password with it and Cal.diy must decrypt with the same key. (It is
      already used by the running Cal.diy app, so it exists; just confirm the shell wrapper sources it.)

## During Implementation

- [ ] **Have a test Apple ID + app-specific password ready** — generate one at appleid.apple.com →
      Sign-In and Security → App-Specific Passwords. Needed to validate the `listCalendars()` flow
      end to end against `https://caldav.icloud.com`.

## After Implementation

- [ ] **Test connect + busy-block** — connect the test Apple calendar, put a real busy event on it,
      open the booking page, confirm that slot disappears.
- [ ] **Confirm no write-back** — book a slot as a lead; confirm the event does NOT appear in the
      Apple calendar (read-only by design) but DOES appear in Cal.diy + the lead flips to Booked in
      LeadAwaker.
- [ ] **No Cal.diy rebuild needed** — all changes are runtime DB writes and a LeadAwaker form; do
      not rebuild Cal.diy for this feature.
