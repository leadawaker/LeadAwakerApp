# Voice test panel: design

Written 2026-10-23. Builds on `requirements.md` (same folder): read that first for the why, the existing files and the rules. This file records the decisions and what recon found. "Gabriel's call" marks what he decided; "builder's call" marks what was decided for him on his request ("just do what you would recommend").

## Intent

Gabriel tunes the AI receptionist by making test calls from the account's Voice tab. He wants to stay on that tab, see the prompt while he talks, watch the tools and delays live, and afterwards review the call the way ElevenLabs shows it (waveform, tool markers, seekable transcript), with a price per test he can trust.

Success: he runs a GPT Live or ElevenLabs test beside the prompt, sees what ran and how slow it was during the call, and reviews it right after (or days later from the test calls list) without asking Claude for a digest.

Anti-goals: client lines (e.g. +31738519862) change in any way; test calls alert Thijs or show in client figures; secrets (API keys, webhook secrets, conversation tokens) reach the browser or logs; the `/voice-demo` page used for prospects breaks.

Non-goals: shortening the GPT Live voice layer, the ElevenLabs prompt rewrite, a server-sent events stream, recording changes for phone calls.

## What recon found (2026-10-23, verify file:line before editing)

- **GPT Live browser test** (`client/src/features/voiceDemo/useLiveCall.ts`): WebRTC straight to OpenAI, the engine only brokers SDP (`POST /voice/live/session`). Tools run in the browser (`handleTool`), transcript and tool events go to the engine by `POST /voice/relay`, end by `POST /voice/live/wrap-up`. Engine logging is `CallLogger` (`src/automations/voice/event_logger.py`), not `PhoneCall`.
  - Recorded: yes, 30 days at OpenAI (`store=True`), served by `/voice/live/recording/{session_id}`. So the waveform works for both engines.
  - Writes a `Voice_Calls` row, but **no `Voice_Call_Events`, no cost, no latency**. Marked test by `test_account_id` only, not `is_test`.
- **ElevenLabs**: tool calls run on the engine and write `Voice_Call_Events`. `cost_usd` is wrong: the minutes price at $0 (`eleven_realtime_v1_*` is not in `LIVE_PER_MIN`, `call_costs.py`) and a Telnyx telephony charge is added even on a browser test with no phone leg. Per-turn metrics exist in the conversation API (`transcript[].conversation_turn_metrics.metrics.*.elapsed_time`, `time_in_call_secs`, `tool_results[].tool_latency_secs`) but are not stored. Nothing reads plan or charging data.
- **Prices**: all in `src/automations/voice/call_costs.py` (`LIVE_PER_MIN` gpt-live-1 $0.05/min, `TEXT_PER_M`, Telnyx rates, `price_call`, `latency`).
- **Live events**: CRM `GET /api/voice-calls/:callId` already returns `events` for agency users and can be polled mid-call (ElevenLabs call_id `el_<conv>`).
- **Layout**: `VoiceTab.tsx` uses `SectionLayout` (220px rail + content). `PromptSection.tsx` renders TestCard, AgentVoiceCard, LineEngineCard, prompt cards. Content cap 1386px. Breakpoint tokens 768 / 1024 / 1240 / 1680; `useIsMobile(1440)` is used once (DemoCampaignSettings).
- **Audio**: no waveform library. `CallPlayer.tsx` (Voice Calls page) has seek, speed, skip, no waveform or markers. `VoiceMemoPlayer` draws bars with `decodeAudioData`.
- **Test calls list**: `GET /api/accounts/:id/voice/test-calls`, items have no cost, latency or engine field.

## Decisions

### Price per test (Gabriel's call: estimate that includes ElevenLabs minutes; GPT Live keeps its own pricing)
- **GPT Live**: priced by the existing `call_costs.price_call` (live minutes at `LIVE_PER_MIN` + recap tokens). Browser tests get priced at wrap-up the same way phone calls are, with no telephony part.
- **ElevenLabs**: price = plan cost of the call + measured LLM/recap tokens, never telephony on a browser test.
  - Plan: Creator, $22 a month (Gabriel). Store as engine config, not code: `ELEVEN_PLAN_USD=22` and `ELEVEN_PLAN_CREDITS` (credits included per month).
  - Preferred: read the call's credits from the conversation API metadata (`metadata.cost`, and `metadata.charging` for the LLM part if present) and convert at `ELEVEN_PLAN_USD / ELEVEN_PLAN_CREDITS`.
  - Fallback if those fields are missing: minutes × `ELEVEN_PLAN_USD_PER_MIN`.
  - **Builder verifies** on a real conversation which fields exist and on ElevenLabs' pricing page what Creator includes (credits and agent minutes); Gabriel's recollection is $22/month, and the minute rate is believed to be about $0.09. Use the real numbers, not these.
- Priced as a share of the plan even if a month's credits go unused; overage is not modelled (builder's call: tests stay well inside Creator's credits). If Gabriel changes plan, he updates the two config values.
- Telephony is still added for ElevenLabs phone calls; only browser tests drop it.
- Shown everywhere as "≈ $0.12" (estimate mark) with a breakdown tooltip: minutes, AI, recap.
- Cost visibility follows the existing rule (stripped for non-Owner, `voice-line.ts:260-263`).

### Live updates (builder's call: polling)
- Poll `GET /api/voice-calls/:callId` every 1.5 s while the call is live, stop at end. ElevenLabs tools come from `Voice_Call_Events`.
- GPT Live tools run in the browser, so the panel shows them instantly from `useLiveCall` and they are also written as `Voice_Call_Events` (below) for the review.
- Reply delay live: measured in the browser for both engines (end of caller's final transcript to the agent's first audio), shown per reply. The review uses the engine's numbers when available.
- Running cost live: elapsed × per-minute rate. The engine returns its rates (GPT Live `LIVE_PER_MIN`, ElevenLabs plan rate) in the browser-session / options response so prices are never duplicated in the client. Final cost after the call replaces it.

### Breakpoint (builder's call: 1440px)
- From 1440px wide the test panel is a sticky right-hand column (about 400px) beside the prompt section; the rest of the Voice tab scrolls and stays editable during a call. The Voice tab's content may exceed the 1386px cap on this tab only to fit the column (builder checks this against `docs/content-width-cap.md` and keeps the cap if the column fits inside it).
- Below 1440px the panel sits where TestCard is today, full width; below 768px it is the mobile layout.
- One named constant for 1440 so it is easy to change.

### Panel scope (builder's call)
- The panel belongs to the whole Voice tab, not only the Prompt section. Call state lives above the section switch (in `VoiceTab` or a provider around it), so switching sections in the rail never drops a live call or the review. On wide screens the column shows on every section; below 1440px the full-width panel shows on the Prompt section, and a live call keeps running (with a small "call in progress" bar on other sections) when he switches.

### Which calls the engine changes touch (builder's call)
- Only staff tests started from the Voice tab. Prospect demos on `/voice-demo` behave exactly as today (no `is_test`, no new events or pricing), so nothing Gabriel watches for demo leads changes. The marker is the existing staff-test path (`remember_test_account` / `test_account_id`, set only for an agency user's test); the builder confirms it is never set for a prospect demo before relying on it.

### Prompt used by a test (builder's call)
- Starting a test first flushes any pending autosave and waits for it; the call then runs on that saved prompt. Edits made during the call apply to the next test, and the panel says so in one line while live. Storing a prompt version per call is out of scope.

### Recording (resolved by recon)
- Both engines are recorded, so the review always has a waveform when the recording is available. If the recording is missing or expired (GPT Live keeps 30 days), the timeline shows markers on an empty track.

### Waveform (builder's call: wavesurfer.js 7, lazy-loaded)
- Gives zoom, regions/markers, split stereo channels (GPT Live is stereo: caller and agent) and seek out of the box. Lazy-loaded with the review so it never lands in the entry chunk. Exact version pinned by the builder.

## How it works

### Panel (CRM)
- New `VoiceTestPanel` replaces the body of `TestCard`. States: idle → connecting → live → ending → review.
- Idle: engine buttons. GPT Live always; on an ElevenLabs line (`runsOnEleven`) both GPT Live and ElevenLabs (Gabriel chose "keep both").
- Live: status, timer, running cost, live transcript, tool list (name, short result, engine ms), delay per reply.
- Review (after the call, and when opening an older test): summary row (duration, cost with breakdown, median and slowest reply delay, tool call count), waveform with tool markers at the time they ran, play, speed (1.0x, 1.25x, 1.5x, 2x), skip back/forward 10 s, download, zoom; clicking a marker or a transcript line seeks. A "new test" action returns to idle.
- GPT Live in the panel reuses `useLiveCall` (the hook, not the page). `/voice-demo` stays as it is.
- Test calls list: add cost (and duration if missing) columns; opening a test shows the review in the panel (wide) or inline (narrow), not a dialog.

### Review data (one normalized shape for both engines)
- New CRM endpoint `GET /api/voice-calls/:callId/review` (agency only, same access check as the call detail) returns: call meta (engine, start, duration, recording URL via the existing `/api/voice-calls/:id/recording`), turns (speaker, text, offset s, reply delay ms), tools (name, short args, short result, engine ms, offset s), summary (median and slowest delay, tool count), cost (total, breakdown, estimate flag).
- The CRM builds it from `Voice_Calls`, its turns and `Voice_Call_Events`. ElevenLabs per-turn delays come from the engine (next point). The builder decides whether the CRM computes the shape or proxies a ready one from the engine; one place only.
- ElevenLabs per-turn metrics: the engine fetches the conversation once when the call ends, stores per-turn delays (where: builder's call, e.g. a JSON column on `Voice_Calls` added with `script/add-field.ts`, or turn rows) and fills `latency_ms` / `latency_p90_ms` with `call_costs.latency`. The raw conversation JSON never reaches the browser (it carries the webhook secret in tool headers).
- Marker alignment: offsets are relative to the recording's start. The builder checks on one real call per engine that a marker sits where the tool ran in the audio, and corrects the offset if the recording starts before or after the call row's start.

### Engine changes
- `CallLogger` (GPT Live browser): write `Voice_Call_Events` for tool events from `/voice/relay`, store the browser-measured reply gaps sent with the relay, at wrap-up price the call with `price_call` (no telephony) and fill latency with `call_costs.latency`. Also set `is_test` on browser tests, like ElevenLabs does.
- ElevenLabs: plan-based pricing, no telephony on browser tests, per-turn metrics stored at call end.
- Rates exposed to the browser in the session/options response.
- Engine rules from `requirements.md` apply (preflight, no live call before restart, voice tests baseline).

## Constraints (from requirements.md and the repo)
CRM UI standards, tokens and dark mode, `IconBtn`, no dialogs, every string in en / nl / pt (Brazilian), files under about 500 lines, lazy routes, no tsc unless Gabriel asks, every save must compile (pm2 reloads). No em dashes. No git commits unless asked. Subagent-driven execution with a review per task.

## Left to the builder
File and component split, polling hook shape, where per-turn ElevenLabs delays are stored, whether the CRM or engine builds the review shape, wavesurfer version and plugins, short-result truncation, empty and error states, exact column width.

## Addendum 2026-10-23: engine tab, LLM pick, real-call engine (Gabriel's calls)

- **Engine tab is the head of the panel.** A GPT Live | ElevenLabs tab switch, an LLM pick, and one Test button below it. No second button any more (replaces "keep both"). Available on every line, not only ElevenLabs lines.
- **The tab and LLM pick in the panel are test only.** They start from the line's saved settings, are remembered per browser, and never change what real callers get.
- **Real-call settings are built now too** (Gabriel: "lets already build that feature"). The line settings card holds the engine and LLM real callers get, per line, including client lines. Default stays GPT Live with Sol, so no client line changes until someone picks something else; switching a client line asks for an inline confirm (no dialog).
  - This replaces the old rule that a client line ignores its engine pick (`line_purpose.line_pick`). Before a client line can run on ElevenLabs, the ElevenLabs phone path must match GPT Live for client duties: alerts to the client, recap, booking, account attribution, client figures. Gaps found there are fixed in this project or the client-line option stays disabled with a note.
- **LLM choices:** Sol `gpt-6.1-sol` (default, today's GPT Live backend), Terra `gpt-5.6-terra`, Luna `gpt-5.6-luna`. Stored as short keys (`sol`, `terra`, `luna`), one per engine per line. On GPT Live it is the backend model behind the voice (`session.delegation.responses.model`), and pricing uses it.
  - **ElevenLabs caveat (recon):** the agents run Eleven Realtime speech-to-speech with no separate LLM, and nothing in the code sets one. A feasibility check comes first: if ElevenLabs lets a realtime agent use one of these models (built-in or custom LLM), it is wired; if not, the ElevenLabs LLM pick is not shown and Gabriel is told why.
- **Mini stays** (Gabriel, later the same day: "bring mini back, maybe it's better for conversation than max"). The ElevenLabs model pick (Max | Mini) stays on the line card for real calls, and the test panel shows it in place of the LLM pick on the ElevenLabs tab, test only, so he can compare the two.
- **ElevenLabs LLM pick: not feasible** (Task 2, `/home/gabriel/automations/specs/voice-test-panel/eleven-llm-check.md`): Eleven Realtime manages the LLM itself. Sol / Terra / Luna is GPT Live only.
