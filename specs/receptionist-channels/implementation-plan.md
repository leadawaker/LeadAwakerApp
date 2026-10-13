# Implementation Plan: Receptionist Channels

## Overview

Make the receptionist one assistant across phone, WhatsApp and website chat for any client:
- per-client WhatsApp on Meta's Cloud API, with templates managed from the CRM;
- Telnyx SMS fallback;
- an after-call WhatsApp follow-up;
- shared phone/WhatsApp memory;
- website chat contact capture;
- immediate handoff for reception campaigns.

Robben (account 53) is the first client. Read `requirements.md` first, plus `/home/gabriel/automations/CLAUDE.md` before any engine work.

Repos:
- CRM: `/home/gabriel/LeadAwakerApp`. Express routes live in `server/routes/`, storage in `server/storage/`, the schema in `shared/schema.ts`.
- Engine: `/home/gabriel/automations`. Python, pm2 `leadawaker-engine` on :8100.

Engine changes need `./preflight.sh && pm2 restart leadawaker-engine --update-env`, and only with Gabriel's OK, because a restart drops live calls. Never run `tsc` unless Gabriel asks. Every user-facing CRM string goes through i18n (en, nl, pt; Brazilian PT).

Phases 2, 3, 6 and 7 can be built in parallel once Phase 1 is done. Phase 4 needs Phase 2. Phase 5 needs Phases 2, 3 and 4. Phase 8 comes last.

## Phase 1: Data model and credential storage

Goal: tables and columns for per-client WhatsApp senders, templates and follow-ups, and encrypted secrets readable by both Node and Python.

### Tasks
- [x] 1.1 Engine migration `automations/scripts/migrate_receptionist_channels.py` creating the `WhatsApp_Senders`, `WhatsApp_Templates` and `Call_Followup_Log` tables and the new `Voice_Calls` and `Accounts` columns (schemas below). Idempotent (`IF NOT EXISTS`). Run with the engine venv.
- [x] 1.2 Mirror the new tables and columns in `shared/schema.ts` (Drizzle), with a comment that the engine owns the migration. Add insert/select Zod types.
- [x] 1.3 AES-256-GCM secret box, one wire format, two implementations:
  - [x] 1.3a `automations/tools/secret_box.py` (`cryptography` 46 is installed): `seal(plain) -> str`, `open_(sealed) -> str`.
  - [x] 1.3b `server/lib/secretBox.ts` (`node:crypto`): `seal`, `open`.
  - [x] 1.3c Cross-check script `automations/scripts/check_secret_box.py`: seals a string in Python and decrypts it via `node -e` (and the reverse).

### Technical Details

Schema `p2mxx34fvbf3ll6`. psql: `export $(grep -E '^DATABASE_URL' .env | xargs)` in LeadAwakerApp, then `psql "$DATABASE_URL"` with `set search_path=p2mxx34fvbf3ll6`.

```sql
CREATE TABLE IF NOT EXISTS "WhatsApp_Senders" (
  id serial PRIMARY KEY,
  accounts_id integer NOT NULL UNIQUE REFERENCES "Accounts"(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL UNIQUE,
  display_phone_number text,            -- "+31 73 888 7883", from Graph API
  verified_name text,                   -- from Graph API
  name_status text,                     -- APPROVED | PENDING_REVIEW | DECLINED ...
  quality_rating text,                  -- GREEN | YELLOW | RED | UNKNOWN
  app_id text NOT NULL,
  app_secret_enc text NOT NULL,         -- secret_box sealed
  access_token_enc text NOT NULL,       -- system-user permanent token, sealed
  status text NOT NULL DEFAULT 'pending', -- pending | connected | error | disabled
  last_error text,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "WhatsApp_Templates" (
  id serial PRIMARY KEY,
  accounts_id integer NOT NULL REFERENCES "Accounts"(id) ON DELETE CASCADE,
  name text NOT NULL,                   -- catalog key, e.g. reception_call_booked
  language text NOT NULL,               -- nl | en | pt_BR
  category text,                        -- as returned by Meta (UTILITY expected)
  status text NOT NULL DEFAULT 'not_submitted', -- not_submitted | PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  meta_template_id text,
  rejected_reason text,
  catalog_version integer NOT NULL,     -- catalog entry version that was submitted
  submitted_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (accounts_id, name, language)
);

CREATE TABLE IF NOT EXISTS "Call_Followup_Log" (
  id serial PRIMARY KEY,
  voice_call_id integer NOT NULL UNIQUE,   -- idempotency: one decision per call
  accounts_id integer NOT NULL,
  leads_id integer,
  decision text NOT NULL,   -- sent | skipped
  reason text,              -- e.g. not_mobile, screened, dedup_24h, disabled
  kind text,                -- booked | followup
  channel text,             -- whatsapp_template | whatsapp_text | sms
  provider_message_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_followup_lead_idx ON "Call_Followup_Log"(leads_id, created_at);

ALTER TABLE "Voice_Calls" ADD COLUMN IF NOT EXISTS screened_kind text;   -- sales_pitch | robocall | abuse
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS sms_sender_id text;      -- alphanumeric, max 11, e.g. 'Robben'
ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS after_call_followup_enabled boolean DEFAULT false;
```

Secret box format: `v1:` + base64(iv(12) | tag(16) | ciphertext). Key: 32 bytes, base64, env `CHANNEL_SECRETS_KEY`, identical in `LeadAwakerApp/.env` and `automations/.env`. Generate with `openssl rand -base64 32`.

Python: `from cryptography.hazmat.primitives.ciphers.aead import AESGCM`. Note that `AESGCM.encrypt` returns ciphertext||tag; reorder to iv|tag|ct so it matches Node's `cipher.getAuthTag()`.

Never log or return plaintext secrets. CRM API responses expose only `hasToken: true`.

## Phase 2: Engine, multi-tenant WhatsApp Cloud API

Goal: messages to a client's number route to that client's account; sends go out from the client's number with the client's token; the 24-hour window is respected.

### Tasks
- [x] 2.1 `automations/tools/db/whatsapp_senders.py`:
  - `get_sender_by_phone_number_id(pnid)` and `get_sender_by_account(account_id)`. Both return a dict with the decrypted `access_token` and `app_secret` and are cached 60 s.
  - `list_app_secrets()` for signature checks.
  - `update_sender_status(...)`.
- [x] 2.2 `automations/tools/whatsapp_cloud.py`: every send function (`send_template_message`, `send_text_message`, `send_button_message`, `send_audio_message`, `send_typing_indicator`, `download_media`) takes optional `phone_number_id` and `access_token`. With neither, they behave exactly as today (global `settings.whatsapp_*`).
  - `send_template_message` also takes `components` (body parameters and an optional URL button suffix) and returns `{ok, message_id, error_code, error_message}`.
- [x] 2.3 `src/webhooks/whatsapp_cloud_routes.py` inbound POST [complex]
  - [x] Signature: accept when `verify_signature` passes with the global `settings.whatsapp_app_secret` OR any secret from `list_app_secrets()`; reject with 403 otherwise. Keep today's "not enforced" warning only while no secret exists anywhere.
  - [x] `parse_inbound_webhook` / `parse_status_updates`: carry `metadata.phone_number_id` and `entry.id` (WABA) on each parsed item.
  - [x] `_process_whatsapp_cloud_inbound` (line ~347, `account_id = 1`): if `phone_number_id` belongs to a `WhatsApp_Senders` row, use that row's `accounts_id` and take the new **client path**. Otherwise keep the existing Lead Awaker path unchanged (VIP commands, demo tokens, prospects, account 1).
  - [x] Client path:
    - Look up the lead by phone **within the account**.
    - Unknown sender: create a lead in `Accounts.inbound_campaign_id`, using the same fields as `inbound_handler.py:97-156` (source `inbound_whatsapp`, profile name as first_name, `automation_status='active'`). Drop and log if there is no inbound campaign.
    - Known lead with `Campaigns_id` NULL (created by a phone call): attach it to `inbound_campaign_id`.
    - Stamp `last_message_received_at`, then run `process_inbound` like the Twilio inbound path does.
- [x] 2.4 Account-scope the lead lookups:
  - `tools/db/leads.py:62 get_lead_by_phone(phone)` gains an optional `account_id`. Callers that know the account (`inbound_handler.py:204` via `resolved_inbound_account_id`, and the new client path) pass it.
  - Keep the unscoped behaviour only where no account is known, and log `leads.lookup_unscoped` there.
- [x] 2.5 `tools/send_service.py` Cloud branch (`~478-511`) [complex]
  - [x] Resolve credentials: when the lead's account has a connected `WhatsApp_Senders` row, send with its `phone_number_id` and token. Otherwise keep the current global NL/BR choice.
  - [x] 24-hour window for the client path: `in_session = last_message_received_at > now - 24h`. Use the same lookup as the Twilio branch (`tools/db/leads.get_last_message_received_at`).
  - [x] Outside the window: the caller must pass `template={name, params}`. Without one, return `{success: False, error: "session_expired_no_template"}` and log it; never send free text.
  - [x] Template sends resolve the language from the lead/campaign language. If that language is not approved for the account, fall back to `en`; if nothing is approved, skip and log.
- [x] 2.6 Template linkage for business-initiated senders on the client path: `bump_scheduler.py`, `booking_reminder.py` (T-24h/T-1h), `no_show_recovery.py`, `reschedule_reengage.py`, `buying_signal_followup.py`.
  - Each passes a catalog template when the window is closed: reminders use `reception_appointment_reminder`; the others have no catalog entry in v1, so they skip and log `template_missing`.
  - Bumps stay off on reception campaigns (max_bumps 0).
- [x] 2.7 Status updates (`_process_status_updates`, line ~299):
  - Map failed statuses whose error code means "not a WhatsApp user / undeliverable" to the fallback in Phase 3: codes `131026` (message undeliverable), `131047` (re-engagement, outside window), `131051` (unsupported message type, skip). Use only 131026 for fallback; log the others.
  - Record `delivered`, `read` and `failed` on Interactions by provider message id, as the Twilio status route does.
- [x] 2.8 Template status webhook: handle the `message_template_status_update` field (`entry.changes[].field`) and update `WhatsApp_Templates.status` / `rejected_reason` by `meta_template_id`. Subscribe the field on each client app in the onboarding checklist.

### Technical Details

- Graph API version: `v21.0` (what `tools/whatsapp_cloud.py` and the 2026-10-10 template submission use). Base `https://graph.facebook.com/v21.0`.
- Send: `POST /{phone_number_id}/messages` with `Authorization: Bearer <token>`.
- Template message body:

  ```json
  {"messaging_product":"whatsapp","to":"<E164 digits>","type":"template",
   "template":{"name":"reception_call_booked","language":{"code":"nl"},
     "components":[{"type":"body","parameters":[{"type":"text","text":"Mark"},{"type":"text","text":"Robben Rosmalen"},{"type":"text","text":"donderdag 16 oktober om 14:30"}]}]}}
  ```
- Webhook payload: `entry[].id` = WABA id; `entry[].changes[].value.metadata.phone_number_id` = receiving number.
- Every client app subscribes its webhook to the same callback `https://webhooks.leadawaker.com/webhooks/whatsapp` (route prefix as mounted today; check `src/main.py`), with fields `messages` and `message_template_status_update`. Verify token: `WHATSAPP_VERIFY_TOKEN`, shared across apps.
- `inbound_handler.py:97-156` is the reference for creating unknown senders on Twilio. Reuse its helpers rather than copying them.
- Existing columns `Accounts.whatsapp_sender_status`, `whatsapp_display_name` and `whatsapp_quality_rating` belong to the Twilio sender. Leave them alone; the new path reads `WhatsApp_Senders`.

## Phase 3: Telnyx SMS fallback

Goal: one SMS from the account's alphanumeric sender when WhatsApp cannot deliver.

### Tasks
- [x] 3.1 `automations/tools/telnyx_messaging.py`: `send_sms(to, text, sender_id, messaging_profile_id=None) -> {ok, message_id, error}`.
  - Sanitise the sender: `[A-Za-z0-9 ]`, 1-11 characters, at least one letter.
  - Text: strip WhatsApp formatting (reuse `sms_text_from_whatsapp()` from `channel_fallback.py`), cap at 612 chars (4 segments).
- [x] 3.2 Telnyx status webhook route `POST /webhooks/telnyx/messaging` in a new `src/webhooks/telnyx_messaging_routes.py`, registered in `src/main.py`. It verifies the Telnyx ed25519 signature (`telnyx-signature-ed25519`, `telnyx-timestamp`, public key env `TELNYX_PUBLIC_KEY`) and updates the Interaction status by message id.
- [x] 3.3 `tools/channel_fallback.py`: a new entry `fallback_to_telnyx_sms(lead, interaction_id, text)`, called from Phase 2.7 on 131026 and from Phase 5.
  - Appends the reach-us line, built from `Accounts.phone` or the KB phone: EN "Questions or changes? Call {phone}." / NL "Vragen of iets wijzigen? Bel {phone}." / PT "Dúvidas ou mudanças? Ligue {phone}." The template's closing "reply to this message" sentence is cut first (2026-10-12).
  - Sets `Leads.resolved_channel='sms'` and logs `channel_fallback` like the Twilio path.
  - Only once per send (claim on the interaction id).
- [x] 3.4 Config in `src/config.py`: `telnyx_messaging_profile_id`, `telnyx_public_key`, and kill switch `telnyx_sms_enabled` (default false).

### Technical Details

- Send: `POST https://api.telnyx.com/v2/messages` with `Authorization: Bearer $TELNYX_API_KEY` and body `{"from":"Robben","to":"+316...","text":"...","messaging_profile_id":"<id>"}`.
- Alphanumeric senders need a messaging profile with alphanumeric sender enabled; set the profile's webhook URL to `https://webhooks.leadawaker.com/webhooks/telnyx/messaging`.
- Telnyx NL guidance (support article 6531581): alphanumeric is supported, no registration, one-way only.
- `TELNYX_API_KEY` already exists (`settings.telnyx_api_key`, used by the voice code).

## Phase 4: Template catalog and CRM WhatsApp card

Goal: connect a client's WhatsApp from the account page and manage its templates without opening Meta.

### Tasks
- [x] 4.1 `automations/src/automations/whatsapp_templates/catalog.py`: the receptionist template set (name, category UTILITY, version, per-language header/body/footer/buttons, sample values, and an ordered variable spec). Bodies are exactly as approval-checked on 2026-10-10 (copy them from `submit_templates_2026_10_10.py` in this folder).
- [x] 4.2 `whatsapp_templates/manager.py`:
  - `submit_all(account_id, languages)` posts each missing or outdated catalog entry to `POST /{waba_id}/message_templates` with the account's token and upserts `WhatsApp_Templates`.
  - `refresh(account_id)` reads `GET /{waba_id}/message_templates?fields=name,language,status,category,rejected_reason,id`.
  - `approved(account_id, name, language) -> bool` is used by Phase 2.5.
- [x] 4.3 Engine internal routes (internal key, same pattern as the existing internal routes in `src/main.py`):
  - `POST /internal/whatsapp/{account_id}/test-connection` reads the phone number fields, stores `display_phone_number`, `verified_name`, `name_status`, `quality_rating` and sets the status.
  - `POST /internal/whatsapp/{account_id}/templates/submit` with body `{languages: ["nl","en"]}`.
  - `POST /internal/whatsapp/{account_id}/templates/refresh`.
- [x] 4.4 CRM storage `server/storage/whatsappSenders.ts` (exposed via the `storage` barrel): upsert a sender (seal token and secret with `secretBox`), get a sender (no secrets, only `hasToken`), and list templates.
- [x] 4.5 CRM routes `server/routes/whatsappCloud.ts` (agency only, registered in `server/routes/index.ts`):
  - `GET/PUT /api/accounts/:id/whatsapp-sender`
  - `POST /api/accounts/:id/whatsapp-sender/test` (proxies 4.3)
  - `GET /api/accounts/:id/whatsapp-templates`
  - `POST /api/accounts/:id/whatsapp-templates/submit` and `/refresh` (proxy 4.3)

  Use the existing engine-URL helper (`getEngineUrl`) and internal-key header.
- [x] 4.6 Client `client/src/features/accounts/components/workspace/whatsapp/` [complex]
  - [x] `WhatsAppCloudCard.tsx`: connect form (WABA id, phone number id, app id, app secret, system-user token), "Test connection", and status pills (connected, display number, verified name, name status, quality). Replace the Twilio `MessagingCard` WhatsApp section in `IntegrationsPanel.tsx` for accounts without Twilio creds; keep it for accounts that have them.
  - [x] `WhatsAppTemplatesCard.tsx`: one row per catalog template × language with a status pill, the rejected reason, a preview of the body with samples, and buttons "Submit all", "Resubmit" (per row) and "Refresh".
  - [x] `whatsappApi.ts`: React Query hooks.
  - [x] i18n namespace `whatsappCloud` in `client/src/locales/{en,nl,pt}/`.

  Follow `UI_STANDARDS.md` and the existing card atoms in `integrationsAtoms.tsx`. Keep each file under 300 lines.

### Technical Details

- Template submit body (proven on 2026-10-10; script at `specs/receptionist-channels/submit_templates_2026_10_10.py`, copy the payload builder):

  ```json
  {"name":"reception_call_booked","language":"nl","category":"UTILITY",
   "components":[{"type":"BODY","text":"Hoi {{1}}, bedankt voor je telefoontje met {{2}}. Je afspraak staat vast op {{3}}. Iets wijzigen? Stuur gewoon een bericht terug.",
     "example":{"body_text":[["Mark","Robben Rosmalen","donderdag 16 oktober om 14:30"]]}}]}
  ```
- Catalog bodies:
  - `reception_call_booked`:
    - EN: "Hi {{1}}, thanks for calling {{2}}. Your appointment is confirmed for {{3}}. Need to change it? Just reply to this message."
    - NL: "Hoi {{1}}, bedankt voor je telefoontje met {{2}}. Je afspraak staat vast op {{3}}. Iets wijzigen? Stuur gewoon een bericht terug."
  - `reception_call_followup`:
    - EN: "Hi {{1}}, thanks for calling {{2}}. Here is the link to plan your appointment: {{3}} Any questions? Just reply to this message."
    - NL: "Hoi {{1}}, bedankt voor je telefoontje met {{2}}. Hier is de link om je afspraak in te plannen: {{3}} Nog vragen? Stuur gewoon een bericht terug."
  - `reception_appointment_reminder`:
    - EN: "Hi {{1}}, a reminder of your appointment with {{2}} on {{3}}. Can't make it? Reply to this message and we will find another time."
    - NL: "Hoi {{1}}, een herinnering aan je afspraak bij {{2}} op {{3}}. Lukt het niet? Stuur een bericht terug, dan zoeken we een ander moment."
  - Samples: EN `["Mark","Robben Rosmalen","Thursday 16 October at 14:30"]`; the link sample is `https://book.leadawaker.com/k7Q2mX9a`.
- Variable sanitising, as in client-recaps: no newlines or tabs, no runs of 4+ spaces, trimmed, max 80 chars (links exempt), never empty.
- Meta rules: a variable is never the first or last token of the body; one category per template; do not set `allow_category_change`.

## Phase 5: After-call follow-up

Goal: the caller gets the right WhatsApp (or SMS) 30 seconds after an eligible call.

### Tasks
- [x] 5.1 Persist the screening verdict: set `Voice_Calls.screened_kind` where a call is ended as screened (`src/automations/voice/call_screening.py` `_end_screened`, ~128-137, and `phone_call.py` `_screened_kind`/`_pending_kind`, ~156-157).
- [x] 5.2 `automations/tools/phone_kind.py`: `is_nl_mobile(e164) -> bool` (`^\+316\d{8}$`). `+3197`, `+31` landlines, withheld numbers and foreign numbers return False.
- [x] 5.3 `automations/src/automations/voice/after_call_followup.py` [complex]
  - [ ] `schedule(call_id)` waits 30 s (`asyncio.sleep`), then calls `decide_and_send(call_id)`. Never raises; wrapped in `AsyncLogStep("after_call_followup", ...)`.
  - [ ] `decide_and_send`: read the `Voice_Calls` row, its lead and its account, apply every rule in requirements.md "After-call follow-up rules" in order, and write exactly one `Call_Followup_Log` row (`INSERT ... ON CONFLICT (voice_call_id) DO NOTHING RETURNING id`; stop if nothing is returned).
  - [ ] Kind:
    - Booked when `Voice_Calls.booked_iso` is set **and** the booking is real. Until real voice booking exists for client lines, treat it as `followup` (see the dependency in requirements.md).
    - The 24h dedup applies only to `followup`.
  - [ ] Content:
    - First name = recap `summary.name` (first word), else `Leads.first_name` when it is not the phone placeholder, else EN "there" / NL "daar".
    - Business = `Campaigns.company_name` or `Accounts.name`.
    - Link = the lead's personal booking link (the same helper that produces the `book.leadawaker.com/{token}` / `webhooks.leadawaker.com/join/...` links for chat).
    - Time = the localised relative day + date + time in the account timezone (reuse the client-recaps `copy.py` date formatting if built, else a local helper).
  - [ ] Send:
    - Window open (inbound WhatsApp in the last 24 h): free text via `send_service`.
    - Otherwise: the template via `send_service` with `template=...`.
    - On send failure with 131026, or via the status webhook later: Phase 3 `fallback_to_telnyx_sms`.
    - Record an outbound Interaction with `triggered_by='voice_followup'`.
- [x] 5.4 Hook: in `src/automations/voice/phone_call.py` `wrap_up` (~393-425), right after `close_out_call`, `asyncio.create_task(after_call_followup.schedule(call_id))`. Phone door only, so browser `/voice-demo` calls and the sweep do not trigger.
- [x] 5.5 Voice tab switch:
  - "Send a WhatsApp after each call" (`Accounts.after_call_followup_enabled`) plus the SMS sender name field (`Accounts.sms_sender_id`, max 11), in a new `client/src/features/accounts/components/workspace/voice/FollowUpCard.tsx`.
  - Read/write through `server/routes/voice-line.ts` / `server/storage/voiceLines.ts`, following the pattern of the existing transfer and unwanted-calls cards. i18n in `voiceTab.json` (en, nl, pt).
- [ ] 5.6 Voice prompt line: in the client-line voice layer rows (Prompt_Library 113-122, the native language per row), add one sentence for lines with follow-up on. Gate it with a voice prompt variable, not prose.
  - EN: "When you have given them a time or a link, you can mention that the details will follow on WhatsApp."
  - Check against the GPT-Live prompting guide before adding (see memory feedback_voice_prompt_lean_openai_check).

### Technical Details

- Recap fields (`src/automations/voice/call_recap.py:39-85`): `name`, `name_confirmed`, `outcome`, `items[{intent, interest, notes}]`. Intents include `do_not_contact`.
- End reasons (`phone_call.py:153, 333-365`): skip `no_greeting` and `robocall`.
- Block list: `Voice_Blocked_Callers` (`call_screening.py:139-155`).
- Client line vs demo: use the same predicate as `isDemoSql` (`server/storage/voiceCallsSql.ts:22`). If client-recaps 2.7 (`live_calls.py`) exists, reuse it.

## Phase 6: Shared phone and WhatsApp memory

Goal: each channel knows what was said on the other.

### Tasks
- [x] 6.1 `tools/db/interactions.py` `get_interactions_for_lead` gains `exclude_types: tuple = ()`. In `src/automations/ai_conversation.py` (~390), load history with `exclude_types=("voice_call",)`. Check the other callers (bumps, summaries, `handoff_detector`, reschedule/cancel detectors) and exclude it where they treat rows as chat.
- [x] 6.2 `tools/db/voice_caller_history.py`:
  - `recent_calls_for_lead(lead_id, accounts_id, days=30, limit=3)`: Voice_Calls by `leads_id`, or by `caller_number = lead.phone AND accounts_id`.
  - `recent_messages_for_phone(accounts_id, phone, days=30, limit=20)`: Leads (phone + Accounts_id) joined to Interactions, `type <> 'voice_call'`, respecting the newest `conversation_restart` marker.
- [x] 6.3 `src/automations/conversation/context_injection.py`: `inject_recent_calls_block(messages, lead, account_id)` renders `[RECENT PHONE CALLS]`, one line per call: relative day, what they wanted (`items[].interest`/`notes`), outcome, booked time. Reuse the `_recap` formatting from `voice/caller_memory.py:92-110`. Call it in `ai_conversation.py` right after `inject_kb_block` (~476).
- [x] 6.4 Text summary for voice: cache a one-line summary per lead in a new `Leads.chat_memory_summary text` and `chat_memory_summary_at timestamptz` (add both to the Phase 1 migration).
  - Refresh it after each AI turn, at most once per 10 minutes per lead (cheap model, same provider as the summaries).
  - Voice reads only the cached line, so the 1.5 s budget holds.
- [x] 6.5 `src/automations/voice/caller_memory.py`:
  - Add `messages_summary` to `CallerMemory`.
  - `_load` fetches the cached summary in parallel with the call lookup and drops the "no prior calls → None" early return when a summary exists.
  - Render it in `backend_block` (English, never spoken). Add one native-language line to `voice_block` via `caller_memory_copy.py`.

### Technical Details

- Phone normalisation is already E.164 on all three paths (voice `to_e164`, Twilio strip, Cloud `+` prefix). With Phase 2.4 scoping, one person is one Leads row per account.
- Voice leads are created `automation_status='paused'`. The AI path only blocks `completed` (`ai_conversation.py:312`), so a paused voice lead that messages on WhatsApp still gets replies.

## Phase 7: Website chat contact capture and immediate handoff

Goal: widget bookings and callback requests carry the visitor's name and phone; reception campaigns hand off on the first request.

### Tasks
- [x] 7.1 New AI signal `{{CONTACT: <name> | <phone>}}`:
  - Parse it next to `_SLOT_SELECTED_RE` in `src/automations/conversation/booking_execution.py` (or a sibling module) and strip it from the visible text.
  - Write `first_name`/`last_name` (split on the first space) when empty or a placeholder, and `phone` normalised with `to_e164` (default region NL) when empty. Never overwrite a real value.
  - It must run before slot booking in the same turn, so `slot_booking.py:920` (`attendee_name` from first/last name) and `attendee_phone` pick it up.
- [x] 7.1b Contact form in the widget (Gabriel, 2026-10-11: a small form beats typing details into the open chat) [complex]
  - [x] New AI signal `{{ASK_CONTACT}}`, website only. The engine strips it from the visible text and stores `form: "contact"` on that outbound message (Interactions metadata, or the field the widget poll already returns per message).
  - [x] `client/public/widget/widget.js` + `widget.css`: under a message with `form: "contact"`, render a small card with Name (required), Phone and Email (at least one of the two; phone first, `type="tel"`, `autocomplete` set on all three), and a submit button. After submit the card collapses to a one-line summary. The visitor can still ignore the card and type in the chat.
  - [x] Submit goes through the existing message endpoint (`POST /api/widget/:key/message`) with an extra `contact: {name, phone, email}` object. `server/routes/widget.ts` validates it (zod), normalises the phone to E.164 (default region NL), writes it to the lead under the 7.1 no-overwrite rules, and passes a readable message on to the engine ("Mark de Vries, 06 12345678") so the AI carries on with the booking or callback.
  - [x] Card labels in `client/public/widget/copy.js` for en, nl and pt (Brazilian).
  - The `{{CONTACT}}` signal from 7.1 stays as the path for visitors who type their details instead.
- [ ] 7.2 Prompt 124 (Reception (text) v1.1): add the CONTACT and ASK_CONTACT signals to section 9 and to the two website-only steps (booking step 1, section 7). In those steps the visitor may give a phone number or an email address; a phone number is preferred for a callback. Edit through SQL with a before/after diff, and check that nobody has the prompt open in the CRM (autosave reverts SQL writes).
- [x] 7.3 Handoff on first request for reception campaigns:
  - `src/automations/handoff_detector.py` (~97-110) returns a hard handoff with reason `human_request` on the first request when the campaign has `Campaigns.handoff_on_first_request = true` (new boolean, default false; add to the Phase 1 migration and `shared/schema.ts`).
  - Set it true on Robben's campaigns.
  - The AI still sends its one reply (prompt section 7) before pausing; verify the order in `ai_conversation.py:527`.
- [x] 7.4 The alert for 7.3 comes from client-recaps (`lead_needs_reply`, or `callback_requested` once a phone was captured). If client-recaps is not built yet, wire the existing `notify_manual_takeover` (`inbound_handler.py:814`) so it reaches the agency users as well as the owner.

- [ ] 7.5 AI-decided handoff (found while building, 2026-10-11): when the AI itself decides a person is needed (price offer, valuation, complaint) without the visitor asking, it promises a callback and shows the form, but nothing pauses the lead or alerts anyone. Add a `[HANDOFF]` signal to prompt 124 section 7 and handle it in the engine like a first-request handoff (reason `ai_escalation`).

Status 2026-10-11: 7.1, 7.1b, 7.3 and 7.4 are built. 7.2 is a file only (`prompt_124_reception_text_v1_2.txt`): write it to Prompt_Library 124 only AFTER the engine restart, or raw `{{ASK_CONTACT}}` signals reach visitors. The takeover notification (7.4) now goes to the account's users and the agency Owners and Admins, for every account.

### Technical Details

- Signal regex: `r"\{\{CONTACT:\s*([^|}]*)\|\s*([^}]*)\}\}"`.
- Placeholder first names to treat as empty: NULL, '', the phone number itself (voice placeholder), "Website visitor".

## Phase 8: Robben rollout (data, no code)

### Tasks
- [ ] 8.1 Widget campaign 72:
  - Set `language='nl'` (Gabriel tests in English first), Widget_Configs 10 `language='nl'` and a Dutch greeting.
  - Set `handoff_on_first_request=true`.
- [ ] 8.2 Create campaign "Robben Rosmalen · WhatsApp":
  - Copy campaign 72's fields, with `first_touch='whatsapp'`, `channel='whatsapp'`, `channel_mode='whatsapp_then_sms'`, `fallback_channel='sms'`, `prompt_campaign_id=72` (shares prompt 124) and `handoff_on_first_request=true`.
  - Set `Accounts.inbound_campaign_id` to it.
- [ ] 8.3 Point `Voice_Numbers` (Robben's real row, once his 085 exists) `campaigns_id` at the WhatsApp campaign, so callers who later message reach the same AI.
- [ ] 8.4 Connect the WhatsApp sender in the new card, submit the templates (nl, en), and wait for approval.
- [ ] 8.4b Set `Accounts.phone` for account 53 to his public number (`+31738887883`). It is NULL today, and the SMS fallback skips with `no_reach_phone` without it.
- [ ] 8.5 Set `Accounts.sms_sender_id='Robben'` and `after_call_followup_enabled=true` once the templates are approved.

### Technical Details

- Account 53 reference data:
  - Calendar_Connections 28 (`cal.leadawaker.com/robben-rosmalen/30min`, event type 10)
  - Niche_Vocabulary 75 (live persona)
  - Account_Knowledge_Base: 10 rows, plus the stock entry 125 updated hourly
- Live widget tests create **real** Cal.diy bookings: stop before picking a time, or cancel with `caldiy_api.cancel_booking(uid, api_key, base_url)` from `slot_booking.caldiy_resolve_account_credentials(53)` and delete the test lead.
