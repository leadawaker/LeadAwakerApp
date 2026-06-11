# Session A — Server Structural Debt

Read `specs/structural-debt/README.md` first (ownership boundaries, hard rules, no tsc).

**Why:** `server/routes.ts` is 6,574 lines and `server/storage.ts` is 1,809 lines with 175 methods. A `server/routes/` folder exists but extraction stalled halfway: routes.ts STILL contains ~20 lead endpoints, ~18 agent endpoints, ~15 notification endpoints, etc., alongside the extracted files. Finish the extraction, then split storage, then split the Settings page.

## Milestone 1 — Inventory (no edits)

Map every endpoint in `server/routes.ts`: method, path, line number, domain. Check each domain against the existing `server/routes/*.ts` files (accounts, ai-agents, auth, automation, billing, campaigns, conversations, demo, gmail, leads, tasks, twilio-voice, user-settings) to find:
- endpoints that belong in an existing file but were never moved,
- true duplicates (same method+path registered in both places — flag these, decide which wins by reading both),
- domains with no file yet.

Known domains still in routes.ts by endpoint count: leads (20), agents (18), notifications (15), prospects (14), support-chat (12), gmail (10), accounts (10), campaigns (9), tasks (8), invoices (8), contracts (8), interactions (7), users (6), expenses (6), agent-conversations (6), outreach-templates (5), onboarding (5), task-categories (4), tags (4), prompts (4), ai-sessions (4), agent-skills (4), subtasks (2), campaign-metrics-history (2), automation-logs (2).

Output the inventory as a table in `specs/structural-debt/session-a-inventory.md` before moving anything.

## Milestone 2 — Finish routes extraction

One domain at a time, largest first. For each domain:
1. Create or extend the file in `server/routes/` (e.g. `prospects.ts`, `notifications.ts`, `interactions.ts`, `prompts.ts`, `tags.ts`, `support-chat.ts`, `outreach-templates.ts`). Group small related domains: invoices+contracts+expenses → extend `billing.ts`; tasks+task-categories+subtasks → extend `tasks.ts`; agents+agent-conversations+agent-skills+ai-sessions → extend `ai-agents.ts`.
2. Move handlers verbatim. Preserve middleware chains (`requireAuth`, `scopeToAccount`, etc.) and registration order exactly.
3. Register the router in `server/routes/index.ts` following the existing pattern.
4. Delete the moved block from routes.ts.
5. Verify: tsx watch reloads cleanly in `pm2 logs`, curl 2–3 endpoints of that domain.
6. Commit: `refactor(server): extract <domain> routes`.

End state: routes.ts is only bootstrap/wiring (target <300 lines), or deleted entirely with wiring in `routes/index.ts`.

## Milestone 3 — Split storage.ts

Split the 175 methods into domain modules: `server/storage/leads.ts`, `accounts.ts`, `campaigns.ts`, `interactions.ts`, `tasks.ts`, `billing.ts`, `prospects.ts`, `agents.ts`, `misc.ts` — mirror the route-domain boundaries from Milestone 2.

Keep `server/storage.ts` as a barrel that re-exports a composed `storage` object with the exact same method names, so NO route file import changes. Verify the app still serves after each module moves; commit per module.

While moving, flag (don't fix) in your summary: methods with zero callers (grep route files), and the known N+1 in `reorderSubtasks` (storage.ts ~line 1565).

## Milestone 4 — Split Settings.tsx (1,748 lines)

`client/src/pages/Settings.tsx` → create `client/src/features/settings/components/` with one file per section (Profile, Workspace, Notifications, Integrations, etc. — read the file to find the natural section seams; `SettingsTeamSection.tsx` already exists in features/users as the pattern to follow). Settings.tsx becomes a thin composition (<200 lines). No visual changes: move JSX verbatim, including the existing hardcoded `bg-white dark:bg-card` classes (dark-mode fixes are a separate task, not this one).

Verify by loading the Settings page and clicking through each tab.

## Final summary must include

- Endpoint inventory results, duplicates found and which copy won
- Any cross-boundary edits you needed but skipped
- Dead storage methods found
- A list of moved files for Session B to fold into FILE_MAP.md
