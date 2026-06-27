# Missed-Call Text-Back (Voice service, Tier 1 + Tier 2) — Requirements

> The **first build of the Voice service** (the 3rd Hulk service after Reputation and Speed-to-Lead).
> Strategy rationale lives in `docs/strategy/strategy.md` (future service catalog) and
> `docs/strategy/speed-to-lead.md`. This spec is **engine + Accounts-integrations UI only**; a
> dedicated Voice service page and a homepage panel are explicitly deferred (see Out of scope).

## Context & goal

A business misses a phone call. Within seconds the caller receives a WhatsApp message from that same
business number ("Sorry we missed your call, how can we help?") and drops straight into our existing
two-way AI conversation. The lead is never lost to a missed call, and no staff time is spent. This is a
staple GHL feature ("missed-call text-back") and the entry point of a tiered Voice service:

- **Tier 1 (this spec, primary):** missed call → instant WhatsApp text-back → AI conversation.
- **Tier 2 (this spec, included — not a separate paid tier):** the caller can leave a voicemail; it is
  transcribed and injected into the AI conversation context so the AI already knows *why* they called.
- **Tier 3 (future, separate spec):** real-time AI answers and holds a live phone conversation. Needs a
  real-time voice model + telephony SIP bridge; gated behind a Dutch-naturalness prototype. NOT here.

The **North Star** for this service: **missed calls recovered** — a missed call that turns into a
two-way conversation (caller replied after the text-back), and downstream, a booking. The pitch is one
line: *"your phone number never loses a lead again."*

## Why this is mostly glue (read before assuming gaps)

Almost everything already exists. Verified against the tree this session:

- **Per-client Twilio identity + subaccount** — `Accounts.twilio_account_sid` / `twilio_auth_token` /
  `twilio_messaging_service_sid` / `twilio_default_from_number` (schema.ts:44-47). The client's
  WhatsApp text-back is sent **from the client's own number**, the same value prop as speed-to-lead.
- **Inline first-touch dispatch** — `src/automations/speed_to_lead.py:fire_first_touch()` already
  renders the cold-template opener and sends it via `send_message`, claims the lead against the poll
  (double-send guard), drops the lead into `inbound_handler` → `run_ai_conversation()` on reply. The
  missed-call route reuses this **unchanged**.
- **Cold-template opener** — `Campaigns.twilio_first_message_template_sid` (schema.ts:498) +
  `send_message(... whatsapp_template_sid=, whatsapp_template_variables=)`. Cold WhatsApp first-touch
  uses the approved template, then free-text once the lead replies (24h window opens).
- **`campaign_type` decoupling** — `Campaigns.campaign_type` (schema.ts:405, default `reactivation`),
  added by Reputation, extended by Speed-to-Lead. We add one more value: `missed_call`.
- **Lead intake primitives** — `tools/db/lead_intake.py` (`check_duplicate_phone`, `insert_intake_lead`,
  `validate_campaign_ownership`); the missed-call route reuses these to create the lead from the
  caller's number.
- **Twilio voice webhooks (pattern precedent)** — `server/routes/twilio-voice.ts` already does inbound
  TwiML, signature validation, a recording-ready webhook, and Groq Whisper transcription + summary for
  outbound prospect calls. Tier 2 ports that recording/transcription pattern into the Python engine.
- **Account-level voice assets** — `Accounts.voice_file_data` / `voice_file_name` / `tts_voice_id_*`
  (schema.ts:65-69) already store recorded/TTS audio; the greeting reuses this pattern.

## The genuine gap

1. **No inbound voice webhook in the engine.** Twilio has nowhere to send a missed call. We need a
   voice webhook that (a) answers, optionally plays a greeting, optionally records a voicemail, and
   hangs up, and (b) on call completion fires the text-back.
2. **No number→account map for voice.** Inbound WhatsApp is matched by `AccountSid`; an inbound *call*
   is matched by the dialed number (`To`). We need `Accounts.missed_call_number` + a lookup.
3. **Missed-call campaign type.** `fire_first_touch` is gated to `speed_to_lead` via
   `maybe_dispatch`. The missed-call route schedules `fire_first_touch` **directly** (it already knows
   the campaign is `missed_call`), so `speed_to_lead.maybe_dispatch` is untouched.
4. **Greeting management UI.** A record-or-TTS greeting, stored per account, served back to Twilio as a
   public `<Play>` URL. New, but reuses the existing account voice-asset pattern.
5. **Tier 2 voicemail → AI context.** `<Record>` TwiML, a recording webhook, Groq transcription, and
   injecting the transcript into the lead's conversation history so the AI references it.

## Provisioning model (decided)

- **The client keeps their number.** They set **conditional call forwarding** ("forward on no
  answer / busy / unreachable") from their existing business line to a Twilio number we provision in
  their subaccount. They never change their published number, and they never touch the Twilio console.
- **We manage provisioning from the Accounts → Integrations panel**, not the Twilio console: buy/assign
  the voice number, set its voice webhook, and show the client the exact forwarding code to dial
  (e.g. carrier conditional-call-forward MMI codes) with a copy button.

## In scope

- **Engine voice webhooks** (`src/webhooks/twilio_voice_mc_routes.py`):
  - `POST /webhooks/voice/mc/inbound` — the single Tier-1 entry point. Maps `To`→account, finds/creates
    the lead from `From`, **schedules the inline text-back (`fire_first_touch`)**, and returns TwiML
    that plays the account greeting (or stays silent) and, for Tier 2, `<Record>`s a voicemail before
    hanging up. (No separate `/status` webhook — every forwarded call is already a missed call.)
  - `POST /webhooks/voice/mc/recording` (Tier 2) — receive the voicemail recording, transcribe via Groq
    Whisper, store it as an inbound voicemail interaction on the lead so the AI sees it.
  - `GET /webhooks/voice/mc/greeting/{account_id}.mp3` — public (no-auth) endpoint serving the stored
    greeting audio so Twilio `<Play>` can fetch it.
- **Schema:** add the missed-call fields to `Accounts` (see Data model changes).
- **Number→account lookup** (`get_account_by_voice_number(to_number)`).
- **Find-or-create lead from a phone number** on the mapped account (reuse dedup + intake primitives).
- **A dedicated `campaign_type = 'missed_call'` campaign** per account (its own opener + persona).
- **Accounts → Integrations panel section:** enable toggle, voice-number display + forwarding
  instructions (copy button), greeting mode (voice / silent), greeting source (record in-browser /
  generate via TTS), Tier-2 voicemail toggle, and the missed-call campaign selector.
- **Greeting capture UI:** in-browser MediaRecorder record button **or** type-text-then-TTS (Fish Audio
  for PT, ElevenLabs for NL), stored on the account.

## Out of scope

- **Dedicated Voice / Missed-Call service page** (ops view: missed calls received, text-backs sent,
  reply/conversion rate across accounts) — designed separately later in the Claude Design pass.
- **Homepage services panel** (today's recoveries + conversion card) — later.
- **Tier 3 real-time AI phone answering** — separate spec; needs OpenAI Realtime/Gemini Live + a
  telephony SIP bridge and a Dutch-naturalness prototype gate.
- **Changes to `ai_conversation.py`, `bump_scheduler.py`, `campaign_launcher.py`** beyond reading the
  voicemail interaction that already lives in conversation history (no engine-flow changes).
- **Telnyx migration** — stay on Twilio; Twilio's WhatsApp BSP path is the moat and per-call cost is
  negligible at this scale. Telnyx is a Tier-3-only evaluation.

## Functional requirements

1. **Missed-call detection (by design, not by call status).** The client's carrier forwards to the
   Twilio number **only on no-answer / busy / unreachable**, so *every* call that reaches
   `/webhooks/voice/mc/inbound` is already a missed call. There is no "did a human answer?" check to do
   on Twilio's side — a business-answered call never reaches us. The text-back therefore fires directly
   on `/inbound` (no separate status webhook needed).
2. **Sub-minute text-back.** The first WhatsApp is dispatched **inline as a background task** on the
   `/inbound` webhook, reusing `fire_first_touch` — not on the ~60s launcher poll.
3. **Cold-template opener.** The opener uses the missed-call campaign's approved WhatsApp template
   (`twilio_first_message_template_sid`) for the lead's locale; free-text only after the lead replies.
4. **Sent from the client's own number.** The text-back is sent from the account's own Twilio identity
   (`twilio_default_from_number` / messaging service), never ours — the caller must see the business
   they just called reply.
5. **Find-or-create lead.** The caller's `From` (E.164) is deduped against the account
   (`check_duplicate_phone`). Existing lead → reuse it (no second lead, append to its conversation).
   New → `insert_intake_lead(... source="missed_call", campaign_id=<missed_call campaign>)`.
6. **No double-send.** Reuse `claim_lead_for_first_send` inside `fire_first_touch` so a burst of
   webhooks (Twilio retries, repeat calls) cannot double-message. A repeat missed call from a lead
   already in an open conversation must not re-fire the cold template.
7. **Number→account routing.** `To` (the dialed Twilio number) maps to exactly one account via
   `Accounts.missed_call_number`. No match → 200 + no-op (never crash the webhook).
8. **Greeting behavior (account-configurable).** `missed_call_greeting_mode`:
   - `voice` → `<Play>` the stored greeting MP3 then hang up (Tier 1) or `<Record>` (Tier 2).
   - `silent` → answer and hang up with no audio (or let it ring out), still fire the text-back.
9. **Tier 2 voicemail.** When `missed_call_voicemail_enabled`, the inbound TwiML appends `<Record>`
   (with `recordingStatusCallback=/webhooks/voice/mc/recording`). The recording is transcribed (Groq
   Whisper, mirroring `twilio-voice.ts`) and written as an **inbound voicemail interaction** on the
   lead so `run_ai_conversation()` sees it in history and can reference *why they called*. The voicemail
   transcript is **never injected into the cold template** (Meta forbids free-text cold opens).
10. **Conversation handoff.** After the opener, the lead's replies flow through the **existing**
    `inbound_handler.py` → `run_ai_conversation()` unchanged.
11. **Logging.** Every step logs to `Automation_Logs` with `workflow_name = "missed_call"`, scoped by
    account/campaign/lead, surfacing in the Automation Logs page with no UI change.
12. **Account control.** The flow runs only when `missed_call_enabled` is true, a `missed_call_number`
    is mapped, and a `missed_call` campaign with an approved cold-open template is configured.

## Non-functional requirements

- **No regression.** `ai_conversation.py`, `bump_scheduler.py`, `campaign_launcher.py`, and
  `speed_to_lead.maybe_dispatch` are not modified. The missed-call route calls `fire_first_touch`
  directly.
- **Webhook safety.** All voice webhooks validate the Twilio signature against the per-subaccount Auth
  Token (reuse the `_validate_twilio_request` pattern from `twilio_routes.py`), return 200 fast, and
  never crash on a lookup miss.
- **Abuse / cost guard.** Each fired text-back is a paid template send. A repeat caller is **already
  covered** by the existing claim guard (FR-6): once the opener fires the lead flips `queued → active`
  and `claim_lead_for_first_send` no-ops every further attempt, so **no per-caller dedup window is
  needed**. The only genuine risk is a spam-dial **flood from many different numbers** (each a new lead
  + new paid template), which burns cost and tanks the client's Meta quality rating. Guard with a
  single per-account **daily cap** that is a generous circuit-breaker, not a product rule (default high,
  e.g. 100/account/day; tune later). With no clients yet it is effectively dormant.
- **WhatsApp 24h / template policy.** Cold first-touch outside an open 24h session **must** use an
  approved template; never free-text cold.
- **Timestamps server-side.** Set `first_message_sent_at` / status via `NOW()` / `new Date()` —
  Drizzle-Zod `z.date()` rejects client ISO strings silently.
- **i18n:** opener content via Prompt_Library / approved templates, **en + nl only** (pt-BR dropped from
  campaigns). Greeting audio is per-account; TTS uses the account's locale voice id. Accounts-panel
  copy goes through i18n (`accounts` / `settings` namespaces). No hardcoded strings.
- **Pi-friendly:** transcription stays on the remote Groq endpoint; greeting MP3s are small and served
  from the DB blob, no heavy local compute.
- **GDPR:** voicemail audio + transcript are personal data. Transcribe via the existing approved
  provider, store the transcript, and do not retain raw audio longer than needed (delete the Twilio
  recording / temp file after transcription, mirroring `twilio-voice.ts`).

## Data model changes (summary; details in implementation plan)

New columns on **`Accounts`** (`shared/schema.ts`):

- `missed_call_enabled` (boolean, default false) — master switch.
- `missed_call_number` (varchar) — the Twilio voice number that receives forwarded calls (the
  number→account routing key for inbound calls).
- `missed_call_campaign_id` (integer) — FK-ish to the `missed_call` campaign that fires the opener.
- `missed_call_greeting_mode` (text, default `silent`) — `voice` | `silent`.
- `missed_call_greeting_audio_data` (text, base64 MP3) + `missed_call_greeting_file_name` (varchar) —
  the stored greeting (recorded or TTS-generated). Reuses the `voice_file_data` blob pattern.
- `missed_call_voicemail_enabled` (boolean, default false) — Tier 2 record-a-voicemail switch.

No new tables. `Campaigns.campaign_type` gains the value `missed_call` (no schema change — it is a free
text column). Voicemail transcripts are stored as **Interactions** (`type = "voicemail"`,
`direction = "inbound"`), not a new column.

## Acceptance criteria

- A forwarded missed call to an account's `missed_call_number` creates/reuses the lead from the
  caller's number and **fires the WhatsApp opener inline** (Automation Logs `missed_call`), via the
  account's **own** Twilio number, using the **approved template**, within seconds.
- A call the business **answers** does not fire a text-back.
- A duplicate/repeat caller does not create a second lead or re-send the cold template inside the dedup
  window (claim guard + per-caller window verified).
- Greeting `voice` plays the stored MP3; `silent` answers and hangs up; both still fire the text-back.
- With Tier 2 enabled, a left voicemail is transcribed and appears as an **inbound voicemail
  interaction** on the lead, and the AI references it once the lead replies.
- After the lead replies, the conversation is handled by `run_ai_conversation()` exactly as a normal
  inbound (qualification/booking unchanged).
- Reactivation, Reputation, and Speed-to-Lead campaigns behave identically to before.
- The Accounts → Integrations panel can enable the service, show the forwarding code, set the greeting
  (record or TTS), toggle voicemail, and pick the missed-call campaign — without visiting Twilio.
- All steps appear in Automation Logs filtered by `workflow_name = "missed_call"`.

## Related features / dependencies

- **Speed-to-Lead** (`specs/speed-to-lead/`) — reuses `fire_first_touch`, the cold-template path, and
  the claim guard verbatim.
- **Channel-fallback** (`specs/channel-fallback/`) — SMS/email fallback policy is inherited; a
  no-WhatsApp caller can be reached by SMS via the same `resolve_channel` policy.
- **Messaging provisioning** (`specs/messaging-provisioning/`) — the per-client Twilio subaccount +
  number provisioning this service extends to a voice number.
- **Twilio voice precedent** — `server/routes/twilio-voice.ts` (inbound TwiML, signature validation,
  Groq transcription) is the pattern for Tier 2.
