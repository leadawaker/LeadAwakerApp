# Reputation Management + `campaign_type` Foundation — Requirements

> Engine/data spec. UI beyond account settings is intentionally deferred (the Reputation workspace
> screen is being designed separately in Claude Design — see `docs/strategy/claude-design-brief.md`).
> Strategy rationale lives in `docs/strategy/reputation-management.md` and `docs/strategy/strategy.md`.

## Context & goal

Lead Awaker is expanding from a single WhatsApp database-reactivation product into multiple AI
services that an account can enable independently. **Reputation Management** is the first new service:
after a business serves a customer, send a WhatsApp "how did we go?" message; route happy customers to
a Google review link and intercept unhappy ones to a manager before they post publicly.

Building it forces the first cross-cutting platform change: a **`campaign_type` discriminator** so the
engine knows which *lifecycle* a lead is in. Reputation leads are existing customers who never travel
the reactivation funnel (New → … → Booked → Closed), so `Conversion_Status` cannot be the trigger.

This spec covers **Phase 0 (`campaign_type` foundation)** + **the reputation engine and data layer**.

## In scope

- `campaign_type` column on Campaigns (`reactivation | reputation | speed_to_lead`),
  inherited-by-lead semantics, backfill of existing campaigns to `reactivation`.
- A **dispatch branch** in the inbound pipeline that routes reputation-type leads to a dedicated
  handler (not into `ai_conversation.py`).
- A new `reputation_scheduler` job that sends the post-service feedback ask.
- A `reputation_handler` that classifies the reply (positive / negative / neutral) and acts.
- Schema fields for the service-completed trigger, review link, manager target, and enable flag.
- A "service completed" entry path (import column + manual "mark served" action).
- A minimal **account-settings** surface (toggle, review URL, manager target) — the only UI here.

## Out of scope

- The Reputation **workspace screen** (negative-feedback queue UI, funnel, feedback stream) — comes
  from the Claude Design pass, integrated later.
- Speed-to-Lead service.
- Closed/Won status (separate small spec; only the *optional* upsell trigger touches it).
- POS/booking-system webhook for auto service-completed (later; CSV + manual for v1).

## Functional requirements

1. **Lifecycle isolation.** A lead's `campaign_type` (via its campaign) determines its automation
   path. Reactivation leads behave exactly as today (zero behavior change).
2. **Trigger.** A reputation lead with `service_completed_at <= NOW() - delay`, no
   `review_request_sent_at`, not opted out, and within business hours, receives one feedback-ask
   WhatsApp message. `review_request_sent_at` is then set (idempotent — never double-ask).
3. **Reply routing.**
   - Positive → reply with the account's `google_review_url`; tag `review_requested` + `review_sent`.
   - Negative → resolve **privately first** (notify the manager target; mark for human handoff;
     offer to make it right) but **still include the review link** — do NOT withhold it by sentiment.
     Tag `reputation_negative`. *(Revised 2026-06-22: the original "do not send the review link" was
     review gating — prohibited by Google's policy + the FTC review rule. See below.)*
   - Neutral / ambiguous → bias to human; tag `reputation_neutral`. Link optional.
4. **Opt-out / DNC** is respected via the existing handling — a reputation lead can opt out like any other.
5. **Logging.** Every step logs to `Automation_Logs` with `workflow_name = "reputation_scheduler"`
   (send) and `"reputation_handler"` (reply), scoped by account/campaign/lead, so it surfaces in the
   existing Automation Logs page with no UI change.
6. **Account control.** Reputation runs only for accounts with `enable_reputation_management = true`
   and a configured `google_review_url` + manager target.

## Non-functional requirements

- **Google policy compliance (NO review gating):** the public-review path must be available to all
  customers regardless of sentiment. We may *sequence* (resolve unhappy customers privately first) but
  must never *withhold* the review link based on sentiment — selectively soliciting only positive
  reviews is "review gating", prohibited by Google's review policy and the FTC's 2024 review rule.
  Never fabricate or suppress *already-posted* public reviews. Bias sentiment routing toward "human"
  when uncertain (a false "positive" must never be the gate, since the link goes to everyone anyway).
- **i18n / campaign language:** lead-facing campaign messages are **en + nl only** (Brazilian PT
  dropped from campaigns 2026-06-22). App UI i18n remains trilingual.
- **No regression to reactivation:** `ai_conversation.py`, `bump_scheduler.py`, and
  `campaign_launcher.py` are not modified (only a small, well-contained dispatch branch is added
  upstream). See the architecture decision in the implementation plan.
- **Pi-friendly:** scheduler interval ≥ existing bump cadence (5 min); no heavy local compute
  (classification is a Groq/OpenAI call like today).
- **Timestamps server-side:** set `service_completed_at` / `review_request_sent_at` with `new Date()`
  objects — Drizzle-Zod `z.date()` rejects client ISO strings silently.
- **i18n:** the feedback-ask + reply messages are **en + nl** (see the campaign-language note above);
  prompt content lives in Prompt_Library (defaults baked in `reputation_prompts.py`), not hardcoded.
- **Notifications:** manager alerts use `broadcastToUser`, never `broadcast`.

## Data model changes (summary; details in implementation plan)

- **Campaigns:** `campaign_type` (text, default `reactivation`), `reputation_delay_minutes` (int).
- **Leads:** `service_completed_at` (timestamp), `review_request_sent_at` (timestamp).
- **Accounts:** `enable_reputation_management` (bool), `google_review_url` (text),
  `reputation_alert_target` (user id or channel ref).
- **Tags** (dynamic, no schema change): `review_requested`, `review_sent`, `reputation_negative`,
  `reputation_neutral`.

## Acceptance criteria

- A reputation campaign with a served lead sends exactly one feedback ask after the delay, logged.
- A positive reply returns the Google review link and tags the lead; a negative reply does not, tags
  `reputation_negative`, and fires a manager notification to the configured target.
- Reactivation campaigns and leads behave identically to before (verified against a reactivation lead).
- Disabling `enable_reputation_management` stops all reputation sends for that account.
- All steps appear in the Automation Logs page filtered by the new workflow names.
