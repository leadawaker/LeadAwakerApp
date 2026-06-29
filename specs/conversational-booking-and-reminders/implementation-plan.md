# Conversational Booking & Reminders — Implementation Plan

Spec: [requirements.md](./requirements.md). Domain: automations engine (Python). Depends on Spec A
(consumes the per-account `callingNumber` / `meetingType`).

## Sequencing note
Spec A should land first (this spec reads its account fields). FR5 (reschedule verify) and FR3
(confirmation copy) are low-risk and can start independently. FR1 (in-chat booking) is the largest
piece and the only one needing the Cal.diy API client — front-load that API spike.

## Task list (ordered)

### 0. Cal.diy API spike (de-risk first)
- Determine how the engine calls Cal.diy for: **availability**, **create booking**, **reschedule**.
  Identify auth (API key/token the engine uses), endpoints, and the booking payload shape (must set
  the location per the account's meeting type from Spec A).
- Output: a small `src/tools/caldiy_api.py` client (availability / create / reschedule) with logging.

### 1. FR5 — Reschedule via chat (verify + fix)
- Trace the current reschedule flow end-to-end with the new Cal.diy setup.
- Confirm a chat reschedule updates the Cal.diy booking (→ `BOOKING_RESCHEDULED` →
  `_handle_reschedule` updates `booked_call_date` + `calcom_booking_uid`).
- Confirm **no double-billing** of booked-call events. Fix if broken. (Mostly verification.)

### 2. FR3 — Post-booking confirmation copy
- Locate current confirmation copy (`booking_routes.py _handle_booking`, msg1/msg2 ~lines 493-559).
- Extend with: calling number ("we'll call you from <number> — save it 📲") + a niche-aware
  "what to expect" recap line. Pull `callingNumber` from the account (Spec A).
- Keep en/nl handling consistent with existing logic. Decide inline vs Prompt_Library for the recap.

### 3. FR2 — vCard contact card
- After a phone-call booking in `_handle_booking`, send a WhatsApp contact card:
  - **Cloud API** (self): native `contacts` message type.
  - **Twilio** (clients): `text/vcard` media attachment.
  - Build the vCard from business name + `callingNumber`.
- WhatsApp-call case: carry the WhatsApp number or skip (decide here).
- Log the send to `Automation_Logs`.

### 4. FR1 — In-chat slot proposal + book via API
- **Prompt** (Prompt_Library, source of truth): at the booking moment, instruct the AI to offer
  2-3 concrete times + the link inline (times primary). Define the structured signal the AI emits
  when the lead picks a slot (so the engine can act on it).
- **Engine** (`ai_conversation.py` / `inbound_handler.py`): on the pick signal, call
  `caldiy_api.create_booking()` with the account's location/meeting type. The existing
  `BOOKING_CREATED` webhook then runs `_handle_booking` unchanged.
- Pull live availability via `caldiy_api.availability()` to choose the 2-3 offered slots.
- Handle "none work" → propose more slots; link remains the fallback.

### 5. FR4 — T-1h reminder job
- New module `src/automations/booking_reminder.py`: query bookings with `booked_call_date` ~1h out,
  not yet reminded; send one WhatsApp reminder (what-to-expect + calling number); mark reminded.
- Dedupe: a `reminded_at` flag (or claim key, cf. `wa-fallback:<sid>`). Idempotent — exactly once.
- Register in `src/scheduler/jobs.py` (interval every ~5-10 min). Log to `Automation_Logs` via
  `AsyncLogStep`/`log_step`.

### 6. Verification (on the Pi, via pm2 logs)
- End-to-end: AI offers slots → lead picks → Cal.diy booking created → `_handle_booking` runs →
  confirmation states number + recap → vCard received & saveable → reminder fires once ~1h prior.
- Reschedule in chat → booking moves, no double-bill.
- All sends appear in `Automation_Logs`.

## Risks / notes
- **Cal.diy API access from the engine is the main unknown** — spike Task 0 before building FR1.
- vCard support differs by provider; verify both Cloud API and Twilio early.
- Engine prompt/config changes may need a `leadawaker-engine` pm2 restart to take effect.
- Keep reminder dedupe strictly idempotent — double-reminding leads is a bad look.

## Out of scope
- Spec A (meeting types / calling-number storage) and Spec C (booking-page reviews).
