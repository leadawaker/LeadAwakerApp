# Action required: Automation overview

1. **Engine restarted 2026-10-09 19:58 (Amsterdam)** with Gabriel's OK: jobs-health shows run health; heartbeat rows stopped; diary rows appear as soon as automations do real work.
2. Verified after restart: `/api/jobs-health` returns `started_at` + `last_*`; no `run_complete` rows since the restart.
3. **Decide: paused campaigns still send follow-ups.** `tools/db/leads.py:get_active_leads_due` has no campaign-status filter, so a non-Active campaign keeps bumping leads already started. The client tab now warns about it. Not changed here.
4. **Decide: CRM to engine URL.** `getEngineUrl()` (server/routes/_helpers.ts) resolves to `SUPPORT_CHAT_WEBHOOK_URL` = 172.20.0.1:8100, which times out from the CRM. Every caller (manual bump trigger, no-show, reschedule, close summaries, campaign launch test, missed-call transcode, support chat) silently fails. The Automations page uses `ENGINE_URL || localhost:8100` instead. Fix by pointing that env var at localhost, after checking what each caller would then start doing.
5. **Retention:** the 03:00 cleanup now keeps debug rows 2 days and diary rows 90 days (`/home/gabriel/scripts/cleanup-automation-logs.sh`).
6. Never run `db:push` against Automation_Logs: the two partial indexes are not declared in drizzle.
