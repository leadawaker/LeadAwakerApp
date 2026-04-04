# Requirements: Automation Page Performance & UX Overhaul

## What & Why

The Automation Logs page (`/agency/automation-logs`) loads slowly and provides little reason to visit regularly. Root causes:

1. **Unbounded API calls**: On mount, the page fires 4 parallel fetches (all logs + all leads + all accounts + all campaigns) with zero pagination. With 4,477 logs, this transfers several MB of JSON before anything renders.
2. **O(n^2) client-side enrichment**: For each log, `.find()` scans the full leads/accounts/campaigns arrays. Then a second O(n^2) pass propagates missing campaign/account from sibling execution steps.
3. **Missing DB indexes**: Only `accountsId` is indexed. Sorting by `createdAt` and filtering by `status` or `workflowExecutionId` triggers full table scans.
4. **No operational value**: The page is a forensic log viewer. There's no summary, no health indicators, no quick way to see "are my automations healthy right now?"
5. **Monolith file**: `AutomationLogs.tsx` is 1,261 lines, making it slow to load into context and hard to maintain.

This overhaul makes the page fast, operationally useful, and maintainable.

## Functional Requirements

### F1: Data cleanup
- Delete the 4,400 oldest automation logs, keeping only the ~77 most recent
- Tighten the existing cleanup cron (currently 3-day retention) if needed

### F2: Server-side pagination
- API returns paginated results with `{ data, total, page, limit }` shape
- Pagination operates on execution groups (complete workflows), not individual step rows
- All current filters (campaign, status, workflow name, date range) move to server-side WHERE clauses
- Default page size: 50 execution groups

### F3: Summary/health endpoint
- New endpoint returns aggregate stats computed via SQL (not client-side):
  - Total executions (distinct `workflow_execution_id` count)
  - Success rate (% of executions where all steps succeeded)
  - Errors in last 24h
  - Average execution time
  - Last run timestamp
  - Top 3 failing workflows (name + count)

### F4: Dashboard summary cards
- Row of stat cards above the table showing health at a glance
- Success rate: color-coded (green >95%, yellow >80%, red <80%)
- Errors today: highlighted red when >0
- Last run: relative time ("2 min ago")
- Auto-refreshes every 60 seconds

### F5: Eliminate unnecessary API calls
- Stop fetching all leads, all accounts, all campaigns on page load
- Use the already-denormalized `lead_name`, `campaign_name`, `account_name` columns in the logs table
- Campaign filter dropdown: populated from a lightweight distinct-values query or from the existing campaigns sidebar data

### F6: File decomposition
- Split the 1,261-line monolith into focused files under 300 lines each
- Page file becomes a thin shell wiring hooks and layout

## Acceptance Criteria

### Performance
- [ ] Page loads in under 1 second on the Raspberry Pi (currently 3-5s)
- [ ] Initial API response is under 50KB (currently several MB)
- [ ] No O(n^2) loops remain in the client-side data pipeline
- [ ] DB indexes exist on `createdAt`, `status`, and `workflowExecutionId`

### Server-side pagination
- [ ] API accepts `page`, `limit`, `status`, `workflowName`, `dateFrom`, `dateTo`, `accountId` query params
- [ ] Response shape: `{ data: LogRow[], total: number, page: number, limit: number }`
- [ ] Changing a filter resets to page 1
- [ ] Execution groups are never split across pages (all steps of a group appear together)

### Summary dashboard
- [ ] Summary endpoint responds in <100ms
- [ ] Stat cards render above the table with correct values
- [ ] Cards auto-refresh every 60s without full page reload
- [ ] All card labels go through i18n (`automation` namespace, all 3 locales)

### Cleanup
- [ ] After deletion, table contains ~77 rows
- [ ] Existing page functionality (both views, filters, expand/collapse) still works

### Code quality
- [ ] No file exceeds 500 lines
- [ ] Page component is under 200 lines
- [ ] All new strings use i18n keys in en/nl/pt

## Dependencies

- `shared/schema.ts` (Drizzle schema, automation_logs table definition, lines 173-212)
- `server/storage.ts` (storage methods, lines 664-686)
- `server/routes.ts` (API route, line 1875)
- `client/src/pages/AutomationLogs.tsx` (main page, 1,261 lines)
- `client/src/features/automation/hooks/useExecutionGroups.ts` (grouping hook)
- `client/src/features/automation/components/ExecutionProgressBar.tsx`
- `client/src/features/automation/components/PipelineView.tsx`
- `client/src/features/automation/automationRegistry.ts`
- `scripts/cleanup-automation-logs.sh` (nightly cron)
- TanStack Query (already in the project, not yet used on this page)

## Out of Scope

- Changing the Python automation engine's logging behavior
- Adding new automation types or workflows
- Real-time SSE/WebSocket log streaming
- Log export functionality
