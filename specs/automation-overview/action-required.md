# Action required: Automation overview

1. **Restart the engine** (`pm2 restart leadawaker-engine`) to make the diary and job health live. This also deploys the earlier checkpointed engine work (commit 4f3ad97: caller memory, SMS fallback `resolved_channel`, voice transfer/screening fixes). Until then the CRM pages work but show no diary activity.
2. **After restart, check:** `curl -s localhost:8100/api/jobs-health` shows `started_at` and `last_*` fields; within ~10 minutes `kind='action'` rows appear in Automation_Logs; no new `run_complete` rows; no Unlisted rows on the Automations page.
3. **Decide: paused campaigns still send follow-ups.** `tools/db/leads.py:get_active_leads_due` has no campaign-status filter, so a non-Active campaign keeps bumping leads already started. The client tab now warns about it. Not changed here.
4. **Decide: CRM to engine URL.** `getEngineUrl()` (server/routes/_helpers.ts) resolves to `SUPPORT_CHAT_WEBHOOK_URL` = 172.20.0.1:8100, which times out from the CRM. Every caller (manual bump trigger, no-show, reschedule, close summaries, campaign launch test, missed-call transcode, support chat) silently fails. The Automations page uses `ENGINE_URL || localhost:8100` instead. Fix by pointing that env var at localhost, after checking what each caller would then start doing.
5. **Retention:** the 03:00 cleanup now keeps debug rows 2 days and diary rows 90 days (`/home/gabriel/scripts/cleanup-automation-logs.sh`).
6. Never run `db:push` against Automation_Logs: the two partial indexes are not declared in drizzle.
