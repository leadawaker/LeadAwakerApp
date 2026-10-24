# Voice test panel: live test beside the prompt, then a call review

Handoff written 2026-10-23 from the session that built the ElevenLabs browser test. Start a new session with: "Read specs/voice-test-panel/requirements.md, then brainstorm and write the plan." Confirm the open questions at the bottom with Gabriel before planning.

## Why

Gabriel tunes the AI receptionist by test calls from the account's Voice tab. Today:
- The ElevenLabs browser test runs in a panel under the Test card, far from the prompt he is editing.
- The GPT Live browser test opens a separate page (`/voice-demo?...`, `client/src/pages/voice-demo.tsx`), so he loses the Voice tab.
- After a test he cannot see which tools ran, how long each reply took, or what the call cost, without asking Claude to run the call digest (`automations/tools/voice_call_digest.py`).

He likes ElevenLabs' own call view: a timeline with the audio waveform, tool-call markers (search_stock, check_availability, book_appointment, update_call_summary, end_call) placed at the moment they ran, play / speed / skip back and forward / download, and zoom.

## What to build

1. **One test panel for both engines** on the Voice tab:
   - Wide screens: a right-hand column beside the prompt and settings (the space is there on a widescreen); the rest of the Voice tab stays usable while a call runs.
   - Smaller screens (below the widescreen breakpoint, and mobile below 768px): stays where the Test card is today, full width.
   - GPT Live's browser test runs inside this panel instead of opening `/voice-demo`. ElevenLabs' runs there too. On an ElevenLabs line both buttons stay (Gabriel chose "keep both" earlier).
2. **During the call** the panel shows: status, live transcript, each tool call as it happens (name, short result, engine time in ms), the delay per reply, a running timer and the running cost.
3. **After the call** the same panel turns into the review, modelled on ElevenLabs' view: waveform timeline with tool markers, play, speed (1.0x and up), skip back and forward, download, zoom; clicking a marker or a transcript line seeks the audio; a summary row with duration, cost, median and slowest reply delay, number of tool calls.
4. **Test calls list** (`TestCallsList.tsx`): opening an older test shows the same review; add a cost column.

## What already exists (verify, it was true on 2026-10-23)

CRM (`client/src/features/accounts/components/workspace/voice/`):
- `TestCard.tsx` (58 lines): the GPT Live link to `/voice-demo` and, on an ElevenLabs line (`runsOnEleven`), `ElevenTestPanel`.
- `ElevenTestPanel.tsx`, `useElevenTestCall.ts` (lazy `@elevenlabs/client` 1.30.0, WebRTC, SDK `overrides`), `elevenTestState.ts` (+ test). No caller number field any more: the server uses the first enabled engine-test number from the Demos page (`server/routes/voiceElevenTest.ts`, `Demo_Settings` service "voice", `engineTests`).
- `TestCallsList.tsx` (99 lines): finished test calls with transcript, recording and recap, as on the Voice Calls page.
- Server: `server/routes/voiceElevenTest.ts` + `voiceElevenTestRelay.ts` proxy to the engine with `X-Internal-Key`; `/api/voice-calls/:id/recording` checks access and proxies the engine's recording.

Engine (`/home/gabriel/automations`):
- `POST /voice/eleven/browser-session` and `/{id}/started` (`src/webhooks/eleven_browser_routes.py`), `BrowserElevenCall` (`src/automations/voice/eleven_browser_call.py`).
- Recordings: `GET /voice/live/recording/{session_id}` (`src/webhooks/live_voice_routes.py`): GPT Live stereo recording (30 days), Grok via Telnyx, ElevenLabs mp3 from ElevenLabs' API. Check whether GPT Live *browser* tests are recorded at all; if not, the timeline shows markers without a waveform until recording is added.
- Tool calls: `Voice_Call_Events` rows per call (tool name, arguments, result, engine ms, time). The digest tool shows how to read them and how to line them up with ElevenLabs' own `tool_latency_secs`.
- Reply delay: ElevenLabs gives per-turn metrics in the conversation API (`eleven_api.conversation`), today NOT stored (`Voice_Calls.latency_ms` / `latency_p90_ms` are null on ElevenLabs calls). GPT Live logs `voice.phone.reply_gap` and fills `latency_ms` / `latency_p90_ms`.
- Cost: `Voice_Calls.cost_usd`. On ElevenLabs it looks like the LLM part only (a 3 minute Max call showed $0.04); Gabriel is on an ElevenLabs subscription, not API pricing, so the minutes are prepaid. Decide with him what "price per test" should show (see open questions).

## Rules that apply

- CRM: read `UI_STANDARDS.md`, `UI_PATTERNS.md`, `FILE_MAP.md`; tokens only, dark mode, neumorphic utilities, `IconBtn` for icon buttons, right panels not dialogs, every string in en, nl, pt (pt is Brazilian). Never run tsc unless Gabriel asks; pm2 reloads on save, so every save must compile.
- Engine: run `./preflight.sh` before `pm2 restart leadawaker-engine --update-env`, check no call is live first. Engine tests: `.venv/bin/python -m pytest tests/voice -q -p no:cacheprovider` keeps only the baseline failures in `.superpowers/sdd/2026-10-22-elevenlabs-engine-step1/baseline-failures.txt`.
- Never print or log secrets (API keys, webhook secrets, conversation tokens). The ElevenLabs conversation JSON carries the webhook secret in tool headers: never pass it to the browser raw.
- Test calls never alert the client (Thijs) and never show in client figures. Client lines (e.g. +31738519862) behave exactly as today.
- No em dashes anywhere. No git commits unless Gabriel asks. Keep files under about 500 lines.
- Gabriel's preference: subagent-driven execution with a review per task.

## Open questions for Gabriel

1. Price per test: show only what we can measure (LLM tokens on ElevenLabs, OpenAI usage on GPT Live), or an estimate that includes ElevenLabs minutes at his plan's rate?
2. Live tool calls during the call: polling the engine every 1 to 2 s is simplest; a server-sent events stream is smoother. Polling is the suggested default.
3. Widescreen breakpoint: the right-hand column from 1440px wide, or another width?
4. If GPT Live browser tests are not recorded today, add recording in this project or ship the timeline without a waveform first?

## Addendum 2026-10-23 23:30: ElevenLabs model and temperature in the UI (Gabriel's request)

Gabriel: "allow me to switch models directly in my UI, plus temperature", and the "Mini" label is wrong now. Facts found in the other session (verified with the API and ElevenLabs docs):

- The two ElevenLabs agents (`settings.elevenlabs_agent_max`, `settings.elevenlabs_agent_mini`) are slots. Max = `conversation_config.realtime_model: "eleven_realtime_v1_max"` (Realtime mode: ElevenLabs manages LLM, reasoning effort, TTS model, ASR; `agent.prompt.llm` and temperature are IGNORED). Mini was switched at 2026-10-23 22:35 to custom mode: `realtime_model: null`, `agent.prompt.llm: "gpt-6.1-sol"`, `reasoning_effort: "low"`, `temperature: 0.4`, TTS `eleven_v4_turbo` expressive, ASR scribe_realtime. So "Mini" now means "custom mode, Sol".
- Custom mode LLM is set on the agent (PATCH `/v1/convai/agents/{id}`). Per-call LLM override exists in the overrides schema (`agent.prompt.llm`) but is disabled in `platform_settings.overrides` today (false), and only means something in custom mode.
- Sol rejects `reasoning_effort` "none" and "minimal" (400 "Not supported reasoning effort"); "low" is its floor. Non-reasoning models may reject any reasoning_effort: retry without it on that 400.
- Candidate LLM ids from the API enum: gpt-6.1-sol, gpt-6-luna, gpt-6-sol, gpt-5.4-mini, gpt-4.1-mini, gemini-2.5-flash, gemini-3.5-flash, claude-haiku-4-5, claude-sonnet-4-6.

What Gabriel wants: on the Voice tab (agency only), per agent slot, pick the brain (Realtime Max, Realtime Mini, or custom mode with an LLM from a short list) and the temperature (0 to 1, greyed out with a note under Realtime), saved straight to ElevenLabs through the engine (internal key, whitelisted fields only, never print the API key). The Max/Mini switch labels show what each slot runs now (for example "Agent 1: Realtime Max", "Agent 2: gpt-6.1-sol") instead of "Max"/"Mini". The change affects every test and demo line on that slot: say so in the card. This supersedes the Task 2 finding if it said an LLM pick is impossible: it is possible per agent in custom mode.

## Known bug to fix in this project

When the browser fails to connect after the engine minted the token, the engine keeps the slot until `CONNECT_DEADLINE_S` (60 s). Every retry in that minute gets 429, and the panel shows "A browser test is already running" (seen 2026-10-23 22:40). Add a release call the browser sends on a connect failure (and on Hang up while connecting), so a retry works at once.

## Related, separate projects (not this one)

- Shortening the GPT Live voice layer (about 23,000 characters today; OpenAI's starter is about 700). Its own project.
- The ElevenLabs prompt rewrite to a lean version is being drafted in the session that wrote this file.
