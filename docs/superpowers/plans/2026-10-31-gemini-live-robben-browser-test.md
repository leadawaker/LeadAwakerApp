# Gemini Live in the Robben browser test: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third engine tab, Gemini Live, in account 59's "Try him/her out" test panel, running `gemini-3.8-live` in the browser in Dutch with the cars tools and the demo calendar, plus a voice picker with Dutch previews.

**Architecture:** The engine (FastAPI) builds the same persona and knowledge as the GPT Live staff test, folds the backend instructions into one Gemini system instruction, and mints a single-use ephemeral token with model, prompt, tools and voice locked in. The browser opens a raw WebSocket to Gemini's `BidiGenerateContentConstrained` endpoint with that token, streams 16 kHz PCM from an AudioWorklet, plays 24 kHz PCM back, and relays transcripts and tool calls to the existing `/voice/relay` as OpenAI-shaped events.

**Tech Stack:** Python 3.13, FastAPI, google-genai 2.10 (v1alpha auth_tokens); React + TS, Web Audio, i18next.

**Spec:** `docs/superpowers/specs/2026-10-31-gemini-live-robben-browser-test-design.md`

## Global Constraints

- Only account 59 (Robben Rosmalen experiment). Engine refuses any other account with 403.
- Model from `settings.gemini_live_native_model` ("gemini-3.8-live"), never hardcoded, never the `-extended-thinking` variant.
- Tools: `search_stock`, `car_details`, `book_appointment` (demo diary), each `behavior: "BLOCKING"`. Nothing else.
- Prompt row: use_case `voice_lean_layer_nl_gemini`, Dutch only. Shown to Gabriel before it is inserted.
- API key never in the browser. Token: `uses: 1`, new session within 2 min, expires in 15 min.
- Call cap: 10 minutes (one Live connection).
- GPT Live code paths unchanged in behavior.
- Work in worktrees `/home/gabriel/automations-gemini` and `/home/gabriel/LeadAwakerApp-gemini` (branch `feat/gemini-live-test`); merge into the running checkouts only at the end, committing only this feature's files.
- CRM: every string through i18n (`en`, `nl`, `pt`); no `npx tsc` unless Gabriel asks.
- Files under 500 lines.

## Review Focus

1. Echo: speakers without headphones can make Gemini interrupt itself. Mic constraints `echoCancellation/noiseSuppression/autoGainControl: true`.
2. Hang up mid-tool-call or mid-connect: no WebSocket, mic track or AudioContext left running.
3. Token expired or used (slow connect, double click): the panel shows an error and returns to idle.
4. Gemini `goAway` or close at the connection limit: the call ends cleanly with a review, not a stuck "live".
5. A Gemini session id (`gem_…`) at `/voice/relay` and `/voice/live/wrap-up`: logged as a test call of account 59, never priced as GPT Live.

---

### Task 1: Engine session route and token

**Files:**
- Create: `src/automations/voice/gemini_live_test.py`
- Create: `src/webhooks/gemini_voice_routes.py`
- Modify: `src/main.py` (include router)
- Test: `tests/test_gemini_live_test.py`

**Interfaces:**
- Produces: `GEMINI_TEST_ACCOUNTS: frozenset[int] = {59}`; `GEMINI_LAYER_USE_CASE = "voice_lean_layer_nl_gemini"`; `GEMINI_VOICES: dict[str, str]` (name → "female"|"male"); `DEFAULT_GEMINI_VOICE = "Aoede"`; `to_gemini_declaration(tool: dict) -> dict`; `gemini_tools(session: dict) -> list[dict]` (picks search_stock, car_details, book_appointment out of the backend tools); `gemini_instruction(session: dict) -> str`; `mint_token(*, instruction: str, tools: list[dict], voice: str) -> str`.
- Produces: `POST /voice/gemini/session` body `{password, admin_pass, account, voice, timezone, caller_number}` → `{token, ws_url, model, session_id, language, voice, company, agent_name, greeting, cue, max_seconds}`.

- [ ] Tests: `to_gemini_declaration` drops `"type"`, keeps name/description/parameters, adds `behavior: "BLOCKING"`; `gemini_tools` returns exactly those three names when the backend has them; `gemini_instruction` contains the voice instructions and the backend instructions and no `<|SpawnThinking|>`; route returns 403 for account 53 and for a missing admin pass.
- [ ] Implement. Route mirrors the staff branch of `live_session` (load_client_line, resolve_persona_prompt, render_slots, intake_items, client rules, build_live_session_config with `voice_template` = the Gemini row, `compact_stock=True`, add_browser_stock_tools with `search=True`, with_detail_rules). Register `remember`, `remember_test_account(session_id, 59)` without a model (no GPT pricing), `remember_stock_account`.
- [ ] Run `pytest tests/test_gemini_live_test.py -q`; PASS. Commit.

### Task 2: Gemini Dutch prompt row

- [ ] Draft the Gemini layer from row 134: same placeholders, language rule first, delegation section replaced by direct tool use instructions for the three tools, no `<|SpawnThinking|>`. Show to Gabriel, then insert into Prompt_Library (status active, model gemini-3.8-live, category voice). `voice_prompt_store` already loads `voice_lean_layer_*`; add `gemini_layer_text()` reading `GEMINI_LAYER_USE_CASE`.

### Task 3: Voice samples

**Files:** Create `tools/gemini_voice_samples.py`; output `LeadAwakerApp/client/public/voice-samples/gemini/nl/<Voice>.mp3`.
- [ ] Script opens one Live session per voice, has it say the Robben greeting, converts 24 kHz PCM to mp3 (ffmpeg, mono 64k). Voices that fail are reported and left out of `GEMINI_VOICES`.

### Task 4: Browser hook

**Files:** Create `client/src/features/voiceDemo/gemini/geminiAudio.ts` (mic AudioWorklet → 16 kHz Int16 base64 chunks; 24 kHz player with `flush()`), `client/src/features/voiceDemo/gemini/useGeminiLiveCall.ts`.
- **Produces:** `useGeminiLiveCall()` → `{ state: CallState; orbState; turns: Turn[]; tools: LiveToolRun[]; replyGaps: number[]; callId; startedAt; error; start(setup: { account: number; voice: string }): Promise<void>; hangup(): void; reset(): void }` (same field types as `useLiveCall`).
- [ ] Events: `serverContent.inputTranscription` / `outputTranscription` build turns, flushed into relay events `conversation.item.input_audio_transcription.completed` / `response.output_audio_transcript.done` at turn end; `toolCall.functionCalls[]` → relay `response.function_call_arguments.done` `{name, arguments: JSON, call_id}` → `toolResponse.functionResponses[{id, name, response: {result}}]`; `interrupted` → `player.flush()`; `goAway`/close → end. Greeting: after `setupComplete`, send `realtimeInput.text` with the greeting instruction. Cap via `max_seconds`. Wrap-up through `/voice/live/wrap-up` as GPT Live does.

### Task 5: Test panel engine tab and voice picker

**Files:** Modify `testPanelPrefs.ts` (`TestEngine` adds `"gemini-live"`), `VoiceTestProvider.tsx`, `TestPanelHead.tsx`; create `voice/test/GeminiVoicePicker.tsx`, `voice/test/geminiAccess.ts` (`GEMINI_TEST_ACCOUNT_IDS = [59]`, `geminiVoiceKey`), locales `voiceTab.json` (en/nl/pt).
- [ ] Engine tab shows when Gemini is available (account 59 and agency user) or SHOW_ELEVEN: GPT Live | Gemini Live (| ElevenLabs). Gemini selected: voice picker grouped female/male with a play button (one sample plays at a time), choice stored per browser. Test prefs tests extended for `gemini-live`.
- [ ] `npx vitest run client/src/features/accounts/components/workspace/voice/test` PASS. Commit.

### Task 6: Go live and verify

- [ ] Merge both branches into the running checkouts, `./preflight.sh && pm2 restart leadawaker-engine --update-env`, check logs, confirm no account 59 alert routes to Thijs, then a scripted end-to-end check of `/voice/gemini/session` + WebSocket + one tool call. Gabriel runs the Dutch acceptance call.
