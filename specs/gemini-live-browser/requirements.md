# Requirements: Gemini Live on the browser voice test page

## What and why

Gabriel wants to hear Google's `gemini-3.8-live` doing Sara's job next to OpenAI's GPT-Live (`gpt-live-1`) and decide which one he prefers. The comparison happens on the staff browser test page `/voice-demo` (also reached through the Voice tab "Try her out" card). Phone calls stay on GPT-Live for now. Gemini has no SIP entry, so a phone version would need the engine to carry all the call audio. That is out of scope.

The Gemini call must match the GPT-Live call in everything except the model. It uses the same persona, voice-layer prompt, client setup slots, knowledge base, greeting, booking tool, CRM lead and transcript rows, summary, wrap-up and test-account tagging. That way the comparison is fair.

## Decisions (from Gabriel, 2026-10-12)

| Topic | Decision |
|---|---|
| Where | Browser test page only. An engine switch sits in the call settings. |
| Parity | Full parity with the GPT-Live browser call. |
| Voice | A picker with the 30 Gemini voices, grouped female/male, and a play button with a pre-generated sample per voice. |
| Sample language | Each voice has samples in EN, NL and PT-BR. The play button uses the locale chosen on the page. |
| Recording | The browser records both sides (caller left, Sara right), uploads the file to the engine, and the Voice Calls page plays it like a GPT-Live recording. |
| Engine tag | New `Voice_Calls.engine` column (`gpt-live` / `gemini-live`), shown as a small badge on the Voice Calls page. |

## Acceptance criteria

1. On `/voice-demo` (app host, idle state), the settings show an **Engine** choice: GPT-Live (default) or Gemini Live. The choice is remembered per browser.
2. With Gemini Live selected, the voice dropdown lists the Gemini voices, grouped female/male. Each voice has a play button that plays that voice saying the greeting in the selected locale's language.
3. Starting a Gemini call:
   - Sara greets first, in the selected locale, with the same greeting text the GPT-Live call would use. That includes a client's own word-for-word greeting and the AI disclosure where it applies.
   - Her persona, company, knowledge and client setup slots match what GPT-Live gets for the same `?account=` / `?line=` / `?token=` / locale.
   - The agent name follows the chosen voice's gender, the same way it does on GPT-Live.
4. During the call:
   - Live transcript bubbles appear for both sides, and the CRM panel fills in: lead, turns, summary and booking.
   - Interrupting her stops her audio at once.
5. Booking works: asking for an appointment calls `book_appointment` through `/voice/relay`. The booked slot shows in the CRM panel, and she confirms it out loud.
6. `end_call` hangs up after her goodbye has finished playing. The time limit, the silence hangup and the hang-up button behave as they do on GPT-Live. Gemini calls are capped at 10 minutes, the length of one Live connection.
7. After the call:
   - Wrap-up runs: the summary appears and the Voice_Calls row is closed out.
   - The row has `engine = 'gemini-live'` and `session_id` starting with `gem_`. Test calls made with `?account=` carry `test_account_id`.
8. On the Voice Calls page, Gemini calls show a "Gemini" badge, both in the list and in the call header. The recording plays.
9. GPT-Live calls behave exactly as before. Their rows get `engine = 'gpt-live'`.
10. No Google API key ever reaches the browser. The browser only gets a single-use ephemeral token, and the token locks the model, prompt, tools and voice.
11. All new user-facing strings exist in `en`, `nl` and `pt` locale files.

## Out of scope

- Phone calls (Telnyx) on Gemini.
- The public website demo (`?token=` from the landing page) offering Gemini. The engine accepts it, but the switch only appears on the app host.
- Caller memory and the after-call WhatsApp follow-up. The GPT-Live browser call does not have them either; they are phone-only.
- Session resumption past 10 minutes.
- Changing any Prompt_Library voice-layer rows.

## Related

- Current GPT-Live browser call: `client/src/features/voiceDemo/useLiveCall.ts`, engine `src/webhooks/live_voice_routes.py`, `src/automations/voice/live_session_config.py`.
- Existing Gemini code (WhatsApp memo replies): `/home/gabriel/automations/tools/gemini_live_service.py`. The model is set in `src/config.py` as `gemini_live_native_model = "gemini-3.8-live"`.
- Memory: voice setup slots and the test door (`/voice-demo?account=`), and Voice calls Live/Demo split (test calls excluded from Demo).
