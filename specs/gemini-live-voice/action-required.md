# Action Required: Gemini Live Voice

Manual steps that must be completed by a human.

## Before Implementation
- [x] **Gemini API billing enabled** — done 2026-07-03 (€10 credit); Live API needs paid-tier quota, free tier throttles fast
- [ ] **Confirm Live model availability on your key** — open https://aistudio.google.com → Stream/Live tab, confirm which native-audio and half-cascade Live models your project can use (model IDs in the plan are last-known and must be verified at build time)

## During Implementation
- [ ] **Send a real WhatsApp voice memo to the demo campaign** during Phase 3 verification — the end-to-end check needs a genuine inbound memo (tester phone → demo number), Claude cannot produce one

## After Implementation
- [ ] **Listen and judge** — A/B `live_native` vs `live_half` on the demo campaign with your own ears (dropdown switch, no code) and pick the default you actually prefer
- [ ] **Watch spend for the first week** — Live audio is billed per audio-second both directions; check Google AI Studio usage after a few real conversations
