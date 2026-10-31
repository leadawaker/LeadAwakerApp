# Gemini Live as a parallel engine in the Robben browser test

Date: 2026-10-31. Status: draft, waiting for Gabriel's approval.

## Intent and why

Gabriel wants to hear Google's `gemini-3.8-live` do the Robben receptionist job in Dutch, side by side with GPT Live, before deciding whether it is worth more investment. His reasons: Gemini is roughly half the price, Dutch might sound better, and it may be more reliable with tools and prompt following. His first impression in AI Studio was "not amazing", so this is an experiment: the goal is to hear it on our real prompt and tools, fast and cheaply, not to build a production engine.

## Goals

1. In the Robben Rosmalen (experiment) account (account 59, campaign 74), Voice tab → Prompt & test, the engine switch offers **Gemini Live** next to GPT Live.
2. A Gemini test call runs in the browser, in Dutch, with the same persona and knowledge as the GPT Live test on that account.
3. Gemini has exactly two tools:
   - **Cars:** the existing `search_stock` and `car_details`, answered from the account's `stock_cars` data.
   - **Calendar:** the existing demo `book_appointment` (preferred_day, preferred_time, name) against the demo diary the browser test already uses. Gabriel chose the demo diary on 2026-10-31.
4. The Dutch voice layer is a new Prompt_Library row, cloned from row 134 (`voice_lean_layer_nl`) and rewritten for Gemini following Google's Live API prompting guidance.

## Non-goals

- Phone calls, Telnyx media streaming and the Raspberry Pi bridge.
- Any other account, any other language, the public website demo, the `/voice-demo` page.
- The real Cal.diy calendar (`check_availability` and real `book_appointment`).
- Caller memory, the backend model delegation (row 141), WhatsApp follow-ups, recordings, an engine badge on the Voice Calls page, session resumption past one connection.
- Changing row 134 or any other existing prompt row.

## Anti-goals (a failure even if it works)

- GPT Live behaves any differently, on any account or line.
- The Google API key reaches the browser.
- The Gemini option shows up on any account other than 59.
- Thijs (real client, account 53) is notified or affected in any way.

## Constraints

- Two repos: CRM in `LeadAwakerApp` (TS, pm2 `leadawaker`), engine in `/home/gabriel/automations` (Python FastAPI, pm2 `leadawaker-engine`, no hot reload: `./preflight.sh && pm2 restart leadawaker-engine --update-env`).
- `GEMINI_API_KEY` already exists in both `.env` files. `automations/src/config.py:288-314` already sets `gemini_live_native_model = "gemini-3.8-live"`. Use that config, don't hardcode the model.
- Browser connects to Gemini directly using a short-lived **ephemeral token** minted by the engine (Gemini `authTokens` / Live API ephemeral tokens), with the model, system prompt, tools and voice locked into the token's constraints where the API allows it.
- One Gemini Live connection lasts about 10 minutes: cap the test call at the connection limit and end it cleanly.
- Gemini Live audio: input 16-bit PCM 16 kHz, output PCM 24 kHz. No language code: Dutch is set by the prompt.
- Avoid the `-extended-thinking` variant (reported to skip tool calls).
- Both LeadAwakerApp working trees currently hold other sessions' uncommitted work on `feat/gpt-live-phone-demos`. Work on its own branch/worktree and commit only this feature's files.
- Files under 500 lines where reasonable.

## Decided by Gabriel

- Browser (WebRTC test mode) only, Robben experiment account only, Dutch only.
- Only the cars tools and the calendar tool.
- Demo calendar, not the real one.
- A cloned and Gemini-adapted copy of the Dutch GPT Live prompt.

## How it fits the existing code (from recon)

- UI: `client/src/features/accounts/components/workspace/voice/test/VoiceTestProvider.tsx`; engine tab type in `testPanelPrefs.ts` (`"gpt-live" | "elevenlabs"`, forced to gpt-live without ElevenLabs at line ~176). `start()` at ~231 saves edits, then calls `useLiveCall().start(...)`.
- GPT Live browser hook: `client/src/features/voiceDemo/useLiveCall.ts` (WebRTC to OpenAI via engine `/voice/live/session`, tool calls forwarded to `/voice/relay` at ~642, outputs returned at ~665).
- Engine session: `automations/src/webhooks/live_voice_routes.py:182` (staff pass check ~225, `get_account_line`), prompt assembly `src/automations/voice/live_session_config.py` (`build_live_session_config` ~288, `resolve_persona_prompt` ~245).
- Tools: `voice/car_search.py:22`, `voice/car_details.py:32`, added by `browser_stock.py:27` only when the KB has a stock list; demo booking `booking_tool.py:210`, answered in `event_logger.py` (~133 demo diary, ~385 tool dispatch) behind `realtime_voice_routes.py:701` (`/voice/relay`).
- Prompt loader: `voice_prompt_store.py:89` (30 s cache, case-insensitive status).
- Existing single-turn Gemini code for WhatsApp voice notes: `automations/tools/gemini_live_service.py` (reuse its client setup where it fits).
- Older, never-built, larger Gemini spec: `LeadAwakerApp/specs/gemini-live-browser/` (requirements, implementation-plan, and a Dutch AI Studio prompt `ai-studio/ai_studio_sara_nl.txt`). Borrow from it freely, but this design's scope wins.

## What the builder decides (my calls, Gabriel can override)

- **Gating:** show Gemini in the engine switch only when the workspace account is 59. Hardcoded id or a small setup flag (like the existing `setup.voice.*` experiment flags) is the builder's choice; the engine must also refuse Gemini sessions for other accounts.
- **Engine endpoint:** a new route next to `/voice/live/session` (for example `/voice/gemini/session`) that checks the staff pass, builds the same persona/knowledge as GPT Live, swaps in the Gemini voice layer, attaches the three tool declarations translated to Gemini function declarations, and returns the ephemeral token plus the greeting.
- **Browser side:** a separate hook (for example `useGeminiLiveCall.ts`) rather than branching inside `useLiveCall.ts`, exposing the same shape the test panel already consumes (status, transcript, start/stop) so the panel stays mostly unchanged. Tool calls go to the existing `/voice/relay`, so the cars and demo booking answers are identical to GPT Live.
- **Voice picker (Gabriel asked for it, 2026-10-31):** when Gemini Live is selected, a voice dropdown lists the Gemini Live voices with a play button each. My calls: group them female/male; the preview is a short pre-generated Dutch sample per voice (the Robben greeting), generated once by a script and served as static files, so previewing costs nothing and plays instantly. The chosen voice is remembered per browser and sent to the session route, which locks it into the token. Default: a female voice the builder picks.
- **Greeting:** Gemini speaks first with the same greeting text the GPT Live test uses for this account.
- **Interruptions:** on Gemini `interrupted`, stop and flush local playback at once.
- **Transcripts:** show both sides in the existing transcript panel using Gemini's input/output transcription. Writing Voice_Calls rows is nice to have, only if the existing relay logging gives it for free; otherwise skip and note it.
- **Prompt row:** new `Prompt_Library` row, use_case `voice_lean_layer_nl_gemini`, status active, same structure as row 134 but adapted per Google's Live API prompt guidance (clear persona first, conversational rules, explicit "always respond in Dutch", tool usage instructions tied to the two tools, no OpenAI-specific delegation wording). Present the adapted text to Gabriel before inserting it.
- **One prompt instead of two models:** GPT Live sends the voice layer as `instructions` and hands knowledge, slots and booking rules to a backend model through `delegation.responses` (`live_session_config.py:1331-1356`). Gemini has no backend model, so its system instruction is the Gemini voice layer **plus** the knowledge, slots and booking rules that GPT Live would send to the backend (rewritten into the same Dutch Gemini-friendly style, without the delegation wording). That keeps the comparison fair: same content, one model.
- **Account 59 extras:** text extras that GPT Live adds (intake items, client rules, booking slots, `with_detail_rules`) carry over into the prompt. The buying-checklist tool and any other tool are skipped: Gabriel wants only the cars tools and the calendar.
- **Relay logging and alerts:** reuse `/voice/relay` exactly as the GPT Live browser test on account 59 already does today (lead creation, Interactions, `_tag_test_call`). This adds no new path to Thijs, because account 59 is the experiment account and the browser test already runs there. The builder verifies that no account 59 alert is routed to Thijs before the first test call, and labels Gemini sessions (for example `session_id` prefix `gem_`, and engine/model in whatever metadata the logger already stores) so they don't get counted as GPT Live staff calls.
- **Prompt in the browser:** acceptable (staff-only test tool). Lock prompt, tools and voice into the ephemeral token if `gemini-3.8-live` supports it; if not, the browser receives the session config from the engine route and sends it in its setup message. No server-side audio proxy.
- **Gemini Live details (from the DataCamp tutorial Gabriel shared, plus Google docs):**
  - Tool declarations use `behavior: "BLOCKING"` so she waits for the stock or booking answer instead of talking over it (the default is NON_BLOCKING). Replies go back as a `toolResponse` with `functionResponses: [{id, name, response: {result}}]`.
  - Tool calls run without blocking the receive loop (the relay fetch is already async), so audio and interruptions keep flowing while a tool runs.
  - On `serverContent.interrupted`, flush the playback queue at once.
  - Microphone with `echoCancellation`, `noiseSuppression` and `autoGainControl` on, otherwise speaker echo causes false interruptions.
  - Enable both `inputAudioTranscription` and `outputAudioTranscription` for the transcript panel.
  - The tutorial covers none of ephemeral tokens, voices or the browser side: the builder follows Google's Live API docs for those (JS `@google/genai` SDK or raw WebSocket, builder's choice).
  - Free-tier Gemini traffic is used by Google for training. The builder checks that the `GEMINI_API_KEY` project has billing on (paid tier) and tells Gabriel if it doesn't.
- **Tests:** engine unit tests for the session route (gating, tools list, prompt row choice) and a manual Dutch test call by Gabriel as the acceptance test.

## Acceptance

1. Account 59, Voice tab → Prompt & test: engine switch shows Gemini Live. Other accounts don't.
2. Start a Gemini call: she greets first in Dutch with the Robben greeting and speaks Dutch throughout.
3. "Hebben jullie een Golf onder de 20.000?" triggers `search_stock` and she answers from real stock data; asking about one car triggers `car_details`.
4. Asking for an afspraak triggers the demo `book_appointment` and she confirms the slot out loud.
5. Interrupting her stops her voice at once. Hang up works. The call ends cleanly at the connection limit.
6. A GPT Live test on account 59 and on any other account behaves exactly as before.
7. The browser network log shows only an ephemeral token, never the API key.
