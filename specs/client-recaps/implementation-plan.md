# Implementation Plan: Client Recaps and Instant Alerts

## Overview

Six phases: data model, engine core, engine hooks, Express (email + settings + links), client UI, rollout. The engine owns timing, dedup and WhatsApp; Express owns the email layout and the settings UI. Run no `tsc` unless asked. Engine edits need `./preflight.sh && pm2 restart leadawaker-engine --update-env` (no hot reload). Keep `DRY_RUN`-style safety: WhatsApp sending stays behind `CLIENT_ALERTS_WHATSAPP_ENABLED=false` until templates are approved.

## Architecture choice: the engine triggers, Express renders email

**Decision:** one engine package (`automations/src/automations/client_alerts/`) records every event, claims the dedup row, decides channels, sends WhatsApp with `send_template_message`, persists CRM notifications with `notify()`, and for email calls a new internal Express endpoint that renders with `server/email.ts` and delivers through Resend.

**Why not an Express-side scheduler:**
- Every event that triggers an alert already happens in the engine (booking webhook, voice wrap-up, smart handoff). Express would need an engine-to-Express call per event anyway.
- WhatsApp template sending lives in the engine (`tools/whatsapp_cloud.py:17`), as Gabriel asked.
- The Pi's Express process is `tsx watch`: it restarts on every file save, so in-process `setInterval` timers reset during development. The engine runs without watch and already has APScheduler with `coalesce` and `max_instances=1`.
- One ledger and one dedup point in one process is simpler to reason about than two.

**Why email still goes through Express:** one layout. The engine sends structured facts (type, language, data), never HTML. The engine-to-Express pattern already exists: `X-Internal-Key` header (`server/auth.ts:146`), used by `tools/caldiy_api.py:111` and `tools/public_demo.py:114` against `settings.crm_base_url`.

## API contracts (fixed so engine and Express can be built in parallel)

### `POST /api/internal/client-alerts/email` (internal key only)

```json
{
  "ledgerId": 812,
  "kind": "alert | recap",
  "type": "appointment_booked | appointment_rescheduled | appointment_cancelled | callback_requested | lead_needs_reply | daily_recap",
  "language": "nl",
  "accountName": "Robben Rosmalen",
  "to": [{ "address": "poaa@robbenrosmalen.nl", "name": "Thijs" }],
  "link": "https://app.leadawaker.com/go/k7Q2mX9a",
  "data": { "...": "per-type facts, already formatted in the account timezone" }
}
```

Returns `{ "results": [{ "address": "...", "ok": true, "provider": "resend", "id": "..." }, { "address": "...", "ok": false, "error": "..." }] }`. Never throws to the engine; a render error returns `ok:false` for every address. Uses `Idempotency-Key: {ledgerId}:{address}`.

### `GET /api/accounts/:id/alert-settings` and `PATCH` (agency only)

GET returns `{ recap: { enabled, time }, timezone, alerts: <setup.alerts normalised>, suggestedWhatsapp: "<setup.handoff.number or null>" }`. PATCH takes any subset of `recap.enabled`, `recap.time`, and the `alerts` fields. A recipient patched with `consent: true` gets `optedInAt = new Date()` server-side. Merges into `setup`, never replaces (pattern `server/storage/voiceLines.ts:287`).

### `POST /api/accounts/:id/alert-settings/test` (agency only)

`{ channel: "email" | "whatsapp", type: "daily_recap" | "<alert type>" }`. Express calls the engine's internal endpoint `POST /internal/client-alerts/test`, which sends sample values through the real path (ledger row with `dedup_key = test:{uuid}`).

### `GET /api/go/:code` (requireAuth)

Returns `{ path: "/platform/leads", selectLeadId: 123 }` (or the voice calls / calendar target) if the user can access the ledger row's account, else 404.

## Phase 1: Data model

- [ ] **1.1** Engine migration `automations/scripts/migrate_add_client_alert_log.py`: table `Client_Alert_Log` (columns in requirements), unique index on `dedup_key`, unique on `link_code`, index on `(accounts_id, created_at)`, GIN not needed.
- [ ] **1.2** Add `clientAlertLog` to `shared/schema.ts` (read-only use in Express, engine owns writes) with a comment that the engine owns the migration.
- [ ] **1.3** Types: `AlertSettings` in a new `shared/clientAlerts.ts` (alert type keys, channel keys, defaults, `normalizeAlertSettings()`), imported by server and client. Keep under 150 lines.

## Phase 2: Engine core (`automations/src/automations/client_alerts/`)

Each file under 300 lines.

- [ ] **2.1** `settings.py`: load `Account_Communication_Profile.setup` + `Accounts.timezone/language/name`, normalise with defaults, resolve language, list eligible recipients (opted in, not opted out). Cache 60s.
- [ ] **2.2** `tools/db/client_alerts.py`: `claim_event(dedup_key, ...) -> id | None` (`ON CONFLICT DO NOTHING RETURNING id`), `claim_delivery(id, idx)` (atomic jsonb `pending` to `sending`), `finish_delivery(...)`, `last_recap_window_end(account)`, `events_in_window(...)`, `open_handoffs(...)`, `find_by_message_id(...)`, link-code generator (8 chars, `secrets`).
- [ ] **2.3** `copy.py`: per-language strings (source labels, reasons, fallbacks, date formatting with 24h clock and short weekday). Pure functions, unit-testable.
- [ ] **2.4** `templates.py`: per type, build the ordered variable list, sanitise each value (strip newlines/tabs, collapse 4+ spaces, trim, cap 80, never empty), template name + Meta language code (`nl`, `en`, `pt_BR`).
- [ ] **2.5** Extend `tools/whatsapp_cloud.py` `send_template_message`: add `button_url_suffix` (URL button component, index 0), optional `phone_number_id`, and return the Meta error code. Keep the existing signature working (no other callers today).
- [ ] **2.6** `dispatch.py`: `record_event(account_id, event_type, dedup_key, payload, lead_id=None, call_id=None, instant_eligible=True)`: claim row; if claimed and the type is on, fan out to channels: CRM via `notify()` (email forced off, recipients as in requirements), WhatsApp per recipient (hold as `held` in quiet hours), email in one call to Express. Never raises; wraps everything in `AsyncLogStep("client_alerts", ...)`. Fire-and-forget entry `schedule_event(...)` that wraps it in `asyncio.create_task`.
- [ ] **2.7** `live_calls.py`: Python port of `isDemoSql` (`server/storage/voiceCallsSql.ts:22`) as one SQL predicate, with a comment that both must change together.
- [ ] **2.8** Add the new notification types to `DEFAULT_TYPE_CHANNELS` (`tools/notification_service.py:26`): `booking_rescheduled`, `booking_cancelled`, `callback_requested`, `daily_recap`, all `email: False`.
- [ ] **2.9** `recap.py`: `run()` for the scheduler. For each account with recap on and at least one channel: compute local time, check the send rule (at or past `recapTime`, under +3h, no row for local date), build the window, gather counts and lists, apply the zero-activity rule (write a `skipped` row so the window advances), else dispatch on recap channels.
- [ ] **2.10** `sweeper.py`: every 5 min: release `held` WhatsApp deliveries whose quiet hours ended; retry `failed` transient deliveries (5/15/45 min, max 3); mark `sending` older than 10 min as `unknown`; raise the once-a-day agency failure notification.
- [ ] **2.11** Register `client_recap` (IntervalTrigger 300s) and `client_alerts_sweeper` (IntervalTrigger 300s) in `src/scheduler/jobs.py`.
- [ ] **2.12** Internal engine route `POST /internal/client-alerts/test` (internal key) for the CRM test button.
- [ ] **2.13** Global kill switches in `src/config.py`: `client_alerts_enabled` (default true for CRM/email), `client_alerts_whatsapp_enabled` (default false until templates approved). Respect `settings.dry_run`.

## Phase 3: Engine hooks

- [ ] **3.1** `booking_routes.py` `_handle_booking`: after the update-state block (`:616-668`), before the `engine_booked` return (`:678`): `schedule_event` as `appointment_rescheduled` if `is_rebook` (`:580`) else `appointment_booked`. Source: `engine_booked` gives chat (WhatsApp or website by channel), otherwise booking page. Skip demo campaigns.
- [ ] **3.2** Remove the old notify block at `:1047-1098` (its CRM role moves into 3.1, now also covering in-chat bookings). Keep the agency recipients identical.
- [ ] **3.3** `_handle_reschedule`: after `apply_event_tags` at `:1238`, `schedule_event` `appointment_rescheduled` with the new start.
- [ ] **3.4** `_handle_cancellation`: before `:1363`, when not `is_client_cancel`, `schedule_event` `appointment_cancelled` with the time from the lead snapshot (read before it is cleared).
- [ ] **3.5** `tools/db/voice_calls.py` `close_out_call` (`:239`): after `finalize_outcome`, call `client_alerts.on_call_closed(call_id)` in its own try (never raises). It reads the row, applies the live-call rule and the mapping table (callback, leave_message, failed transfer, voice "booking" as a request to confirm).
- [ ] **3.6** `inbound_handler.py` `notify_manual_takeover` (`:814`): add `trigger: str = "smart_handoff"`; pass `"input_guardrail"` from `ai_conversation.py:347`, `"output_guardrail"` from `:710` and `voice_live.py:292`. Record `lead_needs_reply` (instant) for smart handoff, `guardrail_pause` (recap only) otherwise. Widen its CRM recipients from owner-only to all Viewer users (via `record_event`).
- [ ] **3.7** `whatsapp_cloud_routes.py`: early branch after the VIP check (`:342`): sender is an opted-in alert recipient, not VIP, no demo token: hand to `client_alerts.replies.handle(...)` (STOP handling, `client_reply` row, agency notify, one auto-reply per 24h) and return before the lead pipeline.
- [ ] **3.8** `_process_status_updates` (`:298`): map status by message id onto the delivery (`delivered`, `read`, `failed` with error code).
- [ ] **3.9** `nightly_summary.py`: skip the `notify` call (`:209-229`) when the account's daily recap is on. Summary storage unchanged.

## Phase 4: Express

- [ ] **4.1** Coordinate with the `server/email.ts` restyle: it must export its branded layout (e.g. `renderBrandedEmail({ heading, bodyHtml, ctaLabel, ctaUrl, footerHtml })`) and accept an optional `idempotencyKey` on delivery. Do not edit `email.ts` while the restyle is in flight; add these two exports after it lands.
- [ ] **4.2** `server/clientAlerts/emailCopy.ts`: subjects and body strings for the 6 types in en/nl/pt (strings live here, not in client locales, because they are server-rendered; same pattern as the invite TRANSLATIONS in `email.ts`).
- [ ] **4.3** `server/clientAlerts/renderAlertEmail.ts` and `renderRecapEmail.ts`: build HTML + text from the payload, escape every value with `escapeHtml`, use the shared layout. Recap sections: headline, appointments, waiting on you, calls, conversations, tomorrow.
- [ ] **4.4** `server/routes/clientAlerts.ts`: the internal email endpoint (validate with Zod, internal key only), alert-settings GET/PATCH, test endpoint, `GET /api/go/:code`. Register in `server/routes/index.ts`.
- [ ] **4.5** `server/storage/clientAlerts.ts`: read/merge `setup.alerts` and `setup.handoff.recap/recapTime`, E.164 normalisation, `optedInAt` set with `new Date()`, lookup by link code. Expose through the `storage` barrel.
- [ ] **4.6** Add the new notification types to the Express side where types are listed (`client/src/features/settings/types.ts` `NOTIF_TYPE_KEYS` and icons in `NotificationCenter.tsx`), with i18n keys in en/nl/pt.

## Phase 5: Client

- [ ] **5.1** New lazy page `/go/:code` (in `client/src/App.tsx`, React.lazy): calls `/api/go/:code`, sets `setPersistedSelection("selected-lead-id", id)` (as `NotificationCenter.tsx:214` does) or the voice-call selection, then navigates. Not logged in: login, then back to the same URL.
- [ ] **5.2** Check the Voice Calls page can preselect a call from persisted selection; add a `selected-voice-call-id` key if missing.
- [ ] **5.3** `RecapsAlertsCard.tsx` (new, under `features/accounts/components/workspace/alerts/`): recap on/off + time, timezone shown read-only from the account, channel matrix (recap and alerts x CRM, email, WhatsApp), instant toggles per type, quiet hours, phone-in-WhatsApp switch, language select, recipient lists (email; WhatsApp with name, number, consent checkbox, opted-out badge), "Suggest the handoff contact" one-click from `setup.handoff.number`, "Send test" per channel. Read-only for clients. Split into small components to stay under 300 lines each.
- [ ] **5.4** Place the card: new workspace tab `alerts` ("Recaps & alerts") next to Voice in `OverviewTab.tsx` `TabContent` and the tab list type.
- [ ] **5.5** Wizard: in `ServiceSteps.tsx` `handoffRules` (`:107-136`), under the existing recap time, add channel chips (email, WhatsApp), one email field, and "Send WhatsApp updates to {handoff number}" with a consent tick. Saves through the same merge route so `setup.alerts` is created with defaults. Wizard summary (`ProfileSummary.tsx:188`) shows channels.
- [ ] **5.6** i18n: all new strings in `client/src/locales/{en,nl,pt}/` (new namespace `clientAlerts`), Brazilian Portuguese.

## Phase 6: Rollout

- [ ] **6.1** Gabriel submits the 6 templates x 3 languages (see action-required.md). Wait for UTILITY approval of all 18.
- [ ] **6.2** Configure Robben: recipients, consent confirmed, language nl, recap 18:00, email + WhatsApp.
- [ ] **6.3** Run the test plan below with `client_alerts_whatsapp_enabled=false` first (CRM + email only), then flip it on.
- [ ] **6.4** Watch the first three recaps in Automation Logs and the delivery statuses.

## Test plan

**Unit (engine, pytest):**
- [ ] `templates.py`: every variable sanitised (newline, tab, 5 spaces, 200 chars, empty), count matches the template, never at body start or end.
- [ ] `copy.py`: date formatting nl/en/pt in Europe/Amsterdam across the DST change (2026-10-25) and in America/Sao_Paulo.
- [ ] Recap send rule: 17:59 no, 18:00 yes, 18:05 second tick no (row exists), 21:01 no (past catch-up), recap time in a DST gap still fires.
- [ ] Zero-activity day writes a `skipped` row and the next window starts at its end.
- [ ] Dedup: two concurrent `record_event` with one key, exactly one dispatch.
- [ ] Voice mapping table: each outcome and intent maps as specified; demo calls ignored.

**Integration (staging data on a test account, never Robben's leads):**
- [ ] Create a test account with Gabriel's email and number as recipients.
- [ ] Book through the Cal.diy link, book in chat, rebook through the link, reschedule in chat, cancel as the customer, cancel from the CRM: check one alert each (none for the CRM cancel), correct times, correct link.
- [ ] Replay the same `BOOKING_CREATED` webhook payload twice: one alert.
- [ ] Phone test call on a test line asking for a callback, one leaving a message, one with a forced failed transfer: one `callback_requested` each.
- [ ] Trigger a smart handoff (ask for a human twice): one `lead_needs_reply`; trigger it again the same day: none.
- [ ] Set quiet hours to cover now: WhatsApp held, email and CRM immediate; set them to end: held alert released once.
- [ ] Reply "ok" from the recipient phone: no AI answer, agency notified, one auto-reply; reply again within 24h: no second auto-reply. Reply "STOP": opted out, next alert skips that number.
- [ ] Force a WhatsApp error (invalid number): marked failed, not retried; force a 5xx (mock): retried on schedule.
- [ ] Kill the engine across 18:00, restart at 19:30: recap sends; restart at 21:30: skipped and logged, next day's window covers both days.
- [ ] Open each `/go/` link logged out (login then lands on the item) and as a user of another account (404).
- [ ] Email renders in Gmail and Outlook web, light and dark, nl/en/pt.
