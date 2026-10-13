# Home Receptionist Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sample-data Home page with a real Receptionist dashboard (Overview, Phone, WhatsApp, Website, Reactivation) that clients and the agency both land on.

**Architecture:** The Python engine stamps every message with its real channel (`Interactions.channel`) and every booking with the channel that made it (`Leads.booking_channel`); a backfill classifies old rows. The CRM adds one read-only summary endpoint per tab, counted in SQL and scoped by the same access rule as the Voice Calls page. The Home page becomes a tab shell that lazy-loads one panel per service, each opening with a noir banner.

**Tech Stack:** Python 3 + asyncpg + pytest (engine, `/home/gabriel/automations`). Express + Drizzle `sql` + `node:test` via tsx (CRM server). React + wouter + react-query + recharts + react-i18next (client). OpenAI image API for the five illustrations.

**Spec:** `specs/home-dashboard/requirements.md`. Design references: `specs/home-dashboard/reference/chatgpt-round-1.webp`, `chatgpt-round-2.webp`.

## Global Constraints

- **Never run `tsc`.** Not after edits, not before finishing. Only when Gabriel asks.
- **The app runs under pm2.** Never `npm run dev`. The CRM server reloads on save (5 to 8 seconds). Check with `pm2 logs leadawaker --lines 20 --nostream --err`.
- **The engine does not hot-reload.** Nothing in Part A is live until `./preflight.sh && pm2 restart leadawaker-engine --update-env`, and that restart needs Gabriel's go-ahead and the go-live order in `specs/receptionist-channels/action-required.md` ("Going live").
- **Commits only when Gabriel says so.** Both repos hold a lot of unrelated uncommitted work (the engine has 112 dirty entries on `feature/dbr-scoping-mode`). Do not commit, stash, reset or reformat anything. Each task lists its files so they can be staged by path later.
- **Schema changes are raw SQL scripts,** never `npm run db:push` (it needs a TTY). Engine-owned columns are migrated from the engine repo and then declared by hand in `shared/schema.ts`.
- **Table and column casing:** schema `p2mxx34fvbf3ll6`. `Interactions`, `Leads`, `Campaigns`, `Widget_Configs` use `"Accounts_id"`, `"Campaigns_id"`, `"Leads_id"` (quoted). `Voice_Calls`, `Voice_Numbers`, `WhatsApp_Senders`, `Call_Followup_Log` use lowercase `accounts_id`, `campaigns_id`, `leads_id`.
- **No timestamps from the client.** The client sends a period key (`month`, `7d`, `30d`, `last_month`), never dates.
- **Every user-facing string goes through i18n** (`home` namespace, `en`, `nl`, `pt`). Portuguese is Brazilian.
- **Tokens only.** No raw hex, `bg-white` or `text-black` in components. New colours go in `client/src/styles/variables.css`.
- **No em dashes** in any copy, comment or doc.
- **Pages are lazy.** Each tab panel is its own `React.lazy` chunk.
- **Files stay under about 500 lines.**
- **No more than 4 parallel agents on the Pi,** and none may run `tsc`.
- **Demo traffic is excluded from every number.**

## Review Focus

1. **A client asks for another account.** `GET /api/home/overview?accountId=1` from a client login must return that client's own account, never account 1. Pinned in Task B2.
2. **A message whose transport is unknown.** A row with `channel` NULL (an old row the backfill could not classify, or an insert site that was missed) must not be counted as SMS or dropped from the conversation total. Pinned in Tasks A2 and B3.
3. **The period crosses a month or year boundary.** "This month" on 1 January, "last month" in January, and a 31-day month compared to a 28-day one must give valid, non-overlapping ranges. Pinned in Task B1.
4. **An account with no live service, or no data in the period.** Every endpoint returns zeros and empty lists, not an error, and the page shows an empty state rather than a broken banner. Pinned in Tasks B3 and C3.
5. **A division by zero in a rate or a change figure.** Capture rate with zero chats, change vs a previous period of zero, average length with no calls. Pinned in Task C1.

---

## File Structure

**Engine (`/home/gabriel/automations`)**

| File | Responsibility |
|---|---|
| `scripts/migrate_home_dashboard_channels.py` (new) | add `Interactions.channel`, `Leads.booking_channel`, one index |
| `tools/channels.py` (new) | pure mapping from engine transport names to dashboard channels |
| `tools/db/interactions.py` | `create_interaction` and the fallback claim write `channel` |
| `tools/send_service.py`, `tools/whatsapp_client_send.py` | `send_message` reports the transport it really used |
| 19 senders, `inbound_handler.py`, 9 raw insert sites | pass or write `channel` |
| `src/automations/conversation/slot_booking.py`, `src/webhooks/booking_routes.py` | stamp `booking_channel`, set `booked_at` for booking-page bookings |
| `scripts/backfill_home_dashboard_channels.py` (new) | classify old rows, `--dry-run`, per-account report |
| `tests/test_channels.py`, `tests/test_interaction_channel.py`, `tests/test_booking_channel.py` (new) | unit tests |

**CRM server**

| File | Responsibility |
|---|---|
| `shared/homeTypes.ts` (new) | response types shared by server and client |
| `shared/homePeriod.ts` + `.test.ts` (new) | pure period maths |
| `server/storage/homeSql.ts` (new) | shared SQL fragments: tables, demo filters, stream rule, bounds |
| `server/storage/homeServices.ts` (new) | which tabs are live |
| `server/storage/homeOverview.ts`, `homePhone.ts`, `homeMessaging.ts`, `homeWebsite.ts`, `homeReactivation.ts` (new) | one summary each |
| `server/routes/home.ts` + `homeScope.ts` + `homeScope.test.ts` (new) | routes and the scope rule |
| `server/storage.ts`, `server/routes/index.ts`, `shared/schema.ts`, `server/storage/interactions.ts` | wiring, two new columns, stamp CRM-sent messages |

**Client (`client/src/features/home/`)**

| File | Responsibility |
|---|---|
| `lib/homeFormat.ts` + `.test.ts` (new) | pure formatting: change %, duration, rate |
| `api/homeApi.ts` (new) | fetchers and react-query hooks |
| `pages/HomePage.tsx` (rewritten) | shell: greeting, tabs, period picker, lazy panels |
| `components/HomeBanner.tsx`, `StatRow.tsx`, `BarList.tsx`, `DayChart.tsx`, `RowList.tsx`, `EmptyState.tsx` (new) | shared building blocks |
| `tabs/OverviewTab.tsx`, `PhoneTab.tsx`, `WhatsappTab.tsx`, `WebsiteTab.tsx`, `ReactivationTab.tsx` (new) | one panel per tab |
| `home.css` (rewritten) | banner and layout styles |
| `client/src/assets/home/*.webp` | five banner images replace three mascots |
| `script/home/gen-images.cjs` (new) | image generator |

---

# Part A: Data (engine)

Part A can ship alone: after it, new rows carry a channel and old rows are classified, with nothing visible to users.

### Task A1: Add the two columns

**Files:**
- Create: `/home/gabriel/automations/scripts/migrate_home_dashboard_channels.py`
- Modify: `/home/gabriel/LeadAwakerApp/shared/schema.ts` (Interactions table near line 824, Leads table near line 1048)

**Interfaces:**
- Produces: columns `Interactions.channel text NULL`, `Leads.booking_channel text NULL`; Drizzle fields `interactions.channel`, `leads.bookingChannel`.

- [ ] **Step 1: Write the migration**

```python
"""Adds Interactions.channel and Leads.booking_channel for the Home dashboard
(LeadAwakerApp specs/home-dashboard). Both are nullable with no default, so
every existing insert keeps working. Idempotent: safe to run multiple times.

Run: cd /home/gabriel/automations && .venv/bin/python -m scripts.migrate_home_dashboard_channels
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import settings
from tools.db.connection import init_pool, close_pool, get_pool
from tools.db.constants import fq, Table


async def main():
    await init_pool(settings.dsn)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(f'ALTER TABLE {fq(Table.INTERACTIONS)} ADD COLUMN IF NOT EXISTS channel text')
        await conn.execute(f'ALTER TABLE {fq(Table.LEADS)} ADD COLUMN IF NOT EXISTS booking_channel text')
        await conn.execute(
            f'CREATE INDEX IF NOT EXISTS interactions_account_channel_created_idx '
            f'ON {fq(Table.INTERACTIONS)} ("Accounts_id", channel, created_at)'
        )
        n = await conn.fetchval(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'p2mxx34fvbf3ll6' "
            "AND ((table_name = 'Interactions' AND column_name = 'channel') "
            "OR (table_name = 'Leads' AND column_name = 'booking_channel'))"
        )
        print("columns present:", n, "(expected 2)")
    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run it**

Run: `cd /home/gabriel/automations && .venv/bin/python -m scripts.migrate_home_dashboard_channels`
Expected: `columns present: 2 (expected 2)`

- [ ] **Step 3: Declare the columns in Drizzle**

In `shared/schema.ts`, inside `interactions`, after `templateSid: text("template_sid"),`:

```ts
  // The transport that carried this message: phone | whatsapp | sms | website | email | other.
  // Engine-owned (tools/channels.py). NULL on rows the backfill could not classify.
  channel: text("channel"),
```

Inside `leads`, after `resolvedChannel: text("resolved_channel"),`:

```ts
  // The channel that made the current booking: phone | whatsapp | sms | website | booking_page.
  // Engine-owned. Kept on a rebook through the link.
  bookingChannel: text("booking_channel"),
```

- [ ] **Step 4: Confirm the server still serves**

Run: `sleep 9; pm2 logs leadawaker --lines 15 --nostream --err; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/health`
Expected: no new error, `200`.

### Task A2: The channel mapper

**Files:**
- Create: `/home/gabriel/automations/tools/channels.py`
- Test: `/home/gabriel/automations/tests/test_channels.py`

**Interfaces:**
- Produces:
  - `dashboard_channel(engine_channel: str | None, lead: dict | None = None) -> str` returns one of `phone | whatsapp | sms | website | email | other`.
  - `channel_from_type(type_: str | None) -> str | None` returns a channel only when the legacy `type` value is unambiguous.
  - `booking_channel_for(lead: dict | None, campaign_channel: str | None, booked_via: str | None) -> str` returns `phone | whatsapp | sms | website`.

- [ ] **Step 1: Write the failing tests**

```python
from tools.channels import booking_channel_for, channel_from_type, dashboard_channel


def test_whatsapp_variants_are_whatsapp():
    assert dashboard_channel("whatsapp") == "whatsapp"
    assert dashboard_channel("whatsapp_cloud") == "whatsapp"
    assert dashboard_channel(" WhatsApp ") == "whatsapp"


def test_web_lead_is_website_whatever_the_campaign_channel():
    assert dashboard_channel("whatsapp", {"channel_identifier": "web:abc"}) == "website"
    assert dashboard_channel("sms", {"channel_identifier": "web-demo:tok"}) == "website"


def test_sms_email_phone():
    assert dashboard_channel("sms") == "sms"
    assert dashboard_channel("email") == "email"
    assert dashboard_channel("voice_call") == "phone"


def test_unknown_and_missing_are_other_never_sms():
    assert dashboard_channel(None) == "other"
    assert dashboard_channel("instagram") == "other"
    assert dashboard_channel("telegram") == "other"


def test_type_fallback_only_when_unambiguous():
    assert channel_from_type("voice_call") == "phone"
    assert channel_from_type("voicemail") == "phone"
    assert channel_from_type("web_chat") == "website"
    assert channel_from_type("whatsapp_cloud") == "whatsapp"
    assert channel_from_type("WhatsApp") == "whatsapp"
    assert channel_from_type("Email") == "email"
    # "SMS" is the insert default for every transport, so it says nothing.
    assert channel_from_type("SMS") is None
    assert channel_from_type(None) is None
    assert channel_from_type("voice_note") is None


def test_booking_channel():
    assert booking_channel_for({"channel_identifier": "web:abc"}, "whatsapp", None) == "website"
    assert booking_channel_for({}, "whatsapp", "phone") == "phone"
    assert booking_channel_for({"resolved_channel": "sms"}, "whatsapp", None) == "sms"
    assert booking_channel_for({}, "whatsapp_cloud", None) == "whatsapp"
    assert booking_channel_for(None, None, None) == "whatsapp"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_channels.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'tools.channels'`

- [ ] **Step 3: Implement**

```python
"""Dashboard channels: the one vocabulary the CRM Home dashboard counts by.

The engine has its own transport names (whatsapp, whatsapp_cloud, sms, email,
web_chat, instagram ...). This maps them to phone | whatsapp | sms | website |
email | other. Pure: no DB, no imports from the send path.
"""

DASHBOARD_CHANNELS = ("phone", "whatsapp", "sms", "website", "email", "other")

_WEB_PREFIXES = ("web:", "web-demo:")
_BY_ENGINE = {
    "whatsapp": "whatsapp", "whatsapp_cloud": "whatsapp",
    "sms": "sms",
    "web": "website", "web_chat": "website", "web_demo": "website", "web-demo": "website",
    "email": "email",
    "phone": "phone", "voice": "phone", "voice_call": "phone", "voicemail": "phone",
}
# Legacy Interactions.type values that name a transport. "SMS" is absent on
# purpose: it is create_interaction's default and is stamped on every transport.
_BY_TYPE = {
    "voice_call": "phone", "voicemail": "phone",
    "web_chat": "website", "web_demo": "website",
    "whatsapp_cloud": "whatsapp", "whatsapp": "whatsapp",
    "email": "email",
}


def _is_web_lead(lead: dict | None) -> bool:
    return str((lead or {}).get("channel_identifier") or "").startswith(_WEB_PREFIXES)


def dashboard_channel(engine_channel: str | None, lead: dict | None = None) -> str:
    if _is_web_lead(lead):
        return "website"
    return _BY_ENGINE.get((engine_channel or "").strip().lower(), "other")


def channel_from_type(type_: str | None) -> str | None:
    return _BY_TYPE.get((type_ or "").strip().lower())


def booking_channel_for(lead: dict | None, campaign_channel: str | None, booked_via: str | None) -> str:
    """The channel a booking made by the engine came through."""
    if (booked_via or "") == "phone":
        return "phone"
    if _is_web_lead(lead):
        return "website"
    resolved = str((lead or {}).get("resolved_channel") or "").strip().lower()
    ch = dashboard_channel(resolved or campaign_channel)
    return ch if ch in ("whatsapp", "sms") else "whatsapp"
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_channels.py`
Expected: 6 passed

### Task A3: `create_interaction` and the claim helpers write `channel`

**Files:**
- Modify: `/home/gabriel/automations/tools/db/interactions.py` (`create_interaction` at 11-125, `claim_channel_fallback` near 237, `update_interaction_status` near 279)
- Modify: `/home/gabriel/automations/tools/db/telnyx_sms.py:17-24`
- Test: `/home/gabriel/automations/tests/test_interaction_channel.py`

**Interfaces:**
- Consumes: `channel_from_type` from Task A2.
- Produces: `create_interaction(..., channel: str | None = None)`. When `channel` is None it falls back to `channel_from_type(type)`, which may still be None.

- [ ] **Step 1: Write the failing tests**

```python
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from tools.db import interactions


def _pool():
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 7, "created_at": datetime(2026, 10, 12)})
    conn.execute = AsyncMock(return_value="NOTIFY")
    acquire = MagicMock()
    acquire.__aenter__ = AsyncMock(return_value=conn)
    acquire.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire.return_value = acquire
    return pool, conn


def _insert(**kwargs):
    pool, conn = _pool()
    base = dict(accounts_id=1, who="Lead", direction="inbound", content="hi")
    with patch("tools.db.interactions.get_pool", return_value=pool):
        asyncio.run(interactions.create_interaction(**{**base, **kwargs}))
    return conn.fetchrow.await_args.args


def test_explicit_channel_is_written():
    args = _insert(channel="whatsapp")
    assert " channel," in args[0] or "channel)" in args[0]
    assert args[-1] == "whatsapp"


def test_falls_back_to_an_unambiguous_type():
    assert _insert(type="voice_call")[-1] == "phone"


def test_default_sms_type_leaves_channel_null():
    # The default type "SMS" must never be read as the sms channel.
    assert _insert()[-1] is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_interaction_channel.py`
Expected: FAIL, `TypeError: create_interaction() got an unexpected keyword argument 'channel'`

- [ ] **Step 3: Implement in `create_interaction`**

Add the import at the top of the file:

```python
from tools.channels import channel_from_type
```

Add the parameter after `metadata: dict | None = None,`:

```python
    channel: str | None = None,
```

In the INSERT, change the column list tail and the VALUES tail, and append the value as the last bind parameter:

```python
              f'metadata, channel, sent_at, created_at, updated_at) '
              f'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'
              f'$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::json,$30,NOW(),NOW(),NOW()) '
```

```python
              json.dumps(metadata) if metadata is not None else None,
              channel or channel_from_type(type),
          )
```

- [ ] **Step 4: Stamp the fallback claims**

- `claim_channel_fallback` (`interactions.py` near 237): add `channel` to its INSERT column list with value `dashboard_channel(type)` (import `dashboard_channel`), where `type` is the `"Email"` or `"SMS"` the caller passes. This row is a real send attempt on that transport, so here `"SMS"` does mean sms.
- `update_interaction_status` (near 279): wherever it rewrites `type`, set `channel = dashboard_channel(new_type)` in the same UPDATE, so an SMS leg that fails over to email is recounted as email.
- `tools/db/telnyx_sms.py:17-24`: add `channel` to the column list and the literal `'sms'` to the values, next to the existing literal `'SMS'`.

- [ ] **Step 5: Run the tests**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_interaction_channel.py tests/test_telnyx_sms_fallback.py tests/test_shared_phone_chat_memory.py`
Expected: all pass. If `test_telnyx_sms_fallback.py` asserts the exact SQL or argument tuple, update that assertion to include the new column.

### Task A4: `send_message` reports the transport it used

**Files:**
- Modify: `/home/gabriel/automations/tools/send_service.py` (return dicts at 309, 357, 430, 444, 473, 523, 584, 706)
- Modify: `/home/gabriel/automations/tools/whatsapp_client_send.py:203` (`_done`)
- Test: `/home/gabriel/automations/tests/test_lead_resolved_channel.py` (extend)

**Interfaces:**
- Produces: every dict returned by `send_message` has a `"channel"` key holding the engine transport that actually carried the message (`whatsapp`, `whatsapp_cloud`, `sms`, `email`, `web`, `web-demo`, `instagram`). Callers read it with `sent.get("channel")` because test fakes omit it.

Why: the caller's `channel` variable is only the requested channel. `send_message` re-routes in seven places (channel-mode policy at 323-338, client-number upgrade at 367 and 414, `resolved_channel` swap at 393-399, `wa-demo:` at 419, web short-circuits at 429 and 443, voice-note fallback to SMS at 619-632, session-closed revert at 655-657).

- [ ] **Step 1: Write the failing tests** (append to `tests/test_lead_resolved_channel.py`, using its existing `twilio` fixture and lead/campaign builders)

```python
async def test_send_reports_the_transport_used(twilio):
    sent = await send_message(channel="whatsapp", lead={"id": 1, "phone": "+31600000001", "resolved_channel": "sms"},
                              body="hi", campaign_account=_campaign_account())
    assert sent["channel"] == "sms"


async def test_web_lead_reports_web(twilio):
    sent = await send_message(channel="whatsapp", lead={"id": 2, "channel_identifier": "web:abc"},
                              body="hi", campaign_account=_campaign_account())
    assert sent["channel"] == "web"
```

Match the keyword names to the real `send_message` signature at `tools/send_service.py:230` and to the helper names already used in this test file before running.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_lead_resolved_channel.py`
Expected: the two new tests FAIL with `KeyError: 'channel'`

- [ ] **Step 3: Add the key at every return**

At each of the nine return sites, add `"channel": <the local variable holding the final transport at that point>`:

| Site | Value |
|---|---|
| `send_service.py:309` (early failure) | the requested `channel` |
| `:357` | the policy-routed channel in scope |
| `:430` (`web-demo:` short-circuit) | `"web-demo"` |
| `:444` (`web:` short-circuit) | `"web"` |
| `:473`, `:523`, `:584` | the branch's transport (`"email"`, `"instagram"`, `"whatsapp_cloud"` respectively; confirm each by reading the branch) |
| `:706` (Twilio tail) | `"sms"` when the voice-note fallback at 619-632 or the session-closed revert at 655-657 ran, otherwise the final `channel` |
| `whatsapp_client_send.py:203` (`_done`) | `"whatsapp_cloud"` |

- [ ] **Step 4: Run the tests**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_lead_resolved_channel.py tests/test_telnyx_sms_fallback.py`
Expected: all pass

### Task A5: Every insert site passes a channel

**Files:** the call sites below (all under `/home/gabriel/automations`).

**Interfaces:**
- Consumes: `dashboard_channel` (A2), `create_interaction(channel=...)` (A3), `sent.get("channel")` (A4).

- [ ] **Step 1: Senders that go through `send_message`**

In each file add `from tools.channels import dashboard_channel` and pass this keyword to the `create_interaction` call, where `channel` is the local requested channel and `lead` the local lead dict:

```python
            channel=dashboard_channel(sent.get("channel") or channel, lead),
```

| File:line | Notes |
|---|---|
| `src/automations/conversation/outbound.py:293` | |
| `src/automations/conversation/voice_live.py:362` | |
| `src/automations/conversation/confirmation.py:82` | |
| `src/automations/campaign_launcher.py:389` | |
| `src/automations/send_queue_worker.py:335` | requested channel is `row["channel"]` |
| `src/automations/bump_scheduler.py:320`, `:626`, `:749`, `:940` | |
| `src/automations/buying_signal_followup.py:203` | |
| `src/automations/booking_reminder.py:288` | |
| `src/automations/no_show_recovery.py:261` | |
| `src/automations/reschedule_reengage.py:271` | |
| `src/automations/speed_to_lead.py:234` | requested channel is `base_channel` |
| `src/automations/reputation_scheduler.py:151` | |
| `src/automations/reputation_handler.py:121` | no local `channel`: use `sent.get("channel") or "whatsapp_cloud"` |
| `src/webhooks/booking_routes.py:1021` | |

- [ ] **Step 2: Sites with a fixed channel**

| File:line | Keyword to add |
|---|---|
| `src/automations/voice/after_call_followup.py:419` | `channel="whatsapp"` |
| `src/automations/voice/event_logger.py:180` | `channel="phone"` |
| `src/webhooks/twilio_voice_mc_routes.py:350` | `channel="phone"` |
| `src/webhooks/booking_routes.py:379` | `channel="whatsapp"` |
| `src/webhooks/booking_routes.py:967` | `channel="other"` (synthetic "Sistema" row, not a message) |

- [ ] **Step 3: Inbound messages**

In `src/automations/inbound_handler.py`, before the `create_interaction` call at 391, add:

```python
    inbound_channel = dashboard_channel(
        webhook_data.get("inbound_transport") or webhook_data.get("channel"), lead
    )
```

and pass `channel=inbound_channel,` to the call. `inbound_transport` is `whatsapp` or `sms` for Twilio; `channel` is `whatsapp_cloud`, `web_chat`, `web_demo` or `instagram` for the other webhooks. A community-join system event has neither key and becomes `other`, which keeps it out of every conversation count.

- [ ] **Step 4: Raw INSERT sites**

Add a `channel` column and value to each raw INSERT:

| File:line | Value |
|---|---|
| `src/webhooks/widget_routes.py:229` (greeting) | `'website'` |
| `src/webhooks/widget_routes.py:488` (restart marker) | `'other'` |
| `src/webhooks/web_demo_routes.py:388` | `'website'` |
| `src/webhooks/whatsapp_cloud_routes.py:112` | `'whatsapp'` |
| `src/automations/demo_recap.py:359`, `:406` | `'whatsapp'` |
| `src/automations/demo_bump_scheduler.py:144`, `:300` | `'whatsapp'` |

- [ ] **Step 5: CRM-sent messages**

`/home/gabriel/LeadAwakerApp/server/storage/interactions.ts:248` (`createInteraction`) is how a person's manual reply is stored. Read its callers first (`grep -rn "createInteraction(" server/`), then set `channel` when the caller did not: `"website"` when the lead's `channel_identifier` starts with `web:`, otherwise the lead's `resolved_channel` if it is `whatsapp` or `sms`, otherwise `whatsapp` or `sms` from the campaign's `channel`. The internal `call_back` note at `server/storage/voiceCallers.ts:253` gets `channel: "other"`.

- [ ] **Step 6: Run the whole engine suite and preflight**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest && ./preflight.sh`
Expected: all tests pass, preflight prints PASS. Known assertions that read `create_interaction` kwargs and may need the new key: `tests/voice/test_after_call_followup.py:363`, `tests/voice/test_event_logger.py`.

### Task A6: Stamp `booking_channel`

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py:978` and `:1028-1040`
- Modify: `/home/gabriel/automations/src/webhooks/booking_routes.py:631-658`
- Test: `/home/gabriel/automations/tests/test_booking_channel.py`

**Interfaces:**
- Consumes: `booking_channel_for` (A2).
- Produces: `Leads.booking_channel` set on every new booking. Cal metadata key `booked_via` always present on engine bookings.

Why both places: Cal.diy fires its BOOKING_CREATED webhook during the engine's own create call, so the webhook write can land before or after the engine's write. Both must produce the same value. Carrying the channel in the Cal metadata makes the webhook independent of order.

- [ ] **Step 1: Write the failing test**

```python
from src.webhooks.booking_routes import booking_channel_from_webhook


def test_engine_booking_uses_metadata():
    assert booking_channel_from_webhook({"engine_booked": "1", "booked_via": "website"}, existing=None, is_rebook=False) == "website"


def test_engine_booking_without_metadata_is_whatsapp():
    assert booking_channel_from_webhook({"engine_booked": "1"}, existing=None, is_rebook=False) == "whatsapp"


def test_booking_page():
    assert booking_channel_from_webhook({}, existing=None, is_rebook=False) == "booking_page"


def test_rebook_keeps_the_channel_that_won_the_booking():
    assert booking_channel_from_webhook({}, existing="phone", is_rebook=True) == "phone"


def test_rebook_with_nothing_stored_is_booking_page():
    assert booking_channel_from_webhook({}, existing=None, is_rebook=True) == "booking_page"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_booking_channel.py`
Expected: FAIL, `ImportError: cannot import name 'booking_channel_from_webhook'`

- [ ] **Step 3: Implement the webhook side** (`booking_routes.py`, module level)

```python
_BOOKING_CHANNELS = ("phone", "whatsapp", "sms", "website")


def booking_channel_from_webhook(booking: dict, *, existing: str | None, is_rebook: bool) -> str:
    """Leads.booking_channel for a BOOKING_CREATED webhook. A rebook through the
    link keeps the channel that won the booking in the first place."""
    if is_rebook and existing:
        return existing
    if booking.get("engine_booked"):
        via = (booking.get("booked_via") or "").strip().lower()
        return via if via in _BOOKING_CHANNELS else "whatsapp"
    return "booking_page"
```

In `_handle_booking`, in the lead update at 631-658, add two fields:

```python
        "booking_channel": booking_channel_from_webhook(
            booking, existing=lead.get("booking_channel"), is_rebook=is_rebook),
```

and, only when the lead has none yet, `booked_at`:

```python
    if not lead.get("booked_at"):
        update_kwargs["booked_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
```

Match the variable name of the update dict in that function (it may be built inline in the `update_lead_fields(...)` call; if so, pass both as extra keyword arguments).

- [ ] **Step 4: Implement the engine side** (`slot_booking.py`)

Before the Cal create call, compute the channel once:

```python
    from tools.channels import booking_channel_for
    booked_channel = booking_channel_for(
        _fresh_lead or lead, campaign_account.get("channel"), (extra_metadata or {}).get("booked_via"))
```

Change the metadata line at 978 to always carry it:

```python
                metadata={**(extra_metadata or {}), "booked_via": booked_channel,
                          "lead_id": str(lead_id), "engine_booked": "1"},
```

Add to `update_kwargs` at 1028-1040:

```python
            "booking_channel": booked_channel,
```

`_fresh_lead` is the re-read lead at line 870. Use whichever fresh lead variable is in scope at the create call.

- [ ] **Step 5: Run the tests**

Run: `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/test_booking_channel.py tests/voice/test_real_booking.py && ./preflight.sh`
Expected: all pass, PASS. `test_real_booking.py:171` asserts exact kwargs on `update_lead_status`, which this task does not change.

### Task A7: Backfill

**Files:**
- Create: `/home/gabriel/automations/scripts/backfill_home_dashboard_channels.py`

**Interfaces:**
- Consumes: the columns from A1.
- Produces: `Interactions.channel` set on old rows where it can be known, `Leads.booking_channel` and `Leads.booked_at` filled on old bookings, and a printed per-account report.

- [ ] **Step 1: Write the script**

```python
"""One-off: classify old Interactions rows by channel and old bookings by the
channel that made them (LeadAwakerApp specs/home-dashboard). Only fills NULLs,
so it is safe to run again.

Run: cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels --dry-run
     cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import settings
from tools.db.connection import init_pool, close_pool, get_pool
from tools.db.constants import fq, Table

DRY_RUN = "--dry-run" in sys.argv
I, L, C, V, A = (fq(Table.INTERACTIONS), fq(Table.LEADS), fq(Table.CAMPAIGNS),
                 fq(Table.VOICE_CALLS), fq(Table.CLIENT_ALERT_LOG))

# First match wins. The message's own markers come before anything inferred
# from the lead, because a lead can use more than one channel over time.
CHANNEL_CASE = f"""CASE
  WHEN lower(COALESCE(i.type, '')) IN ('voice_call', 'voicemail') THEN 'phone'
  WHEN COALESCE(i.twilio_message_sid, '') LIKE 'mc-vm:%' THEN 'phone'
  WHEN lower(COALESCE(i.type, '')) IN ('call_back', 'conversation_restart', 'appointment', 'linkedin') THEN 'other'
  WHEN lower(COALESCE(i.type, '')) = 'email' THEN 'email'
  WHEN lower(COALESCE(i.type, '')) IN ('web_chat', 'web_demo')
    OR COALESCE(i.twilio_message_sid, '') LIKE 'widget-%'
    OR COALESCE(i.twilio_message_sid, '') LIKE 'web-%'
    OR COALESCE(i.from_number, '') LIKE 'web:%' OR COALESCE(i.from_number, '') LIKE 'web-demo:%'
    OR COALESCE(i.to_number, '') IN ('web', 'web-demo')
    OR COALESCE(l.channel_identifier, '') LIKE 'web:%'
    OR COALESCE(l.channel_identifier, '') LIKE 'web-demo:%' THEN 'website'
  WHEN COALESCE(i.twilio_message_sid, '') LIKE 'telnyx-fallback:%' THEN 'sms'
  WHEN lower(COALESCE(i.type, '')) IN ('whatsapp_cloud', 'whatsapp')
    OR COALESCE(i.twilio_message_sid, '') LIKE 'wamid.%'
    OR COALESCE(i.twilio_message_sid, '') LIKE 'wa-fallback:%'
    OR COALESCE(i.from_number, '') LIKE 'whatsapp:%' OR COALESCE(i.to_number, '') LIKE 'whatsapp:%'
    OR COALESCE(l.channel_identifier, '') LIKE 'wa-demo:%' THEN 'whatsapp'
  WHEN i.triggered_by = 'channel_fallback' AND lower(COALESCE(i.type, '')) = 'sms' THEN 'sms'
  WHEN l.resolved_channel IN ('whatsapp', 'sms') THEN l.resolved_channel
  WHEN lower(COALESCE(c.channel, '')) IN ('whatsapp', 'whatsapp_cloud') THEN 'whatsapp'
  -- No guess from a campaign channel of 'sms': it is the column default, and a wrong
  -- guess would inflate the SMS row. Unclassified rows stay NULL and still count as
  -- conversations, just under no channel.
  ELSE NULL
END"""

BOOKING_CASE = f"""CASE
  WHEN EXISTS (SELECT 1 FROM {A} a WHERE a.leads_id = l.id AND a.event_type = 'appointment_booked'
               AND a.payload ->> 'source' IN ('phone', 'whatsapp', 'website', 'booking_page'))
    THEN (SELECT a.payload ->> 'source' FROM {A} a WHERE a.leads_id = l.id
          AND a.event_type = 'appointment_booked' ORDER BY a.created_at DESC LIMIT 1)
  WHEN COALESCE(l.channel_identifier, '') LIKE 'web:%' THEN 'website'
  WHEN EXISTS (SELECT 1 FROM {V} v WHERE v.leads_id = l.id AND v.booked_iso IS NOT NULL
               AND abs(EXTRACT(EPOCH FROM (v.booked_iso - l.booked_call_date))) < 60) THEN 'phone'
  WHEN l.calcom_booking_uid IS NULL THEN 'whatsapp'
  WHEN l.resolved_channel = 'sms' THEN 'sms'
  WHEN l.booked_at IS NOT NULL THEN 'whatsapp'
  ELSE 'booking_page'
END"""


async def main():
    await init_pool(settings.dsn)
    pool = get_pool()
    async with pool.acquire() as conn:
        src = (f'{I} i LEFT JOIN {L} l ON l.id = i."Leads_id" '
               f'LEFT JOIN {C} c ON c.id = COALESCE(i."Campaigns_id", l."Campaigns_id")')
        report = await conn.fetch(
            f'SELECT i."Accounts_id" AS account, COALESCE({CHANNEL_CASE}, \'(unknown)\') AS channel, count(*) AS n '
            f'FROM {src} WHERE i.channel IS NULL GROUP BY 1, 2 ORDER BY 1, 3 DESC')
        print("Interactions to classify, per account:")
        for r in report:
            print(f"  account {r['account']}: {r['channel']:<10} {r['n']}")
        bookings = await conn.fetch(
            f'SELECT l."Accounts_id" AS account, {BOOKING_CASE} AS channel, count(*) AS n FROM {L} l '
            f'WHERE l.booked_call_date IS NOT NULL AND l.booking_channel IS NULL GROUP BY 1, 2 ORDER BY 1, 3 DESC')
        print("Bookings to classify, per account:")
        for r in bookings:
            print(f"  account {r['account']}: {r['channel']:<12} {r['n']}")
        if DRY_RUN:
            print("Dry run: nothing written.")
        else:
            a = await conn.execute(
                f'UPDATE {I} t SET channel = s.ch FROM (SELECT i.id, {CHANNEL_CASE} AS ch FROM {src} '
                f'WHERE i.channel IS NULL) s WHERE t.id = s.id AND s.ch IS NOT NULL')
            b = await conn.execute(
                f'UPDATE {L} l SET booking_channel = {BOOKING_CASE} '
                f'WHERE l.booked_call_date IS NOT NULL AND l.booking_channel IS NULL')
            # booked_at last: BOOKING_CASE reads "booked_at set" as "made by the engine".
            c = await conn.execute(
                f'UPDATE {L} SET booked_at = booking_confirmed_at_ '
                f'WHERE booked_call_date IS NOT NULL AND booked_at IS NULL AND booking_confirmed_at_ IS NOT NULL')
            print("Interactions:", a, "| booking_channel:", b, "| booked_at:", c)
    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
```

Note the `updated_at` columns are left alone on purpose: touching them would make every old lead look recently active.

- [ ] **Step 2: Dry run and read the report**

Run: `cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels --dry-run`
Expected: a table per account. Sanity anchors from live data on 2026-10-12 (5,798 rows): about 2,322 become `phone` (the `voice_call` rows), at least 1,900 `whatsapp`, about 130 `website`. Most of the 1,242 rows typed `SMS` should land on `whatsapp` or `website` through their sid, number or lead markers. If `(unknown)` is more than 10% of an account's rows, stop and show Gabriel the report.

- [ ] **Step 3: Show Gabriel the dry-run report, then run for real on his OK**

Run: `cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels`
Expected: three `UPDATE n` lines. Running it again reports zero rows to classify except `(unknown)`.

---

# Part B: CRM summary endpoints

Part B ships behind no UI: after it, `curl` returns real numbers for every tab.

### Task B1: Shared types and period maths

**Files:**
- Create: `shared/homeTypes.ts`, `shared/homePeriod.ts`
- Test: `shared/homePeriod.test.ts`

**Interfaces:**
- Produces (used by every later task, names are final):

```ts
// shared/homeTypes.ts
export const HOME_PERIODS = ["month", "7d", "30d", "last_month"] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];
export type HomeChannel = "phone" | "whatsapp" | "sms" | "website";
export type HomeTab = "overview" | "phone" | "whatsapp" | "website" | "reactivation" | "reputation" | "social";
export interface Compared { value: number; previous: number }
export interface DayPoint { day: string; value: number }

export interface HomeServices { phone: boolean; whatsapp: boolean; website: boolean; reactivation: boolean; reputation: boolean; social: boolean; sms: boolean }

export interface AttentionRow {
  kind: "callback" | "transfer_failed" | "handoff";
  channel: HomeChannel;
  leadId: number | null;
  callId: string | null;
  name: string | null;
  at: string;
}
export interface ActivityRow {
  kind: "booked" | "call" | "transferred" | "chat_started" | "followup_sent";
  channel: HomeChannel | "booking_page";
  leadId: number | null;
  callId: string | null;
  name: string | null;
  at: string;
}
export interface HomeOverview {
  conversations: Compared; bookings: Compared; callbacks: Compared; newContacts: Compared;
  waiting: number;
  byChannel: { channel: HomeChannel; conversations: number; bookings: number }[];
  perDay: DayPoint[];
  attention: AttentionRow[];
  activity: ActivityRow[];
}
export type CallOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";
export interface HomePhone {
  calls: Compared; booked: Compared; transferred: Compared; avgSeconds: Compared;
  transfersFailed: number;
  perDay: DayPoint[];
  outcomes: { outcome: CallOutcome; count: number }[];
  outOfHoursPct: number | null;
  screened: number;
  recent: { callId: string; name: string | null; callerNumber: string | null; outcome: CallOutcome; seconds: number | null; at: string }[];
}
export interface RecentLead { leadId: number; name: string | null; at: string; snippet: string }
export interface HomeWhatsapp {
  conversations: Compared; messagesIn: Compared; messagesOut: Compared; bookings: Compared; handedOff: Compared;
  perDay: DayPoint[];
  followUps: number;
  /** followUpShare: % of after-call follow-ups sent by SMS instead of WhatsApp; null when none were sent. */
  sms: { sent: number; delivered: number; failed: number; followUpShare: number | null } | null;
  sender: { connected: boolean; quality: string | null } | null;
  recent: RecentLead[];
}
export interface HomeWebsite {
  chats: Compared; contacts: Compared; bookings: Compared;
  perDay: DayPoint[];
  recent: RecentLead[];
}
export interface HomeReactivation {
  contacted: Compared; replied: Compared; bookings: Compared;
  costPerBooking: number | null;
  perDay: { day: string; replies: number; bookings: number }[];
  pipeline: { status: string; count: number }[];
  campaigns: { id: number; name: string }[];
}
export interface HomeReputation {
  /** Google Business Profile is connected for the account (always false in the all-accounts view). */
  connected: boolean;
  reviews: Compared;
  avgRating: { value: number | null; previous: number | null };
  replied: Compared;
  /** Reviews with no posted reply right now. Not tied to the period. */
  awaitingReply: number;
  requestsSent: Compared;
  ratings: { rating: number; count: number }[];
  perDay: DayPoint[];
  recent: { id: number; author: string | null; rating: number | null; text: string; replied: boolean; at: string }[];
}
export interface HomeSocial {
  /** An Instagram account is connected (always false in the all-accounts view). */
  connected: boolean;
  conversations: Compared; messagesIn: Compared; messagesOut: Compared; bookings: Compared;
  perDay: DayPoint[];
  recent: RecentLead[];
}
```

```ts
// shared/homePeriod.ts
export interface PeriodDates { from: string; to: string; prevFrom: string; prevTo: string }
export function isHomePeriod(v: unknown): v is HomePeriod
/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(tz: string, now?: Date): string
/** Local-date ranges, `to` exclusive. `today` is YYYY-MM-DD in the account's timezone. */
export function periodDates(period: HomePeriod, today: string): PeriodDates
/** Every date from `from` (inclusive) to `to` (exclusive). */
export function eachDay(from: string, to: string): string[]
```

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { eachDay, isHomePeriod, periodDates, todayIn } from "./homePeriod";

test("month: month to date, compared with the same days of the previous month", () => {
  assert.deepEqual(periodDates("month", "2026-10-12"),
    { from: "2026-10-01", to: "2026-10-13", prevFrom: "2026-09-01", prevTo: "2026-09-13" });
});

test("month on 1 January reaches back into December of the previous year", () => {
  assert.deepEqual(periodDates("month", "2026-01-01"),
    { from: "2026-01-01", to: "2026-01-02", prevFrom: "2025-12-01", prevTo: "2025-12-02" });
});

test("month: a 31-day month never compares past the end of a shorter one", () => {
  const p = periodDates("month", "2026-03-31");
  assert.equal(p.prevFrom, "2026-02-01");
  assert.equal(p.prevTo, "2026-03-01");
});

test("7d: today and the six days before, compared with the seven before that", () => {
  assert.deepEqual(periodDates("7d", "2026-10-12"),
    { from: "2026-10-06", to: "2026-10-13", prevFrom: "2026-09-29", prevTo: "2026-10-06" });
});

test("30d", () => {
  assert.deepEqual(periodDates("30d", "2026-10-12"),
    { from: "2026-09-13", to: "2026-10-13", prevFrom: "2026-08-14", prevTo: "2026-09-13" });
});

test("last_month in January is December, compared with November", () => {
  assert.deepEqual(periodDates("last_month", "2026-01-15"),
    { from: "2025-12-01", to: "2026-01-01", prevFrom: "2025-11-01", prevTo: "2025-12-01" });
});

test("ranges never overlap", () => {
  for (const p of ["month", "7d", "30d", "last_month"] as const) {
    const d = periodDates(p, "2026-03-31");
    assert.ok(d.prevTo <= d.from, p);
    assert.ok(d.prevFrom < d.prevTo, p);
    assert.ok(d.from < d.to, p);
  }
});

test("eachDay lists every date, end exclusive", () => {
  assert.deepEqual(eachDay("2026-02-27", "2026-03-02"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("todayIn uses the account's timezone, not UTC", () => {
  assert.equal(todayIn("Europe/Amsterdam", new Date("2026-10-11T22:30:00Z")), "2026-10-12");
  assert.equal(todayIn("America/Sao_Paulo", new Date("2026-10-12T01:00:00Z")), "2026-10-11");
});

test("isHomePeriod rejects junk", () => {
  assert.equal(isHomePeriod("7d"), true);
  assert.equal(isHomePeriod("year"), false);
  assert.equal(isHomePeriod(undefined), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test shared/homePeriod.test.ts`
Expected: FAIL, cannot find module `./homePeriod`

- [ ] **Step 3: Implement `shared/homeTypes.ts`** with exactly the types in the Interfaces block above.

- [ ] **Step 4: Implement `shared/homePeriod.ts`**

```ts
import { HOME_PERIODS, type HomePeriod } from "./homeTypes";

export interface PeriodDates { from: string; to: string; prevFrom: string; prevTo: string }

export function isHomePeriod(v: unknown): v is HomePeriod {
  return typeof v === "string" && (HOME_PERIODS as readonly string[]).includes(v);
}

export function todayIn(tz: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Dates are handled as UTC midnights so no local timezone or DST shift can move them.
const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = parse(d); x.setUTCDate(x.getUTCDate() + n); return fmt(x); };
const monthStart = (d: string, offset = 0) => {
  const x = parse(d);
  return fmt(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + offset, 1)));
};
const min = (a: string, b: string) => (a < b ? a : b);

export function periodDates(period: HomePeriod, today: string): PeriodDates {
  const tomorrow = addDays(today, 1);
  if (period === "7d" || period === "30d") {
    const n = period === "7d" ? 7 : 30;
    const from = addDays(tomorrow, -n);
    return { from, to: tomorrow, prevFrom: addDays(from, -n), prevTo: from };
  }
  if (period === "last_month") {
    const to = monthStart(today);
    const from = monthStart(today, -1);
    return { from, to, prevFrom: monthStart(today, -2), prevTo: from };
  }
  const from = monthStart(today);
  const prevFrom = monthStart(today, -1);
  const elapsed = Math.round((parse(tomorrow).getTime() - parse(from).getTime()) / 86_400_000);
  return { from, to: tomorrow, prevFrom, prevTo: min(addDays(prevFrom, elapsed), from) };
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --import tsx --test shared/homePeriod.test.ts`
Expected: 10 tests pass

### Task B2: Scope rule and route skeleton

**Files:**
- Create: `server/routes/homeScope.ts`, `server/routes/home.ts`
- Test: `server/routes/homeScope.test.ts`
- Modify: `server/routes/index.ts` (import near line 50, call after `registerClientAlertsRoutes(app);` at line 110)

**Interfaces:**
- Consumes: `resolveVoiceAccess`, `decideScope`, `VoiceAccess` from `server/routes/voiceCallsAccess.ts`; `isHomePeriod` from B1.
- Produces: `resolveHomeQuery(access, query) -> { accountId: number | null; period: HomePeriod; campaignId: number | null }`. `accountId === null` means all accounts and is only ever returned for agency users. Routes `GET /api/home/{services,overview,phone,whatsapp,website,reactivation,reputation,social}`.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { resolveHomeQuery } from "./homeScope";

const owner = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null });
const client = resolveVoiceAccess({ role: "Manager", accountsId: 53, impersonatedAccountId: null });
const impersonating = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: 53 });
const orphan = resolveVoiceAccess({ role: "Viewer", accountsId: null, impersonatedAccountId: null });

test("a client asking for another account gets its own", () => {
  assert.equal(resolveHomeQuery(client, { accountId: "1" }).accountId, 53);
  assert.equal(resolveHomeQuery(client, {}).accountId, 53);
  assert.equal(resolveHomeQuery(client, { accountId: "0" }).accountId, 53);
});

test("an owner viewing as a client is locked to that client", () => {
  assert.equal(resolveHomeQuery(impersonating, { accountId: "1" }).accountId, 53);
});

test("agency: a picked account, or all accounts for 0, missing or junk", () => {
  assert.equal(resolveHomeQuery(owner, { accountId: "53" }).accountId, 53);
  assert.equal(resolveHomeQuery(owner, { accountId: "0" }).accountId, null);
  assert.equal(resolveHomeQuery(owner, {}).accountId, null);
  assert.equal(resolveHomeQuery(owner, { accountId: "abc" }).accountId, null);
});

test("a user with no account matches nothing, never everything", () => {
  assert.equal(resolveHomeQuery(orphan, {}).accountId, -1);
});

test("period defaults to month and ignores junk", () => {
  assert.equal(resolveHomeQuery(owner, {}).period, "month");
  assert.equal(resolveHomeQuery(owner, { period: "7d" }).period, "7d");
  assert.equal(resolveHomeQuery(owner, { period: "DROP TABLE" }).period, "month");
});

test("campaignId is a positive integer or null", () => {
  assert.equal(resolveHomeQuery(owner, { campaignId: "71" }).campaignId, 71);
  assert.equal(resolveHomeQuery(owner, { campaignId: "-3" }).campaignId, null);
  assert.equal(resolveHomeQuery(owner, {}).campaignId, null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test server/routes/homeScope.test.ts`
Expected: FAIL, cannot find module `./homeScope`

- [ ] **Step 3: Implement `server/routes/homeScope.ts`**

```ts
/**
 * What a Home dashboard request may see. Pure, like voiceCallsAccess: clients
 * and impersonation are pinned to one account on the server, whatever the
 * query string says.
 */
import { isHomePeriod } from "@shared/homePeriod";
import type { HomePeriod } from "@shared/homeTypes";
import { decideScope, type VoiceAccess } from "./voiceCallsAccess";

export interface HomeQuery { accountId: number | null; period: HomePeriod; campaignId: number | null }

function positiveInt(v: unknown): number | null {
  const n = Number(typeof v === "string" || typeof v === "number" ? v : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function resolveHomeQuery(
  access: VoiceAccess,
  q: { accountId?: unknown; period?: unknown; campaignId?: unknown },
): HomeQuery {
  // "live" is always allowed, so decideScope cannot refuse here.
  const scope = decideScope(access, { accountId: q.accountId });
  const accountId = scope.ok ? scope.accountId : access.lockedAccountId;
  return {
    accountId,
    period: isHomePeriod(q.period) ? q.period : "month",
    campaignId: positiveInt(q.campaignId),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --import tsx --test server/routes/homeScope.test.ts`
Expected: 6 tests pass

- [ ] **Step 5: Write `server/routes/home.ts`**

```ts
import type { Express, Request } from "express";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { resolveVoiceAccess } from "./voiceCallsAccess";
import { resolveHomeQuery, type HomeQuery } from "./homeScope";

// scopeToAccount is here to reject the internal-key bypass (no session user).
// The account lock itself comes from resolveHomeQuery, which also covers an
// Admin on a client account (scopeToAccount alone would not).
const guards = [requireAuth, scopeToAccount];

function queryOf(req: Request): HomeQuery {
  const user = req.user!;
  const access = resolveVoiceAccess({
    role: user.role ?? "",
    accountsId: user.accountsId ?? null,
    impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
    impersonatedRole: req.session?.impersonation?.role ?? null,
  });
  return resolveHomeQuery(access, req.query);
}

export function registerHomeRoutes(app: Express): void {
  app.get("/api/home/services", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeServices(queryOf(req).accountId));
  }));
  app.get("/api/home/overview", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeOverview(queryOf(req)));
  }));
  app.get("/api/home/phone", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomePhone(queryOf(req)));
  }));
  app.get("/api/home/whatsapp", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeWhatsapp(queryOf(req)));
  }));
  app.get("/api/home/website", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeWebsite(queryOf(req)));
  }));
  app.get("/api/home/reactivation", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReactivation(queryOf(req)));
  }));
  app.get("/api/home/reputation", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeReputation(queryOf(req)));
  }));
  app.get("/api/home/social", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getHomeSocial(queryOf(req)));
  }));
}
```

Register it in `server/routes/index.ts` only at the end of Task B7, when all eight storage methods exist. Registering earlier would crash the server on a missing method.

### Task B3: Shared SQL fragments, live services, Overview

**Files:**
- Create: `server/storage/homeSql.ts`, `server/storage/homeServices.ts`, `server/storage/homeOverview.ts`

**Interfaces:**
- Consumes: `HomeQuery` (B2), `periodDates`, `todayIn`, `eachDay` (B1), types (B1).
- Produces: `homeServicesStorage.getHomeServices(accountId: number | null): Promise<HomeServices>`, `homeOverviewStorage.getHomeOverview(q: HomeQuery): Promise<HomeOverview>`, and from `homeSql.ts`: `T`, `DEFAULT_TZ`, `liveLeadSql`, `receptionistCampaignSql`, `dbrCampaignSql`, `reputationCampaignSql`, `socialCampaignSql`, `receptionistLeadSql`, `liveCallSql`, `needsCallbackSql`, `humanOutboundSql`, `boundsFor(q)`, `acct(column, accountId)`, `at(date, tz)`, `dayOf(column, tz)`, `num(v)`, `fillDays(bounds, rows)`.

SQL aliases are fixed so fragments compose: `i` Interactions, `l` Leads, `c` Campaigns (LEFT JOINed on `l."Campaigns_id"`), `vc` Voice_Calls.

- [ ] **Step 1: Write `server/storage/homeSql.ts`**

```ts
/**
 * Shared SQL for the Home dashboard summaries (specs/home-dashboard).
 * Aliases are fixed: i = Interactions, l = Leads, c = Campaigns, vc = Voice_Calls.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "@shared/schema";
import { eachDay, periodDates, todayIn, type PeriodDates } from "@shared/homePeriod";
import type { DayPoint } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";

const table = (name: string) => sql.raw(`"p2mxx34fvbf3ll6"."${name}"`);
export const T = {
  interactions: table("Interactions"), leads: table("Leads"), campaigns: table("Campaigns"),
  accounts: table("Accounts"), voiceCalls: table("Voice_Calls"), voiceNumbers: table("Voice_Numbers"),
  widgetConfigs: table("Widget_Configs"), whatsappSenders: table("WhatsApp_Senders"),
  callFollowupLog: table("Call_Followup_Log"),
  accountReviews: table("Account_Reviews"), calendarConnections: table("Calendar_Connections"),
};

export const DEFAULT_TZ = "Europe/Amsterdam";

/** Lead l (campaign c) is real traffic. Mirrors the engine's recap filter. */
export const liveLeadSql = sql`(
  COALESCE(c.is_demo, false) = false AND l.demo_niche IS NULL
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'wa-demo:%'
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'web-demo:%'
)`;

/** Campaign c is wired to a receptionist surface (widget, voice number, inbound). */
export const receptionistCampaignSql = sql`(
  EXISTS (SELECT 1 FROM ${T.widgetConfigs} w WHERE w."Campaigns_id" = c.id)
  OR EXISTS (SELECT 1 FROM ${T.voiceNumbers} rn WHERE rn.campaigns_id = c.id)
  OR EXISTS (SELECT 1 FROM ${T.accounts} ra WHERE ra.inbound_campaign_id = c.id OR ra.missed_call_campaign_id = c.id)
)`;

/** Campaign c is database reactivation. campaign_type alone cannot say: it defaults to 'reactivation'. */
export const dbrCampaignSql = sql`(
  c.id IS NOT NULL AND c.campaign_type = 'reactivation'
  AND COALESCE(c.is_demo, false) = false AND NOT ${receptionistCampaignSql}
)`;

/** Campaign c belongs to the Reputation service. */
export const reputationCampaignSql = sql`(c.id IS NOT NULL AND c.campaign_type = 'reputation' AND COALESCE(c.is_demo, false) = false)`;

/** Campaign c belongs to the Social service (Instagram comment-to-DM). */
export const socialCampaignSql = sql`(
  c.id IS NOT NULL AND COALESCE(c.is_demo, false) = false
  AND (c.campaign_type = 'social_reply' OR lower(COALESCE(c.channel, '')) = 'instagram')
)`;

/** Lead l (campaign c) is in the receptionist stream: not DBR, not Reputation, not Social. */
export const receptionistLeadSql = sql`(
  NOT ${dbrCampaignSql}
  AND COALESCE(c.campaign_type, '') NOT IN ('reputation', 'social_reply')
  AND lower(COALESCE(c.channel, '')) <> 'instagram'
)`;

/** Call vc is live. Mirror of IS_LIVE_SQL in automations client_alerts/live_calls.py. */
export const liveCallSql = sql`(
  vc.test_account_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM ${T.campaigns} dc WHERE dc.id = vc.campaigns_id AND dc.is_demo = true)
  AND NOT EXISTS (SELECT 1 FROM ${T.leads} dl WHERE dl.id = vc.leads_id
                  AND (dl.demo_niche IS NOT NULL OR dl.channel_identifier LIKE 'wa-demo:%' OR dl.channel_identifier LIKE 'web-demo:%'))
  AND NOT EXISTS (SELECT 1 FROM ${T.voiceNumbers} dn WHERE dn.id = vc.voice_numbers_id AND dn.client_niche IS NULL)
  AND NOT (vc.voice_numbers_id IS NULL AND vc.campaigns_id IS NULL)
)`;

/** Mirror of call_needs_callback in automations client_alerts/events.py. */
export const needsCallbackSql = sql`(
  COALESCE(vc.outcome, '') <> 'booked'
  AND (vc.outcome = 'callback' OR vc.transfer_outcome = 'failed'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(vc.summary -> 'items') = 'array' THEN vc.summary -> 'items' ELSE '[]'::jsonb END) it
            WHERE it ->> 'intent' = 'leave_message'))
)`;

/** Interaction i was written by a person, not the AI. Same rule as the recap. */
export const humanOutboundSql = sql`(
  COALESCE(i.ai_generated, false) = false
  AND (i.triggered_by IS NULL OR i.triggered_by IN ('manual', 'crm', 'user'))
)`;

export interface Bounds extends PeriodDates { tz: string }

function validTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

/** Period bounds in the account's timezone; the agency timezone for all accounts. */
export async function boundsFor(q: HomeQuery): Promise<Bounds> {
  let tz = DEFAULT_TZ;
  if (q.accountId !== null && q.accountId > 0) {
    const [a] = await db.select({ timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, q.accountId));
    tz = validTz(a?.timezone);
  }
  return { ...periodDates(q.period, todayIn(tz)), tz };
}

/** A local date as an instant: start of that day in the timezone. */
export const at = (date: string, tz: string): SQL => sql`((${date}::date)::timestamp AT TIME ZONE ${tz})`;
/** Account filter. null = all accounts (agency only, decided in homeScope). */
export const acct = (column: string, accountId: number | null): SQL =>
  accountId === null ? sql`TRUE` : sql`${sql.raw(column)} = ${accountId}`;
export const dayOf = (column: string, tz: string): SQL =>
  sql`to_char(${sql.raw(column)} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
export const num = (v: unknown): number => Number(v ?? 0) || 0;

/** A value for every day of the period, zero where the query returned no row. */
export function fillDays(b: Bounds, rows: { day: string; value: number }[]): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  return eachDay(b.from, b.to).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}
```

- [ ] **Step 2: Write `server/storage/homeServices.ts`**

```ts
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeServices } from "@shared/homeTypes";
import { T, acct, dbrCampaignSql, reputationCampaignSql, socialCampaignSql } from "./homeSql";

async function getHomeServices(accountId: number | null): Promise<HomeServices> {
  const result = await db.execute(sql`
    SELECT
      EXISTS (SELECT 1 FROM ${T.voiceNumbers} n
              WHERE n.enabled = true AND n.client_niche IS NOT NULL AND ${acct("n.accounts_id", accountId)}) AS phone,
      EXISTS (SELECT 1 FROM ${T.accounts} a
              WHERE ${acct("a.id", accountId)} AND a.inbound_campaign_id IS NOT NULL
                AND (a.whatsapp_sender_status = 'approved'
                     OR EXISTS (SELECT 1 FROM ${T.whatsappSenders} s WHERE s.accounts_id = a.id AND s.status = 'connected'))) AS whatsapp,
      EXISTS (SELECT 1 FROM ${T.widgetConfigs} w
              WHERE w.enabled = true AND jsonb_array_length(COALESCE(w.allowed_domains, '[]'::jsonb)) > 0
                AND ${acct('w."Accounts_id"', accountId)}) AS website,
      EXISTS (SELECT 1 FROM ${T.campaigns} c
              WHERE ${acct('c."Accounts_id"', accountId)} AND ${dbrCampaignSql}) AS reactivation,
      -- Reputation: review requests switched on with a real campaign, or Google reviews connected.
      (EXISTS (SELECT 1 FROM ${T.campaigns} c JOIN ${T.accounts} a ON a.id = c."Accounts_id"
               WHERE ${acct('c."Accounts_id"', accountId)} AND ${reputationCampaignSql}
                 AND a.enable_reputation_management = true)
       OR EXISTS (SELECT 1 FROM ${T.calendarConnections} g
                  WHERE g.provider = 'gbp' AND g.external_id IS NOT NULL
                    AND ${acct("g.accounts_id", accountId)})) AS reputation,
      -- Social: an Instagram account connected and a real social campaign.
      EXISTS (SELECT 1 FROM ${T.campaigns} c JOIN ${T.accounts} a ON a.id = c."Accounts_id"
              WHERE ${acct('c."Accounts_id"', accountId)} AND ${socialCampaignSql}
                AND a.instagram_access_token IS NOT NULL) AS social,
      EXISTS (SELECT 1 FROM ${T.accounts} a
              WHERE ${acct("a.id", accountId)} AND COALESCE(a.sms_sender_id, '') <> '') AS sms
  `);
  const r = (result.rows as Record<string, unknown>[])[0] ?? {};
  // All accounts: the agency sees every tab, whether or not any account has the service yet.
  const all = accountId === null;
  return {
    phone: all || r.phone === true,
    whatsapp: all || r.whatsapp === true,
    website: all || r.website === true,
    reactivation: all || r.reactivation === true,
    reputation: all || r.reputation === true,
    social: all || r.social === true,
    sms: r.sms === true,
  };
}

export const homeServicesStorage = { getHomeServices };
```

`Calendar_Connections` is not in the casing list of the Global Constraints: before saving, read its Drizzle definition in `shared/schema.ts` and use its real account column name in the `g.accounts_id` filter (it may be `"Accounts_id"`).

- [ ] **Step 3: Write `server/storage/homeOverview.ts`**

```ts
/**
 * Overview tab. Definitions follow the daily client recap
 * (automations client_alerts/recap_data.py) so the two always agree.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { ActivityRow, AttentionRow, HomeChannel, HomeOverview } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import {
  T, acct, at, boundsFor, dayOf, fillDays, humanOutboundSql,
  liveCallSql, liveLeadSql, needsCallbackSql, num, receptionistLeadSql,
} from "./homeSql";

const TEXT_CHANNELS: HomeChannel[] = ["whatsapp", "website", "sms"];
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const iso = (v: unknown) => new Date(v as string).toISOString();

async function getHomeOverview(q: HomeQuery): Promise<HomeOverview> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);

  // Inbound non-phone messages from receptionist leads, both periods.
  // channel NULL (unclassified) still counts as a conversation, under no channel.
  // channel 'other' is a system event (restart marker, booking note), never a conversation.
  const msg = sql`
    SELECT i."Leads_id" AS lead_id, COALESCE(i.channel, 'other') AS channel, i.created_at, l.created_at AS lead_created
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.direction = 'inbound'
      AND COALESCE(i.channel, 'unclassified') NOT IN ('phone', 'other')
      AND i.created_at >= ${prev} AND i.created_at < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;
  const calls = sql`
    SELECT vc.started_at, ${needsCallbackSql} AS cb
    FROM ${T.voiceCalls} vc
    WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${prev} AND vc.started_at < ${end} AND ${liveCallSql}`;
  const bookings = sql`
    SELECT COALESCE(l.booking_channel, 'other') AS channel, COALESCE(l.booked_at, l.booking_confirmed_at_) AS booked
    FROM ${T.leads} l
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL
      AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${prev}
      AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;

  const [totals, chanMsg, chanBook, days, attention, activity] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg}), calls AS (${calls}), bk AS (${bookings})
      SELECT
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at >= ${cur})::int AS chats,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at < ${prevEnd})::int AS chats_prev,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at >= ${cur} AND lead_created >= ${cur})::int AS new_contacts,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at < ${prevEnd} AND lead_created >= ${prev})::int AS new_contacts_prev,
        (SELECT count(*) FROM calls WHERE started_at >= ${cur})::int AS calls,
        (SELECT count(*) FROM calls WHERE started_at < ${prevEnd})::int AS calls_prev,
        (SELECT count(*) FROM calls WHERE started_at >= ${cur} AND cb)::int AS callbacks,
        (SELECT count(*) FROM calls WHERE started_at < ${prevEnd} AND cb)::int AS callbacks_prev,
        (SELECT count(*) FROM bk WHERE booked >= ${cur})::int AS bookings,
        (SELECT count(*) FROM bk WHERE booked < ${prevEnd})::int AS bookings_prev`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT channel, count(DISTINCT lead_id)::int AS n FROM msg WHERE created_at >= ${cur} GROUP BY channel`),
    db.execute(sql`
      WITH bk AS (${bookings})
      SELECT channel, count(*)::int AS n FROM bk WHERE booked >= ${cur} GROUP BY channel`),
    db.execute(sql`
      WITH msg AS (${msg}), calls AS (${calls})
      SELECT day, sum(n)::int AS value FROM (
        SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id) AS n FROM msg WHERE created_at >= ${cur} GROUP BY 1
        UNION ALL
        SELECT ${dayOf("started_at", b.tz)} AS day, count(*) AS n FROM calls WHERE started_at >= ${cur} GROUP BY 1
      ) d GROUP BY day`),
    // The current to-do list: not tied to the period.
    db.execute(sql`
      SELECT * FROM (
        SELECT CASE WHEN vc.transfer_outcome = 'failed' THEN 'transfer_failed' ELSE 'callback' END AS kind,
               'phone' AS channel, vc.leads_id AS lead_id, vc.call_id,
               NULLIF(trim(concat_ws(' ', cl.first_name, cl.last_name)), '') AS name, vc.started_at AS at
        FROM ${T.voiceCalls} vc
        LEFT JOIN ${T.leads} cl ON cl.id = vc.leads_id
        WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at > now() - interval '7 days'
          AND ${liveCallSql} AND ${needsCallbackSql}
        UNION ALL
        SELECT 'handoff' AS kind,
               COALESCE((SELECT li.channel FROM ${T.interactions} li WHERE li."Leads_id" = l.id AND li.direction = 'inbound'
                         AND li.channel IN ('whatsapp', 'sms', 'website', 'phone') ORDER BY li.created_at DESC LIMIT 1), 'whatsapp') AS channel,
               l.id AS lead_id, NULL AS call_id,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name,
               COALESCE(l.last_message_received_at, l.updated_at) AS at
        FROM ${T.leads} l
        LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.manual_takeover = true
          AND ${liveLeadSql} AND ${receptionistLeadSql}
          AND NOT EXISTS (SELECT 1 FROM ${T.interactions} i WHERE i."Leads_id" = l.id AND i.direction = 'outbound'
                          AND i.created_at > COALESCE(l.last_message_received_at, l.updated_at) AND ${humanOutboundSql})
      ) a ORDER BY at DESC NULLS LAST LIMIT 50`),
    db.execute(sql`
      SELECT * FROM (
        SELECT 'booked' AS kind, COALESCE(l.booking_channel, 'booking_page') AS channel, l.id AS lead_id, NULL AS call_id,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name,
               COALESCE(l.booked_at, l.booking_confirmed_at_) AS at
        FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL
          AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${cur} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
          AND ${liveLeadSql} AND ${receptionistLeadSql}
        UNION ALL
        SELECT CASE WHEN vc.outcome = 'transferred' THEN 'transferred' ELSE 'call' END, 'phone', vc.leads_id, vc.call_id,
               NULLIF(trim(concat_ws(' ', cl.first_name, cl.last_name)), ''), vc.started_at
        FROM ${T.voiceCalls} vc LEFT JOIN ${T.leads} cl ON cl.id = vc.leads_id
        WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${cur} AND vc.started_at < ${end} AND ${liveCallSql}
        UNION ALL
        SELECT 'chat_started', 'website', l.id, NULL,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), ''), l.created_at
        FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.channel_identifier LIKE 'web:%'
          AND l.created_at >= ${cur} AND l.created_at < ${end} AND ${liveLeadSql}
        UNION ALL
        SELECT 'followup_sent', CASE WHEN f.channel = 'sms' THEN 'sms' ELSE 'whatsapp' END, f.leads_id, NULL,
               NULLIF(trim(concat_ws(' ', fl.first_name, fl.last_name)), ''), f.created_at
        FROM ${T.callFollowupLog} f LEFT JOIN ${T.leads} fl ON fl.id = f.leads_id
        WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent'
          AND f.created_at >= ${cur} AND f.created_at < ${end}
      ) a ORDER BY at DESC NULLS LAST LIMIT 12`),
  ]);

  const t = rows(totals)[0] ?? {};
  const msgBy = new Map(rows(chanMsg).map((r) => [String(r.channel), num(r.n)]));
  const bookBy = new Map(rows(chanBook).map((r) => [String(r.channel), num(r.n)]));
  const attentionRows = rows(attention);

  return {
    conversations: { value: num(t.chats) + num(t.calls), previous: num(t.chats_prev) + num(t.calls_prev) },
    bookings: { value: num(t.bookings), previous: num(t.bookings_prev) },
    callbacks: { value: num(t.callbacks), previous: num(t.callbacks_prev) },
    newContacts: { value: num(t.new_contacts), previous: num(t.new_contacts_prev) },
    waiting: attentionRows.length,
    byChannel: [
      { channel: "phone" as HomeChannel, conversations: num(t.calls), bookings: bookBy.get("phone") ?? 0 },
      ...TEXT_CHANNELS.map((channel) => ({ channel, conversations: msgBy.get(channel) ?? 0, bookings: bookBy.get(channel) ?? 0 })),
    ],
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    attention: attentionRows.slice(0, 8).map((r): AttentionRow => ({
      kind: r.kind as AttentionRow["kind"], channel: r.channel as HomeChannel,
      leadId: r.lead_id == null ? null : num(r.lead_id), callId: (r.call_id as string | null) ?? null,
      name: (r.name as string | null) ?? null, at: iso(r.at),
    })),
    activity: rows(activity).map((r): ActivityRow => ({
      kind: r.kind as ActivityRow["kind"], channel: r.channel as ActivityRow["channel"],
      leadId: r.lead_id == null ? null : num(r.lead_id), callId: (r.call_id as string | null) ?? null,
      name: (r.name as string | null) ?? null, at: iso(r.at),
    })),
  };
}

export const homeOverviewStorage = { getHomeOverview };
```

`f.decision = 'sent'` is confirmed: `after_call_followup.py` stores `sent` for a delivered follow-up, with `channel` `whatsapp_template`, `whatsapp_text` or `sms`.

- [ ] **Step 4: Run it against the real database**

Create `scratch-home.ts` in the session scratchpad directory (not in the repo):

```ts
import { homeServicesStorage } from "/home/gabriel/LeadAwakerApp/server/storage/homeServices";
import { homeOverviewStorage } from "/home/gabriel/LeadAwakerApp/server/storage/homeOverview";

for (const accountId of [53, 1, null, 47, -1]) {
  console.log("account", accountId, await homeServicesStorage.getHomeServices(accountId));
  for (const period of ["month", "7d", "30d", "last_month"] as const) {
    const o = await homeOverviewStorage.getHomeOverview({ accountId, period, campaignId: null });
    console.log(" ", period, JSON.stringify({ ...o, perDay: o.perDay.length, attention: o.attention.length, activity: o.activity.length }));
  }
}
process.exit(0);
```

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env --import tsx <scratchpad>/scratch-home.ts`
Expected:
- No SQL error for any account or period.
- Account 53 (Robben): `phone: true, website: true, whatsapp: false, reactivation: false`.
- Account 47 (Sandbox, no services) and account -1: all counts zero, `perDay` has one entry per day of the period, lists empty. No error.
- `null`: all four tabs true.
- For account 53, `conversations.value` for `7d` equals this check: `SELECT count(*) FROM p2mxx34fvbf3ll6."Voice_Calls" WHERE accounts_id = 53 AND started_at > now() - interval '7 days'` minus demo and test calls, plus distinct chat leads. A mismatch of more than a call or two (period edges) means a filter is wrong.

### Task B4: Phone summary

**Files:**
- Create: `server/storage/homePhone.ts`

**Interfaces:**
- Produces: `homePhoneStorage.getHomePhone(q: HomeQuery): Promise<HomePhone>`.

- [ ] **Step 1: Write the module**

```ts
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { CallOutcome, HomePhone } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { DEFAULT_TZ, T, acct, at, boundsFor, dayOf, fillDays, liveCallSql, num } from "./homeSql";

const OUTCOMES: CallOutcome[] = ["booked", "callback", "transferred", "hung_up", "other"];
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const outcomeOf = (v: unknown): CallOutcome => (OUTCOMES.includes(v as CallOutcome) ? (v as CallOutcome) : "other");

async function getHomePhone(q: HomeQuery): Promise<HomePhone> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);

  // ended_at, else the last transcript turn (a tab closed before wrap-up leaves ended_at null).
  const calls = sql`
    SELECT vc.call_id, vc.started_at, vc.caller_number, vc.leads_id, vc.transfer_outcome, vc.screened_kind,
           CASE WHEN vc.outcome IN ('booked', 'callback', 'transferred', 'hung_up') THEN vc.outcome
                WHEN vc.booked_iso IS NOT NULL THEN 'booked' ELSE 'other' END AS outcome,
           GREATEST(EXTRACT(EPOCH FROM (COALESCE(vc.ended_at,
             (SELECT max(ti.created_at) FROM ${T.interactions} ti WHERE ti.conversation_thread_id = vc.call_id)) - vc.started_at)), 0) AS seconds,
           CASE WHEN a.business_hours_start IS NULL OR a.business_hours_end IS NULL THEN NULL
                ELSE NOT (
                  EXTRACT(dow FROM vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::int
                    IN (SELECT (jsonb_array_elements_text(COALESCE(a.open_days, '[1,2,3,4,5]'::jsonb)))::int)
                  AND (vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::time >= a.business_hours_start
                  AND (vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::time < a.business_hours_end)
           END AS out_of_hours
    FROM ${T.voiceCalls} vc
    JOIN ${T.accounts} a ON a.id = vc.accounts_id
    WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${prev} AND vc.started_at < ${end} AND ${liveCallSql}`;

  const [totals, byOutcome, days, recent] = await Promise.all([
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT
        count(*) FILTER (WHERE started_at >= ${cur})::int AS calls,
        count(*) FILTER (WHERE started_at < ${prevEnd})::int AS calls_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND outcome = 'booked')::int AS booked,
        count(*) FILTER (WHERE started_at < ${prevEnd} AND outcome = 'booked')::int AS booked_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred,
        count(*) FILTER (WHERE started_at < ${prevEnd} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND transfer_outcome = 'failed')::int AS transfers_failed,
        avg(seconds) FILTER (WHERE started_at >= ${cur} AND seconds >= 10) AS avg_seconds,
        avg(seconds) FILTER (WHERE started_at < ${prevEnd} AND seconds >= 10) AS avg_seconds_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND screened_kind IN ('sales_pitch', 'robocall'))::int AS screened,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours = true)::int AS out_of_hours,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours IS NOT NULL)::int AS hours_known`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT outcome, count(*)::int AS n FROM calls WHERE started_at >= ${cur} GROUP BY outcome`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT ${dayOf("started_at", b.tz)} AS day, count(*)::int AS value FROM calls WHERE started_at >= ${cur} GROUP BY 1`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT c.call_id, c.started_at, c.caller_number, c.outcome, c.seconds,
             NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
      FROM calls c LEFT JOIN ${T.leads} l ON l.id = c.leads_id
      WHERE c.started_at >= ${cur} ORDER BY c.started_at DESC LIMIT 8`),
  ]);

  const t = rows(totals)[0] ?? {};
  const byOut = new Map(rows(byOutcome).map((r) => [String(r.outcome), num(r.n)]));
  const known = num(t.hours_known);
  return {
    calls: { value: num(t.calls), previous: num(t.calls_prev) },
    booked: { value: num(t.booked), previous: num(t.booked_prev) },
    transferred: { value: num(t.transferred), previous: num(t.transferred_prev) },
    avgSeconds: { value: Math.round(num(t.avg_seconds)), previous: Math.round(num(t.avg_seconds_prev)) },
    transfersFailed: num(t.transfers_failed),
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    outcomes: OUTCOMES.map((outcome) => ({ outcome, count: byOut.get(outcome) ?? 0 })),
    outOfHoursPct: known === 0 ? null : Math.round((num(t.out_of_hours) / known) * 100),
    screened: num(t.screened),
    recent: rows(recent).map((r) => ({
      callId: String(r.call_id), name: (r.name as string | null) ?? null,
      callerNumber: (r.caller_number as string | null) ?? null, outcome: outcomeOf(r.outcome),
      seconds: r.seconds == null ? null : Math.round(num(r.seconds)), at: new Date(r.started_at as string).toISOString(),
    })),
  };
}

export const homePhoneStorage = { getHomePhone };
```

- [ ] **Step 2: Run it against the real database**

Add to the scratch script: `import { homePhoneStorage } from ".../server/storage/homePhone";` and print `getHomePhone` for accounts 53, 47 and null over all four periods.
Expected: no SQL error. Account 53 "month" `calls.value` matches the Voice tab's month tile on `/platform/accounts?tab=voice` minus any demo or staff test calls. Account 47: all zeros, `outOfHoursPct: null`, five outcome rows of zero.

### Task B5: WhatsApp (with SMS) and Website summaries

**Files:**
- Create: `server/storage/homeMessaging.ts`, `server/storage/homeWebsite.ts`

**Interfaces:**
- Produces: `homeMessagingStorage.getHomeWhatsapp(q): Promise<HomeWhatsapp>`, `homeWebsiteStorage.getHomeWebsite(q): Promise<HomeWebsite>`.

- [ ] **Step 1: Write `server/storage/homeMessaging.ts`**

```ts
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { HomeWhatsapp, RecentLead } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, at, boundsFor, dayOf, fillDays, humanOutboundSql, liveLeadSql, num, receptionistLeadSql } from "./homeSql";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

/** Receptionist messages on one channel, both periods. Shared with the Website tab. */
export const channelMessagesSql = (q: HomeQuery, channel: "whatsapp" | "website", prev: SQL, end: SQL) => sql`
  SELECT i."Leads_id" AS lead_id, i.direction, i.created_at, i."Content" AS content, ${humanOutboundSql} AS human
  FROM ${T.interactions} i
  JOIN ${T.leads} l ON l.id = i."Leads_id"
  LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
  WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.channel = ${channel}
    AND i.created_at >= ${prev} AND i.created_at < ${end}
    AND ${liveLeadSql} AND ${receptionistLeadSql}`;

export const recentLeadsSql = (msg: SQL, cur: SQL) => sql`
  WITH msg AS (${msg})
  SELECT m.lead_id, m.created_at AS at, left(m.content, 90) AS snippet,
         NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
  FROM (SELECT DISTINCT ON (lead_id) lead_id, created_at, content FROM msg
        WHERE created_at >= ${cur} AND direction = 'inbound' ORDER BY lead_id, created_at DESC) m
  JOIN ${T.leads} l ON l.id = m.lead_id
  ORDER BY m.created_at DESC LIMIT 8`;

export const toRecent = (r: Row): RecentLead => ({
  leadId: num(r.lead_id), name: (r.name as string | null) ?? null,
  at: new Date(r.at as string).toISOString(), snippet: String(r.snippet ?? ""),
});

async function getHomeWhatsapp(q: HomeQuery): Promise<HomeWhatsapp> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);
  const msg = channelMessagesSql(q, "whatsapp", prev, end);

  const [totals, days, recent, extras, sms] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS conversations,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS conversations_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS msg_in,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS msg_in_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound')::int AS msg_out,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound')::int AS msg_out_prev,
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound' AND human)::int AS handed_off,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound' AND human)::int AS handed_off_prev`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id)::int AS value
      FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1`),
    db.execute(recentLeadsSql(msg, cur)),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'whatsapp'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${cur} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
            AND ${liveLeadSql} AND ${receptionistLeadSql})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'whatsapp'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${prev} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${prevEnd}
            AND ${liveLeadSql} AND ${receptionistLeadSql})::int AS bookings_prev,
        -- Call_Followup_Log.channel is whatsapp_template | whatsapp_text | sms (after_call_followup.py).
        (SELECT count(*) FROM ${T.callFollowupLog} f
          WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent'
            AND f.created_at >= ${cur} AND f.created_at < ${end})::int AS follow_ups,
        (SELECT count(*) FROM ${T.callFollowupLog} f
          WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent' AND f.channel = 'sms'
            AND f.created_at >= ${cur} AND f.created_at < ${end})::int AS follow_ups_sms,
        EXISTS (SELECT 1 FROM ${T.accounts} a WHERE ${acct("a.id", q.accountId)} AND COALESCE(a.sms_sender_id, '') <> '') AS sms_on,
        (SELECT s.status FROM ${T.whatsappSenders} s WHERE ${acct("s.accounts_id", q.accountId)} ORDER BY s.id LIMIT 1) AS sender_status,
        (SELECT s.quality_rating FROM ${T.whatsappSenders} s WHERE ${acct("s.accounts_id", q.accountId)} ORDER BY s.id LIMIT 1) AS sender_quality`),
    // SMS sends to real leads only (demo excluded, like every other number).
    db.execute(sql`
      SELECT count(*)::int AS sent,
             count(*) FILTER (WHERE i.status = 'Delivered')::int AS delivered,
             count(*) FILTER (WHERE i.status = 'Failed')::int AS failed
      FROM ${T.interactions} i
      JOIN ${T.leads} l ON l.id = i."Leads_id"
      LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.channel = 'sms' AND i.direction = 'outbound'
        AND i.created_at >= ${cur} AND i.created_at < ${end} AND ${liveLeadSql}`),
  ]);

  const t = rows(totals)[0] ?? {};
  const x = rows(extras)[0] ?? {};
  const m = rows(sms)[0] ?? {};
  const smsSent = num(m.sent);
  const followUps = num(x.follow_ups);
  return {
    conversations: { value: num(t.conversations), previous: num(t.conversations_prev) },
    messagesIn: { value: num(t.msg_in), previous: num(t.msg_in_prev) },
    messagesOut: { value: num(t.msg_out), previous: num(t.msg_out_prev) },
    bookings: { value: num(x.bookings), previous: num(x.bookings_prev) },
    handedOff: { value: num(t.handed_off), previous: num(t.handed_off_prev) },
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    followUps,
    sms: x.sms_on === true || smsSent > 0
      ? { sent: smsSent, delivered: num(m.delivered), failed: num(m.failed),
          followUpShare: followUps === 0 ? null : Math.round((num(x.follow_ups_sms) / followUps) * 100) }
      : null,
    // One sender per account. In the all-accounts view there is no single number to report.
    sender: q.accountId === null || x.sender_status == null ? null
      : { connected: x.sender_status === "connected", quality: (x.sender_quality as string | null) ?? null },
    recent: rows(recent).map(toRecent),
  };
}

export const homeMessagingStorage = { getHomeWhatsapp };
```


- [ ] **Step 2: Write `server/storage/homeWebsite.ts`**

```ts
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeWebsite } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, at, boundsFor, dayOf, fillDays, liveLeadSql, num } from "./homeSql";
import { channelMessagesSql, recentLeadsSql, toRecent } from "./homeMessaging";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function getHomeWebsite(q: HomeQuery): Promise<HomeWebsite> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);
  const msg = channelMessagesSql(q, "website", prev, end);

  // A chat is "started" when a visitor sends a first message. A widget lead that
  // only received the greeting never appears in msg as inbound.
  const [totals, days, recent] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg}),
      chats AS (SELECT lead_id, min(created_at) AS first_at FROM msg WHERE direction = 'inbound' GROUP BY lead_id)
      SELECT
        count(*) FILTER (WHERE ch.first_at >= ${cur})::int AS chats,
        count(*) FILTER (WHERE ch.first_at < ${prevEnd})::int AS chats_prev,
        count(*) FILTER (WHERE ch.first_at >= ${cur} AND (COALESCE(l.phone, '') <> '' OR COALESCE(l."Email", '') <> ''))::int AS contacts,
        count(*) FILTER (WHERE ch.first_at < ${prevEnd} AND (COALESCE(l.phone, '') <> '' OR COALESCE(l."Email", '') <> ''))::int AS contacts_prev,
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'website'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${cur} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
            AND ${liveLeadSql})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'website'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${prev} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${prevEnd}
            AND ${liveLeadSql})::int AS bookings_prev
      FROM chats ch JOIN ${T.leads} l ON l.id = ch.lead_id`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id)::int AS value
      FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1`),
    db.execute(recentLeadsSql(msg, cur)),
  ]);

  const t = rows(totals)[0] ?? {};
  return {
    chats: { value: num(t.chats), previous: num(t.chats_prev) },
    contacts: { value: num(t.contacts), previous: num(t.contacts_prev) },
    bookings: { value: num(t.bookings), previous: num(t.bookings_prev) },
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    recent: rows(recent).map(toRecent),
  };
}

export const homeWebsiteStorage = { getHomeWebsite };
```

The "first_at" filter counts a chat that started in the previous period and continued into this one once, in the period where it started. The capture rate is computed on the client from `contacts` and `chats`.

- [ ] **Step 3: Run both against the real database**

Add both to the scratch script for accounts 53, 1, 47 and null, all four periods.
Expected: no SQL error. Account 1 "30d" `chats.value` is close to the count of `Source = 'Website Chat'` leads created in the last 30 days that sent a message (8 website-chat leads existed in total on 2026-10-12). Account 53 WhatsApp returns zeros and `sender: null`. Account 47 returns zeros and empty lists.

### Task B6: Reactivation summary

**Files:**
- Create: `server/storage/homeReactivation.ts`

**Interfaces:**
- Produces: `homeReactivationStorage.getHomeReactivation(q: HomeQuery): Promise<HomeReactivation>`. `q.campaignId` narrows to one DBR campaign; a campaign that is not DBR or not in the account returns zeros.

- [ ] **Step 1: Write the module**

```ts
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeReactivation } from "@shared/homeTypes";
import { eachDay } from "@shared/homePeriod";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, at, boundsFor, dayOf, dbrCampaignSql, liveLeadSql, num } from "./homeSql";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function getHomeReactivation(q: HomeQuery): Promise<HomeReactivation> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);
  const campaign = q.campaignId === null ? sql`TRUE` : sql`c.id = ${q.campaignId}`;
  const scope = sql`${acct('l."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${liveLeadSql} AND ${campaign}`;

  const msg = sql`
    SELECT i."Leads_id" AS lead_id, i.direction, i.created_at
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${scope} AND i.created_at >= ${prev} AND i.created_at < ${end}`;
  const booked = sql`COALESCE(l.booked_at, l.booking_confirmed_at_)`;

  const [totals, days, pipeline, campaigns] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound')::int AS contacted,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound')::int AS contacted_prev,
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS replied,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS replied_prev,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${cur} AND ${booked} < ${end})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${prev} AND ${booked} < ${prevEnd})::int AS bookings_prev,
        (SELECT sum(COALESCE(c.total_cost, 0)) FROM ${T.campaigns} c
          WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${campaign}) AS total_cost,
        (SELECT sum(COALESCE(c.bookings_generated, 0)) FROM ${T.campaigns} c
          WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${campaign}) AS total_bookings`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT day, sum(replies)::int AS replies, sum(bookings)::int AS bookings FROM (
        SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id) AS replies, 0 AS bookings
        FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1
        UNION ALL
        SELECT to_char(${booked} AT TIME ZONE ${b.tz}, 'YYYY-MM-DD'), 0, count(*)
        FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${cur} AND ${booked} < ${end} GROUP BY 1
      ) d GROUP BY day`),
    db.execute(sql`
      SELECT COALESCE(NULLIF(l."Conversion_Status", ''), 'New') AS status, count(*)::int AS n
      FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${scope} GROUP BY 1 ORDER BY 2 DESC`),
    db.execute(sql`
      SELECT c.id, c.name FROM ${T.campaigns} c
      WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} ORDER BY c.name`),
  ]);

  const t = rows(totals)[0] ?? {};
  const byDay = new Map(rows(days).map((r) => [String(r.day), r]));
  const totalBookings = num(t.total_bookings);
  return {
    contacted: { value: num(t.contacted), previous: num(t.contacted_prev) },
    replied: { value: num(t.replied), previous: num(t.replied_prev) },
    bookings: { value: num(t.bookings), previous: num(t.bookings_prev) },
    // Lifetime cost over lifetime bookings: campaign cost is not stored per period.
    costPerBooking: totalBookings === 0 ? null : Math.round((num(t.total_cost) / totalBookings) * 100) / 100,
    perDay: eachDay(b.from, b.to).map((day) => ({
      day, replies: num(byDay.get(day)?.replies), bookings: num(byDay.get(day)?.bookings),
    })),
    pipeline: rows(pipeline).map((r) => ({ status: String(r.status), count: num(r.n) })),
    campaigns: rows(campaigns).map((r) => ({ id: num(r.id), name: String(r.name ?? "") })),
  };
}

export const homeReactivationStorage = { getHomeReactivation };
```

- [ ] **Step 2: Run it against the real database**

Expected: no SQL error for accounts 53, 1, 47, null and for `campaignId: 71` (a receptionist campaign: zeros). On 2026-10-12 no account has a live DBR campaign, so every account returns zeros and `campaigns: []`. To see non-zero numbers, temporarily drop `COALESCE(c.is_demo, false) = false` from `dbrCampaignSql` in a local copy of the query and check against a demo campaign, then restore it.

### Task B6R: Reputation and Social summaries

Added on 2026-10-12 at Gabriel's request: Reputation and Social Media Manager are services too, and get their own tabs. Neither has real data yet (0 Google reviews, 0 non-demo review requests, 0 non-demo Instagram conversations), so every query must return zeros and empty lists cleanly, and both become useful the day a client goes live.

**Files:**
- Create: `server/storage/homeReputation.ts`, `server/storage/homeSocial.ts`

**Interfaces:**
- Consumes: `HomeQuery` (B2), `HomeReputation`, `HomeSocial` (B1), and from `homeSql.ts`: `T`, `acct`, `at`, `boundsFor`, `dayOf`, `fillDays`, `liveLeadSql`, `reputationCampaignSql`, `socialCampaignSql`, `num`; from `homeMessaging.ts`: `recentLeadsSql`, `toRecent`.
- Produces: `homeReputationStorage.getHomeReputation(q: HomeQuery): Promise<HomeReputation>`, `homeSocialStorage.getHomeSocial(q: HomeQuery): Promise<HomeSocial>`.

Follow the structure of `server/storage/homePhone.ts` and `homeMessaging.ts` exactly (same helpers, same `rows()` / `num()` idiom, `Promise.all` of `db.execute(sql\`...\`)`, current and previous period from `boundsFor`).

- [ ] **Step 1: Read the real columns.** In `shared/schema.ts` read the `Account_Reviews` table (near line 1873: `accounts_id`, `platform`, `author_name`, `rating`, `review_text`, `review_created_at`, `status`, `posted_reply`, `posted_at`) and `Calendar_Connections` (`provider`, `external_id`, account column), and on `Leads` the columns `review_request_sent_at`, `review_rating`, `review_outcome`. Use the real SQL names and casing.

- [ ] **Step 2: Write `homeReputation.ts`** with these definitions:

| Field | Definition |
|---|---|
| `connected` | one account: a `Calendar_Connections` row with `provider = 'gbp'` and `external_id IS NOT NULL`. All accounts: `false`. |
| `reviews` | `Account_Reviews` rows for the account with `review_created_at` in the period (and in the previous period) |
| `avgRating` | `avg(rating)` of those rows, rounded to one decimal; `null` when there are none (never 0) |
| `replied` | rows with `posted_at` in the period |
| `awaitingReply` | rows with `status IN ('new', 'drafted', 'approved')`, any date |
| `requestsSent` | leads with `review_request_sent_at` in the period, on a campaign matching `reputationCampaignSql`, and `liveLeadSql` |
| `ratings` | five rows, rating 5 down to 1, count of period reviews each (zero-filled) |
| `perDay` | reviews per day by `review_created_at`, through `fillDays` |
| `recent` | the 8 newest reviews in the period: `id`, `author_name`, `rating`, first 140 characters of `review_text`, `replied` = `posted_at IS NOT NULL`, `at` = `review_created_at` |

`Account_Reviews` has no demo flag and no demo rows exist; do not invent a filter.

- [ ] **Step 3: Write `homeSocial.ts`**: the Social stream is messages and bookings of leads whose campaign matches `socialCampaignSql`, with `liveLeadSql`.

| Field | Definition |
|---|---|
| `connected` | one account: `Accounts.instagram_access_token IS NOT NULL`. All accounts: `false`. |
| `conversations` | distinct leads with an inbound message in the period |
| `messagesIn`, `messagesOut` | message counts by direction |
| `bookings` | leads with `booked_call_date IS NOT NULL` and `COALESCE(booked_at, booking_confirmed_at_)` in the period |
| `perDay` | distinct leads with an inbound message per day |
| `recent` | `recentLeadsSql` over the stream's messages |

Build the message set as a subquery shaped like `channelMessagesSql` (columns `lead_id, direction, created_at, content`) but filtered by `socialCampaignSql` instead of a channel, so `recentLeadsSql` and `toRecent` can be reused. Never filter on `Interactions.channel` here: Instagram messages are stored as `other`.

- [ ] **Step 4: Run both against the real database** from a scratch script in the session scratchpad (never in the repo), for accounts 53, 1, 47, `null` and `-1`, all four periods:

Run: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env --import tsx <scratchpad>/scratch-home-rs.ts`
Expected: no SQL error anywhere; every account returns zeros, `avgRating` values `null`, `ratings` five rows of zero, `perDay` one entry per day, empty `recent`, `connected: false`. To see the queries count something, temporarily point a local copy of each query at the demo campaigns (drop the `is_demo = false` test, campaigns 69 and 70 on account 1) and confirm non-zero conversation and request counts, then restore.

### Task B7: Wire storage and routes

**Files:**
- Modify: `server/storage.ts` (imports near line 31, spread near line 102)
- Modify: `server/routes/index.ts` (import near line 50, call after line 110)
- Modify: `FILE_MAP.md`

- [ ] **Step 1: Compose the storage modules**

In `server/storage.ts`, add the imports after `import { numberRequestsStorage } ...`:

```ts
import { homeServicesStorage } from "./storage/homeServices";
import { homeOverviewStorage } from "./storage/homeOverview";
import { homePhoneStorage } from "./storage/homePhone";
import { homeMessagingStorage } from "./storage/homeMessaging";
import { homeWebsiteStorage } from "./storage/homeWebsite";
import { homeReactivationStorage } from "./storage/homeReactivation";
import { homeReputationStorage } from "./storage/homeReputation";
import { homeSocialStorage } from "./storage/homeSocial";
```

and spread them inside `export const storage = { ... }` after `...numberRequestsStorage,`:

```ts
  ...homeServicesStorage,
  ...homeOverviewStorage,
  ...homePhoneStorage,
  ...homeMessagingStorage,
  ...homeWebsiteStorage,
  ...homeReactivationStorage,
  ...homeReputationStorage,
  ...homeSocialStorage,
```

- [ ] **Step 2: Register the routes**

In `server/routes/index.ts`: `import { registerHomeRoutes } from "./home";` and, after `registerClientAlertsRoutes(app);`, `registerHomeRoutes(app);`.

- [ ] **Step 3: Verify over HTTP as the Owner and as a client**

```bash
sleep 9; pm2 logs leadawaker --lines 15 --nostream --err
J=<scratchpad>/owner.jar
curl -s -c $J -H 'Content-Type: application/json' -d '{"email":"leadawaker@gmail.com","password":"Admin1234"}' http://localhost:5000/api/auth/login -o /dev/null -w "%{http_code}\n"
for p in services overview phone whatsapp website reactivation reputation social; do
  curl -s -b $J "http://localhost:5000/api/home/$p?accountId=53&period=7d" | head -c 300; echo
done
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/home/overview
```

Expected: login `200`; eight JSON bodies with the shapes from Task B1; the unauthenticated call `401`. If the login path or field names differ, read `server/routes/` for the auth route first.

Then confirm the client lock in the browser: sign in as the Owner, use "view as" for account 53, and load `/api/home/overview?accountId=1` in that tab. The numbers must be account 53's, the same as `?accountId=53`.

- [ ] **Step 4: Update `FILE_MAP.md`** with the new server files under the storage and routes sections.

---

# Part C: The page

### Task C1: Formatting helpers

**Files:**
- Create: `client/src/features/home/lib/homeFormat.ts`
- Test: `client/src/features/home/lib/homeFormat.test.ts`

**Interfaces:**
- Produces:

```ts
export type Trend = { dir: "up" | "down" | "flat"; pct: number } | null;
/** Change vs the previous period. null when there is nothing to compare with. */
export function trendOf(c: { value: number; previous: number }): Trend
/** 134 -> "2m 14s", 45 -> "45s", 0 -> "0s". */
export function formatDuration(seconds: number | null | undefined): string
/** Whole percent, or null when the denominator is zero. */
export function rateOf(part: number, whole: number): number | null
/** Bar widths as percentages of the largest value; all zero stays zero. */
export function barWidths(values: number[]): number[]
```

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { barWidths, formatDuration, rateOf, trendOf } from "./homeFormat";

test("trend: up, down, flat", () => {
  assert.deepEqual(trendOf({ value: 118, previous: 100 }), { dir: "up", pct: 18 });
  assert.deepEqual(trendOf({ value: 80, previous: 100 }), { dir: "down", pct: 20 });
  assert.deepEqual(trendOf({ value: 50, previous: 50 }), { dir: "flat", pct: 0 });
});

test("trend: nothing to compare with is null, never Infinity or NaN", () => {
  assert.equal(trendOf({ value: 12, previous: 0 }), null);
  assert.equal(trendOf({ value: 0, previous: 0 }), null);
});

test("trend: a drop to zero is 100% down", () => {
  assert.deepEqual(trendOf({ value: 0, previous: 7 }), { dir: "down", pct: 100 });
});

test("duration", () => {
  assert.equal(formatDuration(134), "2m 14s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(120), "2m 0s");
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(null), "0s");
  assert.equal(formatDuration(-5), "0s");
});

test("rate: zero denominator is null", () => {
  assert.equal(rateOf(4, 38), 11);
  assert.equal(rateOf(0, 0), null);
  assert.equal(rateOf(3, 0), null);
});

test("bar widths scale to the largest; all zero stays zero", () => {
  assert.deepEqual(barWidths([96, 48, 0]), [100, 50, 0]);
  assert.deepEqual(barWidths([0, 0]), [0, 0]);
  assert.deepEqual(barWidths([]), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test client/src/features/home/lib/homeFormat.test.ts`
Expected: FAIL, cannot find module `./homeFormat`

- [ ] **Step 3: Implement**

```ts
export type Trend = { dir: "up" | "down" | "flat"; pct: number } | null;

export function trendOf(c: { value: number; previous: number }): Trend {
  if (!c.previous) return null;
  const pct = Math.round(((c.value - c.previous) / c.previous) * 100);
  return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", pct: Math.abs(pct) };
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function rateOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function barWidths(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 100) : 0));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --import tsx --test client/src/features/home/lib/homeFormat.test.ts`
Expected: 6 tests pass

### Task C2: API hooks, tokens, and shared components

**Files:**
- Create: `client/src/features/home/api/homeApi.ts`
- Create: `client/src/features/home/components/HomeBanner.tsx`, `StatRow.tsx`, `BarList.tsx`, `DayChart.tsx`, `RowList.tsx`, `EmptyState.tsx`
- Modify: `client/src/features/billing/components/workspace/atoms.tsx:115-129` (`StatCard`)
- Modify: `client/src/styles/variables.css` (`:root` block, after `--wine-grad`)
- Rewrite: `client/src/features/home/home.css`

**Interfaces:**
- Consumes: types from `@shared/homeTypes`, helpers from C1.
- Produces:

```ts
// api/homeApi.ts
export interface HomeScope { accountId: number; period: HomePeriod; campaignId?: number | null }
export function useHomeServices(accountId: number): UseQueryResult<HomeServices>
export function useHomeOverview(s: HomeScope): UseQueryResult<HomeOverview>
export function useHomePhone(s: HomeScope): UseQueryResult<HomePhone>
export function useHomeWhatsapp(s: HomeScope): UseQueryResult<HomeWhatsapp>
export function useHomeWebsite(s: HomeScope): UseQueryResult<HomeWebsite>
export function useHomeReactivation(s: HomeScope): UseQueryResult<HomeReactivation>

// components
HomeBanner({ eyebrow, value, sentence, trend, vsLabel, image }: { eyebrow: string; value: ReactNode; sentence: string; trend: Trend; vsLabel: string; image: string })
StatRow({ items }: { items: { key: string; label: string; value: ReactNode; compared?: Compared; sub?: ReactNode; filled?: boolean; onClick?: () => void }[] })
BarList({ rows, columns }: { rows: { key: string; label: string; icon?: ReactNode; value: number; extra?: ReactNode }[]; columns?: [string, string] })
DayChart({ data, label }: { data: DayPoint[]; label: string })
RowList({ rows, empty }: { rows: { key: string; title: ReactNode; meta?: ReactNode; tag?: ReactNode; time: string; onClick?: () => void }[]; empty: string })
EmptyState({ title, body }: { title: string; body: string })
```

- [ ] **Step 1: Write `api/homeApi.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type {
  HomeOverview, HomePeriod, HomePhone, HomeReactivation, HomeServices, HomeWebsite, HomeWhatsapp,
} from "@shared/homeTypes";

export interface HomeScope { accountId: number; period: HomePeriod; campaignId?: number | null }

async function getJson<T>(path: string, params: Record<string, string | number | null | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  const res = await apiFetch(`/api/home/${path}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

// The app's default staleTime is Infinity, so every dashboard query sets its own.
const STALE = 60 * 1000;

function useHome<T>(path: string, s: HomeScope) {
  return useQuery<T>({
    queryKey: ["/api/home", path, s.accountId, s.period, s.campaignId ?? null],
    queryFn: () => getJson<T>(path, { accountId: s.accountId, period: s.period, campaignId: s.campaignId }),
    staleTime: STALE,
  });
}

export function useHomeServices(accountId: number) {
  return useQuery<HomeServices>({
    queryKey: ["/api/home", "services", accountId],
    queryFn: () => getJson<HomeServices>("services", { accountId }),
    staleTime: 5 * STALE,
  });
}
export const useHomeOverview = (s: HomeScope) => useHome<HomeOverview>("overview", s);
export const useHomePhone = (s: HomeScope) => useHome<HomePhone>("phone", s);
export const useHomeWhatsapp = (s: HomeScope) => useHome<HomeWhatsapp>("whatsapp", s);
export const useHomeWebsite = (s: HomeScope) => useHome<HomeWebsite>("website", s);
export const useHomeReactivation = (s: HomeScope) => useHome<HomeReactivation>("reactivation", s);
export const useHomeReputation = (s: HomeScope) => useHome<HomeReputation>("reputation", s);
export const useHomeSocial = (s: HomeScope) => useHome<HomeSocial>("social", s);
```

(Add `HomeReputation` and `HomeSocial` to the type import.)

`accountId` is `useWorkspace().currentAccountId`, where 0 means all accounts. The server turns 0 into "all" for the agency and ignores it for clients.

- [ ] **Step 2: Add the banner tokens** to `:root` in `client/src/styles/variables.css`, after the `--wine-grad` block. They are fixed values on purpose: `--wine` and `--ink` change in dark mode and the banner must not. Do not add them to `:root.dark`.

```css
  /* Home dashboard banner: a dark chapter opener, identical in light and dark mode. */
  --home-banner-night: #1A0E11;
  --home-banner-oxblood: #3E1520;
  --home-banner-wine: #6E2638;
  --home-banner-text: #F7F1E6;
  --home-banner-accent: #EBB9A8;
```

(`--banner-h` is already taken by the impersonation banner, hence the `--home-banner-` prefix.)

- [ ] **Step 3: Give `StatCard` a filled option** in `client/src/features/billing/components/workspace/atoms.tsx`. Add `filled?: boolean` to the props. When `filled` is true the card uses `background: var(--wine-grad)`, label and sub colour `var(--home-banner-accent)`, value colour `var(--home-banner-text)`, and no accent line. Every existing caller passes nothing and renders exactly as before.

- [ ] **Step 4: Rewrite `home.css`** with only what the new page uses:

```css
/* Home dashboard (specs/home-dashboard). */
.home-banner {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 208px;
  padding: 28px 32px;
  border-radius: var(--r-card);
  overflow: hidden;
  color: var(--home-banner-text);
  background: linear-gradient(100deg, var(--home-banner-night) 0%, var(--home-banner-oxblood) 58%, var(--home-banner-wine) 100%);
}
.home-banner__art {
  position: absolute;
  inset: 0 0 0 auto;
  width: 62%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  /* Fade the picture into the dark on the left so the number stays readable. */
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 55%);
  mask-image: linear-gradient(to right, transparent 0%, #000 55%);
}
.home-banner__text { position: relative; max-width: 56%; }
.home-banner__eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--home-banner-accent);
}
.home-banner__value {
  font-family: var(--serif);
  font-style: italic;
  font-size: 76px;
  line-height: 1;
  letter-spacing: -0.02em;
  margin-top: 10px;
}
.home-banner__sentence { font-family: var(--serif); font-size: 19px; margin-top: 6px; }
.home-banner__trend { font-size: 13px; margin-top: 12px; color: var(--home-banner-accent); }

.home-bar { height: 6px; border-radius: 999px; background: var(--wine-tint); overflow: hidden; }
.home-bar > span { display: block; height: 100%; border-radius: 999px; background: var(--wine); transition: width 400ms ease; }

.home-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
.home-row:last-child { border-bottom: 0; }
button.home-row { width: 100%; text-align: left; background: none; border-left: 0; border-right: 0; border-top: 0; cursor: pointer; }
button.home-row:hover { background: var(--wine-tint); }

@media (max-width: 767px) {
  .home-banner { min-height: 150px; padding: 20px; }
  .home-banner__art { width: 100%; opacity: 0.45; }
  .home-banner__text { max-width: 100%; }
  .home-banner__value { font-size: 54px; }
  .home-banner__sentence { font-size: 16px; }
}
```

Check the font variable names against `client/src/styles/design-system.css` before saving (`--serif` is confirmed; use the file's actual mono token if it is not `--mono`). The mask's `#000` is a mask value, not a colour on screen.

- [ ] **Step 5: Write the shared components.** Each is a small presentational file with no data fetching:

- `HomeBanner.tsx`: `<section className="home-banner">` with `<img className="home-banner__art" src={image} alt="" loading="eager" />`, then the text block: eyebrow, value, sentence, and the trend line. The trend line renders `↑ +18%` or `↓ 20%` followed by `vsLabel`, and is omitted when `trend` is null. Use lucide `ArrowUp` / `ArrowDown` icons, not arrow characters.
- `StatRow.tsx`: a CSS grid `repeat(auto-fit, minmax(170px, 1fr))`, gap 14, two across below 768px (`grid-cols-2 md:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]`). Each item is a `StatCard` whose `sub` is the trend (from `trendOf(compared)`) or the given `sub`. An item with `onClick` is wrapped in a `<button>` with no extra chrome.
- `BarList.tsx`: one row per entry: icon, label, a `.home-bar` whose inner `span` width comes from `barWidths`, then the value and `extra` right-aligned in mono. Optional `columns` renders two small eyebrow headers above the numbers.
- `DayChart.tsx`: recharts `AreaChart` in a `ResponsiveContainer` (height 200), copying the styling of `features/campaigns/components/metricsWidgets/dashboard/PerformancePanel.tsx:64-105`, with these differences: no `CartesianGrid`, X axis shows the day of month only (`day.slice(8)`), and the axis tick fill is `var(--mute-2)` instead of the raw hex used there.
- `RowList.tsx`: rows as `.home-row`; a row with `onClick` renders as `<button className="home-row">`. Layout: title and meta stacked on the left, `tag` (a `Pill` from `components/crm/primitives/`) in the middle, `time` in mono on the right. When `rows` is empty it renders the `empty` string in `var(--mute)`.
- `EmptyState.tsx`: a `PanelShell variant="flat"` with a serif title and one line of body text.

Times are formatted with `Intl.RelativeTimeFormat(i18n.language)` for anything under 7 days and `toLocaleDateString` otherwise; put that in a `timeAgo(iso, locale)` helper inside `RowList.tsx`.

- [ ] **Step 6: Confirm the server and client still load**

Run: `pm2 logs leadawaker --lines 15 --nostream --err`
Expected: no new error. (Nothing renders these components yet.)

### Task C3: Page shell, Overview tab, Phone tab

**Files:**
- Rewrite: `client/src/features/home/pages/HomePage.tsx`
- Create: `client/src/features/home/tabs/OverviewTab.tsx`, `client/src/features/home/tabs/PhoneTab.tsx`
- Rewrite: `client/src/locales/en/home.json`, `client/src/locales/nl/home.json`, `client/src/locales/pt/home.json`

**Interfaces:**
- Consumes: everything from C1 and C2.
- Produces: `HomePage` default export (unchanged import in `app.tsx`). Each tab is a default export taking `{ scope: HomeScope; services: HomeServices; onOpenTab: (t: HomeTab) => void }`.

- [ ] **Step 1: Write the English strings** (`client/src/locales/en/home.json`, replacing the whole file)

```json
{
  "title": "Home",
  "greeting": { "morning": "Good morning", "afternoon": "Good afternoon", "evening": "Good evening" },
  "tabs": { "overview": "Overview", "phone": "Phone", "whatsapp": "WhatsApp", "website": "Website", "reactivation": "Reactivation", "reputation": "Reputation", "social": "Social" },
  "period": { "label": "Period", "month": "This month", "7d": "Last 7 days", "30d": "Last 30 days", "last_month": "Last month" },
  "vs": { "month": "vs last month", "7d": "vs the 7 days before", "30d": "vs the 30 days before", "last_month": "vs the month before" },
  "channel": { "phone": "Phone", "whatsapp": "WhatsApp", "sms": "SMS", "website": "Website", "booking_page": "Booking page" },
  "allAccounts": "All accounts",
  "loading": "Loading",
  "error": "These numbers could not be loaded. Try again in a moment.",
  "empty": {
    "noServicesTitle": "Your receptionist is being set up",
    "noServicesClient": "As soon as your first service is live, its numbers appear here.",
    "noServicesAgency": "This account has no live service yet. Set one up in the account workspace.",
    "noData": "Nothing in this period yet."
  },
  "overview": {
    "banner": "conversations handled",
    "tiles": { "bookings": "Bookings", "callbacks": "Callbacks requested", "newContacts": "New contacts", "waiting": "Waiting on you", "waitingSub": "Needs your attention", "waitingNone": "All caught up" },
    "byChannel": "By channel",
    "conversations": "Conversations",
    "bookings": "Bookings",
    "smsNote": "messages sent, fallback only",
    "perDay": "Conversations per day",
    "attention": "Needs attention",
    "attentionEmpty": "Nobody is waiting on you.",
    "attentionKind": { "callback": "Asked for a callback", "transfer_failed": "Transfer to the office failed", "handoff": "Waiting for a reply from a person" },
    "activity": "Recent activity",
    "activityEmpty": "No activity in this period yet.",
    "activityKind": { "booked": "Appointment booked", "call": "Call answered", "transferred": "Call transferred to the office", "chat_started": "New chat started", "followup_sent": "Follow-up message sent after a call" },
    "unknownCaller": "Unknown caller",
    "visitor": "Website visitor"
  },
  "phone": {
    "banner": "calls answered",
    "tiles": { "calls": "Calls", "booked": "Booked", "transferred": "Transferred", "transfersFailed_one": "{{count}} failed", "transfersFailed_other": "{{count}} failed", "avgLength": "Average length" },
    "perDay": "Calls per day",
    "outcomes": "Outcomes",
    "outcome": { "booked": "Booked", "callback": "Callback", "transferred": "Transferred", "hung_up": "Hung up", "other": "Other" },
    "outOfHours": "of calls came in outside office hours",
    "screened_one": "sales call or robocall screened out",
    "screened_other": "sales calls and robocalls screened out",
    "recent": "Recent calls",
    "recentEmpty": "No calls in this period yet."
  }
}
```

The WhatsApp, Website and Reactivation blocks are added in Task C4. Translate this file into `nl/home.json` and `pt/home.json` (Brazilian Portuguese, real characters such as `ç` and `ã` written directly). Keep every key. Plural keys keep their `_one` / `_other` suffixes.

- [ ] **Step 2: Rewrite `HomePage.tsx`**

```tsx
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { HOME_PERIODS, type HomePeriod, type HomeServices, type HomeTab } from "@shared/homeTypes";
import { useHomeServices, type HomeScope } from "../api/homeApi";
import { EmptyState } from "../components/EmptyState";
import "../home.css";

const OverviewTab = lazy(() => import("../tabs/OverviewTab"));
const PhoneTab = lazy(() => import("../tabs/PhoneTab"));
const WhatsappTab = lazy(() => import("../tabs/WhatsappTab"));
const WebsiteTab = lazy(() => import("../tabs/WebsiteTab"));
const ReactivationTab = lazy(() => import("../tabs/ReactivationTab"));
const ReputationTab = lazy(() => import("../tabs/ReputationTab"));
const SocialTab = lazy(() => import("../tabs/SocialTab"));

const PANELS = {
  overview: OverviewTab, phone: PhoneTab, whatsapp: WhatsappTab, website: WebsiteTab,
  reactivation: ReactivationTab, reputation: ReputationTab, social: SocialTab,
};
const ORDER: HomeTab[] = ["overview", "phone", "whatsapp", "website", "reactivation", "reputation", "social"];
const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };
const PERIOD_KEY = "leadawaker_home_period";

export function visibleTabs(services: HomeServices | undefined): HomeTab[] {
  if (!services) return ["overview"];
  return ORDER.filter((tab) => tab === "overview" || services[tab]);
}

function readTab(): HomeTab {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return (ORDER as string[]).includes(wanted ?? "") ? (wanted as HomeTab) : "overview";
}

function readPeriod(): HomePeriod {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    if ((HOME_PERIODS as readonly string[]).includes(saved ?? "")) return saved as HomePeriod;
  } catch { /* storage unavailable */ }
  return "month";
}

function HomeDashboard() {
  const { t, i18n } = useTranslation("home");
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const [tab, setTab] = useState<HomeTab>(readTab);
  const [period, setPeriod] = useState<HomePeriod>(readPeriod);
  const { data: services, isLoading } = useHomeServices(currentAccountId);
  const tabs = useMemo(() => visibleTabs(services), [services]);

  // A tab that is not live for this account (deep link, or after switching account) falls back to Overview.
  const active = tabs.includes(tab) ? tab : "overview";

  // Keep the open tab in the URL so a refresh or a shared link reopens it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (active === "overview") params.delete("tab"); else params.set("tab", active);
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [active]);

  const choosePeriod = (p: HomePeriod) => {
    setPeriod(p);
    try { localStorage.setItem(PERIOD_KEY, p); } catch { /* ignore */ }
  };

  const { greeting, dateStr } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const key = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const locale = DATE_LOCALE[i18n.language?.split("-")[0] ?? "en"] ?? "en-US";
    return {
      greeting: t(`greeting.${key}`),
      dateStr: now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    };
  }, [i18n.language, t]);

  const firstName = useMemo(() => {
    try { return (localStorage.getItem("leadawaker_user_name") || "").trim().split(/\s+/)[0] || ""; } catch { return ""; }
  }, []);

  const scope: HomeScope = { accountId: currentAccountId, period };
  const Panel = PANELS[active];
  const noServices = !isLoading && services && tabs.length === 1;

  return (
    <div className="la-page" data-testid="page-home">
      {/* One scroll container for the page, so neumorphic shadows are never clipped. */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="mr-auto flex max-w-[1386px] flex-col gap-5 px-4 pb-11 pt-7 md:px-9">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[26px] md:text-[32px]" style={{ margin: 0, fontFamily: "var(--serif)", color: "var(--ink)", lineHeight: 1.1 }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <span className="eyebrow eyebrow-sm">{dateStr}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="la-seg la-seg--fill max-w-full" role="tablist" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
              {tabs.map((k) => (
                <button key={k} role="tab" aria-selected={active === k} data-testid={`home-tab-${k}`}
                  className={cn("la-seg-btn shrink-0", active === k && "on")} onClick={() => setTab(k)}>
                  {t(`tabs.${k}`)}
                </button>
              ))}
            </div>
            <select value={period} onChange={(e) => choosePeriod(e.target.value as HomePeriod)} aria-label={t("period.label")}
              className="neu-inset-crisp" data-testid="home-period"
              style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}>
              {HOME_PERIODS.map((p) => <option key={p} value={p}>{t(`period.${p}`)}</option>)}
            </select>
          </div>

          {noServices ? (
            <EmptyState title={t("empty.noServicesTitle")} body={t(isAgencyUser ? "empty.noServicesAgency" : "empty.noServicesClient")} />
          ) : (
            <Suspense fallback={<div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>}>
              {services && <Panel scope={scope} services={services} onOpenTab={setTab} />}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <CrmShell>
      <HomeDashboard />
    </CrmShell>
  );
}
```

Confirm `cn` is exported from `@/lib/utils` (it is what `DemosPage.tsx` uses); match its import if different. Until Tasks C4 and C4R create the last five tab files (WhatsApp, Website, Reactivation, Reputation, Social), add them as one-line stubs (`export default function WhatsappTab() { return null; }` and so on) so the lazy imports resolve.

- [ ] **Step 3: Write `tabs/OverviewTab.tsx`**

Layout, top to bottom, matching the spec's Layout section:

1. `HomeBanner`: eyebrow `t("tabs.overview")`, value `data.conversations.value`, sentence `t("overview.banner")`, trend `trendOf(data.conversations)`, vsLabel `t(\`vs.${scope.period}\`)`, image `overview.webp`.
2. `StatRow` with four items: Bookings (`compared: data.bookings`), Callbacks requested (`data.callbacks`), New contacts (`data.newContacts`), Waiting on you. The last one has `value: data.waiting`, `filled: data.waiting > 0`, `sub: t(data.waiting > 0 ? "overview.tiles.waitingSub" : "overview.tiles.waitingNone")`, and an `onClick` that scrolls the Needs attention panel into view (`ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })`).
3. A two-column grid (`grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch`):
   - Left: `PanelShell` with `SectionHead title={t("overview.byChannel")}` and a `BarList`. Only channels whose service is live are listed (`services.phone`, `services.whatsapp`, `services.website`; SMS when `services.sms` or its count is above zero). `value` is conversations, `extra` is bookings, `columns={[t("overview.conversations"), t("overview.bookings")]}`. The SMS row shows `t("overview.smsNote")` under its label and a dash for bookings. Clicking a row calls `onOpenTab` for that channel (SMS opens `whatsapp`).
   - Right: `PanelShell` with `SectionHead title={t("overview.attention")}` and a `RowList`. Row title is the name, or `t("overview.unknownCaller")` for a call with no name, or `t("overview.visitor")` for a website lead with no name. Meta is `t(\`overview.attentionKind.${row.kind}\`)`. Tag is a `Pill` with `t(\`channel.${row.channel}\`)`. `onClick` opens the lead (`setLocation(\`/platform/contacts/${row.leadId}\`)`) or the call (see Task C3 Step 4 helper). Empty text `t("overview.attentionEmpty")`.
4. A second two-column grid: `DayChart` (`data.perDay`, label `t("overview.perDay")`) and a `RowList` for `data.activity` with title `t(\`overview.activityKind.${row.kind}\`)`, meta the name when present, tag the channel pill.

States: while `isLoading`, render the banner with value `"…"` and empty panels. On `isError`, render `EmptyState` with `t("error")`. When every number is zero and both lists are empty, the banner still shows `0` and the panels show their empty texts.

- [ ] **Step 4: Write `tabs/PhoneTab.tsx`**

1. `HomeBanner`: eyebrow `t("tabs.phone")`, value `data.calls.value`, sentence `t("phone.banner")`, trend of `data.calls`, image `phone.webp`.
2. `StatRow`: Calls, Booked, Transferred (`sub` shows `t("phone.tiles.transfersFailed", { count })` when `transfersFailed > 0`, otherwise the trend), Average length (`value: formatDuration(data.avgSeconds.value)`, `compared: data.avgSeconds`).
3. Grid: `DayChart` (`data.perDay`, `t("phone.perDay")`) and a `PanelShell` with `BarList` of the five outcomes (label `t(\`phone.outcome.${o.outcome}\`)`, value `o.count`).
4. Two small `StatCard flat` facts side by side: `${data.outOfHoursPct}%` with label `t("phone.outOfHours")`, rendered only when `outOfHoursPct !== null`; and `data.screened` with `t("phone.screened", { count: data.screened })`.
5. `RowList` of `data.recent`: title is the name or `t("overview.unknownCaller")`, meta the caller number, tag the outcome pill, time the call time plus `formatDuration(seconds)`.

Opening a call: the Voice Calls page has no per-call URL. It reads a one-shot key on mount. Put this helper in `client/src/features/home/lib/openCall.ts` and use it from both tabs:

```ts
/** Opens one call on the Voice Calls page, using the page's own one-shot hand-off (see VoiceCallsPage consumeCallDeepLink). */
export function openCall(callId: string, setLocation: (to: string) => void): void {
  try { localStorage.setItem("selected-voice-call-id", callId); } catch { /* the page still opens, without the call selected */ }
  setLocation("/platform/voice-calls");
}
```

- [ ] **Step 5: Look at it in the browser**

Load the `playwright-cli` skill. Sign in at `https://app.leadawaker.com` as the Owner (`leadawaker@gmail.com`), open `/platform/home`, and screenshot at 1440 wide and 390 wide, in light and dark mode, with account 53 selected and with all accounts.
Expected:
- Tabs for account 53 are Overview, Phone, Website. All accounts shows all five.
- The banner number equals `conversations.value` from `curl /api/home/overview?accountId=53`.
- No horizontal page scroll at 390. Tabs scroll inside their own row.
- The period picker changes every number and the "vs" label.
- `?tab=phone` opens Phone; refreshing keeps it; `?tab=whatsapp` on account 53 falls back to Overview.
- The browser console has no errors. Close the browser when done (Pi memory).

The banner images do not exist yet. Until Task C5, point the `image` prop at any existing dark placeholder and expect a plain gradient band.

### Task C4: WhatsApp, Website, Reactivation tabs

**Files:**
- Replace stubs: `client/src/features/home/tabs/WhatsappTab.tsx`, `WebsiteTab.tsx`, `ReactivationTab.tsx`
- Modify: `client/src/locales/{en,nl,pt}/home.json`

- [ ] **Step 1: Add the strings** (English shown; add the same keys to `nl` and `pt`)

```json
  "whatsapp": {
    "banner": "WhatsApp conversations",
    "tiles": { "conversations": "Conversations", "messages": "Messages", "messagesSub": "{{in}} in, {{out}} out", "bookings": "Bookings", "handedOff": "Handed to a person" },
    "perDay": "Conversations per day",
    "followUps_one": "follow-up sent after a call",
    "followUps_other": "follow-ups sent after calls",
    "sms": { "title": "SMS fallback", "note": "Sent by SMS when a number is not on WhatsApp. One-way.", "sent": "Sent", "delivered": "Delivered", "failed": "Failed", "share": "{{pct}}% of follow-ups after calls went by SMS" },
    "sender": { "title": "Your WhatsApp number", "connected": "Connected", "notConnected": "Not connected", "quality": "Quality: {{rating}}" },
    "recent": "Recent conversations",
    "recentEmpty": "No WhatsApp conversations in this period yet."
  },
  "website": {
    "banner": "chats started on your website",
    "tiles": { "chats": "Chats started", "contacts": "Contacts captured", "rate": "Capture rate", "rateNone": "No chats yet", "bookings": "Bookings" },
    "perDay": "Chats per day",
    "recent": "Recent chats",
    "recentEmpty": "No website chats in this period yet."
  },
  "reactivation": {
    "banner": "bookings from old leads",
    "tiles": { "contacted": "Leads contacted", "replyRate": "Reply rate", "replyRateNone": "No sends yet", "bookings": "Bookings", "costPerBooking": "Cost per booking", "costNone": "Not available" },
    "allCampaigns": "All campaigns",
    "campaign": "Campaign",
    "perDay": "Replies and bookings per day",
    "replies": "Replies",
    "pipeline": "Pipeline",
    "pipelineEmpty": "No leads in these campaigns yet.",
    "openCampaign": "Open campaign",
    "newCampaign": "New campaign",
    "importLeads": "Import leads"
  }
```

- [ ] **Step 2: Write `WhatsappTab.tsx`**

1. Banner: value `data.conversations.value`, sentence `t("whatsapp.banner")`, image `whatsapp.webp`.
2. `StatRow`: Conversations; Messages (`value: messagesIn.value + messagesOut.value`, `sub: t("whatsapp.tiles.messagesSub", { in, out })`); Bookings; Handed to a person.
3. Grid: `DayChart` on the left. On the right a column of up to three small panels:
   - Follow-ups: `data.followUps` with `t("whatsapp.followUps", { count })`. Hidden when zero and `services.phone` is false.
   - SMS fallback, only when `data.sms` is not null: title, the one-line note, a `BarList` of Sent, Delivered, Failed, and `t("whatsapp.sms.share", { pct })` under it when `followUpShare` is not null.
   - Number health, only when `data.sender` is not null: Connected or Not connected as a `Pill`, and `t("whatsapp.sender.quality", { rating })` when a rating exists.
4. `RowList` of `data.recent`: title is the lead's name, or `#${leadId}` when it has none; meta is the snippet; `onClick` opens `/platform/contacts/${leadId}`.

- [ ] **Step 3: Write `WebsiteTab.tsx`**

1. Banner: value `data.chats.value`, sentence `t("website.banner")`, image `website.webp`.
2. `StatRow`: Chats started; Contacts captured; Capture rate (`rateOf(contacts.value, chats.value)`, shown as `${n}%`, or `t("website.tiles.rateNone")` as the sub with a dash value when null); Bookings.
3. `DayChart` (`t("website.perDay")`) beside a `RowList` of `data.recent` (title the name or `t("overview.visitor")`, meta the snippet, opens the lead).

- [ ] **Step 4: Write `ReactivationTab.tsx`**

Holds `const [campaignId, setCampaignId] = useState<number | null>(null)` and calls `useHomeReactivation({ ...scope, campaignId })`.

1. Banner: value `data.bookings.value`, sentence `t("reactivation.banner")`, image `reactivation.webp`.
2. A row with the campaign `<select>` (same styling as the period picker; first option `t("reactivation.allCampaigns")`, then `data.campaigns`) and, when a campaign is picked, an "Open campaign" link to `/platform/campaigns` with that campaign selected (read `features/campaigns` for the existing selection mechanism before wiring; if there is none by URL, link to `/platform/campaigns`).
3. `StatRow`: Leads contacted; Reply rate (`rateOf(replied.value, contacted.value)`); Bookings; Cost per booking (formatted with `Intl.NumberFormat(i18n.language, { style: "currency", currency: "EUR" })`, or `t("reactivation.tiles.costNone")` when null).
4. Grid: a two-series version of the day chart (replies as the area, bookings as a second thin line; add an optional `secondary` prop to `DayChart` rather than a new component) and a `BarList` of `data.pipeline`.
5. Agency only (`useWorkspace().isAgencyUser`): two `ToolbarButton`s, New campaign and Import leads, pointing at the same destinations the old Quick Actions used (`QUICK_ACTIONS` in the old `data.ts`; copy the two hrefs before that file is deleted in Task C6).

- [ ] **Step 5: Look at all three in the browser** with all accounts selected and with account 1, at 1440 and 390, light and dark.
Expected: each tab renders with zeros rather than errors where there is no data; the SMS block and number health are absent for accounts without them; console is clean.

### Task C4R: Reputation and Social tabs

Added on 2026-10-12 at Gabriel's request. Neither service has real data yet, so the empty states matter as much as the numbers: a tab that is live but empty must read as "ready and waiting", not broken.

**Files:**
- Replace stubs: `client/src/features/home/tabs/ReputationTab.tsx`, `SocialTab.tsx`
- Modify: `client/src/locales/{en,nl,pt}/home.json`

**Interfaces:**
- Consumes: `useHomeReputation`, `useHomeSocial` (C2), the shared components (C2), `trendOf`, `rateOf` (C1).

- [ ] **Step 1: Add the strings** (English shown; same keys in `nl` and `pt`)

```json
  "reputation": {
    "banner": "new Google reviews",
    "tiles": { "avgRating": "Average rating", "avgNone": "No reviews yet", "replied": "Replies posted", "awaiting": "Waiting for your reply", "awaitingSub": "Open the review inbox", "awaitingNone": "All answered", "requests": "Review requests sent" },
    "ratings": "Ratings",
    "stars_one": "{{count}} star",
    "stars_other": "{{count}} stars",
    "perDay": "Reviews per day",
    "recent": "Recent reviews",
    "recentEmpty": "No reviews in this period yet.",
    "replied": "Replied",
    "notReplied": "No reply yet",
    "anonymous": "Anonymous",
    "notConnected": "Google reviews are not connected yet. Connect your Google Business Profile to see reviews here.",
    "open": "Open Reputation"
  },
  "social": {
    "banner": "conversations from Instagram",
    "tiles": { "conversations": "Conversations", "messages": "Messages", "messagesSub": "{{in}} in, {{out}} out", "bookings": "Bookings", "bookingRate": "Booking rate", "rateNone": "No conversations yet" },
    "perDay": "Conversations per day",
    "recent": "Recent conversations",
    "recentEmpty": "No Instagram conversations in this period yet.",
    "notConnected": "No Instagram account is connected yet."
  }
```

- [ ] **Step 2: Write `ReputationTab.tsx`**

1. Banner: value `data.reviews.value`, sentence `t("reputation.banner")`, trend of `data.reviews`, image `reputation.webp`.
2. When `!data.connected` and the scope is one account, a one-line notice above the tiles with `t("reputation.notConnected")` (a `PanelShell variant="flat"`, not an error style).
3. `StatRow`: Average rating (`value` is `data.avgRating.value` with one decimal, or a dash with `sub: t("reputation.tiles.avgNone")` when null); Replies posted (`compared: data.replied`); Waiting for your reply (`value: data.awaitingReply`, `filled` when above zero, `sub` `awaitingSub` or `awaitingNone`, `onClick` goes to `/platform/reputation`); Review requests sent (`compared: data.requestsSent`).
4. Grid: `DayChart` (`data.perDay`, `t("reputation.perDay")`) and a `PanelShell` with a `BarList` of the five ratings (label `t("reputation.stars", { count: rating })`, value the count).
5. `RowList` of `data.recent`: title the author or `t("reputation.anonymous")`, meta the review text, tag a `Pill` with the star count and `t(row.replied ? "reputation.replied" : "reputation.notReplied")`, `onClick` goes to `/platform/reputation`.

The Reputation page is agency-only today; for a client the two `onClick`s are omitted (`useWorkspace().isAgencyUser`).

- [ ] **Step 3: Write `SocialTab.tsx`**

1. Banner: value `data.conversations.value`, sentence `t("social.banner")`, image `social.webp`.
2. When `!data.connected` and the scope is one account, the same flat notice with `t("social.notConnected")`.
3. `StatRow`: Conversations; Messages (`in + out`, `sub` `messagesSub`); Bookings; Booking rate (`rateOf(bookings.value, conversations.value)`, or a dash with `rateNone`).
4. `DayChart` beside a `RowList` of `data.recent` (name or `#${leadId}`, snippet, opens `/platform/contacts/${leadId}`).

- [ ] **Step 4: Look at both in the browser** in the all-accounts view (the only place they show today), 1440 and 390, light and dark.
Expected: both tabs render with zeros, the empty texts and no errors; no tab shows for account 53; the console is clean.

### Task C5: The seven illustrations

**Files:**
- Create: `script/home/gen-images.cjs`
- Create: `client/src/assets/home/overview.webp`, `phone.webp`, `whatsapp.webp`, `website.webp`, `reactivation.webp`, `reputation.webp`, `social.webp`
- `reactivation.webp` and `reputation.webp` replace the old mascots of the same name; delete `speed.webp`

- [ ] **Step 1: Write the generator** (same shape as `script/report/gen-images.cjs`, with the house noir STYLE string adapted for a wide banner: the calm empty area is on the left, where the text sits)

```js
// Generates the Home dashboard banner illustrations (specs/home-dashboard) with
// OpenAI's newest quality image model (script/lib/image-model.cjs).
// Usage: node script/home/gen-images.cjs [name ...]   (no args = all)
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const { resolveImageModel } = require('../lib/image-model.cjs');
if (!KEY) { console.error('OPENAI_API_KEY missing'); return; }

const STYLE = 'Editorial poster illustration in a mid-century screenprint style: flat vector shapes with heavy risograph grain texture. Film-noir lighting from one single hard light source, long cast shadows, venetian-blind light stripes where it fits. Strict limited palette only: deep wine red #6E2638, dark oxblood #3E1520, warm bone off-white #F7F3EC for highlights, near-black ink #1F1A14 for shadows. Wide cinematic composition: the single subject sits in the right third of the frame, and the entire left half is calm, dark, empty negative space in near-black and oxblood with no objects and no bright areas. No text, no letters, no numbers, no logos, no people, no faces. Quiet, cinematic, premium.';

const SHOTS = {
  overview: 'A small brass reception desk bell standing on the corner of a dark wooden reception desk, lit by one hard beam of light from the upper right. A long shadow falls across the desk.',
  phone: 'A vintage rotary desk telephone on a dark wooden desk under a single small desk lamp. The receiver rests on its cradle. The lamp casts one warm cone of light on the phone.',
  whatsapp: 'A modern mobile phone lying face-up on a small bedside table in a dark room, its blank screen glowing softly and lighting the table edge. A plain glass of water beside it.',
  website: 'A small shop front on a dark empty street at night, seen from across the road. One large shop window glows warmly, throwing a rectangle of light onto the wet pavement.',
  reactivation: 'A tall dusty metal filing cabinet in a dark archive room. One drawer is pulled open, with paper folders visible inside, lit by a single narrow beam of light from above.',
  reputation: 'A small framed certificate hanging on a dark panelled wall above a narrow shelf. Five small brass stars stand in a row on the shelf, catching one hard beam of light from the side.',
  social: 'An old twin-lens camera on a small tripod standing on a dark wooden table, its lens catching a single beam of light. A few blank square photo prints lie on the table beside it.',
};

async function gen(name) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: await resolveImageModel('quality', KEY), prompt: `${SHOTS[name]} ${STYLE}`, size: '1536x1024', quality: 'high', n: 1 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const dir = path.join(__dirname, 'img');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}.png`);
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('saved', out);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
Promise.allSettled(names.map(gen)).then(rs => rs.forEach(r => r.status === 'rejected' && console.error(r.reason.message)));
```

Add `script/home/img/` to `.gitignore` (the PNG originals are several MB each and must not be committed).

- [ ] **Step 2: Generate and build a contact sheet**

Run: `cd /home/gabriel/LeadAwakerApp && node script/home/gen-images.cjs`
Then build one sheet of all seven with the design-studio helper (read `~/.claude/skills/design-studio/SKILL.md` for the exact `scripts/sheet.py` usage first).
Check the sheet yourself against these before showing it: same grain and palette across all seven; no text, letters or people; the left half of each is dark and empty; no image contains a colour outside wine, oxblood, bone and ink. Regenerate any single image that fails with `node script/home/gen-images.cjs <name>`.

- [ ] **Step 3: Send Gabriel the contact sheet and wait for his approval.** Do not put the images into the page before he approves the set. Regenerate the ones he rejects.

- [ ] **Step 4: Compress to WebP at display size**

```bash
cd /home/gabriel/LeadAwakerApp
for n in overview phone whatsapp website reactivation reputation social; do
  cwebp -quiet -q 80 -resize 1400 0 script/home/img/$n.png -o client/src/assets/home/$n.webp
done
rm client/src/assets/home/speed.webp   # reactivation.webp and reputation.webp are overwritten above
ls -la client/src/assets/home/
```

Expected: seven files, each under about 200 KB. If one is larger, lower `-q` to 72 for that file.

- [ ] **Step 5: Wire the imports** in each tab (`import banner from "@/assets/home/phone.webp";`) and re-check the page in the browser at 1440 and 390, light and dark. The number and sentence must stay readable over the picture in every tab; if a picture is too bright on the left, widen the mask's transparent stop in `home.css` (`transparent 0%, #000 55%` to `transparent 15%, #000 70%`).

### Task C6: Open Home to everyone, and clean up

**Files:**
- Modify: `client/src/pages/app.tsx` (lines 81-91, 251-254)
- Modify: `client/src/lib/landingPage.ts` (lines 22, 47-50)
- Modify: `client/src/components/crm/RightSidebar.tsx` (lines 347-351, 506-518)
- Modify: `client/src/components/crm/CommandPalette.tsx:84`
- Delete: `client/src/features/home/data.ts`, `icons.tsx`, `hooks/useHomeMetrics.ts`, `components/PulseStrip.tsx`, `NorthStarCell.tsx`, `Sparkline.tsx`, `ExplorePanel.tsx`, `NeedsAttention.tsx`, `ActivitySidebar.tsx`, `atoms.tsx`
- Delete: `client/src/hooks/useDashboardWidgetPrefs.ts`, `client/src/components/crm/BookedCallsKpi.tsx`
- Modify: `FILE_MAP.md`

- [ ] **Step 1: Route.** In `app.tsx` replace

```tsx
          <Route path="/platform/dashboard" component={() => <Redirect to="/platform/campaigns" />} />
          <Route path="/platform/home">
            <OwnerOnly prefix="/platform"><HomePage /></OwnerOnly>
          </Route>
```

with

```tsx
          <Route path="/platform/dashboard" component={() => <Redirect to="/platform/home" />} />
          <Route path="/platform/home"><HomePage /></Route>
```

and change the `OwnerOnly` doc comment to describe what it still guards (Automation Logs, Traffic, Demos), since Home no longer uses it.

- [ ] **Step 2: Landing page.** In `landingPage.ts`, drop `ownerOnly: true` from the Home option, and replace `defaultLandingPath`:

```ts
/** Default landing: the Home dashboard, for every role. */
export function defaultLandingPath(_ctx: NavGateContext = readNavGateContext()): string {
  return "/platform/home";
}
```

A saved preference still wins (`resolveLandingPath` is unchanged).

- [ ] **Step 3: Nav bar.** In `RightSidebar.tsx`:
- Desktop rail (506-518): remove the `{isOwner && ( ... )}` wrapper around the Home link and update its comment.
- Mobile bottom bar (347-351): the first slot becomes Home for everyone. Replace the `isOwner ? {...home} : {...campaigns}` expression with the Home entry alone.

Check that Campaigns is still reachable on mobile for non-owners after this (through the More page). If it is not, tell Gabriel rather than inventing a fifth slot.

- [ ] **Step 4: Command palette.** In `CommandPalette.tsx:84`, remove `ownerOnly: true` from the Home item and change its keywords to `"home dashboard receptionist overview"`.

- [ ] **Step 5: Delete the dead files.** First prove nothing else imports them:

```bash
cd /home/gabriel/LeadAwakerApp
grep -rnE "features/home/(data|icons)|PulseStrip|NorthStarCell|ExplorePanel|NeedsAttention|ActivitySidebar|features/home/components/(atoms|Sparkline)|useHomeMetrics|useDashboardWidgetPrefs|BookedCallsKpi|assets/home/(reputation|speed)" client/src --include=*.ts --include=*.tsx | grep -v "^client/src/features/home/"
```

Expected: no output. Then delete the files listed above. If the grep prints anything, stop and report it instead of deleting.

- [ ] **Step 6: Verify as a client.** In the browser, as the Owner use "view as" for account 53 (Manager role), then:
- Open `/platform`. Expected: lands on `/platform/home`.
- The nav bar and the mobile bottom bar both show Home.
- Tabs are Overview, Phone, Website only. No account switcher choice reveals another account's numbers.
- `/platform/dashboard` redirects to Home.
- The console is clean and no request to `/api/home/*` returns anything but 200.

- [ ] **Step 7: Update `FILE_MAP.md`**: replace the Home section with the new file list and remove the `DashboardSection`, `BookedCallsKpi` and `useDashboardWidgetPrefs` entries.

---

# Part D: Going live

- [ ] **D1. Engine restart, with Gabriel's OK.** Follow `specs/receptionist-channels/action-required.md` "Going live" in its order (restart first, prompt 124 only after it, `WHATSAPP_APP_SECRET` before the first client sender). Then:

```bash
cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env
pm2 logs leadawaker-engine --lines 20 --nostream
```

Expected: PASS, then `engine.starting` and `scheduler.started` with no traceback.

- [ ] **D2. Prove new rows are stamped.** Send one WhatsApp message and one website chat message to a test lead, make one test call, then:

```sql
SELECT type, channel, direction, created_at FROM p2mxx34fvbf3ll6."Interactions"
ORDER BY id DESC LIMIT 12;
```

Expected: `whatsapp`, `website` and `phone` on the new rows. A NULL on a new row means an insert site was missed in Task A5: find it by its `type` and `triggered_by` and fix it.

- [ ] **D3. Check the numbers against a recap.** For account 53, compare yesterday's daily recap email (calls, conversations, new contacts, appointments) with the Overview tab for the same day range. Explainable differences only: the recap window is one day, and its callbacks and handoffs come from the alert log.

- [ ] **D4. Ask Gabriel whether to commit.** Stage by path, using the Files lists in this plan. The engine changes sit on top of unrelated uncommitted work in the same files, so they are committed only if he says how.

## Not in this plan

Website visits and widget-open rates, cost per channel, a bookings table, and retiring the old `/api/activity-feed` and `/api/dashboard-trends` endpoints, which stay untouched for their existing callers.
