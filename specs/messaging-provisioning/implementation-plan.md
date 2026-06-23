# Managed Messaging Provisioning — Implementation Plan

> Paths verified against the current tree (this session). CRM = `/home/gabriel/LeadAwakerApp/`,
> Engine = `/home/gabriel/automations/`. Builds on the Twilio decision (`specs/channel-fallback/`) and
> the existing accounts Integrations panel.

## Architecture decision: provision in the CRM server, reuse the booking-page pattern, zero send-path change

- **Provisioning lives in the Express CRM server**, not the engine — it's an account-settings action
  triggered from the accounts page, exactly like `provisionBookingPage`. The Express server already
  imports the `twilio` SDK (`server/routes/twilio-voice.ts`) and holds master Twilio creds in env.
- **It writes the same Accounts fields the manual Twilio card already writes.** The engine's send
  path (`send_message` / `twilio_service`) already reads per-account creds, so **no engine code
  changes** — provisioning just fills `twilio_account_sid` / `auth_token` / `messaging_service_sid` /
  `default_from_number` for the client's subaccount.
- **UI mirrors `BookingPageCard`**: a provision button → server call → status + reveal/copy +
  regenerate/delete. The existing `TwilioCardWrapper` (manual fields) becomes the "Advanced" fallback.
- **Inbound stays the shared funnel:** provisioning points the bought number's webhooks at the
  engine's existing Twilio inbound + status endpoints; `inbound_handler.py` is unchanged.

Net: new code is a CRM provisioning route + a panel upgrade + WhatsApp-status tracking. The engine,
send path, and channel-fallback policy are untouched.

## Phase 1 — SMS provisioning (fully automatable, ship first)

**a) Server route** — new `server/routes/messaging.ts` (or extend `accounts.ts`), `requireAgency`:

- `POST /api/accounts/:id/messaging/provision`:
  1. Guard: if the account already has `twilio_account_sid`, return current status (idempotent).
  2. `master.api.v2010.accounts.create({ friendlyName: "LeadAwaker — <name> (#id)" })` → subaccount
     SID + auth token.
  3. Search + buy a number on the subaccount:
     `sub.availablePhoneNumbers("NL").mobile.list({ smsEnabled: true })` →
     `sub.incomingPhoneNumbers.create({ phoneNumber, smsUrl: <engine inbound>, statusCallback:
     <engine status>, smsMethod: "POST" })`.
  4. `sub.messaging.v1.services.create({ friendlyName, inboundRequestUrl, statusCallback })` → add the
     number to it (`.phoneNumbers.create`).
  5. `storage.updateAccount(id, { twilioAccountSid, twilioAuthToken, twilioMessagingServiceSid,
     twilioDefaultFromNumber, messagingProvisionedAt: new Date() })` (timestamps server-side).
  6. Return masked creds + status (mirror `provisionBookingPage`'s response shape).
- `GET /api/accounts/:id/messaging/status` → `{ sms: "ready"|"none", whatsapp:
  "none"|"pending"|"approved"|"rejected", fromNumber, … }`.
- `DELETE /api/accounts/:id/messaging` → release number (`incomingPhoneNumbers(sid).remove()`),
  suspend/close subaccount, clear the Accounts creds. Destructive-confirm on the client.
- Wrap externally-visible steps so failures are recoverable (number bought but service failed →
  retry-safe, no orphan).

**b) Client API** — `client/src/features/accounts/api/messagingApi.ts` (mirror `calendarApi.ts`):
`provisionMessaging(accountId)`, `fetchMessagingStatus(accountId)`, `deprovisionMessaging(accountId)`.

**c) UI** — upgrade `IntegrationsPanel.tsx`:
- Replace the default Twilio card with a **MessagingCard**: when no creds → explainer + **"Set up
  messaging"** button (mirror `BookingPageCard`'s `provision`); when provisioned → show number, SMS
  **ready** pill, WhatsApp status pill, reveal/copy creds, regenerate/release.
- Keep `TwilioCardWrapper` (manual fields) behind an **"Advanced — use my own Twilio"** expander.
- i18n strings in the `accounts` namespace (en/nl). Reuse `IconTile` / `SectionHead` / `FlatRow` /
  `ConnectedPill` already in the file.

**d) Verification (Phase 1):** click provision on a test account → subaccount + NL number created in
Twilio console, four fields populated, SMS pill ready; send a test SMS from a `speed_to_lead`/
`reputation` campaign → goes out from the new number with no engine change; reply → reaches
`inbound_handler.py`.

## Phase 2 — WhatsApp sender registration (semi-automated, Meta-gated)

- `POST /api/accounts/:id/messaging/whatsapp/register` → start WhatsApp sender onboarding for the
  number via Twilio's WhatsApp Senders API (display name, business profile). Store
  `whatsapp_sender_status="pending"`, `whatsapp_sender_sid`, `whatsapp_display_name`.
- **Status sync:** poll Twilio (or receive Twilio's status webhook) → update
  `whatsapp_sender_status` to `approved`/`rejected`; surface the pill. The engine must **not** attempt
  a WhatsApp send while status ≠ `approved` (it falls back to SMS per `channel-fallback`, or holds).
- **Template linkage:** register the en/nl cold-open templates (content owned by speed-to-lead /
  reputation specs) and store the approved SID on the campaign's `twilio_first_message_template_sid`.
- **UI:** a "Enable WhatsApp" button on the MessagingCard once SMS is ready; shows pending/approved/
  rejected with the display name; links out to fix a rejection.

## Phase 3 — Lifecycle & polish

- Regenerate / release number; close subaccount on account offboarding (avoid number rental cost).
- Optional: let the client **pick** the number from a short available list vs auto-pick first NL.
- Optional: per-location / second number support (multi-number accounts).
- Encrypt `twilio_auth_token` at rest if not already (storage-layer crypto); confirm current state.

## Files touched (representative)

**New (CRM):** `server/routes/messaging.ts` (provision/status/whatsapp/deprovision),
`client/src/features/accounts/api/messagingApi.ts`. **Edited (CRM):**
`client/src/features/accounts/components/workspace/IntegrationsPanel.tsx` (MessagingCard + Advanced
fallback), `adapters.ts` (status fields), `server/routes/index.ts` (register the route), locale files
`client/src/locales/{en,nl}/accounts.json`. **Engine:** none (reads provisioned per-account creds).
**Schema:** WhatsApp-status + `messaging_provisioned_at` fields flagged for the schema-owning session
(not edited here).

## Verification (end-to-end)

1. **Provision:** "Set up messaging" → exactly one subaccount + NL number + messaging service in the
   Twilio console; four Accounts fields populated; SMS pill ready; second click does not duplicate.
2. **Inbound/status wiring:** test SMS reply reaches `inbound_handler.py`; a delivery-status callback
   is received (feeds `channel-fallback`).
3. **No engine change:** a `reputation` and a `speed_to_lead` campaign both send from the new number
   using the provisioned per-account creds, unchanged.
4. **WhatsApp gate:** start registration → pending pill, WhatsApp sends blocked / SMS-fallback;
   on approval → ready, template send works.
5. **Advanced fallback:** paste own Twilio creds → connected pill reflects it; managed button hidden.
6. **Deprovision:** release → number released in Twilio, creds cleared, confirm required.
7. **Security:** `twilio_auth_token` encrypted at rest; API returns masked; reveal-on-demand only.
