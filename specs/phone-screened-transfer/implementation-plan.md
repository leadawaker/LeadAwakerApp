# Phone door screened transfer: implementation plan

> For agentic workers: use superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** a caller who asks for a person is held by Telnyx while the owner hears a spoken brief
and presses 1 (connect) or anything else (back to Sara, who books a callback).

**Architecture:** the demo line moves to the Telnyx Call Control conference route
(`telnyx_bridge.py`). Phase 1 makes that route measurable and reliable, using an automated probe
call so it can be tested without a human. Phase 2 adds a standalone owner leg with
`gather_using_speak`, joined into the conference only on digit 1.

**Tech stack:** Python 3 / FastAPI / httpx engine (`/home/gabriel/automations`, pm2
`leadawaker-engine`), Telnyx Call Control v2, OpenAI GPT-Live SIP + sideband WebSocket, CRM
React/Express (`/home/gabriel/LeadAwakerApp`).

**Spec:** `specs/phone-screened-transfer/requirements.md`

## Global constraints

- No em dashes anywhere (code comments, copy, docs).
- i18n en / nl / pt (Brazilian) for every CRM string; tokens only, no raw colours.
- Files under 500 lines; `phone_call.py` (586) and `telnyx_bridge.py` (401) are split here.
- Never run `tsc`, never `npm run dev`. Engine restart: `pm2 restart leadawaker-engine --update-env`.
- Engine tests: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/voice -q`.
  10 failures already at HEAD (`test_live_session_config`, `test_token_endpoint`) stay as they are.
- Telnyx API calls from the shell and `git push` need `dangerouslyDisableSandbox: true`.
- Never ring Gabriel's mobile (+31684446349) during testing (he is asleep). Tests that need an
  owner use the probe loopback (Task 3) with the line's transfer number temporarily set to the
  demo number itself, and restored afterwards.
- Do not commit another session's work: `specs/voice-tab/implementation-plan.md`,
  `client/src/assets/freesound_community-office-ambience-6322.mp3` (app), untracked `en` (engine).
- Keep: Telnyx pinned to Amsterdam / Europe; demo line `Voice_Numbers` id 1 on account 1;
  `{handoff}` placeholder in voice rows 113-121.

## Review focus

1. Caller hangs up while the owner is ringing or hearing the brief: owner leg must be hung up,
   no orphan call ringing Gabriel. (Task 6 test `caller_hangs_up_mid_ring` / `mid_brief`.)
2. Owner presses 1 but the join fails (conference gone, 4xx): caller must not be left with
   nobody; treat as not accepted, hang up owner, Sara resumes. (Task 6 test `join_fails`.)
3. A second `transfer_to_human` during screening: refused, no second owner dial.
   (Existing `_transferred` marker; Task 7 test.)
4. Hold mode with a decline: caller must be unheld and Sara unmuted before she speaks.
   (Task 6 test `hold_mode_declined_unholds_and_unmutes`.)
5. Engine restart mid-call: in-memory bridge lost; Telnyx legs end on caller hangup. Accepted
   risk, documented in the module docstring, no test.

---

## Phase 1: a measurable, reliable conference route

### Task 1: `telnyx_api.py`, shared client with timings

**Files:** create `src/automations/voice/telnyx_api.py`; modify `telnyx_bridge.py`,
`src/webhooks/telnyx_ambience_routes.py`; test `tests/voice/test_telnyx_api.py`.

**Produces:**
- `async def api(method: str, path: str, body: dict | None = None) -> httpx.Response`: one
  module-level `httpx.AsyncClient(timeout=15)` created lazily, logs
  `voice.telnyx.api method path status ms` per request.
- `async def command(ccid: str, action: str, body: dict | None = None) -> bool`: True on 2xx;
  a 422 whose body contains `90018` or "already ended" logs at info (`voice.telnyx.leg_gone`),
  other failures warn as today.
- `get_route`, `set_route`, `get_jitter`, `set_jitter`, `number_record` moved here unchanged.

- [ ] Test: `command` returns True on 200, False and no warning on 422 "already ended"
      (patch `api` with an `AsyncMock` returning `httpx.Response(422, text='{"errors":[{"code":"90018"}]}')`).
- [ ] Move the code, update imports in `telnyx_bridge.py` and the routes file.
- [ ] Run the voice tests; commit `refactor(voice): shared Telnyx client with timings`.

### Task 2: event log and a leaner setup

**Files:** modify `telnyx_bridge.py`.

- Log every webhook: `voice.bridge.event type role ms` where `ms` is from the bridge's
  `created` monotonic stamp (new `Bridge.created: float`).
- Setup order (saves one round trip, keeps ringing until Sara is there):
  1. `call.initiated` incoming: verify alive, dial OpenAI (as today, but `preferred_codecs`
     per Task 4 findings).
  2. AI leg answered: **in parallel** answer the caller and create the conference with the AI
     leg (`POST /conferences {call_control_id: ai_ccid, name, beep_enabled: never, region}`).
  3. Caller answered (and conference id known; whichever completes last triggers):
     `conferences/{id}/actions/join` the caller, then play ambience to the caller, set `ready`.
- `Bridge` gains `answered: bool` (caller answered) so step 3 runs once both are true.

- [ ] Implement; keep `wait_ready` contract unchanged.
- [ ] Unit test with a fake `api`: AI answered then caller answered (both orders) leads to
      exactly one create and one join and `ready` set.
- [ ] Commit `perf(voice): conference built in parallel with answering, event timings logged`.

### Task 3: probe harness (automated test calls, no human needed)

**Files:** create `src/automations/voice/telnyx_probe.py`, `scripts/voice_probe.py`; modify
`telnyx_bridge.py` (one hook), `telnyx_ambience_routes.py` (arm endpoint).

- Engine side (`telnyx_probe.py`):
  - `arm(owner_action: str, ttl_s: int = 180)`; actions `"1"`, `"2"`, `"silent"` (answers,
    presses nothing), `"no_answer"` (never answers). In memory, expires.
  - `is_owner_probe(p, screening_active: bool) -> bool`: armed, `from == to == demo number`,
    and a screening dial is in flight. Only then is an incoming call the owner loopback.
  - Owner probe handling: answer (unless `no_answer`), on its `call.answered` wait 4 s (brief is
    playing), then `send_dtmf` the digit; `silent` does nothing.
  - `POST /voice/phone/probe/arm` (X-Internal-Key) `{owner_action}`.
- Script (`scripts/voice_probe.py`, run with `.venv/bin/python -m scripts.voice_probe`):
  1. Optionally arm the owner probe via the endpoint.
  2. `POST /calls` from the demo number to the demo number on the ambience app,
     `client_state {r: "probe"}` (ignored by the bridge: no bridge carries that role).
  3. Retry `actions/record_start {format: mp3, channels: single}` until 200 (leg answered).
  4. At scripted times `actions/speak` caller lines (Polly en-GB) into the call, e.g.
     at 12 s "Hi, could I speak to Gabriel please? It is about pricing." Then waits.
  5. Hang up after N seconds, fetch the recording (`GET /recordings?filter[call_control_id]=`),
     download it to the scratchpad, transcribe with Groq whisper, print transcript plus the
     engine log lines for that call (`pm2 logs` grep on the bridge id).
- [ ] Unit test `is_owner_probe` (armed, expired, wrong numbers, no screening).
- [ ] Commit `test(voice): probe call harness for the conference route`.

### Task 4: audio quality on the conference route

Measure, change one thing, measure again. Evidence = `voice.bridge.leg_ended role=ai quality`
(skip packets / total, jitter) plus the probe recording transcript.

- [ ] Route the demo number to the conference app (`set_route(True)`), restart engine.
- [ ] Baseline: 2 probe calls (no transfer). Record AI leg skip %.
- [ ] Read the Call Control app and outbound voice profile config (`GET /call_control_applications/{id}`,
      `GET /outbound_voice_profiles/...`) and compare with the FQDN connection (anchorsite,
      regions, codecs, jitter buffer).
- [ ] Candidates, one per run: `preferred_codecs: "PCMA"` (matches the direct route, no Opus
      transcode); app `anchorsite_override` / AI leg region pinned to Europe; app jitter buffer
      if the app supports it.
- [ ] Keep each change that lowers skip %; revert the rest. Write findings into the spec's
      "What the logs showed" section.
- [ ] Gate: 3 consecutive probe calls with an on-time greeting (transcript starts with her
      greeting) and AI-leg skip under about 10%. If the gate cannot be met, leave the number on
      the direct route and stop before Phase 2 goes live (Phase 2 code may still land, dormant).
- [ ] Commit `fix(voice): clean audio on the conference route` with the measured numbers.

## Phase 2: screening

### Task 5: brief text and setup fields

**Files:** create `src/automations/voice/screen_brief.py`; modify `client_setup.py`;
tests `tests/voice/test_screen_brief.py`, `tests/voice/test_client_setup.py`.

**Produces:**
- `ClientSetup.waiting: str` (`"sara"` default, or `"hold"`), `ClientSetup.handoff_name: str`
  (clean_text, 40 chars). Parsed from `setup.handoff.waiting` / `setup.handoff.name`.
- `brief_text(locale: str, *, caller_name: str | None, caller_number: str | None, reason: str | None) -> str`
  - en: "Call from {who}, about {reason}. Press 1 to take the call, or 2 and Sara books a callback."
    `who` = name, else "a number ending in 56 78" (last 4 digits, spaced pairs), else
    "a withheld number". Missing reason drops the "about" clause. Agent name is a parameter
    (`agent: str = "Sara"`).
  - nl: "Gesprek van {who}, over {reason}. Druk 1 om het gesprek aan te nemen, of 2 en {agent} plant een terugbelafspraak."
  - pt-BR / pt-PT: "Ligação de {who}, sobre {reason}. Pressione 1 para atender, ou 2 e {agent} agenda um retorno."
- `brief_voice(locale) -> tuple[str, str]` (voice, language) with Azure Neural voices, verified
  against `GET /v2/text-to-speech/voices` during Task 6.
- `invalid_text(locale)` for `invalid_payload`: "Press 1 to take the call, or 2 to decline." (per language)
- [ ] Tests for each locale, name / number / withheld fallbacks, missing reason, waiting
      parse (valid, invalid, missing).
- [ ] Commit `feat(voice): screening brief text and handoff waiting setting`.

### Task 6: `telnyx_screen.py`, owner leg state machine

**Files:** create `src/automations/voice/telnyx_screen.py`; modify `telnyx_bridge.py`
(dispatch `screen` / `probe_owner` roles, caller hangup also ends the owner leg, remove the old
`transfer()` which rang into the conference); test `tests/voice/test_telnyx_screen.py`.

**Produces:**
- `async def screen(bridge_id: str, number: str, *, brief: str, voice: str, language: str, invalid: str, waiting: str) -> str`
  returns one of `"accepted" | "declined" | "no_answer" | "no_key" | "owner_hangup" | "failed" | "caller_gone"`.
- `Bridge` fields: `owner_ccid`, `owner_answered: bool`, `screen_result: Future | None`,
  `screen_args: dict`, `waiting: str`, `handed_off` (existing).

Flow:
1. Guard: bridge exists, conference id set, no screening running, else `"failed"`.
2. `waiting == "hold"`: `conferences/{id}/actions/hold {call_control_ids: [caller], audio_url: hold.mp3}`
   and `conferences/{id}/actions/mute {call_control_ids: [ai]}`.
3. Dial owner: `POST /calls {connection_id: app, to: number, from: dialed, timeout_secs: 20,
   client_state: {r: "screen", c: caller}}`. 4xx/5xx gives `"failed"`.
4. `call.answered` role screen: `owner_answered = True`; `actions/gather_using_speak` with
   `payload, voice, language, invalid_payload, valid_digits "12", minimum_digits 1,
   maximum_digits 1, timeout_millis 6000, maximum_tries 2, client_state screen`.
5. `call.gather.ended` role screen: `status == "valid" and digits == "1"`: join owner
   (`conferences/{id}/actions/join {call_control_id: owner, beep_enabled: never}`); on success
   `handed_off = True`, unhold caller (if held), stop the ambience for the caller, hang up the AI
   leg, result `"accepted"`. Join failure: hang up owner, result `"failed"`.
   Digit 2: `"declined"`; anything else `"no_key"`; both hang up the owner leg.
6. `call.hangup` role screen: if the result is unset, `"owner_hangup"` when answered else
   `"no_answer"`. If `handed_off`, hang up the caller (call over), as today.
7. Caller hangup: hang up AI and owner legs; unset result becomes `"caller_gone"`.
8. Whenever the result is not `"accepted"` and the caller is still there: unhold caller, unmute AI.
9. Overall guard: `asyncio.wait_for(result, 75)` gives `"no_answer"` and hangs up the owner leg.
- Hold audio: `assets/hold-loop.mp3`, served at `/voice/phone/hold.mp3` (a soft chord loop
  rendered once with ffmpeg, about 20 s, -20 dBFS; script committed in `scripts/make_hold_loop.sh`).

- [ ] Tests (fake `api` that records calls, events fed to `handle_event`):
      `digit_1_connects`, `digit_2_declines`, `no_key_after_two_tries`, `owner_never_answers`,
      `owner_hangs_up_mid_brief`, `caller_hangs_up_mid_ring`, `caller_hangs_up_mid_brief`,
      `join_fails`, `hold_mode_holds_then_unholds_on_accept`,
      `hold_mode_declined_unholds_and_unmutes`, `ai_leg_hangup_after_handoff_keeps_caller`.
- [ ] Commit `feat(voice): screened transfer on the conference route`.

### Task 7: call side (`phone_transfer.py`) and wiring

**Files:** create `src/automations/voice/phone_transfer.py`; modify `phone_call.py`,
`phone_voice_routes.py`, `live_session_config.py` (`_HANDOFF_TRANSFER` wording);
tests in `tests/voice/test_phone_door.py`.

- Move `TRANSFER_TOOL`, `TRANSFER_INSTRUCTIONS`, `add_phone_tools`, `transfer_targets`,
  `_transfer`, `_mark_transferred`, `_mark_transfer_failed`, `_note` into `phone_transfer.py` as
  `TransferMixin`; `PhoneCall(TransferMixin)`. `phone_call.py` re-exports the moved names so
  existing imports keep working. Target: both files under 500 lines.
- `TRANSFER_TOOL` gains optional `caller_name` ("The caller's name, if they gave it").
- PhoneCall takes `bridge_screen` (async fn `(number, caller_name, reason) -> str`) instead of
  `bridge_transfer`, plus `transfer_name: str | None` and `waiting: str`.
- Tool result when `bridge_screen` is set:
  - sara: `{"status": "checking", "detail": "Tell the caller in one short sentence that you are checking whether {who} is free, and ask them to hold on a moment. If they talk meanwhile, chat normally. You will hear back."}`
  - hold: same but "...ask them to hold for a moment while you check." (Sara is muted afterwards.)
  - Direct route keeps today's `"transferring"` result and REFER.
- `_screen()` (replaces `_bridge_transfer`): `_ringing = True` for the duration (watchdog quiet),
  no grace sleep beyond 1.5 s (her sentence starts first). Outcome:
  - accepted: `_handed_off`, `mark_transferred`, note "Transferred to a person (reason)".
  - declined: `mark_transfer_failed`, note "Transfer declined by {who}", commentary
    "{who} can't take the call right now. Tell the caller kindly and offer to book a callback; book it the way you book any appointment."
  - other: `mark_transfer_failed`, note "Transfer failed: {outcome}", commentary
    "Nobody is free right now. Tell the caller kindly and offer to book a callback; book it the way you book any appointment."
  - caller_gone: note only.
- `{who}` = `transfer_name` or "someone" (nl "iemand", pt "alguém"); commentary is English (it
  is an instruction, she answers in the call's language).
- `phone_voice_routes._start_call`: `bridge_screen = lambda number, name, reason: telnyx_screen.screen(bridge_id, number, brief=brief_text(...), ...)`;
  `waiting` and `transfer_name` from `setup` (defaults `"sara"` / `route transfer_name` none).
- `_HANDOFF_TRANSFER` (all languages): "Once it confirms, say in one short sentence that you are
  putting them through." becomes "When it answers, tell the caller in one short sentence what it
  says is happening." (code only; DB rows hold just `{handoff}`).
- [ ] Tests: screen result per outcome gives the right mark, note and commentary; second
      `transfer_to_human` during screening returns `already_transferring` and no second dial;
      tool result wording for sara / hold / direct; file sizes under 500.
- [ ] Commit `feat(voice): Sara waits with the caller while the owner is screened`.

### Task 8: CRM waiting toggle (Voice tab, Transfer card)

**Files (app):** `server/storage/voiceLines.ts`, `server/routes/voice-line.ts`,
`client/src/features/accounts/components/workspace/voice/voiceApi.ts`,
`.../voice/TransferCard.tsx`, `client/src/locales/{en,nl,pt}/voiceTab.json`.

- `VoiceLine.transferWaiting: "sara" | "hold"` (from `setup.handoff.waiting`, default "sara");
  `VoiceLinePatch.transferWaiting`; zod `z.enum(["sara","hold"]).optional()`;
  `applyProfile` writes `handoff.waiting`.
- TransferCard: below the number/name grid, a `FieldLabel` "While we ring you" and two `Chip`s
  (same component as the wizard recap chips, or the voiceAtoms equivalent): "Sara keeps them
  company" / "Hold music", saved with the card's Save button (part of the draft).
- i18n keys `transfer.waiting.label`, `transfer.waiting.sara`, `transfer.waiting.hold`,
  `transfer.waiting.help` in en / nl / pt (Brazilian).
- [ ] Set account 1 `setup.handoff.waiting = "sara"` and `setup.handoff.name = "Gabriel"` if empty.
- [ ] Verify via the CRM API with the cookie jar (GET then PUT `transferWaiting`), not tsc.
- [ ] Commit (app) `feat(voice-tab): choose what callers hear while you are rung`.

### Task 9: end-to-end with the probe, then go live

- [ ] Temporarily set `Voice_Numbers` id 1 `transfer_number` to the demo number (owner
      loopback); note the original (+31684446349) and restore it in the last step no matter what.
- [ ] Probe runs (each: script output, transcript, engine log lines, outcome in `Voice_Calls`):
  1. owner `"1"`: outcome `transferred`, AI leg gone, caller hears the owner leg (silence).
  2. owner `"2"`: Sara says the owner can't take it, offers a callback.
  3. owner `"no_answer"`: after ~20 s Sara says nobody is free.
  4. owner `"silent"`: after the brief twice, Sara resumes.
  5. hold mode + owner `"2"`: caller hears the hold loop, then Sara.
- [ ] Restore transfer number +31684446349. Leave the demo number on the conference route if
      Task 4's gate passed, else on the direct route.
- [ ] Full voice test suite; push engine and app; update memory
      (`project_voice_phone_door_2026_10_07_link.md`) and the spec status.
- [ ] Final review: one fresh reviewer subagent over both repos' diffs.
