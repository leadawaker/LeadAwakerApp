# Speed-to-Lead — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Database migration
- [x] **None required.** The columns this service needs already exist (verified this session):
  - `Campaigns.campaign_type text DEFAULT 'reactivation'` (added by Reputation spec) — just create
    campaigns with `campaign_type = 'speed_to_lead'`.
  - `Leads."Source" text` — already written by the intake adapters (`facebook_lead_ads`, etc.).
  - `Accounts.webhook_secret text` — per-account intake API key, already present and used by
    `get_account_by_api_key`.
  - `Campaigns.twilio_first_message_template_sid text` — Twilio cold-open template, already present.
- [ ] (optional, schema-owning session) If any client runs the **WhatsApp Cloud** channel (not
      Twilio), consider adding a Cloud cold-open `template_name` + `language` field on Campaigns.
      Until then, map the Cloud template name via config/Prompt_Library. **Do not** add it from a docs
      session — a parallel session owns `shared/schema.ts`.

## Connect the client's WhatsApp number  (do this first per client)
- [ ] Speed-to-lead replies must come from the **client's own WhatsApp Business number**, not ours
      (the lead expects the business they contacted to reply). Connect the client's number to Twilio
      and store the creds on their Accounts row: `twilio_account_sid`, `twilio_auth_token`,
      `twilio_default_from_number`, and (optionally) `twilio_messaging_service_sid` (schema.ts:44-47).
      The send path uses these and only falls back to our `settings.*` defaults if unset.
- [ ] Our WhatsApp **Cloud** number (`settings.whatsapp_phone_number_id`) is for our own
      demos/outreach only — do not route client traffic through it.

## WhatsApp (Meta / Twilio) — template approval  ⚠️ the real lead-time item
- [ ] Cold first-touch is **business-initiated** to a number with no open 24h WhatsApp session → it
      **requires an approved WhatsApp template per locale** (en / nl). Free-text only works after the
      lead replies and the 24h window opens. This has Meta review lead time — **submit early**,
      before scheduling any client launch.
  - **Twilio WhatsApp** clients (default): create the template in Twilio (Content Template Builder)
    on the client's sender, get it approved, set its Content SID on
    `Campaigns.twilio_first_message_template_sid`.
  - **WhatsApp Cloud** (our number — demos only): submit the template in **Meta Business Manager**,
    then reference its `template_name` + `language` in the send config.
- [ ] Keep the template body variables aligned with what `_render_first_message` fills (name, etc.),
      so the rendered opener maps cleanly onto the approved template.
- [ ] Example opener bodies (must match the approved template), en + nl:
  - **en:** "Hi {{1}}! Thanks for reaching out via our page — I can help you right here. What's the
    best way to assist you?"
  - **nl:** "Hoi {{1}}! Bedankt voor je aanvraag via onze pagina — ik help je graag hier verder. Wat
    kan ik voor je doen?"

## Per-account configuration (for each client using the service)
- [ ] Ensure the account has a `webhook_secret` (the intake API key). Generate one if missing.
- [ ] Create the account's `speed_to_lead` campaign (`campaign_type = 'speed_to_lead'`, channel =
      `whatsapp`/`whatsapp_cloud`, persona/booking-mode as desired) and set its approved cold-open
      template.
- [ ] Wire the lead source(s) to the intake URL with the account key + campaign id:
  - Facebook/Instagram Lead Ads → `…/api/leads/intake/facebook?key=<secret>&campaign_id=<id>`
    (set the Meta webhook verify token = the account's `webhook_secret`).
  - GoHighLevel / HubSpot → the matching `…/api/leads/intake/{ghl,hubspot}?key=…&campaign_id=…`.
  - Website form / Zapier → `…/api/leads/intake/form?key=…&campaign_id=…` (Phase 2 adapter).
- [ ] Confirm business hours / booking-mode on the campaign (existing fields) suit instant outreach.

## Engine code — TO BUILD (not yet implemented)
- [ ] `src/automations/speed_to_lead.py` — `fire_first_touch` (claim → render → send **template** →
      mark active → log `speed_to_lead`) + `maybe_dispatch` helper.
- [ ] Dispatch branch in `src/api/adapters/{facebook,ghl,hubspot,instagram}.py` (one `maybe_dispatch`
      call + `BackgroundTasks` param each) — fire inline only when `campaign_type='speed_to_lead'`.
- [ ] `src/api/adapters/form.py` — generic form/Zapier adapter (Phase 2), registered in
      `src/main.py`. Reuse `tools/db/lead_intake` primitives; **do not** copy the legal
      `src/webhooks/intake_routes.py`.
- [ ] **Do not modify** `ai_conversation.py`, `bump_scheduler.py`, `campaign_launcher.py`,
      `inbound_handler.py`, or `src/scheduler/jobs.py` (speed-to-lead is event-driven, no poll job).

## Engine config & restart
- [ ] `pm2 restart leadawaker-engine --update-env` after building, so the new module + adapter load
      (engine has `watch:false`; Python edits are NOT live until restart; the Express server
      auto-reloads via pm2 watch).

## Compliance / policy
- [ ] Lead-source consent: paid-ad / form leads must have consented to WhatsApp contact (Meta opt-in).
      Confirm each client's ad form / landing page collects WhatsApp consent before going live.
- [ ] Honor opt-out / DNC on the very first reply (existing handling already applies once the lead is
      in the inbound flow).

## Open decisions to confirm before build
- [ ] **Abuse / cost cap:** the intake URL fires a paid template send on every valid POST. Set a
      per-account/per-campaign daily cap and decide what to do on overflow (queue for the poll vs.
      drop). Protects template cost and Meta quality rating.
- [ ] **Sender number model:** default is the **client's own** WhatsApp number via their Twilio creds.
      Confirm whether any managed/demo client should instead run on our Cloud number (and accept that
      replies then come from "Lead Awaker," not their brand).
- [ ] **Intake architecture (key deviation from the strategy note):** the strategy doc framed
      "generic inbound-lead webhook + per-account mapping + phone dedup + lead_source" as missing, and
      asked for a new `src/webhooks/inbound_lead_routes.py`. They **already exist** in the
      `src/api/adapters/` layer. This plan **extends that layer** and adds only a generic `form.py`
      adapter for the website-form/Zapier case. Confirm this (recommended) vs. building a standalone
      webhook. (The legal `intake_routes.py` is correctly avoided either way.)
- [ ] First lead source for v1: FB/IG Lead Ads (adapter exists) vs. the generic form/Zapier endpoint.
- [ ] Qualify-then-book or book-first — set via the existing campaign booking-mode fields.
- [ ] Who owns getting each client's WhatsApp templates approved (us during onboarding vs. the
      client)? This is the gating lead-time item.
- [ ] WhatsApp Cloud cold-open template field on Campaigns — add now (schema-owning session) or defer
      and map via config until a Cloud-channel client needs it?
