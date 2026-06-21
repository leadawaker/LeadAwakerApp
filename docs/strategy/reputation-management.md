# Reputation Management (WhatsApp)

> Part of the [Lead Awaker "Hulk" service set](./strategy.md). Build order: **1st** (highest demo impact, smallest engine lift).

## Overview

After a business serves a customer, send a WhatsApp message asking how it went. Happy customers
get nudged to leave a Google review; unhappy ones are intercepted and routed to a manager before
they post a public 1-star. GHL analog: the "Reputation Android" in the Sales Wingman Hulk. Two of
Dan's videos (`fwzgSJ_TTcc` True Ninja case, `VS2z8JhbhOI` GHL build) show the exact same loop, which
tells us it's an industry-standard pattern worth copying closely.

WhatsApp angle: 98% open rates vs ~20-30% for the email review requests most tools send. In NL/BR
markets a WhatsApp "how did we do?" feels personal, not spammy.

## Where it fits

Sells as a **standalone service** (a business that just wants more/better Google reviews) **or** as
an upsell to a reactivation client ("we booked you 30 roofs, want us to also protect your rating?").
The standalone case is the important one and drives the architecture below.

Demo value: very high. It's visual, the value is obvious in 10 seconds, and it mirrors what made
Dan's webinar audience light up.

## The decoupling problem (critical — read first)

These services are **not all part of the reactivation lifecycle.** A standalone reputation client
hands us a database of **existing customers who already got service** — they never travel
New → Contacted → … → Booked → Closed, so there is **no "Closed" event to trigger on.**

Therefore reputation must have its **own lifecycle and its own trigger**, independent of
`Conversion_Status`:

- **Standalone client** → leads imported with a `service_completed_at` timestamp (from CSV, their
  booking system, or POS webhook), or marked served via a "mark served" action. Trigger =
  `service_completed_at + delay`.
- **Reactivation upsell** → *optionally* also trigger when a lead hits `Closed` (see
  [closed-won-status.md](./closed-won-status.md)).

This implies a cross-cutting **`campaign_type` / `service_type`** concept (`reactivation |
reputation | speed_to_lead | nurture`) set on the campaign and inherited by its leads, so the engine
knows which lifecycle a lead is in and the CRM interprets its status correctly. The
`Conversion_Status` funnel is a *reactivation* lifecycle, not a universal one. See the cross-cutting
note in [strategy.md](./strategy.md).

## Pros

- Reuses almost the entire existing stack (send path, inbound classifier, logging, prompts).
- Recurring monthly value with near-zero marginal cost per review request.
- Standalone offer → sellable to businesses that have no old-lead database (the gap Dan calls out:
  "sometimes prospects don't have a database").
- Strong, fast demo.

## Cons / risks

- **Google review-gating compliance** (see below) — the biggest risk, not technical.
- Needs a clean "service completed" signal, which most small clients won't have in a structured
  form → onboarding friction (CSV with a service-date column, or a manual "mark served" action).
- Manager-routing requires somewhere to send the alert (a real human/channel per account).
- Review velocity caps: Google can suppress reviews that arrive in unnatural bursts.

## What needs to be right

1. **Google policy compliance.** We may ask for feedback and *invite* satisfied customers to review,
   and we may catch dissatisfaction privately first. We must **not** fabricate reviews or selectively
   suppress *already-posted* public reviews ("review gating" of published content violates Google
   policy). Framing = "intercept feedback before it becomes a review," never "hide bad reviews."
   Document this clearly for clients so they don't expect us to delete 1-stars.
2. **Opt-out respect** — reuse the existing DNC / opt-out keyword handling in `inbound_handler.py`.
3. **Timing** — configurable delay after service (Dan uses ~30 min); too soon feels robotic, too
   late and they've forgotten.
4. **Sentiment routing accuracy** — a false "positive" that sends an angry customer to Google is the
   worst outcome. Bias the threshold toward routing to a human when uncertain.

## How to build it (integration)

Reuse, don't rebuild. All paths verified against the current tree.

**Engine (`/home/gabriel/automations/`):**

- **New scheduled job** `reputation_scheduler` in `src/scheduler/jobs.py` (`register_jobs()` at line 23,
  same `scheduler.add_job(run, IntervalTrigger(...))` pattern as the existing jobs). Module:
  `src/automations/reputation_scheduler.py` with `async def run()`.
- **Due-query** mirrors `bump_scheduler.py`: select reputation-type leads where
  `service_completed_at <= NOW() - delay` AND no review-request sent yet AND not opted out.
- **Send** the feedback ask via the existing `send_message(channel="whatsapp_cloud", body, phone=...)`
  (`tools/send_service.py` → `tools/whatsapp_cloud.py:send_text_message`).
- **Reply handling** reuses `inbound_handler.py`: the inbound message already runs through the
  **two-stage classifier (regex + Groq)**. Add a "satisfaction" classification branch (positive /
  negative / neutral) alongside the existing buying-signal path.
  - **Positive** → reply with the Google review link (per-account `google_review_url`), tag
    `review_requested` / `review_sent`.
  - **Negative** → do **not** send the review link; apply a `reputation_negative` tag, fire a
    manager notification, and trigger handoff (reuse the existing `handoff_detector` + notification
    path; notifications must use `broadcastToUser`, never `broadcast`).
- **Prompt**: new Prompt_Library entry `system:reputation-request` (loaded via
  `get_prompt_for_campaign()` cascade in `tools/db/prompts.py`).
- **Logging**: wrap each step in `AsyncLogStep("reputation_scheduler", "<step>", accounts_id=,
  campaigns_id=, leads_id=, workflow_execution_id=)`. The CRM Automation Logs page auto-surfaces the
  new `workflow_name` with no UI change.

**CRM (`/home/gabriel/LeadAwakerApp/`):**

- **Schema** (`shared/schema.ts`): add `service_completed_at` (timestamp) + `review_request_sent_at`
  to `Leads`; add `google_review_url`, `enable_reputation_management` (bool), and a manager-notify
  target (user id or channel) to `Accounts`. Set timestamps server-side with `new Date()` (Drizzle-Zod
  `z.date()` rejects ISO strings silently).
- **Account settings UI**: small panel following `features/accounts/components/KnowledgeBasePanel.tsx`
  (toggle + review URL + manager target) → PATCH `/api/accounts/:id`.
- **Campaign config**: add `campaign_type` and the post-service delay via the standard field pattern
  (`insertCampaignsSchema` → Edit* in `features/campaigns/components/formFields/` → `InfoRow` in a
  `settings/*SectionFields.tsx`).

## What needs improving / changing

- Introduce the **`campaign_type` / `service_type`** column + lifecycle routing (cross-cutting; see
  strategy.md). This is the real platform change reputation forces.
- Add a **"service completed" entry path**: a `service_completed_at` column on import + a manual
  "mark served" action, and (later) a POS/booking webhook.
- Add a **manager-notify target** on accounts and wire negative-feedback alerts to it.
- Classifier: extend the two-stage classifier with a satisfaction branch.

## Effort & sequencing

**Small-to-medium.** ~80% reuse. The new surface is one scheduler job, one classifier branch, a
prompt, ~4 schema fields, and a small account panel. Build **first** — best effort-to-impact ratio
and it forces the `campaign_type` decoupling that the other detached services also need.

## Open questions

- Service-completed signal for v1: CSV column + manual "mark served" only, or also a webhook?
- Manager alert channel: in-app notification, WhatsApp to the owner, email, or all three?
- Do we cap review-request volume per day per account to avoid Google burst-suppression?
- One reputation campaign per account, or per-location (Dan's True Ninja runs multiple locations)?
