# Grok voice: picking it up again

Parked 2026-10-19. Gabriel prefers GPT-Live for now: Grok sounded more robotic in xAI's own builder, and it costs more (see Cost below). Read `requirements.md` and `action-required.md` in this folder first.

## Where things stand

- **Built, uncommitted** (automations + CRM). See the memory note `project_grok_voice_engine_2026_10_19.md` for the file list.
- **xAI set up:** `XAI_API_KEY` is in the engine's `.env`. +31738519847 is registered at xAI as `phone_Bl4ScDWVsbPOtVv1`. The webhook secret and SIP login are in `.env`.
- **Nobody is routed to Grok.** The Engine tests list (`Demo_Settings.voice.engineTests`) is empty and `XAI_VOICE_LINES` is unset. Every caller, Thijs's included, gets GPT-Live.
- **A probe call on Grok worked end to end** (2026-10-19 08:32):
  - TLS without SRTP;
  - Dutch greeting and answer, with replies after 0.6 to 0.9 s;
  - the update-lead tool and end_call;
  - the Telnyx recording and the Dutch summary.

## What went wrong in Gabriel's test, and what to fix

1. **His call came from +31737044356, not his mobile +31684446349.** The card matched only the mobile, so he got GPT-Live, which is correct behaviour but not what he expected. Fix ideas:
   - show the card's numbers next to "calls from this number only";
   - show the last caller number seen on the line, so he can add it with one click.
2. **"The demo page didn't really hook things up."** Ask Gabriel exactly what he saw. He mentioned Grok still answering in xAI's own interface: that's xAI's web builder (its own agent), which our card does not control.
3. **Switch placement.** Gabriel looked for the switch on the account Voice tab. Options:
   - keep the per-tester card on the Demos page;
   - add an "Engine" picker on the account Voice tab for a whole line. This would affect real callers, so put it behind a confirm and the Owner role.
4. **Small leftovers:**
   - `voice.xai.hangup` is logged twice per call;
   - `voice.xai.socket_closed` is logged as a warning on a normal close (xAI sends no close frame);
   - Frank added "Ik geef het even door" after a plain goodbye on Grok. Test it before touching the prompt.

## Cost (checked on xAI's pages 2026-10-19)

- **Grok** (grok-voice-3.0): $0.08/min, no backend model.
  - It launched at $0.05/min in Dec 2025, and xAI raised it to $0.08/min in July 2026 with Voice 2.0.
  - There's no cheaper Grok voice model.
  - Extras: $0.004 per text `conversation.item.create` (tool results are free), plus an unexplained `pstnMinutePrice` of $0.01/min in xAI's pricing data.
- **GPT-Live:** $0.05/min plus about $0.011 for the backend model.
- **All in, with Telnyx and the summary:** about $0.07/min for GPT-Live and $0.09/min for Grok.
- Measured on the probe call: $0.0796/min for Grok itself.

## How to test without a human

- Put the probe's caller id (+31738519847) on `engineTests` inside the same command, then run `.venv/bin/python -m scripts.voice_probe --voice "Azure.nl-NL-FennaNeural:nl-NL" --say "15:..." --duration 50`. The probe uses demo booking mode, so no real bookings are made.
- Afterwards, delete the probe's lead together with its Interactions, Automation_Logs, Call_Followup_Log and Voice_Calls rows.

## To remove Grok entirely instead

1. Run `.venv/bin/python scripts/xai_register_number.py --delete +31738519847`.
2. Remove the `XAI_*` lines from `.env`.
3. Restart the engine.
