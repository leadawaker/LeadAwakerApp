# Action Required: Manual Busy Blocks on the LeadAwaker Calendar Page

Manual steps that must be completed by a human.

## During Implementation

- [ ] **Create the `calendar_blocks` table via a direct `pg` SQL script** — `npm run db:push` fails
      on the Pi (no TTY). Run the CREATE TABLE with `node --env-file=.env`, mirroring an existing
      manual-table script.
- [ ] **Verify Cal.com's fully-blocked date-override row shape** — before coding Phase 3, confirm in
      `@calcom/lib/availability` how a date override marked "Unavailable" is stored (expected:
      `Availability` row with `date` set and `startTime === endTime`). Mirror exactly.

## After Implementation

- [ ] **Test no-calendar client** — for an account with no connected calendar, add a full-day block
      and a partial block; confirm the booking page hides the full day and only the partial window.
- [ ] **Test connected-calendar client** — for an account WITH Google/Outlook connected, confirm a
      manual block is additive: it hides slots on top of the real calendar busy-times, and deleting
      it restores them.
- [ ] **No Cal.diy rebuild needed** — resync is a runtime DB write; do not rebuild Cal.diy.
