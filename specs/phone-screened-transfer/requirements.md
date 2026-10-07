# Phone door: screened transfer

Status: BUILT 2026-10-07 (night). Demo number on the conference route; verified with 9 automated probe calls.
Engine: `/home/gabriel/automations`. CRM: this repo.

## Goal

Make the landing-page promise real. When a caller asks for a person, Sara rings the owner and
the owner hears a short spoken brief before deciding:

- **Press 1:** owner joins the caller, Sara leaves the call.
- **Press 2, no answer, voicemail, owner hangs up, no key pressed:** the owner's leg drops, the
  caller is back with Sara, and she books a callback.

The caller never lands in the owner's voicemail and never hangs in endless ringing.

## Why the route has to change

On the direct route (Telnyx FQDN connection to OpenAI SIP) a transfer is a blind SIP REFER:
OpenAI leaves the call the moment it is sent, so there is nothing to return to. Screening needs
Telnyx to hold the caller, which only the Call Control conference route
(`telnyx_bridge.py`, app `TELNYX_AMBIENCE_APP_ID`) does. That route already rings the transfer
number into the conference and tells Sara "nobody picked up" on no answer; this build adds the
screening, hold and reliability on top.

**Route rule:** a line with a transfer number runs on the conference route. A line without one
stays on the direct route. The existing CRM route switch (`PUT /voice/phone/route`) remains the
manual fallback to the direct route (blind REFER, as today).

## What the logs showed (2026-10-07, 3 of 3 conference calls failed)

- The bridge setup itself never failed: conference ready about 5 to 6 s after the incoming call,
  caller hears ringing throughout.
- Sara's audio from OpenAI on the conference route was gappy: 51% and 72% skipped packets on
  the AI leg in two calls (Telnyx `call_quality_stats` on `call.hangup`).
- One call had a stalled OpenAI session (no transcript, sideband keepalive timeout).
- All three ran on code without the greeting re-cue (`GREETING_RECUE_S`), which came later that day.
- Missing evidence: Telnyx event types and ms timings, REST durations, first-audio time.

## Phase 1: a reliable conference route (gate for phase 2)

1. **Timing logs.** Every Telnyx webhook logged with `event_type`, leg role and a monotonic ms
   offset from `call.initiated`. Every Telnyx REST call logs its duration. Log Sara's first
   output audio (`voice.phone.first_audio ms=`) on both routes.
2. **Leaner setup.** Answer the caller, create the conference with the caller, then dial OpenAI
   with `conference_config {id, early_media: false, beep_enabled: "never"}` so the AI leg joins
   on answer without a separate join call. One shared `httpx.AsyncClient` for the bridge instead
   of one per request.
   - Caller hears ringing until answered; the plan decides whether answering waits for the AI leg
     (today's behaviour, no dead air) or not, and documents the choice.
3. **Audio quality.** Find and fix the cause of the AI-leg packet gaps. Candidates to test one at
   a time, with the stats compared per call:
   - the outbound OpenAI leg not anchored in Amsterdam / Europe like the direct connection;
   - codec order `OPUS,PCMA,PCMU` forcing transcoding (try PCMA first, matching the direct route);
   - no jitter buffer on the Call Control app.
4. **Harmless race:** the duplicate `hangup` 422 ("already ended") between the two leg handlers is
   silenced (already-ended is not a warning).

**Phase 1 done when:** Gabriel makes 3 test calls on the conference route, each with a clean,
on-time greeting, and the AI leg's skipped packets stay under about 10% in every call.

## Phase 2: screening

### Flow

1. Backend calls `transfer_to_human(reason)`. Tool result: "tell the caller you are checking if
   {name} is free, one moment". `{name}` is the handoff contact name (`setup.handoff.name`), else
   a neutral "someone".
2. **While the owner is rung**, per the account's waiting choice:
   - `sara` (default): Sara stays with the caller and can keep chatting. Quiet is expected
     (the existing `_ringing` flag keeps the silence watchdog off).
   - `hold`: the caller is put on conference hold with a hold loop
     (`conferences/{id}/actions/hold`, `call_control_ids: [caller]`, `audio_url`), and Sara is
     muted toward the caller.
3. Telnyx dials the owner as a **standalone call**, no conference: `POST /v2/calls`,
   `timeout_secs: 20`, no answering-machine detection, `client_state {r: "screen", c: caller}`.
   An app-side timer of about 25 s backs this up.
4. On `call.answered`, `actions/gather_using_speak`:
   - payload: the brief, in the line's locale. Example (en):
     "Call from Jan de Vries, about a kitchen quote. Press 1 to take the call, or 2 and Sara
     books a callback." Name falls back to the spoken caller number, reason from the tool call.
   - `valid_digits: "12"`, `minimum_digits: 1`, `maximum_digits: 1`, `timeout_millis: 6000`,
     `maximum_tries: 2`, an Azure Neural voice per locale (en-GB `Azure.en-GB-SoniaNeural`,
     nl `Azure.nl-NL-FennaNeural`, pt-BR `Azure.pt-BR-FranciscaNeural`, pt-PT and en-US the
     matching Azure voice; final names verified against `GET /v2/text-to-speech/voices`).
5. `call.gather.ended` with status `valid` and digits `1`:
   - join the owner into the conference (`beep_enabled: "never"`), unhold the caller if held,
     hang up the AI leg (`handed_off = True`, so its hangup does not end the caller's call),
     stop the ambience loop for the caller.
   - Outcome `transferred`, transcript note "Transferred to a person (reason)".
6. **Anything else** (digit 2, `invalid`, no key after both tries, `call_hangup`, never answered,
   app timer):
   - hang up the owner leg if still up, unhold the caller if held, unmute Sara,
   - Sara is told by commentary: digit 2 means "{name} can't take it right now", every other
     case "nobody is free right now"; both end with "offer a callback and book it".
   - Outcome stays as today for a failed transfer (`mark_transfer_failed`), transcript note
     names the reason (declined / no answer / no key).
7. **Caller hangs up during screening:** hang up the owner leg (mid-ring or mid-brief), end as today.
8. At most one screening per call (existing `_transferred` marker).

### The waiting choice (CRM)

- New field `setup.handoff.waiting: "sara" | "hold"`, default `"sara"`, in
  `Account_Communication_Profile.setup`. Added to the setup type and defaults in
  `setupConstants.ts` and to any zod schema that whitelists setup keys (unknown keys are
  stripped silently otherwise).
- UI: a two-option `la-seg` in the handoff section of the communication setup, next to "ring
  when": "Sara keeps them company" / "Hold music". i18n en, nl, pt (Brazilian). Tokens only.
- Engine: `ClientSetup.waiting` parsed in `client_setup.py` with the same enum guard as
  `ring_when`; passed to the call so the screening knows which mode to use.
- Account 1 (the demo line) set to `sara`.

### Hold audio

A short neutral loop served like the ambience MP3 (`/voice/phone/hold.mp3`), public, no secrets.
The plan picks a royalty-free source.

## Code layout

- `src/automations/voice/telnyx_bridge.py` (401 lines): split so each file stays under 500 lines,
  e.g. `telnyx_api.py` (shared client, `_api`, `_command`, route and jitter switches),
  `telnyx_bridge.py` (conference life cycle), `telnyx_screen.py` (owner dial, brief, gather,
  outcomes).
- `src/automations/voice/phone_call.py` (586 lines): the transfer branch (`_transfer`,
  `_bridge_transfer`, the marks and notes) moves to `phone_transfer.py`, bringing the call file
  back under 500 lines.
- `phone_voice_routes.py`: passes the waiting mode and the brief inputs (caller name or number,
  handoff name, locale) into the bridge transfer call.
- Brief text per locale lives with the other voice strings (en-GB, en-US, nl, pt-BR, pt-PT).

## Tests

- Simulated Telnyx event sequences against the bridge state machine (no network, `_api` faked):
  digit 1, digit 2, no key after two tries, owner never answers, owner hangs up mid-brief,
  caller hangs up mid-ring, caller hangs up mid-brief, AI leg hangs up after handoff.
- Brief text per locale, name and number fallbacks.
- `waiting` parsing (valid, invalid, missing) and the hold vs stay commands issued.
- Existing suite stays green apart from the 10 failures already at HEAD
  (`test_live_session_config`, `test_token_endpoint`).
- Live acceptance by Gabriel on the demo line: press 1, press 2, let it ring out, reject on the
  phone, both waiting modes.

## Keep as is

- Telnyx pinned to Amsterdam / Europe on the direct connection.
- Demo line `Voice_Numbers` id 1 on account 1, transfer number +31684446349.
- The `{handoff}` placeholder in voice rows 113-121. The transfer text already says "the backend
  can put them through"; if the "checking if {name} is free" wording needs a row change, that is
  a Prompt_Library edit and needs Gabriel's OK.

## Out of scope

Screening on the direct route, ringing several people in turn, recording after the owner takes
over, answering-machine detection, per-client hold music uploads.

## Build notes (2026-10-07)

- Phase 1 gate: 9 automated probe calls on the conference route (`scripts/voice_probe.py` in the
  engine), every greeting heard right at answer, setup 3.5 to 5.7 s after the incoming call
  (caller hears ringing). The earlier failures did not reproduce. Telnyx `skip_packet_count` on
  the AI leg turned out not to be a loss metric (silence and mute count as skips: 8 to 10% on
  plain calls, 33% on a call where Sara was muted on hold), so no codec change was made
  (`AI_CODECS` stays `OPUS,PCMA,PCMU`). Audio smoothness still needs a human ear.
- Setup now builds the conference around the OpenAI leg while the caller is being answered.
- The waiting toggle lives on the Voice tab Transfer card (where the transfer number is edited),
  not in the onboarding wizard.
- Hold mode waits until Sara has finished her "one moment" sentence before holding the caller;
  the first live run cut her off.
- A `reason` that only restates the transfer ("asked to speak with Gabriel") is left out of the
  brief.
- Probe calls: every path verified live (1, 2, silent owner, no answer, hold + 1, hold + silent,
  caller hangs up while the owner rings). Test data deleted afterwards.
