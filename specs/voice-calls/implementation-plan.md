# Voice Calls Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every AI voice-demo call is saved as one record (times, booked date, recap, OpenAI session id) and shows up on a new owner-only "Voice calls" CRM page with conclusion, summary, recording playback and transcript.

**Architecture:** The automations engine (`/home/gabriel/automations`, Python/FastAPI/asyncpg) already writes each call turn to `Interactions` in the CRM's Postgres. It will also upsert one `Voice_Calls` row per call (keyed on `call_id`) from `CallLogger` and from `POST /voice/live/wrap-up`. The CRM (`/home/gabriel/LeadAwakerApp`, Express + Drizzle + React) reads that table plus the transcript turns and renders a list + detail page.

**Tech Stack:** Python 3 + asyncpg + pytest (engine); Express + Drizzle ORM + React + TanStack Query + react-i18next (CRM).

**Spec:** `specs/voice-calls/requirements.md`

## Global Constraints

- DB schema: `p2mxx34fvbf3ll6`. New table: `Voice_Calls` (double-quoted in raw SQL).
- `Voice_Calls.call_id` equals `Interactions.conversation_thread_id` (Drizzle: `interactions.conversationThreadId`) for that call's turns.
- Engine DB writes must never fail a live call or the wrap-up response: catch `Exception`, log `voice.calls.write_failed` with structlog, continue.
- Timestamps are set server-side (`now()` in SQL). The client never sends timestamps for DB writes.
- No hardcoded user-facing strings in the CRM: i18n namespace `voiceCalls` in `en`, `nl`, `pt` (Brazilian Portuguese).
- Dark mode via tokens only (`hsl(var(--primary))`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `var(--ink)`). No `bg-white`, `text-black`, raw hex.
- Page shell: `CrmShell` + `.la-page` + `.la-page-header` (CrmShell has no padding; never negative margins).
- New CRM page is a `React.lazy` import. Every file under 500 lines.
- **Never run `npx tsc`** (project rule). Never run `npm run dev`: the CRM runs under pm2 and reloads on save (~5-8s for `server/` and `shared/`).
- The engine (`pm2` process `leadawaker-engine`) does NOT auto-reload: restart it after engine edits.
- **Do not commit.** Both repos hold unrelated uncommitted work (CRM on `feat/website-widget`; engine on `feature/dbr-scoping-mode`, where `live_voice_routes.py` already has uncommitted edits). Gabriel decides branching and commits at the end.
- Scope: voice-demo calls only. No backfill of past calls. No audio stored by us: playback streams OpenAI's 30-day copy through the engine's existing `GET /voice/live/recording/{session_id}`.

---

### Task 1: Create the `Voice_Calls` table

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/shared/schema.ts` (append after the `interactions` table block, around line 780)
- Modify: `/home/gabriel/automations/tools/db/constants.py` (`class Table`)
- Create then delete: `/home/gabriel/LeadAwakerApp/.create-voice-calls.mjs`

**Interfaces:**
- Produces: Drizzle table `voiceCalls`, types `VoiceCall`, `VoiceCallSummary`, `VoiceCallSummaryItem`; engine constant `Table.VOICE_CALLS = "Voice_Calls"`.

- [ ] **Step 1: Add the Drizzle definition** to `shared/schema.ts` (all needed imports, `serial`, `jsonb`, `uniqueIndex`, `index`, already exist at the top of the file):

```ts
// ─── Voice_Calls ───────────────────────────────────────────────────────────────
// One row per AI voice call, written by the automations engine (CallLogger +
// /voice/live/wrap-up). The transcript stays in Interactions under the same
// conversation_thread_id.

export interface VoiceCallSummaryItem {
  intent: string;
  interest: string | null;
  notes: string | null;
}

export interface VoiceCallSummary {
  name: string | null;
  outcome?: string | null;
  items: VoiceCallSummaryItem[];
}

export const voiceCalls = nocodb.table("Voice_Calls", {
  id: serial("id").primaryKey(),
  callId: text("call_id").notNull(),
  sessionId: text("session_id"),
  accountsId: integer("accounts_id").notNull(),
  campaignsId: integer("campaigns_id"),
  leadsId: integer("leads_id"),
  language: text("language"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  turnCount: integer("turn_count").notNull().default(0),
  summary: jsonb("summary").$type<VoiceCallSummary>(),
  bookedSlot: text("booked_slot"),
  bookedIso: timestamp("booked_iso", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  callIdUnique: uniqueIndex("uq_voice_calls_call_id").on(t.callId),
  startedAtIdx: index("idx_voice_calls_started_at").on(t.startedAt),
}));

export type VoiceCall = typeof voiceCalls.$inferSelect;
```

If other tables in the file pass the extra-config callback as an array (`(t) => [ ... ]`) rather than an object, use the same form.

- [ ] **Step 2: Add the engine constant** in `tools/db/constants.py`, inside `class Table`, after `NICHE_VOCABULARY = "Niche_Vocabulary"`:

```python
    VOICE_CALLS = "Voice_Calls"
```

- [ ] **Step 3: Create the table with a direct pg script** (drizzle `db:push` needs a TTY). Write `/home/gabriel/LeadAwakerApp/.create-voice-calls.mjs`:

```js
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(`
  CREATE TABLE IF NOT EXISTS p2mxx34fvbf3ll6."Voice_Calls" (
    id serial PRIMARY KEY,
    call_id text NOT NULL,
    session_id text,
    accounts_id integer NOT NULL,
    campaigns_id integer,
    leads_id integer,
    language text,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    turn_count integer NOT NULL DEFAULT 0,
    summary jsonb,
    booked_slot text,
    booked_iso timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_calls_call_id ON p2mxx34fvbf3ll6."Voice_Calls" (call_id);
  CREATE INDEX IF NOT EXISTS idx_voice_calls_started_at ON p2mxx34fvbf3ll6."Voice_Calls" (started_at DESC);
`);
const r = await c.query(`SELECT count(*) FROM p2mxx34fvbf3ll6."Voice_Calls"`);
console.log("Voice_Calls rows:", r.rows[0].count);
await c.end();
```

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env ./.create-voice-calls.mjs && rm ./.create-voice-calls.mjs`
Expected: `Voice_Calls rows: 0`

- [ ] **Step 4: Check pm2 reloaded cleanly after the `shared/` edit**

Run: `sleep 8; pm2 logs --nostream --lines 30 | grep -iE "error" || echo clean`
Expected: `clean`

---

### Task 2: Engine DB helpers for `Voice_Calls`

**Files:**
- Create: `/home/gabriel/automations/tools/db/voice_calls.py`
- Test: `/home/gabriel/automations/tests/voice/test_voice_calls_db.py`

**Interfaces:**
- Consumes: `Table.VOICE_CALLS`; `fq(table_name) -> 'p2mxx34fvbf3ll6."<name>"'` from `tools.db.constants`; `get_pool()` from `tools.db.connection`.
- Produces (all `async`, return `None`, upsert on `call_id`, keyword-only):
  - `record_turn(*, call_id: str, accounts_id: int, campaigns_id: int | None, leads_id: int | None, language: str | None)`: creates the row on first turn, then increments `turn_count`
  - `record_booking(*, call_id: str, accounts_id: int, booked_slot: str, booked_iso: str | None)`
  - `record_summary(*, call_id: str, accounts_id: int, summary: dict)`
  - `record_wrap_up(*, call_id: str, accounts_id: int, session_id: str | None, summary: dict | None)`: sets `ended_at = now()`; a `None` session_id/summary keeps the stored value

- [ ] **Step 1: Write the failing tests** in `tests/voice/test_voice_calls_db.py`:

```python
import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from tools.db import voice_calls


def _pool():
    conn = MagicMock()
    conn.execute = AsyncMock(return_value="INSERT 0 1")
    acquire = MagicMock()
    acquire.__aenter__ = AsyncMock(return_value=conn)
    acquire.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire.return_value = acquire
    return pool, conn


def _run(fn, **kwargs):
    pool, conn = _pool()
    with patch("tools.db.voice_calls.get_pool", return_value=pool):
        asyncio.run(fn(**kwargs))
    return conn.execute.await_args


def test_record_turn_upserts_and_increments():
    args = _run(voice_calls.record_turn, call_id="web-1", accounts_id=1,
                campaigns_id=60, leads_id=9, language="nl")
    sql = args.args[0]
    assert 'p2mxx34fvbf3ll6."Voice_Calls"' in sql
    assert "ON CONFLICT (call_id)" in sql
    assert "turn_count + 1" in sql
    assert args.args[1:] == ("web-1", 1, 60, 9, "nl")


def test_record_booking_sets_slot_and_parsed_iso():
    args = _run(voice_calls.record_booking, call_id="web-1", accounts_id=1,
                booked_slot="Thu 2pm", booked_iso="2026-09-24T14:00:00+02:00")
    assert "booked_slot" in args.args[0] and "booked_iso" in args.args[0]
    assert args.args[3] == "Thu 2pm"
    assert isinstance(args.args[4], datetime)


def test_record_booking_tolerates_a_bad_iso():
    args = _run(voice_calls.record_booking, call_id="web-1", accounts_id=1,
                booked_slot="Thu 2pm", booked_iso="not a date")
    assert args.args[4] is None


def test_record_summary_stores_json():
    summary = {"name": "Sam", "outcome": "Booked", "items": []}
    args = _run(voice_calls.record_summary, call_id="web-1", accounts_id=1, summary=summary)
    assert args.args[3] == json.dumps(summary)


def test_record_wrap_up_keeps_stored_values_when_given_none():
    args = _run(voice_calls.record_wrap_up, call_id="web-1", accounts_id=1,
                session_id=None, summary=None)
    sql = args.args[0]
    assert "ended_at = now()" in sql
    assert "COALESCE(EXCLUDED.session_id" in sql
    assert "COALESCE(EXCLUDED.summary" in sql
    assert args.args[3] is None and args.args[4] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice/test_voice_calls_db.py -v`
Expected: FAIL with `ImportError: cannot import name 'voice_calls'`

- [ ] **Step 3: Implement** `tools/db/voice_calls.py`:

```python
"""Voice_Calls: one row per AI voice call, upserted on call_id.

Turns live in Interactions (conversation_thread_id = call_id). This row holds
what a turn cannot: start and end, the booking, the recap, the OpenAI session
id. Every write is an upsert, so events may arrive in any order.
"""

import json
from datetime import datetime

from tools.db.connection import get_pool
from tools.db.constants import fq, Table

_T = fq(Table.VOICE_CALLS)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


async def _execute(sql: str, *args) -> None:
    async with get_pool().acquire() as conn:
        await conn.execute(sql, *args)


async def record_turn(
    *, call_id: str, accounts_id: int, campaigns_id: int | None,
    leads_id: int | None, language: str | None,
) -> None:
    await _execute(
        f"""
        INSERT INTO {_T} (call_id, accounts_id, campaigns_id, leads_id, language,
                          started_at, turn_count)
        VALUES ($1, $2, $3, $4, $5, now(), 1)
        ON CONFLICT (call_id) DO UPDATE SET
            turn_count = {_T}.turn_count + 1,
            campaigns_id = COALESCE({_T}.campaigns_id, EXCLUDED.campaigns_id),
            leads_id = COALESCE({_T}.leads_id, EXCLUDED.leads_id),
            language = COALESCE({_T}.language, EXCLUDED.language),
            updated_at = now()
        """,
        call_id, accounts_id, campaigns_id, leads_id, language,
    )


async def record_booking(
    *, call_id: str, accounts_id: int, booked_slot: str, booked_iso: str | None,
) -> None:
    await _execute(
        f"""
        INSERT INTO {_T} (call_id, accounts_id, started_at, booked_slot, booked_iso)
        VALUES ($1, $2, now(), $3, $4)
        ON CONFLICT (call_id) DO UPDATE SET
            booked_slot = EXCLUDED.booked_slot,
            booked_iso = EXCLUDED.booked_iso,
            updated_at = now()
        """,
        call_id, accounts_id, booked_slot, _parse_iso(booked_iso),
    )


async def record_summary(*, call_id: str, accounts_id: int, summary: dict) -> None:
    await _execute(
        f"""
        INSERT INTO {_T} (call_id, accounts_id, started_at, summary)
        VALUES ($1, $2, now(), $3::jsonb)
        ON CONFLICT (call_id) DO UPDATE SET
            summary = EXCLUDED.summary,
            updated_at = now()
        """,
        call_id, accounts_id, json.dumps(summary),
    )


async def record_wrap_up(
    *, call_id: str, accounts_id: int, session_id: str | None, summary: dict | None,
) -> None:
    await _execute(
        f"""
        INSERT INTO {_T} (call_id, accounts_id, started_at, ended_at, session_id, summary)
        VALUES ($1, $2, now(), now(), $3, $4::jsonb)
        ON CONFLICT (call_id) DO UPDATE SET
            ended_at = now(),
            session_id = COALESCE(EXCLUDED.session_id, {_T}.session_id),
            summary = COALESCE(EXCLUDED.summary, {_T}.summary),
            updated_at = now()
        """,
        call_id, accounts_id, session_id,
        json.dumps(summary) if summary is not None else None,
    )
```

Note: `get_pool` must be looked up at call time (module-level name used inside `_execute`), which is what the tests patch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice/test_voice_calls_db.py -v`
Expected: 5 passed

---

### Task 3: `CallLogger` writes to `Voice_Calls`

**Files:**
- Modify: `/home/gabriel/automations/src/automations/voice/event_logger.py` (imports ~line 21; `_log` ~line 134; `book_appointment` branch ~line 175; `update_call_summary` branch ~line 196)
- Test: `/home/gabriel/automations/tests/voice/test_event_logger.py` (append)

**Interfaces:**
- Consumes: `record_turn`, `record_booking`, `record_summary` (Task 2).
- Produces: no new public API. `handle_event` receipts are unchanged. New private method `CallLogger._record(write, **kwargs)`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/voice/test_event_logger.py` (it already imports `asyncio`, `AsyncMock`, `patch`, `CallLogger`, and defines `_logger()` = account 52, campaign 60, call_id `"c1"`, language default `"en"`):

```python
def test_each_logged_turn_records_the_call():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=5)), \
             patch("src.automations.voice.event_logger.create_interaction",
                   new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.record_turn",
                   new=AsyncMock()) as rt:
            await lg.handle_event({"type": "live.caller_turn", "transcript": "hi"})
            await lg.handle_event({"type": "live.ai_turn", "transcript": "hello"})
            return rt.await_args_list
    calls = asyncio.run(run())
    assert len(calls) == 2
    assert calls[0].kwargs == {"call_id": "c1", "accounts_id": 52, "campaigns_id": 60,
                               "leads_id": 5, "language": "en"}


def test_booking_records_slot_on_the_call():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.execute_booking",
                   new=AsyncMock(return_value={"status": "booked", "slot": "Thu 2pm",
                                               "iso": "2026-09-24T14:00:00+02:00"})), \
             patch("src.automations.voice.event_logger.create_interaction",
                   new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.record_turn", new=AsyncMock()), \
             patch("src.automations.voice.event_logger.record_booking",
                   new=AsyncMock()) as rb:
            await lg.handle_event({"type": "response.function_call_arguments.done",
                                   "name": "book_appointment", "arguments": "{}"})
            return rb.await_args
    args = asyncio.run(run())
    assert args.kwargs == {"call_id": "c1", "accounts_id": 52, "booked_slot": "Thu 2pm",
                           "booked_iso": "2026-09-24T14:00:00+02:00"}


def test_summary_tool_records_summary():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.record_summary",
                   new=AsyncMock()) as rs:
            await lg.handle_event({"type": "response.function_call_arguments.done",
                                   "name": "update_call_summary",
                                   "arguments": '{"name": "Sam", "items": []}'})
            return rs.await_args
    args = asyncio.run(run())
    assert args.kwargs["summary"] == {"name": "Sam", "items": []}


def test_a_failed_call_record_never_breaks_the_turn():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.create_interaction",
                   new=AsyncMock(return_value=42)), \
             patch("src.automations.voice.event_logger.record_turn",
                   new=AsyncMock(side_effect=RuntimeError("db down"))):
            return await lg.handle_event({"type": "live.caller_turn", "transcript": "hi"})
    receipt = asyncio.run(run())
    assert receipt["interaction_id"] == 42
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice/test_event_logger.py -v`
Expected: the 4 new tests FAIL (`module ... has no attribute 'record_turn'`); existing tests pass.

- [ ] **Step 3: Implement.** Replace the import block at the top of `event_logger.py` (currently `import json` + three `from` imports):

```python
import json

import structlog

from tools.db.interactions import create_interaction
from tools.db.lead_intake import check_duplicate_phone, insert_intake_lead
from tools.db.voice_calls import record_booking, record_summary, record_turn
from src.automations.voice.booking_tool import execute_booking

log = structlog.get_logger()
```

Add this method to `CallLogger`, directly after `ensure_lead`:

```python
    async def _record(self, write, **kwargs) -> None:
        """Voice_Calls bookkeeping. A failure is logged, never raised: the
        call itself must go on."""
        try:
            await write(call_id=self.call_id, accounts_id=self.account_id, **kwargs)
        except Exception as exc:
            log.warning("voice.calls.write_failed", call_id=self.call_id,
                        write=getattr(write, "__name__", "?"), error=str(exc))
```

Replace `_log` with:

```python
    async def _log(self, *, who: str, direction: str, content: str, ai: bool) -> int:
        lead_id = await self.ensure_lead()
        interaction_id = await create_interaction(
            accounts_id=self.account_id,
            campaigns_id=self.campaign_id,
            leads_id=lead_id,
            who=who,
            type=VOICE_TYPE,
            direction=direction,
            content=content,
            from_number=self.phone if direction == "inbound" else None,
            to_number=self.phone if direction == "outbound" else None,
            ai_generated=ai,
            triggered_by="voice_receptionist",
            conversation_thread_id=self.call_id,
        )
        await self._record(
            record_turn, campaigns_id=self.campaign_id,
            leads_id=lead_id, language=self.language,
        )
        return interaction_id
```

In the `book_appointment` branch, insert directly before `return receipt`:

```python
                await self._record(
                    record_booking, booked_slot=result["slot"],
                    booked_iso=result.get("iso"),
                )
```

In the `update_call_summary` branch, directly after `summary = json.loads(event.get("arguments") or "{}")`:

```python
            await self._record(record_summary, summary=summary)
```

and change the first line of that branch's comment from `# Deliberately writes no Interaction. This is what the caller` to `# Writes no Interaction (it does store the recap on Voice_Calls). This is what the caller`.

- [ ] **Step 4: Run all voice tests**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice -q`
Expected: all pass. Existing tests that do not patch `record_turn` still pass because `_record` swallows the real-DB error (no pool in tests).

---

### Task 4: Wrap-up records end, session and recap, plus an `outcome` line

**Files:**
- Modify: `/home/gabriel/automations/src/webhooks/live_voice_routes.py` (`_SUMMARY_SCHEMA` ~line 237, `_SUMMARY_PROMPT` ~269, `WrapUpBody` ~279, `live_wrap_up` ~288)
- Test: `/home/gabriel/automations/tests/voice/test_live_wrap_up.py` (new)

**Interfaces:**
- Consumes: `record_wrap_up` (Task 2).
- Produces: `POST /voice/live/wrap-up` body gains optional `call_id: str | None`, `session_id: str | None`, `account_id: int | None`, `generate: bool = True`. Response shape unchanged: `{"summary": dict | None}`. The summary dict gains `outcome: str | None`. New private helper `_summarise(turns) -> dict | None`.

- [ ] **Step 1: Write the failing tests** in `tests/voice/test_live_wrap_up.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.webhooks.live_voice_routes import router, _SUMMARY_SCHEMA

app = FastAPI()
app.include_router(router)
client = TestClient(app)

TURNS = [{"side": "them", "text": "Hello"}, {"side": "you", "text": "I need a quote"},
         {"side": "them", "text": "Sure, Thursday?"}, {"side": "you", "text": "Yes"}]
SUMMARY = '{"name": "Sam", "outcome": "Booked a visit", "items": []}'


def _openai_ok(summary_json: str):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value={"output": [{"content": [
        {"type": "output_text", "text": summary_json}]}]})
    http = MagicMock()
    http.post = AsyncMock(return_value=resp)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=http)
    cm.__aexit__ = AsyncMock(return_value=None)
    return cm


def test_schema_asks_for_an_outcome():
    assert "outcome" in _SUMMARY_SCHEMA["properties"]
    assert "outcome" in _SUMMARY_SCHEMA["required"]


@patch("src.webhooks.live_voice_routes._valid_voice_password", return_value=True)
@patch("src.webhooks.live_voice_routes.record_wrap_up", new_callable=AsyncMock)
def test_wrap_up_records_summary_session_and_end(rw, _pw):
    with patch("src.webhooks.live_voice_routes.httpx.AsyncClient",
               return_value=_openai_ok(SUMMARY)):
        r = client.post("/voice/live/wrap-up", json={
            "turns": TURNS, "call_id": "web-1", "session_id": "live_abc", "account_id": 1})
    assert r.status_code == 200
    assert r.json()["summary"]["outcome"] == "Booked a visit"
    assert rw.await_args.kwargs == {
        "call_id": "web-1", "accounts_id": 1, "session_id": "live_abc",
        "summary": {"name": "Sam", "outcome": "Booked a visit", "items": []}}


@patch("src.webhooks.live_voice_routes._valid_voice_password", return_value=True)
@patch("src.webhooks.live_voice_routes.record_wrap_up", new_callable=AsyncMock)
def test_short_call_still_records_end_without_summary(rw, _pw):
    r = client.post("/voice/live/wrap-up", json={
        "turns": TURNS[:1], "call_id": "web-2", "session_id": "live_x", "account_id": 1})
    assert r.json() == {"summary": None}
    assert rw.await_args.kwargs["summary"] is None
    assert rw.await_args.kwargs["session_id"] == "live_x"


@patch("src.webhooks.live_voice_routes._valid_voice_password", return_value=True)
@patch("src.webhooks.live_voice_routes.record_wrap_up", new_callable=AsyncMock)
def test_generate_false_skips_openai_but_records_end(rw, _pw):
    with patch("src.webhooks.live_voice_routes.httpx.AsyncClient") as http:
        r = client.post("/voice/live/wrap-up", json={
            "turns": TURNS, "call_id": "web-3", "account_id": 1, "generate": False})
    assert r.json() == {"summary": None}
    http.assert_not_called()
    assert rw.await_count == 1


@patch("src.webhooks.live_voice_routes._valid_voice_password", return_value=True)
@patch("src.webhooks.live_voice_routes.record_wrap_up", new_callable=AsyncMock)
def test_no_call_id_writes_nothing(rw, _pw):
    client.post("/voice/live/wrap-up", json={"turns": TURNS[:1]})
    rw.assert_not_awaited()


@patch("src.webhooks.live_voice_routes._valid_voice_password", return_value=True)
@patch("src.webhooks.live_voice_routes.record_wrap_up",
       new_callable=AsyncMock, side_effect=RuntimeError("db down"))
def test_a_failed_write_does_not_fail_the_response(_rw, _pw):
    r = client.post("/voice/live/wrap-up", json={
        "turns": TURNS[:1], "call_id": "web-4", "account_id": 1})
    assert r.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice/test_live_wrap_up.py -v`
Expected: FAIL (`record_wrap_up` is not an attribute of the module; no `outcome` in the schema).

- [ ] **Step 3: Implement.** Add near the other imports:

```python
from tools.db.voice_calls import record_wrap_up
```

In `_SUMMARY_SCHEMA["properties"]`, directly after the `"name"` entry:

```python
        "outcome": {
            "type": ["string", "null"],
            "description": (
                "One sentence: how the call ended and the next step "
                "(e.g. booked a visit for Thursday, wants a callback, just looking)."
            ),
        },
```

and change `"required": ["name", "items"],` to `"required": ["name", "outcome", "items"],`.

Replace `_SUMMARY_PROMPT` with:

```python
_SUMMARY_PROMPT = (
    "You are reading the transcript of a phone call to a business's "
    "receptionist. Summarise what the CALLER wanted, not what the "
    "receptionist said. One item per distinct thing they raised: someone who "
    "asks about a quote and then books a visit raised two. `outcome` is one "
    "sentence on how the call ended and what happens next. Write `interest`, "
    "`notes` and `outcome` in the language the call was held in. Use only what "
    "is in the transcript: if they never gave a name, the name is null."
)
```

Replace `WrapUpBody` and `live_wrap_up` (everything from `class WrapUpBody` to the end of the file) with:

```python
class WrapUpBody(BaseModel):
    password: str | None = None
    # Whole turns, in order, as the page has them. Sent rather than read back
    # from the CRM so this needs no authenticated read path, exactly like
    # /voice/relay's receipts.
    turns: list[dict] = []
    language: str = "en"
    # Identify the call's Voice_Calls row. Optional so an older page still works.
    call_id: str | None = None
    session_id: str | None = None
    account_id: int | None = None
    # False when the page already holds a recap from update_call_summary: the
    # call still needs its end time and session id recorded.
    generate: bool = True


async def _summarise(turns: list[dict]) -> dict | None:
    lines = [
        f"{'Caller' if t.get('side') == 'you' else 'Receptionist'}: {(t.get('text') or '').strip()}"
        for t in turns
        if (t.get("text") or "").strip()
    ]
    # Two turns is a greeting and a goodbye. There is nothing to summarise, and
    # an empty recap reads better than an invented one.
    if len(lines) < 3:
        return None

    payload = {
        "model": BACKEND_MODEL,
        "instructions": _SUMMARY_PROMPT,
        "input": "\n".join(lines),
        "text": {
            "format": {
                "type": "json_schema",
                "name": "call_summary",
                "schema": _SUMMARY_SCHEMA,
                "strict": True,
            }
        },
    }
    try:
        async with httpx.AsyncClient(timeout=45) as c:
            r = await c.post(
                f"{settings.openai_base_url}/responses",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=payload,
            )
        r.raise_for_status()
        data = r.json()
        text = "".join(
            part.get("text", "")
            for item in data.get("output", [])
            for part in (item.get("content") or [])
            if part.get("type") == "output_text"
        )
        summary = json.loads(text)
    except Exception as exc:
        # A recap that cannot be written must not fail the call that is already
        # over: the page shows the transcript and the booking either way.
        log.warning("voice.live.wrap_up_failed", error=str(exc))
        return None

    log.info("voice.live.wrap_up", items=len(summary.get("items") or []))
    return summary


@router.post("/voice/live/wrap-up")
async def live_wrap_up(body: WrapUpBody):
    """Derive the call recap from its transcript at the end of the call, and
    close the call's Voice_Calls row."""
    if not _valid_voice_password(body.password):
        raise HTTPException(status_code=401, detail="Wrong password.")

    summary = await _summarise(body.turns) if body.generate else None

    if body.call_id and body.account_id is not None:
        try:
            await record_wrap_up(
                call_id=body.call_id,
                accounts_id=body.account_id,
                session_id=body.session_id,
                summary=summary,
            )
        except Exception as exc:
            log.warning("voice.calls.write_failed", call_id=body.call_id,
                        write="record_wrap_up", error=str(exc))

    return {"summary": summary}
```

Keep the "Wrapping up" comment block above `_SUMMARY_SCHEMA` as it is.

- [ ] **Step 4: Run all voice tests**

Run: `cd /home/gabriel/automations && .venv/bin/pytest tests/voice -q`
Expected: all pass

- [ ] **Step 5: Restart the engine** (watch is off). A restart drops any call in progress for a few seconds, so check no demo is running first.

Run: `pm2 restart leadawaker-engine && sleep 6 && pm2 logs leadawaker-engine --nostream --lines 25`
Expected: normal startup lines, no traceback.

---

### Task 5: Voice demo page sends the call identity on wrap-up

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/voiceDemo/useLiveCall.ts` (`wrapUp`, ~lines 315-346)

**Interfaces:**
- Consumes: wrap-up body fields from Task 4 (`call_id`, `session_id`, `account_id`, `generate`); existing refs `callIdRef`, `sessionIdRef`, `summaryRef`, `turnsRef`, `passwordRef`, `languageRef`; constant `DEMO_ACCOUNT_ID` (same file, line 36).

- [ ] **Step 1: Confirm the ids survive until wrap-up.** `hangup` runs `teardown()` then `wrapUp()`.

Run: `grep -n "callIdRef.current =\|sessionIdRef.current =" client/src/features/voiceDemo/useLiveCall.ts`
Expected: assignments only in the call-start path (~lines 441, 523, 527, 587), none inside `teardown`. If one sits in `teardown`, capture both ids as locals at the top of `hangup` and pass them into `wrapUp(callId, sessionId)` instead of reading the refs.

- [ ] **Step 2: Replace the `wrapUp` doc comment and function** so it always closes the call and asks for a recap only when one is missing:

```ts
  /**
   * Close the call's record and, if `update_call_summary` did not already
   * produce a recap, write one from the transcript.
   */
  const wrapUp = useCallback(async () => {
    const turnsNow = turnsRef.current;
    if (!callIdRef.current || turnsNow.length === 0) return;
    const generate = !summaryRef.current && turnsNow.length >= 3;
    try {
      const res = await fetch(`${ENGINE_BASE_URL}/voice/live/wrap-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordRef.current,
          language: languageRef.current,
          turns: turnsNow.map((t) => ({ side: t.side, text: t.text })),
          call_id: callIdRef.current,
          session_id: sessionIdRef.current,
          account_id: DEMO_ACCOUNT_ID,
          generate,
        }),
      });
      if (!res.ok || !generate) return;
      const data = (await res.json()) as { summary: CallSummary | null };
      if (data.summary) {
        summaryRef.current = data.summary;
        setSummary(data.summary);
      }
    } catch {
      // The call is already over. A missing recap is a worse demo than a
      // present one, but a thrown error here would be worse than both.
    }
  }, []);
```

- [ ] **Step 3: Check the dev build**

Run: `sleep 5; pm2 logs --nostream --lines 20 | grep -iE "error|useLiveCall" || echo clean`
Expected: `clean`

---

### Task 6: CRM storage + API routes

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/server/storage/voiceCalls.ts`
- Modify: `/home/gabriel/LeadAwakerApp/server/storage.ts` (import + spread)
- Create: `/home/gabriel/LeadAwakerApp/server/routes/voice-calls.ts`
- Modify: `/home/gabriel/LeadAwakerApp/server/routes/index.ts` (import + register)

**Interfaces:**
- Consumes: `voiceCalls`, `VoiceCall`, `VoiceCallSummary`, `interactions` from `@shared/schema`; `requireOwner` from `../auth`; `wrapAsync` from `./_helpers`.
- Produces:
  - `storage.listVoiceCalls({ limit, offset }): Promise<VoiceCallListItem[]>`
  - `storage.getVoiceCall(callId: string): Promise<VoiceCallDetail | undefined>`
  - `GET /api/voice-calls?limit=&offset=` → `{ calls: VoiceCallListItem[] }` (owner only)
  - `GET /api/voice-calls/:callId` → `VoiceCallDetail`, or 404 `{ message }` (owner only)
  - Types `VoiceCallListItem`, `VoiceCallTurn`, `VoiceCallDetail` exactly as in Step 1 (mirrored on the client in Task 7).

- [ ] **Step 1: Write `server/storage/voiceCalls.ts`:**

```ts
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { interactions, voiceCalls, type VoiceCall, type VoiceCallSummary } from "@shared/schema";

export interface VoiceCallListItem {
  callId: string;
  sessionId: string | null;
  leadsId: number | null;
  callerName: string | null;
  language: string | null;
  startedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  bookedSlot: string | null;
  bookedIso: string | null;
  outcome: string | null;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  createdAt: string | null;
}

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: VoiceCallSummary | null;
  turns: VoiceCallTurn[];
}

// A call closed by wrap-up has ended_at. A tab closed first leaves it null, so
// fall back to the call's last transcript turn.
const lastTurnAt = sql<string | null>`(
  SELECT max(i.created_at) FROM ${interactions} i
  WHERE i.conversation_thread_id = ${voiceCalls.callId}
)`;

function toItem(row: VoiceCall, lastTurn: string | Date | null): VoiceCallListItem {
  const end = row.endedAt ?? (lastTurn ? new Date(lastTurn) : null);
  const durationSeconds = end
    ? Math.max(0, Math.round((end.getTime() - row.startedAt.getTime()) / 1000))
    : null;
  return {
    callId: row.callId,
    sessionId: row.sessionId,
    leadsId: row.leadsId,
    callerName: row.summary?.name ?? null,
    language: row.language,
    startedAt: row.startedAt.toISOString(),
    durationSeconds,
    turnCount: row.turnCount,
    bookedSlot: row.bookedSlot,
    bookedIso: row.bookedIso ? row.bookedIso.toISOString() : null,
    outcome: row.summary?.outcome ?? null,
  };
}

export const voiceCallsStorage = {
  async listVoiceCalls({ limit, offset }: { limit: number; offset: number }): Promise<VoiceCallListItem[]> {
    const rows = await db
      .select({ call: voiceCalls, lastTurn: lastTurnAt })
      .from(voiceCalls)
      .orderBy(desc(voiceCalls.startedAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => toItem(r.call, r.lastTurn));
  },

  async getVoiceCall(callId: string): Promise<VoiceCallDetail | undefined> {
    const [row] = await db
      .select({ call: voiceCalls, lastTurn: lastTurnAt })
      .from(voiceCalls)
      .where(eq(voiceCalls.callId, callId));
    if (!row) return undefined;
    const turns = await db
      .select({
        id: interactions.id,
        who: interactions.who,
        direction: interactions.direction,
        content: interactions.content,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .where(and(
        eq(interactions.conversationThreadId, callId),
        eq(interactions.type, "voice_call"),
      ))
      .orderBy(asc(interactions.createdAt), asc(interactions.id));
    return {
      ...toItem(row.call, row.lastTurn),
      summary: row.call.summary ?? null,
      turns: turns.map((t) => ({
        id: t.id as number,
        who: t.who,
        direction: t.direction,
        content: t.content,
        createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      })),
    };
  },
};
```

If the raw subquery's `${interactions} i` alias renders without the schema prefix in pm2 logs errors, replace `${interactions}` with the literal `p2mxx34fvbf3ll6."Interactions"`.

- [ ] **Step 2: Register in the barrel** `server/storage.ts`: add `import { voiceCallsStorage } from "./storage/voiceCalls";` after the `openerTemplatesStorage` import, and `...voiceCallsStorage,` after `...openerTemplatesStorage,` in the `storage` object.

- [ ] **Step 3: Write `server/routes/voice-calls.ts`:**

```ts
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { wrapAsync } from "./_helpers";

// Owner-only, like Demos: every row is a prospect who tried the voice demo.
export function registerVoiceCallsRoutes(app: Express): void {
  app.get("/api/voice-calls", requireOwner, wrapAsync(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const calls = await storage.listVoiceCalls({ limit, offset });
    res.json({ calls });
  }));

  app.get("/api/voice-calls/:callId", requireOwner, wrapAsync(async (req, res) => {
    const call = await storage.getVoiceCall(String(req.params.callId));
    if (!call) return res.status(404).json({ message: "Call not found" });
    res.json(call);
  }));
}
```

- [ ] **Step 4: Register the routes** in `server/routes/index.ts`: add `import { registerVoiceCallsRoutes } from "./voice-calls";` after the `registerDemoRoutes` import (line 33), and `registerVoiceCallsRoutes(app);` directly after `registerDemoRoutes(app);` (line 80).

- [ ] **Step 5: Verify** (pm2 reloads ~8s after the save).

Run: `sleep 8; PORT=$(grep -oE "PORT[^0-9]*[0-9]{4}" server/index.ts | grep -oE "[0-9]{4}" | head -1); curl -s -o /dev/null -w "%{http_code}\n" http://localhost:${PORT:-5000}/api/voice-calls; pm2 logs --nostream --lines 30 | grep -iE "error" || echo clean`
Expected: `401` or `403` (owner guard, not `404`/`500`), then `clean`.

---

### Task 7: Voice calls page (client)

**Files:**
- Create: `client/src/features/voiceDemo/engine.ts`
- Modify: `client/src/features/voiceDemo/useLiveCall.ts` (re-export `ENGINE_BASE_URL` from `engine.ts`)
- Create: `client/src/features/voiceCalls/api/voiceCallsApi.ts`
- Create: `client/src/features/voiceCalls/format.ts`
- Create: `client/src/features/voiceCalls/components/VoiceCallList.tsx`
- Create: `client/src/features/voiceCalls/components/VoiceCallDetail.tsx`
- Create: `client/src/features/voiceCalls/components/CallRecording.tsx`
- Create: `client/src/features/voiceCalls/components/CallTranscript.tsx`
- Create: `client/src/features/voiceCalls/pages/VoiceCallsPage.tsx`
- Create: `client/src/locales/{en,nl,pt}/voiceCalls.json`
- Modify: `client/src/i18n.ts`, `client/src/locales/{en,nl,pt}/crm.json`, `client/src/pages/app.tsx`, `client/src/components/crm/RightSidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/voice-calls`, `GET /api/voice-calls/:callId` (Task 6).
- Produces: `VoiceCallsPage` (named export), route `/platform/voice-calls`, nav entry `labelKey: "Voice calls"`.

- [ ] **Step 1: Read the style references first:** `UI_STANDARDS.md`, `client/src/features/demos/pages/DemosPage.tsx` (page shell), `client/src/components/crm/primitives/ListCard.tsx` and `SectionCard.tsx`. Use `ListCard`, `SectionCard`, `Pill` from `@/components/crm/primitives`. The accent color is `hsl(var(--primary))` (wine).

- [ ] **Step 2: Split out the engine URL** so the page does not pull the whole call hook into its chunk. Create `client/src/features/voiceDemo/engine.ts`:

```ts
export const ENGINE_BASE_URL =
  import.meta.env.VITE_VOICE_ENGINE_URL ?? "https://webhooks.leadawaker.com";
```

In `useLiveCall.ts`, replace the two-line `export const ENGINE_BASE_URL = ...` (lines 33-34) with:

```ts
import { ENGINE_BASE_URL } from "./engine";
export { ENGINE_BASE_URL };
```

(Place the `import` with the other imports at the top of the file and keep the `export { ENGINE_BASE_URL };` where the constant was.)

- [ ] **Step 3: API hooks** `features/voiceCalls/api/voiceCallsApi.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

/** Mirrors VoiceCallListItem in server/storage/voiceCalls.ts. */
export interface VoiceCallListItem {
  callId: string;
  sessionId: string | null;
  leadsId: number | null;
  callerName: string | null;
  language: string | null;
  startedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  bookedSlot: string | null;
  bookedIso: string | null;
  outcome: string | null;
}

export interface VoiceCallSummaryItem {
  intent: string;
  interest: string | null;
  notes: string | null;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  createdAt: string | null;
}

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: { name: string | null; outcome?: string | null; items: VoiceCallSummaryItem[] } | null;
  turns: VoiceCallTurn[];
}

const LIST_KEY = ["/api/voice-calls"];

export function useVoiceCalls() {
  return useQuery<VoiceCallListItem[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/voice-calls?limit=200");
      if (!res.ok) throw new Error("Failed to load voice calls");
      return (await res.json()).calls ?? [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useVoiceCall(callId: string | null) {
  return useQuery<VoiceCallDetail | null>({
    queryKey: [...LIST_KEY, callId],
    enabled: !!callId,
    queryFn: async () => {
      const res = await apiFetch(`/api/voice-calls/${encodeURIComponent(callId as string)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load voice call");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 4: Formatting helpers** `features/voiceCalls/format.ts`:

```ts
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function formatBooked(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}
```

- [ ] **Step 5: Locale files.** Intent keys come from the engine's `_INTENT_ENUM`: `book_appointment`, `request_quote`, `ask_advice`, `existing_customer`, `complaint_or_fault`, `not_relevant`.

`client/src/locales/en/voiceCalls.json`:

```json
{
  "title": "Voice calls",
  "webCaller": "Web caller",
  "booked": "Booked",
  "empty": "No voice calls yet. Calls made on the voice demo will appear here.",
  "selectCall": "Select a call to see what happened.",
  "notFound": "This call could not be found.",
  "loadError": "Could not load voice calls.",
  "back": "Back to calls",
  "turns_one": "{{count}} turn",
  "turns_other": "{{count}} turns",
  "sections": {
    "booked": "Booked appointment",
    "outcome": "Conclusion",
    "summary": "Summary",
    "recording": "Recording",
    "transcript": "Transcript"
  },
  "noSummary": "No recap was generated for this call.",
  "recordingExpired": "Recording no longer available (OpenAI keeps it for 30 days).",
  "caller": "Caller",
  "ai": "AI receptionist",
  "interest": "Wants",
  "notes": "Notes",
  "intents": {
    "book_appointment": "Book appointment",
    "request_quote": "Quote request",
    "ask_advice": "Advice",
    "existing_customer": "Existing customer",
    "complaint_or_fault": "Complaint or fault",
    "not_relevant": "Not relevant"
  }
}
```

`client/src/locales/nl/voiceCalls.json`:

```json
{
  "title": "Spraakgesprekken",
  "webCaller": "Webbeller",
  "booked": "Geboekt",
  "empty": "Nog geen spraakgesprekken. Gesprekken via de spraakdemo verschijnen hier.",
  "selectCall": "Selecteer een gesprek om te zien wat er gebeurde.",
  "notFound": "Dit gesprek is niet gevonden.",
  "loadError": "Spraakgesprekken konden niet worden geladen.",
  "back": "Terug naar gesprekken",
  "turns_one": "{{count}} beurt",
  "turns_other": "{{count}} beurten",
  "sections": {
    "booked": "Geboekte afspraak",
    "outcome": "Conclusie",
    "summary": "Samenvatting",
    "recording": "Opname",
    "transcript": "Transcript"
  },
  "noSummary": "Voor dit gesprek is geen samenvatting gemaakt.",
  "recordingExpired": "Opname niet meer beschikbaar (OpenAI bewaart die 30 dagen).",
  "caller": "Beller",
  "ai": "AI-receptionist",
  "interest": "Wil",
  "notes": "Notities",
  "intents": {
    "book_appointment": "Afspraak maken",
    "request_quote": "Offerteaanvraag",
    "ask_advice": "Advies",
    "existing_customer": "Bestaande klant",
    "complaint_or_fault": "Klacht of storing",
    "not_relevant": "Niet relevant"
  }
}
```

`client/src/locales/pt/voiceCalls.json` (Brazilian Portuguese):

```json
{
  "title": "Chamadas de voz",
  "webCaller": "Visitante do site",
  "booked": "Agendado",
  "empty": "Nenhuma chamada de voz ainda. As chamadas feitas na demo de voz aparecem aqui.",
  "selectCall": "Selecione uma chamada para ver o que aconteceu.",
  "notFound": "Esta chamada não foi encontrada.",
  "loadError": "Não foi possível carregar as chamadas de voz.",
  "back": "Voltar para as chamadas",
  "turns_one": "{{count}} fala",
  "turns_other": "{{count}} falas",
  "sections": {
    "booked": "Agendamento",
    "outcome": "Conclusão",
    "summary": "Resumo",
    "recording": "Gravação",
    "transcript": "Transcrição"
  },
  "noSummary": "Nenhum resumo foi gerado para esta chamada.",
  "recordingExpired": "Gravação indisponível (a OpenAI guarda por 30 dias).",
  "caller": "Cliente",
  "ai": "Recepcionista IA",
  "interest": "Quer",
  "notes": "Observações",
  "intents": {
    "book_appointment": "Agendar horário",
    "request_quote": "Pedido de orçamento",
    "ask_advice": "Orientação",
    "existing_customer": "Cliente atual",
    "complaint_or_fault": "Reclamação ou defeito",
    "not_relevant": "Não relevante"
  }
}
```

Register in `client/src/i18n.ts` exactly like `demos`: add `import enVoiceCalls from "./locales/en/voiceCalls.json";` after line 28, `import ptVoiceCalls from "./locales/pt/voiceCalls.json";` after line 57, `import nlVoiceCalls from "./locales/nl/voiceCalls.json";` after line 86; add `voiceCalls: enVoiceCalls,` / `voiceCalls: ptVoiceCalls,` / `voiceCalls: nlVoiceCalls,` right after each `demos: ...Demos,` line; add `"voiceCalls",` right after `"demos",` in the `ns` array.

In each `crm.json`, inside the `"sidebar"` object next to `"demos"`, add: en `"voiceCalls": "Voice calls"`, nl `"voiceCalls": "Spraakgesprekken"`, pt `"voiceCalls": "Chamadas de voz"`.

- [ ] **Step 6: `components/VoiceCallList.tsx`** (the toolbar):

```tsx
import { useTranslation } from "react-i18next";
import { CalendarCheck } from "lucide-react";
import { ListCard, Pill } from "@/components/crm/primitives";
import type { VoiceCallListItem } from "../api/voiceCallsApi";
import { formatDateTime, formatDuration } from "../format";

interface Props {
  calls: VoiceCallListItem[];
  selectedId: string | null;
  onSelect: (callId: string) => void;
}

export function VoiceCallList({ calls, selectedId, onSelect }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <ul className="flex flex-col gap-2 p-3">
      {calls.map((c) => (
        <ListCard
          key={c.callId}
          as="li"
          interactive
          selected={c.callId === selectedId}
          onClick={() => onSelect(c.callId)}
          data-testid="voice-call-row"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-foreground">
              {c.callerName || t("webCaller")}
            </span>
            {c.bookedSlot && (
              <Pill color="hsl(var(--primary))">
                <CalendarCheck size={11} className="mr-1" />
                {t("booked")}
              </Pill>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(c.startedAt, i18n.language)}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(c.durationSeconds)}</span>
          </div>
          {c.outcome && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.outcome}</p>
          )}
        </ListCard>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: `components/CallRecording.tsx`:**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";

export function CallRecording({ sessionId }: { sessionId: string | null }) {
  const { t } = useTranslation("voiceCalls");
  const [failed, setFailed] = useState(false);
  if (!sessionId || failed) {
    return <p className="text-sm text-muted-foreground">{t("recordingExpired")}</p>;
  }
  return (
    <audio
      key={sessionId}
      controls
      preload="none"
      className="w-full"
      src={`${ENGINE_BASE_URL}/voice/live/recording/${encodeURIComponent(sessionId)}`}
      onError={() => setFailed(true)}
    />
  );
}
```

- [ ] **Step 8: `components/CallTranscript.tsx`** (read-only bubbles; caller left, AI right):

```tsx
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { VoiceCallTurn } from "../api/voiceCallsApi";

export function CallTranscript({ turns }: { turns: VoiceCallTurn[] }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div className="flex flex-col gap-2">
      {turns.map((turn) => {
        const isCaller = turn.direction === "inbound";
        return (
          <div key={turn.id} className={cn("flex flex-col", isCaller ? "items-start" : "items-end")}>
            <span className="mb-0.5 text-[11px] text-muted-foreground">
              {isCaller ? t("caller") : t("ai")}
            </span>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm text-foreground",
                isCaller ? "bg-muted" : "bg-primary/10",
              )}
            >
              {turn.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9: `components/VoiceCallDetail.tsx`:**

```tsx
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck } from "lucide-react";
import { Pill, SectionCard } from "@/components/crm/primitives";
import { useVoiceCall } from "../api/voiceCallsApi";
import { formatBooked, formatDateTime, formatDuration } from "../format";
import { CallRecording } from "./CallRecording";
import { CallTranscript } from "./CallTranscript";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionCard padded>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </SectionCard>
  );
}

export function VoiceCallDetail({ callId }: { callId: string }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const { data: call, isLoading } = useVoiceCall(callId);

  if (isLoading) return null;
  if (!call) return <p className="p-6 text-sm text-muted-foreground">{t("notFound")}</p>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="serif text-xl text-foreground">{call.callerName || t("webCaller")}</h2>
        <span className="text-sm text-muted-foreground">
          {formatDateTime(call.startedAt, i18n.language)} · {formatDuration(call.durationSeconds)} ·{" "}
          {t("turns", { count: call.turnCount })}
          {call.language ? ` · ${call.language.toUpperCase()}` : ""}
        </span>
      </header>

      {call.bookedSlot && (
        <Section title={t("sections.booked")}>
          <div className="flex items-center gap-2 text-foreground">
            <CalendarCheck size={16} />
            <span className="font-medium">
              {call.bookedIso ? formatBooked(call.bookedIso, i18n.language) : call.bookedSlot}
            </span>
          </div>
        </Section>
      )}

      <Section title={t("sections.outcome")}>
        <p className="text-sm text-foreground">{call.summary?.outcome || t("noSummary")}</p>
      </Section>

      {call.summary && call.summary.items.length > 0 && (
        <Section title={t("sections.summary")}>
          <div className="flex flex-col gap-2">
            {call.summary.items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border p-2">
                <Pill className="mb-1">{t(`intents.${item.intent}`, { defaultValue: item.intent })}</Pill>
                {item.interest && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("interest")}: </span>
                    {item.interest}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("notes")}: </span>
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("sections.recording")}>
        <CallRecording sessionId={call.sessionId} />
      </Section>

      <Section title={t("sections.transcript")}>
        <CallTranscript turns={call.turns} />
      </Section>
    </div>
  );
}
```

- [ ] **Step 10: `pages/VoiceCallsPage.tsx`** (toolbar left, detail right; on mobile the detail replaces the list and shows a back button):

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { useVoiceCalls } from "../api/voiceCallsApi";
import { VoiceCallList } from "../components/VoiceCallList";
import { VoiceCallDetail } from "../components/VoiceCallDetail";

function VoiceCallsContent() {
  const { t } = useTranslation("voiceCalls");
  const { data: calls = [], isLoading, error } = useVoiceCalls();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
        {selectedId && (
          <button
            className="text-muted-foreground md:hidden"
            onClick={() => setSelectedId(null)}
            aria-label={t("back")}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <span
          className="serif"
          style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}
        >
          {t("title")}
        </span>
      </div>

      <div className="mr-auto flex min-h-0 w-full max-w-[1386px] flex-1 overflow-hidden">
        <aside
          className={cn(
            "min-h-0 overflow-y-auto border-r border-border md:block md:w-[340px] md:shrink-0",
            selectedId ? "hidden" : "w-full",
          )}
        >
          {isLoading ? null : error ? (
            <p className="p-4 text-sm text-muted-foreground">{t("loadError")}</p>
          ) : calls.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <VoiceCallList calls={calls} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>
        <section className={cn("min-h-0 flex-1 overflow-y-auto", !selectedId && "hidden md:block")}>
          {selectedId ? (
            <VoiceCallDetail callId={selectedId} />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{t("selectCall")}</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function VoiceCallsPage() {
  return (
    <CrmShell>
      <VoiceCallsContent />
    </CrmShell>
  );
}
```

- [ ] **Step 11: Route** in `client/src/pages/app.tsx`. After the `DemosPage` lazy import (line 24):

```tsx
const VoiceCallsPage = lazy(() => import("@/features/voiceCalls/pages/VoiceCallsPage").then(m => ({ default: m.VoiceCallsPage })));
```

Directly after the `/platform/demos` `<Route>` block (~line 207):

```tsx
          {/* Owner-only: every row is a prospect who tried the voice demo. */}
          <Route path="/platform/voice-calls">
            <OwnerOnly prefix="/platform"><VoiceCallsPage /></OwnerOnly>
          </Route>
```

- [ ] **Step 12: Nav bar** in `client/src/components/crm/RightSidebar.tsx`:
  - add `AudioLines,` to the `lucide-react` import list (closes at line 43);
  - insert directly **before** the `Conversations` item (~line 280):

```tsx
    { href: `${prefix}/voice-calls`, label: t("sidebar.voiceCalls"), labelKey: "Voice calls", icon: AudioLines, testId: "nav-voice-calls", ownerOnly: true },
```

  - in the section groups (~line 685) change the Engage line to:

```tsx
              { section: "Engage", items: visibleNavItems.filter(it => ["Voice calls", "Conversations", "Calendar", "Contacts"].includes(it.labelKey)) },
```

  - check the mobile menu: `grep -n "Conversations" client/src/components/crm/mobile/*.tsx`. If a mobile list names nav items by `labelKey`, add `"Voice calls"` before `"Conversations"` there too.

- [ ] **Step 13: Check the dev server compiles**

Run: `sleep 5; pm2 logs --nostream --lines 30 | grep -iE "error|failed" || echo clean`
Expected: `clean`

---

### Task 8: End-to-end check

- [ ] **Step 1: Real demo call (Gabriel).** A call needs a human voice. Ask Gabriel to make one short call on `app.leadawaker.com/voice-demo`: give a name, ask for a quote, book a slot, hang up.

- [ ] **Step 2: Confirm the row filled in.** Write `/home/gabriel/LeadAwakerApp/.check-voice-calls.mjs`:

```js
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`SELECT call_id, session_id, turn_count, started_at, ended_at, booked_slot, summary
  FROM p2mxx34fvbf3ll6."Voice_Calls" ORDER BY started_at DESC LIMIT 3`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
```

Run: `node --env-file=.env ./.check-voice-calls.mjs && rm ./.check-voice-calls.mjs`
Expected: the new call with `turn_count` > 0, `session_id` starting `live_`, `ended_at` set, `booked_slot` set if a slot was booked, `summary` holding `name`, `outcome`, `items`.
Also: `pm2 logs leadawaker-engine --nostream --lines 200 | grep "voice.calls.write_failed" || echo none` → `none`.

- [ ] **Step 3: Visual check with playwright-cli** (login `leadawaker@gmail.com` / `Admin1234`). Open `app.leadawaker.com/platform/voice-calls` and confirm:
  - nav entry "Voice calls" sits directly above Conversations;
  - the call is listed with the Booked pill;
  - the detail shows booked date, conclusion, summary cards with translated intent labels, a playable recording, and the transcript (caller left, AI right).
  Screenshot light mode, dark mode, and a 390px-wide mobile viewport (list, then detail with back arrow). Close the browser afterwards.

- [ ] **Step 4: Report to Gabriel** with the screenshots, and ask how to commit (both repos currently hold unrelated uncommitted work on other branches).
