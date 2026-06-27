# Action Required: AI Receptionist

Manual steps that must be completed by a human (Gabriel). Engine/UI work is in the implementation plan.
Most provisioning steps are inherited from `specs/missed-call-textback/action-required.md`; this file
adds only what the receptionist reframe introduces.

## Before Implementation

- [ ] **Approve the receptionist prompt direction** - the `system:ai-receptionist` prompt is the heart
      of the service (intent triage, KB grounding, booking, handoff restraint). Review the Phase 2
      structure before it is written to `Prompt_Library`.
- [ ] **Decide the posture default per pilot client** - `receptionist_posture` (secretary / balanced /
      sales). Default is `balanced`; a clinic likely wants `secretary`, a showroom `sales`.
- [ ] **Confirm the owner-notification recipients** - which user(s) get the real-time "missed call" ping
      per account (defaults to the account owner).
- [ ] **Define the AI-initiated handoff triggers** - what makes the receptionist hand off to the owner
      (currently undecided). Recommended defaults: explicit request for a human, complaint/anger,
      anything outside the knowledge base, high-stakes/complex ask. The `receptionist_posture` dial tunes
      eagerness. (Client visibility is DECIDED: receptionist = full chat, reactivation = summaries.)

## During Implementation

- [ ] **Create + approve the WhatsApp cold-open template (en + nl)** in the client's Twilio/Meta sender
      and store each Content SID in the `missed_call` campaign's `twilio_first_message_template_sid`; set
      the campaign's `First_Message` to the exact approved body. (Carried from missed-call-textback; the
      Settings First Message editor in Phase 6 surfaces this field.) Use the bodies in
      `specs/missed-call-textback/templates.md`.
- [ ] **Provision a voice number per client subaccount** and set conditional call forwarding on the
      client's business line (forward on no-answer / busy / unreachable) to it; point its Voice webhook at
      `{public_webhook_url}/webhooks/voice/mc/inbound`. (Carried from missed-call-textback.)
- [ ] **Clone the account voice for the greeting** (if `greeting_mode = voice`) - the TTS greeting reuses
      the account's per-locale `tts_voice_id_*`. Clone one in the Voice section first if missing.

## After Implementation

- [ ] **End-to-end live test** - call the HubSpot landline `+31 737044356` (forward-on-no-answer to the
      test Twilio number), do not answer, and confirm: (1) the text-back fires from the client number via
      the approved template within seconds, (2) the lead appears in the **Conversations page under the AI
      Receptionist service tab**, titled by its phone number (never "Unknown"), upgrading to the WhatsApp
      profile name on reply, (3) the AI behaves as a receptionist (asks intent, answers from KB, offers a
      booking), (4) a **client** session can see the **full interactions** and take over the thread, (5)
      the owner gets the real-time notification, (6) Automation Logs show `workflow_name="missed_call"`.
- [ ] **Receptionist posture spot-check** - set `secretary` vs `sales` on a test campaign and confirm the
      AI hands off earlier vs leans into booking, respectively.
- [ ] **Daily-cap sanity** - confirm an account with active ongoing chats is NOT silenced for new callers
      (the cap now counts new missed-call leads/day, not all outbound messages).
- [ ] **Tier 2 voicemail test** - leave a voicemail, confirm it transcribes, lands as an inbound
      `voicemail` interaction, the raw recording is deleted, and the AI references it on the lead's reply.

## Deferred (not this build)

- [ ] **Fold speed-to-lead web-leads (and web-form / WhatsApp inbound) into the receptionist** - the page
      and the Conversations service tabs are built channel-agnostic; actually routing a second intake
      source (a `speed_to_lead` service tab + its leads) is a later slice. The standalone Speed-to-Lead
      route is retired in this build, but its leads do not yet flow through the receptionist.
- [ ] **Homepage AI Receptionist services panel** - later, in the home-hub pass.
- [ ] **Tier 3 real-time AI phone answering** - separate spec (OpenAI Realtime/Gemini Live + SIP bridge +
      Dutch-naturalness gate).
