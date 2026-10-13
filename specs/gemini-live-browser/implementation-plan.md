# Implementation Plan: Gemini Live on the browser voice test page

## Overview

Add `gemini-3.8-live` as a second engine on `/voice-demo`.

**Engine side (Python, `/home/gabriel/automations`):**
- Resolves the same persona and prompt the GPT-Live call gets.
- Folds the voice layer and the backend instructions into one Gemini system instruction. Gemini has no delegate model: one model talks and calls the tools.
- Mints a single-use ephemeral token that locks the model, prompt, tools and voice.

**Browser side:**
- Opens a WebSocket straight to Google, streams 16 kHz PCM up and plays 24 kHz PCM back.
- Relays turns and tool calls through the existing `/voice/relay`.
- Records both sides and uploads the file.
- Calls the existing `/voice/live/wrap-up`.

**Also included:**
- `Voice_Calls.engine` column and a badge on the Voice Calls page.
- A voice picker with pre-generated samples.

**Repos:**
- **CRM:** `/home/gabriel/LeadAwakerApp`. Paths below without a prefix are relative to it.
- **Engine:** `/home/gabriel/automations`. Paths prefixed `engine:`.

Engine restart after engine changes: `cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env`. It does not hot-reload. The CRM reloads on save.

---

## Phase 1: Data and engine tag

Store which engine handled each call.

### Tasks
- [ ] Write the migration `engine:scripts/migrate_add_voice_call_engine.py`. It adds `engine text NOT NULL DEFAULT 'gpt-live'` to `Voice_Calls`. Copy the pattern of `scripts/migrate_add_voice_call_test_account.py`: it must be idempotent and use `ADD COLUMN IF NOT EXISTS`. Run it.
- [ ] Engine `tools/db/voice_calls.py`: add the helper `engine_for_session(session_id) -> str`. It returns `'gemini-live'` when the id starts with `gem_`, otherwise `'gpt-live'`. Stamp `engine` in every insert path: `record_turn`/start insert (around :40-60) and `record_wrap_up` (:207). Use an upsert that sets `engine` only when `session_id` is known: `engine = CASE WHEN EXCLUDED.session_id LIKE 'gem\_%' THEN 'gemini-live' ELSE {_T}.engine END`.
- [ ] `shared/schema.ts` (voiceCalls, ~:856): add `engine: text("engine").notNull().default("gpt-live")` with a comment that names the migration.
- [ ] Make sure `engine` flows through `storage.getVoiceCall` / the list query in `server/storage/` (the voice-calls module) and the client types used by `client/src/features/voiceCalls/`.

### Technical Details
- Session ids: GPT-Live is `live_…` (OpenAI). Gemini is `gem_<uuid4 hex>`, minted by the engine (Phase 2).
- Phone calls never get `gem_`, so they stay `gpt-live`.

---

## Phase 2: Engine, the Gemini session endpoint

### Tasks
- [ ] Refactor `engine:src/webhooks/live_voice_routes.py` `live_session` (:137-300). Pull everything before the OpenAI POST into `async def prepare_browser_call(request, body) -> PreparedCall` in a new module `engine:src/automations/voice/browser_call.py`. That covers the password/token check, rate limit, staff-only `line`/`account`, persona resolution, locale, voice, company, greeting and cue. `PreparedCall` is a dataclass holding what the config builders need: locale, lang, voice, agent_name, company, niche, persona prompt, kb_rows, client setup, caller_number, timezone, test account, public-demo flag, greeting and cue. `live_session` must behave byte-identically afterwards. [complex]
  - [ ] Keep the OpenAI-only parts in `live_session`: the session config build, the `/live/sessions` POST and the registry calls keyed by the OpenAI `session_id`.
  - [ ] The voice argument is validated per engine: OpenAI names for GPT-Live, `GEMINI_VOICES` keys for Gemini.
- [ ] New `engine:src/automations/voice/gemini_session_config.py` (keep it under 500 lines). [complex]
  - [ ] `GEMINI_VOICES: dict[str, str]` maps all 30 prebuilt voices to `"female"|"male"`. Female: Zephyr, Kore, Leda, Aoede, Callirrhoe, Autonoe, Despina, Erinome, Laomedeia, Achernar, Gacrux, Pulcherrima, Vindemiatrix, Sulafat. Male: the other 16 (Puck, Charon, Fenrir, Orus, Enceladus, Iapetus, Umbriel, Algieba, Algenib, Rasalgethi, Alnilam, Schedar, Achird, Zubenelgenubi, Sadachbia, Sadaltager). `GEMINI_DEFAULT_VOICE = "Kore"`.
  - [ ] Extend `is_masculine` in `live_session_config.py` (or wrap it) so Gemini male voices give the masculine agent name and disclosure.
  - [ ] `gemini_instructions(prepared) -> str` builds the voice layer exactly as `build_live_session_config` does (same placeholders, knowledge, today and client slots). It then replaces the "Delegation policy" block with a per-locale `_GEMINI_TOOL_POLICY[locale]`, and appends the backend body from `build_backend_instructions(...)` under one heading, without `_BACKEND_PREAMBLE`'s delegation framing.
    - The delegation block runs from the line `Delegation policy:` (or its nl/pt equivalent, as found in both Prompt_Library rows 113-122 and `_VOICE_PROMPTS`) up to the paragraph that starts "Once what they called about is settled" (keep that paragraph).
    - If the marker is not found, append the policy at the end and log `voice.gemini.delegation_marker_missing locale=…`.
    - Follow the lean-prompt rule: positive phrasing, no "never" rules.
    - `_GEMINI_TOOL_POLICY` says: use `book_appointment` to book, then say the booked slot once the result arrives. Call `update_call_summary` when the call's purpose is clear and again if it changes. After your goodbye, call `end_call`.
  - [ ] `gemini_tools(lang) -> list[types.Tool]` converts `booking_tool.voice_tools(lang)` (OpenAI function schemas) into `types.FunctionDeclaration(name, description, parameters_json_schema=…, behavior=types.Behavior.NON_BLOCKING)`. Use the same names and the same enum.
  - [ ] `build_gemini_connect_config(prepared) -> types.LiveConnectConfig` (see Technical Details).
- [ ] New `engine:src/webhooks/gemini_voice_routes.py`. Register its router where `live_voice_routes` is registered.
  - [ ] `POST /voice/gemini/session` takes the same body model as `/voice/live/session` minus `sdp`. It calls `prepare_browser_call`, mints `session_id = "gem_" + uuid4().hex`, mints the token (see Technical Details) and makes the same registry calls `live_session` makes (`remember`, `remember_test_account`, `public_demo_voice.start` if public).
    - Returns `{token, model, session_id, locale, language, voice, company, agent_name, greeting, max_minutes}`. `max_minutes = min(configured limit, 10)`.
    - Logs `voice.gemini.session_started session_id=… locale=… voice=…`.
  - [ ] `POST /voice/gemini/recording/{session_id}` takes a multipart file field `audio`, up to 25 MB, with mime `audio/webm` or `audio/ogg`.
    - Accept only when `session_id` starts with `gem_` and the persona registry still knows it (`recall(session_id)` is not None), so random uploads are refused.
    - Saves to `engine:.tmp/audio/voice_calls/<session_id>.webm`.
- [ ] `GET /voice/live/recording/{session_id}` (live_voice_routes.py:302): when the id starts with `gem_`, serve the local file with its real content type (`audio/webm`), or 404 if it is missing. The `live_` path is unchanged.
- [ ] Extend `GET /voice/live/options` with `gemini: {model, default_voice, voices:[{id,label,gender}], max_call_minutes: 10}`.
- [ ] Purge: next to the existing 14-day purge of `.tmp/audio/inbound/` (called from nightly_summary), purge `.tmp/audio/voice_calls/` files older than 30 days. 30 days matches OpenAI's recording retention.

### Technical Details

Connect config (google-genai 2.10.0, verified against `gemini-3.8-live` on 2026-10-12):
```python
types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=gemini_instructions(p),
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=p.voice))),
    # NO language_code: native-audio models choose language themselves; the prompt fixes it.
    input_audio_transcription=types.AudioTranscriptionConfig(),
    output_audio_transcription=types.AudioTranscriptionConfig(),
    tools=gemini_tools(p.lang),
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(silence_duration_ms=700)),
    context_window_compression=types.ContextWindowCompressionConfig(sliding_window=types.SlidingWindow()),
)
```
Do NOT set: `thinking_config`, `enable_affective_dialog`, `proactive_audio` (always on in 3.8; setting false errors), `language_code`. Any of these closes the socket with 1007/1008.

Token:
```python
client = genai.Client(api_key=settings.gemini_api_key)   # default v1beta works
now = datetime.now(timezone.utc)
tok = await client.aio.auth_tokens.create(config=types.CreateAuthTokenConfig(
    uses=1,
    expire_time=now + timedelta(minutes=12),
    new_session_expire_time=now + timedelta(seconds=60),
    live_connect_constraints=types.LiveConnectConstraints(
        model=settings.gemini_live_native_model, config=connect_config),
))  # lock_additional_fields omitted = whole config locked
return tok.name   # "auth_tokens/…"
```
Use the model from `settings.gemini_live_native_model` ("gemini-3.8-live"). Never send `settings.gemini_api_key` to the client.

Pricing note for logs/UI only: audio in about $0.005/min, audio out about $0.018/min.

---

## Phase 3: Browser, the Gemini call hook

The new hook returns the SAME shape as `useLiveCall()`, so `voice-demo.tsx`, `PhonePanel`, `TranscriptPanel` and `CrmPanel` need no changes beyond picking the hook.

### Tasks
- [ ] Extract the provider-free pieces of `client/src/features/voiceDemo/useLiveCall.ts` into `client/src/features/voiceDemo/callShared.ts`, with no behaviour change for GPT-Live: the `/voice/relay` poster and its CRM receipt handling, the turn-gap accumulator (`TURN_GAP_MS`), the time-limit timer, the silence watcher and farewell regex, the admin-pass fetch and the `/voice/live/wrap-up` call. `useLiveCall` imports them. [complex]
- [ ] `client/src/features/voiceDemo/gemini/audioWorklets.ts`: two AudioWorklet processors as inline module source strings, loaded through a Blob URL.
  - (a) Capture: downmix to mono, resample the context rate to 16 kHz, emit Int16 frames of about 40 ms.
  - (b) Playback: a queue of Float32 frames at the context rate, with a `flush` message for barge-in and a `drained` event when the queue empties.
  - Resample the incoming 24 kHz in the main thread or in the worklet. Use one `AudioContext` for both.
- [ ] `client/src/features/voiceDemo/gemini/geminiSocket.ts`: a thin client.
  - Connects to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=<token>` with `binaryType="arraybuffer"`. Decode each frame with `TextDecoder`, then `JSON.parse`.
  - Sends `{"setup":{"model":"models/gemini-3.8-live"}}` and resolves on `setupComplete`.
  - Exposes typed callbacks: audio chunk (base64 PCM 24k), interrupted, turnComplete, inputTranscription, outputTranscription, toolCall, toolCallCancellation, goAway and close (with code and reason).
  - Has helpers `sendAudio(int16)`, `sendText(clientContent)` and `sendToolResponse(...)`.
- [ ] `client/src/features/voiceDemo/gemini/useGeminiCall.ts` (the hook, under 500 lines). [complex]
  - [ ] Start:
    1. Fetch the admin pass.
    2. `POST {ENGINE}/voice/gemini/session` with the same body fields as `/voice/live/session` minus `sdp`.
    3. `getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})`.
    4. Set up the AudioContext and worklets.
    5. Connect the socket.
    6. Send the greeting (see Technical Details).
    7. Relay `live.greeting_sent`.
    8. Mute the mic upload for 2.5 s, as GPT-Live does.
  - [ ] Transcripts: `inputTranscription` goes to the caller side, `outputTranscription` to Sara's side. Use the shared turn-gap accumulator, which relays `live.caller_turn` and `live.ai_turn`.
  - [ ] Barge-in: on `interrupted`, flush playback.
  - [ ] Tools: on `toolCall.functionCalls[]`, relay each one as `live.function_call` with `{name, arguments: JSON.stringify(args), call_id: id}`.
    - The relay result maps to the same outputs GPT-Live uses: `{status:"booked",slot}`, `not_booked`, or `{ok:true}`.
    - Reply with `toolResponse.functionResponses[{id, name, response, scheduling}]`. Scheduling: `book_appointment` uses `WHEN_IDLE`, `update_call_summary` uses `SILENT`.
    - On `toolCallCancellation.ids`, drop pending replies for those ids.
  - [ ] `end_call`: answer it with `SILENT`. Wait for the next `turnComplete` (or 4 s at most), then wait for the playback `drained` event, then hang up with reason `completed`.
  - [ ] Hang-up: stop the mic, close the socket, stop the recorder and upload the file, then call wrap-up through `callShared` with `session_id`. On `goAway` or a socket close before the call ends, end the call with reason `error` and run wrap-up. No resumption.
  - [ ] The orb level and `useCallLevels` work from the same analyser taps GPT-Live uses: a mic analyser and a playback analyser.
- [ ] `client/src/features/voiceDemo/gemini/geminiRecorder.ts`: a `ChannelMergerNode(2)` with mic into input 0 (left) and the playback worklet output into input 1 (right), feeding a `MediaStreamAudioDestinationNode`, recorded with `MediaRecorder` as `audio/webm;codecs=opus` and a 1 s timeslice. `stop()` returns a Blob. Upload it with `FormData` to `{ENGINE}/voice/gemini/recording/{session_id}`, best effort; a failed upload is logged through relay `live.client_error`.

### Technical Details

Greeting (the model stays silent until it gets input; verified):
```json
{"clientContent":{"turns":[{"role":"user","parts":[{"text":"<greeting instruction from /voice/gemini/session>"}]}],"turnComplete":true}}
```
The `greeting` the session endpoint returns is the same `greeting_instruction()` text GPT-Live uses. Prefix it with a short, locale-neutral marker such as `(call connected) `. `clientContent` is allowed throughout the session on 3.8, but `turnComplete:true` cuts any ongoing output, so send it only once, at the start.

Audio up: `{"realtimeInput":{"audio":{"data":"<b64 Int16LE 16k mono>","mimeType":"audio/pcm;rate=16000"}}}`.
Audio down: `serverContent.modelTurn.parts[].inlineData.data` is base64 Int16LE at 24 kHz.

Tool response:
```json
{"toolResponse":{"functionResponses":[{"id":"…","name":"book_appointment","response":{"status":"booked","slot":"…"},"scheduling":"WHEN_IDLE"}]}}
```
`scheduling` is top level on the FunctionResponse; the SDK enum is `INTERRUPT|WHEN_IDLE|SILENT`. Do not use `willContinue`.

Relay `call_id` uses the same `web-<ts>-<rand>` form as GPT-Live, and `account_id`/`campaign_id` come from the same constants.

Socket errors: log the close `code` and `reason` to the console and relay them as `live.client_error {code, reason}`.

---

## Phase 4: Browser, engine switch and voice picker

### Tasks
- [ ] `client/src/features/voiceDemo/types.ts`: add `engine: "gpt-live" | "gemini-live"` to `LiveSetup` (default `"gpt-live"`), and the options type for the new `gemini` block from `/voice/live/options`.
- [ ] `client/src/pages/voice-demo.tsx` (~:128): call both hooks, `useLiveCall()` and `useGeminiCall()`. Both stay idle until started. Pass the one matching `setup.engine` to the panels. Remember `engine` in localStorage next to the other call settings, wrapped in try/catch.
- [ ] `client/src/features/voiceDemo/components/CallSettings.tsx`: add an Engine segmented control (GPT-Live / Gemini Live) above the voice select. With Gemini selected:
  - The voice select lists `options.gemini.voices` in two `<optgroup>`s (female, male).
  - A small play/stop icon button next to the select plays `/voice-samples/gemini/<voice>-<lang>.mp3` (lang is `en`, `nl` or `pt`, from the selected locale) through one shared `Audio` element. A new pick stops the previous one.
  - Switching engine resets `voice` to "" (the default).
  - If the file grows past 500 lines, split the Gemini voice picker into `components/GeminiVoicePicker.tsx`.
- [ ] i18n: add these keys to `client/src/locales/{en,nl,pt}/` in the namespace CallSettings already uses: engine label, the two engine names, the female/male group labels, play sample and stop sample. PT is Brazilian.

### Technical Details
- Show the engine switch only where the settings gear already shows (`isAppHost`), and only while idle.
- `useOfficeAmbience` keeps working: it plays locally and is not tied to the provider.

---

## Phase 5: Voice samples

### Tasks
- [ ] `engine:scripts/gemini_voice_samples.py`: for each of the 30 voices and each of `en` (en-GB greeting), `nl` and `pt` (pt-BR greeting):
  - Open a Live session on `gemini-3.8-live` with that voice and a minimal system instruction: "Read the user's text aloud exactly, warmly, as a receptionist answering the phone."
  - Send the default demo greeting text for that locale (rendered `GREETINGS[locale]` with agent Sara/male name per gender and company "Brightside").
  - Collect the 24 kHz PCM and write `<voice>-<lang>.mp3` with `ffmpeg -f s16le -ar 24000 -ac 1 -i - -b:a 64k`.
  - Output folder argument; default `/home/gabriel/LeadAwakerApp/client/public/voice-samples/gemini/`.
  - Skip files that already exist unless `--force`. Run sequentially with a short pause, and retry once if no audio comes back.
- [ ] Run it and check that the 90 files exist and are each under 150 KB.

### Technical Details
- Reuse the connect/receive loop shape from `engine:tools/gemini_live_service.py` (`client.aio.live.connect`). Do not apply the 3.1 history-seed fix; 3.8 needs none.
- Cost: under $0.05 for the whole set.

---

## Phase 6: Voice Calls page badge and recording playback

### Tasks
- [ ] `server/routes/voice-calls.ts` `proxyRecording` (~:39-66): pass through the upstream `content-type` instead of hardcoding `audio/wav`, falling back to `audio/wav`.
- [ ] Check that `client/src/features/voiceCalls/useCallAudio.ts` and `CallPlayer.tsx` play `audio/webm`. If waveform decoding uses `decodeAudioData`, check that it handles webm/opus in Chrome and Firefox. Safari may not; if so, the player falls back to plain playback without a waveform.
- [ ] Badge: in `client/src/features/voiceCalls/components/VoiceCallListCard.tsx` and `CallHeader.tsx`, show a small `Pill` (UI surface primitives) reading "Gemini" when `call.engine === "gemini-live"`. GPT-Live calls show nothing, which keeps the existing look. Use tokens only, no raw hex. Add the i18n key in en/nl/pt.

### Technical Details
- Engine `GET /voice/live/recording/gem_…` returns `audio/webm`.
- The Voice tab "Try her out" card's test-calls list (`TestCallsList.tsx`) gets the same badge if it shows per-call rows.
