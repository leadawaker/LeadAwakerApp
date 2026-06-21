# Speed-to-Lead (WhatsApp)

> Part of the [Lead Awaker "Hulk" service set](./strategy.md). Build order: **2nd**.

## Overview

When a new lead comes in (Facebook/Instagram lead ad, website form, landing page), reply on WhatsApp
**within seconds** to book or qualify them while intent is hot. GHL analog: the "Speed-to-Lead
Android." Industry stat Dan leans on: contacting a lead in the first 5 minutes vs an hour later is a
large multiple on conversion.

WhatsApp angle: instant WhatsApp beats the SMS/email autoresponders most businesses use, and a
two-way AI conversation (not a one-shot autoreply) actually qualifies and books.

## Where it fits

Standalone service (a business running ads that bleeds leads to slow follow-up) **or** an upsell.
Like reputation, this is its **own lifecycle** (`campaign_type = speed_to_lead`) — these are fresh
inbound leads, not an imported reactivation database, so they enter at "new inbound," not the
reactivation funnel's cold start. See the cross-cutting note in [strategy.md](./strategy.md).

## Pros

- Reuses the conversation engine, send path, debounce, typing-delay, and booking-link generation
  wholesale.
- Clear, measurable ROI ("response time went from 4 hours to 20 seconds; bookings up X%").
- Natural pairing with clients already running paid ads (higher budgets, stickier retainers).

## Cons / risks

- Requires **inbound lead-source integrations** (FB Lead Ads webhook, website form posts, Zapier) —
  more moving parts and per-client setup than the reactivation flow.
- **WhatsApp template requirement** (see below) is a real constraint for cold first-touch.
- Volume is bursty and unpredictable; the fast path must not be gated behind the 60s poll.
- Lead-source data quality (bad numbers, spam form fills) hits this harder than curated reactivation DBs.

## What needs to be right

1. **Latency.** The first message must fire **on lead arrival**, not on the next
   `campaign_launcher` poll. Today `campaign_launcher.py` runs every 60s — acceptable for
   reactivation, too slow to claim "speed to lead." The intake webhook must dispatch the first send
   **inline** (as a background task), bypassing the poll.
2. **WhatsApp 24h session / template rule.** Business-initiated first contact to a number we have no
   open session with **requires an approved WhatsApp template** — we cannot send free-text cold. The
   engine already has template plumbing (`Campaigns.twilio_first_message_template_sid`,
   WhatsApp Cloud template send); speed-to-lead must use the template path for the opener, then drop
   into free-text once the lead replies (opens the 24h window).
3. **Routing.** Each inbound lead must map to the correct account + campaign + persona. A
   per-account "inbound campaign" mapping is the cleanest model.
4. **Dedup.** Same lead submitting twice (or arriving from two sources) must not get double-messaged
   — dedup on phone, reuse the existing duplicate-message guard pattern from `inbound_handler.py`.

## How to build it (integration)

**Engine (`/home/gabriel/automations/`):**

- **New webhook** `src/webhooks/inbound_lead_routes.py` (FastAPI `APIRouter`, same shape as the
  existing webhook routers). Note: `src/webhooks/intake_routes.py` already exists but is
  **legal-demo-specific** (hardcoded `_LEGAL_CAMPAIGN_ID = 59`, a mock intake form) — it's a good
  **pattern to copy** (router + `AsyncLogStep` + `send_text_message` + `get_campaign_with_account`),
  not a thing to reuse directly. Use a distinct name to avoid confusion.
- Endpoint accepts a normalized lead payload (name, phone, source, campaign mapping key), with
  per-source adapters (FB Lead Ads, generic form, Zapier). Verify signature/secret per source.
- **Flow**: validate → dedup on phone → create the lead (`campaign_type = speed_to_lead`,
  `lead_source` set, `automation_status` short-circuited to send) → **fire the first message inline**
  as a `background_tasks` task reusing `campaign_launcher.py:_render_first_message` + `send_message`
  (template channel for cold open) → return 200 immediately.
- Subsequent replies flow through the **existing** `inbound_handler.py` → `run_ai_conversation()`
  unchanged (debounce, typing delay, booking link, qualification all already there).
- **Logging**: `AsyncLogStep("speed_to_lead", "<step>", accounts_id=, campaigns_id=, leads_id=, ...)`;
  auto-surfaces in the Automation Logs page.

**CRM (`/home/gabriel/LeadAwakerApp/`):**

- **Schema** (`shared/schema.ts`): add `lead_source` (text) and ensure `campaign_type` exists on
  `Campaigns` (shared with the other services). Optionally a per-account intake mapping table or a
  `inbound_campaign_id` field on `Accounts`.
- **UI**: surface lead source on the lead card/detail (small) and an "inbound campaign" selector in
  campaign/account settings (standard field pattern). The webhook URL + per-source setup is an
  account-settings/onboarding surface.

## What needs improving / changing

- **Generic inbound-lead webhook** + per-account source→campaign mapping (the main new surface).
- **Template-message path for cold first-touch** must be first-class (approved templates per
  account/locale), not an afterthought.
- **`lead_source`** field + reporting so clients can see which ad/source converts.
- Inline-dispatch path so speed-to-lead bypasses the 60s poll without disrupting reactivation's
  rate-limited launcher.

## Effort & sequencing

**Medium.** The conversation half is fully reused; the new work is the inbound webhook, source
adapters, the mapping config, and getting WhatsApp templates approved per account. Build **2nd**,
after reputation establishes the `campaign_type` decoupling.

## Open questions

- Which lead sources for v1 — FB/IG Lead Ads first, or a generic form/Zapier webhook first?
- Where does the source→campaign mapping live: a new table, or a field on Accounts?
- Per-account WhatsApp templates: who owns getting them approved (us during onboarding vs client)?
- Do we qualify-then-book, or book-first? (Likely campaign-configurable via existing booking-mode
  fields.)
