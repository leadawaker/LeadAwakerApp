# Client mobile polish: action required (Gabriel)

Round 1 is on branch `feat/client-mobile-polish` (unpushed to main). Nothing here was run against the Pi.

## Before merging
1. **Visual check on app.leadawaker.com** after checking out the branch on the Pi: Owner, then "view as" Manager 53,
   phone width 390px, NL, light and dark. Look at: bottom bar (wine pill), More page (logo, Account/Leads, no Settings),
   Calls (Stats / People), Chats (Stats / Chats, reply box), Leads (Table/Pipeline switch, Filter sheet, 4 columns), Home (Overview only).
2. **Sand shade**: `--chrome-deep` in `client/src/styles/variables.css` (`hsl(38 30% 84%)`). One value; change it there if it reads too dark/light.
3. **Merge order**: merge `fix/vercel-build` into `main` first (it is the failed Vercel deploy). When this branch (built on
   the WIP branch) later goes to main, delete the three restored files again: `ExtraInstructionsCard.tsx`,
   `ReadinessChecklist.tsx`, `WeekSummaryCard.tsx` (the WIP code uses the renamed/removed versions).

## Data / accounts (unchanged from the requirements)
- Thijs's user needs `full_name_1` set: it is the name a website visitor sees on a human reply.
- Thijs's login email, which account 53 leads are tests, restoring the handoff number +31681764763.

## Behaviour changes to know about
- `POST /api/interactions` now refuses Viewers, refuses clients writing to other accounts' leads (404), and only lets
  clients send outbound human replies. `PATCH /api/leads/:id` limits clients to name, phone, email, notes, stage,
  manual_takeover, team_members (403 otherwise). Rules + tests: `server/routes/leadWriteAccess.ts`.
- A client's WhatsApp reply box only appears when the account has a *connected* own sender
  (`GET /api/whatsapp-sender/has-own`). Website-chat visitors can always be answered.
- Sending from the lead chat composer now really sets `manual_takeover` first (it used to only change local state).
- Chats lists only leads with a website/WhatsApp chat (call-only leads moved out); counts follow.

## Rounds 2 and 3
Not started: C2, C6-C11, D4-D7, E (recap email, engine), F, H, I, J, K. They touch the Python engine and the Pi.
