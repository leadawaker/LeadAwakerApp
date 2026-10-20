# Client mobile polish: action required (Gabriel)

Round 1 and the CRM part of Rounds 2-3 are on `main` (fast-forwarded from `feat/client-mobile-polish`).
Nothing here was run against the Pi or seen in a browser: unit tests and `vite build` only.

## Now
1. **Pull `main` on the Pi.** Vercel already serves the new frontend; it expects the new API (person filter on
   `/api/voice-calls`, `chatsOnly`, `/api/whatsapp-sender/has-own`, `?call=` on `/api/go`). The Pi's working tree held this
   work uncommitted (the WIP commit), so reset it to `origin/main` rather than merging over it.
2. **Visual check on app.leadawaker.com**: Owner, then "view as" Manager 53, 390px, NL, light and dark.
   - Round 1: bottom bar (wine pill), More page, Calls (Stats / People), Chats (Stats / Chats, reply box), Leads
     (Table/Pipeline, Filter sheet, 4 columns), Home (Overview only).
   - Round 2: People menus (filter by outcome / date range, sort by most calls, group by outcome), number search with
     `06…` / `+316…`, call lines inside a chat thread, avatar channel badge (only with both channels), "Visitor" names,
     Chats filter (Channel with icons, Tags folded), Table status pills, folded AI summary above a phone chat,
     My profile page (Profile / Notifications / Preferences), the client guide illustrations.
   - J: the yellow "viewing as" bar now has an "Automation logs" link.
3. **Sand shade**: `--chrome-deep` in `client/src/styles/variables.css` (`hsl(38 30% 84%)`). One value.
4. `fix/vercel-build` is no longer needed (main now carries the files its imports expect); delete the branch.

## Engine (Python, not in this repo)
- **E2:** the recap's call rows get an "Open →" link as soon as `summarize` in `recap_data.py` keeps `call_id` on each call.
  The CRM renderer, GoLink, the login return whitelist and the server check (the call must be a live call of the code's
  account) are done. "See all N calls" now goes through `/go/<code>?to=calls`.
- **E1:** empty agenda card: investigate `recap_data.py`'s agenda query (table, statuses, window, timezone, `is_test`).
- **C10:** check that `ai_summary` is generated for receptionist chats, in the lead's language.
- **I1/I2/I3/K:** chat handoff alerts to the client, WhatsApp to Gabriel for Message Gabriel and demo use, the
  Notifications tab switch from Telegram, and the Message Gabriel end-to-end test. Not started; they need the engine,
  a WhatsApp template and live testing.

## Data / accounts (unchanged)
- Thijs's user needs `full_name_1` set: it is the name a website visitor sees on a human reply.
- Thijs's login email, which account 53 leads are tests, an engine restart, restoring the handoff number +31681764763.

## Behaviour changes to know about
- `POST /api/interactions` refuses Viewers, refuses clients writing to other accounts' leads (404), and only lets
  clients send outbound human replies. `PATCH /api/leads/:id` limits clients to name, phone, email, notes, stage,
  manual_takeover, team_members (403 otherwise). Rules + tests: `server/routes/leadWriteAccess.ts`.
- A client's WhatsApp reply box only appears when the account has a connected own sender.
- Sending from the lead chat composer really sets `manual_takeover` first.
- Chats lists only leads with a website/WhatsApp chat; counts follow.
- Clients' Chats filter no longer offers Channel type, Account or Campaign; their group menu drops Campaign and Type.
- J1: the server side already let the real Owner through while viewing as (requireOwner reads the real user); the page
  was simply unreachable because the client nav has no link. If it still fails to load, the cause is elsewhere (engine
  health call has a 3 s timeout) and needs a look on the Pi.
