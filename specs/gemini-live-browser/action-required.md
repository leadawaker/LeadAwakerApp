# Action Required: Gemini Live on the browser voice test page

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **Nothing to set up.** `GEMINI_API_KEY` is already in the engine `.env`. On 2026-10-12 it minted ephemeral tokens for `gemini-3.8-live` without trouble.
- [ ] **Optional: check the Gemini rate limits** at aistudio.google.com/rate-limit for the `lead-awaker` project. Google publishes no limit on concurrent Live sessions; the page shows them per project.

## After Implementation
- [ ] **Engine restart.** It does not hot-reload. Run `cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env`.
- [ ] **Listen to the samples** on `/voice-demo` (Gemini engine, play button) and pick your favourite voice per language.
- [ ] **A/B calls.** Make the same scripted call on both engines, for example a booking plus one question the knowledge base can answer, in EN, NL and PT. Compare them on the Voice Calls page using the badge and the recordings. One call per engine is not enough to judge: make several.
- [ ] **Watch the Gemini spend** in Google AI Studio after the first test calls. The estimate is about $0.023 per minute of conversation.
