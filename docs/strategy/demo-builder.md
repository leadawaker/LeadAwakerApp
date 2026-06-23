# Demo-Builder / Prospecting Tool (the "Lead Awaker Hulk")

> Part of the [Lead Awaker "Hulk" service set](./strategy.md). Build order: **last** (most complex, highest strategic upside).

## Overview

A sales tool for **us** (and eventually for clients we sell the platform to): paste a prospect's
website URL → scan it → recommend which AI products to pitch → generate a **live, customized WhatsApp
demo** the prospect can talk to on the call → one-click provision the chosen products into their
account. This is the direct equivalent of GHL's "Sales Wingman / Hulk," which is the centerpiece of
every Dan video (`shOIuCQpZH4`, `ukmmYFcNomY` show the full UX).

The strategic point (Dan's `dqPaERmNFho`, "distribution beats product"): **AI sells AI.** A prospect
who *talks to* a bot trained on their own business in 60 seconds closes far faster than one who hears
a pitch. This tool changes our sales motion, not just our product.

## Where it fits

This is a **prospecting/sales-enablement tool**, not a client-facing service. It only pays off once
we have **2-3 sellable products to demo** (reactivation, reputation, speed-to-lead). Hence: build it
**after** the others exist. It also becomes the front-end for the future platform-rental tier
(provision a subaccount in one click).

## Pros

- Changes the sales motion — "let the AI sell it" — and shortens the path to yes.
- **Major reuse already in place**: the engine has a live WhatsApp **demo-token** path
  (`src/webhooks/whatsapp_cloud_routes.py:124` — `Demo #<16-hex>` claiming, 1-week TTL) plus
  `src/webhooks/demo_commands.py` and `telegram_demo_bot.py`. We are not starting from zero on "live
  demo a prospect can message."
- Strong differentiator vs generic GHL resellers, especially WhatsApp-first in NL/BR.
- Doubles as the provisioning UI for onboarding real clients.

## Cons / risks

- **Most complex of the five** — spans scraping, LLM extraction, multi-product demo generation, and
  subaccount provisioning.
- Scraping reliability varies wildly across sites (JS-heavy, sparse, multilingual).
- Provisioning automation must be solid or it creates support load (half-configured subaccounts).
- Speculative until the product catalog is real — easy to over-invest early.

## What needs to be right

1. **Demo realism + speed.** The generated bot must read as "trained on *their* business" and build
   in seconds, not minutes (Dan's tool builds ~6 demos in under a minute — that's the bar).
2. **Solid provisioning.** One-click install must reliably create the subaccount + campaign + prompts
   from a **template/snapshot** (GHL's "snapshot" concept). This depends on the subaccount model and
   a templating mechanism we'd need to harden.
3. **Catalog-driven recommendation.** The scan→recommendation step must map findings to *our* actual
   product catalog (only recommend what we can deliver).
4. **Don't gate the sales motion on perfection.** v1 can be "scan → recommend → generate ONE WhatsApp
   demo," with multi-product and one-click install added later.

## How to build it (integration)

Phased, reusing existing infra at each step.

**Phase 1 — Website scan + recommendation (new service):**
- A scan service (Python) that fetches the site and extracts business facts (services, hours, phone,
  FAQs) + signals (socials present? reviews? pixel?). **Firecrawl** is the concrete scrape tool Dan
  uses (`VS2z8JhbhOI`) and is a sensible default; LLM extraction via the existing `tools/ai_service.py`
  wrappers.
- A recommender prompt (Prompt_Library `system:product-recommender`) that maps findings → ranked
  products from our catalog.

**Phase 2 — Demo generation (heavy reuse):**
- Generate a customized conversation prompt from the scan (same shape as a campaign prompt) and
  expose it as a **live WhatsApp demo** via the existing **`Demo #<token>`** path
  (`whatsapp_cloud_routes.py` + `demo_commands.py`). The prospect scans/sends and talks to a bot
  trained on their own site. Borrow the **personality slider** idea from Dan's tool (direct ↔
  sales-driven) — maps onto our existing persona/style fields.
- A shareable demo link/QR + a conversation-log view (Dan's tool lets you review the demo chat).

**Phase 3 — One-click provisioning:**
- Turn the chosen products into a real subaccount: create campaign(s) + Prompt_Library entries +
  config from a **snapshot template**. Reuse/extend the existing `createclient` skill/flow as the
  provisioning primitive.
- Maps cleanly onto the future **platform-rental** tier.

**CRM/UI:** a new internal "Prospecting" surface (URL input → scan results → recommended products →
generate demo → install). Logging via `AsyncLogStep("demo_builder", "<step>", ...)`.

## What needs improving / changing

- **Website-scanner service** (Firecrawl + LLM extraction) — net new.
- **Demo-generation pipeline** layered on the existing demo-token infra (extend, not rebuild).
- **Subaccount snapshot/templating** — the biggest dependency; needs a clean "create account from
  template" primitive (overlaps with platform-rental groundwork).
- **A prospecting UI** — net new internal surface.
- A defined, machine-readable **product catalog** the recommender can target.

## Effort & sequencing

**Large.** Build **last**, after reputation + speed-to-lead are real (you need products to
demo) and once the subaccount/templating story is solid. v1 can be deliberately thin: scan →
recommend → single WhatsApp demo, with multi-product + one-click install as fast-follows.

## Open questions

- v1 scope: single-demo generation only, or include one-click provisioning from day one?
- Firecrawl (hosted) vs a self-hosted scraper on the Pi/Mac-mini cluster — cost vs control?
- Internal-only tool first, or eventually expose to clients (ties to platform-rental tier)?
- How much of the `createclient` flow is reusable as the provisioning primitive vs needs rebuilding?
- Tiering analog to Dan's "Lite (demo-only) vs Full (with install)" — relevant only if we ever sell
  the tool itself.

## Future product catalog (surfaced by Dan's videos — noted, not planned)

Candidates the demo-builder could eventually scan-for and offer, beyond our core five:
- **Website live-chat widget** (appears in multiple videos; the original Hulk's "Live Chat Android").
- **Inbound Voice AI** (`ukmmYFcNomY` — high-volume call handling, 100+ calls/day).
- **Social DM/comment replies** with sentiment routing (`VBYdgRrwoAg`; note `instagram_routes.py`
  already exists in the engine).
- **E-commerce cart recovery** (`ukmmYFcNomY`).

These are explicitly **not** in scope now — listed so the catalog/recommender is designed to grow.
