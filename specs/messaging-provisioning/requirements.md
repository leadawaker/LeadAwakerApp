# Managed Messaging Provisioning (Twilio, one-click) — Requirements

> **Cross-cutting platform infrastructure**, not a single service. It provisions each client's
> WhatsApp + SMS sender from the accounts **Integrations panel** so the client never touches Twilio.
> Powers every service that sends (`reactivation`, `reputation`, `speed_to_lead`). Provider decision
> (Twilio) is locked in `specs/channel-fallback/`. Schema additions are noted but **not edited here**
> (a parallel session owns `shared/schema.ts`).

## Context & goal

Lead Awaker should be the platform where a client clicks **one button** and their messaging is set up
— no copying Twilio credentials, no Twilio console. Today the accounts page already has a Twilio card
where creds can be **pasted manually** (Tier 1). This spec adds the **managed tier (Tier 3)**: Lead
Awaker provisions a Twilio **subaccount + phone number + messaging service** for the client behind one
button, and kicks off WhatsApp sender registration — all from the Integrations panel.

The win: near-zero client friction, Lead Awaker owns the experience and the billing (usage rolls to
our master Twilio account; we bill the client through Lead Awaker), and credentials are safer (we hold
a subaccount SID under our master account, not the client's root secret).

## What already exists (verified against the tree)

- **Twilio card UI (Tier 1, manual)** — `IntegrationsPanel.tsx` → `TwilioCardWrapper`, fields from
  `adapters.ts:24-31`: `twilio_account_sid`, `twilio_auth_token`, `twilio_messaging_service_sid`,
  `twilio_default_from_number`, plus `webhook_url`, `webhook_secret` (intake key), `intake_url`.
  Edit/save → `PATCH /api/accounts/:id`. A client can paste creds today.
- **The exact patterns to mirror** are already in the same panel:
  - **One-click provision** — `BookingPageCard` + `provisionBookingPage` (server creates credentials,
    returns them, supports reveal/copy/regenerate/delete). This is the template for "Provision Twilio."
  - **OAuth connect** — `CalendarConnectCard` + `startCalendarOAuth` (the pattern for Twilio Connect,
    if we ever want Tier 2).
- **Twilio SDK already a dependency** (`twilio ^6.0.0`); the Express server already builds a Twilio
  client + validates signatures in `server/routes/twilio-voice.ts` (master creds in server env).
- **Send path already reads per-account creds** — `send_message` / `twilio_service` thread the
  account's `twilio_account_sid` / `auth_token` / `default_from_number` / `messaging_service_sid` and
  fall back to our defaults only if unset. **Provisioning writes those same fields**, so the engine
  send path needs **zero changes** to use a provisioned subaccount.

## The gap

There is no automated provisioning: someone must create the Twilio account/number and paste creds.
This spec automates that into a button, with WhatsApp sender status surfaced inline.

## In scope

- A **"Set up messaging"** action in the accounts Integrations panel that provisions, server-side:
  a Twilio **subaccount** for the client → buys a **number** (NL, two-way capable) → creates a
  **Messaging Service** → writes the resulting creds to the Accounts row (same fields the manual card
  uses) → configures the number's **inbound + delivery-status webhooks** to the engine.
- **WhatsApp sender registration** kicked off for the number (Twilio WhatsApp Senders / embedded
  flow), with an inline **status pill** (`not started` / `pending Meta review` / `approved` /
  `rejected`).
- A status surface: SMS-ready vs WhatsApp-ready shown separately (SMS is instant, WhatsApp is gated).
- **Manual entry (Tier 1) kept as an "Advanced / use my own Twilio" fallback** for a client who
  insists on their own account.
- Cross-cutting: the provisioned sender serves reputation, speed-to-lead, and reactivation with no
  per-service change.

## Out of scope

- **Twilio Connect (Tier 2 OAuth)** — not built unless a client wants to own their Twilio billing.
- **Full automation of Meta approvals** — business verification, display-name, and template approval
  are Meta-gated and cannot be one-click (see non-functional). We surface status, not bypass review.
- The **template content** itself (en/nl cold-open templates) — owned by the speed-to-lead / reputation
  specs; this spec only registers/links them.
- Number porting (moving a client's existing number into our master account) — later; v1 buys a fresh
  number or uses Tier-1 manual for an existing number.

## Functional requirements

1. **One-click provision (SMS).** "Set up messaging" creates a subaccount + buys an NL two-way number
   + creates a Messaging Service + writes `twilio_account_sid` / `twilio_auth_token` /
   `twilio_messaging_service_sid` / `twilio_default_from_number` to the Accounts row. Idempotent: a
   second click does not create a second subaccount/number (guard on existing creds).
2. **Inbound + status wiring.** The purchased number's inbound SMS/WhatsApp webhook is set to the
   engine's Twilio inbound endpoint, and its **delivery status callback** to a status endpoint — so
   replies reach `inbound_handler.py` and the `channel-fallback` undeliverable detection works.
3. **WhatsApp sender registration.** A follow-on action starts WhatsApp sender onboarding (display
   name + business info), tracked as a status the UI polls/receives. Until approved, WhatsApp sends
   are blocked and the UI says "pending Meta review"; SMS works immediately.
4. **Status visibility.** The panel shows two independent states: **SMS** (ready once number bought)
   and **WhatsApp** (ready once Meta approves). Never claim WhatsApp-ready before approval.
5. **Manual fallback.** An "Advanced" expander exposes the Tier-1 fields so a client can paste their
   own Twilio creds instead; the connected pill reflects whichever path is set.
6. **Deprovision.** Releasing messaging (on offboarding) releases the number and closes/suspends the
   subaccount, clears the creds, with a destructive-action confirm (mirrors booking-page delete).
7. **Zero send-path change.** Because provisioning populates the existing per-account fields, the
   engine send path and the channel-fallback policy work unchanged.

## Non-functional requirements

- **WhatsApp is Meta-gated, by design.** SMS provisioning is fully automated; WhatsApp enablement
  requires Meta business verification + display-name + template approval and takes review time. The
  product makes this *feel* low-friction (one action, then a status pill) but never bypasses Meta.
- **Security:** the stored `twilio_auth_token` (subaccount token) is sensitive → **encrypt at rest**;
  the API returns it masked with reveal-on-demand (mirror the booking-page password handling). Never
  log tokens.
- **Billing isolation:** each client = its own Twilio **subaccount** so usage/cost is attributable;
  usage rolls to the master account for one bill, then re-billed via Lead Awaker.
- **Permissions:** provisioning is agency-only (`requireAgency`), like the other account mutations.
- **i18n:** all panel strings via the `accounts` namespace, **en / nl only** (pt-BR dropped from
  campaigns). Tokens only, no hardcoded hex; right-panel/inline, never a backdrop dialog.
- **Idempotent + safe:** all Twilio calls are guarded against double-provision and partial-failure
  (e.g. number bought but messaging service failed → recoverable, not orphaned).

## Data model changes (summary — NOT edited here; flag for the schema-owning session)

- **Already present (reused):** `Accounts.twilio_account_sid` / `twilio_auth_token` /
  `twilio_messaging_service_sid` / `twilio_default_from_number` (schema.ts:44-47), `webhook_secret`,
  `webhook_url`.
- **Likely new (status tracking):** `whatsapp_sender_status` (text: `none|pending|approved|rejected`),
  `whatsapp_sender_sid` (or WABA id), `whatsapp_display_name`, `messaging_provisioned_at` (timestamp).
  These do **not** exist today — flag for the schema session. Timestamps server-side (`new Date()`).
- **Encryption:** if not already encrypting `twilio_auth_token` at rest, add it (storage-layer or
  column-level) — security item, confirm current state.

## Acceptance criteria

- Clicking "Set up messaging" on a fresh account creates exactly one subaccount + one NL number +
  one messaging service, writes the four Twilio fields, and the SMS state shows **ready** within
  seconds; a second click does not duplicate.
- The purchased number's inbound + status webhooks point at the engine; a test SMS reply reaches
  `inbound_handler.py`, and a delivery-status callback is received.
- Starting WhatsApp registration moves the WhatsApp state to **pending**; the UI blocks WhatsApp sends
  and shows the pill; on approval it flips to **ready**.
- A reputation/speed-to-lead campaign on that account sends with **no engine change** (it reads the
  provisioned per-account creds).
- "Advanced" still lets a client paste their own Twilio creds (Tier-1 fallback works).
- Deprovision releases the number, clears creds, and requires confirmation.
- `twilio_auth_token` is encrypted at rest and never returned unmasked except on explicit reveal.
