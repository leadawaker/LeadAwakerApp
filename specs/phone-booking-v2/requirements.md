# Phone Booking v2: exact slots, cancel and move, visits

**Status:** Draft for review (2026-10-13)
**Domain:** Python engine (`/home/gabriel/automations`), CRM (Express + account workspace), Cal.diy provisioning (`/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts`)
**Related:** `booking-meeting-types` (meeting type + calling number), `ai-rescheduling` (chat reschedule), `voice-tab`, memory `project_robben_test_call_fixes_2026_10_13`

## Problem

On a client's phone line the receptionist books into the client's real Cal.diy calendar (`real_booking.py`). Test call 1887 (Robben Rosmalen, 2026-10-13) showed the path is fragile:

1. **Spoken words are re-parsed.** `book_appointment(preferred_day, preferred_time)` sends words like "woensdag, half elf" and `real_diary_slots.asked_time` runs them through the demo parser (`demo_slot._resolve_day/_resolve_hour`). It reads "tien uur dertig" as 10:00, "overmorgen" as tomorrow, a weekday named on that same weekday as next week, and cannot read a date ("de twintigste") at all. In call 1887 the caller said "half elf", she said "ik zet het erin", and the backend came back with "Elf uur is niet vrij", contradicting her.
2. **Only part of the day is offered.** `check_availability` returns at most 6 slots (`_MAX_LISTED`), every third slot of an 18-slot day, so a free time can be called "not free".
3. **No cancel or move.** The voice prompt promises "verzetten of afzeggen" but the backend has no tool for either. Chat already does both (`conversation/cancel.py`, `conversation/reschedule.py`).
4. **Corrections make a second booking.** The 2-minute duplicate guard (`slot_booking.py:871-884`) never fires because `booked_at` is written as naive UTC and read back as Amsterdam time. A correction books a second appointment and the booking webhook then cancels the first. It works by accident and leaves a messy trail.
5. **One appointment kind only.** Every account has a single Cal.diy event type (`30min`, a phone call). A car dealer needs a showroom visit (viewing or test drive) that is a different thing: in person, at the address, longer.

## Goal

On a client line, the backend books, moves and cancels the caller's appointment by exact slot, offers the whole day, and books a phone callback or a visit depending on what the caller wants. The demo line and the browser demo keep working exactly as today.

## Decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | A visit lasts **60 minutes** by default and the length is **editable in the CRM**. | Gabriel, 2026-10-13 |
| D2 | Visits use the **same free hours** and minimum notice as callbacks (same Cal.diy schedule). | Default, confirm |
| D3 | Cancel and move are allowed when the **caller ID matches** the lead that holds the booking. A withheld number cannot cancel or move: she takes a message instead. | Default, confirm |
| D4 | A caller has **one upcoming appointment** at a time (the lead holds one `calcom_booking_uid`). Booking a new one replaces the old one, and she says so. | Default, confirm |
| D5 | Build in three slices, in order: 1 exact slots, 2 cancel and move, 3 visits. Each slice ships and is tested on its own. | Default, confirm |
| D6 | Live testing books into Robben's calendar, which is Gabriel's own Google calendar. Test bookings are fine. | Gabriel, 2026-10-13 |

## Slice 1: exact slots and corrections

### Behaviour
- **The backend picks the date.** It already knows today's date (`_backend_today`). `check_availability` takes `date` (`YYYY-MM-DD`, optional: empty means the first days with room). No word parsing on the real path.
- **Every free slot of that day** comes back, each as `{"start": "2026-10-15T09:00", "say": "donderdag de vijftiende om negen uur"}`. `start` is local time in the account's timezone; `say` is written by our code in the call's language.
- If the day has no room, the result says so and lists the next two days that do, every slot of each.
- A date beyond the prefetched 14 days is fetched on demand, up to the calendar's own booking window.
- **`book_appointment(start, name)`** books exactly that start. The engine matches by parsed datetime, never by string (Cal.diy returns `…T09:00:00.000+02:00`).
- A `start` that is not free (taken since, or never listed) answers `unavailable` with that day's fresh free slots. The day is re-fetched before answering, so a stale cache cannot refuse a free time or offer a taken one.
- **Correction in the same call:** if this call already booked, a new `book_appointment` moves that booking (Cal.diy reschedule) instead of creating a second one. Result `{"status": "moved", "from": …, "to": …}`.
- The voice model says "booked" only on `booked` or `moved`. Today's prompt line for that stays as is: with no word parsing the backend no longer contradicts her.

### Data
- Fix the naive `booked_at` writes (`slot_booking.py` ~1040, the webhook ~647, reschedule ~508) to timezone-aware timestamps. Once fixed, the 2-minute guard starts working for chat, which is its purpose; the phone path never hits it because it moves instead.
- `Voice_Calls.booked_slot` / `booked_iso` are overwritten on a move.

### The seam with the demo
- Demo diary, demo parser, `voice_tools()` and the browser door are untouched. The browser client reads the receipt keys `booked_slot` / `booked_iso`; those keys keep their meaning.
- The real-line tool schemas replace the demo `book_appointment` schema only in sessions where `diary_for_call` returns `real` (same place `add_availability_tool` hooks in today, `phone_voice_routes.py:332`).

## Slice 2: cancel and move

### Behaviour
- Two backend tools on real lines: `cancel_appointment(reason)` and `move_appointment(start)`.
- Both act on the caller's upcoming appointment: the lead found by caller number for this account, with a `calcom_booking_uid` and a future `booked_call_date`.
- No appointment found: `{"status": "none"}`. Withheld number: `{"status": "unknown_caller"}`, and she offers to pass a message on (callback task, as today's `not_booked`).
- At call start the backend gets one English line when the caller has an upcoming appointment ("This caller has an appointment on …"). The voice model already hears it through caller memory.
- `move_appointment` uses `check_availability` with the current booking excluded from "busy" (Cal.diy `bookingUidToReschedule`), so the caller's own slot shows as free.
- `cancel_appointment` and `move_appointment` results say what is done; the voice model confirms only after them.

### Code
- Extract the cancel core of `cancel.py` (lines ~156-179) into `cancel_lead_booking(lead, account, reason, source)` and the inline reschedule in `reschedule.py` (~470-530) into `reschedule_lead_booking(lead, account, new_start, source)`. The chat handlers call the same functions, so chat behaviour stays identical.
- Both require the account's own Cal.diy key. The fallback to `settings.cal_api_key` is removed for these calls.
- `ENGINE_RESCHEDULE_IN_FLIGHT` keeps guarding the webhook race on a move.
- **Client alert on cancel:** today the uid is cleared before the webhook arrives, so the webhook classes the cancel as automatic and the client gets no "cancelled" alert. Phone and chat cancels by the customer must alert the client. (To verify in the plan before changing.)
- `Voice_Calls`: a cancel clears `booked_slot` / `booked_iso` and logs an interaction "Cancelled: …"; a move overwrites them.

## Slice 3: visits (viewing or test drive)

### Behaviour
- An account can switch on **visits**: an in-person appointment at the business address, with its own title (Robben: "Bezichtiging of proefrit") and length (default 60 min).
- On a real line with visits on, `check_availability` and `book_appointment` take `kind`: `callback` or `visit`. The backend picks: the caller wants to see or drive a car → `visit`; wants a talk by phone → `callback`. With visits off, `kind` is not in the schema.
- Availability for a visit is computed on the visit event type (60-minute slots fit the same free hours).
- D4 applies: booking a visit when a callback exists replaces the callback, and the result says so (`replaced`), so she can tell the caller.
- Cal.diy's own confirmation email shows the address, because the event type's location is in person.

### Cal.diy provisioning (`provision-leadawaker-user.ts`)
- Create or update a second event type, slug `visit`, with the title, length and an in-person location (the account's visit address).
- The loop that writes the meeting-type location onto **all** event types skips `visit`. Today it would overwrite the address with "Phone call" on every re-provision.
- Attach the same booking webhook (created, cancelled, rescheduled) to the visit event type. Today only `30min` has one, so a visit booking would never reach the CRM.
- Re-provision runs when visit settings change (same trigger as duration and meeting type, `server/routes/accounts.ts:128-136`).

### Data and CRM
- `Accounts`: `visits_enabled` (bool, default false), `visit_title` (text), `visit_duration_minutes` (int, default 60), `visit_address` (text, default the account's business address).
- `Calendar_Connections`: `caldiy_visit_event_type_id`, `caldiy_visit_event_type_slug`, written by provisioning.
- Engine: `resolve_account_credentials` also returns the visit event type; `RealDiary` keeps one slot cache per kind.
- CRM: a "Visits" block next to the Availability and Meeting type cards in the account workspace (`AvailabilityCard.tsx` / `MeetingTypeCard.tsx`): on/off, title, length (30, 45, 60, 90, 120), address. All strings through i18n (en, nl, pt). Saving re-provisions.

### Robben setup after the build
- Visits on, title "Bezichtiging of proefrit", 60 min, Afrikalaan 17a, 5232 BD 's-Hertogenbosch.
- Persona 75 knowledge: the line "bied een bezichtiging of proefrit aan" is reworded separately (prompt change, not this spec).

## Out of scope
- The receptionist's qualifying behaviour and the shared voice prompt wording (separate prompt change).
- The transfer announcement voice (separate change).
- A WhatsApp confirmation template that says "visit at our address" (needs Meta template approval). Today's confirmation path is unchanged.
- The demo diary and its parser.
- More than one upcoming appointment per caller.

## Testing
- Mocked unit tests next to the existing ones (`tests/voice/test_real_booking.py`, `test_booking_tool.py`, `test_event_logger.py`), run with `.venv/bin/python -m pytest tests/voice tests/test_slot_matching.py -q` (108 pass today). Cases: whole day returned, date beyond the window, start matched despite format differences, stale slot refused with a fresh day, correction becomes a move, cancel and move by caller ID, withheld caller refused, visit vs callback event type, visits off hides `kind`.
- Chat regression: the extracted cancel and reschedule functions keep the chat tests green.
- Live: Gabriel calls Robben's line from an outside phone (the probe forces the demo diary) and books, corrects, moves, cancels, and books a visit. Each lands in his own calendar.
- Engine changes need `./preflight.sh && pm2 restart leadawaker-engine --update-env`; Cal.diy provisioning changes need a re-provision of account 53.

## Open questions
- D2, D3, D4, D5 above (defaults chosen, Gabriel to confirm).
- Should a visit count as a billable booking like a callback (`billable-bookings-billing`)? Default: yes, same as any booking.
