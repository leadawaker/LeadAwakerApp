# Implementation Plan: Missed-Call Text-Back (Voice service, Tier 1 + Tier 2)

## Overview

Add a missed-call → instant WhatsApp text-back flow, reusing the speed-to-lead inline first-touch
engine. A forwarded call hits a new Twilio voice webhook in the Python automation engine; on no human
pickup we map the dialed number to an account, find/create the lead from the caller's number, and fire
`fire_first_touch` directly (cold WhatsApp template from the client's own number → existing AI
conversation). Tier 2 adds an optional voicemail `<Record>`, Groq transcription, and stores the
transcript as an inbound interaction the AI reads. Configuration lives entirely in the Accounts →
Integrations panel (no Twilio console for the client). A dedicated service page + homepage panel are
deferred.

**Architecture decisions (do not deviate):**
- **Reuse `fire_first_touch`, never fork it.** The missed-call status webhook resolves the campaign and
  schedules `speed_to_lead.fire_first_touch(lead_id, campaign, account, exec_id)` directly. Do **not**
  modify `speed_to_lead.maybe_dispatch` (it stays gated to `campaign_type == 'speed_to_lead'`).
- **`campaign_type = 'missed_call'`** is the routing key; it is a free-text column, no schema migration
  for the value itself.
- **Number→account routing** is by the dialed `To` number (`Accounts.missed_call_number`), because an
  inbound call has no `AccountSid`-to-CRM mapping the way an inbound WhatsApp message does.
- **Voicemail transcript is an Interaction**, never injected into the cold template (Meta forbids
  free-text cold opens).
- **Engine work is Python** (`/home/gabriel/automations/`); schema + Accounts UI are in `LeadAwakerApp`.

## Phase 1: Schema + lookups (foundation)

Add the per-account missed-call fields and the number→account lookup.

### Tasks
- [ ] Add missed-call columns to `Accounts` in `shared/schema.ts` (after the existing `voice_file_*`
      block, ~line 69).
- [ ] Create the columns in Postgres via a direct `pg` SQL script (db:push has no TTY on the Pi).
- [ ] Add `get_account_by_voice_number(to_number)` to `tools/db/accounts.py`.
- [ ] Add `missed_call_number` (and the new fields) to whatever account select the lookups use so the
      voice webhook gets the greeting mode, campaign id, and Twilio creds in one row.

### Technical Details

**`shared/schema.ts` — new `Accounts` columns** (mirror existing `text`/`varchar`/`boolean` style):
```ts
  missedCallEnabled: boolean("missed_call_enabled").default(false),
  missedCallNumber: varchar("missed_call_number"),          // Twilio voice number (routing key)
  missedCallCampaignId: integer("missed_call_campaign_id"), // the missed_call campaign that fires
  missedCallGreetingMode: text("missed_call_greeting_mode").default("silent"), // 'voice' | 'silent'
  missedCallGreetingAudioData: text("missed_call_greeting_audio_data"),        // base64 mp3
  missedCallGreetingFileName: varchar("missed_call_greeting_file_name"),
  missedCallVoicemailEnabled: boolean("missed_call_voicemail_enabled").default(false),
```

**DB migration script** (Pi has no TTY for `npm run db:push` — see memory `drizzle-push-needs-tty`):
create a one-off `node --env-file=.env` script using `pg`:
```sql
ALTER TABLE p2mxx34fvbf3ll6."Accounts"
  ADD COLUMN IF NOT EXISTS missed_call_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_call_number varchar,
  ADD COLUMN IF NOT EXISTS missed_call_campaign_id integer,
  ADD COLUMN IF NOT EXISTS missed_call_greeting_mode text DEFAULT 'silent',
  ADD COLUMN IF NOT EXISTS missed_call_greeting_audio_data text,
  ADD COLUMN IF NOT EXISTS missed_call_greeting_file_name varchar,
  ADD COLUMN IF NOT EXISTS missed_call_voicemail_enabled boolean DEFAULT false;
```
(Schema is the NocoDB project schema `p2mxx34fvbf3ll6`; confirm the prefix from existing tables.)

**`tools/db/accounts.py`** — new lookup, mirroring `get_account_by_twilio_sid` (line 30). Normalize
both sides to E.164 (strip spaces) before comparing; the column stores the provisioned Twilio number:
```python
async def get_account_by_voice_number(to_number: str) -> dict | None:
    """Map an inbound call's dialed number (To) to the owning account.
    Returns the account row incl. missed_call_* config + twilio_* creds, or None."""
```

## Phase 2: Engine voice webhook — Tier 1 (the core build)

A single inbound TwiML webhook that fires the text-back. No voicemail yet.

**Design simplification (vs an earlier two-webhook sketch):** the carrier forwards to Twilio **only on
no-answer/busy**, so every call reaching `/inbound` is already a missed call. We fire the text-back
directly on `/inbound` and need **no `/status` webhook** and no "human answered?" detection.

### Tasks
- [ ] Create `src/webhooks/twilio_voice_mc_routes.py` with an `APIRouter(prefix="/webhooks/voice/mc")`.
- [ ] Implement `POST /inbound` — validate signature, map `To`→account, find/create lead from `From`,
      schedule `fire_first_touch`, return TwiML (greeting or silent, then hangup). [complex]
- [ ] Implement `GET /greeting/{account_id}.mp3` — public, no-auth, serve the stored greeting blob.
- [ ] Reuse `_validate_twilio_request` (signature validation by per-subaccount Auth Token) imported from
      `twilio_routes.py`.
- [ ] Mount the router in `src/main.py` (`app.include_router(...)` alongside the other webhook routers).
- [ ] Add a per-account **daily cap** circuit-breaker before firing (default high, e.g. 100/day). No
      per-caller window — the claim guard in `fire_first_touch` already covers repeat callers.

### Technical Details

**Find-or-create lead** — reuse `tools/db/lead_intake.py`:
```python
phone = _normalize_phone(from_number)            # caller's number → E.164
existing = await check_duplicate_phone(phone, account_id)
if existing:
    lead_id = existing["id"]                      # reuse; do NOT create a 2nd lead
else:
    lead_id = await insert_intake_lead(
        account_id, phone=phone, campaign_id=account["missed_call_campaign_id"],
        first_name=None, last_name=None, source="missed_call",
    )
```

**Fire the text-back** — schedule `fire_first_touch` directly (do not touch `maybe_dispatch`):
```python
from src.automations.speed_to_lead import fire_first_touch
from tools.db.campaigns import get_campaign_with_account
campaign = await get_campaign_with_account(account["missed_call_campaign_id"])
# Only fire for an existing lead that's NOT already in an open conversation (claim guard handles the rest)
background_tasks.add_task(fire_first_touch, lead_id, campaign, account, exec_id)
```
`fire_first_touch` already: claims the lead (`claim_lead_for_first_send`), renders via
`_render_first_message`, sends the cold template from the account's own Twilio creds (joined onto the
campaign row by `get_campaign_with_account`), marks the lead active, logs each step. **No new send
code.** Note: `fire_first_touch` only proceeds for a `queued` lead — confirm a freshly
`insert_intake_lead`'d lead is `queued` (it is, when `campaign_id` is set) and that a reused existing
lead in an open conversation is left alone (claim returns falsy → no-op).

**No-pickup guard** in `/status`: fire only when `CallStatus` ∈ {`no-answer`, `busy`, `failed`} or a
`completed` call whose `DialCallStatus`/duration indicates voicemail-only (no human leg answered). A
human-answered call must be a no-op. Twilio posts `CallStatus`, `CallDuration`, `From`, `To`, `CallSid`.

**Inbound TwiML** (greeting mode from the account row):
```python
# voice greeting + Tier 1 (no voicemail):
twiml = (
  '<?xml version="1.0" encoding="UTF-8"?><Response>'
  f'<Play>{public_base}/webhooks/voice/mc/greeting/{account_id}.mp3</Play>'
  '<Hangup/></Response>'
)
# silent:  '<Response><Hangup/></Response>'  (or <Pause length="20"/> to let it ring out)
```
Set `statusCallback="{public_base}/webhooks/voice/mc/status"` and
`statusCallbackEvent="completed"` on the call (via the number's Voice config, or a `<Dial>`/`<Number>`
with the callback when forwarding to a human leg). The status webhook is where the text-back fires.

**Greeting endpoint** — public so Twilio can fetch it (no signature on `<Play>` GETs):
```python
@router.get("/greeting/{account_id}.mp3")
async def greeting(account_id: int):
    acct = await get_account(account_id)
    data = base64.b64decode(acct["missed_call_greeting_audio_data"])
    return Response(content=data, media_type="audio/mpeg")
```

**Signature validation** — import/reuse `_validate_twilio_request` from `src/webhooks/twilio_routes.py`
(it already picks the per-subaccount Auth Token by `AccountSid`, falls back to master). Voice webhooks
carry `AccountSid` for the subaccount that owns the number.

**Logging** — `workflow_name="missed_call"`, steps: `match_account`, `find_or_create_lead`,
`dispatch_scheduled` (then `fire_first_touch`'s own `claim`/`render`/`send_template`/`mark_active`).

**main.py** — add near the other webhook routers (line ~70):
```python
from src.webhooks.twilio_voice_mc_routes import router as voice_mc_router
app.include_router(voice_mc_router)
```

## Phase 3: Accounts → Integrations panel (provisioning UI) — DONE (2026-06-25)

Configure the whole service without the Twilio console.

### Tasks
- [x] Add a "Missed-Call Text-Back" section to the Accounts Integrations panel. [complex]
      → `client/src/features/accounts/components/workspace/MissedCallCard.tsx`, mounted in
      `IntegrationsPanel.tsx` after `EmailSenderCard` (agency view only, `!readOnly`).
  - [x] Master enable toggle (`missed_call_enabled`) — shadcn `Switch`.
  - [x] Voice-number display + carrier conditional-forwarding instructions with a copy button
        (`forwardCode` `**61*<num>#`, computed server-side).
  - [x] Greeting mode radio: `silent` | `voice`.
  - [x] Greeting source (when `voice`): in-browser `MediaRecorder` record **and** file upload **and**
        type-text → "Generate" from the account's cloned voice.
  - [x] Tier-2 voicemail toggle (`missed_call_voicemail_enabled`).
  - [x] Missed-call campaign selector (campaigns where `campaign_type == 'missed_call'`).
- [x] Express routes: `server/routes/missedCall.ts` (registered in `routes/index.ts`).
      `GET …/missed-call/status`, `POST …/missed-call` (config), greeting upload / TTS / delete,
      and an auth-gated `GET …/missed-call/greeting.mp3` preview.
- [x] i18n: `missedCall.*` block added to `accounts.json` for en/nl/pt. No hardcoded strings.

### Design decisions taken during build (deviations to note)
- **Greeting must be MP3** — Twilio `<Play>` rejects Opus, but browser recordings (webm/opus) and
  Fish Audio TTS (ogg/opus) are both Opus. Added a **single engine transcoder**
  `POST /api/voice/transcode-mp3` (ffmpeg `pipe:0→pipe:1`, mono 22.05 kHz) that every greeting source
  funnels through before storage. Express proxies to it (mirrors `clone-voice`/`test-voice`).
- **TTS greeting uses the account's existing cloned voice** (engine `/api/voice/synthesize` → transcode),
  not a separate Fish/ElevenLabs call — so it inherits the per-locale `tts_voice_id_*` already set up
  in the Voice section. Requires a cloned voice for that locale (clear error if missing).
- **Auth-gated preview endpoint** (`…/greeting.mp3`) for the admin UI; the engine's public
  `/webhooks/voice/mc/greeting/{id}.mp3` stays Twilio-only. UI fetches the preview as a blob so it
  works cross-origin (Vercel → Pi).

### Technical Details

- **Find the integrations panel:** the Accounts page panels live under
  `client/src/` (KnowledgeBasePanel.tsx is the precedent for an account-scoped panel; check
  `FILE_MAP.md` for the integrations/Twilio panel location). Match its ListCard/SectionCard primitives
  and dark-mode tokens per `UI_STANDARDS.md`.
- **In-browser recording:** `navigator.mediaDevices.getUserMedia({audio:true})` + `MediaRecorder`,
  collect chunks → `Blob` → base64 → POST to the greeting-upload endpoint. Show a record/stop/preview
  control; one line is ~10s of audio.
- **TTS generate:** POST `{ text, locale }` → server renders via the existing TTS provider for that
  locale (Fish Audio PT / ElevenLabs NL; PT campaigns dropped → expect en/nl in practice), stores the
  mp3 as `missed_call_greeting_audio_data`, returns a preview URL
  (`/webhooks/voice/mc/greeting/{id}.mp3`).
- **Forwarding instructions:** show the provisioned `missed_call_number` and the carrier MMI code
  pattern (e.g. `**61*<number>#` conditional-on-no-answer for many EU carriers) with a copy button and
  a short "dial this from the business phone once" note. Keep it data-driven/copyable, not hardcoded
  per carrier.
- **Campaign selector:** filter the account's campaigns to `campaign_type === 'missed_call'`; link to
  create one if none exist.

## Phase 4: Tier 2 — voicemail transcription → AI context

Optional voicemail that the AI reads.

### Tasks
- [ ] When `missed_call_voicemail_enabled`, append `<Record>` to the inbound TwiML with
      `recordingStatusCallback=/webhooks/voice/mc/recording`.
- [ ] Implement `POST /webhooks/voice/mc/recording` — download the recording, transcribe via OpenAI
      Whisper (the paid key, not Groq), store as an inbound voicemail interaction, delete the raw audio. [complex]
- [ ] Ensure the voicemail interaction lands in the lead's conversation history that
      `run_ai_conversation()` already reads (verify the history query includes it).
- [ ] Order of operations: the text-back may fire on `/status` before the transcript lands; ensure the
      transcript is attached to the same lead so the AI sees it on the lead's **reply**, not the opener.

### Technical Details

- **TwiML `<Record>`** (after/instead of a plain hangup):
  ```xml
  <Record maxLength="60" playBeep="true" trim="trim-silence"
          recordingStatusCallback="{public_base}/webhooks/voice/mc/recording"
          recordingStatusCallbackEvent="completed"/>
  <Hangup/>
  ```
- **Transcription** — download `${RecordingUrl}.mp3` with Basic auth (the subaccount's
  `twilio_account_sid:twilio_auth_token` from the account row, **not** the master env creds), then
  transcribe via `transcribe_audio(audio_bytes, filename)` in `tools/ai_service.py`. **Groq Whisper
  first, OpenAI on failure** (cost: Groq's free tier is rate-limited, so we only pay OpenAI for the
  misses). Both go through the engine's existing `AsyncOpenAI` clients (`_get_groq_client()` /
  `_get_client()`); the Groq attempt uses `max_retries=1` so a hard 429 falls back fast instead of
  backing off. Models: Groq `settings.groq_whisper_model` (`whisper-large-v3-turbo`), OpenAI fallback
  `settings.openai_whisper_model` (`whisper-1`). Mono call → single channel, no ffmpeg split needed.
- **Store as interaction** — `create_interaction(accounts_id, campaigns_id, leads_id, who="Caller",
  type="voicemail", direction="inbound", content=transcript, twilio_message_sid=CallSid,
  triggered_by="missed_call")`. This puts it in history; `run_ai_conversation()` reads recent
  interactions, so the AI naturally references *why they called*. **Never** put the transcript in the
  cold template.
- **GDPR** — after transcription, delete the Twilio recording (Twilio REST delete) and any temp file;
  retain only the transcript. Mirror the temp-file cleanup in `twilio-voice.ts`.
- **Webhook safety** — signature-validate, 200 fast, transcribe in a BackgroundTask.

## Phase 5: Missed-call campaign content + wiring — DONE (2026-06-25)

The actual opener template + persona for the `missed_call` campaign type.

### Tasks
- [x] Document/define the `missed_call` opener template (en + nl) and get it approved in Meta/Twilio
      (the cold-open WhatsApp template). → `specs/missed-call-textback/templates.md` (approved-ready
      bodies, variable mapping, Utility category, approval checklist). Meta submission itself is the
      manual step in action-required.md.
- [x] Ensure a `missed_call` campaign created in the UI carries `twilio_first_message_template_sid`,
      persona/agent fields, and channel policy, exactly like a speed-to-lead campaign.
      → Confirmed: `campaign_type` is a free-text discriminator on the shared `Campaigns` table; a
      `missed_call` campaign reuses the identical columns (`First_Message`,
      `twilio_first_message_template_sid`, persona/agent, channel-fallback). No new columns or UI fields.
      `fire_first_touch` renders `First_Message` and sends with `twilio_first_message_template_sid` +
      `{"1": first_name or "there"}` (verified in `speed_to_lead.py`).
- [x] Confirm the campaign-create/edit UI exposes `campaign_type = 'missed_call'`.
      → Added `missed_call` to the campaign-type `EditSelect` in
      `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx` + `campaignTypes`
      label in `campaigns.json` (en/nl/pt).

### Technical Details

- Opener copy (en/nl, via Prompt_Library / approved template), e.g.
  EN: *"Hi {{1}}, sorry we missed your call! How can we help?"*
  NL: *"Hoi {{1}}, sorry dat we je oproep misten! Waarmee kunnen we je helpen?"*
- The template var `{{1}}` = `first_name or "there"` (matches `fire_first_touch`'s
  `whatsapp_template_variables={"1": ...}`). For a brand-new caller there is no name → falls back to a
  neutral greeting; keep the template valid with an empty/neutral `{{1}}`.
- Reuse the existing campaign persona/agent + channel-fallback fields; no new campaign columns.
