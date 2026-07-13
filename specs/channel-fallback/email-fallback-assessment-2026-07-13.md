# Email Fallback — Deliverability & Product Assessment (2026-07-13)

Assessment of the "Email sender" fallback channel (Accounts → Integrations) and the
underlying DIY SMTP path in the Python engine. Written before LeadAwaker has any live
client. **Decision: turn the email fallback OFF for now; run all campaigns
WhatsApp → SMS → nothing.** Rationale and evidence below.

## TL;DR

The email fallback is real and functionally wired, but it is **not deliverability-safe**
and it **invites replies it cannot receive**. For a business with no clients yet, the risk
(a client's domain getting flagged, or an email landing in a void) outweighs any benefit.
SMS is the safer WhatsApp-fail fallback and is already supported. Email should only come
back once it runs through real sending infrastructure (relay/ESP + warmup + verified DNS),
following the same lessons as the cold-email motion
(`/home/gabriel/business/lead-awaker/outreach/cold-email/`).

## How the fallback fires (context)

- Trigger is a Twilio message-status webhook, **not** a generic "SMS failed."
- An email/SMS fallback goes out **only** when a WhatsApp **first-touch** is undeliverable
  with error code **63003 / 63024** ("recipient is not a WhatsApp user"). Transient/session
  failures are excluded. Bumps never trigger fallback. Must be within 24h.
- Fallback channel is per-campaign (`email` | `sms` | `sms_then_email`). It fires **once**,
  atomically deduped. There is **no email cadence** — strictly one-off.

## Findings

### 1. Override mechanism — separate parallel prompt rows (good)
The email copy is a distinct `Prompt_Library` row keyed on `use_case =
'channel_fallback_email'`, resolved campaign → account → global. Not an IF branch inside the
opener prompt. Editing the email = editing a prompt row. Currently 2 global rows exist
(id 96 EN, id 97 NL); no campaign/account overrides. Absent any row, it falls back to the
in-code default subject/footer + the raw WhatsApp opener text.

### 2. Deliverability — NOT protected (the core problem)
Low volume avoids volume-based spam triggers, but volume is not the gating factor. Three
unmitigated issues:

- **Direct-to-MX from the Raspberry Pi's home IP, port 25.** No SMTP relay is configured
  (`SMTP_HOST` empty), so mail leaves directly from the Pi on a residential/dynamic IP with
  no static IP, no rDNS/PTR control, almost certainly on consumer port-25 blocklists
  (PBL/CBL). This alone means a large share of these emails get rejected or spam-foldered
  regardless of copy quality. **Single biggest risk, completely unaddressed.**
- **Shared-sender DKIM is effectively off** — no DKIM key path configured, so unless the
  client has a fully verified per-account domain, outgoing mail is unsigned.
- **SPF/DMARC DNS is manual per client domain.** Envelope/From alignment logic is correct,
  but alignment buys nothing without the DNS records, which the system neither creates nor
  checks.

Verdict: cannot guarantee a client won't get flagged. The architecture (Pi direct-MX, no
relay, conditional DKIM, manual DNS, no warmup, no throttle) is not deliverability-safe.

### 3. Opt-out — already the desired balance (good)
- Visible body has **only** a soft sentence: "Just reply to this email if you'd prefer not
  to hear from us." No clickable unsubscribe link in the body.
- An invisible one-click `List-Unsubscribe` **header** (RFC 8058, real working endpoint) is
  always added. Not in the body, doesn't reduce visibility, and **should be kept** —
  Gmail/Yahoo require it for deliverability. Surfaces only as the mail client's native
  "Unsubscribe" chip.

### 4. Booking link vs conversation — currently mismatched (bug in disguise)
Live override copy is conversational and ends in a question
("...what's the best way to reach you?"). But there is **zero inbound email handling** —
no IMAP poller, no inbound webhook, no reply parser anywhere in the repo. If a lead replies,
it lands in an inbox and **nothing continues the AI conversation.** The email asks a question
the system cannot hear the answer to; any reply is stranded.

Implication: while email stays one-way, the copy should push a concrete self-serve next step
(a **booking link**), not invite a conversation.

## Decision & rationale

- **Turn email fallback OFF now.** Set all campaigns to WhatsApp → SMS → nothing. SMS is a
  reliable fallback for a not-on-WhatsApp number and touches none of the email-reputation
  landmines.
- **Keep the `List-Unsubscribe` header design** whenever email returns.
- This is deferred, not abandoned. It is too much to carry with zero clients.

## How to turn it off (exact mechanism)

Current state (the reason email can fire): all campaigns are `channel_mode='whatsapp_then_sms'`
/ `fallback_channel='sms_then_email'`. The `sms_then_email` leg is what leaks email (SMS first,
email second if the SMS send is immediately rejected).

Off-switch — one SQL line, no engine restart (value is read fresh per Twilio callback):

```sql
UPDATE p2mxx34fvbf3ll6."Campaigns" SET fallback_channel = 'sms';
```

With `fallback_channel='sms'` the attempt plan is `["sms"]` only — email is unreachable from
every path, and if SMS itself fails, nothing cascades (correctly stops at nothing). SMS send is
a real Twilio `client.messages.create` call, not a stub.

Optional hardening:
- Set the column default so future campaigns inherit it:
  `ALTER TABLE p2mxx34fvbf3ll6."Campaigns" ALTER COLUMN fallback_channel SET DEFAULT 'sms';`
  and match `shared/schema.ts:475`.
- Belt-and-suspenders global guard: `EMAIL_DRY_RUN=true` (needs engine restart). Note: it
  reports the email step as "success" rather than cleanly stopping, so it's secondary to the
  DB change, not a replacement.

There is no `DISABLE_EMAIL` global flag today. The dormant `or "email"` code defaults
(`send_service.py:22`, `channel_fallback.py:241`) only apply when `fallback_channel` is NULL,
which no campaign is — so editing them alone changes nothing.

## Future: full email reactivation via Smartlead (the RIGHT way to do email)

Separate from this fallback. A proper email reactivation campaign run through a warmed
Smartlead/Smartsenders setup would solve every deliverability problem above (real relay,
warmup, SPF/DKIM/DMARC, IP reputation, inbound reply handling + cadence). It reuses the
cold-email playbook almost 1:1, with two advantages: the leads are warm first-party data
(the client's own past enquiries, lower complaint risk), and Smartlead ingests replies so
email can actually open a conversation. Sending identity should be a warmed parallel domain
branded as the *client* (not leadawaker/getleadawaker), matching the client's brand to the
recipient. This is a roadmap feature, a different build from the fallback, not a patch to it.

## If/when email fallback returns — prerequisites

1. Real sending infra: authenticated SMTP **relay or ESP**, never direct-MX from the Pi.
   Reuse the cold-email thinking (Smartlead / Google Workspace / owned domains + warmup).
2. Verified SPF + DKIM + DMARC on the sending domain, checked (mail-tester) before go-live.
3. Decide one-way (booking link) vs two-way (requires building inbound email handling).
4. Warmup + per-domain throttle before any real volume.

## Related

- Cold-email master plan (solves exactly these problems for LeadAwaker's own outreach):
  `/home/gabriel/business/lead-awaker/outreach/cold-email/README.md`
- Original channel-fallback spec: `specs/channel-fallback/requirements.md`
- Engine code: `automations/src/automations/channel_fallback.py`,
  `automations/tools/email_service.py`, `automations/tools/send_service.py`
