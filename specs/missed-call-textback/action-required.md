# Action Required: Missed-Call Text-Back (Voice service, Tier 1 + Tier 2)

Manual steps that must be completed by a human (Gabriel). Engine/UI work is in the implementation plan.

## Before Implementation

- [ ] **Confirm Twilio voice capability on the client subaccounts** — the per-client subaccounts already
      exist for WhatsApp/SMS; verify Twilio Programmable Voice is enabled and that voice-capable numbers
      can be purchased in the target country (NL). No new vendor (staying on Twilio, not Telnyx).
- [ ] **Decide the abuse/cost guard numbers** — the per-caller cold-template dedup window (e.g. one
      template per caller per account per X hours) and any per-account daily cap. Used in Phase 2's
      guard. (Open decision — pick a default like 12h / 50/day to start.)
- [ ] **Confirm `public_webhook_url` (engine) is reachable by Twilio** — the voice webhooks + the public
      `/webhooks/voice/mc/greeting/{id}.mp3` must be hit by Twilio (already true for the existing
      `/webhooks/sms/*`); verify the greeting GET is not behind auth/Cloudflare access.

## During Implementation

- [ ] **Provision a voice number per client subaccount** and store it in `Accounts.missed_call_number`.
      Done from the Accounts → Integrations panel once Phase 3 lands; until then, buy via Twilio console
      and paste the number. Set the number's Voice "A call comes in" webhook to
      `{public_webhook_url}/webhooks/voice/mc/inbound`.
- [ ] **Create + approve the `missed_call` WhatsApp cold-open template (en + nl)** in the client's
      Twilio/Meta WhatsApp sender. Cold first-touch requires an approved template; approval can take
      time, so start early. **Use the approved-ready bodies, variable mapping, and Utility category in
      `specs/missed-call-textback/templates.md`.** Store each approved Content SID in the matching
      `missed_call` campaign's `twilio_first_message_template_sid`, and set the campaign's `First_Message`
      to the exact approved body.
- [ ] **Set up conditional call forwarding on the client's existing business line** to the provisioned
      Twilio voice number (forward on no-answer / busy / unreachable). This is dialed once from the
      business phone; the Accounts panel shows the exact carrier code. Client keeps their own number.
- [ ] **Record or generate the greeting** (if `greeting_mode = voice`) — record the one-liner in-browser
      or generate via TTS (Fish Audio PT / ElevenLabs NL) from the Accounts panel. ~10s of audio.

## After Implementation

- [ ] **End-to-end live test (use our own Lead Awaker number first — no client needed)** — buy **one**
      Twilio voice number, set conditional call-forward on the HubSpot landline `+31 737044356`
      (forward-on-no-answer) → that Twilio number, point its Voice webhook at
      `{public_webhook_url}/webhooks/voice/mc/inbound`, and map it to a Lead Awaker test account + a
      `missed_call` campaign. Then call `+31 737044356` from a mobile, don't answer, confirm: (1) Twilio
      hits `/inbound`, (2) the text-back fires from the Twilio number using the approved template within
      seconds, (3) the lead drops into the AI conversation on reply, (4) Automation Logs show
      `workflow_name="missed_call"`. (Finn's recorded voicemail line can be the `<Play>` greeting.)
- [ ] **Tier 2 voicemail test** — leave a voicemail, confirm it transcribes, lands as an inbound
      `voicemail` interaction on the lead, the raw recording is deleted, and the AI references the
      voicemail content once the lead replies.
- [ ] **GDPR check** — confirm raw Twilio recordings are deleted after transcription and only the
      transcript is retained (voicemail audio is personal data).

## Deferred (not this build)

- [ ] **Dedicated Voice / Missed-Call service page** + **homepage services panel** — designed later in
      the Claude Design pass.
- [ ] **Tier 3 (real-time AI phone answering)** — separate spec; evaluate OpenAI Realtime/Gemini Live +
      a telephony SIP bridge (Telnyx vs Twilio) and run a Dutch-naturalness prototype before any build.
