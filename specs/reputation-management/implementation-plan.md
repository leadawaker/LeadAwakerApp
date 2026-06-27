# Reputation Management + `campaign_type` — Implementation Plan

> Paths verified against the current tree (this session). Engine = `/home/gabriel/automations/`,
> CRM = `/home/gabriel/LeadAwakerApp/`.

## Architecture decision: modular dispatch, NOT duplication

The question "won't reputation bloat/break the reactivation scripts, shouldn't we just duplicate?"
resolves to a middle path:

- **Outbound is fully separate.** Reputation gets its **own** scheduler module
  (`reputation_scheduler.py`) next to `bump_scheduler.py`. `campaign_launcher.py` and
  `bump_scheduler.py` are **not touched**.
- **Inbound is one shared funnel** (one WhatsApp number → one webhook → `inbound_handler.py`), so it
  cannot be duplicated without a second number per service. We add a **small dispatch branch** there:
  after the campaign+account are loaded, read `campaign_type`; if `reputation`, hand off to
  `reputation_handler.run(...)` and **return** — `run_ai_conversation()` and the buying-signal path
  are never entered for reputation leads. `ai_conversation.py` stays untouched.
- **Shared primitives stay shared** (`send_message`, `automation_logger`, DB pool, prompt loader).
  Reputation gets its own handler, prompt, and classification call, but reuses the plumbing.

Net: reactivation logic is isolated and unchanged; the only edit to existing code is the dispatch
branch + the scheduler registration line. New behavior lives in new files.

## Phase 0 — `campaign_type` foundation (shared)

**Schema** (`shared/schema.ts`, `Campaigns`): add `campaignType: text("campaign_type")`
(default `'reactivation'`). Add to `insertCampaignsSchema` (partial-safe). Leads inherit type via
their campaign join — no per-lead column needed (read `campaign.campaign_type` where the engine
already loads the campaign).

**Migration** (Pi: `npm run db:push` has no TTY — use a direct `pg` SQL script run with
`node --env-file=.env`, per project convention):
- `ALTER TABLE "Campaigns" ADD COLUMN "campaign_type" text DEFAULT 'reactivation';`
- Backfill: `UPDATE "Campaigns" SET "campaign_type" = 'reactivation' WHERE "campaign_type" IS NULL;`

**Engine dispatch** (`src/webhooks` / `src/automations/inbound_handler.py`): in `process_inbound`,
after the campaign+account load step and before the AI-conversation step, branch on
`campaign.get("campaign_type")`. Default/`reactivation` → existing path unchanged. `reputation` →
`await reputation_handler.handle_reply(...)`; return.

**Verification of Phase 0:** an existing reactivation lead replies and flows through
`run_ai_conversation()` exactly as before (campaign_type defaulted to `reactivation`).

## Phase 1 — Reputation engine

**a) Scheduler job** — `src/automations/reputation_scheduler.py`, `async def run()`:
- Due-query mirrors `bump_scheduler.py`'s pattern (asyncpg via `tools/db/connection.py:get_pool()`,
  PascalCase columns quoted): select leads whose campaign `campaign_type='reputation'`, account
  `enable_reputation_management=true`, `service_completed_at <= NOW() - (reputation_delay_minutes)`,
  `review_request_sent_at IS NULL`, not opted out, within business hours.
- Render the feedback ask from Prompt_Library `system:reputation-request` (via
  `get_prompt_for_campaign()` → account → global cascade in `tools/db/prompts.py`).
- Send via `send_message(channel="whatsapp_cloud", body=..., phone=...)`
  (`tools/send_service.py` → `tools/whatsapp_cloud.py:send_text_message`). **Cold opener must use an
  approved WhatsApp template** (existing template plumbing) if no open 24h session — see
  action-required.
- Set `review_request_sent_at = NOW()` (server-side), record an outbound interaction.
- Wrap each step in `AsyncLogStep("reputation_scheduler", "<step>", accounts_id=, campaigns_id=,
  leads_id=, workflow_execution_id=)`.

**b) Register the job** — `src/scheduler/jobs.py`, in `register_jobs()` (line 23): one
`scheduler.add_job(reputation_run, IntervalTrigger(seconds=settings.reputation_interval_seconds),
id="reputation_scheduler", name="Reputation Scheduler", replace_existing=True)`. Add
`reputation_interval_seconds` to `src/config.py` (default 300).

**c) Reply handler** — `src/automations/reputation_handler.py`, `async def handle_reply(lead,
campaign, account, inbound_message, exec_id)`:
- Classify satisfaction (positive / negative / neutral) via a Groq/OpenAI call (reuse
  `tools/ai_service.py`) using a dedicated classification prompt. This replaces — does not extend —
  the buying-signal classification for reputation leads.
- Positive → `send_message(... body=review_ask_with_link(account.google_review_url))`; apply tags
  `review_requested`, `review_sent` (reuse the existing `apply_event_tags`).
- Negative → no link; apply `reputation_negative`; fire manager notification to
  `account.reputation_alert_target` (reuse the notification path — **`broadcastToUser`**); set the
  lead for handoff (reuse `handoff_detector`/handoff fields).
- Neutral → no link; apply `reputation_neutral`; optionally one gentle follow-up, else close.
- Log via `AsyncLogStep("reputation_handler", "<step>", ...)`.

**d) Prompts** — create two Prompt_Library entries (action-required): `system:reputation-request`
(the feedback ask) and `system:reputation-classifier` (satisfaction classification).

## Phase 2 — Service-completed entry path

- **Import**: accept a `service_completed_at` column in lead CSV import for reputation campaigns
  (extend the existing lead-import path; set the timestamp server-side as a `Date`).
- **Manual "mark served"**: a lead action (button) that sets `service_completed_at = new Date()` via
  PATCH `/api/leads/:id` (`server/routes/leads.ts` + `server/storage/leads.ts`, which already accept
  partial lead updates). i18n the label.

## Phase 3 — Account settings (the only UI in this spec)

- **Schema** (`Accounts`): `enable_reputation_management` (bool, default false), `google_review_url`
  (text), `reputation_alert_target` (text/user-id).
- **UI**: a small panel modeled on `features/accounts/components/KnowledgeBasePanel.tsx` — enable
  toggle, review URL input, manager-target picker → PATCH `/api/accounts/:id`
  (`server/routes/accounts.ts`). Use tokens (no hardcoded hex), i18n strings in the `accounts`
  namespace. Right-panel/inline, never a backdrop dialog.
- The richer Reputation **workspace** (queue/funnel/stream) is integrated later from the Claude
  Design output — not built here.

## Phase 4 — Referral engine (rides the positive branch) — BUILT 2026-06-23

> Rationale: the best moment to ask for a referral is the exact moment a customer says they're happy,
> and that moment already exists as the **positive** branch of `reputation_handler.py`. This is NOT a
> new service or scheduler — it's a second, opt-in action on the existing branch plus a small tracking
> table. Near-zero marginal engine cost. WhatsApp is ideal: a standalone message is one-tap forwardable.

**Opt-in flag** — `Accounts.enable_referral_ask` (boolean, default `false`). Surfaced to the engine via
`get_campaign_with_account()` (it already selects the account reputation columns). When `false`, the
positive branch is byte-for-byte the classic flow (regression-guarded).

**Tracking table** — `Referrals` (created by `scripts/create-referrals.mjs`, the
`node --env-file=.env` pattern; `db:push` has no TTY on the Pi):

| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `Accounts_id` | integer NOT NULL | owning account |
| `Campaigns_id` | integer | reputation campaign |
| `referrer_lead_id` | integer NOT NULL | the happy customer |
| `referred_name` | text | captured from the customer's reply |
| `referred_contact` | text | reserved for a parsed phone/email |
| `status` | text default `'asked'` | `asked` → `received` → `converted` |
| `source_channel` | text | e.g. `whatsapp_cloud` |
| `asked_at` / `received_at` / `converted_at` | timestamptz | set server-side (`NOW()`) |
| `created_at` / `updated_at` | timestamptz default `now()` | |

Indexes: `Accounts_id`, `referrer_lead_id`, `status`.

**Engine changes** (no new files beyond the DB module; reuses classify/send/tag/log plumbing):
- `tools/db/referrals.py` (new): `create_referral()`, `get_pending_referral()`, `mark_referral_received()`.
- `tools/db/constants.py`: `Table.REFERRALS`.
- `reputation_prompts.py`: `DEFAULT_REFERRAL_ASK` + `DEFAULT_REFERRAL_THANKS` (en/nl), overridable via
  Prompt_Library use_cases `reputation_referral_ask` / `reputation_referral_thanks`.
- `reputation_handler.py`:
  - **Positive branch**: after the review link is sent and tagged, if `enable_referral_ask` →
    `_send_referral_ask()` sends a separate forwardable message and opens a `Referrals` row
    (`status='asked'`). Isolated in `try/except` so it can never break the review flow.
  - **Capture (top of `handle_reply`, gated by the flag)**: `_maybe_capture_referral()` — if a pending
    `asked` referral exists for this lead and the reply isn't a plain decline, it records
    `referred_name`, moves the row to `received`, sends a thank-you, fires a `referral_received`
    notification (`broadcastToUser` via `notify()`), and short-circuits (no re-classification).
- `tools/notification_service.py`: `referral_received` notification type.

**`converted`** is left for humans/CRM to set later (when a referred person becomes a customer); the
engine only owns `asked` → `received`.

**Regression guard (verified):** a stubbed-I/O harness runs `handle_reply` on a positive reply with the
flag **off** and asserts exactly one send (the review link), tags `reputation_positive` +
`review_requested`, and **zero** referral activity — identical to the pre-Phase-4 behavior. With the
flag **on** it asserts the extra forwardable send + `create_referral`; with a pending referral it
asserts capture + that the classifier is never called; a `"no thanks"` reply is not stored. All pass.
Engine restarted clean (`scheduler.started`, no traceback).

## Files touched (representative)

New (engine): `src/automations/reputation_scheduler.py`, `src/automations/reputation_handler.py`,
prompt rows. Edited (engine, minimal): `src/automations/inbound_handler.py` (dispatch branch),
`src/scheduler/jobs.py` (registration), `src/config.py` (interval).
CRM schema: `shared/schema.ts` (Campaigns + Leads + Accounts fields) + migration SQL script.
CRM UI/server: account-settings panel under `features/accounts/components/`, lead "mark served"
action in `features/leads/`, import path tweak; existing `leads`/`accounts` routes+storage accept the
new fields.

## Verification (end-to-end)

1. Run the migration script; confirm columns exist (`\d "Campaigns"` etc.).
2. Reactivation regression: existing reactivation lead replies → still handled by
   `run_ai_conversation()` (check Automation Logs workflow name unchanged).
3. Reputation happy path: seed a `reputation` campaign + a lead with `service_completed_at` in the
   past + account enabled → scheduler sends the ask (Automation Logs `reputation_scheduler`); reply
   "great, 5 stars" → review link returned, tags applied (`reputation_handler` logged).
4. Reputation unhappy path: reply "terrible service" → no link, `reputation_negative` tag, manager
   notification received by the configured target.
5. Idempotency: scheduler run twice does not re-ask (review_request_sent_at gate).
6. Toggle off `enable_reputation_management` → no sends.
7. `pm2 restart leadawaker-engine` picks up the new job (engine needs restart for scheduler changes;
   the Express server auto-reloads via pm2 watch).
