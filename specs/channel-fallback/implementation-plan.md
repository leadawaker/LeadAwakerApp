# Channel Fallback / Routing (SMS + Email) — Implementation Plan

> Paths verified against the current tree. Engine = `/home/gabriel/automations/`, CRM =
> `/home/gabriel/LeadAwakerApp/`. Builds on the decisions in `requirements.md` (Twilio for clients,
> **email as the default fallback**). Sequenced so the **no-dependency slice ships first**.

## Architecture decision: one policy in the shared send path, email-first before fallback

- The channel policy lives in the **shared send path** (`tools/send_service.py:send_message`), so
  every `campaign_type` (`reactivation`, `reputation`, `speed_to_lead`) inherits it with **no
  per-service code** beyond reading `channel_mode` / `fallback_channel`.
- **Build order is driven by external dependencies, not the spec's logical order:**
  - **Email-first** (open a campaign on email) has **no external dependency** → **Slice 1**, ship now.
  - **WhatsApp-undeliverable → email** needs WhatsApp *actually sending* (messaging-provisioning
    Phase 2 + an approved template, Meta lead time) → **Slice 2**, later.
- **Email reuses the existing path** (`tools/email_service.py`, `send_message(channel="email")`) — no
  new sender infra.
- **Do not touch** `ai_conversation.py` / `bump_scheduler.py` / `campaign_launcher.py` (modular
  dispatch). The send path is the only shared edit.

## Phase 0 — schema (shared foundation; parallel schema session owns `shared/schema.ts`)

- **Campaigns:** `channel_mode` (text, default `'whatsapp_then_sms'`) + `fallback_channel` (text,
  default `'email'`). Add to `insertCampaignsSchema` (partial-safe).
- **Migration:** direct `pg` SQL script run with `node --env-file=.env` (db:push has no TTY on the Pi),
  mirroring `migrate-messaging-columns.js`. Backfill existing campaigns to the defaults.

## Slice 1 — email-first / `fallback_channel=email` (NO external deps, ship first)

**a) Channel resolution** — in `send_message` (or a thin policy helper just above it), resolve the
effective channel from `channel_mode` + `fallback_channel`:
- `whatsapp_only` → whatsapp; `whatsapp_then_sms` → whatsapp (fallback decided in Slice 2);
- `sms_first` → **open on `fallback_channel`** (`email` → email, `sms` → sms);
- `sms_only` → the fallback channel directly.
When the resolved channel is `email`, call the existing email send (`channel="email"`,
`tools/email_service.py`) with the lead's `email`.

**b) Content** — an email opener variant (subject + body) in Prompt_Library (`use_case` e.g.
`channel_fallback_email`, or per-service), **en/nl**, short + branded + unsubscribe line; rendered via
the existing personalization helper.

**c) Guard** — the lead must have an `email`. If missing with `fallback_channel=email` and no WhatsApp
path, log + skip (or fall to SMS only if `fallback_channel=sms_then_email`).

**d) Logging** — `AsyncLogStep(<service>, "channel_fallback", accounts_id=, campaigns_id=, leads_id=)`
records the channel chosen, so WA-vs-SMS-vs-email is visible in Automation Logs.

**e) Reply note** — email replies are out-of-thread; v1 treats email as a one-way nudge (a "reply on
WhatsApp" CTA), no inbound email parsing.

**Verification (Slice 1):** a `speed_to_lead` / `reputation` campaign with `channel_mode='sms_first'` +
`fallback_channel='email'` opens on **email within seconds**, with **no Twilio/Meta dependency**,
logged as `channel_fallback`.

## Slice 2 — WhatsApp-undeliverable → email fallback (after WhatsApp sending is live)

**a) Status receiver** — the `/status` webhook the provisioned number's `statusCallback` points at
(messaging-provisioning defaults it to `…/webhooks/sms/status`). An **engine** route (next to the
existing Twilio inbound), signature-verified (`twilio.validateRequest` pattern already in
`server/routes/twilio-voice.ts`). Currently 404s — this slice builds it.

**b) Undeliverable detection** — on `failed`/`undelivered` with "not a WhatsApp user" error codes
within a short window of the WhatsApp send → trigger the fallback via `fallback_channel` (email).

**c) Dedup guard** — claim/dedup so the `campaign_launcher` poll and the fallback never double-send
(`claim_lead_for_first_send`, `check_duplicate_message`); one fallback per attempt.

**d) Optional timeout trigger** (open decision) — WhatsApp `sent` but no `delivered` within N minutes →
fallback.

**Verification (Slice 2):** WhatsApp send to a no-WhatsApp number → status callback → exactly one email
fallback, deduped, logged.

## Files touched (representative)

**Engine:** `tools/send_service.py` (channel-resolution policy), a `/status` receiver route under
`src/webhooks/`, Prompt_Library rows (email opener). **Not touched:** `ai_conversation.py`,
`bump_scheduler.py`, `campaign_launcher.py`. **CRM:** campaign settings expose `channel_mode` +
`fallback_channel` (a select), locale files. **Schema:** `channel_mode` + `fallback_channel` (parallel
session). Engine needs `pm2 restart leadawaker-engine` to load changes (watch:false); CRM auto-reloads.

## Verification (end-to-end)

1. **Schema:** `channel_mode` + `fallback_channel` columns exist; existing campaigns backfilled.
2. **Email-first:** `sms_first` + `fallback_channel=email` opens on email, no external deps, logged.
3. **No-email lead** is handled gracefully (skip/log, optional SMS).
4. **(after WhatsApp live)** undeliverable → exactly one email fallback, deduped.
5. **`whatsapp_only`** never falls back (regression guard).
6. **All services** (`reactivation`, `reputation`, `speed_to_lead`) inherit via the shared send path,
   no per-service change.
