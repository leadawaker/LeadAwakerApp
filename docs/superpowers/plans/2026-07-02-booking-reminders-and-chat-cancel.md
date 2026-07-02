# Booking Reminders (24h + 1h) and In-Chat Cancel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-rung (T-24h + T-1h) WhatsApp reminder ladder for booked calls, make reschedule and cancel reset that ladder, add an in-chat cancel tool, and give reschedule/cancel intent-detection a Groq→OpenAI fallback.

**Architecture:** Most work is in the Python automation engine (`/home/gabriel/automations/`). The reminder scheduler (`booking_reminder.py`) gains a second rung and a 36h guard. A new `conversation/cancel.py` mirrors the existing `conversation/reschedule.py`. A shared `detect_tool_call()` helper in `tools/ai_service.py` gives both flows a fallback model. Three new DB columns are added via a one-off `pg` script (Drizzle `db:push` has no TTY on the Pi) plus a `shared/schema.ts` edit in the CRM repo.

**Tech Stack:** Python 3.11 + asyncpg, Groq (llama-3.3-70b) and OpenAI (EU endpoint) via the OpenAI-compatible SDK, Cal.diy (Cal.com) v2 API, Node `pg` for the migration, Drizzle ORM (schema only).

## Global Constraints

- **Two repos.** Engine files are under `/home/gabriel/automations/` (call it `ENGINE`). Schema + migration files are under `/home/gabriel/LeadAwakerApp/` (call it `CRM`). Every file path below is prefixed with the repo.
- **Copy is en/nl only, default nl.** No pt-BR.
- **Never send ISO strings to timestamp columns.** Always pass Python `datetime` objects. Match the existing engine convention: naive UTC via `datetime.now(timezone.utc).replace(tzinfo=None)`.
- **DB migrations run via a Node `pg` script** with `node --env-file=.env scripts/<name>.mjs`. Never `npm run db:push` (no TTY on the Pi). The nocodb schema is `p2mxx34fvbf3ll6`.
- **Never run `tsc`/`npx tsc` automatically.** Only if Gabriel asks.
- **Engine runs via pm2 (`leadawaker-engine`).** Do not run `npm run dev`. `server/`+`shared/` auto-reload; the Python engine may need a manual `pm2 restart leadawaker-engine` after changes.
- **Do not deploy/restart during a live demo.** Implementation is on hold until Gabriel gives the all-clear; this plan may be written and committed anytime.
- **Cancel posture is fixed: cancel-then-offer.** No per-campaign config.
- **Fallback fires only on a Groq exception,** never on a clean "no tool call" result (most messages are neither cancel nor reschedule; a second-opinion call every turn would double cost).

---

### Task 1: Add the three DB columns (migration + schema)

**Files:**
- Create: `CRM/scripts/add-booking-reminder-ladder-columns.mjs`
- Modify: `CRM/shared/schema.ts` (Leads table, near `bookingReminderSentAt`, line ~673)

**Interfaces:**
- Produces: three nullable `timestamptz` columns on `Leads`: `booking_reminder_24h_sent_at`, `booking_reminder_1h_sent_at`, `booked_at`. Drizzle names: `bookingReminder24hSentAt`, `bookingReminder1hSentAt`, `bookedAt`.

- [ ] **Step 1: Write the migration script**

Create `CRM/scripts/add-booking-reminder-ladder-columns.mjs`:

```javascript
// Adds the two-rung booking-reminder columns + booked_at to Leads.
// db:push needs a TTY on the Pi, so we ALTER directly.
// Run: node --env-file=.env scripts/add-booking-reminder-ladder-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)

const sql = `
ALTER TABLE "${SCHEMA}"."Leads"
  ADD COLUMN IF NOT EXISTS "booking_reminder_24h_sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "booking_reminder_1h_sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "booked_at" timestamptz;
`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'Leads'
       AND column_name IN ('booking_reminder_24h_sent_at','booking_reminder_1h_sent_at','booked_at')
     ORDER BY column_name`,
    [SCHEMA],
  );
  console.log("✅ Leads reminder-ladder columns ready:", rows.map((r) => r.column_name).join(", "));
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
```

- [ ] **Step 2: Run the migration and verify**

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/add-booking-reminder-ladder-columns.mjs`
Expected: `✅ Leads reminder-ladder columns ready: booked_at, booking_reminder_1h_sent_at, booking_reminder_24h_sent_at`

- [ ] **Step 3: Add the columns to the Drizzle schema**

In `CRM/shared/schema.ts`, immediately after the `bookingReminderSentAt: timestamp("booking_reminder_sent_at", { withTimezone: true }),` line, add:

```typescript
  bookingReminder24hSentAt: timestamp("booking_reminder_24h_sent_at", { withTimezone: true }),
  bookingReminder1hSentAt: timestamp("booking_reminder_1h_sent_at", { withTimezone: true }),
  bookedAt: timestamp("booked_at", { withTimezone: true }),
```

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add scripts/add-booking-reminder-ladder-columns.mjs shared/schema.ts
git commit -m "feat(schema): add two-rung booking-reminder columns + booked_at to Leads"
```

---

### Task 2: Reminder copy for both rungs (pure function)

**Files:**
- Modify: `ENGINE/src/automations/booking_reminder.py` (replace `_build_reminder_message`, line 29)
- Test: `ENGINE/scripts/test_reminder_messages.py` (create)

**Interfaces:**
- Produces: `_build_reminder_message(lang: str, calling_number: str, rung: str) -> str` where `rung` is `"24h"` or `"1h"`.

- [ ] **Step 1: Write the failing test**

Create `ENGINE/scripts/test_reminder_messages.py`:

```python
"""Direct test: reminder copy for both rungs. Run: python scripts/test_reminder_messages.py"""
from src.automations.booking_reminder import _build_reminder_message

# 1h rung keeps the existing wording
assert "1 hour" in _build_reminder_message("en", "", "1h")
assert "1 uur" in _build_reminder_message("nl", "", "1h")

# 24h rung says "tomorrow"
assert "tomorrow" in _build_reminder_message("en", "", "24h").lower()
assert "morgen" in _build_reminder_message("nl", "", "24h").lower()

# calling number line included only when provided
assert "+31 6 12" in _build_reminder_message("en", "+31 6 12", "24h")
assert "+31 6 12" not in _build_reminder_message("en", "", "24h")

# unknown lang defaults to nl
assert "morgen" in _build_reminder_message("xx", "", "24h").lower()

print("✅ reminder message copy OK")
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/gabriel/automations && python scripts/test_reminder_messages.py`
Expected: FAIL (`TypeError: _build_reminder_message() takes 2 positional arguments but 3 were given`).

- [ ] **Step 3: Implement the two-rung copy**

In `ENGINE/src/automations/booking_reminder.py`, replace the whole `_build_reminder_message` function (currently lines 29–48) with:

```python
def _build_reminder_message(lang: str, calling_number: str, rung: str) -> str:
    """Build the reminder message in en or nl for the given rung ("24h" | "1h").

    If calling_number is empty, the sentence about the calling number is omitted.
    """
    lang = (lang or "nl").strip().lower()
    if lang not in ("en", "nl"):
        lang = "nl"

    if rung == "24h":
        if lang == "en":
            msg = "Quick reminder — your call is tomorrow! 📞"
            if calling_number:
                msg += f" We'll call you from {calling_number}, so save the number."
            msg += " Talk soon!"
        else:
            msg = "Kleine herinnering — je gesprek is morgen! 📞"
            if calling_number:
                msg += f" We bellen je vanuit {calling_number}, sla het nummer op."
            msg += " Tot dan!"
        return msg

    # rung == "1h" (default)
    if lang == "en":
        msg = "Just a reminder — your call is in about 1 hour! 📞"
        if calling_number:
            msg += f" We'll call you from {calling_number}."
        msg += " You'll speak with one of our team members. See you soon!"
    else:
        msg = "Kleine herinnering — je gesprek is over ongeveer 1 uur! 📞"
        if calling_number:
            msg += f" We bellen je vanuit {calling_number}."
        msg += " Je spreekt met een van ons teamleden. Tot zo!"
    return msg
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/gabriel/automations && python scripts/test_reminder_messages.py`
Expected: `✅ reminder message copy OK`

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/booking_reminder.py scripts/test_reminder_messages.py
git commit -m "feat(reminder): add 24h-rung copy alongside 1h reminder"
```

---

### Task 3: 36h eligibility guard (pure function)

**Files:**
- Modify: `ENGINE/src/automations/booking_reminder.py` (add helper near the top, after the imports)
- Test: `ENGINE/scripts/test_reminder_guard.py` (create)

**Interfaces:**
- Produces: `_is_24h_eligible(booked_call_date, booked_at) -> bool` — True only when both are set and the gap is ≥ 36h. Accepts `datetime` (naive or aware) or `None`.

- [ ] **Step 1: Write the failing test**

Create `ENGINE/scripts/test_reminder_guard.py`:

```python
"""Direct test: 36h guard for the 24h reminder. Run: python scripts/test_reminder_guard.py"""
from datetime import datetime, timedelta
from src.automations.booking_reminder import _is_24h_eligible

call = datetime(2026, 7, 10, 16, 0, 0)

# booked 40h before the call → eligible
assert _is_24h_eligible(call, call - timedelta(hours=40)) is True
# booked exactly 36h before → eligible (boundary inclusive)
assert _is_24h_eligible(call, call - timedelta(hours=36)) is True
# booked 30h before ("this morning for tomorrow afternoon") → NOT eligible
assert _is_24h_eligible(call, call - timedelta(hours=30)) is False
# missing booked_at (legacy row) → NOT eligible
assert _is_24h_eligible(call, None) is False
# missing call date → NOT eligible
assert _is_24h_eligible(None, call - timedelta(hours=40)) is False

print("✅ 24h eligibility guard OK")
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/gabriel/automations && python scripts/test_reminder_guard.py`
Expected: FAIL (`ImportError: cannot import name '_is_24h_eligible'`).

- [ ] **Step 3: Implement the guard**

In `ENGINE/src/automations/booking_reminder.py`, add after the `log = structlog.get_logger()` line:

```python
# The 24h reminder only fires when the booking was made well ahead of the call.
# Otherwise a call booked this morning for tomorrow afternoon would get a redundant
# "it's tomorrow" ping right after the lead confirmed it in chat.
_MIN_LEAD_HOURS_FOR_24H = 36


def _is_24h_eligible(booked_call_date, booked_at) -> bool:
    """True only when the gap between booking time and call time is >= 36h."""
    if booked_call_date is None or booked_at is None:
        return False
    gap = booked_call_date - booked_at
    return gap.total_seconds() >= _MIN_LEAD_HOURS_FOR_24H * 3600
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/gabriel/automations && python scripts/test_reminder_guard.py`
Expected: `✅ 24h eligibility guard OK`

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/booking_reminder.py scripts/test_reminder_guard.py
git commit -m "feat(reminder): add 36h lead-time guard for the 24h rung"
```

---

### Task 4: Wire both rungs into the scheduler

**Files:**
- Modify: `ENGINE/src/automations/booking_reminder.py` (`run()` lines ~51–102 and `_send_reminder()` lines ~105–199)

**Interfaces:**
- Consumes: `_build_reminder_message(lang, calling_number, rung)` (Task 2), `_is_24h_eligible(...)` (Task 3), the three new columns (Task 1).
- Produces: `_send_reminder(lead: dict, exec_id: str, rung: str) -> None` writing the rung-specific `*_sent_at` column.

- [ ] **Step 1: Replace `run()` to process both rungs**

In `ENGINE/src/automations/booking_reminder.py`, replace the body of `run()` (from `now = datetime.now(...)` through the final `await log_step(...)`) with:

```python
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    async with pool.acquire() as conn:
        # 24h rung: call is ~24h out, not yet 24h-reminded, and booked >=36h ahead.
        leads_24h = await conn.fetch(
            f'''
            SELECT l.id, l.first_name, l.last_name, l.phone, l.channel_identifier,
                   l."Campaigns_id", l."Accounts_id", l.booked_call_date, l.booked_at,
                   l.language
            FROM {fq(Table.LEADS)} l
            WHERE l."Conversion_Status" = 'Booked'
              AND l.booked_call_date >= $1 AND l.booked_call_date <= $2
              AND l.booking_reminder_24h_sent_at IS NULL
              AND l.booked_at IS NOT NULL
              AND (l.booked_call_date - l.booked_at) >= interval '36 hours'
            ''',
            now + timedelta(hours=23, minutes=50),
            now + timedelta(hours=24, minutes=10),
        )
        # 1h rung: call is ~1h out, not yet 1h-reminded.
        leads_1h = await conn.fetch(
            f'''
            SELECT l.id, l.first_name, l.last_name, l.phone, l.channel_identifier,
                   l."Campaigns_id", l."Accounts_id", l.booked_call_date, l.booked_at,
                   l.language
            FROM {fq(Table.LEADS)} l
            WHERE l."Conversion_Status" = 'Booked'
              AND l.booked_call_date >= $1 AND l.booked_call_date <= $2
              AND l.booking_reminder_1h_sent_at IS NULL
            ''',
            now + timedelta(minutes=50),
            now + timedelta(minutes=70),
        )

    errors = 0
    for rung, rows in (("24h", leads_24h), ("1h", leads_1h)):
        for lead_row in rows:
            lead = dict(lead_row)
            # Defense in depth: re-check the 24h guard in Python (also covers the
            # pure-tested path).
            if rung == "24h" and not _is_24h_eligible(lead.get("booked_call_date"), lead.get("booked_at")):
                continue
            try:
                await _send_reminder(lead, exec_id, rung)
            except Exception as exc:
                errors += 1
                log.error("booking_reminder.error", lead_id=lead["id"], rung=rung, error=str(exc))

    await log_step(
        workflow_name="booking_reminder",
        step_name="run_complete",
        status="Success" if errors == 0 else "Failure",
        workflow_execution_id=exec_id,
        output_data=f"24h={len(leads_24h)} 1h={len(leads_1h)} errors={errors}",
    )
```

- [ ] **Step 2: Update `_send_reminder()` to take a rung**

In `ENGINE/src/automations/booking_reminder.py`, change the signature to `async def _send_reminder(lead: dict, exec_id: str, rung: str) -> None:`. Then:

- Replace `body = _build_reminder_message(lang, calling_number)` with `body = _build_reminder_message(lang, calling_number, rung)`.
- Replace the idempotency write `await update_lead_fields(lead_id, booking_reminder_sent_at=now)` with:

```python
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    flag_col = "booking_reminder_24h_sent_at" if rung == "24h" else "booking_reminder_1h_sent_at"
    await update_lead_fields(lead_id, **{flag_col: now})
```

- In the `create_interaction(...)` call, change `triggered_by="booking_reminder"` to `triggered_by=f"booking_reminder_{rung}"`.
- In the final `step.output` / `log.info`, add `rung=rung`.

- [ ] **Step 3: Verify the module imports and the query parses**

Run: `cd /home/gabriel/automations && python -c "import src.automations.booking_reminder as b; print('import OK', b._MIN_LEAD_HOURS_FOR_24H)"`
Expected: `import OK 36`

- [ ] **Step 4: Verify against the dev DB (dry sender)**

Run: `cd /home/gabriel/automations && DRY_RUN=true python -c "import asyncio; from src.automations.booking_reminder import run; asyncio.run(run())"`
Expected: exits 0; logs show `booking_reminder.run_complete` with `24h=.. 1h=.. errors=0` (sends are blocked by `DRY_RUN`).

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/booking_reminder.py
git commit -m "feat(reminder): two-rung 24h+1h ladder with per-rung idempotency"
```

---

### Task 5: Stamp `booked_at`, and reset the ladder on booking + reschedule

**Files:**
- Modify: `ENGINE/src/automations/conversation/slot_booking.py` (`_create_booking_from_slot`, `update_kwargs` near line 439)
- Modify: `ENGINE/src/automations/ai_conversation.py` (reschedule `update_kwargs`, lines ~241–247)

**Interfaces:**
- Consumes: the three new columns (Task 1).

- [ ] **Step 1: Stamp `booked_at` on a new conversational booking**

In `ENGINE/src/automations/conversation/slot_booking.py`, inside `_create_booking_from_slot`, extend `update_kwargs` (the dict starting at line 439) so it also sets the booking timestamp:

```python
        update_kwargs: dict = {
            "calcom_booking_uid": result["uid"],
            "booking_confirmation_sent": True,
            "booked_at": datetime.now(timezone.utc).replace(tzinfo=None),
        }
```

(`datetime` and `timezone` are already imported at the top of this file.)

- [ ] **Step 2: Reset the ladder + re-stamp `booked_at` on reschedule**

In `ENGINE/src/automations/ai_conversation.py`, in the reschedule execution block, extend `update_kwargs` (lines ~241–244) to:

```python
                            update_kwargs: dict = {
                                "calcom_booking_uid": result["uid"],
                                "Conversion_Status": "Booked",
                                "booking_reminder_24h_sent_at": None,
                                "booking_reminder_1h_sent_at": None,
                                "booked_at": datetime.now(timezone.utc).replace(tzinfo=None),
                            }
```

(`datetime`/`timezone` are already imported in `ai_conversation.py`.)

- [ ] **Step 3: Verify both modules import**

Run: `cd /home/gabriel/automations && python -c "import src.automations.conversation.slot_booking, src.automations.ai_conversation; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/slot_booking.py src/automations/ai_conversation.py
git commit -m "feat(booking): stamp booked_at and reset reminder ladder on booking + reschedule"
```

---

### Task 6: Shared `detect_tool_call()` helper with Groq→OpenAI fallback

**Files:**
- Modify: `ENGINE/src/config.py` (add `intent_fallback_model`, AI Conversation section near line 64)
- Modify: `ENGINE/tools/ai_service.py` (add helper + private extractor)
- Test: `ENGINE/scripts/test_detect_tool_call.py` (create)

**Interfaces:**
- Produces: `async detect_tool_call(messages, tools, tool_name, *, groq_model=None, fallback_model=None, max_tokens=100) -> dict | None` — returns the named tool's parsed arguments dict, or `None`. Groq primary; OpenAI only on a Groq **exception**.

- [ ] **Step 1: Add the fallback-model setting**

In `ENGINE/src/config.py`, in the "AI Conversation" block (after line 64), add:

```python
    # Fallback model for intent detection (reschedule/cancel) when Groq errors.
    # Override via INTENT_FALLBACK_MODEL. Must support tool-calling. A gpt-5.x-mini
    # / nano on the EU endpoint is fine; gpt-4o-mini is a safe cheap default.
    intent_fallback_model: str = "gpt-4o-mini"
```

- [ ] **Step 2: Write the failing test**

Create `ENGINE/scripts/test_detect_tool_call.py`:

```python
"""Direct test: detect_tool_call in dry-run (no network). Run with AI_DRY_RUN=true.
Run: AI_DRY_RUN=true python scripts/test_detect_tool_call.py"""
import asyncio
from tools.ai_service import detect_tool_call, _extract_tool_args

_TOOL = {"type": "function", "function": {"name": "cancel_booking",
         "parameters": {"type": "object", "properties": {}, "required": []}}}

# _extract_tool_args returns args for a matching call, else None
calls = [{"function": {"name": "cancel_booking", "arguments": '{"reason": "busy"}'}}]
assert _extract_tool_args(calls, "cancel_booking") == {"reason": "busy"}
assert _extract_tool_args(calls, "reschedule") is None
assert _extract_tool_args(None, "cancel_booking") is None

# In dry-run Groq returns tool_calls=None → helper returns None (no fallback fired).
out = asyncio.run(detect_tool_call(
    [{"role": "system", "content": "x"}, {"role": "user", "content": "cancel"}],
    [_TOOL], "cancel_booking",
))
assert out is None, f"expected None in dry-run, got {out}"

print("✅ detect_tool_call OK")
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /home/gabriel/automations && AI_DRY_RUN=true python scripts/test_detect_tool_call.py`
Expected: FAIL (`ImportError: cannot import name 'detect_tool_call'`).

- [ ] **Step 4: Implement the helper**

In `ENGINE/tools/ai_service.py`, add near `generate_response_groq` (import `json` at top if not already present):

```python
def _extract_tool_args(tool_calls: list | None, tool_name: str) -> dict | None:
    """Return the parsed arguments of the first tool_call matching tool_name."""
    for tc in (tool_calls or []):
        fn = tc.get("function") if isinstance(tc, dict) else None
        if fn and fn.get("name") == tool_name:
            try:
                return json.loads(fn.get("arguments") or "{}")
            except Exception:
                return None
    return None


async def detect_tool_call(
    messages: list[dict],
    tools: list[dict],
    tool_name: str,
    *,
    groq_model: str | None = None,
    fallback_model: str | None = None,
    max_tokens: int = 100,
) -> dict | None:
    """Detect a single tool call. Groq primary; OpenAI fallback ONLY on a Groq
    exception (a clean 'no tool call' from Groq returns None without a fallback)."""
    # 1) Groq primary
    try:
        result = await generate_response_groq(
            messages,
            model=groq_model,
            max_tokens=max_tokens,
            temperature=0,
            tools=tools,
            tool_choice="auto",
        )
        return _extract_tool_args(result.get("tool_calls"), tool_name)
    except Exception as exc:
        log.warning("ai.detect_tool_call.groq_failed", tool=tool_name, error=str(exc))

    # 2) OpenAI fallback (Groq errored). Omit temperature so gpt-5.x/o-series
    #    models that reject a custom temperature still work.
    try:
        client = _get_client()
        model = fallback_model or settings.intent_fallback_model
        resp = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_completion_tokens=max_tokens,
            tools=tools,
            tool_choice="auto",
            timeout=_AI_REQUEST_TIMEOUT,
        )
        raw = resp.choices[0].message.tool_calls or []
        norm = [{"function": {"name": tc.function.name, "arguments": tc.function.arguments}} for tc in raw]
        return _extract_tool_args(norm, tool_name)
    except Exception as exc:
        log.warning("ai.detect_tool_call.openai_failed", tool=tool_name, error=str(exc))
        return None
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/gabriel/automations && AI_DRY_RUN=true python scripts/test_detect_tool_call.py`
Expected: `✅ detect_tool_call OK`

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/automations
git add src/config.py tools/ai_service.py scripts/test_detect_tool_call.py
git commit -m "feat(ai): shared detect_tool_call helper with Groq->OpenAI fallback"
```

---

### Task 7: Cancel-intent detection + cancellation context block

**Files:**
- Create: `ENGINE/src/automations/conversation/cancel.py`
- Test: `ENGINE/scripts/test_cancel_context.py` (create)

**Interfaces:**
- Consumes: `detect_tool_call` (Task 6), `_format_relative_date` is not needed here.
- Produces:
  - `async _detect_cancel_groq(inbound_message, lead, campaign_account, recent_messages, exec_id) -> dict | None` (returns `{"reason": str}` or `None`).
  - `_format_cancellation_context_block() -> str` (pure).

- [ ] **Step 1: Write the failing test (pure context block)**

Create `ENGINE/scripts/test_cancel_context.py`:

```python
"""Direct test: cancellation context block. Run: python scripts/test_cancel_context.py"""
from src.automations.conversation.cancel import _format_cancellation_context_block

block = _format_cancellation_context_block()
assert "[CANCELLATION CONTEXT]" in block
assert "already been cancelled" in block.lower()
# cancel-then-offer posture: confirm warmly, then offer to rebook, no pressure
assert "another time" in block.lower() or "rebook" in block.lower()
assert "do not" in block.lower()  # explicit no-pressure instruction

print("✅ cancellation context block OK")
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/gabriel/automations && python scripts/test_cancel_context.py`
Expected: FAIL (`ModuleNotFoundError: ... conversation.cancel`).

- [ ] **Step 3: Implement `cancel.py`**

Create `ENGINE/src/automations/conversation/cancel.py`:

```python
"""Cancel-intent detection for the AI conversation engine.

Mirrors conversation/reschedule.py but for outright cancellation. Detection uses
the shared detect_tool_call() helper (Groq primary, OpenAI fallback). The
orchestrator in ai_conversation.py executes the Cal.diy cancel and injects the
[CANCELLATION CONTEXT] block so the AI confirms warmly and offers to rebook.
"""

from datetime import date

import structlog

from tools.ai_service import detect_tool_call

log = structlog.get_logger()

_CANCEL_TOOL_DEF = {
    "type": "function",
    "function": {
        "name": "cancel_booking",
        "description": (
            "Call ONLY when the lead clearly wants to CANCEL / not attend their "
            "booked call and does NOT propose a new time. Examples: 'cancel my call', "
            "'I can't make it anymore', 'please cancel the appointment'. Do NOT call "
            "for reschedule requests (a specific new time is named) or vague replies "
            "like 'ok', 'thanks', or a question."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Short reason the lead gave, or empty string.",
                }
            },
            "required": [],
        },
    },
}


async def _detect_cancel_groq(
    inbound_message: str,
    lead: dict,
    campaign_account: dict,
    recent_messages: list[dict],
    exec_id: str,
) -> dict | None:
    """Detect cancel intent. Returns {"reason": str} or None."""
    today_str = date.today().strftime("%A, %B %d, %Y")

    conv_lines = []
    for msg in recent_messages[-4:]:
        content = msg.get("Content") or msg.get("content") or msg.get("message") or ""
        if not content:
            continue
        role_label = "AI" if msg.get("direction") == "outbound" else "Lead"
        conv_lines.append(f'{role_label}: "{content}"')
    conv_context = ("\n\nPrevious messages:\n" + "\n".join(conv_lines)) if conv_lines else ""

    system_prompt = (
        f"You are a scheduling assistant. Today is {today_str}.\n"
        f"The lead has an existing booked call.\n"
        f"If the lead wants to CANCEL the call (and does NOT name a new time), call "
        f"the cancel_booking tool.\n"
        f"Do NOT call it for reschedule requests, confirmations, questions, thanks, "
        f"or goodbyes.{conv_context}"
    )

    args = await detect_tool_call(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": inbound_message},
        ],
        [_CANCEL_TOOL_DEF],
        "cancel_booking",
    )
    if args is None:
        return None
    return {"reason": (args.get("reason") or "").strip()}


def _format_cancellation_context_block() -> str:
    """Instruction block appended to the system prompt after a cancel is executed."""
    return (
        "\n\n[CANCELLATION CONTEXT]\n"
        "The lead's booking has already been cancelled automatically. "
        "Confirm to the lead warmly and briefly that their call is cancelled. "
        "Do NOT pressure them and do NOT try to talk them out of it. "
        "Then gently leave the door open — offer to find another time whenever "
        "they'd like to rebook. Reply in the lead's language."
    )
```

- [ ] **Step 4: Run the pure test to verify it passes**

Run: `cd /home/gabriel/automations && python scripts/test_cancel_context.py`
Expected: `✅ cancellation context block OK`

- [ ] **Step 5: Live detection smoke test (manual, real Groq)**

Create `ENGINE/scripts/test_cancel_detection_live.py`:

```python
"""Live smoke test (uses real Groq). Run: python scripts/test_cancel_detection_live.py"""
import asyncio
from src.automations.conversation.cancel import _detect_cancel_groq

async def main():
    ca = {"account_timezone": "Europe/Amsterdam"}
    lead = {"id": 1, "time_zone": "Europe/Amsterdam", "booked_call_date": None}
    cancel = await _detect_cancel_groq("I need to cancel my call, something came up", lead, ca, [], "x")
    reschedule = await _detect_cancel_groq("can we move it to friday at 3pm instead", lead, ca, [], "x")
    thanks = await _detect_cancel_groq("great, thanks!", lead, ca, [], "x")
    print("cancel ->", cancel, "(expect a dict)")
    print("reschedule ->", reschedule, "(expect None)")
    print("thanks ->", thanks, "(expect None)")
    assert cancel is not None and reschedule is None and thanks is None
    print("✅ live cancel detection OK")

asyncio.run(main())
```

Run: `cd /home/gabriel/automations && python scripts/test_cancel_detection_live.py`
Expected: `✅ live cancel detection OK` (if a transient Groq disagreement occurs, re-run once; the OpenAI fallback only covers hard errors, not classification differences).

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/cancel.py scripts/test_cancel_context.py scripts/test_cancel_detection_live.py
git commit -m "feat(cancel): cancel-intent detection + cancellation context block"
```

---

### Task 8: Orchestrate cancel in the conversation engine

**Files:**
- Modify: `ENGINE/src/automations/ai_conversation.py` (imports; the `has_booking` block ~line 169–264; the context-injection block ~line 496–500)

**Interfaces:**
- Consumes: `_detect_cancel_groq`, `_format_cancellation_context_block` (Task 7); `cancel_booking` (Cal.diy, existing `tools/caldiy_api.py`); `_resolve_booking_target` (existing `conversation/slot_booking.py`).

- [ ] **Step 1: Add imports**

In `ENGINE/src/automations/ai_conversation.py`, near the other `conversation.*` imports (lines 50–58) and the `caldiy_api` imports, add:

```python
from src.automations.conversation.cancel import (
    _detect_cancel_groq,
    _format_cancellation_context_block,
)
from src.automations.conversation.slot_booking import _resolve_booking_target
from tools.caldiy_api import cancel_booking as caldiy_cancel_booking
```

- [ ] **Step 2: Run cancel detection when reschedule did not fire**

In `ENGINE/src/automations/ai_conversation.py`, immediately AFTER the reschedule block closes (after line ~264, still inside the function), add:

```python
        # Cancel intent — only when this is NOT a reschedule (no new time named).
        cancel_detected = False
        if has_booking and reschedule_ctx is None:
            async with AsyncLogStep(
                "ai_conversation", "cancel_groq_detection",
                workflow_execution_id=exec_id,
                accounts_id=account_id,
                campaigns_id=campaign_id,
                leads_id=lead_id,
            ) as cancel_step:
                cancel_args = await _detect_cancel_groq(
                    inbound_message=inbound_message,
                    lead=lead,
                    campaign_account=campaign_account,
                    recent_messages=history,
                    exec_id=exec_id,
                )
                cancel_step.output = json.dumps({"detected": cancel_args is not None})

            if cancel_args is not None:
                booking_uid = lead.get("calcom_booking_uid")
                ok = True
                if booking_uid:
                    _, _cancel_api_key = _resolve_booking_target(campaign_account)
                    ok = await caldiy_cancel_booking(
                        booking_uid,
                        reason=cancel_args.get("reason", ""),
                        api_key=_cancel_api_key,
                    )
                if ok:
                    # Clear the uid so the Cal.diy BOOKING_CANCELLED webhook self-skips
                    # (its is_auto_cancel guard: cancelled uid != current uid).
                    await update_lead_fields(
                        lead_id,
                        Conversion_Status="Cancelled",
                        previous_booked_call_date=lead.get("booked_call_date"),
                        booked_call_date=None,
                        calcom_booking_uid=None,
                        booking_confirmation_sent=None,
                        booking_reminder_24h_sent_at=None,
                        booking_reminder_1h_sent_at=None,
                        booked_at=None,
                    )
                    cancel_detected = True
                    log.info("ai_conversation.cancel_executed", lead_id=lead_id)
                else:
                    log.warning("ai_conversation.cancel_api_failed", lead_id=lead_id)
```

- [ ] **Step 3: Inject the cancellation context block**

In `ENGINE/src/automations/ai_conversation.py`, right after the `[RESCHEDULE CONTEXT]` injection (after line ~500), add:

```python
        # Inject [CANCELLATION CONTEXT] when a cancel was executed this turn.
        if cancel_detected and messages and messages[0].get("role") == "system":
            messages[0]["content"] += _format_cancellation_context_block()
```

- [ ] **Step 4: Verify import + syntax**

Run: `cd /home/gabriel/automations && python -c "import src.automations.ai_conversation; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Full-path dry-run smoke (manual, real APIs but dry sender)**

Note for the executor: a full end-to-end run requires a real booked lead in the dev DB. If one is available (a lead with `Conversion_Status='Booked'` and a `calcom_booking_uid`), send it a WhatsApp "please cancel my call" in the dev environment and confirm in `pm2 logs leadawaker-engine`: `ai_conversation.cancel_executed`, the lead row flips to `Cancelled` with `booked_call_date` nulled, and the AI reply confirms + offers to rebook. Skip if no booked test lead exists; the import check + unit tests cover the logic.

- [ ] **Step 6: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/ai_conversation.py
git commit -m "feat(cancel): execute in-chat cancel (cancel-then-offer) + context injection"
```

---

### Task 9: Give reschedule the same fallback

**Files:**
- Modify: `ENGINE/src/automations/conversation/reschedule.py` (`_detect_reschedule_groq`, lines ~141–239)

**Interfaces:**
- Consumes: `detect_tool_call` (Task 6). Preserves the existing return shape `{"datetime": str}` or `None`.

- [ ] **Step 1: Refactor reschedule detection onto the shared helper**

In `ENGINE/src/automations/conversation/reschedule.py`, replace the body of `_detect_reschedule_groq` (the `try/except` that calls `generate_response_groq`, lines ~209–239) with a call to the shared helper, keeping the same `system_prompt` and `_RESCHEDULE_TOOL_DEF` already built above it:

```python
    from tools.ai_service import detect_tool_call
    args = await detect_tool_call(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": inbound_message},
        ],
        [_RESCHEDULE_TOOL_DEF],
        "reschedule",
    )
    if not args:
        return None
    dt_str = (args.get("datetime") or "").strip()
    if not dt_str:
        return None
    try:
        datetime.fromisoformat(dt_str)  # validate
    except Exception:
        return None
    return {"datetime": dt_str}
```

(Remove the now-unused `generate_response_groq` import from this file if nothing else uses it.)

- [ ] **Step 2: Verify import + a quick live reschedule detection**

Run: `cd /home/gabriel/automations && python -c "import src.automations.conversation.reschedule; print('OK')"`
Expected: `OK`

Then (real Groq): `cd /home/gabriel/automations && python -c "import asyncio; from src.automations.conversation.reschedule import _detect_reschedule_groq; print(asyncio.run(_detect_reschedule_groq('can we move it to friday at 3pm', {'id':1,'time_zone':'Europe/Amsterdam','booked_call_date':None}, {}, [], 'x')))"`
Expected: a dict like `{'datetime': '2026-07-...T15:00:00'}` (not `None`).

- [ ] **Step 3: Commit**

```bash
cd /home/gabriel/automations
git commit -am "refactor(reschedule): route intent detection through detect_tool_call (adds fallback)"
```

---

## Self-Review

**Spec coverage:**
- Two-rung ladder (24h + 1h) → Tasks 2, 4. ✅
- 36h guard → Task 3 (pure) + Task 4 (SQL + Python defense). ✅
- Reschedule resets the ladder → Task 5. ✅
- Cancel-via-chat tool, cancel-then-offer → Tasks 7, 8. ✅
- Groq→OpenAI fallback, shared by reschedule + cancel → Tasks 6, 8, 9. ✅
- Webhook self-skip via cleared uid → Task 8 Step 2 (explicit). ✅
- Schema/migration via pg script → Task 1. ✅

**Placeholder scan:** No TBDs. The one manual step (Task 8 Step 5) is a labelled optional end-to-end smoke that depends on a real booked lead; unit tests cover the logic regardless.

**Type consistency:** `_build_reminder_message(lang, calling_number, rung)` defined in Task 2 and called with 3 args in Task 4. `detect_tool_call(...)` signature defined in Task 6 and used in Tasks 7 & 9 with matching args. `_is_24h_eligible` defined in Task 3 and used in Task 4. New columns named identically (`booking_reminder_24h_sent_at`, `booking_reminder_1h_sent_at`, `booked_at`) in Tasks 1, 4, 5, 8.

## Deploy note

After all tasks land and Gabriel gives the all-clear: run the migration (Task 1 Step 2) against production if not already, then `pm2 restart leadawaker-engine`. Do not restart during a live demo.
