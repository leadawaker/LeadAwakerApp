# Reputation Management — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Database migration
- [x] Ran the `campaign_type` + reputation columns migration via direct `pg` SQL scripts
      (`migrate-campaign-type.js` + `migrate-reputation-columns.js`, `node --env-file=.env`). Columns:
  - `Campaigns`: `campaign_type text DEFAULT 'reactivation'`, `reputation_delay_minutes int`
  - `Leads`: `service_completed_at timestamptz`, `review_request_sent_at timestamptz`
  - `Accounts`: `enable_reputation_management bool DEFAULT false`, `google_review_url text`,
    `reputation_alert_target text`
- [x] Backfilled existing campaigns to `reactivation` (3 campaigns; column default also backfills).

## Prompt Library (OPTIONAL overrides — sensible defaults are baked into the engine)
The engine ships with built-in en/nl/pt (Brazilian PT) defaults in
`src/automations/reputation_prompts.py`, so reputation works out of the box. Create Prompt_Library
rows ONLY to override a default. Loader cascade: campaign → account → global, keyed by `use_case`:
- [ ] (optional) `use_case = reputation_request` — overrides the WhatsApp feedback-ask message.
- [ ] (optional) `use_case = reputation_review_ask` — overrides the "leave a Google review" message (positive path).
- [ ] (optional) `use_case = reputation_classifier` — overrides the satisfaction classifier system prompt.
      Default already routes to a human when uncertain (never guesses "positive").
- [ ] (optional) `use_case = reputation_negative_ack` / `reputation_neutral_ack` — override the reply acks.

## WhatsApp (Meta) — template approval + buttons  → see `whatsapp-templates.md`
- Template **content** (cold opener + the "Yes, connect me" button reply, en/nl) is specified in
  [`whatsapp-templates.md`](./whatsapp-templates.md). Two templates only; only the cold opener needs
  Meta approval (the button reply is in-session).
- **Provisioning + sender registration + template registration is owned by
  `specs/messaging-provisioning/`** (its Phase 2 registers the cold-open template and stores the SID
  on `Campaigns.twilio_first_message_template_sid`). That spec is **not built yet**, and template
  approval is **per client's WhatsApp sender** (same step as reactivation onboarding) — it is NOT a
  one-time global setup.
- [ ] **Build the reputation send-path (buttons) together with messaging-provisioning Phase 2** — it's
      dormant/untestable until a client's Twilio sender + approved templates exist. Needs a new
      `Campaigns.reputation_button_template_sid` field (flagged in `whatsapp-templates.md`).
- [ ] Submit Template A (cold opener) for Meta approval per client sender; create Template B (button
      reply) as a Twilio Content Template in the client's Twilio account.

## Per-account configuration (for each client using the service)
Now configurable in-app via the **Reputation Management panel** on the account detail page (Phase 3).
- [ ] Toggle `enable_reputation_management` on + set `google_review_url` + pick the negative-feedback
      alert target (UI panel) for each client account.
- [ ] Decide the post-service delay (`reputation_delay_minutes`, default ~30) — currently DB-only, no
      UI field yet (set on the campaign row directly).
- [ ] Create the account's `reputation` campaign and mark customers served: via the lead "Mark served"
      action (Phase 2) or a CSV import with a `service_completed_at` column.

## Engine config & restart
- [x] `reputation_interval_seconds` (default 300) added to `src/config.py`. Override in `.env` to tune.
- [x] Restarted `leadawaker-engine` — `reputation_scheduler` job registered + inbound dispatch branch live.

## Phase 1 engine code — BUILT (2026-06-21)
- [x] `src/automations/reputation_scheduler.py` (due-query + feedback ask) + registered in `src/scheduler/jobs.py`.
- [x] `src/automations/reputation_handler.py` (classify → positive review-link / negative alert+handoff / neutral ack).
- [x] `src/automations/reputation_prompts.py` (defaults + Prompt_Library cascade loader).
- [x] Inbound dispatch branch (Step 11.6) in `inbound_handler.py`; account fields in `get_campaign_with_account`;
      reputation events in `tag_engine._TAG_MAP`; `reputation_negative_feedback` notification type.
- [ ] Remaining for production: approved WhatsApp template (below), per-account config (above).

## Phase 2 + 3 — BUILT (2026-06-22)
- [x] Phase 2 (entry path): `POST /api/leads/:id/mark-served` (sets `service_completed_at` SERVER-SIDE
      with `new Date()`), `serviceCompletedAt`/`reviewRequestSentAt` added to leads date-coercion
      (PATCH + CSV import), "Mark served" action + "Served" badge in `LeadDetailView.tsx`, i18n in
      `leads` namespace (en/nl/pt).
- [x] Phase 3 (account UI): `ReputationSettingsPanel.tsx` (enable toggle + Google review URL + manager
      alert-target picker), wired into `AccountDetailView.tsx`, saves via PATCH `/api/accounts/:id`,
      i18n in `accounts` namespace (en/nl/pt). Accounts PATCH already accepts the fields via
      `insertAccountsSchema.partial()`.

## Compliance / policy
- [ ] Document for clients: we invite happy customers to review and catch unhappy ones privately
      first; we do **not** delete or suppress already-posted public reviews (Google policy). Set
      expectations so no client asks us to hide 1-stars.
- [ ] Consider a per-account daily cap on review requests to avoid Google burst-suppression.

## Open decisions to confirm before build
- [ ] Manager alert channel: in-app notification, WhatsApp to owner, email, or all three?
- [ ] One reputation campaign per account, or per-location (multi-location businesses)?
- [ ] v1 service-completed signal: CSV column + manual "mark served" only (recommended), or also a
      booking/POS webhook now?
