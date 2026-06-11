# Session A — Endpoint Inventory (server/routes.ts)

Generated 2026-06-11. `server/routes.ts` (6,574 lines, 208 route registrations) is **not wired into the app**: `server/index.ts` imports `registerRoutes` from `./routes/index`, and nothing imports `./routes.ts`. The extraction did not stall halfway — it finished, but the old monolith was never deleted.

## Verdict per registration

- **202 registrations are stale duplicates** of endpoints that live (and have since evolved: purge endpoints, prompt versions, task comments/attachments, voice cloning, WhatsApp sends were added only in `routes/`) in the extracted files. The `routes/` copy wins in every case because it is the one actually served.
- **6 registrations are orphans** that exist ONLY in routes.ts and are therefore currently DEAD in production (the SPA catch-all swallows them with HTML 200s). All six have live frontend callers:

| Line | Method | Path | Caller |
|---|---|---|---|
| 262 | POST | /api/contact | landing page `client/public/premium/10-cta-footer.jsx` |
| 444 | GET | /api/prospects/cadence-queue | `client/src/features/cadence/api/cadenceApi.ts` |
| 462 | POST | /api/prospects/:id/enter-cadence | cadenceApi.ts |
| 475 | POST | /api/prospects/:id/log-contact | cadenceApi.ts |
| 521 | POST | /api/prospects/:id/skip-cadence | cadenceApi.ts |
| 3091 | GET | /api/comment-counts | `client/src/features/tasks/api/tasksApi.ts` |

Action: move these six verbatim into their domain files (contact → auth.ts, cadence → accounts.ts before the `/api/prospects/:id` param route, comment-counts → tasks.ts next to subtask-counts), then delete routes.ts.

Note: routes.ts also double-registers `GET /api/agent-skills` and `POST /api/agent-skills/execute` within itself (lines 4323/6068 and 4364/6108) — moot once deleted.

## Full inventory

| Line | Method | Path | Domain | Status |
|---|---|---|---|---|
| 243 | POST | /api/admin/test-email | bootstrap | duplicate (live in routes/) |
| 262 | POST | /api/contact | bootstrap | ORPHAN — only in routes.ts (dead) |
| 280 | GET | /api/health | bootstrap | duplicate (live in routes/) |
| 292 | GET | /api/accounts | accounts | duplicate (live in routes/) |
| 302 | GET | /api/accounts/:id | accounts | duplicate (live in routes/) |
| 314 | POST | /api/accounts | accounts | duplicate (live in routes/) |
| 321 | PATCH | /api/accounts/:id | accounts | duplicate (live in routes/) |
| 329 | DELETE | /api/accounts/:id | accounts | duplicate (live in routes/) |
| 335 | POST | /api/accounts/:id/sync-instagram | accounts | duplicate (live in routes/) |
| 352 | GET | /api/accounts/:id/knowledge | accounts | duplicate (live in routes/) |
| 361 | POST | /api/accounts/:id/knowledge | accounts | duplicate (live in routes/) |
| 373 | PATCH | /api/accounts/:id/knowledge/:kbId | accounts | duplicate (live in routes/) |
| 386 | DELETE | /api/accounts/:id/knowledge/:kbId | accounts | duplicate (live in routes/) |
| 394 | GET | /api/prospects | prospects | duplicate (live in routes/) |
| 425 | GET | /api/prospects/by-ids | prospects | duplicate (live in routes/) |
| 433 | GET | /api/prospects/filter-options | prospects | duplicate (live in routes/) |
| 439 | GET | /api/prospects/conversations | prospects | duplicate (live in routes/) |
| 444 | GET | /api/prospects/cadence-queue | prospects | ORPHAN — only in routes.ts (dead) |
| 462 | POST | /api/prospects/:id/enter-cadence | prospects | ORPHAN — only in routes.ts (dead) |
| 475 | POST | /api/prospects/:id/log-contact | prospects | ORPHAN — only in routes.ts (dead) |
| 521 | POST | /api/prospects/:id/skip-cadence | prospects | ORPHAN — only in routes.ts (dead) |
| 530 | GET | /api/prospects/:id/messages | prospects | duplicate (live in routes/) |
| 538 | GET | /api/prospects/:id | prospects | duplicate (live in routes/) |
| 544 | POST | /api/prospects | prospects | duplicate (live in routes/) |
| 551 | PATCH | /api/prospects/:id | prospects | duplicate (live in routes/) |
| 605 | POST | /api/prospects/:id/convert-to-account | prospects | duplicate (live in routes/) |
| 649 | DELETE | /api/prospects/:id | prospects | duplicate (live in routes/) |
| 657 | GET | /api/outreach-templates | outreach-templates | duplicate (live in routes/) |
| 662 | GET | /api/outreach-templates/:id | outreach-templates | duplicate (live in routes/) |
| 668 | POST | /api/outreach-templates | outreach-templates | duplicate (live in routes/) |
| 675 | PATCH | /api/outreach-templates/:id | outreach-templates | duplicate (live in routes/) |
| 683 | DELETE | /api/outreach-templates/:id | outreach-templates | duplicate (live in routes/) |
| 691 | GET | /api/campaigns | campaigns | duplicate (live in routes/) |
| 708 | GET | /api/campaigns/:id | campaigns | duplicate (live in routes/) |
| 718 | POST | /api/campaigns | campaigns | duplicate (live in routes/) |
| 743 | PATCH | /api/campaigns/:id | campaigns | duplicate (live in routes/) |
| 764 | DELETE | /api/campaigns/:id | campaigns | duplicate (live in routes/) |
| 784 | GET | /api/campaigns/:id/daily-stats | campaigns | duplicate (live in routes/) |
| 809 | GET | /api/campaigns/:id/ab-stats | campaigns | duplicate (live in routes/) |
| 996 | POST | /api/campaigns/:id/generate-summary | campaigns | duplicate (live in routes/) |
| 1115 | POST | /api/campaigns/:id/generate-demo | campaigns | duplicate (live in routes/) |
| 1170 | GET | /api/leads | leads/tags | duplicate (live in routes/) |
| 1219 | GET | /api/leads/:id | leads/tags | duplicate (live in routes/) |
| 1229 | POST | /api/leads | leads/tags | duplicate (live in routes/) |
| 1242 | PATCH | /api/leads/:id | leads/tags | duplicate (live in routes/) |
| 1301 | DELETE | /api/leads/:id | leads/tags | duplicate (live in routes/) |
| 1314 | POST | /api/leads/:id/transcribe-voice | leads/tags | duplicate (live in routes/) |
| 1375 | POST | /api/leads/import-csv | leads/tags | duplicate (live in routes/) |
| 1444 | POST | /api/leads/bulk-update | leads/tags | duplicate (live in routes/) |
| 1500 | POST | /api/leads/bulk-tag | leads/tags | duplicate (live in routes/) |
| 1540 | GET | /api/interactions/stream | interactions | duplicate (live in routes/) |
| 1575 | GET | /api/interactions | interactions | duplicate (live in routes/) |
| 1612 | GET | /api/interactions/:id | interactions | duplicate (live in routes/) |
| 1623 | POST | /api/interactions | interactions | duplicate (live in routes/) |
| 1658 | DELETE | /api/interactions/:id | interactions | duplicate (live in routes/) |
| 1670 | POST | /api/interactions/bulk-delete | interactions | duplicate (live in routes/) |
| 1685 | GET | /api/tags | leads/tags | duplicate (live in routes/) |
| 1694 | POST | /api/tags | leads/tags | duplicate (live in routes/) |
| 1701 | PATCH | /api/tags/:id | leads/tags | duplicate (live in routes/) |
| 1709 | DELETE | /api/tags/:id | leads/tags | duplicate (live in routes/) |
| 1718 | GET | /api/leads/tags/all | leads/tags | duplicate (live in routes/) |
| 1726 | GET | /api/leads/:id/tags | leads/tags | duplicate (live in routes/) |
| 1732 | GET | /api/leads/:id/tag-events | leads/tags | duplicate (live in routes/) |
| 1785 | POST | /api/leads/:id/tags | leads/tags | duplicate (live in routes/) |
| 1804 | DELETE | /api/leads/:id/tags/:tagId | leads/tags | duplicate (live in routes/) |
| 1817 | POST | /api/leads/:id/trigger-bump | leads/tags | duplicate (live in routes/) |
| 1841 | GET | /api/leads/:id/score-breakdown | leads/tags | duplicate (live in routes/) |
| 1934 | GET | /api/leads/:id/score-history | leads/tags | duplicate (live in routes/) |
| 1969 | POST | /api/leads/:id/reset-demo | leads/tags | duplicate (live in routes/) |
| 2003 | POST | /api/leads/:id/demo-reset-and-send | leads/tags | duplicate (live in routes/) |
| 2045 | POST | /api/leads/:id/ai-send | leads/tags | duplicate (live in routes/) |
| 2106 | GET | /api/automation-health | automation | duplicate (live in routes/) |
| 2179 | GET | /api/automation-logs/summary | automation | duplicate (live in routes/) |
| 2185 | GET | /api/automation-logs | automation | duplicate (live in routes/) |
| 2202 | GET | /api/notifications/legacy | notifications | duplicate (live in routes/) |
| 2209 | GET | /api/notifications | notifications | duplicate (live in routes/) |
| 2221 | GET | /api/notifications/count | notifications | duplicate (live in routes/) |
| 2229 | PATCH | /api/notifications/preferences | notifications | duplicate (live in routes/) |
| 2248 | PATCH | /api/notifications/:id | notifications | duplicate (live in routes/) |
| 2262 | DELETE | /api/notifications/all | notifications | duplicate (live in routes/) |
| 2269 | DELETE | /api/notifications/:id | notifications | duplicate (live in routes/) |
| 2282 | POST | /api/notifications/mark-all-read | notifications | duplicate (live in routes/) |
| 2289 | POST | /api/notifications | notifications | duplicate (live in routes/) |
| 2304 | POST | /api/notifications/test | notifications | duplicate (live in routes/) |
| 2320 | GET | /api/notifications/vapid-public-key | notifications | duplicate (live in routes/) |
| 2327 | GET | /api/notifications/preferences | notifications | duplicate (live in routes/) |
| 2346 | GET | /api/notifications/push-subscriptions | notifications | duplicate (live in routes/) |
| 2364 | POST | /api/notifications/push-subscription | notifications | duplicate (live in routes/) |
| 2387 | DELETE | /api/notifications/push-subscription | notifications | duplicate (live in routes/) |
| 2401 | GET | /api/activity-feed | notifications | duplicate (live in routes/) |
| 2563 | GET | /api/users | users | duplicate (live in routes/) |
| 2575 | GET | /api/users/:id | users | duplicate (live in routes/) |
| 2583 | PATCH | /api/users/:id | users | duplicate (live in routes/) |
| 2613 | POST | /api/users/invite | users | duplicate (live in routes/) |
| 2723 | POST | /api/users/:id/resend-invite | users | duplicate (live in routes/) |
| 2788 | POST | /api/users/:id/revoke-invite | users | duplicate (live in routes/) |
| 2833 | GET | /api/prompts | prompts | duplicate (live in routes/) |
| 2860 | POST | /api/prompts | prompts | duplicate (live in routes/) |
| 2867 | PUT | /api/prompts/:id | prompts | duplicate (live in routes/) |
| 2876 | DELETE | /api/prompts/:id | prompts | duplicate (live in routes/) |
| 2885 | GET | /api/tasks | tasks | duplicate (live in routes/) |
| 2920 | GET | /api/tasks/stats | tasks | duplicate (live in routes/) |
| 2956 | POST | /api/tasks | tasks | duplicate (live in routes/) |
| 2984 | PATCH | /api/tasks/:id | tasks | duplicate (live in routes/) |
| 3018 | DELETE | /api/tasks/:id | tasks | duplicate (live in routes/) |
| 3027 | GET | /api/tasks/:id/subtasks | tasks | duplicate (live in routes/) |
| 3036 | POST | /api/tasks/:id/subtasks | tasks | duplicate (live in routes/) |
| 3054 | PATCH | /api/tasks/:id/subtasks/reorder | tasks | duplicate (live in routes/) |
| 3070 | PATCH | /api/subtasks/:id | tasks | duplicate (live in routes/) |
| 3079 | DELETE | /api/subtasks/:id | tasks | duplicate (live in routes/) |
| 3086 | GET | /api/subtask-counts | tasks | duplicate (live in routes/) |
| 3091 | GET | /api/comment-counts | tasks | ORPHAN — only in routes.ts (dead) |
| 3098 | GET | /api/task-categories | tasks | duplicate (live in routes/) |
| 3103 | POST | /api/task-categories | tasks | duplicate (live in routes/) |
| 3121 | PATCH | /api/task-categories/:id | tasks | duplicate (live in routes/) |
| 3130 | DELETE | /api/task-categories/:id | tasks | duplicate (live in routes/) |
| 3144 | GET | /api/lead-score-history | leads/tags | duplicate (live in routes/) |
| 3154 | GET | /api/campaign-metrics-history | campaign-metrics | duplicate (live in routes/) |
| 3162 | POST | /api/campaign-metrics-history | campaign-metrics | duplicate (live in routes/) |
| 3171 | GET | /api/dashboard-trends | campaign-metrics | duplicate (live in routes/) |
| 3242 | GET | /api/invoices | invoices | duplicate (live in routes/) |
| 3251 | GET | /api/invoices/view/:token | invoices | duplicate (live in routes/) |
| 3264 | GET | /api/invoices/:id | invoices | duplicate (live in routes/) |
| 3273 | POST | /api/invoices | invoices | duplicate (live in routes/) |
| 3299 | PATCH | /api/invoices/:id | invoices | duplicate (live in routes/) |
| 3312 | PATCH | /api/invoices/:id/mark-sent | invoices | duplicate (live in routes/) |
| 3321 | PATCH | /api/invoices/:id/mark-paid | invoices | duplicate (live in routes/) |
| 3336 | DELETE | /api/invoices/:id | invoices | duplicate (live in routes/) |
| 3344 | GET | /api/contracts | contracts | duplicate (live in routes/) |
| 3353 | GET | /api/contracts/view/:token | contracts | duplicate (live in routes/) |
| 3365 | GET | /api/contracts/:id | contracts | duplicate (live in routes/) |
| 3374 | POST | /api/contracts | contracts | duplicate (live in routes/) |
| 3389 | PATCH | /api/contracts/:id | contracts | duplicate (live in routes/) |
| 3402 | PATCH | /api/contracts/:id/mark-signed | contracts | duplicate (live in routes/) |
| 3412 | POST | /api/contracts/:id/send-for-signature | contracts | duplicate (live in routes/) |
| 3505 | DELETE | /api/contracts/:id | contracts | duplicate (live in routes/) |
| 3513 | GET | /api/expenses | expenses | duplicate (live in routes/) |
| 3520 | POST | /api/expenses/parse-pdf | expenses | duplicate (live in routes/) |
| 3601 | POST | /api/expenses | expenses | duplicate (live in routes/) |
| 3647 | PATCH | /api/expenses/:id | expenses | duplicate (live in routes/) |
| 3670 | DELETE | /api/expenses/:id | expenses | duplicate (live in routes/) |
| 3677 | GET | /api/expenses/:id/pdf | expenses | duplicate (live in routes/) |
| 3777 | POST | /api/support-chat/sessions | support-chat | duplicate (live in routes/) |
| 3796 | GET | /api/support-chat/sessions/active | support-chat | duplicate (live in routes/) |
| 3803 | GET | /api/support-chat/messages/:sessionId | support-chat | duplicate (live in routes/) |
| 3815 | POST | /api/support-chat/messages | support-chat | duplicate (live in routes/) |
| 3968 | POST | /api/support-chat/escalate | support-chat | duplicate (live in routes/) |
| 4031 | GET | /api/support-chat/config | support-chat | duplicate (live in routes/) |
| 4047 | PATCH | /api/support-chat/config | support-chat | duplicate (live in routes/) |
| 4055 | POST | /api/support-chat/transcribe | support-chat | duplicate (live in routes/) |
| 4092 | POST | /api/support-chat/close | support-chat | duplicate (live in routes/) |
| 4110 | POST | /api/support-chat/founder/message | support-chat | duplicate (live in routes/) |
| 4154 | GET | /api/support-chat/founder/sessions | support-chat | duplicate (live in routes/) |
| 4176 | POST | /api/support-chat/founder/reply | support-chat | duplicate (live in routes/) |
| 4251 | GET | /api/onboarding/status | onboarding | duplicate (live in routes/) |
| 4256 | PATCH | /api/onboarding/progress | onboarding | duplicate (live in routes/) |
| 4269 | POST | /api/onboarding/complete | onboarding | duplicate (live in routes/) |
| 4279 | POST | /api/onboarding/skip | onboarding | duplicate (live in routes/) |
| 4288 | POST | /api/onboarding/restart | onboarding | duplicate (live in routes/) |
| 4323 | GET | /api/agent-skills | agents | duplicate (live in routes/) |
| 4364 | POST | /api/agent-skills/execute | agents | duplicate (live in routes/) |
| 4570 | GET | /api/ai-agents | agents | duplicate (live in routes/) |
| 4576 | POST | /api/ai-agents | agents | duplicate (live in routes/) |
| 4603 | GET | /api/ai-sessions | agents | duplicate (live in routes/) |
| 4609 | POST | /api/ai-sessions | agents | duplicate (live in routes/) |
| 4632 | GET | /api/ai-sessions/:sessionId/messages | agents | duplicate (live in routes/) |
| 4641 | POST | /api/ai-sessions/:sessionId/close | agents | duplicate (live in routes/) |
| 4650 | POST | /api/ai-chat | agents | duplicate (live in routes/) |
| 4908 | GET | /api/agents | agents | duplicate (live in routes/) |
| 4919 | GET | /api/agents/:id | agents | duplicate (live in routes/) |
| 4933 | POST | /api/agents | agents | duplicate (live in routes/) |
| 4971 | PUT | /api/agents/:id | agents | duplicate (live in routes/) |
| 4994 | PATCH | /api/agents/:id | agents | duplicate (live in routes/) |
| 5019 | DELETE | /api/agents/:id | agents | duplicate (live in routes/) |
| 5058 | POST | /api/agents/:id/conversations | agents | duplicate (live in routes/) |
| 5089 | GET | /api/agents/:id/conversations | agents | duplicate (live in routes/) |
| 5147 | GET | /api/agent-conversations/:id | agents | duplicate (live in routes/) |
| 5203 | DELETE | /api/agent-conversations/:id | agents | duplicate (live in routes/) |
| 5232 | GET | /api/agents/sessions/list | agents | duplicate (live in routes/) |
| 5245 | POST | /api/agents/:agentId/sessions | agents | duplicate (live in routes/) |
| 5277 | GET | /api/agents/sessions/:sessionId | agents | duplicate (live in routes/) |
| 5289 | PATCH | /api/agents/sessions/:sessionId | agents | duplicate (live in routes/) |
| 5302 | DELETE | /api/agents/sessions/:sessionId | agents | duplicate (live in routes/) |
| 5317 | GET | /api/agents/sessions/:sessionId/messages | agents | duplicate (live in routes/) |
| 5328 | POST | /api/agents/sessions/:sessionId/messages | agents | duplicate (live in routes/) |
| 5344 | DELETE | /api/agents/sessions/:sessionId/messages | agents | duplicate (live in routes/) |
| 5358 | POST | /api/agent-voice/transcribe | agents | duplicate (live in routes/) |
| 5488 | POST | /api/agent-conversations/:id/files | agents | duplicate (live in routes/) |
| 5603 | GET | /api/agent-files/:id/thumbnail | agents | duplicate (live in routes/) |
| 5622 | GET | /api/agent-files/:id/download | agents | duplicate (live in routes/) |
| 5643 | POST | /api/agents/:agentId/execute-crm-tool | agents | duplicate (live in routes/) |
| 5669 | POST | /api/agents/:agentId/execute-crm-tools | agents | duplicate (live in routes/) |
| 5695 | POST | /api/agent-conversations/:id/confirm-tools | agents | duplicate (live in routes/) |
| 5753 | POST | /api/agent-conversations/:id/cancel-tools | agents | duplicate (live in routes/) |
| 5838 | POST | /api/agent-conversations/:id/messages | agents | duplicate (live in routes/) |
| 6068 | GET | /api/agent-skills | agents | duplicate (live in routes/) |
| 6108 | POST | /api/agent-skills/execute | agents | duplicate (live in routes/) |
| 6250 | GET | /api/gmail/oauth/authorize | gmail | duplicate (live in routes/) |
| 6255 | GET | /api/gmail/oauth/callback | gmail | duplicate (live in routes/) |
| 6287 | GET | /api/gmail/oauth/status | gmail | duplicate (live in routes/) |
| 6296 | POST | /api/gmail/oauth/disconnect | gmail | duplicate (live in routes/) |
| 6302 | POST | /api/gmail/sync | gmail | duplicate (live in routes/) |
| 6309 | POST | /api/gmail/send | gmail | duplicate (live in routes/) |
| 6404 | POST | /api/gmail/draft | gmail | duplicate (live in routes/) |
| 6454 | DELETE | /api/gmail/messages/:messageId | gmail | duplicate (live in routes/) |
| 6475 | GET | /api/gmail/messages/:messageId | gmail | duplicate (live in routes/) |
| 6509 | GET | /api/gmail/search | gmail | duplicate (live in routes/) |
| 6565 | PATCH | /api/interactions/mark-read | interactions | duplicate (live in routes/) |
