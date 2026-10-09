# Action required: Automation overview

1. **Engine restarted 2026-10-09 19:58 (Amsterdam)** with Gabriel's OK: jobs-health shows run health; heartbeat rows stopped; diary rows appear as soon as automations do real work.
2. Verified after restart: `/api/jobs-health` returns `started_at` + `last_*`; no `run_complete` rows since the restart.
3. **Done 2026-10-09: paused campaigns hold follow-ups.** `get_active_leads_due` now requires `c.status = 'Active'` (engine 7d463d0, live after the 22:25 engine restart). The client tab shows "on hold" instead of a warning.
4. **Done 2026-10-09: CRM to engine URL.** `getEngineUrl()` now returns `ENGINE_URL || http://localhost:8100` and support chat posts to `${getEngineUrl()}/webhook/support-chat` (CRM fdaf77af). Manual bump, no-show, reschedule, close summary, campaign trigger, voice synth and support chat reach the engine again. Note: the support bot calls a Groq Llama model, which may be retired.
5. **Retention:** the 03:00 cleanup now keeps debug rows 2 days and diary rows 90 days (`/home/gabriel/scripts/cleanup-automation-logs.sh`).
6. Never run `db:push` against Automation_Logs: the two partial indexes are not declared in drizzle.
