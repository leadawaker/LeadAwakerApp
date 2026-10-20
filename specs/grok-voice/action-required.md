# Grok voice: what Gabriel does

**Status 2026-10-19:** steps 1 to 3 are done (key added, +31738519847 registered at xAI as phone_Bl4ScDWVsbPOtVv1, engine restarted). A probe call on Grok worked end to end: TLS without SRTP, recording notice, Dutch greeting and answer, tool calls, end_call, Telnyx recording, Dutch summary, reply gaps 0.6 to 0.9 s, $0.0796 per minute for Grok itself. Gabriel's mobile is on the Engine tests card on Grok (rex, standard prompt, reasoning high).

1. **Create an xAI API key:** console.x.ai > API keys. Add it to `/home/gabriel/automations/.env` as `XAI_API_KEY=...`.
2. **Register the demo line with xAI.** This needs no Telnyx change. Run:
   ```
   cd /home/gabriel/automations
   .venv/bin/python scripts/xai_register_number.py --number +31738519847 --name "Lead Awaker 073"
   ```
   It writes the webhook secret, the SIP login and the number into `.env`. It prints none of them.
3. **Restart the engine:** `./preflight.sh && pm2 restart leadawaker-engine --update-env`
4. **Add yourself as a tester:** CRM > Demos > Settings > Voice > **Engine tests**.
   - Add your mobile, choose Grok, a voice, the prompt and reasoning, then Save.
   - The card says "Grok is set up for +31738519847" once steps 1 to 3 are done.
5. **Call `+31738519847` from that mobile.**
   - Grok answers as Frank. Everyone else still gets GPT-Live.
   - To compare, flip the card to GPT-Live and Save. The change applies within 30 seconds.
   - Both engines' calls are on the Voice Calls page, with recordings.

Bookings are real (Robben's Cal.diy) and transfers ring your mobile, as on GPT-Live tests. Cancel test bookings afterwards.

If Grok never picks up, look in `pm2 logs leadawaker-engine` for:
- `voice.bridge.dial_ai_failed`
- the AI leg's `voice.bridge.leg_ended` cause

Then try `XAI_SIP_MEDIA_ENCRYPTION=SRTP` in `.env` and restart.
