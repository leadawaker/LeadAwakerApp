# Automation Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every automation writes an honest per-client diary, and the CRM shows it in a refreshed global Automations page and a new per-client Automations tab.

**Architecture:** The Python engine (`/home/gabriel/automations`) writes one `Automation_Logs` row per real action (`kind='action'`) through a never-raising `record_action()`, and exposes per-job run health from an APScheduler listener on `/api/jobs-health`. The CRM (`/home/gabriel/LeadAwakerApp`) holds a typed catalogue in `shared/`, pure functions for health and per-client gates in `server/automations/`, three owner-only endpoints, and two UIs.

**Tech Stack:** Python 3 / asyncpg / APScheduler 3 / pytest (engine). React + Vite + TanStack Query + react-i18next, Express + Drizzle + PostgreSQL, `node:test` via tsx (CRM).

**Spec:** `specs/automation-overview/requirements.md`

## Global Constraints

- Schema: `"p2mxx34fvbf3ll6"`. Table: `"p2mxx34fvbf3ll6"."Automation_Logs"`. Use the capitalised id columns `"Accounts_id"`, `"Campaigns_id"`, `"Leads_id"`; never the lowercase duplicates.
- Diary rows: `kind = 'action'`. Outcomes: engine `"success" | "failed" | "skipped"` → `status` `Success` / `Failure` / `Skipped`.
- Reason text max 200 chars, never message content.
- Retention: non-action rows 2 days, action rows 90 days.
- Every new CRM endpoint uses `requireOwner` (from `server/auth.ts`). The tab is shown only when `useWorkspace().isOwner`.
- i18n: every user-facing string through react-i18next. Namespace `automation` (rewritten) for both views; tab label in `accounts` namespace `workspace.tabs.automations`. Locales en, nl, pt. Portuguese is Brazilian.
- No em dashes in any copy or comments.
- Colors only from tokens: `var(--good)`, `var(--warn)`, `var(--destructive)`, `var(--mute)`, `var(--ink)`, `var(--line)`, `var(--surface)`, `var(--bg)`, `var(--wine)`. No raw hex in components.
- Pages use `.la-page` + `.la-page-header` (UI_PATTERNS.md §0). Rows use `ListCard`, group titles `GroupHeader`, badges `Pill` from `@/components/crm/primitives`. No backdrop dialogs (side panel, not modal).
- Never run `npm run dev` or `npx tsc`. The CRM live-reloads via pm2. Never restart `leadawaker-engine` yourself; the controller asks Gabriel.
- Engine tests: `cd /home/gabriel/automations && python -m pytest tests/<file> -v`. CRM tests: `cd /home/gabriel/LeadAwakerApp && node --import tsx --test <file>`.
- Git: both repos contain other sessions' uncommitted work. `git add` only the exact files you changed, never `git add -A` / `.`. In `/home/gabriel/automations`, only commit if the controller's task brief says engine commits are allowed; otherwise leave changes uncommitted and say so in your report.
- Files stay under ~500 lines; split when a new file would exceed it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The diary write fails** (pool exhausted, DB blip) → the WhatsApp still goes out and the automation behaves exactly as if logging succeeded. Pinned in Task 2 tests (`test_record_action_swallows_db_error`, `test_async_log_step_keeps_original_exception`).
2. **Engine is down or still on the old version** (no `last_run_at` fields) → the global page renders, scheduled dots go grey "unknown" or schedule-based healthy, nothing crashes. Pinned in Task 6 tests (`old engine payload`, `engine unreachable`).
3. **An account with no campaigns, no voice line, no widget** → client tab renders all account-level lines with OFF / ALWAYS ON and zero counts, no empty-array crash. Pinned in Task 7 test (`empty account`).
4. **Workflow names the catalogue does not know** (new engine job, old diary rows) → shown in an "Unlisted" group with the raw id, never dropped. Pinned in Task 6 test (`unlisted job and diary name`).
5. **Campaign status casing** (`Active` vs `active` vs `Paused`) → treated case-insensitively. Pinned in Task 7 test (`lowercase status`).

---

### Task 1: Diary column, indexes, schema, retention

**Files:**
- Create: `scripts/migrate-automation-logs-kind.mjs`
- Modify: `shared/schema.ts:511-543` (automationLogs table)
- Modify: `/home/gabriel/scripts/cleanup-automation-logs.sh`

**Interfaces:**
- Produces: column `kind text NULL` on Automation_Logs; drizzle fields `kind`, `skippedReason`, `isCriticalError` on `automationLogs`.

- [ ] **Step 1: Write the migration script**

```js
// scripts/migrate-automation-logs-kind.mjs
// One-off: adds the diary marker column + partial indexes (specs/automation-overview).
// Run: node scripts/migrate-automation-logs-kind.mjs
import pg from "pg";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => /^DATABASE_URL=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL || env.DATABASE_URL });
const T = `"p2mxx34fvbf3ll6"."Automation_Logs"`;

await client.connect();
try {
  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS kind text`);
  await client.query(`CREATE INDEX IF NOT EXISTS automation_logs_action_account_idx ON ${T} ("Accounts_id", created_at DESC) WHERE kind = 'action'`);
  await client.query(`CREATE INDEX IF NOT EXISTS automation_logs_action_workflow_idx ON ${T} (workflow_name, created_at DESC) WHERE kind = 'action'`);
  const dup = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'p2mxx34fvbf3ll6' AND tablename = 'Automation_Logs' AND indexdef ILIKE '%(created_at)%'`);
  console.log("created_at indexes:", dup.rows);
  console.log("done");
} finally {
  await client.end();
}
```

- [ ] **Step 2: Run it and drop the duplicate ASC created_at index**

Run: `node scripts/migrate-automation-logs-kind.mjs`
Expected: `done`, plus a list of created_at indexes. Keep `automation_logs_created_at_idx` (the one drizzle declares). Drop any other plain `(created_at)` ASC index it lists, by name:
`psql "$DATABASE_URL" -c 'DROP INDEX IF EXISTS "p2mxx34fvbf3ll6".<name>'` (get DATABASE_URL with `grep ^DATABASE_URL= .env`; do not `source .env`, it has unquoted values). If the only other one is a DESC index, keep both and note it in your report.

Verify: `psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='Automation_Logs' and column_name='kind'"` returns one row.

- [ ] **Step 3: Update the drizzle table**

In `shared/schema.ts`, inside `automationLogs`, after `leadId: bigint("lead_id", { mode: "number" }),` add:

```ts
  skippedReason: text("skipped_reason"),
  isCriticalError: boolean("is_critical_error"),
  // 'action' = one diary line per real automation action (specs/automation-overview).
  // NULL = debug step row (2-day retention).
  kind: text("kind"),
```

Check `skipped_reason` and `is_critical_error` exist with: `psql "$DATABASE_URL" -c "select column_name, data_type from information_schema.columns where table_name='Automation_Logs' and column_name in ('skipped_reason','is_critical_error')"`. If `is_critical_error` is not boolean, use the matching drizzle type.

- [ ] **Step 4: Update the cleanup script**

Replace the body of `/home/gabriel/scripts/cleanup-automation-logs.sh` with:

```bash
#!/bin/bash
# Automation_Logs retention (specs/automation-overview):
#   debug step rows (kind IS NULL)  -> keep STEP_DAYS (default 2)
#   diary rows (kind = 'action')    -> keep ACTION_DAYS (default 90)
# Safe to run manually or via cron.

STEP_DAYS=${1:-2}
ACTION_DAYS=${2:-90}
SCHEMA='p2mxx34fvbf3ll6'

echo "Deleting step rows older than $STEP_DAYS days and diary rows older than $ACTION_DAYS days..."

RESULT=$(sudo -u postgres psql -d nocodb -At -c \
  "DELETE FROM \"$SCHEMA\".\"Automation_Logs\"
   WHERE (kind IS DISTINCT FROM 'action' AND created_at < NOW() - INTERVAL '$STEP_DAYS days')
      OR (kind = 'action' AND created_at < NOW() - INTERVAL '$ACTION_DAYS days')
   RETURNING id;" | wc -l)

echo "Deleted $RESULT rows."
```

Dry check (no delete): `sudo -u postgres psql -d nocodb -At -c "select count(*) from \"p2mxx34fvbf3ll6\".\"Automation_Logs\" where (kind is distinct from 'action' and created_at < now() - interval '2 days') or (kind = 'action' and created_at < now() - interval '90 days')"` runs without error.

- [ ] **Step 5: Commit (CRM repo only; the cleanup script is outside git)**

```bash
cd /home/gabriel/LeadAwakerApp
git add scripts/migrate-automation-logs-kind.mjs shared/schema.ts
git commit -m "feat(automations): diary kind column, partial indexes, 90-day diary retention

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine diary helper and safe log writes

**Files:**
- Modify: `/home/gabriel/automations/tools/db/automation_logs.py` (add `kind` param)
- Modify: `/home/gabriel/automations/src/automations/automation_logger.py`
- Test: `/home/gabriel/automations/tests/test_automation_logger.py`

**Interfaces:**
- Consumes: column `kind` (Task 1).
- Produces:
  - `async def record_action(automation: str, action: str, outcome: str, *, account_id: int | None, campaign_id: int | None = None, lead_id: int | None = None, reason: str | None = None, code: str | None = None, ref: dict | None = None) -> None` in `src.automations.automation_logger`. Never raises.
  - `log_step(...)` returns `0` instead of raising when the insert fails.
  - `insert_log(..., kind: str | None = None)`.
  - Row mapping: `workflow_name=automation`, `step_name=action`, `kind='action'`; failed → `status='Failure'`, `error_code=code or 'failed'`, `output_data=reason`; skipped → `status='Skipped'`, `skipped_reason=reason`; success → `status='Success'`; `metadata=json.dumps(ref)` when ref.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_automation_logger.py
import json
import pytest

import src.automations.automation_logger as al


@pytest.fixture
def captured(monkeypatch):
    calls = []

    async def fake_insert(**kw):
        calls.append(kw)
        return 1

    monkeypatch.setattr(al, "insert_log", fake_insert)
    return calls


@pytest.fixture
def broken_db(monkeypatch):
    async def boom(**kw):
        raise RuntimeError("pool exhausted")

    monkeypatch.setattr(al, "insert_log", boom)


async def test_record_action_success_row(captured):
    await al.record_action("bump_scheduler", "sent_bump_2", "success",
                           account_id=5, campaign_id=7, lead_id=9, ref={"interaction_id": 11})
    row = captured[0]
    assert row["workflow_name"] == "bump_scheduler"
    assert row["step_name"] == "sent_bump_2"
    assert row["status"] == "Success"
    assert row["kind"] == "action"
    assert (row["accounts_id"], row["campaigns_id"], row["leads_id"]) == (5, 7, 9)
    assert json.loads(row["metadata"]) == {"interaction_id": 11}


async def test_record_action_failed_row(captured):
    await al.record_action("booking_reminder", "sent_reminder_24h", "failed",
                           account_id=5, reason="x" * 300, code="63016")
    row = captured[0]
    assert row["status"] == "Failure"
    assert row["error_code"] == "63016"
    assert row["output_data"] == "x" * 200


async def test_record_action_skipped_row(captured):
    await al.record_action("inbound_handler", "received_message", "skipped",
                           account_id=5, reason="opted_out")
    row = captured[0]
    assert row["status"] == "Skipped"
    assert row["skipped_reason"] == "opted_out"


async def test_record_action_unknown_outcome_is_failure(captured):
    await al.record_action("x", "y", "weird", account_id=1)
    assert captured[0]["status"] == "Failure"


async def test_record_action_swallows_db_error(broken_db):
    # Must not raise: a diary hiccup can never break a send.
    assert await al.record_action("x", "y", "success", account_id=1) is None


async def test_log_step_swallows_db_error(broken_db):
    assert await al.log_step(workflow_name="x", step_name="y") == 0


async def test_async_log_step_keeps_original_exception(broken_db):
    with pytest.raises(ValueError, match="real problem"):
        async with al.AsyncLogStep("x", "y", accounts_id=1):
            raise ValueError("real problem")


async def test_async_log_step_success_does_not_raise_on_db_error(broken_db):
    async with al.AsyncLogStep("x", "y", accounts_id=1) as step:
        step.output = "ok"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/gabriel/automations && python -m pytest tests/test_automation_logger.py -v`
Expected: FAIL (`record_action` missing; broken_db tests raise RuntimeError).

- [ ] **Step 3: Add `kind` to insert_log**

In `tools/db/automation_logs.py`, add `kind: str | None = None,` to the signature after `is_critical_error`, add `kind` to the column list after `is_critical_error`, add one placeholder (`$19`) and pass `kind` after `is_critical_error` in the values:

```python
            f'duration_seconds, is_critical_error, kind, '
            f'created_at, updated_at) '
            f'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW()) '
            f'RETURNING id',
            workflow_name, step_name, status,
            accounts_id, campaigns_id, leads_id,
            workflow_execution_id, step_number, error_code,
            input_data, output_data, execution_time_ms, retry_count,
            metadata, skipped_reason, performance_score,
            duration_seconds, is_critical_error, kind,
```

- [ ] **Step 4: Make log_step safe and add record_action**

In `src/automations/automation_logger.py`:

Add `import json` at the top and a constant under `log = structlog.get_logger()`:

```python
_WRITE_TIMEOUT_S = 2.0
_OUTCOME_STATUS = {"success": "Success", "failed": "Failure", "skipped": "Skipped"}
```

Replace the `log_id = await insert_log(...)` block in `log_step` with:

```python
    try:
        log_id = await asyncio.wait_for(insert_log(
            workflow_name=workflow_name,
            step_name=step_name,
            status=status,
            accounts_id=accounts_id,
            campaigns_id=campaigns_id,
            leads_id=leads_id,
            workflow_execution_id=workflow_execution_id,
            step_number=step_number,
            error_code=error_code,
            input_data=input_data,
            output_data=output_data,
            execution_time_ms=execution_time_ms,
            skipped_reason=skipped_reason,
            is_critical_error=is_critical_error,
            metadata=metadata,
        ), timeout=_WRITE_TIMEOUT_S)
    except Exception as exc:
        # A log write must never turn a successful send into a failure, nor
        # replace the caller's real exception (AsyncLogStep.__aexit__).
        log.warning("automation_logger.write_failed", workflow=workflow_name,
                    step=step_name, error=str(exc)[:200])
        return 0
```

Add after `log_step`:

```python
async def record_action(
    automation: str,
    action: str,
    outcome: str,
    *,
    account_id: int | None,
    campaign_id: int | None = None,
    lead_id: int | None = None,
    reason: str | None = None,
    code: str | None = None,
    ref: dict | None = None,
) -> None:
    """Write one diary line: one real thing an automation did for a client.

    outcome: "success" | "failed" | "skipped". reason: short, no message
    content (max 200 chars). ref: {"interaction_id": n} or {"voice_call_id": n}.
    Never raises. "Checked and found nothing to do" is NOT an action.
    See specs/automation-overview/requirements.md.
    """
    status = _OUTCOME_STATUS.get(outcome)
    if status is None:
        log.warning("automation_logger.bad_outcome", automation=automation, outcome=outcome)
        status = "Failure"
    reason_txt = reason[:200] if reason else None
    try:
        await asyncio.wait_for(insert_log(
            workflow_name=automation,
            step_name=action,
            status=status,
            accounts_id=account_id,
            campaigns_id=campaign_id,
            leads_id=lead_id,
            error_code=(code or "failed") if status == "Failure" else None,
            output_data=reason_txt if status == "Failure" else None,
            skipped_reason=reason_txt if status == "Skipped" else None,
            metadata=json.dumps(ref) if ref else None,
            kind="action",
        ), timeout=_WRITE_TIMEOUT_S)
    except Exception as exc:
        log.warning("automation_logger.action_write_failed", automation=automation,
                    action=action, error=str(exc)[:200])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_automation_logger.py -v`
Expected: 8 passed.

- [ ] **Step 6: Commit (only if engine commits are allowed, see Global Constraints)**

```bash
cd /home/gabriel/automations
git add tools/db/automation_logs.py src/automations/automation_logger.py tests/test_automation_logger.py
git commit -m "feat(automations): record_action diary helper; log writes never break a send

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Engine job-run health

**Files:**
- Create: `/home/gabriel/automations/src/scheduler/run_tracker.py`
- Modify: `/home/gabriel/automations/src/scheduler/jobs.py` (register listener; catalogue pointer comment)
- Modify: `/home/gabriel/automations/src/main.py:295-310` (`/api/jobs-health`)
- Modify: `/home/gabriel/automations/CLAUDE.md` (catalogue pointer)
- Test: `/home/gabriel/automations/tests/test_run_tracker.py`

**Interfaces:**
- Produces: `/api/jobs-health` JSON:
  ```json
  {"scheduler_running": true, "started_at": "ISO", "jobs": [
    {"id": "bump_scheduler", "name": "Bump Scheduler", "next_run_at": "ISO|null",
     "last_run_at": "ISO|null", "last_ok": true, "last_error": "str|null", "errors_24h": 0}
  ]}
  ```
- `run_tracker` module-level singleton `tracker: JobRunTracker` with `on_event(event)`, `snapshot(job_id) -> dict`, `started_at: datetime`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_run_tracker.py
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from src.scheduler.run_tracker import JobRunTracker


def _clock(start):
    state = {"now": start}
    return state, (lambda: state["now"])


def test_unknown_job_snapshot_is_empty():
    t = JobRunTracker()
    assert t.snapshot("nope") == {"last_run_at": None, "last_ok": None, "last_error": None, "errors_24h": 0}


def test_success_then_error():
    start = datetime(2026, 10, 9, 12, tzinfo=timezone.utc)
    state, clock = _clock(start)
    t = JobRunTracker(clock=clock)
    t.on_event(SimpleNamespace(job_id="bump_scheduler", exception=None))
    snap = t.snapshot("bump_scheduler")
    assert snap["last_ok"] is True and snap["last_run_at"] == start.isoformat()

    state["now"] = start + timedelta(minutes=5)
    t.on_event(SimpleNamespace(job_id="bump_scheduler", exception=KeyError("lead_id")))
    snap = t.snapshot("bump_scheduler")
    assert snap["last_ok"] is False
    assert snap["last_error"].startswith("KeyError")
    assert snap["errors_24h"] == 1


def test_errors_older_than_24h_drop_off():
    start = datetime(2026, 10, 9, 12, tzinfo=timezone.utc)
    state, clock = _clock(start)
    t = JobRunTracker(clock=clock)
    t.on_event(SimpleNamespace(job_id="j", exception=RuntimeError("x")))
    state["now"] = start + timedelta(hours=25)
    t.on_event(SimpleNamespace(job_id="j", exception=None))
    assert t.snapshot("j")["errors_24h"] == 0


def test_error_text_is_capped():
    t = JobRunTracker()
    t.on_event(SimpleNamespace(job_id="j", exception=RuntimeError("y" * 500)))
    assert len(t.snapshot("j")["last_error"]) <= 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_run_tracker.py -v`
Expected: FAIL with `ModuleNotFoundError: src.scheduler.run_tracker`.

- [ ] **Step 3: Implement the tracker**

```python
# src/scheduler/run_tracker.py
"""In-memory per-job run health for the CRM Automations page.

Fed by an APScheduler listener (EVENT_JOB_EXECUTED | EVENT_JOB_ERROR) and read
by /api/jobs-health. Resets on engine restart; the CRM shows "not run since
restart" in that case. See specs/automation-overview/requirements.md.
"""

from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Callable

_WINDOW = timedelta(hours=24)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobRunTracker:
    def __init__(self, clock: Callable[[], datetime] = _utcnow):
        self._clock = clock
        self.started_at = clock()
        self._runs: dict[str, dict] = {}
        self._errors: dict[str, deque] = {}

    def on_event(self, event) -> None:
        now = self._clock()
        exc = getattr(event, "exception", None)
        run = self._runs.setdefault(event.job_id, {})
        run["last_run_at"] = now
        run["last_ok"] = exc is None
        if exc is not None:
            run["last_error"] = f"{type(exc).__name__}: {exc}"[:200]
            self._errors.setdefault(event.job_id, deque()).append(now)
        self._prune(event.job_id, now)

    def _prune(self, job_id: str, now: datetime) -> None:
        q = self._errors.get(job_id)
        while q and now - q[0] > _WINDOW:
            q.popleft()

    def snapshot(self, job_id: str) -> dict:
        run = self._runs.get(job_id)
        if not run:
            return {"last_run_at": None, "last_ok": None, "last_error": None, "errors_24h": 0}
        self._prune(job_id, self._clock())
        return {
            "last_run_at": run["last_run_at"].isoformat(),
            "last_ok": run["last_ok"],
            "last_error": run.get("last_error") if not run["last_ok"] else None,
            "errors_24h": len(self._errors.get(job_id, ())),
        }


tracker = JobRunTracker()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_run_tracker.py -v`
Expected: 4 passed.

- [ ] **Step 5: Register the listener and extend the endpoint**

In `src/scheduler/jobs.py`:
- Add to imports: `from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR` and `from src.scheduler.run_tracker import tracker`.
- In `start_scheduler()`, before `scheduler.start()`: `scheduler.add_listener(tracker.on_event, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)`.
- At the top of `register_jobs()` docstring add: `New automation? Add it to the CRM catalogue: /home/gabriel/LeadAwakerApp/shared/automationCatalogue.ts (otherwise it shows as "Unlisted").`

In `src/main.py`, replace the `jobs_health` body:

```python
@app.get("/api/jobs-health")
async def jobs_health():
    """Return per-job scheduler state + last-run health for the CRM Automations page."""
    from src.scheduler.run_tracker import tracker
    if not (scheduler and scheduler.running):
        return {"scheduler_running": False, "started_at": tracker.started_at.isoformat(), "jobs": []}
    return {
        "scheduler_running": True,
        "started_at": tracker.started_at.isoformat(),
        "jobs": [
            {
                "id": j.id,
                "name": j.name,
                "next_run_at": j.next_run_time.isoformat() if j.next_run_time else None,
                **tracker.snapshot(j.id),
            }
            for j in scheduler.get_jobs()
        ],
    }
```

In `/home/gabriel/automations/CLAUDE.md`, add a short section:

```markdown
## Automation diary (CRM Automations page)

Every real action an automation takes for a client writes one diary line:
`await record_action("<catalogue id>", "<action key>", "success"|"failed"|"skipped", account_id=..., campaign_id=..., lead_id=..., reason=..., ref={"interaction_id": ...})`
from `src.automations.automation_logger`. It never raises. "Checked, nothing to do" writes nothing.
New automation → add it to `/home/gabriel/LeadAwakerApp/shared/automationCatalogue.ts` and its labels to `client/src/locales/{en,nl,pt}/automation.json`.
Spec: `/home/gabriel/LeadAwakerApp/specs/automation-overview/requirements.md`.
```

- [ ] **Step 6: Import check**

Run: `cd /home/gabriel/automations && python -c "import src.main"`
Expected: no error output.

- [ ] **Step 7: Commit (only if engine commits are allowed)**

```bash
git add src/scheduler/run_tracker.py src/scheduler/jobs.py src/main.py CLAUDE.md tests/test_run_tracker.py
git commit -m "feat(automations): job run health tracker on /api/jobs-health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Diary lines for scheduled automations, heartbeats removed

**Files (all under `/home/gabriel/automations/`):**
- Modify: `src/automations/campaign_launcher.py`, `src/automations/send_queue_worker.py`, `src/automations/bump_scheduler.py`, `src/automations/buying_signal_followup.py`, `src/automations/booking_reminder.py`, `src/automations/no_show_recovery.py`, `src/automations/reputation_scheduler.py`, `src/automations/review_drafter.py`, `src/automations/stock_sync.py`, `src/automations/lead_scorer.py`, `src/automations/metrics_aggregator.py`, `src/automations/task_reminders.py`, `src/automations/quality_rating_monitor.py`, `src/automations/demo_bump_scheduler.py`
- Test: `tests/test_send_queue_diary.py`

**Interfaces:**
- Consumes: `record_action` (Task 2).
- Produces: diary rows with these exact `(automation, action)` keys, which Task 9's i18n labels:

| automation id | action keys |
|---|---|
| campaign_launcher | `sent_first_message`, `skipped_invalid_phone` |
| bump_scheduler | `sent_bump_1`..`sent_bump_4`, `sent_reengagement`, `closed_no_reply` |
| buying_signal_followup | `sent_nudge` |
| booking_reminder | `sent_reminder_24h`, `sent_reminder_1h` |
| no_show_followup | `sent_rebook_link`, `sent_checkin`, `marked_lost` |
| reputation_scheduler | `sent_feedback_ask` |
| review_response | `drafted_review_reply` |
| stock_sync | `synced_stock_feed` |

**Rules for every file in this task:**
1. Read the file fully first. These files contain other sessions' uncommitted edits; build on them, do not revert anything.
2. Put `record_action(...)` right after the point where the real action is known to have succeeded (send returned success, row updated) with outcome `"success"`, and in the failure branch for that same lead with outcome `"failed"` and a short `reason` (Twilio error code in `code` when available). Use `ref={"interaction_id": <id>}` when the code has the created interaction id in scope; otherwise omit `ref`.
3. Do not record "not yet due", "outside active hours", "daily cap reached, try later" or other retry-later skips. Record `"skipped"` only for terminal skips where the lead will not be retried for this step.
4. Delete the end-of-run summary `log_step(...)` calls listed below (and only those). Keep every other `log_step` / `AsyncLogStep` call (they are debug step rows).
5. Import with `from src.automations.automation_logger import record_action`.

- [ ] **Step 1: Write the failing test for the send-queue mapping**

The queue worker is the single sender for first messages and bumps (`USE_SEND_QUEUE=true` in `.env`). Factor the queue-kind → diary mapping into a pure function so it can be tested.

```python
# tests/test_send_queue_diary.py
from src.automations.send_queue_worker import diary_key_for


def test_first_message():
    assert diary_key_for({"kind": "first_message", "bump_number": None}) == ("campaign_launcher", "sent_first_message")


def test_bump():
    assert diary_key_for({"kind": "bump", "bump_number": 3}) == ("bump_scheduler", "sent_bump_3")


def test_reengagement():
    assert diary_key_for({"kind": "reengagement", "bump_number": None}) == ("bump_scheduler", "sent_reengagement")


def test_unknown_kind_falls_back():
    assert diary_key_for({"kind": "mystery", "bump_number": None}) == ("send_queue_worker", "sent_mystery")
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_send_queue_diary.py -v`
Expected: FAIL with `ImportError: cannot import name 'diary_key_for'`.

- [ ] **Step 3: Implement the mapping and instrument the worker**

Add near the top of `send_queue_worker.py` (after the constants):

```python
def diary_key_for(row) -> tuple[str, str]:
    """Send_Queue row -> (catalogue automation id, diary action key)."""
    kind = row["kind"]
    if kind == "first_message":
        return "campaign_launcher", "sent_first_message"
    if kind == "bump":
        return "bump_scheduler", f"sent_bump_{row['bump_number'] or 0}"
    if kind == "reengagement":
        return "bump_scheduler", "sent_reengagement"
    return "send_queue_worker", f"sent_{kind}"
```

Then where the worker calls `mark_sent(...)` for a row, add right after it:

```python
automation, action = diary_key_for(row)
await record_action(automation, action, "success",
                    account_id=row["Accounts_id"], campaign_id=row["Campaigns_id"],
                    lead_id=row["Leads_id"], ref={"interaction_id": interaction_id} if interaction_id else None)
```

(use whatever variable holds the created interaction id; if none, pass no `ref`). Where it calls `mark_dead(...)` (permanent failure), add the same with outcome `"failed"`, `code=str(error_code)` and `reason=(error or "send failed")[:200]`. Retries (`requeue_for_retry`, `release_to_queued`) record nothing. Check the actual row key names in `claim_due_sends` (`tools/db/send_queue.py`) and use them.

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_send_queue_diary.py -v`
Expected: 4 passed.

- [ ] **Step 5: Instrument campaign_launcher and bump_scheduler inline paths**

Both files have an inline send path used when `settings.use_send_queue` is false. In those inline paths only (the queue path records in the worker):
- `campaign_launcher.py`: after a successful first send → `record_action("campaign_launcher", "sent_first_message", "success", ...)`; send failure → `"failed"`. Where a lead is set to `automation_status='error'` for an invalid phone → `record_action("campaign_launcher", "skipped_invalid_phone", "skipped", ..., reason="invalid_phone")` (this applies in both paths, it is terminal).
- `bump_scheduler.py`: after a successful bump send → `f"sent_bump_{next_stage}"` (or `"sent_reengagement"` for the re-engagement bump); failure → `"failed"`. Where the lead is closed as Lost after the last bump (around the `conversion_status="Lost", automation_status="completed"` update) → `record_action("bump_scheduler", "closed_no_reply", "success", ...)` in both paths.
- Remove the `run_complete` summary `log_step` at `campaign_launcher.py` (~line 56) and `bump_scheduler.py` (~line 78).

- [ ] **Step 6: Instrument the remaining scheduled automations**

| File | Record | Remove summary row |
|---|---|---|
| `buying_signal_followup.py` | `("buying_signal_followup", "sent_nudge")` success / failed per lead | `run_complete` (~l.78) |
| `booking_reminder.py` | `("booking_reminder", "sent_reminder_24h" or "sent_reminder_1h")` per rung | `run_complete` (~l.177) |
| `no_show_recovery.py` | 15-min job: `("no_show_followup", "sent_rebook_link")`; event path: `("no_show_followup", "sent_checkin")` and `("no_show_followup", "marked_lost")` | `run_complete` (~l.302) |
| `reputation_scheduler.py` | `("reputation_scheduler", "sent_feedback_ask")` | `run_complete` (~l.95) |
| `review_drafter.py` | `("review_response", "drafted_review_reply")`, account only | `run_complete` (~l.198) |
| `stock_sync.py` | `("stock_sync", "synced_stock_feed")` per account, failed on exception with reason | none |
| `lead_scorer.py` | nothing (internal) | `scoring_complete` |
| `metrics_aggregator.py` | nothing (internal) | `aggregation_complete` and per-campaign success `aggregate_campaign` rows (keep its Failure rows) |
| `task_reminders.py` | nothing (internal) | `check_due_soon` |
| `quality_rating_monitor.py` | nothing (internal) | `fetch_accounts` |
| `demo_bump_scheduler.py` | nothing (internal) | `run_complete` (~l.441) |

Also fix the TypeError in `no_show_recovery.py` (~line 307): it passes `output=` to `log_step`, which has no such parameter. Since that call is the `run_complete` row being removed, deleting it fixes it; if a different `log_step(..., output=...)` call remains anywhere in the file, rename the kwarg to `output_data=`.

Grep check after editing: `grep -n "output=" src/automations/no_show_recovery.py` shows no `log_step` call with `output=`. `grep -rn "\"run_complete\"" src/automations/` returns nothing.

- [ ] **Step 7: Run the engine test suite**

Run: `python -m pytest tests -q -x --ignore=tests/prompt_tester.py`
Expected: all pass (same failures as before your change, if any pre-existing; report them).

Import check: `python -c "import src.main"` prints nothing.

- [ ] **Step 8: Commit (only if engine commits are allowed)**

```bash
git add <each file you changed> tests/test_send_queue_diary.py
git commit -m "feat(automations): diary lines for scheduled automations; drop heartbeat rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Diary lines for event-driven automations and engine fixes

**Files (all under `/home/gabriel/automations/`):**
- Modify: `src/automations/inbound_handler.py`, `src/automations/ai_conversation.py` (and/or `src/automations/conversation/outbound.py` where the reply is sent), `src/automations/reputation_handler.py`, `src/automations/speed_to_lead.py`, `src/automations/channel_fallback.py`, `src/automations/reschedule_reengage.py`, `src/webhooks/booking_routes.py`, `src/webhooks/twilio_voice_mc_routes.py`, `src/webhooks/whatsapp_cloud_routes.py`, `src/webhooks/twilio_routes.py`, the voice call finaliser (find where a phone call's `Voice_Calls` row gets its end reason / recap: `src/automations/voice/call_recap.py` and `src/automations/voice_call_sweep.py`)
- Modify: `tools/db/interactions.py` (add a lookup by provider message SID if none exists)
- Test: `tests/test_delivery_diary.py`

**Interfaces:**
- Consumes: `record_action` (Task 2).
- Produces diary keys:

| automation id | action keys |
|---|---|
| inbound_handler | `received_message` (success), skipped reasons `opted_out`, `duplicate` |
| website_chat | `received_message` (same as above, used instead of inbound_handler when the channel is the website widget, `web_chat`) |
| ai_conversation | `sent_reply` |
| reputation_handler | `sent_reply`, `sent_referral_ask` |
| speed_to_lead | `sent_first_message` |
| channel_fallback | `sent_fallback_sms`, `sent_fallback_email` |
| reschedule_reengage | `sent_reengage` |
| booking_webhook | `booking_created`, `booking_rescheduled`, `booking_cancelled` |
| missed_call | `sent_textback`, `voicemail_received` |
| message_delivery | `delivery_failed` (failed only; success is not recorded) |
| voice_receptionist | `call_handled`, `call_transferred`, `call_failed` (ref `voice_call_id`) |

**Rules:** same as Task 4 rules 1, 2, 3 and 5.

- [ ] **Step 1: Write the failing test for delivery-status classification**

```python
# tests/test_delivery_diary.py
from src.automations.delivery_diary import is_failed_delivery


def test_failed_statuses():
    assert is_failed_delivery("failed")
    assert is_failed_delivery("undelivered")
    assert is_failed_delivery("FAILED")


def test_ok_statuses():
    for s in ("sent", "delivered", "read", "queued", "", None):
        assert not is_failed_delivery(s)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_delivery_diary.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `src/automations/delivery_diary.py`**

```python
"""Delivery receipts -> diary lines (specs/automation-overview).

WhatsApp Cloud and Twilio status callbacks report failed deliveries. Each one
becomes a `message_delivery` / `delivery_failed` diary line for the lead's
client, looked up through the provider message id on Interactions.
"""

from src.automations.automation_logger import record_action

_FAILED = {"failed", "undelivered"}


def is_failed_delivery(status: str | None) -> bool:
    return (status or "").strip().lower() in _FAILED


async def record_delivery_status(message_sid: str | None, status: str | None,
                                 error_code: str | None = None, error_text: str | None = None) -> None:
    """Record a failed delivery. No-op for non-failures or unknown messages. Never raises."""
    if not message_sid or not is_failed_delivery(status):
        return
    try:
        from tools.db.interactions import get_interaction_ids_by_sid
        ids = await get_interaction_ids_by_sid(message_sid)
    except Exception:
        ids = None
    await record_action(
        "message_delivery", "delivery_failed", "failed",
        account_id=ids["account_id"] if ids else None,
        campaign_id=ids["campaign_id"] if ids else None,
        lead_id=ids["lead_id"] if ids else None,
        code=str(error_code) if error_code else None,
        reason=(error_text or status or "failed")[:200],
        ref={"interaction_id": ids["interaction_id"]} if ids else None,
    )
```

In `tools/db/interactions.py`, find how the provider message id is stored on Interactions (grep for `twilio_message_sid` / `message_sid` / `wamid` in that file and in `tools/send_service.py`). Add:

```python
async def get_interaction_ids_by_sid(message_sid: str) -> dict | None:
    """Interaction + lead/campaign/account ids for a provider message id."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f'SELECT id AS interaction_id, "Leads_id" AS lead_id, '
            f'"Campaigns_id" AS campaign_id, "Accounts_id" AS account_id '
            f'FROM {fq(Table.INTERACTIONS)} WHERE <sid column> = $1 '
            f'ORDER BY id DESC LIMIT 1',
            message_sid,
        )
    return dict(row) if row else None
```

replacing `<sid column>` with the real quoted column name you found (if a lookup by SID already exists, reuse it instead and adapt the import).

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_delivery_diary.py -v`
Expected: 2 passed.

- [ ] **Step 5: Wire delivery receipts**

- `whatsapp_cloud_routes.py` (~line 298, status updates): call `await record_delivery_status(<message id>, <status>, <error code>, <error title>)` for each status entry. Also fix the existing debug `log_step` there so a `failed` status is not written with `status="Success"` (use `"Failure"` when `is_failed_delivery(status)`).
- `twilio_routes.py`: in the message status callback handler (MessageStatus / ErrorCode form fields), call `await record_delivery_status(MessageSid, MessageStatus, ErrorCode, None)`. If the status callback for WhatsApp-via-Twilio is handled in `channel_fallback.py` instead, call it there, once per callback (not in both places).

- [ ] **Step 6: Instrument the other event automations**

| File | Where | Record |
|---|---|---|
| `inbound_handler.py` | after lead lookup succeeds and the message is recorded | `("website_chat" if channel == "web_chat" else "inbound_handler", "received_message", "success")`; on opt-out stop → `"skipped", reason="opted_out"`; on duplicate drop → `"skipped", reason="duplicate"` (only if the lead is known at that point) |
| `ai_conversation.py` / `conversation/outbound.py` | after the AI reply is sent | `("ai_conversation", "sent_reply", "success", ref interaction)`; in the `conversation_error` branch → `"failed"` with reason = exception class |
| `reputation_handler.py` | after each reply / referral ask send | `sent_reply` / `sent_referral_ask` |
| `speed_to_lead.py` | after first message send / in `send_error` branch | `sent_first_message` success / failed |
| `channel_fallback.py` (~l.219) | after fallback send | `sent_fallback_sms` / `sent_fallback_email` success; on send failure → `"failed"` (and change the existing debug row's `status="Skipped"` on send failure to `"Failure"`) |
| `reschedule_reengage.py` (~l.144) | after send | `sent_reengage` |
| `booking_routes.py` (~l.1653) | after the lead is updated for the Cal webhook | `booking_created` / `booking_rescheduled` / `booking_cancelled` |
| `twilio_voice_mc_routes.py` | after the text-back send; when a voicemail recording is stored | `sent_textback` success / failed; `voicemail_received` |
| voice call finaliser | once per finished phone call, where the call's end reason/outcome is written (both the normal wrap-up and the sweep path, but only once per call: guard on the row not being already finalised) | `("voice_receptionist", "call_transferred" if transferred else "call_handled", "success", account_id=..., ref={"voice_call_id": id})`; an error end reason → `"call_failed"`, `"failed"`, reason = end reason. Skip demo/probe calls with no account id. |

The website widget routes into `process_inbound`, so it is covered by the inbound_handler row above; do not add a second row in `widget_routes.py`.

- [ ] **Step 7: Run the engine test suite**

Run: `python -m pytest tests -q --ignore=tests/prompt_tester.py`
Expected: all pass, or only failures that already existed before this task (check with `git stash` is NOT allowed because of other sessions' changes; instead report failing test names and whether they touch files you edited).

Import check: `python -c "import src.main"` prints nothing.

- [ ] **Step 8: Commit (only if engine commits are allowed)**

```bash
git add <each file you changed> src/automations/delivery_diary.py tests/test_delivery_diary.py
git commit -m "feat(automations): diary lines for event automations, delivery failures, voice calls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CRM catalogue, shared types, health rules

**Files:**
- Create: `shared/automationCatalogue.ts`
- Create: `shared/automationTypes.ts`
- Create: `server/automations/health.ts`
- Test: `server/automations/health.test.ts`

**Interfaces:**
- Produces (exact names used by Tasks 7-10):

```ts
// shared/automationCatalogue.ts
export type AutomationService = "reactivation" | "speed_to_lead" | "bookings" | "reputation" | "receptionist" | "inbox" | "internal";
export type AutomationTrigger =
  | { type: "schedule"; everySeconds: number }
  | { type: "daily"; at: string }            // "HH:MM" server time
  | { type: "event"; on: string };           // i18n key suffix: automation:trigger.event.<on>
export interface AutomationEntry {
  id: string;
  service: AutomationService;
  trigger: AutomationTrigger;
  scope: "campaign" | "account" | "agency";
  audience: "client" | "internal";
  aliases?: string[];
  jobId?: string;            // APScheduler job id when it differs from id
  quietAfterHours?: number;
}
export const SERVICE_ORDER: AutomationService[];
export const AUTOMATION_CATALOGUE: AutomationEntry[];
export function findEntry(name: string): AutomationEntry | undefined;
export function entryJobId(e: AutomationEntry): string | null;  // null for event automations

// shared/automationTypes.ts
export type HealthState = "healthy" | "warning" | "late" | "failing" | "waiting" | "idle" | "unknown";
export interface EngineJob { id: string; name: string; next_run_at: string | null; last_run_at?: string | null; last_ok?: boolean | null; last_error?: string | null; errors_24h?: number; }
export interface EngineJobsHealth { scheduler_running: boolean; started_at?: string | null; jobs: EngineJob[]; }
export interface ActionCounts { success: number; failed: number; skipped: number; lastActionAt: string | null; topFailureReason: string | null; }
export interface OverviewRow { id: string; entry: AutomationEntry | null; health: HealthState; lastRunAt: string | null; lastError: string | null; counts24h: ActionCounts; clientsOn: number | null; quiet: boolean; }
export interface OverviewResponse { engineReachable: boolean; schedulerRunning: boolean; engineStartedAt: string | null; rows: OverviewRow[]; totals: { automations: number; healthy: number; late: number; failing: number; failures24h: number }; }
export interface DiaryLine { id: number; createdAt: string; automationId: string; action: string; outcome: "success" | "failed" | "skipped"; reason: string | null; accountId: number | null; accountName: string | null; campaignId: number | null; campaignName: string | null; leadId: number | null; leadName: string | null; interactionId: number | null; voiceCallId: number | null; }
export interface DiaryPage { lines: DiaryLine[]; page: number; hasMore: boolean; }
export type ClientState = "on" | "off" | "always_on";
export type ChangeTarget =
  | { kind: "account_tab"; tab: "integrations" | "communication" | "voice" }
  | { kind: "campaign_section"; campaignId: number; section: "business" | "ai" | "behavior" }
  | { kind: "settings_account" };
export interface SummaryToken { key: string; values?: Record<string, string | number>; }
export interface ClientLine { automationId: string; campaignId: number | null; campaignName: string | null; state: ClientState; summary: SummaryToken[]; counts7d: ActionCounts; change: ChangeTarget | null; warning: { key: "paused_followups"; count: number } | null; }
export interface ClientAutomationsResponse { accountId: number; lines: ClientLine[]; totals: { on: number; total: number; actions7d: number; failed7d: number }; }
export const EMPTY_COUNTS: ActionCounts;

// server/automations/health.ts
export function scheduledHealth(job: EngineJob | undefined, entry: AutomationEntry, opts: { now: number; engineReachable: boolean }): HealthState;
export function eventHealth(c: ActionCounts): HealthState;
export function intervalSeconds(t: AutomationTrigger): number | null;  // daily → 86400, event → null
export function buildOverviewRows(args: { catalogue: AutomationEntry[]; engine: EngineJobsHealth | null; counts24h: Map<string, ActionCounts>; clientsOn: Map<string, number>; now: number }): OverviewRow[];
export function overviewTotals(rows: OverviewRow[]): OverviewResponse["totals"];
```

- [ ] **Step 1: Write the catalogue and types**

`shared/automationTypes.ts`: exactly the types above plus

```ts
export const EMPTY_COUNTS: ActionCounts = { success: 0, failed: 0, skipped: 0, lastActionAt: null, topFailureReason: null };
```

`shared/automationCatalogue.ts`:

```ts
// The master list of everything the automation engine does (specs/automation-overview).
// Every engine automation must be listed here, otherwise the Automations page shows
// it as "Unlisted". Labels live in client/src/locales/{en,nl,pt}/automation.json
// under names.<id> and descriptions.<id>.

export type AutomationService = "reactivation" | "speed_to_lead" | "bookings" | "reputation" | "receptionist" | "inbox" | "internal";

export type AutomationTrigger =
  | { type: "schedule"; everySeconds: number }
  | { type: "daily"; at: string }
  | { type: "event"; on: string };

export interface AutomationEntry {
  id: string;
  service: AutomationService;
  trigger: AutomationTrigger;
  scope: "campaign" | "account" | "agency";
  audience: "client" | "internal";
  aliases?: string[];
  jobId?: string;
  quietAfterHours?: number;
}

export const SERVICE_ORDER: AutomationService[] = [
  "reactivation", "speed_to_lead", "bookings", "reputation", "receptionist", "inbox", "internal",
];

const every = (s: number): AutomationTrigger => ({ type: "schedule", everySeconds: s });
const daily = (at: string): AutomationTrigger => ({ type: "daily", at });
const on = (ev: string): AutomationTrigger => ({ type: "event", on: ev });

export const AUTOMATION_CATALOGUE: AutomationEntry[] = [
  // Reactivation
  { id: "campaign_launcher", service: "reactivation", trigger: every(60), scope: "campaign", audience: "client" },
  { id: "bump_scheduler", service: "reactivation", trigger: every(300), scope: "campaign", audience: "client" },
  { id: "buying_signal_followup", service: "reactivation", trigger: every(300), scope: "campaign", audience: "client" },
  // Speed to lead
  { id: "speed_to_lead", service: "speed_to_lead", trigger: on("new_form_lead"), scope: "campaign", audience: "client" },
  // Bookings
  { id: "booking_reminder", service: "bookings", trigger: every(300), scope: "account", audience: "client" },
  { id: "no_show_followup", service: "bookings", trigger: every(900), scope: "account", audience: "client", aliases: ["no_show"] },
  { id: "reschedule_reengage", service: "bookings", trigger: on("reschedule"), scope: "account", audience: "client" },
  { id: "booking_webhook", service: "bookings", trigger: on("calendar_booking"), scope: "account", audience: "client" },
  // Reputation
  { id: "reputation_scheduler", service: "reputation", trigger: every(300), scope: "account", audience: "client" },
  { id: "reputation_handler", service: "reputation", trigger: on("customer_reply"), scope: "campaign", audience: "client" },
  { id: "review_response", service: "reputation", trigger: every(300), scope: "account", audience: "client", jobId: "review_drafter", aliases: ["review_drafter"] },
  // Receptionist
  { id: "voice_receptionist", service: "receptionist", trigger: on("phone_call"), scope: "account", audience: "client" },
  { id: "missed_call", service: "receptionist", trigger: on("missed_call"), scope: "account", audience: "client" },
  // Inbox
  { id: "inbound_handler", service: "inbox", trigger: on("incoming_message"), scope: "account", audience: "client", quietAfterHours: 72 },
  { id: "ai_conversation", service: "inbox", trigger: on("lead_replies"), scope: "campaign", audience: "client", quietAfterHours: 72 },
  { id: "website_chat", service: "inbox", trigger: on("widget_message"), scope: "account", audience: "client" },
  { id: "channel_fallback", service: "inbox", trigger: on("whatsapp_undelivered"), scope: "campaign", audience: "client" },
  { id: "message_delivery", service: "inbox", trigger: on("delivery_receipt"), scope: "account", audience: "client", aliases: ["whatsapp_cloud_webhook"] },
  { id: "stock_sync", service: "inbox", trigger: every(3600), scope: "account", audience: "client" },
  // Behind the scenes
  { id: "lead_scorer", service: "internal", trigger: every(1800), scope: "agency", audience: "internal" },
  { id: "metrics_aggregator", service: "internal", trigger: every(900), scope: "agency", audience: "internal" },
  { id: "nightly_summary", service: "internal", trigger: daily("00:00"), scope: "agency", audience: "internal" },
  { id: "task_reminders", service: "internal", trigger: every(900), scope: "agency", audience: "internal" },
  { id: "quality_rating_monitor", service: "internal", trigger: every(3600), scope: "agency", audience: "internal" },
  { id: "voice_call_sweep", service: "internal", trigger: every(60), scope: "agency", audience: "internal" },
  { id: "error_log_digest", service: "internal", trigger: daily("07:30"), scope: "agency", audience: "internal" },
  { id: "booking_consistency_check", service: "internal", trigger: daily("07:00"), scope: "agency", audience: "internal" },
  { id: "demo_data_purge", service: "internal", trigger: daily("03:30"), scope: "agency", audience: "internal" },
  { id: "demo_bump_scheduler", service: "internal", trigger: every(300), scope: "agency", audience: "internal" },
  { id: "send_queue_worker", service: "internal", trigger: every(3), scope: "agency", audience: "internal" },
];

const BY_NAME = new Map<string, AutomationEntry>();
for (const e of AUTOMATION_CATALOGUE) {
  BY_NAME.set(e.id, e);
  for (const a of e.aliases ?? []) BY_NAME.set(a, e);
  if (e.jobId) BY_NAME.set(e.jobId, e);
}

export function findEntry(name: string): AutomationEntry | undefined {
  return BY_NAME.get(name);
}

export function entryJobId(e: AutomationEntry): string | null {
  return e.trigger.type === "event" ? null : (e.jobId ?? e.id);
}
```

- [ ] **Step 2: Write the failing health tests**

```ts
// server/automations/health.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduledHealth, eventHealth, buildOverviewRows, overviewTotals } from "./health";
import { AUTOMATION_CATALOGUE, findEntry } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, type EngineJobsHealth } from "@shared/automationTypes";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const bump = findEntry("bump_scheduler")!;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const inFuture = new Date(NOW + 60_000).toISOString();

test("engine unreachable → unknown", () => {
  assert.equal(scheduledHealth(undefined, bump, { now: NOW, engineReachable: false }), "unknown");
});

test("catalogued scheduled job not registered → late", () => {
  assert.equal(scheduledHealth(undefined, bump, { now: NOW, engineReachable: true }), "late");
});

test("last run raised → failing", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture, last_run_at: iso(60_000), last_ok: false, last_error: "KeyError", errors_24h: 1 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "failing");
});

test("next run overdue by more than one interval → late", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: iso(301_000 + 300_000), last_run_at: iso(900_000), last_ok: true, errors_24h: 0 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "late");
});

test("no run since restart → waiting", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture, last_run_at: null, last_ok: null, errors_24h: 0 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "waiting");
});

test("old engine payload without last_* fields → healthy when on schedule", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "healthy");
});

test("event health", () => {
  assert.equal(eventHealth(EMPTY_COUNTS), "idle");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 10 }), "healthy");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 10, failed: 1 }), "warning");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 1, failed: 3 }), "failing");
});

test("unlisted job and diary name appear as rows with entry null", () => {
  const engine: EngineJobsHealth = { scheduler_running: true, jobs: [{ id: "brand_new_job", name: "New", next_run_at: inFuture }] };
  const counts = new Map([["mystery_flow", { ...EMPTY_COUNTS, success: 2 }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine, counts24h: counts, clientsOn: new Map(), now: NOW });
  const unlisted = rows.filter((r) => r.entry === null).map((r) => r.id).sort();
  assert.deepEqual(unlisted, ["brand_new_job", "mystery_flow"]);
});

test("alias diary names fold into their entry", () => {
  const counts = new Map([["review_drafter", { ...EMPTY_COUNTS, success: 4 }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: counts, clientsOn: new Map(), now: NOW });
  assert.equal(rows.find((r) => r.id === "review_response")!.counts24h.success, 4);
  assert.equal(rows.some((r) => r.id === "review_drafter"), false);
});

test("quiet flag when last action older than quietAfterHours", () => {
  const counts = new Map([["inbound_handler", { ...EMPTY_COUNTS, success: 1, lastActionAt: iso(80 * 3600_000) }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: counts, clientsOn: new Map(), now: NOW });
  assert.equal(rows.find((r) => r.id === "inbound_handler")!.quiet, true);
});

test("totals", () => {
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: new Map([["bump_scheduler", { ...EMPTY_COUNTS, failed: 2 }]]), clientsOn: new Map(), now: NOW });
  const t = overviewTotals(rows);
  assert.equal(t.automations, AUTOMATION_CATALOGUE.length);
  assert.equal(t.failures24h, 2);
});
```

Note on the quiet test: `counts24h` for the global page comes from a query that also returns the all-time (90-day) `lastActionAt`, so a `lastActionAt` older than 24h with zero 24h counts is a valid input. Write the test with `success: 0` if you prefer; the rule only reads `lastActionAt`.

- [ ] **Step 3: Run to verify it fails**

Run: `node --import tsx --test server/automations/health.test.ts`
Expected: FAIL (module `./health` not found).

- [ ] **Step 4: Implement `server/automations/health.ts`**

```ts
// Health + overview rules for the Automations page (specs/automation-overview).
// Pure functions: no DB, no fetch. Scheduled health comes from the engine's
// /api/jobs-health; event health from the last 24h of diary lines.
import { findEntry, entryJobId, type AutomationEntry, type AutomationTrigger } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, type ActionCounts, type EngineJob, type EngineJobsHealth, type HealthState, type OverviewResponse, type OverviewRow } from "@shared/automationTypes";

export function intervalSeconds(t: AutomationTrigger): number | null {
  if (t.type === "schedule") return t.everySeconds;
  if (t.type === "daily") return 86_400;
  return null;
}

export function scheduledHealth(job: EngineJob | undefined, entry: AutomationEntry, opts: { now: number; engineReachable: boolean }): HealthState {
  if (!opts.engineReachable) return "unknown";
  if (!job) return "late";
  if (job.last_ok === false) return "failing";
  const interval = intervalSeconds(entry.trigger) ?? 86_400;
  if (job.next_run_at && opts.now - Date.parse(job.next_run_at) > interval * 1000) return "late";
  if ("last_run_at" in job && job.last_run_at == null) return "waiting";
  return "healthy";
}

export function eventHealth(c: ActionCounts): HealthState {
  const total = c.success + c.failed + c.skipped;
  if (total === 0) return "idle";
  if (c.failed >= 3 && c.failed > c.success) return "failing";
  if (c.failed > 0) return "warning";
  return "healthy";
}

function mergeCounts(a: ActionCounts, b: ActionCounts): ActionCounts {
  const later = (x: string | null, y: string | null) => (!x ? y : !y ? x : x > y ? x : y);
  return {
    success: a.success + b.success,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    lastActionAt: later(a.lastActionAt, b.lastActionAt),
    topFailureReason: a.topFailureReason ?? b.topFailureReason,
  };
}

export function buildOverviewRows(args: {
  catalogue: AutomationEntry[];
  engine: EngineJobsHealth | null;
  counts24h: Map<string, ActionCounts>;
  clientsOn: Map<string, number>;
  now: number;
}): OverviewRow[] {
  const { catalogue, engine, counts24h, clientsOn, now } = args;
  const engineReachable = engine !== null;
  const jobs = new Map((engine?.jobs ?? []).map((j) => [j.id, j]));

  // Fold diary names (ids + aliases) into catalogue ids; collect unknown names.
  const byId = new Map<string, ActionCounts>();
  const unlistedCounts = new Map<string, ActionCounts>();
  counts24h.forEach((c, name) => {
    const e = findEntry(name);
    const target = e ? byId : unlistedCounts;
    const key = e ? e.id : name;
    target.set(key, mergeCounts(target.get(key) ?? EMPTY_COUNTS, c));
  });

  const rows: OverviewRow[] = catalogue.map((entry) => {
    const counts = byId.get(entry.id) ?? EMPTY_COUNTS;
    const jobId = entryJobId(entry);
    const job = jobId ? jobs.get(jobId) : undefined;
    let health = jobId ? scheduledHealth(job, entry, { now, engineReachable }) : eventHealth(counts);
    if (jobId && health === "healthy" && counts.failed > 0) health = "warning";
    const quiet = !!entry.quietAfterHours && !!counts.lastActionAt
      && now - Date.parse(counts.lastActionAt) > entry.quietAfterHours * 3600_000;
    return {
      id: entry.id,
      entry,
      health,
      lastRunAt: job?.last_run_at ?? counts.lastActionAt ?? null,
      lastError: job?.last_error ?? null,
      counts24h: counts,
      clientsOn: entry.audience === "client" ? (clientsOn.get(entry.id) ?? 0) : null,
      quiet,
    };
  });

  const listedJobIds = new Set(catalogue.map(entryJobId).filter(Boolean) as string[]);
  const unlistedIds = new Set<string>(unlistedCounts.keys());
  jobs.forEach((_j, id) => { if (!listedJobIds.has(id) && !findEntry(id)) unlistedIds.add(id); });
  unlistedIds.forEach((id) => {
    const job = jobs.get(id);
    const counts = unlistedCounts.get(id) ?? EMPTY_COUNTS;
    rows.push({
      id,
      entry: null,
      health: job ? (job.last_ok === false ? "failing" : "healthy") : eventHealth(counts),
      lastRunAt: job?.last_run_at ?? counts.lastActionAt ?? null,
      lastError: job?.last_error ?? null,
      counts24h: counts,
      clientsOn: null,
      quiet: false,
    });
  });
  return rows;
}

export function overviewTotals(rows: OverviewRow[]): OverviewResponse["totals"] {
  return {
    automations: rows.length,
    healthy: rows.filter((r) => r.health === "healthy" || r.health === "idle").length,
    late: rows.filter((r) => r.health === "late" || r.health === "warning").length,
    failing: rows.filter((r) => r.health === "failing").length,
    failures24h: rows.reduce((n, r) => n + r.counts24h.failed, 0),
  };
}
```

Note: `totals.automations` counts unlisted rows too; the totals test uses `engine: null` and only catalogued names, so it equals the catalogue length.

- [ ] **Step 5: Run to verify it passes**

Run: `node --import tsx --test server/automations/health.test.ts`
Expected: all tests pass. If `@shared/...` does not resolve under tsx, check `tsconfig.json` `paths` and how `server/routes/voiceCallsAccess.test.ts` imports shared code; switch to a relative import (`../../shared/automationCatalogue`) in both the test and `health.ts` if needed.

- [ ] **Step 6: Commit**

```bash
git add shared/automationCatalogue.ts shared/automationTypes.ts server/automations/health.ts server/automations/health.test.ts
git commit -m "feat(automations): catalogue, shared types, health rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Per-client gates and settings summaries

**Files:**
- Create: `server/automations/clientGates.ts`
- Test: `server/automations/clientGates.test.ts`

**Interfaces:**
- Consumes: catalogue + types (Task 6).
- Produces:

```ts
export interface GateCampaign {
  id: number; name: string; status: string | null; campaignType: string | null;
  maxBumps: number | null; bumpDelaysHours: (number | null)[];   // [bump1..bump4]
  useAiBumps: boolean | null; channelMode: string | null; fallbackChannel: string | null;
  dailyLeadLimit: number | null; activeHoursStart: string | null; activeHoursEnd: string | null;
  hadActivity7d: boolean; activeLeads: number;                    // leads with automation_status='active'
}
export interface GateInputs {
  account: { id: number; enableReputationManagement: boolean | null; enableReviewResponse: boolean | null; missedCallEnabled: boolean | null; missedCallNumber: string | null };
  campaigns: GateCampaign[];
  voiceNumbers: { phoneNumber: string; enabled: boolean; transferNumber: string | null }[];
  widgets: { enabled: boolean | null }[];
  stockFeedUrl: string | null;
}
export type ClientLineBase = Omit<ClientLine, "counts7d">;
export function isActiveStatus(s: string | null): boolean;      // case-insensitive "active"
export function visibleCampaigns(cs: GateCampaign[]): GateCampaign[];
export function buildClientLines(inputs: GateInputs): ClientLineBase[];
```

Rules (from the spec's catalogue table):

| automation | applies to | state | summary tokens | change |
|---|---|---|---|---|
| campaign_launcher | campaigns with type `reactivation` (or null) | `on` if status active, else `off` | `dailyLimit {n}` if dailyLeadLimit; `activeHours {start,end}` if both | campaign `behavior` |
| bump_scheduler | same | `on` if maxBumps > 0, else `off` | `bumps {n, delays}` (delays = non-null bumpDelaysHours[0..n-1] joined as "24h, 48h"); `aiBumps` if useAiBumps | campaign `behavior`; warning `paused_followups {count: activeLeads}` when status not active and activeLeads > 0 |
| buying_signal_followup | same | `always_on` | none | null |
| speed_to_lead | type `speed_to_lead` | `on` if active else `off` | none | campaign `business` |
| reputation_handler | type `reputation` | `on` if account.enableReputationManagement else `off` | none | `settings_account` |
| ai_conversation | every visible campaign | `always_on` | none | campaign `ai` |
| channel_fallback | every visible campaign | `on` if channelMode === "whatsapp_then_sms" else `off` | `fallbackTo {channel}` when on | campaign `behavior` |
| inbound_handler | account | `always_on` | none | null |
| message_delivery | account | `always_on` | none | null |
| website_chat | account | `on` if any widget enabled | none | account_tab `integrations` |
| stock_sync | account | `on` if stockFeedUrl | none | account_tab `communication` |
| booking_reminder | account | `always_on` | `reminderTimes` | null |
| no_show_followup | account | `always_on` | none | null |
| reschedule_reengage | account | `always_on` | none | null |
| booking_webhook | account | `always_on` | none | null |
| reputation_scheduler | account | `on` if enableReputationManagement and a visible campaign has type `reputation` | none | `settings_account` |
| review_response | account | `on` if enableReviewResponse | none | `settings_account` |
| voice_receptionist | account | `on` if any voiceNumber enabled | `voiceLine {number}` (first enabled number) | account_tab `voice` |
| missed_call | account | `on` if missedCallEnabled | `missedCallNumber {number}` when set | account_tab `integrations` |

Visible campaigns: status active or paused (case-insensitive), plus any other status with `hadActivity7d`. Lines are emitted in catalogue order; campaign-scoped automations emit one line per applicable visible campaign (with `campaignId`, `campaignName`); account-scoped emit one line with `campaignId: null`. Internal entries are never emitted.

- [ ] **Step 1: Write the failing tests**

```ts
// server/automations/clientGates.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClientLines, visibleCampaigns, type GateInputs, type GateCampaign } from "./clientGates";

const camp = (over: Partial<GateCampaign> = {}): GateCampaign => ({
  id: 7, name: "Winter", status: "Active", campaignType: "reactivation",
  maxBumps: 3, bumpDelaysHours: [24, 48, 72, null], useAiBumps: false,
  channelMode: "whatsapp_then_sms", fallbackChannel: "sms",
  dailyLeadLimit: 50, activeHoursStart: "09:00:00", activeHoursEnd: "18:00:00",
  hadActivity7d: false, activeLeads: 0, ...over,
});
const base = (over: Partial<GateInputs> = {}): GateInputs => ({
  account: { id: 1, enableReputationManagement: false, enableReviewResponse: false, missedCallEnabled: false, missedCallNumber: null },
  campaigns: [], voiceNumbers: [], widgets: [], stockFeedUrl: null, ...over,
});
const line = (lines: ReturnType<typeof buildClientLines>, id: string, campaignId: number | null = null) =>
  lines.find((l) => l.automationId === id && l.campaignId === campaignId);

test("empty account: account lines only, sensible states", () => {
  const lines = buildClientLines(base());
  assert.equal(lines.some((l) => l.campaignId !== null), false);
  assert.equal(line(lines, "booking_reminder")!.state, "always_on");
  assert.equal(line(lines, "voice_receptionist")!.state, "off");
  assert.equal(line(lines, "missed_call")!.state, "off");
  assert.equal(lines.some((l) => l.automationId === "lead_scorer"), false);
});

test("active reactivation campaign", () => {
  const lines = buildClientLines(base({ campaigns: [camp()] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "on");
  assert.deepEqual(line(lines, "campaign_launcher", 7)!.summary, [
    { key: "dailyLimit", values: { n: 50 } },
    { key: "activeHours", values: { start: "09:00", end: "18:00" } },
  ]);
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.summary[0], { key: "bumps", values: { n: 3, delays: "24h, 48h, 72h" } });
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.change, { kind: "campaign_section", campaignId: 7, section: "behavior" });
  assert.equal(line(lines, "channel_fallback", 7)!.state, "on");
});

test("lowercase status counts as active", () => {
  const lines = buildClientLines(base({ campaigns: [camp({ status: "active" })] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "on");
});

test("paused campaign with active leads warns on follow-ups", () => {
  const lines = buildClientLines(base({ campaigns: [camp({ status: "Paused", activeLeads: 12 })] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "off");
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.warning, { key: "paused_followups", count: 12 });
});

test("completed campaign hidden unless it had activity", () => {
  assert.equal(visibleCampaigns([camp({ status: "Completed" })]).length, 0);
  assert.equal(visibleCampaigns([camp({ status: "Completed", hadActivity7d: true })]).length, 1);
});

test("reputation campaign gets reputation lines, not reactivation ones", () => {
  const lines = buildClientLines(base({
    account: { id: 1, enableReputationManagement: true, enableReviewResponse: true, missedCallEnabled: true, missedCallNumber: "+31201234567" },
    campaigns: [camp({ id: 9, campaignType: "reputation" })],
  }));
  assert.equal(line(lines, "campaign_launcher", 9), undefined);
  assert.equal(line(lines, "reputation_handler", 9)!.state, "on");
  assert.equal(line(lines, "reputation_scheduler")!.state, "on");
  assert.equal(line(lines, "review_response")!.state, "on");
  assert.deepEqual(line(lines, "missed_call")!.summary, [{ key: "missedCallNumber", values: { number: "+31201234567" } }]);
});

test("voice line on", () => {
  const lines = buildClientLines(base({ voiceNumbers: [{ phoneNumber: "+3185", enabled: true, transferNumber: null }] }));
  assert.equal(line(lines, "voice_receptionist")!.state, "on");
  assert.deepEqual(line(lines, "voice_receptionist")!.change, { kind: "account_tab", tab: "voice" });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test server/automations/clientGates.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/automations/clientGates.ts`**

```ts
// Per-client ON/OFF + plain-words settings summary for each automation
// (specs/automation-overview). Pure: the route loads GateInputs from the DB.
import { AUTOMATION_CATALOGUE, type AutomationEntry } from "@shared/automationCatalogue";
import type { ChangeTarget, ClientLine, ClientState, SummaryToken } from "@shared/automationTypes";

export interface GateCampaign {
  id: number; name: string; status: string | null; campaignType: string | null;
  maxBumps: number | null; bumpDelaysHours: (number | null)[];
  useAiBumps: boolean | null; channelMode: string | null; fallbackChannel: string | null;
  dailyLeadLimit: number | null; activeHoursStart: string | null; activeHoursEnd: string | null;
  hadActivity7d: boolean; activeLeads: number;
}

export interface GateInputs {
  account: { id: number; enableReputationManagement: boolean | null; enableReviewResponse: boolean | null; missedCallEnabled: boolean | null; missedCallNumber: string | null };
  campaigns: GateCampaign[];
  voiceNumbers: { phoneNumber: string; enabled: boolean; transferNumber: string | null }[];
  widgets: { enabled: boolean | null }[];
  stockFeedUrl: string | null;
}

export type ClientLineBase = Omit<ClientLine, "counts7d">;

export const isActiveStatus = (s: string | null) => (s ?? "").toLowerCase() === "active";
const isPausedStatus = (s: string | null) => (s ?? "").toLowerCase() === "paused";
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const REACTIVATION_TYPES = new Set(["reactivation", ""]);

export function visibleCampaigns(cs: GateCampaign[]): GateCampaign[] {
  return cs.filter((c) => isActiveStatus(c.status) || isPausedStatus(c.status) || c.hadActivity7d);
}

const section = (c: GateCampaign, s: "business" | "ai" | "behavior"): ChangeTarget => ({ kind: "campaign_section", campaignId: c.id, section: s });
const tab = (t: "integrations" | "communication" | "voice"): ChangeTarget => ({ kind: "account_tab", tab: t });

type CampaignRule = (c: GateCampaign, inp: GateInputs) => { state: ClientState; summary?: SummaryToken[]; change: ChangeTarget | null; warning?: ClientLineBase["warning"] } | null;
type AccountRule = (inp: GateInputs) => { state: ClientState; summary?: SummaryToken[]; change: ChangeTarget | null };

const isReactivation = (c: GateCampaign) => REACTIVATION_TYPES.has((c.campaignType ?? "").toLowerCase());

const CAMPAIGN_RULES: Record<string, CampaignRule> = {
  campaign_launcher: (c) => {
    if (!isReactivation(c)) return null;
    const summary: SummaryToken[] = [];
    if (c.dailyLeadLimit) summary.push({ key: "dailyLimit", values: { n: c.dailyLeadLimit } });
    if (c.activeHoursStart && c.activeHoursEnd) summary.push({ key: "activeHours", values: { start: hhmm(c.activeHoursStart), end: hhmm(c.activeHoursEnd) } });
    return { state: isActiveStatus(c.status) ? "on" : "off", summary, change: section(c, "behavior") };
  },
  bump_scheduler: (c) => {
    if (!isReactivation(c)) return null;
    const n = c.maxBumps ?? 0;
    const delays = c.bumpDelaysHours.slice(0, n).filter((d): d is number => d != null).map((d) => `${d}h`).join(", ");
    const summary: SummaryToken[] = n > 0 ? [{ key: "bumps", values: { n, delays } }] : [];
    if (n > 0 && c.useAiBumps) summary.push({ key: "aiBumps" });
    const warning = !isActiveStatus(c.status) && c.activeLeads > 0 ? { key: "paused_followups" as const, count: c.activeLeads } : null;
    return { state: n > 0 ? "on" : "off", summary, change: section(c, "behavior"), warning };
  },
  buying_signal_followup: (c) => (isReactivation(c) ? { state: "always_on", change: null } : null),
  speed_to_lead: (c) => ((c.campaignType ?? "").toLowerCase() === "speed_to_lead"
    ? { state: isActiveStatus(c.status) ? "on" : "off", change: section(c, "business") } : null),
  reputation_handler: (c, inp) => ((c.campaignType ?? "").toLowerCase() === "reputation"
    ? { state: inp.account.enableReputationManagement ? "on" : "off", change: { kind: "settings_account" } } : null),
  ai_conversation: (c) => ({ state: "always_on", change: section(c, "ai") }),
  channel_fallback: (c) => (c.channelMode === "whatsapp_then_sms"
    ? { state: "on", summary: [{ key: "fallbackTo", values: { channel: c.fallbackChannel ?? "sms" } }], change: section(c, "behavior") }
    : { state: "off", change: section(c, "behavior") }),
};

const ACCOUNT_RULES: Record<string, AccountRule> = {
  inbound_handler: () => ({ state: "always_on", change: null }),
  message_delivery: () => ({ state: "always_on", change: null }),
  website_chat: (i) => ({ state: i.widgets.some((w) => w.enabled) ? "on" : "off", change: tab("integrations") }),
  stock_sync: (i) => ({ state: i.stockFeedUrl ? "on" : "off", change: tab("communication") }),
  booking_reminder: () => ({ state: "always_on", summary: [{ key: "reminderTimes" }], change: null }),
  no_show_followup: () => ({ state: "always_on", change: null }),
  reschedule_reengage: () => ({ state: "always_on", change: null }),
  booking_webhook: () => ({ state: "always_on", change: null }),
  reputation_scheduler: (i) => ({
    state: i.account.enableReputationManagement && visibleCampaigns(i.campaigns).some((c) => (c.campaignType ?? "").toLowerCase() === "reputation") ? "on" : "off",
    change: { kind: "settings_account" },
  }),
  review_response: (i) => ({ state: i.account.enableReviewResponse ? "on" : "off", change: { kind: "settings_account" } }),
  voice_receptionist: (i) => {
    const line = i.voiceNumbers.find((v) => v.enabled);
    return { state: line ? "on" : "off", summary: line ? [{ key: "voiceLine", values: { number: line.phoneNumber } }] : [], change: tab("voice") };
  },
  missed_call: (i) => ({
    state: i.account.missedCallEnabled ? "on" : "off",
    summary: i.account.missedCallNumber ? [{ key: "missedCallNumber", values: { number: i.account.missedCallNumber } }] : [],
    change: tab("integrations"),
  }),
};

export function buildClientLines(inputs: GateInputs, catalogue: AutomationEntry[] = AUTOMATION_CATALOGUE): ClientLineBase[] {
  const campaigns = visibleCampaigns(inputs.campaigns);
  const out: ClientLineBase[] = [];
  for (const entry of catalogue) {
    if (entry.audience !== "client") continue;
    if (entry.scope === "campaign") {
      const rule = CAMPAIGN_RULES[entry.id];
      if (!rule) continue;
      for (const c of campaigns) {
        const r = rule(c, inputs);
        if (!r) continue;
        out.push({ automationId: entry.id, campaignId: c.id, campaignName: c.name, state: r.state, summary: r.summary ?? [], change: r.change, warning: r.warning ?? null });
      }
    } else {
      const rule = ACCOUNT_RULES[entry.id];
      if (!rule) continue;
      const r = rule(inputs);
      out.push({ automationId: entry.id, campaignId: null, campaignName: null, state: r.state, summary: r.summary ?? [], change: r.change, warning: null });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --import tsx --test server/automations/clientGates.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/automations/clientGates.ts server/automations/clientGates.test.ts
git commit -m "feat(automations): per-client gates and settings summaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: CRM storage queries, endpoints, notifier fix, old endpoint removal

**Files:**
- Create: `server/storage/automationDiary.ts`
- Modify: `server/storage.ts` (spread `automationDiaryStorage` into the barrel next to `automationStorage`)
- Modify: `server/storage/automation.ts` (`getRecentFailedAutomationLogs`; remove `getSchedulerJobHealth`)
- Rewrite: `server/routes/automation.ts`
- Modify: `server/routes/leadsDemoScore.ts:~299` (duplicate `/api/automation-logs`)
- Modify: `server/routes/ai-agents.ts:2132-2160` (`startAutomationFailureNotifier`)

**Interfaces:**
- Consumes: Tasks 6, 7.
- Produces endpoints (all `requireOwner`):
  - `GET /api/automations/overview` → `OverviewResponse` (25s in-memory cache, like the old health endpoint)
  - `GET /api/automations/:id/diary?accountId=&failedOnly=1&page=1` → `DiaryPage` (50 per page, newest first; `:id` matches the entry id and its aliases; with `failedOnly=1` only `Failure`)
  - `GET /api/accounts/:id/automations` → `ClientAutomationsResponse`
- Storage methods on `storage`:
  - `getActionCountsByWorkflow(sinceHours: number): Promise<Map<string, ActionCounts>>` (counts in window; `lastActionAt` = max over the full table for that name; `topFailureReason` = most common reason in window)
  - `getActionCountsForAccount(accountId: number, sinceDays: number): Promise<Map<string, ActionCounts>>` keyed `"<workflow>|<campaignId or ''>"`
  - `getClientsOnCounts(): Promise<Map<string, number>>`
  - `getDiaryPage(opts: { names: string[]; accountId?: number; failedOnly?: boolean; page: number; limit: number }): Promise<DiaryPage>`
  - `getGateInputs(accountId: number): Promise<GateInputs>`

- [ ] **Step 1: Write the storage module**

```ts
// server/storage/automationDiary.ts
// Diary queries for the Automations page + per-client tab (specs/automation-overview).
// Diary rows are Automation_Logs with kind = 'action'.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { EMPTY_COUNTS, type ActionCounts, type DiaryLine, type DiaryPage } from "@shared/automationTypes";
import { buildClientLines, type GateInputs } from "../automations/clientGates";

const T = sql.raw(`"p2mxx34fvbf3ll6"."Automation_Logs"`);
const REASON = sql.raw(`COALESCE(NULLIF(skipped_reason, ''), NULLIF(output_data, ''), NULLIF(error_code, ''))`);

function toCounts(r: any): ActionCounts {
  return {
    success: Number(r.success ?? 0),
    failed: Number(r.failed ?? 0),
    skipped: Number(r.skipped ?? 0),
    lastActionAt: r.last_action_at ? new Date(r.last_action_at).toISOString() : null,
    topFailureReason: r.top_reason ?? null,
  };
}

export const automationDiaryStorage = {
  async getActionCountsByWorkflow(sinceHours: number): Promise<Map<string, ActionCounts>> {
    const res = await db.execute(sql`
      WITH win AS (
        SELECT workflow_name, status, ${REASON} AS reason FROM ${T}
        WHERE kind = 'action' AND created_at > NOW() - make_interval(hours => ${sinceHours})
      ),
      last AS (
        SELECT workflow_name, MAX(created_at) AS last_action_at FROM ${T}
        WHERE kind = 'action' GROUP BY workflow_name
      ),
      reasons AS (
        SELECT DISTINCT ON (workflow_name) workflow_name, reason AS top_reason
        FROM (SELECT workflow_name, reason, COUNT(*) AS n FROM win WHERE status = 'Failure' AND reason IS NOT NULL GROUP BY 1, 2) x
        ORDER BY workflow_name, n DESC
      )
      SELECT l.workflow_name,
        COUNT(*) FILTER (WHERE w.status = 'Success') AS success,
        COUNT(*) FILTER (WHERE w.status = 'Failure') AS failed,
        COUNT(*) FILTER (WHERE w.status = 'Skipped') AS skipped,
        l.last_action_at, r.top_reason
      FROM last l
      LEFT JOIN win w ON w.workflow_name = l.workflow_name
      LEFT JOIN reasons r ON r.workflow_name = l.workflow_name
      GROUP BY l.workflow_name, l.last_action_at, r.top_reason
    `);
    return new Map((res.rows as any[]).map((r) => [r.workflow_name, toCounts(r)]));
  },

  async getActionCountsForAccount(accountId: number, sinceDays: number): Promise<Map<string, ActionCounts>> {
    const res = await db.execute(sql`
      WITH win AS (
        SELECT workflow_name, "Campaigns_id" AS campaign_id, status, created_at, ${REASON} AS reason FROM ${T}
        WHERE kind = 'action' AND "Accounts_id" = ${accountId}
          AND created_at > NOW() - make_interval(days => ${sinceDays})
      ),
      reasons AS (
        SELECT DISTINCT ON (workflow_name, campaign_id) workflow_name, campaign_id, reason AS top_reason
        FROM (SELECT workflow_name, campaign_id, reason, COUNT(*) AS n FROM win WHERE status = 'Failure' AND reason IS NOT NULL GROUP BY 1, 2, 3) x
        ORDER BY workflow_name, campaign_id, n DESC
      )
      SELECT w.workflow_name, w.campaign_id,
        COUNT(*) FILTER (WHERE w.status = 'Success') AS success,
        COUNT(*) FILTER (WHERE w.status = 'Failure') AS failed,
        COUNT(*) FILTER (WHERE w.status = 'Skipped') AS skipped,
        MAX(w.created_at) AS last_action_at,
        MAX(r.top_reason) AS top_reason
      FROM win w
      LEFT JOIN reasons r ON r.workflow_name = w.workflow_name AND r.campaign_id IS NOT DISTINCT FROM w.campaign_id
      GROUP BY w.workflow_name, w.campaign_id
    `);
    return new Map((res.rows as any[]).map((r) => [`${r.workflow_name}|${r.campaign_id ?? ""}`, toCounts(r)]));
  },

  async getDiaryPage(opts: { names: string[]; accountId?: number; failedOnly?: boolean; page: number; limit: number }): Promise<DiaryPage> {
    const offset = (opts.page - 1) * opts.limit;
    const res = await db.execute(sql`
      SELECT l.id, l.created_at, l.workflow_name, l.step_name, l.status, ${REASON} AS reason, l.metadata,
        l."Accounts_id" AS account_id, a.name AS account_name,
        l."Campaigns_id" AS campaign_id, c.name AS campaign_name,
        l."Leads_id" AS lead_id,
        NULLIF(TRIM(CONCAT_WS(' ', ld.first_name, ld.last_name)), '') AS lead_name
      FROM ${T} l
      LEFT JOIN "p2mxx34fvbf3ll6"."Accounts" a ON a.id = l."Accounts_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Campaigns" c ON c.id = l."Campaigns_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Leads" ld ON ld.id = l."Leads_id"
      WHERE l.kind = 'action'
        AND l.workflow_name = ANY(${opts.names})
        ${opts.accountId ? sql`AND l."Accounts_id" = ${opts.accountId}` : sql``}
        ${opts.failedOnly ? sql`AND l.status = 'Failure'` : sql``}
      ORDER BY l.created_at DESC
      LIMIT ${opts.limit + 1} OFFSET ${offset}
    `);
    const rows = res.rows as any[];
    const lines: DiaryLine[] = rows.slice(0, opts.limit).map((r) => {
      let meta: any = null;
      try { meta = r.metadata ? JSON.parse(r.metadata) : null; } catch { meta = null; }
      return {
        id: Number(r.id),
        createdAt: new Date(r.created_at).toISOString(),
        automationId: r.workflow_name,
        action: r.step_name,
        outcome: r.status === "Failure" ? "failed" : r.status === "Skipped" ? "skipped" : "success",
        reason: r.reason ?? null,
        accountId: r.account_id ?? null, accountName: r.account_name ?? null,
        campaignId: r.campaign_id ?? null, campaignName: r.campaign_name ?? null,
        leadId: r.lead_id ?? null, leadName: r.lead_name ?? null,
        interactionId: typeof meta?.interaction_id === "number" ? meta.interaction_id : null,
        voiceCallId: typeof meta?.voice_call_id === "number" ? meta.voice_call_id : null,
      };
    });
    return { lines, page: opts.page, hasMore: rows.length > opts.limit };
  },

  async getGateInputs(accountId: number): Promise<GateInputs> {
    const [acc] = (await db.execute(sql`
      SELECT id, enable_reputation_management, enable_review_response, missed_call_enabled, missed_call_number
      FROM "p2mxx34fvbf3ll6"."Accounts" WHERE id = ${accountId}
    `)).rows as any[];
    const campaigns = (await db.execute(sql`
      SELECT c.id, c.name, c.status, c.campaign_type, c.max_bumps,
        c.bump_1_delay_hours, c.bump_2_delay_hours, c.bump_3_delay_hours, c.bump_4_delay_hours,
        c.use_ai_bumps, c.channel_mode, c.fallback_channel, c.daily_lead_limit,
        c.active_hours_start::text AS active_hours_start, c.active_hours_end::text AS active_hours_end,
        EXISTS (SELECT 1 FROM ${T} l WHERE l.kind = 'action' AND l."Campaigns_id" = c.id AND l.created_at > NOW() - INTERVAL '7 days') AS had_activity,
        (SELECT COUNT(*) FROM "p2mxx34fvbf3ll6"."Leads" ld WHERE ld."Campaigns_id" = c.id AND ld.automation_status = 'active')::int AS active_leads
      FROM "p2mxx34fvbf3ll6"."Campaigns" c WHERE c."Accounts_id" = ${accountId}
      ORDER BY c.id
    `)).rows as any[];
    const voice = (await db.execute(sql`
      SELECT phone_number, enabled, transfer_number FROM "p2mxx34fvbf3ll6"."Voice_Numbers" WHERE accounts_id = ${accountId}
    `)).rows as any[];
    const widgets = (await db.execute(sql`
      SELECT enabled FROM "p2mxx34fvbf3ll6"."Widget_Configs" WHERE "Accounts_id" = ${accountId}
    `)).rows as any[];
    const [prof] = (await db.execute(sql`
      SELECT setup->'stock'->>'feedUrl' AS feed_url FROM "p2mxx34fvbf3ll6"."Account_Communication_Profile"
      WHERE "Accounts_id" = ${accountId} LIMIT 1
    `)).rows as any[];
    return {
      account: {
        id: accountId,
        enableReputationManagement: acc?.enable_reputation_management ?? null,
        enableReviewResponse: acc?.enable_review_response ?? null,
        missedCallEnabled: acc?.missed_call_enabled ?? null,
        missedCallNumber: acc?.missed_call_number ?? null,
      },
      campaigns: campaigns.map((c) => ({
        id: c.id, name: c.name ?? `#${c.id}`, status: c.status, campaignType: c.campaign_type,
        maxBumps: c.max_bumps == null ? null : Number(c.max_bumps),
        bumpDelaysHours: [c.bump_1_delay_hours, c.bump_2_delay_hours, c.bump_3_delay_hours, c.bump_4_delay_hours].map((v) => (v == null ? null : Number(v))),
        useAiBumps: c.use_ai_bumps, channelMode: c.channel_mode, fallbackChannel: c.fallback_channel,
        dailyLeadLimit: c.daily_lead_limit == null ? null : Number(c.daily_lead_limit),
        activeHoursStart: c.active_hours_start, activeHoursEnd: c.active_hours_end,
        hadActivity7d: !!c.had_activity, activeLeads: Number(c.active_leads ?? 0),
      })),
      voiceNumbers: voice.map((v) => ({ phoneNumber: v.phone_number, enabled: !!v.enabled, transferNumber: v.transfer_number })),
      widgets: widgets.map((w) => ({ enabled: w.enabled })),
      stockFeedUrl: prof?.feed_url || null,
    };
  },

  async getClientsOnCounts(): Promise<Map<string, number>> {
    const ids = ((await db.execute(sql`
      SELECT id FROM "p2mxx34fvbf3ll6"."Accounts" WHERE id <> 1 AND COALESCE(LOWER(status), 'active') NOT IN ('inactive', 'archived', 'deleted')
    `)).rows as any[]).map((r) => Number(r.id));
    const out = new Map<string, number>();
    for (const id of ids) {
      const lines = buildClientLines(await automationDiaryStorage.getGateInputs(id));
      const onIds = new Set(lines.filter((l) => l.state !== "off").map((l) => l.automationId));
      onIds.forEach((a) => out.set(a, (out.get(a) ?? 0) + 1));
    }
    return out;
  },
};
```

Verify column names before running: `grep -n "first_name\|last_name" shared/schema.ts | head` (Leads), the Accounts `status` values (`psql ... -c 'select distinct status from "p2mxx34fvbf3ll6"."Accounts"'`), and adjust the `getClientsOnCounts` status filter to the real "inactive" values. Account 1 is the agency itself and is excluded from "clients ON".

Add to `server/storage.ts`: `import { automationDiaryStorage } from "./storage/automationDiary";` and `...automationDiaryStorage,` next to `...automationStorage,`.

- [ ] **Step 2: Rewrite `server/routes/automation.ts`**

```ts
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { wrapAsync, getEngineUrl } from "./_helpers";
import { AUTOMATION_CATALOGUE, findEntry } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, type ClientAutomationsResponse, type EngineJobsHealth, type OverviewResponse } from "@shared/automationTypes";
import { buildOverviewRows, overviewTotals } from "../automations/health";
import { buildClientLines } from "../automations/clientGates";

let overviewCache: { data: OverviewResponse; ts: number } | null = null;
const OVERVIEW_TTL_MS = 25_000;

async function fetchEngineHealth(): Promise<EngineJobsHealth | null> {
  try {
    const r = await fetch(getEngineUrl() + "/api/jobs-health", { signal: AbortSignal.timeout(5000) });
    return r.ok ? ((await r.json()) as EngineJobsHealth) : null;
  } catch {
    return null;
  }
}

export function registerAutomationRoutes(app: Express) {
  app.get("/api/automations/overview", requireOwner, wrapAsync(async (_req, res) => {
    if (overviewCache && Date.now() - overviewCache.ts < OVERVIEW_TTL_MS) return res.json(overviewCache.data);
    const [engine, counts24h, clientsOn] = await Promise.all([
      fetchEngineHealth(),
      storage.getActionCountsByWorkflow(24),
      storage.getClientsOnCounts(),
    ]);
    const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine, counts24h, clientsOn, now: Date.now() });
    const data: OverviewResponse = {
      engineReachable: engine !== null,
      schedulerRunning: engine?.scheduler_running ?? false,
      engineStartedAt: engine?.started_at ?? null,
      rows,
      totals: overviewTotals(rows),
    };
    overviewCache = { data, ts: Date.now() };
    res.json(data);
  }));

  app.get("/api/automations/:id/diary", requireOwner, wrapAsync(async (req, res) => {
    const id = String(req.params.id);
    const entry = findEntry(id);
    const names = entry ? [entry.id, ...(entry.aliases ?? []), ...(entry.jobId ? [entry.jobId] : [])] : [id];
    const page = Math.max(1, Number(req.query.page) || 1);
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    res.json(await storage.getDiaryPage({
      names, page, limit: 50,
      accountId: accountId && Number.isFinite(accountId) ? accountId : undefined,
      failedOnly: req.query.failedOnly === "1",
    }));
  }));

  app.get("/api/accounts/:id/automations", requireOwner, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId)) return res.status(400).json({ message: "Invalid account id" });
    const [inputs, counts] = await Promise.all([
      storage.getGateInputs(accountId),
      storage.getActionCountsForAccount(accountId, 7),
    ]);
    const countsFor = (automationId: string, campaignId: number | null) => {
      const entry = findEntry(automationId);
      const names = entry ? [entry.id, ...(entry.aliases ?? [])] : [automationId];
      // Campaign lines read their campaign's rows; account lines read every row of that automation.
      let acc = { ...EMPTY_COUNTS };
      counts.forEach((c, key) => {
        const [name, camp] = key.split("|");
        if (!names.includes(name)) return;
        if (campaignId !== null && camp !== String(campaignId)) return;
        acc = {
          success: acc.success + c.success, failed: acc.failed + c.failed, skipped: acc.skipped + c.skipped,
          lastActionAt: !acc.lastActionAt || (c.lastActionAt && c.lastActionAt > acc.lastActionAt) ? c.lastActionAt : acc.lastActionAt,
          topFailureReason: acc.topFailureReason ?? c.topFailureReason,
        };
      });
      return acc;
    };
    const lines = buildClientLines(inputs).map((l) => ({ ...l, counts7d: countsFor(l.automationId, l.campaignId) }));
    const onIds = new Set(lines.filter((l) => l.state !== "off").map((l) => l.automationId));
    const allIds = new Set(lines.map((l) => l.automationId));
    const data: ClientAutomationsResponse = {
      accountId,
      lines,
      totals: {
        on: onIds.size,
        total: allIds.size,
        actions7d: lines.reduce((n, l) => n + l.counts7d.success + l.counts7d.failed + l.counts7d.skipped, 0),
        failed7d: lines.reduce((n, l) => n + l.counts7d.failed, 0),
      },
    };
    res.json(data);
  }));
}
```

Note on `actions7d`: account-scoped automations sum all of the account's rows for that automation, and campaign lines sum per campaign, so an automation appears once per line and rows are not double counted (an automation is either campaign- or account-scoped).

Remove the old `/api/automation-health`, `/api/automation-logs/summary`, `/api/automation-logs` handlers from this file, but FIRST grep: `grep -rn "automation-logs" client/src server --include=*.ts --include=*.tsx`. `client/src/hooks/useApiData.ts:397` fetches `/api/automation-logs`; check whether that hook (`useAutomationLogs` in useApiData) is used by any component (`grep -rn "useAutomationLogs" client/src`). If it is used, keep ONE `/api/automation-logs` handler (move the existing one into this file unchanged) and delete only the duplicate in `leadsDemoScore.ts`. If unused, delete the hook too and both handlers.

- [ ] **Step 3: Fix the failure notifier**

In `server/storage/automation.ts`, change `getRecentFailedAutomationLogs(since)` to return diary failures only:

```ts
  async getRecentFailedAutomationLogs(since: Date) {
    const result = await db.execute(sql`
      SELECT workflow_name AS "workflowName", COUNT(*)::int AS count,
        (array_agg(COALESCE(NULLIF(skipped_reason, ''), NULLIF(output_data, ''), NULLIF(error_code, '')) ORDER BY created_at DESC))[1] AS "lastReason"
      FROM "p2mxx34fvbf3ll6"."Automation_Logs"
      WHERE kind = 'action' AND status = 'Failure' AND created_at > ${since}
      GROUP BY workflow_name
    `);
    return result.rows as Array<{ workflowName: string; count: number; lastReason: string | null }>;
  },
```

Delete `getSchedulerJobHealth` from the same file (no longer used; grep to confirm).

In `server/routes/ai-agents.ts` `startAutomationFailureNotifier`, the loop now gets one row per automation. Change the notification to:

```ts
          await notify({
            type: "critical_automation_failure",
            title: `${failure.workflowName}: ${failure.count} failed`,
            body: failure.lastReason || null,
            userId: user.id!,
            accountId: user.accountsId ?? null,
            read: false,
            link: "/platform/automation-logs",
          });
```

This is the first time this notifier actually fires (it never matched before). One notification per automation per 5-minute window, to agency users, is intended.

- [ ] **Step 4: Smoke-test the endpoints**

The CRM reloads on save. Check `pm2 logs leadawaker --lines 30 --nostream` for errors. Then log in and call the endpoints:

```bash
cd /home/gabriel/LeadAwakerApp
curl -s -c /tmp/claude-1000/la.cookie -H 'Content-Type: application/json' -d '{"email":"leadawaker@gmail.com","password":"Admin1234"}' http://localhost:5000/api/auth/login > /dev/null
curl -s -b /tmp/claude-1000/la.cookie http://localhost:5000/api/automations/overview | head -c 800; echo
curl -s -b /tmp/claude-1000/la.cookie "http://localhost:5000/api/automations/inbound_handler/diary" | head -c 600; echo
curl -s -b /tmp/claude-1000/la.cookie http://localhost:5000/api/accounts/1/automations | head -c 800; echo
```

(Check the real port and login route in `server/index.ts` / `server/auth.ts` first; adjust.) Expected: JSON for all three; overview `rows` length ≥ 30; account lines include `booking_reminder` with `state: "always_on"`. Before the engine restart, diary pages may be empty: that is expected.

- [ ] **Step 5: Commit**

```bash
git add server/storage/automationDiary.ts server/storage.ts server/storage/automation.ts server/routes/automation.ts server/routes/leadsDemoScore.ts server/routes/ai-agents.ts <client hook file if removed>
git commit -m "feat(automations): overview, diary and per-client endpoints; notifier reads diary failures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Global Automations page and diary panel

**Files:**
- Create: `client/src/features/automation/api.ts` (query hooks)
- Create: `client/src/features/automation/labels.ts` (label/format helpers)
- Create: `client/src/features/automation/components/HealthDot.tsx`
- Create: `client/src/features/automation/components/OverviewRowCard.tsx`
- Create: `client/src/features/automation/components/DiaryPanel.tsx`
- Rewrite: `client/src/pages/AutomationLogs.tsx`
- Rewrite: `client/src/locales/{en,nl,pt}/automation.json`
- Delete: every file under `client/src/features/automation/` not listed above as created (`automationConstants.ts`, `automationRegistry.ts`, `components/AutomationHealthGrid.tsx`, `AutomationSummaryCards.tsx`, `ExecutionMobileCards.tsx`, `ExecutionProgressBar.tsx`, `ExecutionTableRows.tsx`, `JobHealthCard.tsx`, `PipelineView.tsx`, `StepsTableRows.tsx`, `hooks/useAutomationLogs.ts`, `hooks/useExecutionGroups.ts`), after grepping that nothing outside the folder imports them.
- Modify: `FILE_MAP.md` (automation section)

**Interfaces:**
- Consumes: endpoints from Task 8; types from `@shared/automationTypes`; catalogue from `@shared/automationCatalogue`.
- Produces (used by Task 10):

```ts
// api.ts
export function useAutomationsOverview(): UseQueryResult<OverviewResponse>;   // refetchInterval 30_000
export function useAutomationDiary(id: string | null, opts: { accountId?: number; failedOnly: boolean; page: number }): UseQueryResult<DiaryPage>;
export function useClientAutomations(accountId: number): UseQueryResult<ClientAutomationsResponse>;
// labels.ts
export function automationName(t: TFunction, id: string): string;          // names.<id>, fallback id
export function automationDescription(t: TFunction, id: string): string;   // descriptions.<id>, fallback ""
export function triggerLabel(t: TFunction, trigger: AutomationTrigger): string;
export function actionLabel(t: TFunction, action: string): string;          // actions.<action>, fallback: replace "_" with " "
export function summaryText(t: TFunction, tokens: SummaryToken[]): string;  // joined with " · "
export function timeAgo(t: TFunction, iso: string | null): string;
// HealthDot.tsx
export function HealthDot(props: { state: HealthState; title?: string }): JSX.Element;
// DiaryPanel.tsx
export function DiaryPanel(props: { automationId: string; accountId?: number; onClose: () => void }): JSX.Element;
```

- [ ] **Step 1: Locale file (en)**

Rewrite `client/src/locales/en/automation.json`:

```json
{
  "page": { "title": "Automations", "refresh": "Refresh" },
  "summary": {
    "automations": "{{count}} automations",
    "healthy": "{{count}} healthy",
    "late": "{{count}} need a look",
    "failing": "{{count}} failing",
    "failures24h": "{{count}} failures in the last 24h"
  },
  "engine": {
    "down": "The automation engine is not responding. Scheduled automations cannot be checked right now.",
    "sinceRestart": "Engine restarted {{ago}}"
  },
  "services": {
    "reactivation": "Reactivation",
    "speed_to_lead": "Speed to lead",
    "bookings": "Bookings",
    "reputation": "Reviews & reputation",
    "receptionist": "Receptionist (phone + missed calls)",
    "inbox": "Inbox (incoming messages + AI replies)",
    "internal": "Behind the scenes",
    "unlisted": "Unlisted (not in the catalogue yet)"
  },
  "health": {
    "healthy": "Running fine",
    "warning": "Some actions failed",
    "late": "Late or not running",
    "failing": "Last run crashed",
    "waiting": "Not run since engine restart",
    "idle": "No activity",
    "unknown": "Unknown (engine not reachable)"
  },
  "row": {
    "lastRun": "Last ran {{ago}}",
    "lastAction": "Last action {{ago}}",
    "never": "No activity yet",
    "counts": "{{success}} worked · {{failed}} failed · {{skipped}} skipped",
    "clientsOn": "{{count}} client",
    "clientsOn_other": "{{count}} clients",
    "quiet": "Quiet for a while",
    "failedBadge": "{{count}} failed"
  },
  "trigger": {
    "everySeconds": "Every {{n}} sec",
    "everyMinutes": "Every {{n}} min",
    "everyHours": "Every {{n}} h",
    "daily": "Daily at {{at}}",
    "event": {
      "new_form_lead": "When a new form lead arrives",
      "reschedule": "When a booking needs rescheduling",
      "calendar_booking": "When a booking is made, moved or cancelled",
      "customer_reply": "When a customer replies",
      "phone_call": "When someone calls",
      "missed_call": "When a call is missed",
      "incoming_message": "When a message comes in",
      "lead_replies": "When a lead replies",
      "widget_message": "When someone chats on the website",
      "whatsapp_undelivered": "When a WhatsApp is not delivered",
      "delivery_receipt": "When a delivery receipt comes in"
    }
  },
  "names": {
    "campaign_launcher": "First message",
    "bump_scheduler": "Follow-ups",
    "buying_signal_followup": "Buying-signal nudge",
    "speed_to_lead": "Speed to lead",
    "booking_reminder": "Booking reminders",
    "no_show_followup": "No-show follow-up",
    "reschedule_reengage": "Reschedule re-engagement",
    "booking_webhook": "Calendar sync",
    "reputation_scheduler": "Review requests",
    "reputation_handler": "Review conversations",
    "review_response": "Google review replies",
    "voice_receptionist": "AI phone receptionist",
    "missed_call": "Missed-call text-back",
    "inbound_handler": "Incoming messages",
    "ai_conversation": "AI replies",
    "website_chat": "Website chat",
    "channel_fallback": "SMS fallback",
    "message_delivery": "Message delivery",
    "stock_sync": "Stock feed sync",
    "lead_scorer": "Lead scoring",
    "metrics_aggregator": "Campaign stats",
    "nightly_summary": "Nightly lead summaries",
    "task_reminders": "Task reminders",
    "quality_rating_monitor": "WhatsApp quality check",
    "voice_call_sweep": "Voice call cleanup",
    "error_log_digest": "Error digest",
    "booking_consistency_check": "Booking check",
    "demo_data_purge": "Demo data cleanup",
    "demo_bump_scheduler": "Demo follow-ups",
    "send_queue_worker": "Send queue"
  },
  "descriptions": {
    "campaign_launcher": "Sends the first WhatsApp to new leads in an active campaign.",
    "bump_scheduler": "Follows up with leads who did not reply.",
    "buying_signal_followup": "Nudges a lead who showed buying interest and then went quiet.",
    "speed_to_lead": "Messages a new form lead within seconds.",
    "booking_reminder": "Reminds people 24 hours and 1 hour before their appointment.",
    "no_show_followup": "Reaches out when someone misses their appointment.",
    "reschedule_reengage": "Picks the conversation back up when a booking needs a new time.",
    "booking_webhook": "Keeps leads in sync when a booking is made, moved or cancelled.",
    "reputation_scheduler": "Asks served customers how it went and for a review.",
    "reputation_handler": "Handles the replies to review requests.",
    "review_response": "Drafts replies to new Google reviews.",
    "voice_receptionist": "Answers the phone for the client.",
    "missed_call": "Texts people back when the client misses their call.",
    "inbound_handler": "Receives every incoming message and routes it.",
    "ai_conversation": "Writes and sends the AI reply when a lead answers.",
    "website_chat": "Handles messages from the chat bubble on the client's website.",
    "channel_fallback": "Sends an SMS when a WhatsApp cannot be delivered.",
    "message_delivery": "Reports messages that could not be delivered.",
    "stock_sync": "Refreshes the client's stock list for the AI.",
    "lead_scorer": "Scores every lead.",
    "metrics_aggregator": "Updates campaign stats.",
    "nightly_summary": "Writes a short summary of each lead every night.",
    "task_reminders": "Reminds you about due tasks.",
    "quality_rating_monitor": "Checks the WhatsApp number's quality rating.",
    "voice_call_sweep": "Closes phone calls that ended without a wrap-up.",
    "error_log_digest": "Sends you a morning digest of engine errors.",
    "booking_consistency_check": "Checks every booking against the calendar each morning.",
    "demo_data_purge": "Deletes expired demo data.",
    "demo_bump_scheduler": "Follow-ups for website demo testers.",
    "send_queue_worker": "Sends queued messages at a safe pace."
  },
  "actions": {
    "sent_first_message": "Sent first message",
    "skipped_invalid_phone": "Skipped: invalid phone number",
    "sent_bump_1": "Sent follow-up 1",
    "sent_bump_2": "Sent follow-up 2",
    "sent_bump_3": "Sent follow-up 3",
    "sent_bump_4": "Sent follow-up 4",
    "sent_reengagement": "Sent re-engagement message",
    "closed_no_reply": "Closed: no reply after follow-ups",
    "sent_nudge": "Sent nudge",
    "sent_reminder_24h": "Sent 24h reminder",
    "sent_reminder_1h": "Sent 1h reminder",
    "sent_rebook_link": "Sent rebooking link",
    "sent_checkin": "Sent no-show check-in",
    "marked_lost": "Marked as lost",
    "sent_feedback_ask": "Asked for feedback",
    "drafted_review_reply": "Drafted review reply",
    "synced_stock_feed": "Synced stock feed",
    "received_message": "Received message",
    "sent_reply": "Sent AI reply",
    "sent_referral_ask": "Asked for a referral",
    "sent_fallback_sms": "Sent SMS fallback",
    "sent_fallback_email": "Sent email fallback",
    "sent_reengage": "Sent re-engagement",
    "booking_created": "Booking made",
    "booking_rescheduled": "Booking moved",
    "booking_cancelled": "Booking cancelled",
    "sent_textback": "Sent missed-call text",
    "voicemail_received": "Voicemail received",
    "delivery_failed": "Message not delivered",
    "call_handled": "Answered a call",
    "call_transferred": "Answered and transferred a call",
    "call_failed": "Call failed"
  },
  "outcome": { "success": "Worked", "failed": "Failed", "skipped": "Skipped" },
  "diary": {
    "title": "Diary",
    "failedOnly": "Failures only",
    "allClients": "All clients",
    "empty": "Nothing recorded yet.",
    "loadMore": "Show more",
    "openLead": "Open lead",
    "close": "Close"
  },
  "ago": { "justNow": "just now", "minutes": "{{n}}m ago", "hours": "{{n}}h ago", "days": "{{n}}d ago" },
  "client": {
    "title": "Automations",
    "lastDays": "Last 7 days",
    "header": "{{on}} of {{total}} on · {{actions}} actions · {{failed}} failed",
    "state": { "on": "On", "off": "Off", "always_on": "Always on" },
    "change": "Change",
    "changeHintAccount": "Change in Settings > My Account while viewing this client",
    "counts7d": "7 days: {{success}} worked · {{failed}} failed · {{skipped}} skipped",
    "topReason": "Most common problem: {{reason}}",
    "warning": { "paused_followups": "Campaign paused, follow-ups still going out to {{count}} leads" },
    "empty": "No automations for this client yet."
  },
  "summaryTokens": {
    "dailyLimit": "{{n}} per day",
    "activeHours": "{{start}}-{{end}}",
    "bumps": "{{n}} follow-ups ({{delays}})",
    "aiBumps": "AI-written",
    "fallbackTo": "Falls back to {{channel}}",
    "reminderTimes": "24h + 1h before",
    "voiceLine": "Line {{number}}",
    "missedCallNumber": "Number {{number}}"
  }
}
```

Write `nl` and `pt` with the same keys, translated (Dutch; Brazilian Portuguese, use unicode escapes for accented characters only if the existing pt files do so, check `client/src/locales/pt/voiceTab.json`). Keep `{{...}}` placeholders and the `_other` plural keys.

Add to `client/src/locales/{en,nl,pt}/accounts.json` under `workspace.tabs`: `"automations": "Automations"` / `"Automatiseringen"` / `"Automações"` (match the escape style of the file).

- [ ] **Step 2: api.ts and labels.ts**

```ts
// client/src/features/automation/api.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { ClientAutomationsResponse, DiaryPage, OverviewResponse } from "@shared/automationTypes";

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function useAutomationsOverview() {
  return useQuery<OverviewResponse>({
    queryKey: ["/api/automations/overview"],
    queryFn: () => getJson("/api/automations/overview"),
    refetchInterval: 30_000,
  });
}

export function useAutomationDiary(id: string | null, opts: { accountId?: number; failedOnly: boolean; page: number }) {
  const qs = new URLSearchParams({ page: String(opts.page) });
  if (opts.accountId) qs.set("accountId", String(opts.accountId));
  if (opts.failedOnly) qs.set("failedOnly", "1");
  return useQuery<DiaryPage>({
    queryKey: ["/api/automations/diary", id, opts],
    queryFn: () => getJson(`/api/automations/${encodeURIComponent(id!)}/diary?${qs}`),
    enabled: !!id,
  });
}

export function useClientAutomations(accountId: number) {
  return useQuery<ClientAutomationsResponse>({
    queryKey: ["/api/accounts/automations", accountId],
    queryFn: () => getJson(`/api/accounts/${accountId}/automations`),
    enabled: accountId > 0,
  });
}
```

```ts
// client/src/features/automation/labels.ts
import type { TFunction } from "i18next";
import type { AutomationTrigger } from "@shared/automationCatalogue";
import type { SummaryToken } from "@shared/automationTypes";

export const automationName = (t: TFunction, id: string) => t(`names.${id}`, { defaultValue: id });
export const automationDescription = (t: TFunction, id: string) => t(`descriptions.${id}`, { defaultValue: "" });
export const actionLabel = (t: TFunction, action: string) => t(`actions.${action}`, { defaultValue: action.replace(/_/g, " ") });

export function triggerLabel(t: TFunction, trigger: AutomationTrigger): string {
  if (trigger.type === "event") return t(`trigger.event.${trigger.on}`, { defaultValue: trigger.on });
  if (trigger.type === "daily") return t("trigger.daily", { at: trigger.at });
  const s = trigger.everySeconds;
  if (s < 60) return t("trigger.everySeconds", { n: s });
  if (s < 3600) return t("trigger.everyMinutes", { n: Math.round(s / 60) });
  return t("trigger.everyHours", { n: Math.round(s / 3600) });
}

export function summaryText(t: TFunction, tokens: SummaryToken[]): string {
  return tokens.map((tok) => t(`summaryTokens.${tok.key}`, { ...(tok.values ?? {}), defaultValue: tok.key })).join(" · ");
}

export function timeAgo(t: TFunction, iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return t("ago.justNow");
  if (mins < 60) return t("ago.minutes", { n: mins });
  const h = Math.round(mins / 60);
  if (h < 48) return t("ago.hours", { n: h });
  return t("ago.days", { n: Math.round(h / 24) });
}
```

- [ ] **Step 3: HealthDot, OverviewRowCard, DiaryPanel**

```tsx
// client/src/features/automation/components/HealthDot.tsx
import type { HealthState } from "@shared/automationTypes";

const COLOR: Record<HealthState, string> = {
  healthy: "var(--good)",
  warning: "var(--warn)",
  late: "var(--warn)",
  failing: "var(--destructive)",
  waiting: "var(--mute)",
  idle: "var(--mute)",
  unknown: "var(--mute)",
};

export function HealthDot({ state, title }: { state: HealthState; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title ?? state}
      title={title ?? state}
      style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: COLOR[state], flexShrink: 0 }}
    />
  );
}
```

```tsx
// client/src/features/automation/components/OverviewRowCard.tsx
import { useTranslation } from "react-i18next";
import { ListCard, Pill } from "@/components/crm/primitives";
import type { OverviewRow } from "@shared/automationTypes";
import { HealthDot } from "./HealthDot";
import { automationName, automationDescription, triggerLabel, timeAgo } from "../labels";

export function OverviewRowCard({ row, selected, onClick }: { row: OverviewRow; selected: boolean; onClick: () => void }) {
  const { t } = useTranslation("automation");
  const c = row.counts24h;
  const scheduled = row.entry ? row.entry.trigger.type !== "event" : false;
  const when = row.lastRunAt
    ? t(scheduled ? "row.lastRun" : "row.lastAction", { ago: timeAgo(t, row.lastRunAt) })
    : t("row.never");
  return (
    <ListCard selected={selected} onClick={onClick} role="button" tabIndex={0} data-testid={`automation-row-${row.id}`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ paddingTop: 5 }}><HealthDot state={row.health} title={t(`health.${row.health}`)} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, row.id)}</span>
            {row.entry && <span style={{ fontSize: 12, color: "var(--mute)" }}>{triggerLabel(t, row.entry.trigger)}</span>}
            {row.quiet && <Pill>{t("row.quiet")}</Pill>}
            {c.failed > 0 && <Pill color="var(--destructive)">{t("row.failedBadge", { count: c.failed })}</Pill>}
          </div>
          {row.entry && <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>{automationDescription(t, row.id)}</div>}
          <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{when}</span>
            <span>{t("row.counts", { success: c.success, failed: c.failed, skipped: c.skipped })}</span>
            {row.clientsOn !== null && <span>{t("row.clientsOn", { count: row.clientsOn })}</span>}
          </div>
          {row.lastError && row.health === "failing" && (
            <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 4, wordBreak: "break-word" }}>{row.lastError}</div>
          )}
        </div>
      </div>
    </ListCard>
  );
}
```

```tsx
// client/src/features/automation/components/DiaryPanel.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import type { DiaryLine } from "@shared/automationTypes";
import { useAutomationDiary } from "../api";
import { actionLabel, automationName, timeAgo } from "../labels";

const OUTCOME_COLOR = { success: "var(--good)", failed: "var(--destructive)", skipped: "var(--mute)" } as const;

export function DiaryPanel({ automationId, accountId, onClose }: { automationId: string; accountId?: number; onClose: () => void }) {
  const { t } = useTranslation("automation");
  const [, setLocation] = useLocation();
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<DiaryLine[]>([]);
  const q = useAutomationDiary(automationId, { accountId, failedOnly, page });

  // Accumulate pages; reset when the filter or automation changes.
  const shown = page === 1 ? (q.data?.lines ?? []) : [...lines, ...(q.data?.page === page ? q.data.lines : [])];

  const openLead = (leadId: number) => {
    setPersistedSelection("selected-lead-id", String(leadId));
    setLocation("/platform/leads");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }} data-testid="automation-diary-panel">
      <div className="shrink-0 flex items-center gap-2 px-5" style={{ height: 60, borderBottom: "1px solid var(--line)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)" }}>{t("diary.title")}</div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, automationId)}</div>
        </div>
        <label style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); setPage(1); setLines([]); }} />
          {t("diary.failedOnly")}
        </label>
        <button className="la-btn la-btn--soft la-btn--icon" onClick={onClose} title={t("diary.close")}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.length === 0 && !q.isLoading && <div style={{ color: "var(--mute)", fontSize: 13 }}>{t("diary.empty")}</div>}
        {shown.map((l) => (
          <div key={l.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill color={OUTCOME_COLOR[l.outcome]}>{t(`outcome.${l.outcome}`)}</Pill>
              <span style={{ color: "var(--ink)", fontSize: 13 }}>{actionLabel(t, l.action)}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--mute-2)" }} title={new Date(l.createdAt).toLocaleString()}>{timeAgo(t, l.createdAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {l.accountName && !accountId && <span>{l.accountName}</span>}
              {l.campaignName && <span>{l.campaignName}</span>}
              {l.leadId && (
                <button type="button" onClick={() => openLead(l.leadId!)} style={{ color: "var(--wine)", textDecoration: "underline" }}>
                  {l.leadName || t("diary.openLead")}
                </button>
              )}
            </div>
            {l.reason && l.outcome !== "success" && (
              <div style={{ fontSize: 12, color: l.outcome === "failed" ? "var(--destructive)" : "var(--mute)", marginTop: 3, wordBreak: "break-word" }}>{l.reason}</div>
            )}
          </div>
        ))}
        {q.data?.hasMore && (
          <button className="la-btn la-btn--soft" onClick={() => { setLines(shown); setPage((p) => p + 1); }}>{t("diary.loadMore")}</button>
        )}
      </div>
    </div>
  );
}
```

Check `setPersistedSelection`'s signature in `client/src/hooks/usePersistedSelection.ts:92` (value type) and that the app uses `wouter` (`grep -n "from \"wouter\"" client/src/components/crm/NotificationCenter.tsx`). Adjust if different.

- [ ] **Step 4: Rewrite the page**

```tsx
// client/src/pages/AutomationLogs.tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { IconBtn } from "@/components/ui/icon-btn";
import { GroupHeader } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { SERVICE_ORDER, type AutomationService } from "@shared/automationCatalogue";
import type { OverviewRow } from "@shared/automationTypes";
import { useAutomationsOverview } from "@/features/automation/api";
import { OverviewRowCard } from "@/features/automation/components/OverviewRowCard";
import { DiaryPanel } from "@/features/automation/components/DiaryPanel";
import { timeAgo } from "@/features/automation/labels";

type GroupKey = AutomationService | "unlisted";

export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const q = useAutomationsOverview();
  const [selected, setSelected] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<GroupKey, OverviewRow[]>();
    for (const r of q.data?.rows ?? []) {
      const key: GroupKey = r.entry ? r.entry.service : "unlisted";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return ([...SERVICE_ORDER, "unlisted"] as GroupKey[]).filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }));
  }, [q.data]);

  const totals = q.data?.totals;

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-automation-logs">
        <div className="la-page-header">
          <span className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{t("page.title")}</span>
          {totals && (
            <span style={{ fontSize: 12, color: "var(--mute)", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{t("summary.automations", { count: totals.automations })}</span>
              <span>{t("summary.healthy", { count: totals.healthy })}</span>
              {totals.late > 0 && <span style={{ color: "var(--warn)" }}>{t("summary.late", { count: totals.late })}</span>}
              {totals.failing > 0 && <span style={{ color: "var(--destructive)" }}>{t("summary.failing", { count: totals.failing })}</span>}
              <span>{t("summary.failures24h", { count: totals.failures24h })}</span>
            </span>
          )}
          <div style={{ marginLeft: "auto" }}>
            <IconBtn onClick={() => q.refetch()} title={t("page.refresh")}>
              <RefreshCw className={cn("w-4 h-4", q.isFetching && "animate-spin")} />
            </IconBtn>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
          <div className="min-h-0 overflow-y-auto" style={{ flex: 1, padding: "16px 20px 32px", maxWidth: 1386 }}>
            {q.error ? (
              <ApiErrorFallback error={q.error as Error} onRetry={() => q.refetch()} />
            ) : q.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[64px] bg-primary/10 rounded-xl animate-pulse" />)}
              </div>
            ) : q.data ? (
              <>
                {!q.data.engineReachable && (
                  <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "var(--warn-tint)", color: "var(--ink)", fontSize: 13 }}>{t("engine.down")}</div>
                )}
                {q.data.engineStartedAt && (
                  <div style={{ fontSize: 12, color: "var(--mute-2)", marginBottom: 8 }}>{t("engine.sinceRestart", { ago: timeAgo(t, q.data.engineStartedAt) })}</div>
                )}
                {groups.map(({ key, rows }) => {
                  const collapsible = key === "internal";
                  const open = !collapsible || internalOpen;
                  return (
                    <section key={key} style={{ marginBottom: 16 }}>
                      {collapsible ? (
                        <button type="button" onClick={() => setInternalOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <GroupHeader label={t(`services.${key}`)} count={rows.length} sticky={false} />
                        </button>
                      ) : (
                        <GroupHeader label={t(`services.${key}`)} count={rows.length} sticky={false} />
                      )}
                      {open && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--list-card-gap)", marginTop: 6 }}>
                          {rows.map((r) => (
                            <OverviewRowCard key={r.id} row={r} selected={selected === r.id} onClick={() => setSelected(r.id)} />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            ) : null}
          </div>
          {selected && (
            <div className="min-h-0" style={{ width: 420, maxWidth: "100%", flexShrink: 0 }}>
              <DiaryPanel key={selected} automationId={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
```

On narrow screens (<768px) the diary panel should replace the list instead of sitting beside it: use `useIsMobile()` from `@/hooks/useIsMobile` and, when mobile and `selected`, render only the panel at full width.

- [ ] **Step 5: Delete dead code and update FILE_MAP**

For each file to delete, confirm with `grep -rn "<basename without extension>" client/src --include=*.ts --include=*.tsx` that only files inside `client/src/features/automation/` (also being deleted) reference it. Then `git rm` them. Update the automation section of `FILE_MAP.md` to list the new files (`api.ts`, `labels.ts`, `HealthDot`, `OverviewRowCard`, `DiaryPanel`, `shared/automationCatalogue.ts`, `shared/automationTypes.ts`, `server/automations/*`, `server/storage/automationDiary.ts`) and remove the deleted ones (including the stale PipelineView line).

- [ ] **Step 6: Visual check**

The app reloads on save. Open `https://app.leadawaker.com/platform/automation-logs` with playwright-cli (log in with leadawaker@gmail.com / Admin1234), take a screenshot at 1440px and at 390px, click one row and screenshot the diary panel, switch to dark mode if a toggle is reachable. Check: groups in service order, internal collapsed, counts visible, no console errors. Close the browser when done (Pi resource hygiene).

- [ ] **Step 7: Commit**

```bash
git add client/src/features/automation client/src/pages/AutomationLogs.tsx client/src/locales/en/automation.json client/src/locales/nl/automation.json client/src/locales/pt/automation.json client/src/locales/en/accounts.json client/src/locales/nl/accounts.json client/src/locales/pt/accounts.json FILE_MAP.md
git commit -m "feat(automations): refreshed Automations page with service groups and diary panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add` on the folder stages the deletions done with `git rm` and the new files; check `git status` that nothing from other sessions is staged.)

---

### Task 10: Per-client Automations tab and campaign settings deep link

**Files:**
- Create: `client/src/features/automation/components/ClientAutomationsTab.tsx`
- Create: `client/src/features/automation/changeLinks.ts`
- Modify: `client/src/features/accounts/components/workspace/types.ts:6` (`WorkspaceTab`)
- Modify: `client/src/features/accounts/components/workspace/AccountsWorkspace.tsx:24` (ACCOUNT_TABS, owner filter) and the mobile tab segment (~l.146)
- Modify: `client/src/features/accounts/components/workspace/AccountsTopBar.tsx:21-27` (TABS, TAB_ICONS, owner filter)
- Modify: `client/src/features/accounts/components/workspace/OverviewTab.tsx:57-79` (`TabContent`)
- Modify: `client/src/features/campaigns/pages/CampaignsPage.tsx` (read `?campaign=&section=`)
- Modify: `client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx:56` (initial section from prop)

**Interfaces:**
- Consumes: `useClientAutomations`, `DiaryPanel`, labels (Task 9); `ClientLine`, `ChangeTarget` types.
- Produces: `WorkspaceTab` includes `"automations"`; `?tab=automations` deep link works; `/platform/campaigns?campaign=<id>&section=<business|ai|behavior>` opens that campaign's settings section.

- [ ] **Step 1: Change links helper**

```ts
// client/src/features/automation/changeLinks.ts
import type { ChangeTarget } from "@shared/automationTypes";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";

/** Navigate to where a setting lives. Returns false when it cannot be linked (show the hint instead). */
export function goToChangeTarget(target: ChangeTarget, accountId: number, setLocation: (to: string) => void, currentAccountId: number): boolean {
  if (target.kind === "account_tab") {
    setPersistedSelection("selected-account-id", String(accountId));
    // Same page: the workspace reads ?tab= once on mount, so force a remount via navigation.
    setLocation(`/platform/accounts?tab=${target.tab}`);
    return true;
  }
  if (target.kind === "campaign_section") {
    setPersistedSelection("selected-campaign-id", String(target.campaignId));
    setLocation(`/platform/campaigns?campaign=${target.campaignId}&section=${target.section}`);
    return true;
  }
  if (target.kind === "settings_account") {
    if (currentAccountId !== accountId) return false;
    setLocation("/platform/settings?tab=account");
    return true;
  }
  return false;
}
```

If navigating to `/platform/accounts?tab=…` while already on the accounts page does not re-run the workspace's mount-only `?tab` effect, instead pass a callback from the workspace: give `ClientAutomationsTab` an `onOpenTab(tab)` prop that calls the workspace's `setTab`, and use it for `account_tab` targets. Prefer the callback (it is simpler and avoids a reload); the helper's `account_tab` branch is then only a fallback. Check `currentAccountId` from `useWorkspace()`.

- [ ] **Step 2: The tab component**

```tsx
// client/src/features/automation/components/ClientAutomationsTab.tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { ListCard, Pill, GroupHeader } from "@/components/crm/primitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SERVICE_ORDER, findEntry, type AutomationService } from "@shared/automationCatalogue";
import type { ClientLine, ClientState } from "@shared/automationTypes";
import { useClientAutomations } from "../api";
import { automationName, summaryText, timeAgo } from "../labels";
import { goToChangeTarget } from "../changeLinks";
import { DiaryPanel } from "./DiaryPanel";

const STATE_COLOR: Record<ClientState, string> = { on: "var(--good)", off: "var(--mute)", always_on: "var(--wine)" };

export function ClientAutomationsTab({ accountId, onOpenTab }: { accountId: number; onOpenTab?: (tab: "integrations" | "communication" | "voice") => void }) {
  const { t } = useTranslation("automation");
  const [, setLocation] = useLocation();
  const { currentAccountId } = useWorkspace();
  const isMobile = useIsMobile();
  const q = useClientAutomations(accountId);
  const [diaryFor, setDiaryFor] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<AutomationService, ClientLine[]>();
    for (const l of q.data?.lines ?? []) {
      const svc = findEntry(l.automationId)?.service;
      if (!svc) continue;
      map.set(svc, [...(map.get(svc) ?? []), l]);
    }
    return SERVICE_ORDER.filter((s) => map.has(s)).map((s) => ({ service: s, lines: map.get(s)! }));
  }, [q.data]);

  const change = (l: ClientLine) => {
    if (!l.change) return;
    if (l.change.kind === "account_tab" && onOpenTab) return onOpenTab(l.change.tab);
    goToChangeTarget(l.change, accountId, setLocation, currentAccountId);
  };

  if (q.isLoading) return <div className="h-[200px] bg-primary/10 rounded-xl animate-pulse" />;
  if (q.error || !q.data) return <div style={{ color: "var(--mute)" }}>{String((q.error as Error)?.message ?? "")}</div>;
  if (q.data.lines.length === 0) return <div style={{ color: "var(--mute)" }}>{t("client.empty")}</div>;

  const totals = q.data.totals;
  const list = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="client-automations">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t("client.header", { on: totals.on, total: totals.total, actions: totals.actions7d, failed: totals.failed7d })}</span>
        <span style={{ fontSize: 12, color: "var(--mute-2)" }}>{t("client.lastDays")}</span>
      </div>
      {groups.map(({ service, lines }) => (
        <section key={service}>
          <GroupHeader label={t(`services.${service}`)} count={lines.length} sticky={false} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--list-card-gap)", marginTop: 6 }}>
            {lines.map((l) => {
              const c = l.counts7d;
              const summary = summaryText(t, l.summary);
              const linkable = !!l.change && !(l.change.kind === "settings_account" && currentAccountId !== accountId);
              return (
                <ListCard key={`${l.automationId}-${l.campaignId ?? "acct"}`} selected={diaryFor === l.automationId} onClick={() => setDiaryFor(l.automationId)} role="button" tabIndex={0}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Pill color={STATE_COLOR[l.state]} tone={l.state === "off" ? "soft" : "solid"} style={{ minWidth: 72, justifyContent: "center" }}>{t(`client.state.${l.state}`)}</Pill>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, l.automationId)}</span>
                        {l.campaignName && <span style={{ fontSize: 12, color: "var(--mute)" }}>{l.campaignName}</span>}
                      </div>
                      {summary && <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>{summary}</div>}
                      {l.state !== "off" && (
                        <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>{t("client.counts7d", { success: c.success, failed: c.failed, skipped: c.skipped })}</span>
                          {c.lastActionAt && <span>{t("row.lastAction", { ago: timeAgo(t, c.lastActionAt) })}</span>}
                        </div>
                      )}
                      {c.failed > 0 && c.topFailureReason && (
                        <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 3 }}>{t("client.topReason", { reason: c.topFailureReason })}</div>
                      )}
                      {l.warning && (
                        <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
                          <AlertTriangle className="h-3.5 w-3.5" />{t(`client.warning.${l.warning.key}`, { count: l.warning.count })}
                        </div>
                      )}
                      {l.change?.kind === "settings_account" && !linkable && (
                        <div style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 3 }}>{t("client.changeHintAccount")}</div>
                      )}
                    </div>
                    {linkable && (
                      <button type="button" className="la-btn la-btn--soft" onClick={(e) => { e.stopPropagation(); change(l); }}>
                        {t("client.change")} →
                      </button>
                    )}
                  </div>
                </ListCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  if (!diaryFor) return list;
  if (isMobile) return <div style={{ height: "70vh" }}><DiaryPanel automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} /></div>;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{list}</div>
      <div style={{ width: 380, flexShrink: 0, maxHeight: "75vh", position: "sticky", top: 0 }}>
        <DiaryPanel key={diaryFor} automationId={diaryFor} accountId={accountId} onClose={() => setDiaryFor(null)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab into the workspace (owner only)**

- `types.ts`: `export type WorkspaceTab = "overview" | "integrations" | "communication" | "voice" | "automations";`
- `AccountsWorkspace.tsx`: `const ACCOUNT_TABS: WorkspaceTab[] = ["overview", "integrations", "communication", "voice", "automations"];` and get `isOwner` from `useWorkspace()`; compute `const visibleTabs = isOwner ? ACCOUNT_TABS : ACCOUNT_TABS.filter((k) => k !== "automations");`. Use `visibleTabs` in the mobile segment map (~l.140-150) and in the `?tab` deep-link check (so a non-owner `?tab=automations` is ignored). If `tab === "automations"` and `!isOwner`, fall back to `"overview"` (effect on `isOwner`). Pass `visibleTabs` to `AccountsTopBar` via a new prop `tabs: WorkspaceTab[]`, and pass `onOpenTab={setTab}` down to `TabContent` via `data` or a new prop.
- `AccountsTopBar.tsx`: remove the local `TABS` const, render `p.tabs`; add `automations: <Zap size={13} />` to `TAB_ICONS` (import `Zap` from lucide-react).
- `OverviewTab.tsx` `TabContent`: add an `onOpenTab?: (t: WorkspaceTab) => void` prop and
  ```tsx
  if (tab === "automations") return <ClientAutomationsTab accountId={data.accountId} onOpenTab={onOpenTab} />;
  ```
  with `import { ClientAutomationsTab } from "@/features/automation/components/ClientAutomationsTab";`. Because tabs are lazily heavy, wrap this import with `React.lazy` + `Suspense` if `OverviewTab.tsx` already lazy-loads other tabs (check how `VoiceTab` is imported and follow the same pattern).

- [ ] **Step 4: Campaign settings deep link**

In `CampaignsPage.tsx`, add a mount-only effect, following the account workspace pattern:

```tsx
  // Deep link from the Automations tab: /platform/campaigns?campaign=<id>&section=<business|ai|behavior>
  // selects the campaign, opens its configurations tab and the given settings section. Stripped once applied.
  const [initialSettingsSection, setInitialSettingsSection] = useState<"business" | "ai" | "behavior" | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("campaign");
    if (!id) return;
    const section = params.get("section");
    if (section === "business" || section === "ai" || section === "behavior") setInitialSettingsSection(section);
    setPersistedSelection("selected-campaign-id", id);
    // open the configurations tab: use the same setter the page uses for DETAIL_TAB_KEY
    params.delete("campaign");
    params.delete("section");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);
```

Read how `CampaignsPage.tsx` stores the detail tab (`DETAIL_TAB_KEY`, ~line 101) and set it to `"configurations"` with that same setter in the effect. If the selection hook does not pick up `setPersistedSelection` after mount, call the page's `setSelectedCampaign` with the matching campaign once campaigns are loaded instead (effect depending on the campaigns list, guarded so it runs once). Thread `initialSettingsSection` down to `CampaignSettingsLayout` as an optional prop `initialSection?: "business" | "ai" | "behavior"`, and in `CampaignSettingsLayout.tsx:56` use it:

```tsx
  const [active, setActive] = useState(props.initialSection ?? (isUniversal ? "ai" : "business"));
```

- [ ] **Step 5: Visual check**

With playwright-cli at `https://app.leadawaker.com/platform/accounts?tab=automations` (logged in as owner, select account 1 and then a client account like 53): screenshot at 1440px and 390px; click a line to open the diary; click a `Change →` on a campaign line and confirm the campaign page opens on Configurations → Behavior; click `Change →` on the voice line and confirm the Voice tab opens. Close the browser afterwards.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/automation/components/ClientAutomationsTab.tsx client/src/features/automation/changeLinks.ts client/src/features/accounts/components/workspace/types.ts client/src/features/accounts/components/workspace/AccountsWorkspace.tsx client/src/features/accounts/components/workspace/AccountsTopBar.tsx client/src/features/accounts/components/workspace/OverviewTab.tsx client/src/features/campaigns/pages/CampaignsPage.tsx client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx
git commit -m "feat(automations): per-client Automations tab with change links; campaign settings deep link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Go live (controller, not a subagent)

- [ ] **Step 1:** Ask Gabriel for OK to `pm2 restart leadawaker-engine` (it also deploys other sessions' pending engine work). Do not restart without it.
- [ ] **Step 2:** After restart: `pm2 logs leadawaker-engine --lines 50 --nostream` shows no tracebacks; `curl -s localhost:8100/api/jobs-health | head -c 600` shows `started_at` and `last_*` fields.
- [ ] **Step 3:** Within ~10 minutes: `psql ... -c "select workflow_name, step_name, status, count(*) from \"p2mxx34fvbf3ll6\".\"Automation_Logs\" where kind='action' group by 1,2,3"` shows real actions; no new `run_complete` rows.
- [ ] **Step 4:** Global page shows every registered job with green/grey dots; no Unlisted rows (or, if any, add them to the catalogue + locales).
- [ ] **Step 5:** Mark the spec's rollout checklist done in `specs/automation-overview/action-required.md` (create it listing: engine restart done/pending, cleanup runs at 03:00, paused-campaign follow-ups decision for Gabriel).
