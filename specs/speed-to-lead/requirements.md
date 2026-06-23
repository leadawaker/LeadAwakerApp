# Speed-to-Lead (`campaign_type='speed_to_lead'`) — Requirements

> Engine/data spec. UI beyond account settings is intentionally deferred (a Speed-to-Lead
> workspace screen, if any, is designed separately in Claude Design). Strategy rationale lives in
> `docs/strategy/speed-to-lead.md` and `docs/strategy/strategy.md`. This is the **2nd** Hulk service,
> built after Reputation established the `campaign_type` decoupling.

## Context & goal

When a new lead arrives from a paid-ads / form source (Facebook/Instagram Lead Ads, website form,
Zapier), reply on WhatsApp **within seconds** to book or qualify them while intent is hot. The win is
**sub-minute latency**: industry data says contacting a lead in the first 5 minutes vs an hour later
is a large multiple on conversion. Instant WhatsApp beats the SMS/email autoresponders most
businesses use, and a two-way AI conversation (not a one-shot autoreply) actually qualifies and books.

Speed-to-Lead is its **own lifecycle** (`campaign_type = 'speed_to_lead'`): these are fresh inbound
leads, not an imported reactivation database, so they enter at "new inbound," not the reactivation
funnel's cold start. `Conversion_Status` (New → … → Booked → Closed) is a *reactivation* lifecycle and
does not gate this service. See the cross-cutting note in `docs/strategy/strategy.md`.

## What already exists (verified against the tree — read before assuming gaps)

The strategy doc lists "generic inbound-lead webhook, per-account intake mapping, phone-based dedup,
`lead_source` field" as platform gaps. **Most of these are already built.** Verified this session:

- **Generic per-account intake layer** — `src/api/adapters/{facebook,ghl,hubspot,instagram}.py`
  (engine), all mounted under the FastAPI router prefix `/api/leads/intake`. Each:
  - authenticates per-account via `get_account_by_api_key(key)` against `Accounts.webhook_secret`
    (schema.ts:52, `webhookSecret`),
  - maps to a campaign via a `campaign_id` query param + `validate_campaign_ownership(campaign_id,
    account_id)`,
  - **dedups on phone** via `check_duplicate_phone(phone, account_id)`,
  - normalizes to E.164 (`_normalize_phone`),
  - inserts via `insert_intake_lead(... source=..., campaign_id=...)`,
  - logs via `AsyncLogStep("lead_intake", "...", accounts_id=, campaigns_id=, leads_id=)`.
- **`lead_source` is already a column** — `Leads.source` → `text("Source")` (schema.ts:550); the
  adapters already write it (`source="facebook_lead_ads"`, `"gohighlevel"`, `"hubspot"`,
  `"instagram_dm"`).
- **`campaign_type`** already exists on Campaigns (`campaignType`, default `'reactivation'`,
  schema.ts:352), added by the Reputation spec.
- **Cold-template send path already exists** — `tools/whatsapp_cloud.py:send_template_message(phone,
  template_name, language, ...)` and `tools/send_service.py:send_message(... whatsapp_template_sid=,
  whatsapp_template_variables=)`; campaigns already carry `twilioFirstMessageTemplateSid`
  (schema.ts:440) for the Twilio WhatsApp channel.
- **First-message render** — `campaign_launcher.py:_render_first_message(...)` + `send_message(...)`
  already render+send the opener; today they are driven by the launcher's ~60s poll picking up
  `automation_status='queued'`.
- **Per-account sender identity already exists** — `Accounts.twilio_account_sid` /
  `twilio_auth_token` / `twilio_messaging_service_sid` / `twilio_default_from_number`
  (schema.ts:44-47) carry each client's own Twilio credentials + WhatsApp Business number;
  `send_message` / `send_whatsapp_template` pass them through (falling back to our `settings.*`
  defaults only when unset). **A client's speed-to-lead replies are sent from the client's own
  WhatsApp number, not ours** — the lead must see the business they contacted reply, which is the
  whole value prop. Our WhatsApp Cloud number (`settings.whatsapp_phone_number_id`) is for our own
  outreach/demos, not client traffic.

**The legal `src/webhooks/intake_routes.py` is NOT the precedent to copy** — it is hardcoded to one
demo (`_LEGAL_CAMPAIGN_ID = 59`, a mock intake form). The `src/api/adapters/` layer is the real
generic, per-account, deduped intake precedent and is what this service extends.

## The genuine gap

1. **Latency.** The intake adapters set `automation_status='queued'` (see `insert_intake_lead`:
   `automation_status = "queued" if campaign_id is not None else "paused"`) and then **rely on
   `campaign_launcher.py`'s ~60s poll** to fire the first message. A ≤60s wait defeats "speed to
   lead." The first WhatsApp must fire **inline on intake**, bypassing the poll.
2. **Cold template for first-touch.** The launcher's opener uses free-text `send_message`. A
   business-initiated first contact to a number with no open 24h WhatsApp session **requires an
   approved template** (Meta) — so the speed-to-lead inline opener must use the **template path**,
   then drop into free-text once the lead replies (which opens the 24h window).
3. **Generic form / Zapier source.** The adapters cover FB/GHL/HubSpot/IG specifically; a truly
   generic normalized-form/Zapier endpoint is still missing for clients on a plain website form.

**SMS fallback + channel policy is cross-cutting**, not speed-to-lead-specific — it is specced once in
[`specs/channel-fallback/requirements.md`](../channel-fallback/requirements.md) and inherited by all
services. Speed-to-lead benefits two ways: reach a no-WhatsApp lead via SMS, and launch **SMS-first**
(sub-minute, no template approval) while the WhatsApp cold-open template is still in Meta review. The
**WhatsApp provider is Twilio** (BSP) for clients — one Twilio number per client (in their subaccount)
serves both WhatsApp + SMS; our own number stays Meta Cloud direct. See `specs/channel-fallback/`.

## In scope

- A **shared inline first-touch dispatch** (`speed_to_lead` module) that, for a `speed_to_lead`
  campaign, renders + sends the opener **immediately** (FastAPI `BackgroundTasks`) via the **template
  channel**, reusing `_render_first_message` + `send_message`, and claims the lead so the poll cannot
  also send it (double-send guard).
- A **small dispatch branch** added to the existing intake adapters: after `insert_intake_lead`, if
  the mapped campaign is `campaign_type='speed_to_lead'`, schedule the inline first-touch and return
  200; otherwise behave exactly as today (queue for the poll).
- A **new generic form / Zapier adapter** (`src/api/adapters/form.py`, the strategy doc's
  `inbound_lead_routes.py`) under the same `/api/leads/intake` prefix, reusing the existing
  `lead_intake` primitives (auth, campaign validation, E.164, dedup, insert) — pattern-copied from the
  source adapters, **not** from the legal `intake_routes.py`.
- Account-settings surface: the per-account webhook URL + secret + inbound-campaign mapping, and the
  per-locale cold-open template reference (the only UI here).

## Out of scope

- Any Speed-to-Lead **workspace screen** (source-attribution dashboard, inbound feed) — comes later
  from the Claude Design pass, if at all.
- Changes to `ai_conversation.py`, `bump_scheduler.py`, `campaign_launcher.py` (untouched — see
  the architecture decision in the implementation plan).
- Reputation and Reactivation services (separate specs).
- Closed/Won status (separate small spec).
- Graph-API hydration for FB leads whose webhook payload omits `field_data` (the FB adapter already
  flags this case; a full Graph follow-up is a later enhancement).

## Functional requirements

1. **Lifecycle isolation.** A lead's `campaign_type` (via its campaign) determines its path.
   Reactivation and Reputation leads behave exactly as today (zero behavior change). Only
   `speed_to_lead` campaigns trigger the inline first-touch.
2. **Sub-minute first touch.** When an intake creates a lead on a `speed_to_lead` campaign, the first
   WhatsApp is dispatched **inline as a background task** on the same request, not on the next poll.
   Target: first send initiated within a few seconds of intake.
3. **Cold-template opener.** The inline first-touch sends via the approved WhatsApp template for the
   campaign's channel and the lead's locale (Twilio `twilio_first_message_template_sid`, or WhatsApp
   Cloud `template_name` + `language`). Free-text is used only after the lead replies.
4. **No double-send.** The inline path **claims** the lead atomically (reuse
   `claim_lead_for_first_send(lead_id)` from `tools/db/leads.py`) so the `campaign_launcher` poll
   cannot also fire the opener. If the claim fails (poll already took it), the inline task no-ops.
5. **Routing.** Each inbound lead maps to the correct account (`webhook_secret`) + campaign
   (`campaign_id`) + persona (campaign's existing persona/agent fields). Reuse
   `validate_campaign_ownership`. A speed-to-lead intake **must** carry a `campaign_id` — it is the
   only way to know the campaign is `speed_to_lead`. An unmapped intake falls back to today's
   `automation_status='paused'` behavior with no inline send (a human picks it up).
6. **Dedup.** Same phone arriving twice (resubmission or two sources) is deduped via the existing
   `check_duplicate_phone(phone, account_id)` — no double-message.
7. **Conversation handoff.** After the opener, the lead's replies flow through the **existing**
   `inbound_handler.py` → default path → `run_ai_conversation()` **unchanged** (debounce, typing
   delay, qualification, booking link all already there). Unlike Reputation, speed-to-lead needs **no
   inbound dispatch branch** — normal AI conversation is exactly the desired behavior once the lead
   replies.
8. **Source attribution.** Each lead records its `Source` (already supported); speed-to-lead intakes
   set a meaningful value (`facebook_lead_ads`, `instagram_dm`, `website_form`, `zapier:<name>`, …)
   so clients can see which source converts.
9. **Logging.** Every inline step logs to `Automation_Logs` with `workflow_name = "speed_to_lead"`,
   scoped by account/campaign/lead, surfacing in the existing Automation Logs page with no UI change.
10. **Account control.** The inline path runs only when the campaign is `speed_to_lead` and the
    account has a valid `webhook_secret` and an approved cold-open template configured for the channel.

## Non-functional requirements

- **No regression to reactivation/reputation.** `ai_conversation.py`, `bump_scheduler.py`, and
  `campaign_launcher.py` are not modified. The only edits to existing engine code are a small dispatch
  branch in the intake adapters and the new generic adapter + dispatch module.
- **Burst-safe.** Lead volume is bursty; the inline task must be fire-and-forget (`BackgroundTasks`)
  so the webhook returns 200 immediately and Meta/FB does not retry on slow responses. Reuse the
  existing per-account rate limiting in the send path; do not gate the first touch behind the
  rate-limited launcher poll.
- **Abuse / cost guard.** The intake URL fires a **paid template send** on every valid POST. A
  buggy or hostile source (spam form fills, a misconfigured Zapier loop) could burn template cost
  and tank the account's Meta quality rating. Enforce a per-account/per-campaign send cap and drop
  obviously-bad payloads (no/invalid phone) before sending. See the open decision in
  `action-required.md`.
- **WhatsApp 24h / template policy.** Cold first-touch outside an open 24h session **must** use an
  approved template; never attempt free-text cold (it silently fails / is rejected by Meta).
- **Timestamps server-side.** Set `first_message_sent_at` / status with `new Date()` / `NOW()` —
  Drizzle-Zod `z.date()` rejects client ISO strings silently.
- **i18n:** any user-facing opener content goes through i18n / Prompt_Library. **Campaign content is
  en / nl only** (pt-BR is dropped from campaigns), so approved templates and prompts exist for
  **en and nl**. Never hardcoded.
- **Pi-friendly:** no heavy local compute; AI/classification stays on the existing remote provider.

## Data model changes (summary; details in implementation plan)

**Mostly none — the schema is already in place.** Confirmed present:

- `Campaigns.campaignType` (`campaign_type`, default `'reactivation'`) — exists (schema.ts:352).
- `Leads.source` (`Source`) — exists (schema.ts:550); reused as `lead_source`.
- `Accounts.webhookSecret` (`webhook_secret`) — exists (schema.ts:52); per-account intake auth.
- `Campaigns.twilioFirstMessageTemplateSid` — exists (schema.ts:440); Twilio cold-open template.

Possible **additions a future session may want** (flagged for the schema-owning session — **not edited
here**): a WhatsApp Cloud cold-open `template_name` + `language` per campaign/locale (if a client is
on the Cloud channel rather than Twilio), since `twilioFirstMessageTemplateSid` only covers Twilio.
Until then, Cloud-channel clients can map the template name via Prompt_Library / config.

## Acceptance criteria

- A `speed_to_lead` campaign receiving an intake POST creates the lead and **fires the first WhatsApp
  inline** (Automation Logs `speed_to_lead`), with the send initiated within seconds — not on the
  next ~60s poll.
- The opener is sent via the **approved template** (verified: free-text cold send is never attempted).
- A duplicate phone on the same account does **not** create a second lead or a second message.
- The `campaign_launcher` poll does **not** also send the opener for an inline-handled lead
  (claim guard verified).
- After the lead replies, the conversation is handled by `run_ai_conversation()` exactly as a normal
  inbound (qualification/booking unchanged).
- Reactivation and Reputation campaigns behave identically to before (verified against one of each).
- The generic form/Zapier endpoint creates a deduped lead with the right `Source` and (for a
  `speed_to_lead` campaign) the same inline first-touch.
- All steps appear in the Automation Logs page filtered by `workflow_name = "speed_to_lead"`.
