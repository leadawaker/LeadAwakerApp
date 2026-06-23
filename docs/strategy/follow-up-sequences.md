# Follow-up / Nurture Sequences (standalone)

> **DEFERRED — not a standalone service.** Parked plan, kept only for the one load-bearing decision
> ("extend the bump engine, don't fork it"). On the managed-service model this is just the existing
> bump scheduler configured via campaign fields; it adds no human action, setup surface, or
> client-facing proof metric, so it does not earn its own screen. Revisit only in a self-serve /
> rental tier. The active service set is **Reactivation, Reputation, Speed-to-Lead** — see
> [strategy.md](./strategy.md).

## Overview

Expose multi-step, multi-day follow-up cadences as a **standalone, configurable feature** rather than
something bound to a reactivation campaign. GHL analog: the "48-Hour Android" and general nurture
workflows. We already have the hard part — a proven bump engine — so this is mostly about
generalizing and giving it a UI.

WhatsApp angle: same engine, same channel; the difference is that sequences can be triggered by
events other than "cold reactivation send" (e.g., post-event follow-up, document collection chase,
nurture of a not-yet-ready lead).

## Where it fits

`campaign_type = nurture`. Useful across almost every client as glue between the other services
(e.g., a speed-to-lead lead that doesn't book drops into a nurture sequence; a reactivation lead that
goes quiet gets a different cadence). Upsell-friendly.

## Pros

- **Highest reuse of all five** — the bump engine already does delays, stages, templates, stop-on-reply,
  business hours, AI vs template bumps, and voice notes.
- Turns an internal mechanism into a sellable, client-configurable product.
- Low risk: the underlying scheduler is battle-tested in production.

## Cons / risks

- **Over-engineering risk.** Bumps already cover ~80% of this. If we build a heavyweight new
  "sequences" subsystem we duplicate logic and create two code paths that drift.
- A real sequence **builder UI** is the main new surface and is non-trivial to do well.
- Conceptual overlap can confuse: "bumps" vs "sequences" vs "campaigns" needs crisp naming.

## What needs to be right

1. **Extend, don't fork.** Whatever we build must feed the **same** due-query/send path as
   `bump_scheduler.py` (`automation_status`, `next_action_at`, `current_bump_stage`). No second
   sending engine.
2. **Clear separation** between reactivation bumps (tied to a reactivation campaign) and standalone
   nurture sequences (event-triggered), even though they share the runtime.
3. **Per-step conditions** — stop-on-reply, branch on response, max steps — configurable per
   sequence, mapping onto the existing `stop_on_response` / `max_bumps` semantics.

## How to build it (integration)

Two options; **recommend Option A first**, graduate to B only if clients demand true branching.

**Option A — extend the existing model (lean):**
- Treat a "sequence" as a campaign with `campaign_type = nurture` and more bump slots. The existing
  `Campaigns` fields already drive it: `bump_1..4_template`, `bump_1..4_delay_hours`, `max_bumps`,
  `use_ai_bumps`, `stop_on_response`, plus voice-note flags.
- `bump_scheduler.py:run()` already selects active leads where `next_action_at <= NOW()` and sends the
  next stage — no engine change needed for linear cadences.
- New work is mostly **UI**: a clearer multi-step editor over the existing bump fields.

**Option B — first-class sequences (if/when needed):**
- New `Sequences` (definition: ordered steps, each with delay/channel/template/condition) +
  `Lead_Sequence_State` (which step a lead is on) tables in `shared/schema.ts`.
- A thin adapter so `bump_scheduler.py` reads the next step from `Lead_Sequence_State` instead of the
  fixed `bump_N` columns — **same send path, same logging**.
- Enables branching/conditional steps that the fixed bump columns can't express.

**Shared (both options):**
- **Logging**: `AsyncLogStep("followup_sequence", "step_<n>", ...)`; auto-surfaces in Automation Logs.
- **Entry triggers**: a sequence can be started by an event (speed-to-lead no-book, reputation
  neutral, manual enrollment) by setting the lead's `next_action_at` + `campaign_type` — reuse the
  existing enrollment mechanics.

## What needs improving / changing

- A **sequence-builder UI** (the real new surface) — multi-step editor with per-step delay, channel,
  template/AI toggle, and stop/branch conditions. Build over `features/campaigns/components/`.
- A **build-vs-extend decision** recorded up front (recommend A → B).
- Naming/IA cleanup so "bump", "sequence", and "campaign" are unambiguous in the UI and code.
- Event-based enrollment hooks from the other services into sequences.

## Effort & sequencing

**Low engine effort, medium UI effort.** The runtime is already there; value is in productizing and
the builder UI. Build **3rd** — it benefits from speed-to-lead and reputation existing (they become
sequence triggers), and it's lower-risk than the demo-builder.

## Open questions

- Option A (extend bumps) for v1, or jump straight to first-class `Sequences` tables?
- How much branching do clients actually need vs simple linear cadences?
- Should sequences be cross-channel (WhatsApp + email once DIY email lands), or WhatsApp-only first?
- Where do nurture sequences live in the nav — under Campaigns, or their own surface?
