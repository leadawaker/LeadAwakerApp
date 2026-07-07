# WhatsApp Quality & Tier Visibility — Requirements

> **Depends on `specs/messaging-provisioning/` Phase 2** (WhatsApp sender registration — not yet
> built). This spec is inert until at least one `Accounts.whatsapp_sender_sid` is populated by a real
> client onboarding. It also resolves the open decision flagged in that spec's `action-required.md`
> ("Status sync: poll Twilio for WhatsApp sender status vs wire Twilio's status webhook") — the
> answer is **poll**, because Twilio exposes no webhook for quality-rating changes at all, only
> message-delivery-status webhooks. This spec's poller can be extended to also carry Phase 2's
> approval-status sync if that lands first; they'd hit the same account loop.

## Context & goal

Raised while reviewing whether our self-imposed `DEFAULT_DAILY_LIMIT = 500` (`server/config.ts`,
`campaign_launcher.py`) is too conservative. Research confirmed Meta's real messaging-tier ladder:
**250** (unverified) → **2,000** (Business Verified) → 10K → 100K → Unlimited, upgrades gated on
quality rating (Green/Yellow/Red, rolling ~7-day block/report/mute/archive rate) **and** using ≥50%
of the current limit within a rolling 7 days, re-evaluated roughly every 6 hours by Meta. Twilio's
Senders API exposes `quality_rating` and `messaging_limit` directly per number — there is no push
notification for either value, so seeing them requires a poller.

Goal: track quality rating + messaging limit per account automatically, alert on any downgrade, and
surface the current value on the Campaigns page so daily-limit decisions (and "are we in trouble"
questions) are grounded in real tier data instead of a guess — all built so it costs nothing while
inert (no client number provisioned yet) and lights up the moment one exists.

## What already exists (verified against the tree)

- `Accounts.whatsapp_sender_sid` (`shared/schema.ts:87`) — written once messaging-provisioning
  Phase 2 registers a WhatsApp sender. **Currently null for every account** — no client campaign is
  live yet; LeadAwaker's own demo campaigns (60, 61) use the Meta Business API directly, not a Twilio
  sender SID, so they will never populate this field either.
- `Accounts.whatsapp_sender_status` (`none|pending|approved|rejected`, `schema.ts:86`) — tracks Meta
  **approval**, a one-time transition. Quality rating is a different, ongoing, can-flip-back-and-forth
  signal — a separate pair of columns, not a repurposing of this one.
- `tools/twilio_service.py:_get_client()` — cached per-account Twilio client builder (`account_sid` +
  `auth_token` in, `TwilioClient` out). Reusable for the poller.
- `src/scheduler/jobs.py` — `register_jobs()` / `AsyncIOScheduler`, `IntervalTrigger` jobs logged via
  `AsyncLogStep` (`src/automations/automation_logger.py`). 11 jobs already follow this exact pattern.
- `tools/notification_service.notify()` + the owner-lookup join used in
  `src/automations/nightly_summary.py:192-209` (`SELECT u.id FROM Users u JOIN Accounts a ON
  a.owner_email = u.email WHERE a.id = $1`) — the existing mechanism for turning an account-level
  event into a notification for the right human. This is the pattern to reuse for a quality-drop
  alert; there is no dedicated "notify all admins of account X" helper today.
- `client/src/features/campaigns/hooks/useCampaignsData.ts:31-51` — `Campaign.account_name` /
  `account_logo_url` are **not** flattened server-side; they're merged client-side after a separate
  `fetchAccounts()` call. `server/storage/accounts.ts:165-168`'s `getAccounts()` selects
  `getTableColumns(accounts)` minus `voiceFileData` — a **deny-list**, not an allow-list — so any new
  `Accounts` columns flow through to `fetchAccounts()` automatically, no storage/route change needed.
- `client/src/features/campaigns/components/detailView/DetailViewHeader.tsx:334-347` — the meta-chip
  row (Channel, **Daily Limit**, Active Hours, Type, Started, Owner) via `renderMetaChip()`. This is
  the existing UI slot for glanceable per-campaign/account stats; Daily Limit already lives here
  (`dailyStats.sentToday / dailyStats.dailyLimit`, lines 337-340).
- `MetricSummaryRow.tsx` — a **different** data source (`CampaignMetricsHistory` daily-aggregate
  rows: leads, responses, bookings, cost, ROI). Quality rating does not belong here; it's a live
  per-number Twilio signal, not a marketing-performance metric.
- **SDK gap confirmed**: installed `twilio` (Python) is `9.4.3`. Its `rest/messaging/` tree has only a
  `v1` folder — no typed wrapper for the newer `v2/Channels/Senders/{Sid}` endpoint that returns
  `quality_rating` / `messaging_limit`. The SDK's `Client` does expose a generic low-level
  `.request(method, uri)` escape hatch (`twilio/http/http_client.py`), which is how the poller must
  call this endpoint — no dependency bump required.

## In scope

- New scheduler job (engine side) that, for every `Accounts` row with a non-null
  `whatsapp_sender_sid`, calls Twilio's Senders API and records `quality_rating` + `messaging_limit`.
- New `Accounts` columns: `whatsapp_quality_rating` (`green|yellow|red|unknown`),
  `whatsapp_messaging_limit` (integer), `whatsapp_quality_checked_at` (timestamp),
  `whatsapp_previous_quality_rating` (text, for downgrade detection).
- Alert on any downgrade (`green→yellow`, `yellow→red`, `unknown→red`) via the existing
  `notify()` + owner-lookup pattern, notification type `quality_rating_drop`.
- A chip in `DetailViewHeader.tsx`'s meta-chip row, beside Daily Limit: colored dot + current
  messaging limit, tooltip with last-checked time. Renders a neutral/gray placeholder when
  `whatsapp_sender_sid` is null (i.e., every account, today).
- Client-side merge of the two new fields onto `Campaign` in `useCampaignsData.ts`, mirroring the
  existing `account_name`/`account_logo_url` merge — no new Express route needed (see "what already
  exists" re: the deny-list column selection).

## Out of scope

- **Automated tier-upgrade actions.** This is visibility + alerting only. Nothing auto-adjusts
  `daily_lead_limit` based on the observed quality/limit — a human decides, informed by the chip.
- **Historical charting.** v1 stores current + previous value only, not a time-series table. A full
  history table is a fast follow if the "previous" field turns out to be insufficient.
- **Messaging-provisioning Phase 2 itself** (WhatsApp sender registration, approval-status sync) —
  a separate, not-yet-built dependency. This spec only consumes `whatsapp_sender_sid` once it exists.
- **List-card-level indicator** (`CampaignListCard.tsx`). v1 is detail-header only.
- **Ramp-up automation** for a newly provisioned number (the "start conservative, climb as quality
  holds" playbook) — that's an operational practice for whoever sets `daily_lead_limit` per campaign,
  informed by this chip, not code in this spec.

## Functional requirements

1. **Poll interval.** A new job, `quality_rating_monitor`, runs on `IntervalTrigger`
   (config: `quality_rating_monitor_interval_seconds`, default 3600s — Meta only re-evaluates
   roughly every 6h, so hourly is more than enough and avoids needless Twilio calls).
2. **Scope.** Only accounts with `whatsapp_sender_sid IS NOT NULL` are polled. Today that is zero
   accounts — the job runs, logs "0 accounts to check", and exits; this is expected, not an error.
3. **Fetch.** For each in-scope account, call `GET /v2/Channels/Senders/{whatsapp_sender_sid}` via
   the Twilio client's low-level `.request()` (per-account creds via `_get_client`), extract
   `quality_rating` and `messaging_limit` from the response body.
4. **Write + diff.** Before overwriting, copy the current `whatsapp_quality_rating` into
   `whatsapp_previous_quality_rating`, then set the new `whatsapp_quality_rating`,
   `whatsapp_messaging_limit`, `whatsapp_quality_checked_at = NOW()`.
5. **Alert.** If the new rating is worse than the previous one (`green→yellow`, `yellow→red`,
   `unknown→red`), insert a notification (`notify()`, type `quality_rating_drop`) addressed to the
   account owner (owner-lookup join, same as `nightly_summary.py`), linking to the campaign/account.
6. **Resilience.** A Twilio error (rate limit, sender not found, network) on one account must not
   abort the loop — log via `AsyncLogStep` and continue to the next account, matching the engine's
   existing per-item try/except convention (e.g. `task_reminders.py`, `nightly_summary.py`).
7. **API surface.** The two new fields ride along on the existing `fetchAccounts()` response
   (automatic, per the deny-list column selection) and get merged onto `Campaign` in
   `useCampaignsData.ts` alongside `account_name`/`account_logo_url`.
8. **UI.** `DetailViewHeader.tsx` renders a chip (colored dot + `messaging_limit`, tooltip with
   `whatsapp_quality_checked_at`) in the meta-chip row, immediately after Daily Limit. Gray dot + "—"
   when `whatsapp_quality_rating` is null/unknown.

## Non-functional requirements

- **i18n**: new chip label + tooltip copy via the `campaigns` namespace, en/nl only (pt dropped
  product-wide).
- **Zero send-path change**: this is read-only monitoring; `send_service.py` / `channel_fallback.py`
  are untouched.
- **Styling**: dot colors via design tokens, never raw hex, dark-mode-safe (per `UI_STANDARDS.md`).
- **No new dependency**: use the SDK's existing `.request()` escape hatch rather than bumping
  `twilio` to a version with a typed v2 wrapper — smaller surface, one job, no ripple risk.
- **Idempotent**: safe to run back-to-back; each run's write is a plain overwrite + diff, no queue.

## Data model changes (flagged, not edited here)

- `Accounts.whatsapp_quality_rating` (text: `green|yellow|red|unknown`, default `unknown`)
- `Accounts.whatsapp_previous_quality_rating` (text, same domain, nullable)
- `Accounts.whatsapp_messaging_limit` (integer, nullable)
- `Accounts.whatsapp_quality_checked_at` (timestamp with tz, nullable)

All four sit next to the existing `whatsapp_sender_status` / `whatsapp_sender_sid` /
`whatsapp_display_name` / `messaging_provisioned_at` block (`schema.ts:85-88`).

## Acceptance criteria

- With a real `whatsapp_sender_sid` on an account, the job populates all four new fields within one
  poll interval, and a Twilio error on that account is logged, not thrown.
- Diff logic correctly identifies a downgrade transition and calls `notify()` exactly once per
  transition (not once per poll while sitting at the same degraded level).
- The Campaigns page header shows the chip on a real account, and a neutral gray placeholder on
  every account today (no regression, no crash, no "undefined" rendering).
- No changes required to `send_service.py`, `channel_fallback.py`, or any existing campaign send
  behavior.
