# Managed Messaging Provisioning — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Build status
- [x] **Phase 1 (SMS provisioning) BUILT (2026-06-22).** Schema (`Accounts.messaging_provisioned_at`,
      `whatsapp_sender_status`, `whatsapp_sender_sid`, `whatsapp_display_name`) + migration
      (`migrate-messaging-columns.js`). Server route `server/routes/messaging.ts`
      (`POST .../messaging/provision`, `GET .../messaging/status`, `DELETE .../messaging`), registered
      in `server/routes/index.ts` — idempotent + partial-failure recovery. Client
      `messagingApi.ts`. UI: `MessagingCard` in `IntegrationsPanel.tsx` (one-click "Set up messaging" +
      SMS/WhatsApp status pills + release; manual Twilio kept behind "Advanced"). i18n `accounts`
      namespace en/nl/pt. Route verified registered (401 on status). **Not yet exercised** — needs the
      master Twilio prerequisites below + a real click (buys a number = real money).
- [ ] **Phase 2 (WhatsApp sender registration)** — not built. Adds `POST .../messaging/whatsapp/register`
      + status sync; surfaces the pending/approved pill; links the reputation/speed-to-lead templates
      (`whatsapp-templates.md`) onto `campaign.twilio_first_message_template_sid`.
- [ ] Inbound/status webhook URLs default to `https://webhooks.leadawaker.com/webhooks/sms/{inbound,status}`
      (override via `ENGINE_INBOUND_WEBHOOK_URL` / `ENGINE_STATUS_WEBHOOK_URL`). The `/status` receiver
      is owned by `specs/channel-fallback/` (harmless 404s until built). **Verify the inbound URL** is
      the engine's real public endpoint before going live.

## Master Twilio account (one-time, ours)
- [ ] A Lead Awaker **master Twilio account** with billing enabled and permission to create
      subaccounts + buy numbers. Master creds in the Express server env (the same ones
      `server/routes/twilio-voice.ts` already uses for signature validation).
- [ ] Confirm the master account can purchase **NL two-way numbers** (mobile-capable for inbound).
      Decide default number type/country (NL mobile vs local) — two-way SMS needs a number that can
      receive, not an alphanumeric sender ID.

## WhatsApp enablement (one-time, ours) ⚠️ the lead-time item
- [ ] Enable WhatsApp on the master Twilio account as a **WhatsApp Tech Provider / sender onboarding**
      path (Twilio's WhatsApp Senders + embedded signup), so client numbers can be registered as
      WhatsApp senders under our umbrella.
- [ ] Understand that per **client** sender, Meta still requires: **business verification**,
      **display-name approval**, and **template approval** (en/nl). These are Meta-gated and take
      review time — the product shows a "pending Meta review" pill; it cannot one-click past them.

## Per-client (now mostly automated by the panel)
- [ ] Click **"Set up messaging"** on the account → subaccount + NL number + messaging service are
      provisioned automatically; SMS is ready immediately.
- [ ] Click **"Enable WhatsApp"** → submit display name + business info; wait for Meta approval; then
      register the en/nl cold-open template(s) and link the approved SID on the campaign
      (`twilio_first_message_template_sid`).
- [ ] (Fallback) For a client who insists on their own Twilio: use the **Advanced — use my own
      Twilio** expander and paste their creds instead.

## Security
- [ ] Encrypt `twilio_auth_token` (subaccount token) **at rest** if not already — confirm current
      storage. API must return it masked with reveal-on-demand only. Never log tokens.

## Billing
- [ ] Decide the re-billing model: subaccount usage rolls to our master Twilio bill; how is it
      re-charged to the client (flat retainer that absorbs it vs metered pass-through + markup)?
- [ ] Set an offboarding policy: **release the number + close the subaccount** when a client leaves,
      so number rental doesn't accrue.

## Engine
- [ ] None. The engine reads the provisioned per-account creds via the existing send path — no Python
      changes, no restart needed for provisioning (the Express server auto-reloads via pm2 watch).

## Open decisions to confirm before build
- [ ] **Managed-only vs keep manual fallback:** recommend keeping Tier-1 manual entry as "Advanced".
- [ ] **Number selection:** auto-pick first available NL number vs let the client choose from a list.
- [ ] **One number per account**, or per-campaign / per-location (multi-location clients)?
- [ ] **WhatsApp onboarding path:** Twilio's self-signup vs building our own Meta Embedded Signup as a
      Tech Provider (more control, more build) — Twilio's path is the v1 default.
- [ ] **A2P / regulatory:** NL number registration now; US A2P 10DLC only if/when US traffic appears.
- [ ] **Status sync:** poll Twilio for WhatsApp sender status vs wire Twilio's status webhook.
