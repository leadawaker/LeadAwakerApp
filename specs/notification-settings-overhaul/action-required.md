# Action Required: Notification Settings Overhaul

Manual steps that must be completed by a human.

## During Implementation

- [x] **Add the `email_enabled` column via a direct `pg` SQL script** — done. Both `email_enabled`
      (Notification_Preferences) and `email_sent` (Notifications) columns added via `node --env-file=.env`.
- [ ] **Confirm SMTP for BOTH senders** — Express `server/email.ts` (`sendRawEmail`, verify with
      `verifySmtp()`) AND the Python engine's existing SMTP helper (reuse it for the Python email
      channel; do not add a second transport). Read `/home/gabriel/automations/CLAUDE.md` first.
- [ ] **Confirm the booking notifier is the Python webhook** (verified: real Cal.diy bookings update
      the DB directly and create the `booking_confirmed` row in `booking_routes.py`, NOT via Express
      `leads.ts`). The Express booking notification stays for manual CRM flips only — confirm it does
      not double-fire for a webhook booking.

## After Implementation

- [ ] **Verify as a client (Viewer)** — log in as a client account user: only Booked + Campaign
      finished types show, only Email + Browser push columns, no Telegram, no standalone push card.
- [ ] **Verify booking toast + email reach the client** — flip a lead to Booked; the client gets the
      in-app toast and (if email enabled) the email; agency still gets theirs.
- [ ] **Confirm agency view unchanged** except the added Email column.
