# Requirements: Automation Overview (diary, catalogue, global page, per-client tab)

## What & Why

Gabriel has no clear view of what the automation engine does. The CRM "Automations" page (`pages/AutomationLogs.tsx`) knows 8 of the ~30 automations, its health depends on "woke up, nothing to do" heartbeat rows, and nothing shows per client what is switched on or what happened. Most `Automation_Logs` rows are heartbeats without an account, real failures mostly land in the pm2 error log, and a nightly cron deletes everything older than 2 days.

Every client runs the same engine code; clients differ only by settings (Campaigns, Accounts, `Account_Communication_Profile.setup`, Prompt_Library, Voice_Numbers, Widget_Configs). This feature makes that "shared skeleton + per-client settings" visible:

1. **Diary**: every automation writes one line per real action into `Automation_Logs`.
2. **Catalogue**: one typed list of every automation, used by both pages.
3. **Global Automations page**: all automations grouped by service, live health, 24h activity, a diary side panel.
4. **Per-client Automations tab** in the Account workspace: ON/OFF/ALWAYS ON, a settings summary, 7-day activity, failures, and "Change" links.

## Decisions (agreed with Gabriel, 2026-10-09)

1. Owner only. Clients never see either view (`requireOwner` on every new endpoint, tab shown only when `isOwner`).
2. The per-client tab is read-only: each line has a "Change" link to where the setting already lives. No second place to edit a setting.
3. The per-client tab shows activity plus problems (failure counts, top failure reason).
4. Option B: the engine writes a proper diary (one line per real action). No message contents in the diary, only a reference to the interaction.
5. Diary lines are kept 90 days. Debug step rows keep the existing 2-day retention.
6. Gabriel delegated remaining design choices ("make what you recommend"); choices below marked *(rec)* are Claude's.

## Out of scope

- Changing what any automation sends or when. This is a visibility project. Behaviour bugs found along the way are reported, not fixed, except the ones listed under "Engine fixes".
- **Paused campaigns still send follow-ups** (`tools/db/leads.py:get_active_leads_due` has no campaign-status filter). Not changed here; the client tab shows a warning when it happens, and Gabriel decides separately.
- Client-facing (customer login) version of the tab.
- On/off switches inside the tab.

## The diary

### Storage *(rec)*

Same table, `"p2mxx34fvbf3ll6"."Automation_Logs"`, plus one new column:

| Column | Type | Meaning |
|---|---|---|
| `kind` | text, nullable | `'action'` for diary lines. NULL for existing debug step rows. |

Diary line field mapping:

| Diary field | Column |
|---|---|
| automation id (catalogue id) | `workflow_name` |
| what it did (short machine key, e.g. `sent_bump_2`, `sent_reminder_24h`, `call_answered`) | `step_name` |
| outcome | `status`: `Success` / `Failure` / `Skipped` |
| reason (failed or skipped), max 200 chars, no message content | `skipped_reason` for Skipped, `error_code` + `output_data` for Failure |
| client / campaign / lead | `"Accounts_id"`, `"Campaigns_id"`, `"Leads_id"` (the capitalised columns; lowercase duplicates stay unused) |
| link to the conversation | `metadata` JSON text: `{"interaction_id": <id>}` or `{"voice_call_id": <id>}` |

New partial indexes: `("Accounts_id", created_at DESC) WHERE kind='action'` and `(workflow_name, created_at DESC) WHERE kind='action'`. Drop the duplicate ASC `created_at` index.

### Engine helper

`record_action(automation, action, outcome, *, account_id, campaign_id=None, lead_id=None, reason=None, ref=None)` in `src/automations/automation_logger.py`.

- `outcome` is `"success" | "failed" | "skipped"`.
- **Never raises and never blocks the real work**: the insert is wrapped in try/except with a 2s timeout; a failed diary write logs a structlog warning and returns.
- The same safety applies to the existing `log_step` / `AsyncLogStep` writes. A failing log insert must no longer turn a successful send into a failure, and must not replace the original exception.

### What counts as one action

One message sent, one call handled, one reminder sent, one review reply drafted, one stock feed synced, one booking event processed, one delivery failure reported. "Checked and found nothing to do" is not an action and writes nothing.

### Heartbeats removed

The per-run summary rows (`run_complete`, `scoring_complete`, `aggregation_complete`, per-campaign `aggregate_campaign`, `check_due_soon`, `fetch_accounts`) stop being written.

### Retention

`/home/gabriel/scripts/cleanup-automation-logs.sh` (cron 03:00): delete `kind IS DISTINCT FROM 'action'` rows older than 2 days, and `kind='action'` rows older than 90 days.

## Engine health (separate from the diary)

An APScheduler listener (`EVENT_JOB_EXECUTED | EVENT_JOB_ERROR`) keeps per job in memory: `last_run_at`, `last_ok` (bool), `last_error` (exception class + first 200 chars), `errors_24h` (rolling). `/api/jobs-health` returns these next to `id`, `name`, `next_run_at`, plus `started_at` (engine start time). State resets on engine restart; the UI says "not run since restart" in that case.

## Engine fixes included

1. `no_show_recovery.py` passes `output=` to `log_step` (TypeError every time leads are processed). Fixed.
2. WhatsApp Cloud / Twilio delivery status `failed` / `undelivered` is written as a `message_delivery` diary line with outcome `failed`, looked up to lead/account/campaign through the message SID on Interactions. Today these are logged as Success with no ids.
3. Voice receptionist calls write one diary line per finished call (`voice_receptionist`, action `call_handled` / `call_transferred` / `call_failed`, ref `voice_call_id`).
4. `channel_fallback` send failures are written as `failed`, not `Skipped`.
5. CRM `getRecentFailedAutomationLogs` (`server/storage/automation.ts`) matches `'Failure'` (it filters `'failed','error'` today and never matches).

## Catalogue *(rec)*

Lives in the CRM: `shared/automationCatalogue.ts` (typed, importable by server and client). The engine keeps a pointer comment in `src/scheduler/jobs.py` and `/home/gabriel/automations/CLAUDE.md`: "new automation → add it to LeadAwakerApp/shared/automationCatalogue.ts".

Reason: display names, i18n, gate evaluation and deep links all live in the CRM; one typed file there is one place to keep up to date. The engine stays the source of what actually runs, and anything it runs that the catalogue lacks shows as **Unlisted**.

Entry shape:

```ts
{
  id: string;                 // = workflow_name in the diary and = APScheduler job id when scheduled
  service: "reactivation" | "speed_to_lead" | "bookings" | "reputation" | "receptionist" | "inbox" | "internal";
  trigger: { type: "schedule"; every: string } | { type: "event"; on: string };
  scope: "campaign" | "account" | "agency";  // campaign = one line per campaign in the client tab
  audience: "client" | "internal";           // internal = hidden from the client tab, collapsed on the global page
  aliases?: string[];                        // other workflow_names that belong to this automation (e.g. review_drafter → review_response)
  quietAfterHours?: number;                  // global page shows "Quiet for Xd" when the last action is older
}
```

Initial entries (gates are evaluated in the CRM; column names verified at implementation time):

| id | service | trigger | scope | gate (ON when…) |
|---|---|---|---|---|
| campaign_launcher | reactivation | 60s | campaign | campaign status Active |
| bump_scheduler | reactivation | 5m | campaign | campaign has ≥1 bump configured (max_bumps > 0 or a bump template) |
| buying_signal_followup | reactivation | 5m | campaign | ALWAYS ON |
| ai_conversation | inbox | event: lead replies | campaign | ALWAYS ON |
| channel_fallback | inbox | event: WhatsApp undelivered | campaign | `channel_mode='whatsapp_then_sms'` |
| message_delivery | inbox | event: delivery receipt | account | ALWAYS ON |
| inbound_handler | inbox | event: incoming message | account | ALWAYS ON |
| website_chat | inbox | event: widget message | account | Widget_Configs enabled |
| stock_sync | inbox | hourly | account | `setup.stock.feedUrl` set |
| speed_to_lead | speed_to_lead | event: new form lead | campaign | `campaign_type='speed_to_lead'` |
| booking_reminder | bookings | 5m | account | ALWAYS ON |
| no_show_followup | bookings | 15m + event | account | ALWAYS ON |
| reschedule_reengage | bookings | event | account | ALWAYS ON |
| booking_webhook | bookings | event: Cal.diy | account | ALWAYS ON |
| reputation_scheduler | reputation | 5m | account | `enable_reputation_management` and a reputation campaign |
| reputation_handler | reputation | event | campaign | same as above |
| review_response | reputation | 5m (job id review_drafter) | account | `enable_review_response` |
| voice_receptionist | receptionist | event: call | account | an enabled Voice_Numbers row |
| missed_call | receptionist | event: missed call | account | `missed_call_enabled` |
| lead_scorer, metrics_aggregator, nightly_summary, task_reminders, quality_rating_monitor, voice_call_sweep, error_log_digest, booking_consistency_check, demo_data_purge, demo_bump_scheduler, send_queue_worker, email_outreach | internal | as scheduled | agency | n/a |

## Health and activity rules

**Scheduled automation health** (from `/api/jobs-health`):
- `failing` (red): last run raised.
- `late` (orange): `next_run_at` is more than one interval in the past, or the job is in the catalogue as scheduled but not registered.
- `waiting` (grey): no run since engine restart and not yet due.
- `healthy` (green): otherwise.

**Event automation health** (from the diary, last 24h): red when failures ≥ 3 and failures > successes; orange when any failure; green otherwise; grey "no activity" when no lines.

Action failures on a healthy scheduled job add an orange "N failed" badge but do not change the dot to red.

**Engine unreachable**: banner "Engine not responding", all scheduled dots grey.

## Global Automations page

Route and nav entry stay where they are (owner-only "Automations"). Page content replaced.

- **Summary strip**: total automations, healthy / late / failing counts, failures in the last 24h.
- **Groups by service**, in the order reactivation, speed_to_lead, bookings, reputation, receptionist, inbox, internal. Internal is collapsed by default.
- **Row**: health dot, name, one-line description, trigger label ("Every 5 min", "When a lead replies"), last run (scheduled) or last action (event), 24h counts (worked · failed · skipped), number of clients with it ON.
- **Unlisted**: engine jobs or diary workflow names not in the catalogue appear in an "Unlisted" group with their raw id.
- **Diary panel**: clicking a row opens a side panel with that automation's diary lines (newest first, failures-first toggle, filter by client), 50 per page. Each line: time, client, lead name (link to the lead on the Leads page), action label, outcome, reason.
- The old n8n-era components under `client/src/features/automation/` that nothing imports are deleted; `FILE_MAP.md` updated.

## Per-client Automations tab

New tab `automations` in `ACCOUNT_TABS` (Account workspace), after `voice`. Supports the existing `?tab=automations` deep link.

- **Header**: "X of Y on · N actions · M failed" for the last 7 days.
- **Groups by service** (internal hidden). Each line:
  - State pill: ON / OFF / ALWAYS ON.
  - Name and a settings summary in plain words (e.g. "3 follow-ups, 1 day apart", "24h + 1h before", "Line +31…, screened transfer").
  - 7-day counts (worked · failed · skipped), last action time, top failure reason in red when failures > 0.
  - `[Change →]` link to the account tab or campaign settings section that owns the setting. Lines with no setting (ALWAYS ON) have no link. The reputation and review toggles are only editable in Settings > My Account while the workspace is scoped to that client, so those lines show a hint instead of a link when it is not.
  - Campaign-scoped automations show one sub-line per campaign of this account (Active and Paused campaigns; Archived/Completed hidden unless they had activity in the last 7 days).
  - Clicking a line opens the same diary panel, pre-filtered to this account.
- **Warning**: when a Paused (non-Active) campaign of this account still has leads with `automation_status='active'`, the follow-ups line shows "Campaign paused, follow-ups still going out to N leads".

### Campaign settings deep link *(rec)*

Campaigns page reads `?campaign=<id>&section=<business|ai|behavior>` once on mount (same pattern as the account workspace `?tab=`), selects the campaign, opens the configurations tab and the given section, then strips the params.

## API *(rec)*

All `requireOwner`.

| Endpoint | Returns |
|---|---|
| `GET /api/automations/overview` | catalogue entries joined with engine job state, 24h diary counts, clients-ON count, unlisted ids, engine reachability |
| `GET /api/automations/:id/diary?accountId=&failedOnly=&page=` | paginated diary lines with account, campaign, lead names |
| `GET /api/accounts/:id/automations` | per-client lines: state, settings summary inputs, 7-day counts, top failure reason, change-link target, paused-campaign warning |

`/api/automation-health`, `JOB_GRACE_MAP` and `JOB_CADENCE_LABEL` are removed. The duplicate `/api/automation-logs` registration in `leadsDemoScore.ts` is checked and the dead one removed.

## i18n

The existing `automation` namespace (`client/src/locales/{en,nl,pt}/automation.json`, already registered in `client/src/i18n.ts`) is rewritten: its old keys belong to the deleted n8n-era components. It holds names, descriptions, trigger labels, action labels, states, summaries and reasons. The tab label goes in `accounts.json` under `workspace.tabs.automations`. Unknown action keys fall back to the raw key.

## Testing

- Engine (pytest): `record_action` never raises when the pool fails; `log_step` failure does not mask the caller's exception; the scheduler listener records ok/error runs; no_show TypeError fixed.
- CRM (`node --import tsx --test`): pure functions for health state and for gate evaluation / settings summary, with fixtures for ON, OFF and ALWAYS ON.
- Live check after engine restart: global page shows every registered job, a real action appears in the diary within minutes, the per-client tab for account 1 shows ON/OFF that matches the account's settings.

## Rollout

1. DB migration (new column + indexes) via a direct `pg` script.
2. CRM changes go live on save (tsx watch); they must work against the old engine (missing health fields show grey "unknown").
3. Engine changes need `pm2 restart leadawaker-engine`. **Requires Gabriel's OK** at the time (live calls and sends run on it).
4. Cleanup script change takes effect at the next 03:00 run.
