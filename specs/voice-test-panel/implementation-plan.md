# Voice Test Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One test panel on the account Voice tab (engine tab, LLM pick, one Test button, live view, ElevenLabs-style review), honest cost and delay data from the engine, and per-line real-call engine and LLM settings.

**Architecture:** The engine (Python, `/home/gabriel/automations`) gains per-call LLM choice, staff-test logging for GPT Live browser calls (events, delays, price), plan-based ElevenLabs pricing and stored per-turn metrics. The CRM server exposes a normalized review endpoint and richer test-call items. The CRM client lifts test-call state above the Voice tab's section switch into a provider, renders the panel as a right column from 1440px or inline below, polls call events while live, and shows the review with wavesurfer.js.

**Tech Stack:** React + Vite + Tailwind v4 + react-i18next, Express + Drizzle, Python FastAPI engine, `@elevenlabs/client` 1.30.0, wavesurfer.js 7 (new, lazy).

**Spec:** `specs/voice-test-panel/requirements.md` and `specs/voice-test-panel/design.md` (including its 2026-10-23 addendum). Executors read both.

## Global Constraints

- CRM: read `UI_STANDARDS.md`, `UI_PATTERNS.md`, `FILE_MAP.md` before UI work; tokens only, dark mode, neumorphic utilities, `IconBtn` for icon buttons, right panels not dialogs.
- Every user-facing string in `client/src/locales/{en,nl,pt}/` (pt is Brazilian Portuguese).
- Never run tsc unless Gabriel asks. pm2 reloads the CRM on save, so every save must compile: write a file completely before saving imports to it.
- Engine: `./preflight.sh` before `pm2 restart leadawaker-engine --update-env`, and only when no call is live. Engine tests: `.venv/bin/python -m pytest tests/voice -q -p no:cacheprovider` must keep only the failures in `.superpowers/sdd/2026-10-22-elevenlabs-engine-step1/baseline-failures.txt`.
- CRM unit tests: `npx tsx --test <file>.test.ts` (node:test, as in `lineEngine.test.ts`).
- New DB columns only via `npx tsx --env-file=.env script/add-field.ts <Table> <field> <type> [default]` from `/home/gabriel/LeadAwakerApp`.
- Never print or log secrets. The ElevenLabs conversation JSON carries the webhook secret in tool headers: never pass it to the browser raw.
- Test calls never alert the client and never show in client figures. Prospect demos on `/voice-demo` behave exactly as today.
- No em dashes anywhere (code, comments, copy). No git commits unless Gabriel asks: every "commit" step below is replaced by "leave changes uncommitted". Files under about 500 lines.
- LLM keys and models, verbatim: `sol` = `gpt-6.1-sol` (default), `terra` = `gpt-5.6-terra`, `luna` = `gpt-5.6-luna`.
- ElevenLabs plan: Creator, `ELEVEN_PLAN_USD=22`; credits per month and minute rate verified on ElevenLabs' pricing page, never guessed.
- Wide breakpoint: 1440px, one named constant `TEST_PANEL_WIDE_PX = 1440`.

## Review Focus

1. A client line with no engine/LLM set (all today's rows): real calls stay GPT Live with Sol, no log noise, no alerts change. Test in Task 3.
2. A `/voice-demo` prospect call (no staff account): no `is_test`, no events, no pricing change. Test in Task 4.
3. Switching Voice tab sections or leaving the tab during a live call: the call keeps running (section switch) or is hung up cleanly (leaving the account), never orphaned with the mic open. Test in Task 9.
4. A test whose recording is missing or expired, or whose call has zero tool events: the review renders markers on an empty track or "no tools ran", no crash. Test in Task 11.
5. An unknown or malicious `llm` value from the browser or the DB: falls back to Sol, never forwarded to OpenAI or ElevenLabs. Test in Task 1.

---

## Part A: Engine

### Task 1: LLM choice for GPT Live (per line and per test)

**Files:**
- Create: `src/automations/voice/llm_choice.py`
- Modify: `src/automations/voice/live_session_config.py` (`BACKEND_MODEL` ~:68-71, `build_live_session_config` ~:1171-1265; fix the stale "terra over luna" comment)
- Modify: `src/webhooks/phone_voice_routes.py` (~:269), `src/webhooks/live_voice_routes.py` (`LiveSessionBody`, `live_session` ~:140-303), `src/automations/voice/call_costs.py` (`price_call` takes the model used), `src/automations/voice/phone_call.py:407`
- DB: `Voice_Numbers.live_llm text` and `Voice_Numbers.eleven_llm text` (both via `add-field.ts`, no default: NULL means Sol). Add both to whatever query loads the route row.
- Test: `tests/voice/test_llm_choice.py`

**Interfaces:**
- Produces: `LLM_MODELS: dict[str, str]` (`{"sol": "gpt-6.1-sol", "terra": "gpt-5.6-terra", "luna": "gpt-5.6-luna"}`), `DEFAULT_LLM = "sol"`, `model_for(key: str | None) -> str` (unknown or None returns `"gpt-6.1-sol"`), `key_for(key: str | None) -> str`.
- Produces: `build_live_session_config(..., backend_model: str = BACKEND_MODEL)`.
- Produces: `LiveSessionBody.llm: str | None`, honored only when the request is a staff test (`line` / `account` present and allowed, the existing staff path). Otherwise the line's `live_llm`, otherwise Sol.

- [ ] **Step 1: Write failing tests**: `test_model_for_known_keys` (each of the three keys maps verbatim), `test_model_for_unknown_falls_back` (`model_for("gpt-4o")`, `model_for(None)`, `model_for("")` all equal `"gpt-6.1-sol"`), `test_session_config_uses_backend_model` (config built with `backend_model="gpt-5.6-luna"` has `session.delegation.responses.model == "gpt-5.6-luna"`), `test_price_call_uses_given_model` (luna priced cheaper than sol for the same token counts, using `TEXT_PER_M`).
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/voice/test_llm_choice.py -q -p no:cacheprovider`: FAIL (module missing).
- [ ] **Step 3: Implement** `llm_choice.py`; thread `backend_model` through `build_live_session_config`; phone route reads `route["live_llm"]`; browser `live_session` uses body `llm` for staff tests only; the chosen model is kept on the call so `price_call` and costs use it (recap keeps its own model).
- [ ] **Step 4: Run** the new tests and the full voice suite: PASS, baseline failures only.

### Task 2: ElevenLabs LLM feasibility, then wiring (gated)

**Files:**
- Create: `specs/voice-test-panel/eleven-llm-check.md` (findings, sources, decision)
- Modify (only if feasible): `scripts/eleven_setup.py` (~:197-200 allowed overrides), `src/automations/voice/eleven_call.py` (~:101-115), `src/webhooks/eleven_browser_routes.py` (`overrides()` ~:85-93)
- Test: `tests/voice/test_eleven_llm.py` (only if feasible)

**Interfaces:**
- Produces: `ELEVEN_LLM_SUPPORTED: bool` in `llm_choice.py`. The CRM hides the ElevenLabs LLM pick when the line payload says `elevenLlmSupported: false` (Task 7).

- [ ] **Step 1:** Research ElevenLabs Agents docs and API (via a subagent: why = deciding whether an LLM pick on an Eleven Realtime speech-to-speech agent is possible): can an agent on `eleven_realtime_v1_max` use a chosen LLM, built-in or custom-LLM (OpenAI-compatible URL with our key), and can it be overridden per conversation? Write the answer with source links in `eleven-llm-check.md`.
- [ ] **Step 2:** If not possible: set `ELEVEN_LLM_SUPPORTED = False`, stop this task, and report to the controller so Gabriel is told. If possible: failing test `test_eleven_overrides_include_llm` (overrides for `eleven_llm="terra"` carry `gpt-5.6-terra` in the field the docs name; unknown key gives Sol), implement for phone (from `route["eleven_llm"]`) and browser (body `llm`, staff only), re-run `eleven_setup.py` only after telling the controller (it changes the live agents), tests PASS.

### Task 3: Let client lines use their engine pick (Mini kept)

**Files:**
- Modify: `src/automations/voice/eleven_api.py:38-40` (`agent_id_for` always Max), `src/automations/voice/voice_engines.py` (`ELEVEN_MODELS` ~:59, `choice_from` ~:139-150), `src/automations/voice/line_purpose.py` (`line_pick` and module docstring)
- Create: `specs/voice-test-panel/eleven-client-parity.md`
- Test: `tests/voice/test_line_engine.py` (update the "mini" fixture at :17)

**Interfaces:**
- Produces: `line_pick(route)` returns the pick for client lines too when `engine` is set; `{"engine", "voice", "model": "max", "llm"}`.

- [ ] **Step 1: Parity check first.** Trace an ElevenLabs phone call end to end against a GPT Live phone call for client duties: client alerts (`client_alerts/`), recap, booking, `Voice_Calls.account_id` attribution, client figures. Write gaps in `eleven-client-parity.md`. Small gaps (a missing call to an existing function): fix in this task with a test each. Large gaps: leave `line_pick` ignoring client lines, set `CLIENT_ELEVEN_ALLOWED = False` in `line_purpose.py`, and report.
- [ ] **Step 2: Failing tests:** `test_client_line_without_engine_is_gpt_live` (route `{"purpose": "client"}` with no engine returns None, no `line_pick_ignored` log), `test_client_line_with_eleven_pick_applies` (only when `CLIENT_ELEVEN_ALLOWED`), `test_mini_maps_to_max` (`agent_id_for("mini") == agent_id_for("max")`).
- [ ] **Step 3: Implement; run** the voice suite: PASS, baseline only.

### Task 4: GPT Live staff browser tests: events, delays, price, is_test

**Files:**
- Modify: `src/automations/voice/event_logger.py` (`CallLogger`), `src/webhooks/live_voice_routes.py` (`/voice/relay` handler and `live_wrap_up` ~:382), `src/webhooks/realtime_voice_routes.py:652` (`mark_test_call` also sets `is_test` for staff tests), `src/automations/voice/call_costs.py`
- Test: `tests/voice/test_call_logger_staff.py`

**Interfaces:**
- Consumes: `call_events.write_event` (signature as in `call_events.py:75`), `call_costs.price_call`, `call_costs.latency`, Task 1's chosen model.
- Produces: relay payload fields read by the engine: tool events `{type: "tool", name, args, result, ms, at}` and turn events may carry `reply_gap_ms: int`. Produces `price_call(..., telephony: bool = True)`; browser calls pass `telephony=False`.

- [ ] **Step 1: Failing tests:** `test_staff_relay_tool_writes_event` (a staff session's tool relay writes one `Voice_Call_Events` row with name, args, status, latency_ms), `test_prospect_relay_writes_nothing_new` (session without `test_account_id`: no event row, no `is_test`, no price), `test_wrap_up_prices_and_latency` (staff session with 3 gaps 400/800/20000 ms and 2 minutes: `latency_ms` = median of 400/800, the 20000 gap dropped, `cost_usd` = 2 min x `LIVE_PER_MIN["gpt-live-1"]` + recap, no telephony), `test_staff_test_sets_is_test`.
- [ ] **Step 2: Run:** FAIL.
- [ ] **Step 3: Implement** in `CallLogger`, gated on the session's `test_account_id` (confirm in the code that the staff path is the only one that sets it; note the finding in a comment).
- [ ] **Step 4: Run** voice suite: PASS, baseline only.

### Task 5: ElevenLabs pricing, per-turn metrics, rates for the browser

**Files:**
- Modify: `src/config.py` (~:119-128: `eleven_plan_usd: float = 22.0`, `eleven_plan_credits: int`, `eleven_plan_usd_per_min: float`, values from ElevenLabs' pricing page for Creator, env `ELEVEN_PLAN_USD`, `ELEVEN_PLAN_CREDITS`, `ELEVEN_PLAN_USD_PER_MIN`), `src/automations/voice/call_costs.py`, `src/automations/voice/eleven_call.py`, `src/automations/voice/eleven_browser_call.py`, `src/automations/voice/eleven_transcript.py`, `src/webhooks/live_voice_routes.py` (`live_options` ~:108) and `src/webhooks/eleven_browser_routes.py` (session response)
- DB: `Voice_Calls.turn_metrics json` (via `add-field.ts`)
- Create: `src/automations/voice/eleven_metrics.py`
- Test: `tests/voice/test_eleven_pricing.py`, `tests/voice/test_eleven_metrics.py`

**Interfaces:**
- Produces: `eleven_price(conv: dict, minutes: float, *, browser: bool) -> dict` returning `{"total": float, "minutes": float, "ai": float, "recap": float, "telephony": float, "estimate": True}`; credits from `metadata.cost` (and `metadata.charging` for the LLM part if present) x `plan_usd / plan_credits`; fallback minutes x `plan_usd_per_min`; `telephony` 0 when `browser`.
- Produces: `turn_metrics(conv: dict) -> list[dict]` with `{"i": int, "role": "user"|"agent", "at_s": float, "delay_ms": int | None, "interrupted": bool}` where `delay_ms` comes from `convai_ttf_audio_since_silence` (seconds x 1000) on agent turns; plus tool rows `{"name", "at_s", "latency_ms"}` from `tool_results[].tool_latency_secs`. No headers, URLs or secrets in the output.
- Produces: `Voice_Calls.cost_breakdown` stored inside `turn_metrics` JSON as `{"turns": [...], "tools": [...], "cost": {...}}`; `latency_ms` / `latency_p90_ms` filled via `call_costs.latency`.
- Produces: rates in `/voice/live/options` and the ElevenLabs session response: `rates: {"gptLivePerMin": float, "elevenPerMin": float}`.

- [ ] **Step 1: Verify** on one real stored ElevenLabs conversation (engine helper, print only field names and numbers) which of `metadata.cost` / `metadata.charging` exist; record findings at the top of `eleven_metrics.py`.
- [ ] **Step 2: Failing tests:** `test_browser_eleven_has_no_telephony`, `test_credits_converted_at_plan_rate` (1000 credits with plan 22 USD / N credits), `test_minutes_fallback_when_no_credits`, `test_turn_metrics_strip_secrets` (fixture with a tool header `X-Webhook-Secret`: serialized output contains no header values), `test_turn_metrics_delay_from_ttf_audio`.
- [ ] **Step 3: Implement**; fetch the conversation once at call end (the existing end path in `eleven_call.py` / `eleven_browser_call.py`), store, fill latency.
- [ ] **Step 4: Run** voice suite: PASS, baseline only. Preflight, check no live call, restart engine.

### Task 6: ElevenLabs browser test on any line, with test-only LLM

**Files:**
- Modify: `src/webhooks/eleven_browser_routes.py` (`runs_on_eleven` ~:67 and its use ~:127; body gains `llm`), CRM `server/routes/voiceElevenTest.ts` (pass `llm` through)
- Test: `tests/voice/test_eleven_browser_routes.py` (existing or new)

**Interfaces:**
- Produces: `POST /voice/eleven/browser-session` accepts any staff account line (agency-authenticated via `X-Internal-Key` as today) regardless of the line's engine; uses the account's ElevenLabs prompt (verify which prompt it reads today and that it is the ElevenLabs one). Body `llm` honored only when `ELEVEN_LLM_SUPPORTED`.

- [ ] **Step 1: Failing test** `test_browser_session_allowed_on_gpt_live_line`; **Step 2** implement; **Step 3** run voice suite: PASS.

### Task 6b: Release a stuck ElevenLabs test slot (known bug in requirements.md)

**Files:**
- Modify: `src/webhooks/eleven_browser_routes.py` (slot held until `CONNECT_DEADLINE_S`), CRM `server/routes/voiceElevenTest.ts` / `voiceElevenTestRelay.ts`, `client/src/features/accounts/components/workspace/voice/useElevenTestCall.ts`
- Test: `tests/voice/test_eleven_browser_routes.py`, `server/routes/voiceElevenTest.test.ts`

**Interfaces:**
- Produces: `POST /voice/eleven/browser-session/{id}/release` (engine, `X-Internal-Key`), proxied by the CRM as `POST /api/accounts/:id/voice/eleven-test/:sessionId/release` (agency only; match the existing route naming). Idempotent: releasing an unknown, already started or already released session returns 200 and changes nothing else. Only a session that never reached `/started` is released.
- `useElevenTestCall` calls it on a connect failure and on Hang up while connecting (fire and forget).

- [ ] **Step 1: Failing tests:** `test_release_frees_slot_for_retry` (mint, release, mint again gives 200 not 429), `test_release_after_started_is_noop`, `test_release_unknown_is_ok`; CRM relay test forwards release with the internal key.
- [ ] **Step 2–4:** FAIL, implement, PASS (voice suite baseline only).

## Part B: CRM server

### Task 7: Line settings, review endpoint, test-call items

**Files:**
- Modify: `server/routes/voice-line.ts` (`lineEngineBodySchema` ~:91-96: `engineModel` dropped from accepted input or `z.literal("max")`, add `liveLlm`, `elevenLlm` as `z.enum(["sol","terra","luna"]).nullable()`; client lines may set `engine`), `server/storage/voiceLineEngine.ts`, `shared/schema.ts` (regenerated by add-field), `server/storage/voiceCalls.ts` (`toItem` ~:131-171 adds `costUsd`, `engine`, `latencyMs`; cost stripped by the existing non-Owner rule)
- Create: `server/routes/voiceCallReview.ts`, `server/storage/voiceCallReview.ts`, `server/storage/voiceCallReview.test.ts`
- Modify: `server/routes/index.ts` (register)

**Interfaces:**
- Produces: `GET /api/voice-calls/:callId/review` (agency only, same access check as `GET /api/voice-calls/:callId`) returning
  ```ts
  type CallReview = {
    callId: string; engine: "gpt-live" | "elevenlabs"; startedAt: string; durationSeconds: number;
    recordingUrl: string | null;            // existing /api/voice-calls/:id/recording
    stereo: boolean;                        // true for GPT Live
    turns: { i: number; role: "user" | "agent"; text: string; atS: number; delayMs: number | null }[];
    tools: { name: string; atS: number; ms: number | null; args: string; result: string }[]; // args/result truncated to 120 chars
    summary: { medianDelayMs: number | null; slowestDelayMs: number | null; toolCount: number };
    cost: { total: number; minutes: number; ai: number; recap: number; telephony: number; estimate: boolean } | null;
  };
  ```
  built in `buildCallReview(call, turns, events, metrics): CallReview` (pure, tested). Offsets are seconds from the recording start; ElevenLabs uses `turn_metrics`, GPT Live uses turn and event timestamps minus `startedAt`.
- Produces: line payload fields `liveLlm`, `elevenLlm`, `elevenLlmSupported` (from an engine options call or a constant mirrored from Task 2's decision).
- Produces: test-call item fields `costUsd: number | null`, `engine`, `latencyMs: number | null`.

- [ ] **Step 1: Failing tests** in `voiceCallReview.test.ts`: `buildCallReview` computes median/slowest from delays (ignores null), truncates args/result to 120 chars, returns `tools: []` and `toolCount: 0` for a call without events, returns `recordingUrl: null` when the call has no recording, never includes keys named like `secret`, `token`, `headers`.
- [ ] **Step 2: Run** `npx tsx --test server/storage/voiceCallReview.test.ts`: FAIL.
- [ ] **Step 3: Implement** storage, route, schema changes.
- [ ] **Step 4: Run:** PASS. Check `pm2 logs leadawaker --lines 30` shows no compile error.

### Task 7b: ElevenLabs agent slots: brain and temperature (requirements.md addendum 23:30)

Supersedes Task 2's "not feasible" for the per-agent case: an agent in custom mode takes an LLM; per call it still cannot.

**Files:**
- Create: `src/automations/voice/eleven_agent_config.py`, `src/webhooks/eleven_agent_routes.py` (register like the other eleven routes), `tests/voice/test_eleven_agent_config.py`
- Modify (CRM): create `server/routes/voiceElevenAgents.ts` (+ `.test.ts`), register in `server/routes/index.ts`

**Interfaces:**
- Slots: `"max"` = `settings.elevenlabs_agent_max` (label "Agent 1"), `"mini"` = `settings.elevenlabs_agent_mini` (label "Agent 2"). Keys stay `max` / `mini` everywhere (Voice_Numbers.engine_model, test `model` field).
- Brains: `"realtime_max"` (`realtime_model: "eleven_realtime_v1_max"`), `"realtime_mini"` (`"eleven_realtime_v1_mini"`), `"custom"` (`realtime_model: null` + `agent.prompt.llm`).
- `ELEVEN_CUSTOM_LLMS` whitelist, verbatim: `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.4-mini`, `gpt-4.1-mini`, `gemini-2.5-flash`, `gemini-3.5-flash`, `claude-haiku-4-5`, `claude-sonnet-4-6`.
- `read_slot(slot) -> dict` returns only `{slot, label, brain, realtimeModel, llm, temperature, reasoningEffort, summary}` where `summary` is the display label, e.g. `"Agent 1: Realtime Max"`, `"Agent 2: gpt-6.1-sol"`.
- `write_slot(slot, brain, llm=None, temperature=None) -> dict` PATCHes `/v1/convai/agents/{id}` with only the whitelisted fields (`conversation_config.realtime_model`, `conversation_config.agent.prompt.llm`, `.temperature`, `.reasoning_effort`); temperature clamped 0..1 and only sent in custom mode; `reasoning_effort: "low"` sent with reasoning models, and on a 400 "Not supported reasoning effort" the PATCH is retried once without it. Returns the fresh `read_slot`.
- Engine routes (internal key): `GET /voice/eleven/agents` -> `{"slots": [read_slot("max"), read_slot("mini")]}`, `PUT /voice/eleven/agents/{slot}` body `{brain, llm?, temperature?}`; 422 on unknown slot/brain/llm.
- CRM routes (agency only, `requireAuth, requireAgency`): `GET /api/voice/eleven-agents`, `PUT /api/voice/eleven-agents/:slot`, proxied with `X-Internal-Key`. Never return or log the ElevenLabs API key or any agent field outside the whitelist.

- [ ] **Step 1: Failing tests** (engine, httpx mocked): `test_read_slot_realtime_summary`, `test_read_slot_custom_summary_shows_llm`, `test_write_custom_sends_only_whitelisted_fields`, `test_write_realtime_drops_temperature`, `test_unknown_llm_rejected`, `test_reasoning_effort_retry_without_on_400`, `test_temperature_clamped`; CRM: relay forwards with the internal key and refuses non-agency.
- [ ] **Step 2–4:** FAIL, implement, PASS (voice suite baseline only). Do not PATCH the live agents from tests or by hand.

## Part C: CRM client

### Task 8: Line settings card: engine and LLM for real calls (Mini kept)

**Files:**
- Modify: `client/src/features/accounts/components/workspace/voice/LineEngineCard.tsx`, `useLineEngine.ts`, `voiceApi.ts` (~:25, :201-210), `lineEngine.ts`, `lineEngine.test.ts`; `client/src/features/demos/components/EngineTestSettings.tsx:33`, `client/src/features/demos/api/demoSettingsApi.ts:66` (remove Mini)
- Create: `client/src/features/accounts/components/workspace/voice/llmOptions.ts`
- Locales: `en/nl/pt` voice namespace

**Interfaces:**
- Produces: `LLM_KEYS = ["sol", "terra", "luna"] as const`, `type LlmKey`, `llmLabel(t, key)`; reused by Task 9.
- Behaviour: card shows "Real calls" engine (`Seg` gpt-live | elevenlabs) and an LLM `Seg` per engine (ElevenLabs LLM hidden when `elevenLlmSupported` is false). On a client line, changing the engine shows an inline confirm row ("Real callers on this line will hear ElevenLabs. Switch?") before saving; disabled with a note when the engine reports client ElevenLabs not allowed (Task 3).

- [ ] **Step 1: Failing test** in `lineEngine.test.ts`: `effectiveLlm(line, "gpt-live")` returns `"sol"` when null and the stored key otherwise; unknown key returns `"sol"`.
- [ ] **Step 2: Run** `npx tsx --test client/src/features/accounts/components/workspace/voice/lineEngine.test.ts`: FAIL. **Step 3** implement. **Step 4** PASS.

### Task 8b: ElevenLabs agents card and slot labels

**Files:**
- Create: `client/src/features/accounts/components/workspace/voice/ElevenAgentsCard.tsx`, `useElevenAgents.ts`, `elevenAgents.ts` (+ `elevenAgents.test.ts`)
- Modify: `PromptSection.tsx` (render the card, agency only), `LineEngineCard.tsx` and the test panel head (Task 9) for slot labels; locales en / nl / pt

**Interfaces:**
- Consumes: Task 7b CRM routes.
- Produces: `slotLabel(slots, key: "max" | "mini"): string` (the slot's `summary`, falling back to "Agent 1" / "Agent 2"), used wherever Max / Mini was shown.
- Behaviour: per slot a brain `Seg` (Realtime Max | Realtime Mini | Custom), an LLM select (Custom only, from the whitelist), a temperature slider 0 to 1 (step 0.05; greyed with a one-line note under Realtime: "ElevenLabs manages this in Realtime mode"), saved on change via PUT (no Save button, like the other cards); a one-line warning: "Changes apply to every test and demo line on this agent." Errors shown inline.

- [ ] **Step 1: Failing test** `elevenAgents.test.ts`: `slotLabel` returns the summary; falls back to "Agent 1"/"Agent 2" when slots are missing; `temperatureEnabled(brain)` true only for custom.
- [ ] **Step 2–4:** FAIL, implement, PASS. **Step 5:** playwright-cli screenshot of the card light and dark.

### Task 9: Test provider, layout and panel head

**Files:**
- Create: `voice/test/VoiceTestProvider.tsx` (context with call state for both engines), `voice/test/VoiceTestPanel.tsx` (state switch: idle/live/review), `voice/test/TestPanelHead.tsx` (engine tab, LLM pick, Test button), `voice/test/testPanelPrefs.ts` (localStorage per browser, try/catch), `voice/test/useWideTestPanel.ts` (`TEST_PANEL_WIDE_PX = 1440`)
- Create: `voice/autosaveRegistry.ts` with `registerFlush(fn): () => void` and `flushAllAutosaves(): Promise<void>`; modify `useAutosave.ts` to register its `flush`
- Modify: `VoiceTab.tsx` (wrap in provider; wide: sticky right column about 400px beside `SectionLayout` content on every section; narrow: panel inside Prompt section where `TestCard` is; a small "call in progress" bar on other sections), `PromptSection.tsx`, `TestCard.tsx` (becomes a thin wrapper or is removed; `ElevenTestPanel.tsx` folded into the new panel)
- Modify: `client/src/features/voiceDemo/useLiveCall.ts`: `start(setup)` accepts optional `staff?: { account?: number; line?: number; llm?: LlmKey }`, used instead of the URL query when given; the URL query path stays for `/voice-demo`.
- Modify: `useElevenTestCall.ts`: `start(opts?: { llm?: LlmKey })`.
- Test: `voice/test/testPanelPrefs.test.ts`, `voice/autosaveRegistry.test.ts`

**Interfaces:**
- Produces: `useVoiceTest(): { engine: "gpt-live" | "elevenlabs"; setEngine; llm: LlmKey; setLlm; phase: "idle" | "connecting" | "live" | "ending" | "review"; start(): Promise<void>; hangup(): void; reviewCallId: string | null; openReview(callId: string): void; newTest(): void; live: LiveView }` where `LiveView = { startedAt: number | null; transcript: {role, text}[]; tools: {name, result, ms}[]; delaysMs: number[]; callId: string | null; rates: {gptLivePerMin: number; elevenPerMin: number} | null }`.
- Behaviour: `start()` awaits `flushAllAutosaves()` first; during a live call a one-line note says edits apply to the next test. Leaving the account (provider unmount) hangs up.

- [ ] **Step 1: Failing tests:** prefs default to the line's saved engine/LLM and survive a throwing `localStorage`; `flushAllAutosaves` awaits every registered flush and ignores unregistered ones.
- [ ] **Step 2: Run** both with `npx tsx --test`: FAIL. **Step 3** implement. **Step 4** PASS.
- [ ] **Step 5:** With playwright-cli, open an account Voice tab at 1500px and 1200px and 390px wide; screenshot: column on the right at 1500, inline at 1200, mobile layout at 390; light and dark.

### Task 10: Live view

**Files:**
- Create: `voice/test/LiveCallView.tsx`, `voice/test/useCallEventsPoll.ts`, `voice/test/liveMetrics.ts`, `voice/test/liveMetrics.test.ts`

**Interfaces:**
- Consumes: `useVoiceTest().live`, `GET /api/voice-calls/:callId` (events).
- Produces: `useCallEventsPoll(callId: string | null, active: boolean, intervalMs = 1500)` returning the events list, stopping when inactive; `runningCost(elapsedMs, perMin): number`; `replyDelay(lastUserFinalAt, firstAgentAudioAt): number | null`.
- Behaviour: status, timer, running cost with ≈ mark, transcript, tools as they happen (name, short result, engine ms; GPT Live from the hook instantly, ElevenLabs from the poll), delay per reply.

- [ ] **Step 1: Failing tests** in `liveMetrics.test.ts`: `runningCost(90_000, 0.09) ≈ 0.135`; `replyDelay` returns null when either time is missing and never negative.
- [ ] **Step 2–4:** FAIL, implement, PASS.

### Task 11: Review view with waveform

**Files:**
- Add dependency: `wavesurfer.js@7` (exact current 7.x version pinned, at least two weeks old), loaded with `import()` inside the review only
- Create: `voice/test/CallReviewView.tsx`, `voice/test/ReviewWaveform.tsx`, `voice/test/ReviewSummary.tsx`, `voice/test/ReviewTranscript.tsx`, `voice/test/useCallReview.ts`, `voice/test/reviewMath.ts`, `voice/test/reviewMath.test.ts`

**Interfaces:**
- Consumes: `CallReview` from Task 7.
- Produces: `markerLeftPct(atS, durationS): number` (clamped 0-100), `formatCost(cost): string` (e.g. `"≈ $0.12"`).
- Behaviour: summary row (duration, cost with breakdown tooltip, median and slowest delay, tool count); waveform (split channels when `stereo`), tool markers, play, speed 1.0x / 1.25x / 1.5x / 2x, skip back/forward 10 s, download, zoom; clicking a marker or transcript line seeks. Missing recording: markers on an empty track with a one-line note. No tools: "No tools ran".

- [ ] **Step 1: Failing tests:** `markerLeftPct(-1, 60) === 0`, `markerLeftPct(90, 60) === 100`, `markerLeftPct(30, 60) === 50`, `markerLeftPct(5, 0) === 0`; `formatCost(cost, unknownLabel)`: `formatCost({ total: 0.1234, estimate: true, ... }, "n/a") === "≈ $0.12"`, `formatCost(null, "n/a") === "n/a"` (the label comes from the locale; never a dash).
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5:** playwright-cli: open the review for an existing ElevenLabs test call and one GPT Live test call from the list; screenshot light and dark; check the entry chunk does not contain wavesurfer (`grep -l wavesurfer dist` after build is not run on the Pi; instead confirm the import is dynamic in code review).

### Task 11b: Transcript polish: speaker colors, per-message delay, tool tags, what she understood (Gabriel 2026-10-24)

**Files:**
- Modify: `voice/test/LiveCallParts.tsx`, `voice/test/LiveCallView.tsx`, `voice/test/ReviewTranscript.tsx`, `voice/test/ReviewWaveform.tsx` (marker look), `voice/test/ReviewSummary.tsx`, `client/src/features/voiceDemo/useLiveCall.ts` (`handleTool` pending row), `voice/test/VoiceTestProvider.tsx` (short hold before review); locales
- Create: `voice/test/toolTags.ts` (+ `toolTags.test.ts`), `voice/test/ToolTag.tsx`, `voice/test/UnderstoodCard.tsx`

**Interfaces:**
- `toolTag(name: string): { key: string; icon: LucideIcon; tone: string }` with known tools `search_stock`, `car_details`, `check_availability`, `book_appointment`, `cancel_appointment`, `request_callback`, `update_call_summary`, `end_call`; unknown names get a neutral tag with the raw name humanized. Labels via i18n `test.tools.<key>`.
- Speaker colors: agent and caller bubbles use different token-based tints (agent: brand/wine tint; caller: neutral surface), same in live and review, readable in dark mode.
- Delay: each agent message ends with its reply delay ("≈ 0.8 s") when known, in live and review; the separate delays list is removed. Live: pair delays to agent turns by order; review: `turns[].delayMs`.
- Tools: shown as `ToolTag` chips inline in the transcript at the point they ran (live: after the agent turn active when the tool fired; review: by `atS` between turns), plus a compact tag row at the top of the live view. A tool appears immediately as pending (spinner) when `handleTool` starts and fills in result and ms when done.
- After `end_call` the panel holds the live view about 2 s before switching to the review so the last tools stay visible.
- `UnderstoodCard`: live, the latest `update_call_summary` args (intent / interest / notes) as "What she understood"; review, the call's recap intents, interest and outcome from the call detail (`intents`, `outcome` already on the call item) as tags.

- [ ] **Step 1: Failing tests** `toolTags.test.ts`: each known tool maps to its key; unknown name gives the neutral tag with a humanized label; `insertToolsByTime(turns, tools)` places a tool between the turns around its `atS` and keeps order stable.
- [ ] **Step 2–4:** FAIL, implement, PASS.

### Task 12: Test calls list

**Files:**
- Modify: `voice/TestCallsList.tsx`, `voiceApi.ts` (`fetchTestCalls` item type gains `costUsd`, `engine`, `latencyMs`)

- [ ] **Step 1:** Add cost column (`formatCost`), engine label; clicking a row calls `useVoiceTest().openReview(callId)` (wide: column shows the review; narrow: panel inline above the list scrolls into view). No dialog.
- [ ] **Step 2:** playwright-cli screenshot of the list with cost visible as Owner.

### Task 13: End-to-end check with Gabriel

- [ ] **Step 1:** Ask Gabriel for one GPT Live and one ElevenLabs test from the panel (a call needs his voice). Then check: tools appeared live; review markers sit where the tool ran in the audio (correct the offset in `buildCallReview` if not, with a test); cost and delays filled; the test is absent from client figures and sent no client alert; a `/voice-demo` call still works.
- [ ] **Step 2:** Report results, including the Task 2 and Task 3 decisions.
