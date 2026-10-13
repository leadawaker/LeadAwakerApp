# Phone Booking v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a client's phone line the receptionist's backend books, moves and cancels the caller's appointment by exact slot, offers every free time of the day asked, and books a phone callback or an in-person visit depending on what the caller wants.

**Architecture:** The backend model picks the date itself (it knows today's date) and books with the exact `start` returned by `check_availability`; no spoken-word parsing on real lines. Diary lookups are fresh per request against the client's Cal.diy. Cancel and move reuse one shared implementation with the chat (`conversation/booking_changes.py`). Visits are a second Cal.diy event type (`visit`) per account, provisioned by the Cal.diy script and configured in the CRM.

**Tech Stack:** Python 3.13 engine (FastAPI, asyncpg, structlog, pytest) in `/home/gabriel/automations`; Express + Drizzle + React CRM in `/home/gabriel/LeadAwakerApp`; Cal.diy (self-hosted Cal.com fork, Prisma) provisioning script in `/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts`.

**Spec:** `specs/phone-booking-v2/requirements.md`

## Global Constraints

- Demo diary, `demo_slot.py` parser, `voice_tools()` and the browser door stay unchanged. The browser client reads receipt keys `booked_slot` / `booked_iso`: keep their meaning.
- A caller has one upcoming appointment at a time (lead holds one `calcom_booking_uid`). A new booking for a caller who has one moves it (same kind) or replaces it (other kind).
- Cancel and move by phone require the caller ID to match the lead; a withheld number never cancels or moves.
- Phone-path Cal.diy calls use the account's own Cal.diy key: never the `settings.cal_api_key` fallback.
- Never send a lead's real email to Cal.diy (the existing `leadawaker+lead{id}@gmail.com` rule stays).
- Visit length default 60 minutes, editable in the CRM (30, 45, 60, 90, 120). Visits use the same Cal.diy schedule and minimum notice as callbacks.
- Text the voice model hears stays in the call's language; backend tool descriptions, results and notes stay English (decision recorded in memory `feedback_voice_native_language_only`).
- CRM: every user-facing string through i18n (`client/src/locales/{en,nl,pt}/`, Portuguese is Brazilian), tokens only (no raw hex, no `bg-white`), never run `tsc` or `npm run dev`. No em dashes in any copy.
- Engine: after edits run `./preflight.sh` and restart with `pm2 restart leadawaker-engine --update-env` only on PASS. Never restart while a call is live (`grep -E "voice\.phone\.(attached|ended)" ~/.pm2/logs/leadawaker-engine-out.log | tail -2`). Do not restart between Task 4 and Task 7: tasks 4 to 6 change the tool contract in steps.
- Engine tests: `cd /home/gabriel/automations && .venv/bin/python -m pytest <path> -q`. 16 tests in `tests/voice` fail before this work (stale against earlier uncommitted sessions: `test_live_session_config`, `test_client_setup`, `test_call_screening`, `test_token_endpoint`, `test_voice_calls_db`); a task is green when it adds no new failure. `tests/voice/test_phone_door.py::test_call_files_stay_small` caps `phone_call.py` (499 lines now) below 500.
- Commit only the files of the task (`git add <paths>`, never `-A`): both repos carry unrelated uncommitted work. The engine repo is public: no secrets in code or commits. Do not commit in `/home/gabriel/caldiy` (its script already has uncommitted local changes).
- Keep files under 500 lines where reasonable.

## Review Focus

- **A day across a DST change (the test uses 31 October 2027):** the window for a day must run local midnight to local midnight; a UTC-based end would drop or add an hour of slots. Test in Task 4.
- **The caller's phone matches a lead on another account:** `upcoming_booking` must ignore it, or a caller could move another business's appointment. Test in Task 5.
- **Cal.diy moved the booking but our lead write failed:** the caller must still hear "moved" (the calendar is the truth); only the CRM write is logged as failed. Test in Task 3.
- **A date in the past or before the minimum notice:** `check_availability` must answer with the first days that have room, not an empty list. Test in Task 5.
- **Withheld caller asks to cancel:** must answer `unknown_caller` without touching any lead (all withheld callers share one lead). Test in Task 7.

---

## Slice 1: exact slots and corrections

### Task 1: Pure slot helpers for exact starts

**Files:**
- Modify: `/home/gabriel/automations/src/automations/voice/real_diary_slots.py`
- Test: `/home/gabriel/automations/tests/voice/test_real_diary_slots.py` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces (additive; the old `asked_time`, `exact_slot`, `offers`, `listing`, `_slot_out` stay until Task 5 removes them):
  - `local_start(start: datetime) -> str` ("YYYY-MM-DDTHH:MM" in the slot's own timezone)
  - `slot_out(s: FreeSlot, lang: str) -> dict` (`{"start": str, "say": str}`)
  - `parse_day(text: str | None) -> date | None`
  - `parse_start(text: str | None, tz: ZoneInfo) -> datetime | None` (aware, in `tz`)
  - `match_start(free: list[FreeSlot], text: str | None, tz: ZoneInfo) -> FreeSlot | None`
  - `day_slots(free: list[FreeSlot], day: date) -> list[FreeSlot]`
  - `first_days(free: list[FreeSlot], n_days: int = 2) -> list[FreeSlot]`

- [ ] **Step 1: Write the failing tests**

```python
"""Pure helpers of the real phone diary: exact starts, whole days. No I/O."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from src.automations.voice.real_diary_slots import (
    FreeSlot, day_slots, first_days, local_start, match_start, parse_day, parse_start, slot_out,
)

AMS = ZoneInfo("Europe/Amsterdam")


def _s(y, m, d, h, mi=0):
    dt = datetime(y, m, d, h, mi, tzinfo=AMS)
    return FreeSlot(dt, dt.isoformat(timespec="milliseconds"))  # Cal.diy's own shape


FREE = [_s(2026, 10, 15, 9), _s(2026, 10, 15, 10, 30), _s(2026, 10, 15, 11),
        _s(2026, 10, 16, 9), _s(2026, 10, 19, 14)]


def test_match_start_takes_the_local_start_it_handed_out():
    assert match_start(FREE, "2026-10-15T10:30", AMS) == FREE[1]


def test_match_start_compares_instants_not_strings():
    assert match_start(FREE, "2026-10-15T08:30:00.000Z", AMS) == FREE[1]
    assert match_start(FREE, "2026-10-15T10:30:00+02:00", AMS) == FREE[1]


def test_match_start_never_guesses():
    assert match_start(FREE, "2026-10-15T10:00", AMS) is None
    assert match_start(FREE, "half elf", AMS) is None
    assert match_start(FREE, "", AMS) is None


def test_parse_start_puts_a_bare_time_in_the_business_timezone():
    assert parse_start("2026-10-15T10:30", AMS) == datetime(2026, 10, 15, 10, 30, tzinfo=AMS)


def test_day_slots_returns_every_slot_of_that_day():
    assert day_slots(FREE, date(2026, 10, 15)) == FREE[:3]
    assert day_slots(FREE, date(2026, 10, 17)) == []


def test_first_days_returns_whole_days():
    assert first_days(FREE, 2) == FREE[:4]


def test_slot_out_gives_the_start_to_copy_and_words_to_say():
    out = slot_out(FREE[1], "nl")
    assert out["start"] == "2026-10-15T10:30" == local_start(FREE[1].start)
    assert out["say"] and out["say"] != out["start"]


def test_parse_day_reads_only_iso_dates():
    assert parse_day("2026-10-20") == date(2026, 10, 20)
    assert parse_day("morgen") is None
    assert parse_day(None) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/voice/test_real_diary_slots.py -q`
Expected: FAIL with `ImportError: cannot import name 'day_slots'`

- [ ] **Step 3: Add the helpers**

In `real_diary_slots.py`, change the imports to:

```python
from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

from src.automations.voice.demo_slot import _lang, _resolve_day, _resolve_hour, _speak
```

Append at the end of the file:

```python
# --- exact starts (phone booking v2) ----------------------------------------------
#
# The backend books by the `start` check_availability handed out, never by
# re-reading spoken words: the demo parser read "tien uur dertig" as 10:00, a
# weekday named on that weekday as next week, and no date at all (call 1887,
# 2026-10-13).

def local_start(start: datetime) -> str:
    """What the backend copies back to book: local wall time, minute precision."""
    return start.strftime("%Y-%m-%dT%H:%M")


def slot_out(s: FreeSlot, lang: str) -> dict:
    return {"start": local_start(s.start), "say": spoken(s.start, lang)}


def parse_day(text: str | None) -> date | None:
    try:
        return date.fromisoformat((text or "").strip()[:10])
    except ValueError:
        return None


def parse_start(text: str | None, tz: ZoneInfo) -> datetime | None:
    raw = (text or "").strip().replace(".000", "").replace("Z", "+00:00")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return dt.replace(tzinfo=tz) if dt.tzinfo is None else dt.astimezone(tz)


def match_start(free: list[FreeSlot], text: str | None, tz: ZoneInfo) -> FreeSlot | None:
    """The free slot starting at exactly that instant, else None. Never a nearby one."""
    want = parse_start(text, tz)
    if want is None:
        return None
    return next((s for s in free if s.start == want), None)


def day_slots(free: list[FreeSlot], day: date) -> list[FreeSlot]:
    return [s for s in free if s.start.date() == day]


def first_days(free: list[FreeSlot], n_days: int = 2) -> list[FreeSlot]:
    """Every slot of the first `n_days` days that have room."""
    days = sorted({s.start.date() for s in free})[:n_days]
    return [s for s in free if s.start.date() in days]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/voice/test_real_diary_slots.py tests/voice/test_real_booking.py -q`
Expected: all pass (the old helpers are untouched).

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/voice/real_diary_slots.py tests/voice/test_real_diary_slots.py
git commit -m "feat(phone-booking): exact-start and whole-day slot helpers"
```

---

### Task 2: `booked_at` written timezone-aware, and an opt-out of the 2-minute guard

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py` (guard at ~871-884, write at ~1040, signature at ~841)
- Modify: `/home/gabriel/automations/src/automations/conversation/reschedule.py:508`
- Modify: `/home/gabriel/automations/src/webhooks/booking_routes.py:644` and `:1351`
- Test: `/home/gabriel/automations/tests/test_booked_at_timezone.py` (create)

**Why:** `booked_at` is `timestamptz` but was written as a naive UTC value, which Postgres stored as Amsterdam time (lead 1319: `booked_at` 09:12:59+02 for a booking made at 11:12:59+02). The 2-minute duplicate guard therefore never fired, and `booking_reminder`'s gap maths was off by the UTC offset.

**Interfaces:**
- Produces: `_create_booking_from_slot(slot_iso, lead, campaign_account, booking_link, extra_metadata=None, *, skip_recent_guard: bool = False)`. Task 5 passes `skip_recent_guard=True` (the phone path decides moves itself).

- [ ] **Step 1: Write the failing tests**

```python
"""booked_at is timestamptz: it must be written aware, or Postgres reads the
naive UTC value as local time and the 2-minute guard never fires."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from src.automations.conversation import slot_booking

CA = {"id": 72, "Accounts_id": 53, "meeting_type": "phone_call", "account_timezone": "Europe/Amsterdam"}
SLOT = "2026-10-15T09:00:00.000+02:00"


def _run(lead, *, skip=False):
    upd = AsyncMock()
    create = AsyncMock(return_value={"uid": "new", "start": SLOT, "status": "accepted"})
    with patch.object(slot_booking, "get_lead", AsyncMock(return_value=lead)), \
         patch.object(slot_booking, "update_lead_fields", upd), \
         patch.object(slot_booking, "caldiy_create_booking", create), \
         patch.object(slot_booking, "_resolve_booking_target",
                      AsyncMock(return_value=("https://cal.leadawaker.com/x/30min", "k", "http://c", 10))):
        res = asyncio.run(slot_booking._create_booking_from_slot(
            SLOT, lead, CA, "", skip_recent_guard=skip))
    return res, upd, create


def test_booked_at_is_written_timezone_aware():
    res, upd, _ = _run({"id": 7, "phone": "+31612345678"})
    assert res["uid"] == "new"
    assert upd.await_args.kwargs["booked_at"].tzinfo is not None


def test_the_guard_sees_a_booking_made_a_minute_ago():
    lead = {"id": 7, "calcom_booking_uid": "old", "booked_at": datetime.now(timezone.utc) - timedelta(minutes=1)}
    res, _, create = _run(lead)
    assert res == {"already_booked": True, "uid": "old"}
    create.assert_not_awaited()


def test_the_phone_path_can_skip_the_guard():
    lead = {"id": 7, "calcom_booking_uid": "old", "booked_at": datetime.now(timezone.utc) - timedelta(minutes=1)}
    res, _, create = _run(lead, skip=True)
    assert res["uid"] == "new"
    create.assert_awaited_once()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_booked_at_timezone.py -q`
Expected: FAIL (`TypeError: ... unexpected keyword argument 'skip_recent_guard'`).

- [ ] **Step 3: Implement**

In `slot_booking.py`, change the signature:

```python
async def _create_booking_from_slot(
    slot_iso: str,
    lead: dict,
    campaign_account: dict,
    booking_link: str,
    extra_metadata: dict[str, str] | None = None,
    *,
    skip_recent_guard: bool = False,
) -> dict | None:
```

Add to its docstring: `skip_recent_guard: the phone path (voice/phone_appointments.py) decides moves and replacements itself, so the raw-link race guard below does not apply to it.`

Replace the guard's first lines:

```python
    _fresh_lead = await get_lead(lead_id)
    if _fresh_lead and not skip_recent_guard:
        _existing_uid = (_fresh_lead.get("calcom_booking_uid") or "").strip()
        _booked_at = _fresh_lead.get("booked_at")
        if _existing_uid and _booked_at:
            if _booked_at.tzinfo is None:
                _booked_at = _booked_at.replace(tzinfo=timezone.utc)
            _age = datetime.now(timezone.utc) - _booked_at
```

(the rest of the guard block, including the public-demo cap, stays as it is, indented under the same `if`).

Replace the write at ~1040:

```python
            "booked_at": datetime.now(timezone.utc),
```

In `reschedule.py` line ~508: `"booked_at": datetime.now(timezone.utc),`

In `booking_routes.py` line ~644: `now = datetime.now(timezone.utc)` and line ~1351: `now = _dt.now(timezone.utc)`. Check with `grep -n "booking_confirmed_at_\|booking_cancelled_at" src/webhooks/booking_routes.py` that `now` only feeds timestamptz columns (`booking_confirmed_at_`, `booked_at`, `booking_cancelled_at`); if any feeds a `timestamp without time zone` column (check with `information_schema.columns`), keep a naive copy for that one key.

- [ ] **Step 4: Run the tests**

Run: `.venv/bin/python -m pytest tests/test_booked_at_timezone.py tests/test_booking_reminder_selection.py tests/voice/test_real_booking.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/automations/conversation/slot_booking.py src/automations/conversation/reschedule.py src/webhooks/booking_routes.py tests/test_booked_at_timezone.py
git commit -m "fix(booking): write booked_at timezone-aware; phone path may skip the raw-link guard"
```

---

### Task 3: One cancel and one move for chat and phone

**Files:**
- Create: `/home/gabriel/automations/src/automations/conversation/booking_changes.py`
- Modify: `/home/gabriel/automations/src/automations/conversation/cancel.py` (lines ~154-183)
- Modify: `/home/gabriel/automations/src/automations/conversation/reschedule.py` (lines ~474-527)
- Test: `/home/gabriel/automations/tests/test_booking_changes.py` (create)

**Why:** chat cancel clears the uid before Cal.diy's BOOKING_CANCELLED webhook arrives, so the webhook skips it as superseded: no client "cancelled" alert, and `billable_booking` stays true on a cancelled booking (billing rule 2026-07-12: a cancelled call is never billed). The shared function does both itself.

**Interfaces:**
- Produces:
  - `async def cancel_lead_booking(lead: dict, campaign_account: dict, *, reason: str = "", by_customer: bool = True, require_account_key: bool = False) -> bool`
  - `async def reschedule_lead_booking(lead: dict, campaign_account: dict, new_slot_iso: str, *, reason: str = "", require_account_key: bool = False) -> dict | None` (returns `caldiy_api.reschedule_booking`'s `{"uid", "new_start", "raw"}` or None)

- [ ] **Step 1: Write the failing tests**

```python
"""Cancel and move a lead's booking (conversation/booking_changes.py). Mocks only."""

import asyncio
from contextlib import ExitStack
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from src.automations.conversation import booking_changes as bc

CA = {"id": 72, "Accounts_id": 53}
START = datetime(2026, 10, 20, 8, 30, tzinfo=timezone.utc)
LEAD = {"id": 501, "calcom_booking_uid": "u1", "booked_call_date": START}
M = "src.automations.conversation.booking_changes"


def _world(st, *, key="k", cancel_ok=True, reschedule=None, upd=None):
    m = {
        "target": st.enter_context(patch(f"{M}._resolve_booking_target",
                                         AsyncMock(return_value=("url", key, "http://c", 10)))),
        "cancel": st.enter_context(patch("tools.caldiy_api.cancel_booking", AsyncMock(return_value=cancel_ok))),
        "resched": st.enter_context(patch("tools.caldiy_api.reschedule_booking", reschedule or AsyncMock(
            return_value={"uid": "u2", "new_start": "2026-10-21T07:00:00.000Z", "raw": {}}))),
        "upd": st.enter_context(patch(f"{M}.update_lead_fields", upd or AsyncMock())),
        "diary": st.enter_context(patch(f"{M}.record_action", AsyncMock())),
        "alert": st.enter_context(patch("src.automations.client_alerts.events.booking_event", MagicMock())),
        "count": st.enter_context(patch(f"{M}._bump_reschedule_count", AsyncMock())),
    }
    return m


def test_customer_cancel_clears_billing_and_alerts_the_client():
    with ExitStack() as st:
        m = _world(st)
        assert asyncio.run(bc.cancel_lead_booking(LEAD, CA, reason="ziek")) is True
    m["cancel"].assert_awaited_once()
    kw = m["upd"].await_args.kwargs
    assert kw["calcom_booking_uid"] is None and kw["billable_booking"] is False
    assert kw["booking_cancelled_at"].tzinfo is not None
    assert m["alert"].call_args.args[0] == "cancelled"
    assert m["alert"].call_args.kwargs["booking_uid"] == "u1"


def test_a_failed_cal_diy_cancel_changes_nothing():
    with ExitStack() as st:
        m = _world(st, cancel_ok=False)
        assert asyncio.run(bc.cancel_lead_booking(LEAD, CA)) is False
    m["upd"].assert_not_awaited()
    m["alert"].assert_not_called()


def test_the_phone_never_uses_the_shared_cloud_key():
    with ExitStack() as st:
        m = _world(st, key=None)
        assert asyncio.run(bc.cancel_lead_booking(LEAD, CA, require_account_key=True)) is False
        assert asyncio.run(bc.reschedule_lead_booking(LEAD, CA, "x", require_account_key=True)) is None
    m["cancel"].assert_not_awaited()
    m["resched"].assert_not_awaited()


def test_move_writes_the_new_uid_and_time_aware():
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(bc.reschedule_lead_booking(LEAD, CA, "2026-10-21T09:00:00.000+02:00"))
    assert res["uid"] == "u2"
    kw = m["upd"].await_args.kwargs
    assert kw["calcom_booking_uid"] == "u2" and kw["Conversion_Status"] == "Booked"
    assert kw["booked_call_date"] == datetime(2026, 10, 21, 7, 0, tzinfo=timezone.utc)
    assert kw["booked_at"].tzinfo is not None
    from src.automations.conversation.helpers import ENGINE_RESCHEDULE_IN_FLIGHT
    assert 501 not in ENGINE_RESCHEDULE_IN_FLIGHT


def test_a_move_cal_diy_made_still_counts_when_our_write_fails():
    with ExitStack() as st:
        _world(st, upd=AsyncMock(side_effect=RuntimeError("db down")))
        res = asyncio.run(bc.reschedule_lead_booking(LEAD, CA, "2026-10-21T09:00:00.000+02:00"))
    assert res["uid"] == "u2"


def test_a_refused_move_returns_none():
    with ExitStack() as st:
        _world(st, reschedule=AsyncMock(side_effect=RuntimeError("409 slot taken")))
        assert asyncio.run(bc.reschedule_lead_booking(LEAD, CA, "x")) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_booking_changes.py -q`
Expected: FAIL with `ModuleNotFoundError: ... booking_changes`.

- [ ] **Step 3: Create `booking_changes.py`**

```python
"""Cancel or move a lead's Cal.diy booking: one implementation for the chat
(cancel.py, reschedule.py) and the phone (voice/phone_appointments.py).

A cancel clears the lead's uid before Cal.diy's BOOKING_CANCELLED webhook
arrives, so the webhook takes it for a superseded booking and skips it
(booking_routes._handle_cancellation, is_auto_cancel). Everything that
webhook does for a customer's cancel therefore happens here: billing cleared,
the diary line, and the client's "cancelled" alert. Until 2026-10-13 the chat
did none of the three.
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog

from src.automations.automation_logger import record_action
from src.automations.conversation.helpers import ENGINE_RESCHEDULE_IN_FLIGHT
from src.automations.conversation.slot_booking import _resolve_booking_target
from tools import caldiy_api
from tools.db.leads import update_lead_fields

log = structlog.get_logger()


async def _target(campaign_account: dict, require_account_key: bool) -> tuple[str | None, str | None] | None:
    """(api_key, base_url), or None when the phone must not use the shared key."""
    _, api_key, base_url, _ = await _resolve_booking_target(campaign_account)
    if require_account_key and not api_key:
        log.warning("booking_changes.no_account_key", account_id=campaign_account.get("Accounts_id"))
        return None
    return api_key, base_url


async def cancel_lead_booking(
    lead: dict, campaign_account: dict, *, reason: str = "",
    by_customer: bool = True, require_account_key: bool = False,
) -> bool:
    """Cancel the lead's booking on Cal.diy, then on the lead. False = nothing changed."""
    target = await _target(campaign_account, require_account_key)
    if target is None:
        return False
    uid = (lead.get("calcom_booking_uid") or "").strip()
    if uid:
        ok = await caldiy_api.cancel_booking(uid, reason=reason, api_key=target[0], base_url=target[1])
        if not ok:
            return False
    lead_id = lead["id"]
    account_id = campaign_account["Accounts_id"]
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
        billable_booking=False,
        booking_cancelled_at=datetime.now(timezone.utc),
    )
    await record_action("booking_webhook", "booking_cancelled", "success",
                        account_id=account_id, campaign_id=campaign_account.get("id"), lead_id=lead_id)
    if by_customer and uid:
        from src.automations.client_alerts.events import booking_event

        booking_event("cancelled", account_id=account_id, lead=lead, campaign=campaign_account,
                      booking_uid=uid, start=lead.get("booked_call_date"))
    log.info("booking_changes.cancelled", lead_id=lead_id, uid=uid or None)
    return True


async def _bump_reschedule_count(lead_id: int) -> None:
    from tools.db.connection import get_pool
    from tools.db.constants import Table, fq

    async with get_pool().acquire() as conn:
        await conn.execute(
            f"UPDATE {fq(Table.LEADS)} SET re_scheduled_count = COALESCE(re_scheduled_count, 0) + 1, "
            f"updated_at = NOW() WHERE id = $1",
            lead_id,
        )


async def reschedule_lead_booking(
    lead: dict, campaign_account: dict, new_slot_iso: str, *,
    reason: str = "", require_account_key: bool = False,
) -> dict | None:
    """Move the lead's booking. None = Cal.diy did not move it. Once Cal.diy
    has moved it, the result is returned even if our own write fails: the
    calendar is the truth, and the webhook repairs the lead."""
    target = await _target(campaign_account, require_account_key)
    uid = (lead.get("calcom_booking_uid") or "").strip()
    if target is None or not uid:
        return None
    lead_id = lead["id"]
    # Cal.diy fires BOOKING_RESCHEDULED during the call below; the webhook
    # must not process the move a second time (booking_routes._handle_reschedule).
    ENGINE_RESCHEDULE_IN_FLIGHT.add(lead_id)
    try:
        try:
            result = await caldiy_api.reschedule_booking(
                booking_uid=uid, new_slot_start=new_slot_iso, reason=reason,
                api_key=target[0], base_url=target[1],
            )
        except Exception as exc:
            log.warning("booking_changes.reschedule_refused", lead_id=lead_id, error=str(exc))
            return None
        fields: dict = {
            "calcom_booking_uid": result["uid"],
            "Conversion_Status": "Booked",
            "booking_reminder_24h_sent_at": None,
            "booking_reminder_1h_sent_at": None,
            "booked_at": datetime.now(timezone.utc),
        }
        try:
            fields["booked_call_date"] = datetime.fromisoformat(
                (result.get("new_start") or "").replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            pass
        try:
            await update_lead_fields(lead_id, **fields)
            await _bump_reschedule_count(lead_id)
        except Exception as exc:
            log.error("booking_changes.reschedule_write_failed", lead_id=lead_id, error=str(exc))
        log.info("booking_changes.rescheduled", lead_id=lead_id, old_uid=uid, new_uid=result["uid"])
        return result
    finally:
        ENGINE_RESCHEDULE_IN_FLIGHT.discard(lead_id)
```

- [ ] **Step 4: Point the chat at it**

In `cancel.py` `handle_cancel_turn`, replace everything from `booking_uid = lead.get("calcom_booking_uid")` to the end of the function with:

```python
    from src.automations.conversation.booking_changes import cancel_lead_booking

    if await cancel_lead_booking(lead, campaign_account, reason=cancel_args.get("reason", "")):
        log.info("ai_conversation.cancel_executed", lead_id=lead_id)
        return True
    log.warning("ai_conversation.cancel_api_failed", lead_id=lead_id)
    return False
```

and remove the now-unused imports at the top of that function (`_resolve_booking_target`, `cancel_booking as caldiy_cancel_booking`, `update_lead_fields`).

In `reschedule.py`, replace the block from `from src.automations.conversation.helpers import ENGINE_RESCHEDULE_IN_FLIGHT` through the `finally: ENGINE_RESCHEDULE_IN_FLIGHT.discard(lead_id)` with:

```python
            from src.automations.conversation.booking_changes import reschedule_lead_booking

            async with AsyncLogStep(
                "ai_conversation", "execute_calcom_reschedule",
                workflow_execution_id=exec_id,
                accounts_id=account_id,
                campaigns_id=campaign_id,
                leads_id=lead_id,
                is_critical_error=True,
            ) as step:
                result = await reschedule_lead_booking(lead, campaign_account, reschedule_ctx["requested_iso"])
                if result:
                    reschedule_ctx["reschedule_executed"] = True
                    step.output = f"rescheduled → {result['new_start']} uid={result['uid']}"
                else:
                    # Not moved: the AI will not confirm and offers the booking link.
                    reschedule_ctx["is_available"] = False
                    step.output = "reschedule refused"
```

Then remove imports in `reschedule.py` that are now unused (`reschedule_booking`, the inline `get_pool` / `fq` / `Table` imports): check each with `grep -n "<name>" src/automations/conversation/reschedule.py` before deleting.

- [ ] **Step 5: Run the tests**

Before Step 3, record the baseline: `.venv/bin/python -m pytest tests -q -p no:warnings -k "cancel or reschedul" 2>&1 | grep -E "^FAILED" > /tmp/claude-1000/baseline-t3.txt`.
Run: `.venv/bin/python -m pytest tests -q -p no:warnings -k "cancel or reschedul or booking_changes" 2>&1 | grep -E "^FAILED|passed|failed"`
Expected: `tests/test_booking_changes.py` passes and no FAILED line appears that is not in the baseline file.

- [ ] **Step 6: Commit**

```bash
git add src/automations/conversation/booking_changes.py src/automations/conversation/cancel.py src/automations/conversation/reschedule.py tests/test_booking_changes.py
git commit -m "feat(booking): shared cancel and move; a customer cancel clears billing and alerts the client"
```

---

### Task 4: The diary looks up a day fresh, per appointment kind

**Files:**
- Modify: `/home/gabriel/automations/src/automations/voice/real_booking.py`
- Test: `/home/gabriel/automations/tests/voice/test_real_diary.py` (create)

**Interfaces:**
- Consumes: `FreeSlot`, `_parse_iso` (Task 1 file).
- Produces (in `real_booking.py`):
  - `KIND_CALLBACK = "callback"`, `KIND_VISIT = "visit"`, `MAX_DAYS_AHEAD = 90`, `SLOT_WINDOW_DAYS = 14` (renamed from `_SLOT_WINDOW_DAYS`)
  - `@dataclass(frozen=True) class DiaryKind: key: str; username: str; slug: str; event_type_id: int | None; location: str`
  - `RealDiary.kinds: dict[str, DiaryKind]`, `RealDiary.creds: tuple[str | None, str | None]` (api_key, base_url)
  - `async RealDiary.load() -> None` (raises `DiaryUnavailable`)
  - `async RealDiary.free(kind: str, *, day: date | None = None, reschedule_uid: str | None = None) -> list[FreeSlot]`
  - `diary_for_call` awaits `diary.load()` with a 3 s cap instead of `prefetch()`.
- Removes: `fetch_free_slots`, `RealDiary.prefetch`, `RealDiary.free_slots`, `RealDiary.take`, `_taken`.

- [ ] **Step 1: Write the failing tests**

```python
"""RealDiary: which calendar, which kinds, and one day's free slots, fetched fresh."""

import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from src.automations.voice import real_booking as rb

AMS = ZoneInfo("Europe/Amsterdam")
CA = {"id": 72, "Accounts_id": 53, "account_timezone": "Europe/Amsterdam", "meeting_type": "phone_call",
      "min_booking_notice_hours": 2,
      "calendar_link_override": "https://cal.leadawaker.com/robben-rosmalen/30min"}
TARGET = "src.automations.conversation.slot_booking._resolve_booking_target"


def _diary(key="k"):
    d = rb.RealDiary(CA)
    t = patch(TARGET, AsyncMock(return_value=(CA["calendar_link_override"], key, "http://c", 10)))
    return d, t


def test_load_names_the_callback_kind_from_the_calendar_link():
    d, t = _diary()
    with t:
        asyncio.run(d.load())
    k = d.kinds[rb.KIND_CALLBACK]
    assert (k.username, k.slug, k.event_type_id, k.location) == ("robben-rosmalen", "30min", 10, "attendeePhone")
    assert d.creds == ("k", "http://c")


def test_load_refuses_the_shared_key():
    d, t = _diary(key=None)
    with t, pytest.raises(rb.DiaryUnavailable):
        asyncio.run(d.load())


def _free(d, **kw):
    avail = AsyncMock(return_value=["2026-10-27T09:00:00.000+01:00", "2026-10-27T10:30:00.000+01:00"])
    with patch.object(rb, "get_availability", avail):
        out = asyncio.run(d.free(rb.KIND_CALLBACK, **kw))
    return out, avail


def test_a_day_is_fetched_local_midnight_to_local_midnight_across_dst():
    d, t = _diary()
    with t:
        asyncio.run(d.load())
    # 31 Oct 2027 has 25 hours in Amsterdam (clocks go back). A future date on
    # purpose: a past day is never looked up.
    out, avail = _free(d, day=date(2027, 10, 31))
    start, end = avail.await_args.args[1], avail.await_args.args[2]
    assert start == "2027-10-30T22:00:00Z" and end == "2027-10-31T23:00:00Z"


def test_free_parses_and_passes_the_reschedule_uid():
    d, t = _diary()
    with t:
        asyncio.run(d.load())
    out, avail = _free(d, day=date(2027, 11, 2), reschedule_uid="u1")
    assert [s.start.hour for s in out] == [9, 10]
    assert avail.await_args.kwargs["booking_uid_to_reschedule"] == "u1"
    assert avail.await_args.kwargs["username"] == "robben-rosmalen"


def test_a_day_before_the_notice_is_empty_without_a_lookup():
    d, t = _diary()
    with t:
        asyncio.run(d.load())
    out, avail = _free(d, day=datetime.now(AMS).date() - timedelta(days=1))
    assert out == [] and avail.await_count == 0


def test_no_day_means_the_whole_window_from_the_notice():
    d, t = _diary()
    with t:
        asyncio.run(d.load())
    _, avail = _free(d)
    start = datetime.strptime(avail.await_args.args[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    assert timedelta(hours=1, minutes=59) < start - datetime.now(timezone.utc) <= timedelta(hours=2)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/voice/test_real_diary.py -q`
Expected: FAIL (`AttributeError: ... has no attribute 'KIND_CALLBACK'`).

- [ ] **Step 3: Implement in `real_booking.py`**

Imports at the top (replace the `datetime` import line and add the two others):

```python
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from tools.caldiy_api import get_availability
```

Constants (replace `_SLOT_WINDOW_DAYS = 14`):

```python
SLOT_WINDOW_DAYS = 14
# A date further out is refused politely rather than looked up.
MAX_DAYS_AHEAD = 90
KIND_CALLBACK = "callback"
KIND_VISIT = "visit"
```

Replace `fetch_free_slots` and the whole `RealDiary` class with:

```python
@dataclass(frozen=True)
class DiaryKind:
    """One kind of appointment on the client's calendar (a Cal.diy event type)."""
    key: str                  # KIND_CALLBACK | KIND_VISIT
    username: str
    slug: str
    event_type_id: int | None
    location: str             # Cal.diy booking location; "" = the event type's own


class RealDiary:
    """One call's view of the client's calendar. Every lookup is fresh: the
    calendar is local (Cal.diy, ~200 ms) and a cached list offered times
    someone else had taken meanwhile."""

    def __init__(self, campaign_account: dict):
        self.campaign_account = campaign_account
        self.account_id = campaign_account["Accounts_id"]
        self.campaign_id = campaign_account["id"]
        self.tz = _tz_for(campaign_account)
        self.notice_hours = notice_hours(campaign_account)
        self.kinds: dict[str, DiaryKind] = {}
        self.creds: tuple[str | None, str | None] = (None, None)

    async def load(self) -> None:
        """Which calendar and which kinds. Raises DiaryUnavailable."""
        from src.automations.conversation.slot_booking import _CALDIY_LOCATION_MAP, _resolve_booking_target
        from tools.calcom_service import parse_calcom_url

        url, api_key, base_url, event_type_id = await _resolve_booking_target(self.campaign_account)
        if not api_key:
            # Never the shared cal.com Cloud fallback: that is not this client's calendar.
            raise DiaryUnavailable("account has no Cal.diy engine key")
        parsed = parse_calcom_url(url)
        if not parsed:
            raise DiaryUnavailable(f"unparseable calendar link {url!r}")
        username, slug = parsed
        meeting = self.campaign_account.get("meeting_type") or "phone_call"
        self.creds = (api_key, base_url)
        self.kinds = {KIND_CALLBACK: DiaryKind(
            KIND_CALLBACK, username, slug, event_type_id,
            _CALDIY_LOCATION_MAP.get(meeting, "attendeePhone"))}

    def kind(self, key: str | None) -> DiaryKind:
        return self.kinds.get(key or KIND_CALLBACK) or self.kinds[KIND_CALLBACK]

    async def free(self, kind: str, *, day: date | None = None,
                   reschedule_uid: str | None = None) -> list[FreeSlot]:
        """Free starts of one kind: one local day, or the whole window when
        `day` is None. `reschedule_uid`: the caller's own booking, which then
        counts as free (moving it onto a nearby time)."""
        if not self.kinds:
            await self.load()
        k = self.kind(kind)
        now = datetime.now(timezone.utc)
        earliest = now + timedelta(hours=self.notice_hours)
        if day is None:
            start, end = earliest, now + timedelta(days=SLOT_WINDOW_DAYS)
        else:
            day_start = datetime.combine(day, time.min, tzinfo=self.tz).astimezone(timezone.utc)
            day_end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=self.tz).astimezone(timezone.utc)
            start, end = max(earliest, day_start), day_end
            if end <= start:
                return []
        api_key, base_url = self.creds
        isos = await get_availability(
            k.event_type_id or 0,
            start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            username=k.username, event_type_slug=k.slug, timezone=self.tz.key,
            booking_uid_to_reschedule=reschedule_uid,
            api_key=api_key, base_url=base_url, raise_on_error=True,
        )
        out = []
        for iso in isos or []:
            try:
                out.append(FreeSlot(_parse_iso(iso).astimezone(self.tz), iso))
            except ValueError:
                continue
        return sorted(out, key=lambda s: s.start)
```

`notice_hours()` stays. In `diary_for_call`, replace `diary.prefetch()` with:

```python
    diary = RealDiary(campaign)
    try:
        await asyncio.wait_for(diary.load(), timeout=3.0)
    except Exception as exc:
        # Retried on the first lookup; the call still answers.
        log.warning("voice.booking.diary_load_failed", account_id=diary.account_id, error=str(exc))
    return mode, diary
```

Do NOT touch `check_availability` / `book_on_phone` yet (they still reference the removed methods; Task 5 moves and rewrites them). The module must still import: run the step below.

- [ ] **Step 4: Run the tests**

Run: `.venv/bin/python -m pytest tests/voice/test_real_diary.py -q && .venv/bin/python -c "import src.automations.voice.real_booking"`
Expected: the new tests PASS and the import works. `tests/voice/test_real_booking.py` booking tests now fail: Task 5 replaces them. Do not restart the engine.

- [ ] **Step 5: Commit**

```bash
git add src/automations/voice/real_booking.py tests/voice/test_real_diary.py
git commit -m "feat(phone-booking): diary kinds and fresh per-day lookups"
```

---

### Task 5: The phone's book tool books by exact start, and moves or replaces

**Files:**
- Create: `/home/gabriel/automations/src/automations/voice/phone_appointments.py`
- Modify: `/home/gabriel/automations/src/automations/voice/real_booking.py` (remove the moved tool code; new detail texts)
- Modify: `/home/gabriel/automations/src/automations/voice/real_diary_slots.py` (remove `asked_time`, `exact_slot`, `offers`, `listing`, `_slot_out`, and the `_resolve_day, _resolve_hour` import)
- Modify: `/home/gabriel/automations/src/automations/voice/booking_tool.py` (`execute_booking` real/message branch)
- Modify: `/home/gabriel/automations/src/automations/voice/event_logger.py` (`check_availability` branch)
- Test: `/home/gabriel/automations/tests/voice/test_phone_appointments.py` (create); `/home/gabriel/automations/tests/voice/test_real_booking.py` (remove the booking and word-matching tests)

**Interfaces:**
- Consumes: Task 1 helpers; Task 2 `skip_recent_guard`; Task 3 `reschedule_lead_booking`; Task 4 `RealDiary.free`, `.kind`, `.creds`, `KIND_CALLBACK`, `MAX_DAYS_AHEAD`.
- Produces (in `phone_appointments.py`):
  - `async def upcoming_booking(lead_id: int | None, account_id: int) -> dict | None` → `{"lead": dict, "uid": str, "start": aware datetime}`
  - `async def check_availability(args: dict, *, diary: RealDiary, lead_id: int | None, language: str) -> dict`
  - `async def book_on_phone(args: dict, *, diary: RealDiary, lead_id: int, phone: str, call_id: str, language: str) -> dict`
  - `async def take_message(args, *, account_id, campaign_id, lead_id, phone, call_id) -> dict` (moved unchanged from real_booking)
  - `_create_callback_task(..., about: str | None = None)` (moved; new optional `about`)
  - Results: `booked` → `{"status": "booked", "slot", "iso", "start", ["replaced"]}`; `moved` → `{"status": "moved", "slot", "iso", "start", "from"}`; `unavailable` → `{"status", "detail", "free_slots": [{"start", "say"}]}`; `pending` / `not_booked` / `too_far` / `day_full` / `no_free_times` / `error` with `detail` where relevant. `book_appointment` args: `{"start": str, "name": str, ["kind": str]}`; `check_availability` args: `{"date": "YYYY-MM-DD" | "", ["kind": str]}`.

- [ ] **Step 1: Add the detail texts to `real_booking.py`**

Replace `DETAIL_UNAVAILABLE` and add the new ones next to it:

```python
DETAIL_UNAVAILABLE = (
    "That time is not free. Offer the caller the free times listed here, and book again "
    "with the `start` of the one they pick. Do not say anything is booked yet."
)
DETAIL_NO_START = (
    "No time was given to book. Call check_availability for the day the caller wants, "
    "then book with the `start` of the time they pick."
)
DETAIL_TOO_FAR = (
    f"The diary does not go that far ahead. Offer a date within the next {MAX_DAYS_AHEAD} days, "
    "or say the team will contact them closer to the time."
)
DETAIL_MOVE_FAILED = (
    "The appointment was NOT moved: the earlier time still stands. Tell the caller the "
    "team will contact them about the new time."
)
```

(`MAX_DAYS_AHEAD` must be defined above these lines.)

- [ ] **Step 2: Write the failing tests** (`tests/voice/test_phone_appointments.py`)

```python
"""The phone's appointment tools on a real diary (phone_appointments.py).
Mocks only: no Cal.diy call, no database, no phone call."""

import asyncio
from contextlib import ExitStack, asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

from src.automations.voice import phone_appointments as pa
from src.automations.voice import real_booking as rb
from src.automations.voice.real_diary_slots import FreeSlot, local_start

AMS = ZoneInfo("Europe/Amsterdam")
CA = {"id": 72, "Accounts_id": 53, "name": "Robben Rosmalen", "account_timezone": "Europe/Amsterdam",
      "meeting_type": "phone_call", "min_booking_notice_hours": 2,
      "calendar_link": "https://cal.leadawaker.com/robben-rosmalen/30min"}
DAY = (datetime.now(AMS) + timedelta(days=3)).date()


def _at(h, mi=0, day=DAY):
    dt = datetime(day.year, day.month, day.day, h, mi, tzinfo=AMS)
    return FreeSlot(dt, dt.isoformat(timespec="milliseconds"))


FREE = [_at(9), _at(10, 30), _at(12), _at(13, 30)]
LEAD = {"id": 501, "first_name": "+31612345678", "last_name": "", "phone": "+31612345678",
        "Campaigns_id": 72, "Accounts_id": 53}


def _diary():
    d = rb.RealDiary(CA)
    d.kinds = {rb.KIND_CALLBACK: rb.DiaryKind(rb.KIND_CALLBACK, "robben-rosmalen", "30min", 10, "attendeePhone")}
    d.creds = ("k", "http://c")
    return d


@asynccontextmanager
async def _null_step(*a, **k):
    class S:
        output = None
    yield S()


def _world(st, *, lead=LEAD, free=FREE, create=None, resched=None):
    async def fake_free(self, kind, *, day=None, reschedule_uid=None):
        return [s for s in free if day is None or s.start.date() == day]
    m = {
        "free": st.enter_context(patch.object(rb.RealDiary, "free", fake_free)),
        "create": st.enter_context(patch(
            "src.automations.conversation.slot_booking.caldiy_create_booking",
            new=create or AsyncMock(return_value={"uid": "u1", "start": "x", "status": "accepted"}))),
        "target": st.enter_context(patch(
            "src.automations.conversation.slot_booking._resolve_booking_target",
            new=AsyncMock(return_value=(CA["calendar_link"], "k", "http://c", 10)))),
        "sb_get": st.enter_context(patch("src.automations.conversation.slot_booking.get_lead",
                                         new=AsyncMock(return_value=lead))),
        "sb_upd": st.enter_context(patch("src.automations.conversation.slot_booking.update_lead_fields",
                                         new=AsyncMock())),
        "get": st.enter_context(patch("tools.db.leads.get_lead", new=AsyncMock(return_value=lead))),
        "upd": st.enter_context(patch("tools.db.leads.update_lead_fields", new=AsyncMock())),
        "status": st.enter_context(patch("tools.db.leads.update_lead_status", new=AsyncMock())),
        "tags": st.enter_context(patch("src.automations.tag_engine.apply_event_tags", new=AsyncMock())),
        "task": st.enter_context(patch("tools.db.tasks.create_task", new=AsyncMock(return_value={}))),
        "rec": st.enter_context(patch("tools.db.voice_calls.record_booking", new=AsyncMock())),
        "resched": st.enter_context(patch(
            "src.automations.conversation.booking_changes.reschedule_lead_booking",
            new=resched or AsyncMock(return_value={"uid": "u2", "new_start": "x", "raw": {}}))),
        "cancel_uid": st.enter_context(patch("tools.caldiy_api.cancel_booking", new=AsyncMock(return_value=True))),
        "kind_of": st.enter_context(patch("tools.caldiy_api.get_booking",
                                          new=AsyncMock(return_value={"eventTypeId": 10}))),
    }
    st.enter_context(patch.object(pa, "AsyncLogStep", _null_step))
    return m


def _book(args, phone="+31612345678"):
    return pa.book_on_phone(args, diary=_diary(), lead_id=501, phone=phone, call_id="c1", language="nl")


def test_books_exactly_the_start_it_was_given():
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(_book({"start": local_start(FREE[1].start), "name": "Sanne de Vries"}))
    assert res["status"] == "booked" and res["start"] == local_start(FREE[1].start)
    kw = m["create"].await_args.kwargs
    assert kw["slot_start"] == FREE[1].iso
    assert kw["attendee_email"] == "leadawaker+lead501@gmail.com"
    assert kw["metadata"] == {"booked_via": "phone", "lead_id": "501", "engine_booked": "1"}
    assert m["upd"].await_args.kwargs == {"first_name": "Sanne", "last_name": "de Vries"}
    assert m["status"].await_args.kwargs == {"conversion_status": "Booked", "automation_status": "completed"}
    m["task"].assert_not_awaited()


def test_a_start_that_is_not_free_offers_that_days_free_times():
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(_book({"start": local_start(_at(11).start)}))
    assert res["status"] == "unavailable"
    assert [s["start"] for s in res["free_slots"]] == [local_start(s.start) for s in FREE]
    m["create"].assert_not_awaited()


def test_spoken_words_are_never_booked():
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(_book({"start": "woensdag half elf"}))
    assert res["status"] == "unavailable" and "check_availability" in res["detail"]
    m["create"].assert_not_awaited()


def test_a_withheld_caller_is_not_booked_and_nothing_is_looked_up():
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(_book({"start": local_start(FREE[0].start)}, phone="withheld"))
    assert res["status"] == "not_booked"
    m["create"].assert_not_awaited()
    m["task"].assert_awaited_once()


def test_cal_diy_failure_never_says_booked_and_creates_a_callback_task():
    with ExitStack() as st:
        m = _world(st, create=AsyncMock(side_effect=RuntimeError("500")))
        res = asyncio.run(_book({"start": local_start(FREE[0].start)}))
    assert res["status"] == "not_booked"
    m["task"].assert_awaited_once()


def _with_booking(start=None, account=53):
    s = start or (datetime.now(timezone.utc) + timedelta(days=1))
    return {**LEAD, "Accounts_id": account, "calcom_booking_uid": "u0", "booked_call_date": s}


def test_a_caller_who_already_has_an_appointment_gets_it_moved():
    with ExitStack() as st:
        m = _world(st, lead=_with_booking())
        res = asyncio.run(_book({"start": local_start(FREE[2].start)}))
    assert res["status"] == "moved" and res["from"]
    assert m["resched"].await_args.args[2] == FREE[2].iso
    assert m["resched"].await_args.kwargs["require_account_key"] is True
    m["create"].assert_not_awaited()


def test_a_refused_move_says_the_old_time_stands():
    with ExitStack() as st:
        m = _world(st, lead=_with_booking(), resched=AsyncMock(return_value=None))
        res = asyncio.run(_book({"start": local_start(FREE[2].start)}))
    assert res["status"] == "not_booked" and "NOT moved" in res["detail"]


def test_a_past_booking_or_another_accounts_lead_is_not_the_callers():
    past = _with_booking(start=datetime.now(timezone.utc) - timedelta(hours=1))
    other = _with_booking(account=99)
    for lead in (past, other):
        with ExitStack() as st:
            _world(st, lead=lead)
            assert asyncio.run(pa.upcoming_booking(501, 53)) is None


def test_check_availability_returns_every_slot_of_the_day():
    with ExitStack() as st:
        _world(st)
        res = asyncio.run(pa.check_availability({"date": DAY.isoformat()}, diary=_diary(),
                                                lead_id=501, language="nl"))
    assert res["status"] == "ok" and len(res["free_slots"]) == 4
    assert set(res["free_slots"][0]) == {"start", "say"}


def test_a_full_or_past_day_offers_the_first_days_with_room():
    for asked in (DAY + timedelta(days=1), date.today() - timedelta(days=1)):
        with ExitStack() as st:
            _world(st)
            res = asyncio.run(pa.check_availability({"date": asked.isoformat()}, diary=_diary(),
                                                    lead_id=501, language="nl"))
        assert res["status"] == "day_full" and len(res["free_slots"]) == 4


def test_a_date_months_out_is_refused_politely():
    far = (datetime.now(AMS) + timedelta(days=rb.MAX_DAYS_AHEAD + 5)).date()
    with ExitStack() as st:
        _world(st)
        res = asyncio.run(pa.check_availability({"date": far.isoformat()}, diary=_diary(),
                                                lead_id=501, language="nl"))
    assert res["status"] == "too_far"
```

Note for `test_a_full_or_past_day_offers_the_first_days_with_room`: the fake `free` returns all of `FREE` for `day=None`, so "first days with room" is the 4 slots of `DAY`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/voice/test_phone_appointments.py -q`
Expected: FAIL with `ModuleNotFoundError: ... phone_appointments`.

- [ ] **Step 4: Create `phone_appointments.py`**

Move `take_message`, `_create`, `_settle_late`, `_update_lead_contact` and `_create_callback_task` out of `real_booking.py` into the new module (cut and paste, then apply the changes shown). The new module:

```python
"""The phone's appointment tools on a client's real calendar: free times,
book (which moves or replaces an appointment the caller already has) and,
from Task 7, cancel. Which calendar and which kinds: real_booking.py.

The backend books by the exact `start` that check_availability handed out.
It works the date out itself from today's date; spoken words are never
parsed here (call 1887, 2026-10-13).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog

from src.automations.automation_logger import AsyncLogStep
from src.automations.voice.real_booking import (
    DETAIL_MOVE_FAILED, DETAIL_NO_SLOTS, DETAIL_NO_START, DETAIL_NOTED, DETAIL_PENDING,
    DETAIL_TOO_FAR, DETAIL_UNAVAILABLE, KIND_CALLBACK, MAX_DAYS_AHEAD, REAL_BOOKING_TIMEOUT_S,
    RealDiary,
)
from src.automations.voice.real_diary_slots import (
    FreeSlot, day_slots, first_days, local_start, match_start, parse_day, parse_start, slot_out, spoken,
)

log = structlog.get_logger()


def _booked_out(slot: FreeSlot, language: str) -> dict:
    return {"slot": spoken(slot.start, language), "iso": slot.start.isoformat(),
            "start": local_start(slot.start)}


async def upcoming_booking(lead_id: int | None, account_id: int) -> dict | None:
    """The caller's own upcoming appointment on this account, else None."""
    if not lead_id:
        return None
    from tools.db.leads import get_lead

    lead = await get_lead(lead_id) or {}
    uid = (lead.get("calcom_booking_uid") or "").strip()
    start = lead.get("booked_call_date")
    if not uid or not isinstance(start, datetime) or lead.get("Accounts_id") != account_id:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if start <= datetime.now(timezone.utc):
        return None
    return {"lead": lead, "uid": uid, "start": start}


async def _same_kind(diary: RealDiary, uid: str, kind: str) -> bool:
    """Is the caller's booking of this kind? One kind on the line: always."""
    if len(diary.kinds) <= 1:
        return True
    from tools import caldiy_api

    booking = await caldiy_api.get_booking(uid, api_key=diary.creds[0], base_url=diary.creds[1]) or {}
    return booking.get("eventTypeId") == diary.kind(kind).event_type_id


async def check_availability(args: dict, *, diary: RealDiary, lead_id: int | None, language: str) -> dict:
    kind = args.get("kind") or KIND_CALLBACK
    day = parse_day(args.get("date"))
    if day and (day - datetime.now(diary.tz).date()).days > MAX_DAYS_AHEAD:
        return {"status": "too_far", "detail": DETAIL_TOO_FAR}
    mine = await upcoming_booking(lead_id, diary.account_id)
    uid = mine["uid"] if mine else None
    try:
        free = await asyncio.wait_for(diary.free(kind, day=day, reschedule_uid=uid), REAL_BOOKING_TIMEOUT_S)
        if day and free:
            return {"status": "ok", "free_slots": [slot_out(s, language) for s in day_slots(free, day)]}
        later = free if not day else await asyncio.wait_for(
            diary.free(kind, reschedule_uid=uid), REAL_BOOKING_TIMEOUT_S)
    except Exception as exc:
        log.warning("voice.booking.availability_failed", account_id=diary.account_id, error=str(exc))
        return {"status": "error", "detail": DETAIL_NOTED}
    if day:
        later = [s for s in later if s.start.date() > day] or later
    if not later:
        return {"status": "no_free_times", "detail": DETAIL_NO_SLOTS}
    shown = [slot_out(s, language) for s in first_days(later)]
    if day:
        return {"status": "day_full", "date": day.isoformat(), "free_slots": shown}
    return {"status": "ok", "free_slots": shown}


async def book_on_phone(args: dict, *, diary: RealDiary, lead_id: int, phone: str,
                        call_id: str, language: str) -> dict:
    """book_appointment on a real diary. Never raises. `booked` and `moved`
    only when Cal.diy confirmed; anything else carries a `detail`."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + REAL_BOOKING_TIMEOUT_S
    kind = args.get("kind") or KIND_CALLBACK
    name = (args.get("name") or "").strip()
    wanted = str(args.get("start") or "").strip()
    ctx = dict(diary=diary, lead_id=lead_id, phone=phone, call_id=call_id, name=name, wanted=wanted)

    from tools.phone_e164 import to_e164

    e164 = to_e164(phone)
    if not e164:
        # Withheld: every withheld caller shares one lead, and Cal.diy books a
        # phone appointment on the caller's number.
        await _create_callback_task(**ctx, why="the caller's number was withheld")
        return {"status": "not_booked", "detail": DETAIL_NOTED}
    want = parse_start(wanted, diary.tz)
    if want is None:
        return {"status": "unavailable", "detail": DETAIL_NO_START}

    mine = await upcoming_booking(lead_id, diary.account_id)
    try:
        free = await asyncio.wait_for(
            diary.free(kind, day=want.date(), reschedule_uid=mine["uid"] if mine else None),
            REAL_BOOKING_TIMEOUT_S)
    except Exception as exc:
        log.warning("voice.booking.availability_failed", account_id=diary.account_id,
                    call_id=call_id, error=str(exc) or type(exc).__name__)
        await _create_callback_task(**ctx, why="the calendar could not be read")
        return {"status": "not_booked", "detail": DETAIL_NOTED}
    chosen = match_start(free, wanted, diary.tz)
    if chosen is None:
        log.info("voice.booking.unavailable", call_id=call_id, asked=want.isoformat())
        alt = free or (await check_availability(
            {"date": want.date().isoformat(), "kind": kind}, diary=diary, lead_id=lead_id, language=language)
        ).get("free_slots", [])
        slots = [slot_out(s, language) for s in alt] if free else alt
        return {"status": "unavailable", "detail": DETAIL_UNAVAILABLE, "free_slots": slots}

    await _update_lead_contact(lead_id, name, e164)
    if mine and await _same_kind(diary, mine["uid"], kind):
        return await _move(diary, mine, chosen, ctx, language, deadline)

    booking = asyncio.create_task(_create(diary, chosen, lead_id, kind))
    try:
        result = await asyncio.wait_for(asyncio.shield(booking), timeout=max(0.1, deadline - loop.time()))
    except asyncio.TimeoutError:
        log.warning("voice.booking.pending", call_id=call_id, lead_id=lead_id, slot=chosen.iso)
        asyncio.create_task(_settle_late(booking, chosen, language=language, **ctx))
        return {"status": "pending", "detail": DETAIL_PENDING}
    except Exception as exc:
        log.warning("voice.booking.create_failed", call_id=call_id, lead_id=lead_id, error=str(exc))
        result = None
    if not result:
        await _create_callback_task(**ctx, why="the calendar did not accept the booking")
        return {"status": "not_booked", "detail": DETAIL_NOTED}
    out = {"status": "booked", **_booked_out(chosen, language)}
    if mine:
        # Another kind of appointment: the earlier one makes way (one per caller).
        # The lead already points at the new uid, so the webhook skips this cancel.
        from tools import caldiy_api

        await caldiy_api.cancel_booking(mine["uid"], reason="Replaced by a new appointment",
                                        api_key=diary.creds[0], base_url=diary.creds[1])
        out["replaced"] = spoken(mine["start"].astimezone(diary.tz), language)
    return out


async def _move(diary: RealDiary, mine: dict, chosen: FreeSlot, ctx: dict,
                language: str, deadline: float) -> dict:
    from src.automations.conversation.booking_changes import reschedule_lead_booking

    loop = asyncio.get_running_loop()
    task = asyncio.create_task(reschedule_lead_booking(
        mine["lead"], diary.campaign_account, chosen.iso, reason="Moved by phone", require_account_key=True))
    try:
        result = await asyncio.wait_for(asyncio.shield(task), timeout=max(0.1, deadline - loop.time()))
    except asyncio.TimeoutError:
        # Not cancelled: the move may already be on Cal.diy's side and settles on its own.
        log.warning("voice.booking.move_pending", call_id=ctx["call_id"], slot=chosen.iso)
        return {"status": "pending", "detail": DETAIL_PENDING}
    if not result:
        await _create_callback_task(**ctx, why="the calendar did not accept the move")
        return {"status": "not_booked", "detail": DETAIL_MOVE_FAILED}
    return {"status": "moved", **_booked_out(chosen, language),
            "from": spoken(mine["start"].astimezone(diary.tz), language)}
```

Changes to the moved functions:
- `_create(diary, slot, lead_id, kind=KIND_CALLBACK)`: call `_create_booking_from_slot(slot_iso=slot.iso, lead=lead, campaign_account=ca, booking_link=ca.get("calendar_link") or "", extra_metadata={"booked_via": "phone"}, skip_recent_guard=True)`. Remove the `already_booked` comment (the guard is skipped). Task 10 adds the kind's event type.
- `_settle_late`: delete the `diary.take(slot)` line.
- `_create_callback_task`: add `about: str | None = None` and use it in the title: `f"Call back {who} ({phone}): {about or ('wants an appointment ' + wanted)}".strip()`.
- `import` of `AsyncLogStep` comes from this module now (tests patch `phone_appointments.AsyncLogStep`).

In `real_booking.py` delete `check_availability`, `book_on_phone`, `take_message` and the `# --- internals` section, and drop the now-unused imports (`asked_time`, `exact_slot`, `listing`, `offers`, `_slot_out`, `spoken`, `AsyncLogStep` if unused). In `real_diary_slots.py` delete `asked_time`, `exact_slot`, `offers`, `listing`, `_slot_out`, `_MAX_OFFERS`, `_MAX_LISTED` and import only `_lang, _speak` from `demo_slot`.

In `booking_tool.execute_booking` replace `from src.automations.voice import real_booking` with `from src.automations.voice import phone_appointments, real_booking` and call `phone_appointments.book_on_phone(...)` / `phone_appointments.take_message(...)` (the `DETAIL_NOTED` reference stays on `real_booking`).

In `event_logger.py`, the `check_availability` branch becomes:

```python
        elif et == EV_FUNCTION_CALL and event.get("name") == "check_availability":
            if self.diary is None:
                return {"tool_output": {"status": "error"}}
            from src.automations.voice.phone_appointments import check_availability

            args = json.loads(event.get("arguments") or "{}")
            return {"tool_output": await check_availability(
                args, diary=self.diary, lead_id=await self.ensure_lead(), language=self.language,
            )}
```

and in `phone_call.handle_tool` change the line `elif name == "check_availability":` / `output = (crm or {}).get("availability") or {"status": "error"}` to:

```python
            elif name in ("check_availability", "cancel_appointment"):
                output = (crm or {}).get("tool_output") or {"status": "error"}
```

(same line count: `phone_call.py` must stay under 500 lines).

In `tests/voice/test_real_booking.py` delete: the `asked_time, exact_slot, listing, offers` import, `test_exact_slot_only_books_the_time_asked`, `test_offers_prefer_the_asked_day_closest_first`, `test_listing_spreads_over_days`, and every test from `test_booked_through_the_chat_path_with_privacy_email_and_phone_marker` through `test_withheld_caller_is_not_booked` (now covered in `test_phone_appointments.py`), plus the `_diary`, `_world`, `ARGS`, `_book` helpers. Keep the mode tests; Task 6 updates the logger and output tests.

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest tests/voice/test_phone_appointments.py tests/voice/test_real_diary.py tests/voice/test_real_diary_slots.py tests/voice/test_real_booking.py tests/voice/test_booking_tool.py tests/voice/test_phone_door.py -q`
Expected: PASS except the two `test_real_booking.py` logger/output tests that Task 6 rewrites (`test_logger_passes_detail_and_free_slots_on_a_real_line`, `test_check_availability_tool_on_a_real_line`), which may fail now. Do not restart the engine.

- [ ] **Step 6: Commit**

```bash
git add src/automations/voice/phone_appointments.py src/automations/voice/real_booking.py src/automations/voice/real_diary_slots.py src/automations/voice/booking_tool.py src/automations/voice/event_logger.py src/automations/voice/phone_call.py tests/voice/test_phone_appointments.py tests/voice/test_real_booking.py
git commit -m "feat(phone-booking): book by exact start; a caller's existing appointment is moved"
```

---

### Task 6: The backend's tools, note and receipts on a real line

**Files:**
- Modify: `/home/gabriel/automations/src/automations/voice/real_booking.py` (schemas, `BACKEND_NOTE`, `add_real_tools`, `existing_appointment_note`; delete `add_availability_tool`)
- Modify: `/home/gabriel/automations/src/webhooks/phone_voice_routes.py:335-336`
- Modify: `/home/gabriel/automations/src/automations/voice/event_logger.py` (`book_appointment` branch)
- Modify: `/home/gabriel/automations/src/automations/voice/booking_tool.py` (`booking_output`)
- Test: `/home/gabriel/automations/tests/voice/test_real_booking.py` (rewrite the last three tests)

**Interfaces:**
- Consumes: Task 5 `upcoming_booking`, result shapes.
- Produces:
  - `AVAILABILITY_TOOL`, `BOOK_TOOL` (dicts, Realtime function format)
  - `def add_real_tools(session: dict, diary: RealDiary, existing: str = "") -> dict`
  - `async def existing_appointment_note(diary: RealDiary, phone: str | None) -> str`
  - Receipt keys added by `CallLogger`: `booking_status`, `start`, `from`, `replaced`.

- [ ] **Step 1: Write the failing tests** (replace `test_logger_passes_detail_and_free_slots_on_a_real_line`, `test_check_availability_tool_on_a_real_line`, `test_booking_output_for_the_model` in `tests/voice/test_real_booking.py`; keep their imports of `CallLogger` / `booking_output` working)

```python
def _session():
    return {"delegation": {"responses": {"instructions": "BASE", "tools": [
        {"type": "function", "name": "book_appointment", "parameters": {"properties": {"preferred_day": {}}}},
        {"type": "function", "name": "end_call", "parameters": {}}]}}}


def _loaded_diary():
    d = rb.RealDiary(CAMPAIGN)
    d.kinds = {rb.KIND_CALLBACK: rb.DiaryKind(rb.KIND_CALLBACK, "robben-rosmalen", "30min", 10, "attendeePhone")}
    return d


def test_real_tools_replace_the_demo_book_schema():
    s = rb.add_real_tools(_session(), _loaded_diary(), existing="\n\nThis caller already has an appointment: X.")
    backend = s["delegation"]["responses"]
    names = [t["name"] for t in backend["tools"]]
    assert names.count("book_appointment") == 1 and "check_availability" in names and "end_call" in names
    book = next(t for t in backend["tools"] if t["name"] == "book_appointment")
    assert set(book["parameters"]["properties"]) == {"start", "name"}
    assert book["parameters"]["required"] == ["start"]
    assert "## Diary" in backend["instructions"] and backend["instructions"].endswith("appointment: X.")
    assert "2 hours ahead" in backend["instructions"]  # CAMPAIGN has no notice set: default 16 is wrong here
```

Note: `CAMPAIGN` in this file has no `min_booking_notice_hours`; add `"min_booking_notice_hours": 2` to it so the last assertion holds (the default is 16).

```python
def test_logger_turns_a_move_into_a_booked_receipt():
    async def run():
        logger = CallLogger(account_id=53, phone="+31612345678", language="nl", booking_mode="real",
                            diary=object(), call_id="c1")
        logger.ensure_lead = AsyncMock(return_value=501)
        logger._receipt = AsyncMock(return_value={"lead_id": 501})
        logger._record = AsyncMock()
        moved = {"status": "moved", "slot": "woensdag half elf", "iso": "2026-10-21T10:30:00+02:00",
                 "start": "2026-10-21T10:30", "from": "dinsdag om negen uur"}
        with patch("src.automations.voice.event_logger.execute_booking", AsyncMock(return_value=moved)):
            return await logger.handle_event({"type": "live.function_call", "name": "book_appointment",
                                              "arguments": json.dumps({"start": "2026-10-21T10:30"})})
    receipt = asyncio.run(run())
    assert receipt["booked_slot"] == "woensdag half elf" and receipt["booking_status"] == "moved"
    assert receipt["from"] == "dinsdag om negen uur"
    out = booking_output(receipt)
    assert out == {"status": "moved", "slot": "woensdag half elf", "iso": "2026-10-21T10:30:00+02:00",
                   "start": "2026-10-21T10:30", "from": "dinsdag om negen uur"}


def test_booking_output_keeps_the_demo_shape():
    assert booking_output({"booked_slot": "Wed 2pm", "booked_iso": "x"}) == {
        "status": "booked", "slot": "Wed 2pm", "iso": "x"}
```

Check the `CallLogger(...)` constructor keywords against `event_logger.py:99-110` before running and adjust the call to match its real signature (keep the attribute values shown). Add `import json` and `from unittest.mock import AsyncMock, patch` if missing.

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/voice/test_real_booking.py -q`
Expected: FAIL (`AttributeError: ... add_real_tools`).

- [ ] **Step 3: Implement the schemas and note in `real_booking.py`**

Replace `BACKEND_NOTE`, `AVAILABILITY_TOOL` and `add_availability_tool` with:

```python
BACKEND_NOTE = """

## Diary
This line books into the business's real calendar.
- Work out the date the caller means from today's date, then call check_availability with it (YYYY-MM-DD). It returns every free time that day, each with a `start` and the words to say.
- Offer only times it returned. To book, call book_appointment with the `start` of the time the caller picked, copied exactly.
- book_appointment answers `booked` or `moved` when it is done. `unavailable` lists free times instead. `pending` and `not_booked` mean it is not booked: say the time is noted and the team will confirm it.
- A caller has one appointment at a time: booking for a caller who already has one moves it, and the answer says from when."""

AVAILABILITY_TOOL = {
    "type": "function",
    "name": "check_availability",
    "description": ("Free appointment times in the business's diary for one day, or the first days "
                    "with room when no date is given. Each free time has a `start` to book with and "
                    "the words to say."),
    "parameters": {
        "type": "object",
        "properties": {
            "date": {"type": "string",
                     "description": "The day the caller means, as YYYY-MM-DD, worked out from today's date. Empty for the first days with room."},
        },
        "required": [],
    },
}

BOOK_TOOL = {
    "type": "function",
    "name": "book_appointment",
    "description": ("Book the time the caller picked. A caller who already has an appointment "
                    "gets it moved to this time."),
    "parameters": {
        "type": "object",
        "properties": {
            "start": {"type": "string",
                      "description": "The `start` of the chosen time, copied exactly from check_availability."},
            "name": {"type": "string", "description": "The caller's name"},
        },
        "required": ["start"],
    },
}


def add_real_tools(session: dict, diary: "RealDiary", existing: str = "") -> dict:
    """The real-diary tools and rules for the backend, in place of the demo's
    word-based book_appointment."""
    backend = session["delegation"]["responses"]
    backend["tools"] = [t for t in backend["tools"] if t.get("name") != "book_appointment"] + [
        AVAILABILITY_TOOL, BOOK_TOOL]
    notice = diary.notice_hours
    backend["instructions"] += BACKEND_NOTE
    if notice:
        backend["instructions"] += (
            f"\nThe diary takes bookings from {notice} hour{'' if notice == 1 else 's'} ahead: "
            "the earliest free time is that far from now.")
    backend["instructions"] += existing
    return session


async def existing_appointment_note(diary: "RealDiary", phone: str | None) -> str:
    """One English line for the backend when this caller already has an
    appointment, so "can I move it" needs no lookup. Never raises."""
    from src.automations.voice.phone_appointments import upcoming_booking
    from tools.db.lead_intake import check_duplicate_phone
    from tools.phone_e164 import to_e164

    e164 = to_e164(phone)
    if not e164:
        return ""
    try:
        row = await check_duplicate_phone(e164, diary.account_id)
        mine = await upcoming_booking(row.get("id") if row else None, diary.account_id)
    except Exception as exc:
        log.warning("voice.booking.existing_lookup_failed", account_id=diary.account_id, error=str(exc))
        return ""
    if not mine:
        return ""
    when = mine["start"].astimezone(diary.tz).strftime("%A %d %B %Y at %H:%M")
    return f"\n\nThis caller already has an appointment: {when}. Booking another time moves it."
```

- [ ] **Step 4: Wire it**

`phone_voice_routes.py` (lines ~335-336):

```python
    if booking_mode == real_booking.MODE_REAL and diary is not None:
        real_booking.add_real_tools(
            session, diary, existing=await real_booking.existing_appointment_note(diary, phone))
```

`event_logger.py`, `book_appointment` branch, replace the `if result.get("status") == "booked":` block with:

```python
            if result.get("status") in ("booked", "moved"):
                moved = result["status"] == "moved"
                receipt = await self._receipt(
                    who=WHO_AI, direction="outbound",
                    content=f"{'Moved to' if moved else 'Booked'}: {result['slot']}", ai=True,
                )
                receipt["booked_slot"] = result["slot"]
                receipt["booked_iso"] = result.get("iso")
                receipt["booking_status"] = result["status"]
                receipt.update({k: result[k] for k in ("start", "from", "replaced") if result.get(k)})
                await self._record(
                    record_booking, booked_slot=result["slot"],
                    booked_iso=result.get("iso"),
                )
                return receipt
```

`booking_tool.booking_output`, first branch:

```python
    if crm and crm.get("booked_slot"):
        # The date itself, so she can check it against what was asked
        # instead of trusting a spoken string.
        return {"status": crm.get("booking_status") or "booked", "slot": crm["booked_slot"],
                **({"iso": crm["booked_iso"]} if crm.get("booked_iso") else {}),
                **{k: crm[k] for k in ("start", "from", "replaced") if crm.get(k)}}
```

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest tests/voice -q -p no:warnings 2>&1 | tail -20`
Expected: the only failures are the 16 pre-existing ones listed in Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add src/automations/voice/real_booking.py src/webhooks/phone_voice_routes.py src/automations/voice/event_logger.py src/automations/voice/booking_tool.py tests/voice/test_real_booking.py
git commit -m "feat(phone-booking): exact-start tools, diary note and moved receipts for the backend"
```

---

## Slice 2: cancel

### Task 7: `cancel_appointment` on the phone

**Files:**
- Modify: `/home/gabriel/automations/src/automations/voice/phone_appointments.py`
- Modify: `/home/gabriel/automations/src/automations/voice/real_booking.py` (`CANCEL_TOOL`, details, note line, `add_real_tools`)
- Modify: `/home/gabriel/automations/src/automations/voice/event_logger.py`
- Modify: `/home/gabriel/automations/tools/db/voice_calls.py:178-180` (type hints `str | None`)
- Test: `/home/gabriel/automations/tests/voice/test_phone_appointments.py`

**Interfaces:**
- Consumes: Task 3 `cancel_lead_booking`, Task 5 `upcoming_booking`, `_create_callback_task(about=...)`.
- Produces: `async def cancel_on_phone(args: dict, *, diary: RealDiary, lead_id: int, phone: str, call_id: str, language: str) -> dict` with statuses `cancelled` (`slot`), `none`, `unknown_caller`, `not_cancelled`.

- [ ] **Step 1: Write the failing tests** (append to `test_phone_appointments.py`)

```python
def _cancel(phone="+31612345678"):
    return pa.cancel_on_phone({"reason": "ziek"}, diary=_diary(), lead_id=501, phone=phone,
                              call_id="c1", language="nl")


def test_a_caller_cancels_their_own_appointment():
    with ExitStack() as st:
        _world(st, lead=_with_booking())
        cancel = st.enter_context(patch(
            "src.automations.conversation.booking_changes.cancel_lead_booking", AsyncMock(return_value=True)))
        res = asyncio.run(_cancel())
    assert res["status"] == "cancelled" and res["slot"]
    assert cancel.await_args.kwargs["require_account_key"] is True
    assert cancel.await_args.kwargs["reason"] == "ziek"


def test_a_withheld_caller_cannot_cancel_and_no_lead_is_read():
    with ExitStack() as st:
        m = _world(st, lead=_with_booking())
        res = asyncio.run(_cancel(phone="withheld"))
    assert res["status"] == "unknown_caller"
    m["get"].assert_not_awaited()


def test_no_appointment_means_none():
    with ExitStack() as st:
        _world(st)
        assert asyncio.run(_cancel())["status"] == "none"


def test_a_refused_cancel_becomes_a_task_for_the_team():
    with ExitStack() as st:
        m = _world(st, lead=_with_booking())
        st.enter_context(patch("src.automations.conversation.booking_changes.cancel_lead_booking",
                               AsyncMock(return_value=False)))
        res = asyncio.run(_cancel())
    assert res["status"] == "not_cancelled"
    m["task"].assert_awaited_once()
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/voice/test_phone_appointments.py -q`
Expected: FAIL (`AttributeError: ... cancel_on_phone`).

- [ ] **Step 3: Implement**

`real_booking.py`, add next to the other details:

```python
DETAIL_UNKNOWN_CALLER = (
    "The caller's number is withheld, so their appointment cannot be found. Offer to pass a "
    "message on to the team."
)
DETAIL_NONE = "No upcoming appointment was found for this caller's number."
DETAIL_NOT_CANCELLED = (
    "The appointment was NOT cancelled. Tell the caller the team will contact them about it."
)

CANCEL_TOOL = {
    "type": "function",
    "name": "cancel_appointment",
    "description": "Cancel the caller's own upcoming appointment, once they have confirmed they want it cancelled.",
    "parameters": {
        "type": "object",
        "properties": {"reason": {"type": "string", "description": "Why, in a few words, if the caller said"}},
        "required": [],
    },
}
```

Append to `BACKEND_NOTE` (inside the string, last line):

```
- cancel_appointment cancels the caller's own upcoming appointment. It answers `cancelled`, `none` (nothing booked on this number) or `unknown_caller` (number withheld: offer to pass a message on).
```

In `add_real_tools` the tool list becomes `[AVAILABILITY_TOOL, BOOK_TOOL, CANCEL_TOOL]`.

`phone_appointments.py`, add (and import the three details):

```python
async def cancel_on_phone(args: dict, *, diary: RealDiary, lead_id: int, phone: str,
                          call_id: str, language: str) -> dict:
    """cancel_appointment: only the caller's own appointment, found by caller ID."""
    from tools.phone_e164 import to_e164

    if not to_e164(phone):
        return {"status": "unknown_caller", "detail": DETAIL_UNKNOWN_CALLER}
    mine = await upcoming_booking(lead_id, diary.account_id)
    if not mine:
        return {"status": "none", "detail": DETAIL_NONE}
    from src.automations.conversation.booking_changes import cancel_lead_booking

    when = spoken(mine["start"].astimezone(diary.tz), language)
    ok = await cancel_lead_booking(mine["lead"], diary.campaign_account,
                                   reason=(args.get("reason") or "Cancelled by phone").strip(),
                                   require_account_key=True)
    if not ok:
        await _create_callback_task(diary=diary, lead_id=lead_id, phone=phone, call_id=call_id,
                                    name="", wanted=when, why="the calendar did not accept the cancellation",
                                    about=f"wants to cancel the appointment of {when}")
        return {"status": "not_cancelled", "detail": DETAIL_NOT_CANCELLED}
    return {"status": "cancelled", "slot": when}
```

`event_logger.py`, add after the `check_availability` branch:

```python
        elif et == EV_FUNCTION_CALL and event.get("name") == "cancel_appointment":
            if self.diary is None:
                return {"tool_output": {"status": "error"}}
            from src.automations.voice.phone_appointments import cancel_on_phone

            args = json.loads(event.get("arguments") or "{}")
            result = await cancel_on_phone(args, diary=self.diary, lead_id=await self.ensure_lead(),
                                           phone=self.phone, call_id=self.call_id or "",
                                           language=self.language)
            if result.get("status") == "cancelled":
                await self._receipt(who=WHO_AI, direction="outbound",
                                    content=f"Cancelled: {result['slot']}", ai=True)
                # A booking made earlier in this call no longer counts as its outcome.
                await self._record(record_booking, booked_slot=None, booked_iso=None)
            return {"tool_output": result}
```

`tools/db/voice_calls.py`: `booked_slot: str | None, booked_iso: str | None`.

- [ ] **Step 4: Run the tests**

Run: `.venv/bin/python -m pytest tests/voice -q -p no:warnings 2>&1 | tail -20`
Expected: only the 16 pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/automations/voice/phone_appointments.py src/automations/voice/real_booking.py src/automations/voice/event_logger.py tools/db/voice_calls.py tests/voice/test_phone_appointments.py
git commit -m "feat(phone-booking): callers cancel their own appointment by phone"
```

- [ ] **Step 6: Restart and live-check slices 1 and 2**

```bash
cd /home/gabriel/automations
grep -E "voice\.phone\.(attached|ended)" ~/.pm2/logs/leadawaker-engine-out.log | tail -2   # last line must be "ended"
./preflight.sh && pm2 restart leadawaker-engine --update-env
pm2 logs leadawaker-engine --lines 20 --nostream | grep -E "engine.starting|scheduler.started|Traceback"
```

Ask Gabriel to call +31738519847 from his own mobile (the probe forces the demo diary) and, in one call: ask for "overmorgen om tien uur dertig" (expect a booking on the right day at 10:30), then "can we make it an hour later" (expect `moved`), then cancel it. After the call check:

```bash
grep -E "voice\.phone\.tool|backend_said|voice\.booking|booking_changes" ~/.pm2/logs/leadawaker-engine-out.log | tail -30
```

Expected: `check_availability` with a `date`, `book_appointment` with a `start`, one `booking_changes.rescheduled`, one `booking_changes.cancelled`; Gabriel's calendar shows the booking moved then gone; the client alert email "cancelled" arrives.

---

## Slice 3: visits

### Task 8: Columns for visits

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/scripts/add-visit-columns.mjs` (run once, then delete)
- Modify: `/home/gabriel/LeadAwakerApp/shared/schema.ts` (accounts near line 57; calendarConnections near line 1845)
- Modify: `/home/gabriel/automations/tools/db/campaigns.py:50` (account columns in `get_campaign_with_account`)

**Interfaces:**
- Produces: `Accounts.visits_enabled boolean NOT NULL DEFAULT false`, `visit_title text`, `visit_duration_minutes integer NOT NULL DEFAULT 60`, `visit_address text`; `Calendar_Connections.caldiy_visit_event_type_id integer`, `caldiy_visit_event_type_slug text`. Drizzle names: `visitsEnabled`, `visitTitle`, `visitDurationMinutes`, `visitAddress`, `caldiyVisitEventTypeId`, `caldiyVisitEventTypeSlug`. The engine's campaign dict gains `visits_enabled`, `visit_title`, `visit_duration_minutes`, `visit_address`.

- [ ] **Step 1: Write and run the migration**

```js
// Visits (specs/phone-booking-v2): an in-person appointment type per account,
// and the Cal.diy event type provisioning makes for it. Run once:
//   node --env-file=.env scripts/add-visit-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

const sql = `
ALTER TABLE "${SCHEMA}"."Accounts"
  ADD COLUMN IF NOT EXISTS "visits_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "visit_title" text,
  ADD COLUMN IF NOT EXISTS "visit_duration_minutes" integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "visit_address" text;
ALTER TABLE "${SCHEMA}"."Calendar_Connections"
  ADD COLUMN IF NOT EXISTS "caldiy_visit_event_type_id" integer,
  ADD COLUMN IF NOT EXISTS "caldiy_visit_event_type_slug" text;
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = $1 AND (column_name LIKE 'visit%' OR column_name LIKE 'caldiy_visit%')
     ORDER BY table_name, column_name`,
    [SCHEMA],
  );
  console.log("✅ visit columns:", rows.map((r) => `${r.table_name}.${r.column_name}`).join(", "));
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
```

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env scripts/add-visit-columns.mjs && rm scripts/add-visit-columns.mjs`
Expected: `✅ visit columns: Accounts.visit_address, Accounts.visit_duration_minutes, Accounts.visit_title, Accounts.visits_enabled, Calendar_Connections.caldiy_visit_event_type_id, Calendar_Connections.caldiy_visit_event_type_slug`

- [ ] **Step 2: Drizzle schema**

In `accounts` after `defaultCallDurationMinutes`:

```ts
  // Visits (specs/phone-booking-v2): an in-person appointment at the business,
  // its own Cal.diy event type ("visit"), offered by the phone receptionist.
  visitsEnabled: boolean("visits_enabled").notNull().default(false),
  visitTitle: text("visit_title"),
  visitDurationMinutes: integer("visit_duration_minutes").notNull().default(60),
  visitAddress: text("visit_address"),
```

In `calendarConnections` after `caldiyEventTypeSlug`:

```ts
  // caldiy: the account's "visit" event type, when visits are on (provisioning).
  caldiyVisitEventTypeId: integer("caldiy_visit_event_type_id"),
  caldiyVisitEventTypeSlug: text("caldiy_visit_event_type_slug"),
```

Check `boolean` is imported at the top of `shared/schema.ts` (`grep -n "boolean," shared/schema.ts | head -2`).

- [ ] **Step 3: Engine query**

In `tools/db/campaigns.py`, after `f'a.min_booking_notice_hours, '` add:

```python
            f'a.visits_enabled, a.visit_title, a.visit_duration_minutes, a.visit_address, '
```

- [ ] **Step 4: Verify**

Run: `cd /home/gabriel/automations && .venv/bin/python -c "
import asyncio
from src.config import settings
from tools.db.connection import init_pool, close_pool
from tools.db.campaigns import get_campaign_with_account
async def m():
    await init_pool(settings.dsn, min_size=1, max_size=1)
    c = await get_campaign_with_account(72)
    print({k: c[k] for k in ('visits_enabled','visit_title','visit_duration_minutes','visit_address')})
    await close_pool()
asyncio.run(m())"`
Expected: `{'visits_enabled': False, 'visit_title': None, 'visit_duration_minutes': 60, 'visit_address': None}`. Check `pm2 logs leadawaker --lines 20 --nostream` shows the CRM reloaded without errors.

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/LeadAwakerApp && git add shared/schema.ts && git commit -m "feat(visits): account visit settings and the visit event type columns"
cd /home/gabriel/automations && git add tools/db/campaigns.py && git commit -m "feat(visits): visit settings on the campaign+account row"
```

---

### Task 9: Cal.diy provisions the visit event type; the CRM passes and stores it

**Files:**
- Modify: `/home/gabriel/caldiy/scripts/provision-leadawaker-user.ts` (env at ~51-69, location loop ~177-190, webhook ~192-208, output ~212-220). Do not commit in this repo.
- Modify: `/home/gabriel/LeadAwakerApp/server/calendar/caldiy.ts:40-105`
- Modify: `/home/gabriel/LeadAwakerApp/server/routes/calendar.ts:327-334`
- Modify: `/home/gabriel/LeadAwakerApp/server/routes/accounts.ts:133-136`

**Interfaces:**
- Consumes: Task 8 columns.
- Produces: env `LA_VISITS_ENABLED` ("1"/"0"), `LA_VISIT_TITLE`, `LA_VISIT_MINUTES`, `LA_VISIT_ADDRESS`; script output JSON adds `visitEventTypeId: number | null`, `visitEventTypeSlug: "visit" | null`; credentials endpoint JSON adds `visitEventTypeId`, `visitEventTypeSlug`.

- [ ] **Step 1: The script**

After `const eventTypeTitle = ...` add:

```ts
  // Visits (LeadAwaker specs/phone-booking-v2): an in-person appointment at the
  // business, its own event type so it has its own length and location. Same
  // user, so the same schedule (free hours) as the call.
  const visitsEnabled = process.env.LA_VISITS_ENABLED === "1";
  const visitTitle = process.env.LA_VISIT_TITLE || "Visit";
  const visitMinutes = Number(process.env.LA_VISIT_MINUTES) || 60;
  const visitAddress = process.env.LA_VISIT_ADDRESS || "";
```

Change the location loop's query so the visit keeps its address:

```ts
  const allEventTypes = await prisma.eventType.findMany({
    where: { users: { some: { id: user.id } }, slug: { not: "visit" } },
    select: { id: true, slug: true },
  });
```

After that loop, before the webhook block, add:

```ts
  const primary = await prisma.eventType.findUnique({
    where: { id: eventType.id },
    select: { minimumBookingNotice: true },
  });
  let visit = await prisma.eventType.findFirst({
    where: { slug: "visit", users: { some: { id: user.id } } },
    select: { id: true },
  });
  if (visitsEnabled) {
    const visitData = {
      title: visitTitle,
      length: visitMinutes,
      hidden: false,
      locations: visitAddress ? [{ type: "inPerson", address: visitAddress }] : [],
      minimumBookingNotice: primary?.minimumBookingNotice ?? 120,
    };
    visit = visit
      ? await prisma.eventType.update({ where: { id: visit.id }, data: visitData, select: { id: true } })
      : await prisma.eventType.create({
          data: {
            ...visitData,
            slug: "visit",
            timeZone,
            userId: user.id,
            users: { connect: { id: user.id } },
            metadata: { disableStandardEmails: { confirmation: { host: true, attendee: false } } },
          },
          select: { id: true },
        });
    console.error(`[provision] visit event type ${visit.id}: ${visitTitle}, ${visitMinutes}min`);
  } else if (visit) {
    await prisma.eventType.update({ where: { id: visit.id }, data: { hidden: true } });
    console.error(`[provision] visit event type ${visit.id} hidden (visits off)`);
  }
```

Replace the single-webhook block so both event types report bookings:

```ts
  for (const eventTypeId of [eventType.id, ...(visitsEnabled && visit ? [visit.id] : [])]) {
    const existingWebhook = await prisma.webhook.findFirst({
      where: { eventTypeId, subscriberUrl: webhookUrl },
    });
    if (!existingWebhook) {
      await prisma.webhook.create({
        data: {
          id: uuid(),
          eventTypeId,
          subscriberUrl: webhookUrl,
          active: true,
          eventTriggers: [
            WebhookTriggerEvents.BOOKING_CREATED,
            WebhookTriggerEvents.BOOKING_CANCELLED,
            WebhookTriggerEvents.BOOKING_RESCHEDULED,
          ],
        },
      });
      console.error(`[provision] created webhook for event type ${eventTypeId}`);
    }
  }
```

(Keep whatever else the original webhook block did after creation, for example an `else` that updates an existing webhook, inside the loop.) Add to the output JSON:

```ts
      visitEventTypeId: visitsEnabled && visit ? visit.id : null,
      visitEventTypeSlug: visitsEnabled && visit ? "visit" : null,
```

- [ ] **Step 2: The CRM passes and stores it**

`server/calendar/caldiy.ts`: in `CaldiyCredentials` add `visitEventTypeId?: number | null; visitEventTypeSlug?: string | null;`. In the `env` object add:

```ts
          LA_VISITS_ENABLED: (account as any).visitsEnabled ? "1" : "0",
          LA_VISIT_TITLE: (account as any).visitTitle || "",
          LA_VISIT_MINUTES: String((account as any).visitDurationMinutes || 60),
          LA_VISIT_ADDRESS: (account as any).visitAddress || "",
```

In `upsertCalendarConnection(...)` add:

```ts
      caldiyVisitEventTypeId: creds.visitEventTypeId ?? null,
      caldiyVisitEventTypeSlug: creds.visitEventTypeSlug ?? null,
```

`server/routes/calendar.ts` credentials response adds:

```ts
      visitEventTypeId: conn.caldiyVisitEventTypeId ?? null,
      visitEventTypeSlug: conn.caldiyVisitEventTypeSlug ?? null,
```

`server/routes/accounts.ts` re-provision condition:

```ts
    if ("meetingType" in parsed.data || "callingNumber" in parsed.data || "defaultCallDurationMinutes" in parsed.data
        || "visitsEnabled" in parsed.data || "visitTitle" in parsed.data
        || "visitDurationMinutes" in parsed.data || "visitAddress" in parsed.data) {
```

- [ ] **Step 3: Verify on Gabriel's account 1 first (not Robben)**

Note account 1's current state first: `scratch q.sh -c 'select visits_enabled from "Accounts" where id=1'`. Then, logged in as the test admin (memory `reference_app_admin_login`), `PATCH /api/accounts/1` with `{"visits_enabled": true, "visit_title": "Test visit", "visit_duration_minutes": 60, "visit_address": "Teststraat 1, Den Bosch"}`, wait 20 s, and check:

```bash
grep -n "\[provision\]" ~/.pm2/logs/leadawaker-out.log | tail -6
```
Expected: a `visit event type <id>: Test visit, 60min` line and `created webhook for event type <id>`; `Calendar_Connections` for account 1 has `caldiy_visit_event_type_id` set; GET `https://cal.leadawaker.com/<account 1 username>/visit` shows a 60-minute event at Teststraat 1. Then PATCH `visits_enabled: false` and confirm the `hidden (visits off)` line. Also confirm the existing `30min` type still shows "Phone call" (the location loop skipped only `visit`).

- [ ] **Step 4: Commit (CRM only)**

```bash
cd /home/gabriel/LeadAwakerApp
git add server/calendar/caldiy.ts server/routes/calendar.ts server/routes/accounts.ts
git commit -m "feat(visits): provision the visit event type and hand it to the engine"
```

---

### Task 10: The engine books visits

**Files:**
- Modify: `/home/gabriel/automations/tools/caldiy_api.py:85-131` (credentials cache keeps the whole answer; new `resolve_visit_event_type`)
- Modify: `/home/gabriel/automations/src/automations/voice/real_booking.py` (`RealDiary.load`, `add_real_tools`)
- Modify: `/home/gabriel/automations/src/automations/voice/phone_appointments.py` (`_create` passes the kind)
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py` (`_create_booking_from_slot` overrides)
- Test: `/home/gabriel/automations/tests/voice/test_real_diary.py`, `tests/voice/test_phone_appointments.py`, `tests/voice/test_real_booking.py`

**Interfaces:**
- Consumes: Task 8/9 data.
- Produces:
  - `async def resolve_visit_event_type(account_id: int | None) -> tuple[int | None, str | None]`
  - `_create_booking_from_slot(..., *, skip_recent_guard=False, event_type_id: int | None = None, location: str | None = None)`
  - `RealDiary.kinds` holds `KIND_VISIT` when `visits_enabled` and provisioning returned an id.
  - `add_real_tools` adds a `kind` enum to both tools when the diary has two kinds.

- [ ] **Step 1: Write the failing tests**

In `test_real_diary.py`:

```python
def test_load_adds_the_visit_kind_when_visits_are_on():
    d = rb.RealDiary({**CA, "visits_enabled": True})
    with patch(TARGET, AsyncMock(return_value=(CA["calendar_link_override"], "k", "http://c", 10))), \
         patch("tools.caldiy_api.resolve_visit_event_type", AsyncMock(return_value=(11, "visit"))):
        asyncio.run(d.load())
    v = d.kinds[rb.KIND_VISIT]
    assert (v.slug, v.event_type_id, v.location) == ("visit", 11, "")


def test_no_visit_kind_when_visits_are_off_or_not_provisioned():
    for ca, visit in (({**CA, "visits_enabled": False}, (11, "visit")), ({**CA, "visits_enabled": True}, (None, None))):
        d = rb.RealDiary(ca)
        with patch(TARGET, AsyncMock(return_value=(CA["calendar_link_override"], "k", "http://c", 10))), \
             patch("tools.caldiy_api.resolve_visit_event_type", AsyncMock(return_value=visit)):
            asyncio.run(d.load())
        assert set(d.kinds) == {rb.KIND_CALLBACK}
```

In `test_real_booking.py`:

```python
def test_two_kinds_put_a_kind_choice_on_both_tools():
    d = _loaded_diary()
    d.kinds[rb.KIND_VISIT] = rb.DiaryKind(rb.KIND_VISIT, "robben-rosmalen", "visit", 11, "")
    d.campaign_account = {**CAMPAIGN, "visit_title": "Bezichtiging of proefrit", "visit_duration_minutes": 60,
                          "visit_address": "Afrikalaan 17a, 's-Hertogenbosch"}
    backend = rb.add_real_tools(_session(), d)["delegation"]["responses"]
    for name in ("check_availability", "book_appointment"):
        tool = next(t for t in backend["tools"] if t["name"] == name)
        assert tool["parameters"]["properties"]["kind"]["enum"] == ["callback", "visit"]
    assert "Bezichtiging of proefrit" in backend["instructions"] and "Afrikalaan 17a" in backend["instructions"]
    assert "kind" not in rb.BOOK_TOOL["parameters"]["properties"]  # the shared schema is not mutated
```

In `test_phone_appointments.py`:

```python
def test_a_visit_books_on_the_visit_event_type_without_a_phone_location():
    d = _diary()
    d.kinds[rb.KIND_VISIT] = rb.DiaryKind(rb.KIND_VISIT, "robben-rosmalen", "visit", 11, "")
    with ExitStack() as st:
        m = _world(st)
        res = asyncio.run(pa.book_on_phone({"start": local_start(FREE[0].start), "kind": "visit"},
                                           diary=d, lead_id=501, phone="+31612345678",
                                           call_id="c1", language="nl"))
    assert res["status"] == "booked"
    kw = m["create"].await_args.kwargs
    assert kw["event_type_id"] == 11 and kw["location"] == ""


def test_a_visit_replaces_an_existing_callback():
    d = _diary()
    d.kinds[rb.KIND_VISIT] = rb.DiaryKind(rb.KIND_VISIT, "robben-rosmalen", "visit", 11, "")
    with ExitStack() as st:
        m = _world(st, lead=_with_booking())  # get_booking says eventTypeId 10: a callback
        res = asyncio.run(pa.book_on_phone({"start": local_start(FREE[0].start), "kind": "visit"},
                                           diary=d, lead_id=501, phone="+31612345678",
                                           call_id="c1", language="nl"))
    assert res["status"] == "booked" and res["replaced"]
    m["cancel_uid"].assert_awaited_once()
    m["resched"].assert_not_awaited()
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/voice/test_real_diary.py tests/voice/test_real_booking.py tests/voice/test_phone_appointments.py -q`
Expected: FAIL (`resolve_visit_event_type` missing; no `kind` enum; `event_type_id` not passed).

- [ ] **Step 3: `caldiy_api.py`**

Before changing, run `grep -rn "_ACCOUNT_CREDS_CACHE" tests src tools` and update any test that seeds the cache with a tuple to seed the dict shape below. Replace `resolve_account_credentials` with:

```python
async def _account_credentials(account_id: int) -> dict:
    """The CRM's answer for one account, cached 60 s: {} when not provisioned."""
    cached = _ACCOUNT_CREDS_CACHE.get(account_id)
    if cached is not MISSING:
        return cached
    data: dict = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.crm_base_url}/api/calendar/caldiy-engine-credentials",
                params={"accountId": account_id},
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            resp.raise_for_status()
            data = resp.json() or {}
    except Exception as exc:
        log.warning("caldiy_api.resolve_account_credentials.failed", account_id=account_id, error=str(exc))
    _ACCOUNT_CREDS_CACHE.set(account_id, data)
    return data


async def resolve_account_credentials(
    account_id: int | None,
) -> tuple[str | None, str | None, int | None, str | None]:
    """(api_key, base_url, event_type_id, event_type_slug) for an account's
    self-hosted Cal.diy user, or all-None when not provisioned (callers fall
    back to the shared cal.com Cloud key). The event type is the account's
    default ("30min"); use it only when the campaign's calendar_link slug
    matches event_type_slug."""
    if not account_id:
        return None, None, None, None
    d = await _account_credentials(account_id)
    return d.get("apiKey"), d.get("baseUrl"), d.get("eventTypeId"), d.get("eventTypeSlug")


async def resolve_visit_event_type(account_id: int | None) -> tuple[int | None, str | None]:
    """The account's "visit" event type (specs/phone-booking-v2), when visits are on."""
    if not account_id:
        return None, None
    d = await _account_credentials(account_id)
    return d.get("visitEventTypeId"), d.get("visitEventTypeSlug")
```

- [ ] **Step 4: `slot_booking._create_booking_from_slot` overrides**

Signature gains `event_type_id: int | None = None, location: str | None = None` after `skip_recent_guard`. Rename the internal variable to avoid the clash:

```python
    resolved_id = event_type_id or resolved_event_type_id
    event_type_id = resolved_id or await caldiy_get_event_type_id(
        username, event_type_slug, api_key=cal_api_key, base_url=cal_base_url
    )
```

(`resolved_event_type_id` is the fourth value `_resolve_booking_target` returns; read lines ~894-915 and adapt the names exactly.) For the location, after the `_CALDIY_LOCATION_MAP` lookup:

```python
    if location is not None:
        # The phone's visit: "" leaves the event type's own location (the address).
        location_value = location
```

and pass `location=location_value` (initialise `location_value` from the mapped value before the `if`) to `caldiy_create_booking`. Keep the existing log of unknown meeting types.

- [ ] **Step 5: `RealDiary.load` and `add_real_tools`**

At the end of `load()`:

```python
        if self.campaign_account.get("visits_enabled"):
            from tools.caldiy_api import resolve_visit_event_type

            visit_id, visit_slug = await resolve_visit_event_type(self.account_id)
            if visit_id and visit_slug:
                self.kinds[KIND_VISIT] = DiaryKind(KIND_VISIT, username, visit_slug, visit_id, "")
```

In `add_real_tools`, replace the tool-list line with:

```python
    tools = [AVAILABILITY_TOOL, BOOK_TOOL, CANCEL_TOOL]
    if KIND_VISIT in diary.kinds:
        tools = [_with_kind(AVAILABILITY_TOOL), _with_kind(BOOK_TOOL), CANCEL_TOOL]
    backend["tools"] = [t for t in backend["tools"] if t.get("name") != "book_appointment"] + tools
```

and after the notice lines:

```python
    if KIND_VISIT in diary.kinds:
        ca = diary.campaign_account
        title = (ca.get("visit_title") or "a visit").strip()
        where = (ca.get("visit_address") or "").strip()
        minutes = ca.get("visit_duration_minutes") or 60
        backend["instructions"] += (
            f"\nTwo kinds of appointment, passed as `kind`: `callback` (the team rings the caller back) "
            f"and `visit` ({title}, in person{' at ' + where if where else ''}, {minutes} minutes). "
            "Choose `visit` when the caller wants to come and see or try something, `callback` "
            "when they want to talk it through by phone.")
```

with the helper:

```python
def _with_kind(tool: dict) -> dict:
    """A copy of a tool schema with the appointment kind to choose."""
    params = tool["parameters"]
    return {**tool, "parameters": {**params, "properties": {
        **params["properties"],
        "kind": {"type": "string", "enum": [KIND_CALLBACK, KIND_VISIT],
                 "description": "callback: the team calls them; visit: they come in person"},
    }}}
```

- [ ] **Step 6: `phone_appointments._create` passes the kind**

```python
async def _create(diary: RealDiary, slot: FreeSlot, lead_id: int, kind: str = KIND_CALLBACK) -> dict | None:
    ...
        k = diary.kind(kind)
        result = await _create_booking_from_slot(
            slot_iso=slot.iso, lead=lead, campaign_account=ca,
            booking_link=ca.get("calendar_link") or "",
            extra_metadata={"booked_via": "phone"},
            skip_recent_guard=True,
            event_type_id=k.event_type_id,
            location=k.location if kind == KIND_VISIT else None,
        )
```

- [ ] **Step 7: Run the tests**

Run: `.venv/bin/python -m pytest tests -q -p no:warnings 2>&1 | tail -25`
Expected: no failures beyond the pre-existing ones in Global Constraints (compare the failing list with a run from before this task).

- [ ] **Step 8: Commit**

```bash
git add tools/caldiy_api.py src/automations/voice/real_booking.py src/automations/voice/phone_appointments.py src/automations/conversation/slot_booking.py tests/voice/test_real_diary.py tests/voice/test_real_booking.py tests/voice/test_phone_appointments.py
git commit -m "feat(visits): the phone books a visit or a callback by what the caller wants"
```

---

### Task 11: Visits card in the CRM

**Files:**
- Create: `/home/gabriel/LeadAwakerApp/client/src/features/accounts/components/workspace/VisitsCard.tsx`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/accounts/components/workspace/IntegrationsPanel.tsx:94-101` (render after `MeetingTypeCard`)
- Modify: `/home/gabriel/LeadAwakerApp/client/src/locales/{en,nl,pt}/accounts.json` (new `visits` block after `meetingType`)

**Interfaces:**
- Consumes: `PATCH /api/accounts/:id` with snake_case keys `visits_enabled`, `visit_title`, `visit_duration_minutes`, `visit_address` (same as `MeetingTypeCard`'s `meeting_type`); re-provision is triggered server-side (Task 9).

- [ ] **Step 1: The component** (follow `MeetingTypeCard.tsx` exactly for atoms, spacing and save feedback)

```tsx
// Visits: an in-person appointment (viewing, test drive, consultation) the
// phone receptionist can book besides the call (specs/phone-booking-v2).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";

const LENGTHS = [30, 45, 60, 90, 120];

interface Props {
  accountId: number;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
  color: "var(--mute-2)", marginBottom: 6,
};

export function VisitsCard({ accountId }: Props) {
  const { t } = useTranslation("accounts");
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState({ title: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEnabled(Boolean(data.visits_enabled));
        setTitle(data.visit_title ?? "");
        setMinutes(data.visit_duration_minutes ?? 60);
        setAddress(data.visit_address ?? "");
        setSaved({ title: data.visit_title ?? "", address: data.visit_address ?? "" });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accountId]);

  async function persist(body: Record<string, string | number | boolean | null>) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err: any) {
      setError(err?.message || t("visits.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function onBlurText(field: "title" | "address") {
    const value = (field === "title" ? title : address).trim();
    if (value === saved[field]) return;
    setSaved((s) => ({ ...s, [field]: value }));
    void persist({ [field === "title" ? "visit_title" : "visit_address"]: value || null });
  }

  return (
    <IntegSection>
      <SectionHead>
        <IconTile><MapPin size={14} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("visits.title")}</span>
        {saving ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : justSaved ? (
          <Check size={14} style={{ color: "var(--good)" }} />
        ) : null}
      </SectionHead>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)" }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => { setEnabled(e.target.checked); void persist({ visits_enabled: e.target.checked }); }}
        />
        {t("visits.enable")}
      </label>
      <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>{t("visits.hint")}</div>

      {enabled && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.name")}</div>
            <input className="neu-input" style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
              value={title} disabled={saving} placeholder={t("visits.namePlaceholder")}
              onChange={(e) => setTitle(e.target.value)} onBlur={() => onBlurText("title")} />
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.length")}</div>
            <select className="neu-input" style={{ fontSize: 13, padding: "9px 11px", width: "100%" }}
              value={minutes} disabled={saving}
              onChange={(e) => { const v = Number(e.target.value); setMinutes(v); void persist({ visit_duration_minutes: v }); }}>
              {LENGTHS.map((m) => <option key={m} value={m}>{t("visits.minutes", { count: m })}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>{t("visits.address")}</div>
            <input className="neu-input" style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
              value={address} disabled={saving} placeholder={t("visits.addressPlaceholder")}
              onChange={(e) => setAddress(e.target.value)} onBlur={() => onBlurText("address")} />
            {!address.trim() && (
              <div style={{ fontSize: 11.5, color: "var(--wine)", marginTop: 5 }}>{t("visits.addressNeeded")}</div>
            )}
          </div>
        </>
      )}

      {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{error}</div>}
    </IntegSection>
  );
}
```

If `GET /api/accounts/:id` returns camelCase keys rather than snake_case (check `MeetingTypeCard`'s reader: it reads `data.meeting_type`, so snake_case), keep snake_case.

- [ ] **Step 2: Place it** in `IntegrationsPanel.tsx`, inside the same `!readOnly` block after `MeetingTypeCard`, in its own card wrapper like the one around `MeetingTypeCard`:

```tsx
          <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)" }}>
            <VisitsCard accountId={accountId} />
          </div>
```

with `import { VisitsCard } from "./VisitsCard";`.

- [ ] **Step 3: Copy** (add a `visits` block after `meetingType` in each locale)

`en/accounts.json`:
```json
  "visits": {
    "title": "Visits",
    "enable": "Callers can book a visit",
    "hint": "An in-person appointment at your place, such as a viewing or a test drive. The receptionist books it when a caller wants to come by, and a call when they want to talk by phone.",
    "name": "Name of the visit",
    "namePlaceholder": "Viewing or test drive",
    "length": "Length",
    "minutes": "{{count}} minutes",
    "address": "Address",
    "addressPlaceholder": "Street 1, 1234 AB City",
    "addressNeeded": "Add the address, so the booking confirmation shows where to go.",
    "saveFailed": "Save failed"
  },
```

`nl/accounts.json`:
```json
  "visits": {
    "title": "Bezoeken",
    "enable": "Bellers kunnen een bezoek inplannen",
    "hint": "Een afspraak bij jou op locatie, zoals een bezichtiging of proefrit. De receptionist plant die in als een beller langs wil komen, en een belafspraak als iemand liever telefonisch praat.",
    "name": "Naam van het bezoek",
    "namePlaceholder": "Bezichtiging of proefrit",
    "length": "Duur",
    "minutes": "{{count}} minuten",
    "address": "Adres",
    "addressPlaceholder": "Straat 1, 1234 AB Plaats",
    "addressNeeded": "Vul het adres in, zodat de bevestiging laat zien waar het is.",
    "saveFailed": "Opslaan mislukt"
  },
```

`pt/accounts.json` (Brazilian Portuguese):
```json
  "visits": {
    "title": "Visitas",
    "enable": "Quem liga pode marcar uma visita",
    "hint": "Um horário presencial no seu local, como uma visita ou um test drive. A recepcionista marca a visita quando a pessoa quer vir pessoalmente, e uma ligação quando ela prefere conversar por telefone.",
    "name": "Nome da visita",
    "namePlaceholder": "Visita ou test drive",
    "length": "Duração",
    "minutes": "{{count}} minutos",
    "address": "Endereço",
    "addressPlaceholder": "Rua 1, Cidade",
    "addressNeeded": "Informe o endereço, para a confirmação mostrar aonde ir.",
    "saveFailed": "Falha ao salvar"
  },
```

- [ ] **Step 4: Verify in a browser**

With playwright (memory: close the browser afterwards), open the Integrations tab of account 1, switch visits on, fill name, length and address, reload and confirm the values stuck; take a screenshot in light and dark mode at 1440 and 390 px widths and check nothing is cut off. Switch visits back off for account 1 afterwards. `pm2 logs leadawaker --lines 20 --nostream` shows no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/accounts/components/workspace/VisitsCard.tsx client/src/features/accounts/components/workspace/IntegrationsPanel.tsx client/src/locales/en/accounts.json client/src/locales/nl/accounts.json client/src/locales/pt/accounts.json
git commit -m "feat(visits): Visits card on the account's Integrations tab"
```

---

### Task 12: Robben goes live on visits

**Files:** none (data and a live check).

- [ ] **Step 1: Restart the engine** (same checks as Task 7 Step 6).
- [ ] **Step 2: Robben's settings:** in the CRM, account 53, Integrations tab, Visits: on, name "Bezichtiging of proefrit", 60 minutes, address "Afrikalaan 17a, 5232 BD 's-Hertogenbosch". Confirm `Calendar_Connections.caldiy_visit_event_type_id` is set for account 53 and `https://cal.leadawaker.com/robben-rosmalen/visit` shows a 60-minute event at that address.
- [ ] **Step 3: Live call (Gabriel, from his own mobile):** ask to come and see the Defender on a weekday morning (expect `kind: visit`, a 60-minute booking at the showroom address in Gabriel's calendar); then ask to be called instead (expect the visit replaced by a callback and her saying so). Check the logs as in Task 7 and that the client alert emails name the right appointment.
- [ ] **Step 4: Clean up** the test bookings in Gabriel's calendar and record the outcome in memory (`project_robben_test_call_fixes_2026_10_13.md` or a new note for this feature).
