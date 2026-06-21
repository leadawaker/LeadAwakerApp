# Closed / Won Pipeline Status

> Part of the [Lead Awaker "Hulk" service set](./strategy.md). Smallest change; unlocks the revenue/ROI story.

## Overview

Add a terminal **"Closed / Won"** stage to the reactivation pipeline so we can report *revenue
realized*, not just *appointments booked*. Today the funnel ends at `Booked` — we can prove "we
booked 30 roofs" but not "X became paying customers worth €Y." For a paid resell model the client ROI
story needs the close.

## Where it fits

This is specifically a **reactivation-lifecycle** concept (`campaign_type = reactivation`). It is
**not** universal: standalone reputation/speed-to-lead clients have their own lifecycles and may never
use it (see the decoupling note in [reputation-management.md](./reputation-management.md) and
[strategy.md](./strategy.md)). So "Closed" is a real stage for reactivation clients and irrelevant for
others — which is why visibility should be **account-gated** (below).

## Pros

- **Tiny change** — most of the wiring already exists (see below).
- Unlocks the revenue/ROI narrative that justifies retainers.
- Optional `closed_won_value` gives real ROI math (Dan's `fwzgSJ_TTcc` leans on exactly this:
  bookings × close rate × AOV).

## Cons / risks

- Touches the **campaigns Overview north-star**, which is currently "Booked." Adding Closed must not
  demote or confuse the Booked metric for managed-service clients.
- Requires a human (or integration) to actually mark the close — data will be incomplete if it's
  manual and nobody updates it.
- Risk of scope-creep into full deal/opportunity management; keep it to one terminal status + optional
  value, not a CRM deal object.

## What needs to be right

1. **Don't disrupt "Booked" as north-star** for managed clients. Gate the Closed column's visibility
   behind an **account-level setting** so:
   - Managed-service accounts keep Booked as the headline metric (unchanged Overview).
   - Full-CRM / rental accounts get the full close pipeline.
2. **Optional revenue field.** `closed_won_value` (+ currency) to power real ROI; nullable so it's not
   mandatory friction.
3. **Server-side timestamps.** Set `closed_won_at` with `new Date()` server-side (Drizzle-Zod
   `z.date()` rejects client ISO strings silently).

## How to build it (integration)

Most of this is **already half-wired** — verified against the current tree:

- **Funnel already defines it**: `client/src/features/campaigns/components/metricsWidgets/PipelineWidget.tsx:18`
  → `{ key: "closed", labelKey: "funnelStages.closed", dbValue: "Closed" }`.
- **Color already defined**: `client/src/lib/avatarUtils.ts:81` → `Closed: "#6E7A5E"` (plus dark-mode
  variants on lines 94/105/118/128). No new palette work.

The actual gaps:
- **Type union** (`client/src/types/models.ts:130-131`) lists `"Qualified" | "Booked"` but **no
  `"Closed"`** — add it.
- **Kanban stages** (`client/src/features/leads/components/LeadsKanban.tsx:82` `PIPELINE_STAGES`,
  with `Qualified`/`Booked` at lines 87-88) — add `"Closed"`, plus an icon in the stage-icon map
  (e.g. a trophy) and its label.
- **Schema** (`shared/schema.ts`): `Leads.Conversion_Status` is free text so it already accepts
  `"Closed"`; add optional `closed_won_at` (timestamp) and `closed_won_value` (numeric) +
  currency. Add the **account-level visibility flag** (e.g. `show_closed_stage` / tied to
  `campaign_type`/tier) on `Accounts`.
- **i18n**: `funnelStages.closed` label across `en` / `nl` / `pt` (Brazilian PT).
- **Server**: lead update already flows through `server/routes/leads.ts` + `server/storage/leads.ts`
  (accepts `Conversion_Status`); add the two new fields to the update path.

## What needs improving / changing

- Add the **account-level "show Closed stage" setting** and have the Overview/north-star logic respect
  it (the one piece of real care — don't change Booked for managed clients).
- Add `closed_won_at` + `closed_won_value` for ROI reporting.
- Decide whether Closed is set **manually** (a kanban move / button) for v1, with integration-driven
  closing later.

## Effort & sequencing

**Smallest of the five.** Mostly enabling already-present wiring + one account setting + two optional
fields. Can ship independently and early; it's also the optional upsell trigger for reputation on
reactivation accounts.

## Open questions

- Default visibility: off for everyone until a client is on a tier that needs it, or on for
  reactivation accounts by default?
- Is `closed_won_value` entered manually, or can we infer it from a campaign's average deal value?
- Manual close (kanban move) for v1 — acceptable, or do we need an integration to mark closes from day
  one?
