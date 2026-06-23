# Lead Awaker Hulk — Future Strategy

Notes from a strategy discussion (2026-06-21) on positioning Lead Awaker as a GHL alternative,
sparked by reviewing the "Sales Wingman Hulk Edition" (GoHighLevel resell model).

## Context: what GHL's "Hulk" does

GoHighLevel is the agency's white-label CRM + automation backend. The "Sales Wingman Hulk"
is a sales/delivery tool built on top of it:

1. Agency enters a prospect's website URL
2. Tool scans the site (socials, reviews, pixels) and recommends which AI products to pitch
3. Builds 6 customized AI agent demos in seconds (prompts, FAQs, phone number, personality)
4. Agency demos them live on the sales call — "AI sells AI"
5. One-click import installs the chosen agents into the client's GHL sub-account

The 6 AI products sold: Database Reactivation, Speed to Lead, 48-Hour Follow-up, Live Chat,
Reputation Management, Social Media Reply. Voice AI (Google Voice/Gemini) just launched.

GHL itself, when rented/white-labeled to a client, is also a **self-serve CRM**: clients can
manually message leads (no AI), import their own leads, and build their own pipelines/workflows
without any agency setup. That's a separate product tier from the "we install AI for you" service.

## Lead Awaker's current position

Already covers the core reactivation loop, on WhatsApp instead of SMS (higher open rates,
default channel in NL/BR markets):

- Database Reactivation (core feature)
- Bump/follow-up scheduling (`bump_scheduler.py`)
- AI conversation engine with personas (`ai_conversation.py`)
- Buying signal detection (`buying_signal_classifier.py`)
- Campaign manager + CRM
- Subaccount mode (already exists)

Pipeline currently has `Booked`, `Qualified`, `Lost` — no `Closed/Won` status, so there's no
way to report revenue-realized ROI to clients today, only appointments booked.

## Two possible product tiers (not building both now)

1. **Managed AI service** (current model) — Gabriel configures campaigns/bumps, client sees
   booked calls. North star stays "booked." This is the near-term focus.
2. **Platform rental** (GHL SaaS-mode equivalent) — client gets real CRM access: manual
   messaging, manual lead import, full self-serve pipeline including Closed/Won, no onboarding
   needed beyond provisioning the account. **Deferred indefinitely** until there's real demand —
   not a near-term plan. Would require a `Closed/Won` pipeline status to be tied to account
   tier/plan rather than a per-user Leads-page toggle, plus rework of the campaigns overview
   (currently north-star is booked calls, would need to factor in closed-won revenue).

## Near-term plan: build the "Lead Awaker Hulk" product set

Independent of the platform-rental question — these are just new AI automations layered on
the existing managed-service model, reusing the conversation engine, bump scheduler, and
inbound handler already in place.

Suggested build order:
1. **Reputation Management (WhatsApp)** — post-service WhatsApp message asking for feedback;
   positive responses routed to Google review link, negative routed to manager. Highest demo
   impact, smallest lift (reuses existing conversation engine).
2. **Speed to Lead (WhatsApp)** — instant WhatsApp reply when a new lead comes in via
   form/webhook. Builds on `inbound_handler.py`.
3. **Prospecting / demo-builder tool** (Lead Awaker's own "Sales Wingman") — once 2-3 AI
   products exist to demo, build the website-scan-to-instant-demo tool for Gabriel's own
   sales process (closing clients faster), not for client self-use.

Plus a small enabling change, **Closed / Won status**, which can ship independently and early.

The client-facing service set is exactly three: **Reactivation** (existing, done), **Reputation**,
and **Speed-to-Lead**. Follow-up / nurture sequences are **deferred, not a standalone service** —
see [Explicitly deferred](#explicitly-deferred--not-worth-building-yet).

## Per-service plans (detailed)

Each service has its own plan doc (overview, pros/cons, what needs to be right, integration
approach with real file paths, platform gaps, sequencing, open questions):

| # | Service | Doc | Lift |
|---|---------|-----|------|
| 1 | Reputation Management (WhatsApp) | [reputation-management.md](./reputation-management.md) | Small-Med |
| 2 | Speed-to-Lead (WhatsApp) | [speed-to-lead.md](./speed-to-lead.md) | Medium |
| 3 | Demo-Builder / Prospecting tool (sales tool, not a client service) | [demo-builder.md](./demo-builder.md) | Large (build last) |
| — | Closed / Won status (enabler) | [closed-won-status.md](./closed-won-status.md) | Smallest |
| — | Follow-up / Nurture sequences (**deferred** — not a standalone service) | [follow-up-sequences.md](./follow-up-sequences.md) | Parked |

## Cross-cutting: service-type decoupling (important)

The new services are **not all part of the reactivation lifecycle.** A standalone reputation or
speed-to-lead client gives us leads that never travel the reactivation funnel
(New → Contacted → … → Booked → Closed), so a pipeline transition like `Closed` cannot be the
universal trigger. Each service is its **own lifecycle** with its **own entry trigger**:

- `reputation` → trigger on a `service_completed_at` timestamp (import / "mark served" / POS webhook).
- `speed_to_lead` → trigger on inbound lead arrival (webhook), fired inline.
- `reactivation` → the existing cold-database flow; `Conversion_Status` funnel applies here, and
  `Closed/Won` lives here.

Implementation: a **`campaign_type` / `service_type`** column on `Campaigns`, inherited by leads, so
the engine routes to the right automation and the CRM interprets each lead's status in the right
lifecycle. `Conversion_Status` (New → … → Closed) is a *reactivation* lifecycle, **not** a universal
one. Build this alongside service #1.

## Strategic note: distribution > features (Dan, `dqPaERmNFho`)

Dan's strongest strategy point across the videos: in an AI market racing to the bottom on features,
the moat is **distribution** (audience/reach), not the widget. His leverage is 105k emails / 67k SMS
/ a paid community — not a better bot. Implication for us: the demo-builder and our own outreach
matter because they're **distribution levers**, and effort on reach (LinkedIn outreach, audience,
referrals) compounds more than feature-parity with GHL. Position Lead Awaker on WhatsApp-first reach
and outcomes, not on out-featuring GHL.

## Explicitly deferred / not worth building yet

- **Follow-up / nurture sequences as a standalone service** — this is the bump engine, already
  automated and configured via campaign fields. A sequence-builder UI adds no human action, setup
  surface, or client-facing proof metric on the managed-service model, so it does not earn a screen.
  Revisit only in a self-serve / rental tier. Plan parked in
  [follow-up-sequences.md](./follow-up-sequences.md).
- **"Bring your own AI via API"** — letting clients plug in their own AI to the CRM. Adds real
  complexity (auth, rate limiting, prompt injection surface, support burden) for unvalidated
  demand. Revisit only if a specific paying client asks.
- **Voice AI** — GHL's own version just launched and wasn't fully demoed/stable yet either.
- **Platform rental / self-serve CRM tier** — see above.

## Infra notes

- Pi (8GB RAM, current production) is not the bottleneck at current scale — AI inference runs
  on OpenAI's servers, Pi workload is I/O-bound (Express + Postgres + Python orchestration).
- Real risks at scale: single point of failure (no redundancy), Postgres I/O under sustained
  multi-client write load, no formal uptime SLA infrastructure.
- Already in place: Telegram downtime alerts, Postgres backups.
- Planned scaling path: Pi for client 1, Mac mini cluster for clients 2-5+ as revenue justifies it.
