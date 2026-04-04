# Implementation Plan: Automation Page Performance & UX Overhaul

## Overview

Six phases, ordered by dependency and impact. Phases 0-1 are quick wins. Phase 2 is the core architectural change (server-side pagination). Phases 3-4 are the frontend rewrite. Phase 5 is the file split. Each phase can ship independently after Phase 0.

---

## Phase 0: Data cleanup + DB indexes (instant win)

Delete old logs and add the missing indexes so everything downstream benefits.

### Tasks
- [ ] Run SQL to delete oldest 4,400 logs, keeping ~77 most recent
- [ ] Add index on `createdAt` column (sort performance)
- [ ] Add index on `status` column (filter performance)
- [ ] Add index on `workflowExecutionId` column (execution grouping)
- [ ] Verify with `SELECT count(*) FROM "p2mxx34fvbf3ll6"."Automation_Logs"`

### Technical Details

**Delete SQL** (run via `sudo -u postgres psql -d nocodb`):
```sql
DELETE FROM "p2mxx34fvbf3ll6"."Automation_Logs"
WHERE id NOT IN (
  SELECT id FROM "p2mxx34fvbf3ll6"."Automation_Logs"
  ORDER BY created_at DESC LIMIT 77
);
```

**Indexes** in `shared/schema.ts` (~line 210, after existing `automation_logs_accounts_id_idx`):
```typescript
export const automationLogsCreatedAtIdx = index("automation_logs_created_at_idx")
  .on(automationLogs.createdAt);
export const automationLogsStatusIdx = index("automation_logs_status_idx")
  .on(automationLogs.status);
export const automationLogsExecIdIdx = index("automation_logs_exec_id_idx")
  .on(automationLogs.workflowExecutionId);
```

Then apply via raw SQL since we don't run Drizzle migrations:
```sql
CREATE INDEX IF NOT EXISTS automation_logs_created_at_idx
  ON "p2mxx34fvbf3ll6"."Automation_Logs" (created_at DESC);
CREATE INDEX IF NOT EXISTS automation_logs_status_idx
  ON "p2mxx34fvbf3ll6"."Automation_Logs" (status);
CREATE INDEX IF NOT EXISTS automation_logs_exec_id_idx
  ON "p2mxx34fvbf3ll6"."Automation_Logs" (workflow_execution_id);
```

---

## Phase 1: Summary API endpoint

Add a lightweight endpoint that returns aggregate stats via SQL. This powers the dashboard cards and is independent of the pagination work.

### Tasks
- [ ] Add `getAutomationLogsSummary(accountId?)` method to `server/storage.ts`
- [ ] Add `GET /api/automation-logs/summary` route to `server/routes.ts`
- [ ] Return: `{ totalExecutions, successRate, errorsToday, avgExecutionTimeMs, lastRunAt, topFailingWorkflows }`

### Technical Details

**Storage method** (`server/storage.ts` after line 686):
```typescript
async getAutomationLogsSummary(accountId?: number) {
  // Use raw SQL for aggregates since Drizzle doesn't support
  // complex GROUP BY with CASE expressions elegantly
  const where = accountId ? `WHERE "Accounts_id" = ${accountId}` : '';
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT workflow_execution_id) as total_executions,
      COUNT(*) FILTER (WHERE status = 'Failure') as error_count_total,
      COUNT(*) FILTER (WHERE status = 'Failure' AND created_at > NOW() - INTERVAL '24 hours') as errors_today,
      ROUND(AVG(execution_time_ms)) as avg_execution_time_ms,
      MAX(created_at) as last_run_at
    FROM "p2mxx34fvbf3ll6"."Automation_Logs"
    ${accountId ? sql`WHERE "Accounts_id" = ${accountId}` : sql``}
  `);
  // Top failing workflows: separate query
  const topFailing = await db.execute(sql`
    SELECT workflow_name, COUNT(*) as fail_count
    FROM "p2mxx34fvbf3ll6"."Automation_Logs"
    WHERE status = 'Failure'
    ${accountId ? sql`AND "Accounts_id" = ${accountId}` : sql``}
    GROUP BY workflow_name
    ORDER BY fail_count DESC
    LIMIT 3
  `);
  // Success rate: % of execution groups with zero failures
  const successRate = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE fail_count = 0) * 100.0 / NULLIF(COUNT(*), 0) as rate
    FROM (
      SELECT workflow_execution_id, COUNT(*) FILTER (WHERE status = 'Failure') as fail_count
      FROM "p2mxx34fvbf3ll6"."Automation_Logs"
      ${accountId ? sql`WHERE "Accounts_id" = ${accountId}` : sql``}
      GROUP BY workflow_execution_id
    ) sub
  `);
  return { ...result.rows[0], successRate: successRate.rows[0]?.rate, topFailingWorkflows: topFailing.rows };
}
```

**Route** (`server/routes.ts` after line 1881):
```typescript
app.get("/api/automation-logs/summary", requireAgency, wrapAsync(async (req, res) => {
  const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
  const data = await storage.getAutomationLogsSummary(accountId);
  res.json(data);
}));
```

---

## Phase 2: Server-side paginated query [complex]

Replace the unbounded `getAutomationLogs()` with a paginated, filtered, server-side query. This is the core performance fix.

### Tasks
- [ ] Add `getAutomationLogsPaginated(opts)` method to `server/storage.ts`
- [ ] Update `GET /api/automation-logs` route to accept pagination + filter params
- [ ] Paginate by execution groups (fetch N distinct `workflow_execution_id` values, then all rows for those IDs)
- [ ] Remove the 3 extra entity fetches (leads, accounts, campaigns) from the frontend
- [ ] Add a `GET /api/automation-logs/campaign-options` lightweight endpoint (or reuse existing campaigns list)

### Technical Details

**Pagination strategy**: Paginate by execution groups, not raw rows. This prevents splitting an execution's steps across pages.

```typescript
interface PaginatedLogsOpts {
  page: number;        // 0-indexed
  limit: number;       // default 50 (execution groups)
  accountId?: number;
  status?: 'success' | 'failed';
  workflowName?: string;
  dateFrom?: string;   // ISO date
  dateTo?: string;     // ISO date
}

async getAutomationLogsPaginated(opts: PaginatedLogsOpts) {
  // Step 1: Get distinct execution IDs matching filters, paginated
  // Step 2: Fetch all rows for those execution IDs
  // Step 3: Return { data, total, page, limit }
}
```

**Step 1 query** (get paginated execution IDs):
```sql
SELECT workflow_execution_id, MAX(created_at) as latest
FROM "p2mxx34fvbf3ll6"."Automation_Logs"
WHERE 1=1
  AND (accountId filter)
  AND (status filter: subquery checking if ANY step in exec has status = X)
  AND (workflowName ILIKE filter)
  AND (date range filter)
GROUP BY workflow_execution_id
ORDER BY latest DESC
LIMIT $limit OFFSET $page * $limit
```

**Step 2 query** (get all rows for those execution IDs):
```sql
SELECT * FROM "p2mxx34fvbf3ll6"."Automation_Logs"
WHERE workflow_execution_id IN (... ids from step 1 ...)
ORDER BY workflow_execution_id, step_number, created_at
```

**Count query** (for total pages):
```sql
SELECT COUNT(DISTINCT workflow_execution_id) as total
FROM "p2mxx34fvbf3ll6"."Automation_Logs"
WHERE (same filters as step 1)
```

**Route update** (`server/routes.ts` line 1875):
```typescript
app.get("/api/automation-logs", requireAgency, wrapAsync(async (req, res) => {
  const { page = '0', limit = '50', accountId, status, workflowName, dateFrom, dateTo } = req.query;
  const data = await storage.getAutomationLogsPaginated({
    page: Number(page),
    limit: Number(limit),
    accountId: accountId ? Number(accountId) : undefined,
    status: status as string | undefined,
    workflowName: workflowName as string | undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
  });
  res.json(data);
}));
```

**Entity enrichment**: Use the denormalized columns already in the table (`lead_name`, `campaign_name`, `account_name`). The frontend already renders these as fallback text. Remove the 3 extra fetches of `/api/leads`, `/api/accounts`, `/api/campaigns` from `AutomationLogs.tsx` lines 369-371.

---

## Phase 3: Frontend TanStack Query hooks

Replace the manual fetch + useState pattern with TanStack Query hooks for caching, background refetch, and `keepPreviousData` during pagination.

### Tasks
- [ ] Create `client/src/features/automation/hooks/useAutomationLogs.ts` with two hooks
- [ ] `useAutomationLogs(filters)`: paginated logs with `keepPreviousData`
- [ ] `useAutomationSummary(accountId)`: summary stats, refetch every 60s
- [ ] Remove `fetchData` useCallback, `automationLogs`/`allLeads`/`allAccounts`/`allCampaigns` useState, and the `useEffect` that calls `fetchData()` from `AutomationLogs.tsx`

### Technical Details

**File**: `client/src/features/automation/hooks/useAutomationLogs.ts`

Follow the pattern from `client/src/features/tasks/api/tasksApi.ts` (TanStack Query already used there).

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

interface AutomationLogsFilters {
  page: number;
  limit: number;
  accountId?: number;
  status?: string;
  workflowName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useAutomationLogs(filters: AutomationLogsFilters) {
  return useQuery({
    queryKey: ["automation-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(filters.page));
      params.set("limit", String(filters.limit));
      if (filters.accountId) params.set("accountId", String(filters.accountId));
      if (filters.status) params.set("status", filters.status);
      if (filters.workflowName) params.set("workflowName", filters.workflowName);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const res = await apiFetch(`/api/automation-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch automation logs");
      return res.json();
    },
    keepPreviousData: true,
  });
}

export function useAutomationSummary(accountId?: number) {
  return useQuery({
    queryKey: ["automation-logs-summary", accountId],
    queryFn: async () => {
      const qs = accountId ? `?accountId=${accountId}` : "";
      const res = await apiFetch(`/api/automation-logs/summary${qs}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
```

---

## Phase 4: Dashboard summary cards + updated page

Build the summary cards component and rewire the page to use the new hooks.

### Tasks
- [ ] Create `client/src/features/automation/components/AutomationSummaryCards.tsx`
- [ ] Add i18n keys for all card labels in `client/src/locales/{en,nl,pt}/automation.json`
- [ ] Rewire `AutomationLogs.tsx` to use `useAutomationLogs` and `useAutomationSummary` hooks
- [ ] Replace client-side filtering with server-side query params
- [ ] Remove the O(n^2) `.find()` enrichment and sibling propagation code (lines 396-449)
- [ ] Keep `useExecutionGroups` hook but feed it the pre-paginated data (no more full-dataset grouping)

### Technical Details

**Summary cards component** (new file: `features/automation/components/AutomationSummaryCards.tsx`, ~100 lines):

5 cards in a responsive grid:
| Card | Data | Color logic |
|------|------|-------------|
| Total Executions | `totalExecutions` | Neutral |
| Success Rate | `successRate` | Green >95%, Yellow >80%, Red <80% |
| Errors Today | `errorsToday` | Red if >0, neutral if 0 |
| Avg Duration | `avgExecutionTimeMs` | Format as "Xms" or "X.Xs" |
| Last Run | `lastRunAt` | Relative time, red if >10min ago |

Grid layout: `grid grid-cols-2 md:grid-cols-5 gap-2 px-4 py-2`

**i18n keys** to add (automation namespace):
```json
{
  "summary": {
    "totalExecutions": "Total Executions",
    "successRate": "Success Rate",
    "errorsToday": "Errors Today",
    "avgDuration": "Avg Duration",
    "lastRun": "Last Run",
    "neverRun": "Never",
    "healthy": "Healthy",
    "degraded": "Degraded",
    "failing": "Failing"
  }
}
```

**Page rewiring**: The page component drops from ~1,261 lines to ~400 lines after removing:
- `fetchData` useCallback (lines 359-391)
- 4 useState for data (lines 342-345)
- Client-side filter/sort/enrich logic (lines 396-449)
- Entity lookup maps

---

## Phase 5: File decomposition

Split the remaining page code into focused modules. Do this after Phase 4 so we're splitting the already-simplified code, not the bloated original.

### Tasks
- [ ] Extract `AutomationFilters.tsx` (toolbar filter bar)
- [ ] Extract `ExecutionTable.tsx` (desktop steps table view)
- [ ] Extract `ExecutionCardsView.tsx` (desktop execution groups view)
- [ ] Extract `ExecutionMobileCards.tsx` (mobile card layout)
- [ ] Extract `LogDetailPanel.tsx` (expanded row detail with input/output JSON)
- [ ] Slim `AutomationLogs.tsx` to page shell (~150 lines)

### Target file structure

```
client/src/
  pages/
    AutomationLogs.tsx                          (~150 lines, page shell)
  features/automation/
    components/
      AutomationSummaryCards.tsx                 (~100 lines, Phase 4)
      AutomationFilters.tsx                     (~120 lines, filter toolbar)
      ExecutionTable.tsx                         (~200 lines, steps table)
      ExecutionCardsView.tsx                     (~200 lines, execution groups)
      ExecutionMobileCards.tsx                   (~150 lines, mobile cards)
      LogDetailPanel.tsx                         (~100 lines, expanded detail)
      ExecutionProgressBar.tsx                   (existing, keep as-is)
      PipelineView.tsx                           (existing, keep as-is)
    hooks/
      useAutomationLogs.ts                      (~80 lines, Phase 3)
      useExecutionGroups.ts                     (existing, keep as-is)
    automationRegistry.ts                       (existing, keep as-is)
```

### Technical Details

**AutomationFilters.tsx** props:
```typescript
interface AutomationFiltersProps {
  campaigns: { id: number | string; name: string }[];
  campaignId: string;
  setCampaignId: (id: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  workflowFilter: string;
  setWorkflowFilter: (s: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  activeFilterCount: number;
  loading: boolean;
  onRefresh: () => void;
}
```

Extract from `AutomationLogs.tsx` lines 534-655 (the toolbar section between the ViewTabBar and the content area).

**ExecutionTable.tsx** (desktop steps view): Extract the `<table>` rendering for the "steps" view mode.

**ExecutionCardsView.tsx** (desktop executions view): Extract the execution group cards rendering.

**LogDetailPanel.tsx**: Extract the expandable row detail that shows `input_data`, `output_data`, `error_code` JSON.

---

## Verification

After each phase, verify:

1. **Phase 0**: `SELECT count(*) FROM "p2mxx34fvbf3ll6"."Automation_Logs"` returns ~77. Check `pm2 logs` for errors.
2. **Phase 1**: `curl http://localhost:3000/api/automation-logs/summary` returns valid JSON with correct aggregates. Response time <100ms.
3. **Phase 2**: `curl "http://localhost:3000/api/automation-logs?page=0&limit=10"` returns `{ data: [...], total: N, page: 0, limit: 10 }`. Response under 50KB.
4. **Phase 3-4**: Load `app.leadawaker.com/automation-logs`. Page loads in <1s. Summary cards show. Pagination next/prev works. Both view modes work. Filters work. Mobile layout works.
5. **Phase 5**: TypeScript check passes (pm2 hook). All functionality still works. No file >500 lines.

## Execution Strategy

- **Phase 0** first (shrinks dataset, unblocks everything)
- **Phases 1 + 2** in parallel subagents (backend, independent of each other)
- **Phases 3 + 4** together (frontend, depends on Phase 2 API)
- **Phase 5** last (mechanical refactor of the simplified code)
