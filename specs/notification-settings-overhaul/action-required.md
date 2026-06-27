# Action Required: Notification Settings Overhaul

Manual steps that must be completed by a human.

## During Implementation

- [ ] **Add the `email_enabled` column via a direct `pg` SQL script** — `npm run db:push` has no TTY
      on the Pi. Run:
      `ALTER TABLE "Notification_Preferences" ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;`
      with `node --env-file=.env`.
- [ ] **Confirm SMTP env is configured** for `server/email.ts` (the notification emails reuse its
      nodemailer transporter / `sendRawEmail`). Verify with `verifySmtp()` if unsure.
- [ ] **Decide the canonical booking client-notifier** — Express `leads.ts` vs the Python webhook.
      Both can fire `booking_confirmed`; pick ONE to notify the client to avoid duplicates (recommend
      the Python webhook as the true Cal.diy booking source). Read `/home/gabriel/automations/CLAUDE.md` first.

## After Implementation

- [ ] **Verify as a client (Viewer)** — log in as a client account user: only Booked + Campaign
      finished types show, only Email + Browser push columns, no Telegram, no standalone push card.
- [ ] **Verify booking toast + email reach the client** — flip a lead to Booked; the client gets the
      in-app toast and (if email enabled) the email; agency still gets theirs.
- [ ] **Confirm agency view unchanged** except the added Email column.
