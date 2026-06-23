# Channel Fallback / Routing — SMS + Email (cross-cutting) — Requirements

> **Cross-cutting capability**, not a single service. It lives in the shared send path
> (`tools/send_service.py:send_message`, channel-routed), so **every** `campaign_type`
> (`reactivation`, `reputation`, `speed_to_lead`) inherits it. Requested 2026-06-22 to apply to all
> services, not just speed-to-lead. Schema additions noted but **not edited here** (a parallel session
> owns `shared/schema.ts`).

## Context & goal

WhatsApp is the primary channel, but two real cases need a fallback channel (**SMS or email**):

1. **Lead has no WhatsApp / WhatsApp undeliverable** — fall back so the lead is still reached.
2. **WhatsApp template not yet approved** — launch a client **fallback-first** (sub-minute, day one)
   while their WhatsApp cold-open template is still in Meta review, then switch to WhatsApp once
   approved. (Neither SMS nor email needs template approval — see the channel rules below.)

**Why email, not just SMS:** NL is WhatsApp-dominant and **SMS engagement here is low**, but lead-ad /
website-form intakes almost always capture an **email**, and the send path already supports an email
channel (`tools/email_service.py`, DIY SMTP). For the pending-window or no-WhatsApp case, an instant
email may out-engage SMS in NL. So the fallback **target is configurable: SMS, email, or both**.

Goal: a per-campaign **channel policy** plus an automatic **WhatsApp → fallback (SMS/email)** on
undeliverable, shared by all services, so no lead is lost to "no WhatsApp" and no launch is blocked on
template review.

## Channel rules that drive this (why SMS behaves differently)

- **WhatsApp cold first-touch** (business-initiated, outside the 24h session window) **requires an
  approved template** (Meta approves; Twilio only forwards). Free-text only after the lead replies.
- **SMS** has **no per-message template approval** and no 24h-window concept — you can free-text the
  opener. But SMS requires a **registered sender**: US needs A2P 10DLC brand+campaign registration;
  NL/EU needs a real registered number for **two-way** messaging (alphanumeric Sender IDs are
  one-way and can't receive the lead's reply, which the AI conversation needs).
- **Email** has no template/approval and no 24h-window rule (free-text), and needs no sender
  registration — but it needs a **captured email address**, and deliverability/spam (SPF/DKIM on the
  DIY SMTP) matters. Replies come back by email, not into the WhatsApp/SMS thread, so two-way email is
  looser than WhatsApp.
- NL is WhatsApp-dominant, so SMS/email are a **safety net + pre-approval launch path**, not the main
  channel; for NL, **email is often the stronger fallback than SMS**.

## In scope

- A per-campaign **channel mode**: `whatsapp_only` | `whatsapp_then_sms` | `sms_first` | `sms_only`
  (default `whatsapp_then_sms`), **plus a `fallback_channel`** (`sms` | `email` | `sms_then_email`)
  that decides what the fallback / pre-approval leg actually sends. The mode names keep "sms" for
  consistency with the other specs; with `fallback_channel=email`, `whatsapp_then_sms` falls back to
  **email** and `sms_first` opens on **email**.
- **Automatic fallback**: when a WhatsApp send comes back undeliverable / "not a WhatsApp user" within
  a short window, resend the equivalent content via the configured `fallback_channel` (SMS and/or
  email) — once, deduped against the WhatsApp attempt and the launcher poll (no triple-send).
- **SMS-first launch path**: a campaign in `sms_first` opens on SMS and (optionally) moves to WhatsApp
  once a session is open or the template is approved.
- Record the **actual channel used** on the interaction (the schema already has `channel` /
  `from_number` on interactions) so reporting shows WA-vs-SMS per lead/source.
- Provider-agnostic routing: works whether WhatsApp is Twilio-BSP or Meta-Cloud-direct, and whether
  SMS is Twilio or a separate gateway.

## Out of scope

- The **WhatsApp provider decision** is **made: Twilio (BSP) for clients** — one provider for WhatsApp
  + SMS, per-account subaccount creds already modeled, SMS fallback in-provider. Our own number stays
  Meta Cloud direct. (Rationale: Twilio's per-message markup is negligible at current scale; building
  Meta Tech-Provider/Embedded-Signup isn't worth it yet. Revisit 360dialog or Meta-direct only if
  volume makes the markup matter.) This spec stays provider-agnostic regardless.
- Voice / RCS / other channels.
- Per-message cost optimization beyond "don't double-send."

## Functional requirements

1. **Channel policy per campaign.** The send path honors the campaign's channel mode for the opener
   and for bumps. `whatsapp_only` never falls back; `whatsapp_then_sms` falls back on undeliverable.
2. **Undeliverable detection.** Use the provider's delivery signal, not a guess:
   - **Twilio:** message status callback `failed`/`undelivered` with "not a WhatsApp user" error codes.
   - **Meta Cloud:** error codes for recipient-not-on-WhatsApp / re-engagement.
   There is **no reliable pre-send "has WhatsApp?" check** — attempt WhatsApp, fall back on failure.
3. **Fallback content.** The **SMS** variant of the opener is free-text (no template), kept short, with
   the SMS opt-out convention (e.g. "Reply STOP to opt out"). The **email** variant is a short
   plain/branded email (subject + body) from the account's SMTP identity, with an unsubscribe line.
   Both i18n **en / nl only** (pt-BR is dropped from campaigns).
4. **No double / triple send.** A lead that got the WhatsApp attempt and then a fallback (SMS or email)
   must not also be sent by the `campaign_launcher` poll or a retry. Reuse the existing claim/dedup
   guards (`claim_lead_for_first_send`, `check_duplicate_message`); one fallback per attempt — don't
   send both SMS and email unless `fallback_channel=sms_then_email` **and** the SMS also failed.
5. **Reply handling.** WhatsApp and SMS replies flow through the existing `inbound_handler.py` →
   `run_ai_conversation()` (both inbound-capable). **Email replies are looser** — they return to the
   account inbox/SMTP, not the WhatsApp/SMS thread; v1 treats email as a one-way nudge (a "reply on
   WhatsApp" CTA) unless inbound email parsing is added later.
6. **Opt-out / DNC** respected per channel (SMS STOP + existing WhatsApp opt-out).
7. **Logging.** Fallback decisions log to `Automation_Logs` (`workflow_name` of the calling service +
   a `channel_fallback` step) so WA→SMS switches are visible in the Automation Logs page.

## Non-functional requirements

- **No regression:** the default for existing campaigns stays WhatsApp behavior; fallback only
  triggers on a real undeliverable signal. Reactivation/reputation/speed-to-lead logic unchanged
  except for reading the channel mode in the shared send path.
- **Provider-agnostic:** the fallback policy lives **above** the provider in `send_message`'s channel
  routing; switching the WhatsApp or SMS provider underneath must not change the policy.
- **Cost guard:** SMS and WhatsApp are both paid; honor the per-account/per-campaign send cap from the
  speed-to-lead spec so a fallback storm can't run up cost.
- **Timestamps server-side** (`new Date()` / `NOW()`); **i18n** en/nl; **`broadcastToUser`** for any
  alerts.

## Data model changes (summary — NOT edited here; flag for the schema-owning session)

- **Campaigns:** a `channel_mode` field (`whatsapp_only | whatsapp_then_sms | sms_first | sms_only`,
  default `whatsapp_then_sms`) **+ a `fallback_channel`** (`sms | email | sms_then_email`, **default
  `email`** for the NL market — see decisions). Today `Campaigns.channel` is a single static value
  (default `sms`); these replace/layer on it.
- **Email fallback** reuses the existing email send path (`tools/email_service.py`, DIY SMTP) and the
  lead's captured `email`; no new sender infra. Ensure the intake populates the lead's `email`.
- **Twilio chosen → no new credential fields needed.** Per-account Twilio creds are already modeled
  (`twilio_account_sid/auth_token/messaging_service_sid/default_from_number`, schema.ts:44-47); one
  Twilio number per client (in their subaccount) serves both WhatsApp + SMS. (The Meta-direct path
  would have needed new per-account `whatsapp_phone_number_id` / `waba_id` / system-user-token fields —
  avoided.)
- **Interactions** already carry `channel` + `from_number` — reuse for "actual channel sent."

## Acceptance criteria

- A `whatsapp_then_sms` campaign whose lead has no WhatsApp: WhatsApp attempt fails → exactly one SMS
  opener is sent → logged as a `channel_fallback`.
- A `sms_first` campaign opens on SMS within seconds with no template approval needed.
- With `fallback_channel=email`, a no-WhatsApp lead receives exactly one fallback **email** (not SMS),
  logged as a `channel_fallback`.
- A lead is never messaged more than once across WhatsApp + SMS + poll (dedup verified).
- A reply on either channel is handled by `run_ai_conversation()` unchanged.
- `whatsapp_only` campaigns never fall back (regression guard).
- All services (`reactivation`, `reputation`, `speed_to_lead`) inherit the behavior with no per-service
  code change beyond reading `channel_mode` in the shared send path.

## Open decisions (confirm before build)

- [x] **WhatsApp provider — DECIDED: Twilio (BSP) for clients**, both WhatsApp + SMS, one number per
      client in their subaccount. Our own number stays Meta Cloud direct. Revisit 360dialog /
      Meta-direct only at scale (markup is negligible at current volume).
- [x] **SMS provider — DECIDED: Twilio** (same provider/subaccount as WhatsApp).
- [ ] **SMS sender registration:** NL real number for two-way (required); US A2P 10DLC if/when US
      traffic. Who registers, and on whose business identity (ours vs the client's).
- [ ] **Fallback trigger:** on undeliverable status callback only, or also a timeout (WA "sent" but no
      "delivered" within N minutes → SMS)?
- [ ] **Bumps too, or opener only?** Apply the same channel policy to follow-up bumps, or fall back
      only on the first touch?
- [x] **NL default fallback channel — DECIDED: `email`.** NL SMS engagement is low and intakes
      capture an address, so email is the default fallback (reuses the DIY-SMTP path). SMS stays
      available per-campaign via `fallback_channel`. (Reputation's post-service ask can fall back to
      email too — confirm at build.)
