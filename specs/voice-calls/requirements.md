# Voice Calls page: design

Date: 2026-09-18
Status: approved in chat, awaiting spec review

## Problem

Calls made on the AI voice demo (`/voice-demo`, GPT-Live receptionist) leave no readable trace in the CRM.
The automations engine already writes every spoken turn to `Interactions` (type `voice_call`,
`conversation_thread_id` = the call id), but:

- The recap (caller name, what they wanted, notes) is generated after the call by
  `POST /voice/live/wrap-up`, returned to the browser, and thrown away.
- There is no per-call record: no start/end time, no duration, no booked date tied to the call.
- Most web calls have no caller number, so the engine files them all under one lead whose phone is
  `"web"`. Grouping by lead mixes unrelated calls. Calls must be grouped by call id.
- There is no page to browse any of it.

As of 2026-09-17 the database holds 837 voice turns across 82 calls (2026-08-02 onward).

## Scope

In: voice-demo calls only (account 1, campaign 60, `triggered_by = 'voice_receptionist'`).

Playback: in scope, using OpenAI's own copy only. OpenAI keeps each GPT-Live recording for 30 days
and the engine already proxies it (`GET /voice/live/recording/{session_id}`). We store no audio.

Out (for now):
- Our own audio storage. If ever needed: EU object storage with a lifecycle delete rule, not the Pi's
  SD card.
- A "this call is recorded" notice in the greeting (not needed for demos, decided 2026-09-18).
- The Twilio click-to-call flow in `server/routes/twilio-voice.ts`.
- The SIP phone door (`/voice/incoming`), which is still scaffolding.

## Data model

New table `Voice_Calls` in `shared/schema.ts` (schema `p2mxx34fvbf3ll6`), one row per call:

| column | type | notes |
|---|---|---|
| id | serial pk | |
| call_id | text, unique | same value as `Interactions.conversation_thread_id` |
| session_id | text, null | OpenAI GPT-Live session id, for the 30-day recording |
| accounts_id | int | |
| campaigns_id | int | |
| leads_id | int, null | |
| language | text, null | |
| started_at | timestamptz | first event of the call |
| ended_at | timestamptz, null | set at wrap-up; null if the tab closed first |
| turn_count | int, default 0 | |
| summary | jsonb, null | `{ name, outcome, items: [{ intent, interest, notes }] }` |
| booked_slot | text, null | human-readable slot as spoken |
| booked_iso | timestamptz, null | |
| created_at / updated_at | timestamptz | |

The transcript is not copied. The page reads it from `Interactions` by `conversation_thread_id`.

Table created with a direct `pg` script (`node --env-file=.env`), not `db:push` (needs a TTY).

## Engine changes (`/home/gabriel/automations`)

The engine already writes to this database through `tools/db/`. It writes the new table the same way,
with no HTTP call to the CRM.

1. New `tools/db/voice_calls.py`: `upsert_call_start`, `record_turn`, `record_booking`,
   `record_wrap_up`. All upserts keyed on `call_id`, so the order of events never matters.
2. `CallLogger` (`src/automations/voice/event_logger.py`):
   - first logged turn: upsert the row (ids, language, `started_at`), increment `turn_count` per turn;
   - successful `book_appointment`: set `booked_slot` / `booked_iso`;
   - `update_call_summary` (Realtime path): store the summary.
3. `POST /voice/live/wrap-up` (`src/webhooks/live_voice_routes.py`): accept optional `call_id` and
   `session_id`; after the summary is derived, write `summary`, `ended_at`, `session_id`. A failed
   write is logged and never fails the response.
4. Summary schema gains one field, `outcome`: one sentence on how the call ended and the next step
   (the "conclusion"). Additive, so the demo page's existing panel is unaffected.
5. Every DB write is wrapped so a failure is logged and never breaks a live call.

## CRM changes

Voice demo page (`client/src/features/voiceDemo/useLiveCall.ts`): send `call_id` and `session_id` in
the wrap-up request body. Nothing else changes there.

Server:
- `server/storage/voiceCalls.ts` domain module, exported through the `storage` barrel:
  `listVoiceCalls({ limit, offset })` and `getVoiceCall(callId)` (row + ordered turns from
  `Interactions`).
- `server/routes/voice-calls.ts`, registered in `server/routes/index.ts`, owner-only like Demos:
  - `GET /api/voice-calls`: newest first; lead name, started_at, duration, turn count, booked date,
    outcome line.
  - `GET /api/voice-calls/:callId`: full detail.
- Duration: `ended_at - started_at`, falling back to the last turn's `created_at` when `ended_at` is
  null.

Client:
- Route `/platform/voice-calls`, lazy-loaded, wrapped in `OwnerOnly`, next to `/platform/demos` in
  `client/src/pages/app.tsx`.
- Nav bar entry "Voice calls" directly above Conversations (`RightSidebar.tsx`), visible to the owner
  only.
- `client/src/features/voiceCalls/` with `api/`, `components/`, `hooks/`, kept under 500 lines per file.
- Layout matches the chats inbox: toolbar (list) on the left, detail on the right; stacked on mobile.
  - List row: caller name (or "Web caller"), date and time, duration, a booked pill when a slot was
    booked.
  - Detail, top to bottom: header (name, date, duration, language); Booked card with the date if any;
    Outcome (the conclusion line); Summary (one card per item: intent pill, interest, notes);
    Recording (audio player streaming `${ENGINE_BASE_URL}/voice/live/recording/{session_id}`; if
    there is no session id or the load fails, show "Recording no longer available (kept 30 days)");
    Transcript (read-only chat bubbles, caller vs AI).
  - Empty states: no calls yet; call with no summary ("No recap was generated for this call").
- Styling per `UI_STANDARDS.md` and the wine palette primitives (ListCard, SectionCard, Pill). Dark
  mode via tokens.
- New i18n namespace `voiceCalls` in `en`, `nl`, `pt` (Brazilian PT).

## No backfill

Past calls (before this ships) are not migrated. The page lists only calls that have a `Voice_Calls`
row, so it starts empty and fills from the first call after release.

## Error handling

- Engine writes never fail a call or the wrap-up response; failures go to the structured log.
- A call whose tab closed before wrap-up still appears (row created on first turn), with no summary
  and duration from the last turn.
- API returns 404 for an unknown call id; the page shows a not-found state.

## Testing

- Engine: unit tests for the upsert helpers and the wrap-up write (events out of order, repeated
  wrap-up, missing call_id).
- Live check: make a demo call, confirm the row fills in (start, turns, booking, summary on hang-up),
  then open the page and confirm list and detail render in light and dark mode, desktop and mobile
  (playwright-cli).
