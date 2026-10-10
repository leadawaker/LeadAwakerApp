# Implementation Plan: Voice Caller Memory

## Overview

All work is in the Python engine (`/home/gabriel/automations/`) except one Drizzle column declaration in the CRM. Four pieces:

1. Store why each phone call ended (`Voice_Calls.end_reason`).
2. Look up a caller's recent calls at call start and render them into the voice layer, the greeting and the backend prompt.
3. Write the caller's name onto their lead after the call.
4. Restart the engine and verify with real calls.

Read `/home/gabriel/automations/CLAUDE.md` before starting. Engine paths below are relative to `/home/gabriel/automations/`. DB schema is `p2mxx34fvbf3ll6`; use `fq(Table.X)` from `tools/db/constants.py`, never a hardcoded schema.

## Phase 1: Store why a call ended

Without this the database cannot tell a dropped call from a goodbye: `PhoneCall.hangup(reason)` and the sideband `session.closed` reason are only logged today.

### Tasks
- [x] Write `scripts/migrate_voice_call_end_reason.py` (idempotent) adding `Voice_Calls.end_reason text` and a lookup index, then run it
- [x] Declare `endReason` on `voiceCalls` in `/home/gabriel/LeadAwakerApp/shared/schema.ts` (declaration only, no `db:push`)
- [x] Track the end reason in `PhoneCall` (`src/automations/voice/phone_call.py`) [complex]
  - [x] Add `self._end_reason: str | None = None` in `__init__`
  - [x] In `hangup()`, after the `_ended`/`_handed_off` guard (so a handed-off call is not relabelled), set it to `reason` if still unset: the first reason wins
  - [x] On `session.closed` in `on_event`, if unset: `"transferred"` when `self._handed_off`, `"goodbye"` when a goodbye was heard, else `"caller_hung_up"`
  - [x] In `run()`'s `except` (sideband lost), if unset: `"lost"`
  - [x] Pass it to `record_wrap_up(..., end_reason=...)` in `wrap_up()`
- [x] Add `end_reason` param to `record_wrap_up` and set `end_reason = 'abandoned'` in `close_abandoned_call` (`tools/db/voice_calls.py`)

### Technical Details

Migration, following `scripts/migrate_voice_tab.py`:

```python
"""
Migration: Voice_Calls.end_reason (specs/voice-caller-memory/ in LeadAwakerApp).

Why a phone call ended, so the next call can tell "cut off" from "goodbye".
Plus an index for the per-caller lookup at call start.

Idempotent: safe to run multiple times. Touches no existing row's data.
"""
vc = fq(Table.VOICE_CALLS)
await conn.execute(f'ALTER TABLE {vc} ADD COLUMN IF NOT EXISTS end_reason text')
await conn.execute(
    f'CREATE INDEX IF NOT EXISTS idx_voice_calls_caller '
    f'ON {vc} (accounts_id, caller_number, started_at DESC) WHERE caller_number IS NOT NULL'
)
```

Run: `cd /home/gabriel/automations && .venv/bin/python scripts/migrate_voice_call_end_reason.py`

Drizzle (in `voiceCalls`, after `transferOutcome`):

```ts
  // Why the call ended (engine migrate_voice_call_end_reason.py): goodbye |
  // caller_hung_up | silence | time_limit | no_greeting | transferred | lost | abandoned.
  // Null on browser calls and rows from before the column.
  endReason: text("end_reason"),
```

End reason values:

| Value | Set where | Meaning |
|---|---|---|
| `goodbye` | `hangup("completed")` (renamed on store, see below) or `session.closed` after a goodbye | normal end |
| `silence` | `hangup("silence")` | Sara hung up after 15s of quiet with no farewell (often a bad line) |
| `time_limit` | `hangup("time_limit")` | max call minutes hit |
| `no_greeting` | `hangup("no_greeting")` | she never spoke |
| `transferred` | `session.closed` while `_handed_off` | a person took the call |
| `caller_hung_up` | `session.closed`, no hangup from us, no goodbye | caller dropped off or the line dropped |
| `lost` | sideband WebSocket exception | our side lost the call |
| `abandoned` | sweep (`close_abandoned_call`) | browser tab went away |

Store `"completed"` from `hangup()` as `"goodbye"` (map in `hangup`, keep the logged reason as is).

"Goodbye was heard" on `session.closed`: `self._farewell` (her last turn matched `FAREWELL_RE`) **or** the caller's last turn matches `GOODBYE_RE`. The caller's last turn is the last `self.turns` entry with `side == "you"`; flush buffers is done in `wrap_up`, so check `self._buf["you"]` too: `GOODBYE_RE.search(last_caller_text + " " + self._buf["you"])`.

`record_wrap_up` change:

```python
async def record_wrap_up(
    *, call_id: str, accounts_id: int, session_id: str | None, summary: dict | None,
    end_reason: str | None = None,
) -> None:
    # INSERT ... end_reason ... VALUES (..., $5)
    # ON CONFLICT DO UPDATE SET ..., end_reason = COALESCE(EXCLUDED.end_reason, {_T}.end_reason)
```

`close_abandoned_call`: add `end_reason = COALESCE(end_reason, 'abandoned')` to the `SET`.

## Phase 2: Caller memory lookup and prompt blocks

### Tasks
- [x] Create `tools/db/voice_caller_history.py` with `recent_calls_for_caller()` and `lead_name_for_phone()` (depends on Phase 1 migration)
- [x] Create `src/automations/voice/caller_memory.py`: `CallerMemory` dataclass, `load_caller_memory()`, and the three renderers `voice_block()`, `greeting_block()`, `backend_block()` [complex]
  - [x] Name resolution (recap name, else real lead name)
  - [x] History: last 2 calls with a recap
  - [x] Dropped-call detection and its last transcript lines (`fetch_call_turns`)
  - [x] Per-language copy for en / nl / pt-BR / pt-PT, lean and positive (no "never" rules)
- [x] Thread `caller_memory` through `live_session_config.py` (depends on caller_memory.py)
  - [x] `build_live_session_config(..., caller_memory=None)`: append `voice_block()` after `_voice_today(...)`
  - [x] `build_backend_instructions(..., caller_memory=None)`: append `backend_block()` after `_backend_caller(...)`
  - [x] `greeting_instruction(..., caller_memory=None)`: append `greeting_block()` to both the client-greeting branch and the template branch
- [x] Call it from `_start_call` in `src/webhooks/phone_voice_routes.py` [complex]
  - [x] Move the `account_id` and `persona_company` computation above `build_live_session_config` (today they are computed after `accept`)
  - [x] `memory = await load_caller_memory(...)` when `phone` is set; pass it to `build_live_session_config` and `greeting_instruction`
  - [x] Log `voice.phone.caller_memory` with `known=bool(memory)`, `has_name`, `calls=len(memory.calls)`, `dropped=bool(memory.dropped)`
- [x] Check the new copy against OpenAI's GPT-Live prompting guide (developers.openai.com/api/docs/guides/live and live-prompting) and against the voice-layer rows 113-122, so nothing conflicts

### Technical Details

**`tools/db/voice_caller_history.py`**

```python
"""Past voice calls from one number, for Sara's caller memory at call start."""

async def recent_calls_for_caller(
    *, accounts_id: int, caller_number: str, persona_company: str | None, days: int = 90, limit: int = 6,
) -> list[dict]:
    # SELECT call_id, started_at, ended_at, turn_count, summary, booked_slot, outcome,
    #        end_reason, leads_id
    # FROM Voice_Calls
    # WHERE accounts_id = $1 AND caller_number = $2
    #   AND persona_company IS NOT DISTINCT FROM $3
    #   AND ended_at IS NOT NULL
    #   AND started_at > now() - make_interval(days => $4)
    # ORDER BY started_at DESC LIMIT $5
    # Decode `summary` if it comes back as a str (json.loads), as finalize_outcome does.

async def lead_name_for_phone(*, accounts_id: int, phone: str) -> str | None:
    # SELECT first_name FROM Leads WHERE phone = $1 AND "Accounts_id" = $2 LIMIT 1
    # Return None when it is a placeholder (see is_placeholder_name below).
```

`persona_company IS NOT DISTINCT FROM`: on a client line the persona is fixed, so this is a no-op; on the shared demo line (account 1) a prospect who tried the roofer persona last week and rings as the dentist today does not get the roofer's history.

**`src/automations/voice/caller_memory.py`**

```python
@dataclass
class PastCall:
    when: str            # rendered relative day in the call's language ("yesterday", "gisteren")
    recap: str           # one line: outcome + up to 3 item notes + booked slot

@dataclass
class DroppedCall:
    minutes_ago: int
    turns: list[dict]    # last 8 turns, {"side": "you"|"them", "text": ...}, each text cut to 200 chars

@dataclass
class CallerMemory:
    name: str | None
    calls: list[PastCall]          # newest first, max 2
    dropped: DroppedCall | None

async def load_caller_memory(
    *, accounts_id: int, caller_number: str, persona_company: str | None,
    locale: str, timezone: str | None,
) -> CallerMemory | None:
    """None for a first-time caller, and on any error (log voice.caller_memory.failed)."""
```

Rules inside `load_caller_memory`:

- `rows = recent_calls_for_caller(...)`. No rows: return `None` (first-time caller, zero prompt change).
- **History:** the first 2 rows whose `summary` is a non-empty dict. Recap line: `summary.outcome`, then `interest`/`notes` of up to 3 `items`, then `booked_slot` if set. Skip rows that render empty.
- **Name:** first `summary.name` across `rows` (newest first) that passes `clean_name()`; else `lead_name_for_phone()`.
  - `clean_name(s)`: strip; reject if `is_placeholder_name(s)`, if no letter, or if longer than 60 chars.
  - `is_placeholder_name(s)`: `not s or re.fullmatch(r"[+0-9\s().\-]*", s)`.
- **Dropped:** only `rows[0]` (the latest call), when `end_reason in ("caller_hung_up", "silence", "lost")` and `turn_count >= 3` and `ended_at > now - 15 min`. Turns from `fetch_call_turns(call_id)` (`tools/db/voice_calls.py`), last 8.
- If history is empty, no name and no dropped call (for example only 0-turn hang-ups before), return `None`.
- Relative day: compare dates in the call's timezone (same `resolve_timezone(timezone, lang)` that `_voice_today` uses). Copy per language: en `today` / `yesterday` / `{n} days ago`; nl `vandaag` / `gisteren` / `{n} dagen geleden`; pt `hoje` / `ontem` / `há {n} dias`.

Locale to copy key: `en-GB`, `en-US` → `en`; `nl` → `nl`; `pt-BR` → `pt-BR`; `pt-PT` → `pt-PT`; unknown → `en`. Keep this module free of imports from `live_session_config.py` (that module imports this one).

**Renderers.** Draft English copy below for the voice block; nl / pt-BR / pt-PT are written natively in each language (pt-BR is Brazilian, see `feedback_brazilian_portuguese`), same content, not a literal translation. Keep each block short: it is read before she says hello.

`voice_block(locale, memory)` (appended to the voice layer, after the date line):

```
# This caller has rung before
{name_line}
What they called about recently:
- {when}: {recap}
- {when}: {recap}
Build on this so they do not have to repeat themselves: pick up from what you already know and ask only for what is new. Bring up details of earlier calls once they have confirmed who they are, or once they raise the topic themselves.
```

- `name_line` with name: `They may be {name}. If they say they are someone else, ask who you are speaking with and treat them as a new caller.`
- `name_line` without name: `You do not have their name yet. If you need it, ask for it once.`
- Omit the "What they called about" list when `calls` is empty.
- When `dropped` is set, add:

```
Their last call, {minutes} minutes ago, was cut off mid-conversation. It ended like this:
Caller: ...
You: ...
Offer to carry on from there.
```

`greeting_block(locale, memory)` (inserted before "Then stop and let them talk." in the greeting row, or appended if a row lacks it; before the same sentence in the client-greeting branch). **Written in the call's language** (Gabriel, 2026-10-08: an English sentence in a Dutch greeting pulls her accent). English as built below; nl / pt-BR / pt-PT in `caller_memory.py`. Each variant replaces the rows' "ask how you can help", so the opening carries one question, not two. As built:

- dropped + name: `This caller was cut off a few minutes ago. Instead of asking how you can help, check in one short question that you are speaking with {name} again, say the line seemed to drop, and offer to carry on where you left off.`
- dropped, no name: `This caller was cut off a few minutes ago. Instead of asking how you can help, say the line seemed to drop and offer to carry on where you left off.`
- name: `This caller has rung before. Instead of asking how you can help, ask in one short question whether you are speaking with {name} again.`
- no name: `This caller has rung before. Welcome them back as part of your greeting.`

`backend_block(memory)` (English always, appended after `_backend_caller`):

```
## This caller's recent calls
Possible name: {name or "unknown"} (the assistant confirms it with the caller).
- {when}: {recap}
Their previous call was cut off {minutes} minutes ago; the last lines were: ...   (only when dropped)
Use these facts for bookings, reschedules and callbacks instead of asking again.
```

**`_start_call` reorder (`src/webhooks/phone_voice_routes.py`)**

`account_id` is computed today after `accept` as `(route or {}).get("accounts_id") or (lead["Accounts_id"] if lead else DEFAULT_ACCOUNT_ID)`, and `persona_company` via `persona_labels(persona)` (falling back to `company`). Move both above `build_live_session_config`; nothing between depends on their old position. Then:

```python
memory = None
if phone:
    memory = await load_caller_memory(
        accounts_id=account_id, caller_number=phone, persona_company=persona_company,
        locale=locale, timezone=setup.timezone if setup else None,
    )
session = build_live_session_config(..., caller_memory=memory)
...
greeting=greeting_instruction(locale, disclose, slots, caller_memory=memory),
```

`load_caller_memory` must catch everything internally and return `None`, so `_start_call` needs no new try/except. Keep it to two small queries (plus `fetch_call_turns` only on a dropped call) so the answer is not delayed noticeably.

**`live_session_config.py`** is 919 lines: keep the change to the three signature additions and three appends. All copy goes in `caller_memory.py`.

## Phase 3: Name onto the lead

### Tasks
- [x] Add `adopt_caller_name(call_id)` to `tools/db/voice_caller_history.py`
- [x] Call it at the end of `PhoneCall.wrap_up()` (after `finalize_outcome`), in its own try/except logging `voice.calls.write_failed` with `write="adopt_caller_name"`
- [x] Also call it in the browser wrap-up (`/voice/live/wrap-up`, `src/webhooks/live_voice_routes.py`) and the sweep (`src/automations/voice_call_sweep.py`) after their `finalize_outcome`, same try/except pattern

### Technical Details

```python
async def adopt_caller_name(call_id: str) -> None:
    """Give a lead the name its caller gave, while the lead is still named
    after its phone number. A real name already on the lead always stays."""
    # 1. SELECT leads_id, summary->>'name' AS name FROM Voice_Calls WHERE call_id = $1
    # 2. name = clean_name(name); return if not name or not leads_id
    # 3. first, _, last = name.partition(" ")
    # 4. UPDATE Leads SET
    #        first_name = $2,
    #        last_name = CASE WHEN COALESCE(last_name, '') = '' AND $3 <> '' THEN $3 ELSE last_name END,
    #        updated_at = now()
    #    WHERE id = $1 AND (first_name IS NULL OR first_name ~ '^[+0-9\s().\-]*$')
```

`clean_name` / `is_placeholder_name` live in `tools/db/voice_caller_history.py` (DB layer) and are imported by `caller_memory.py`, so there is one definition.

Leads columns confirmed: `first_name`, `last_name`, `updated_at`. New phone leads get `first_name = phone` from `CallLogger._get_or_create_lead` (`src/automations/voice/event_logger.py:152`): that is the placeholder this replaces. The CRM Callers view (`server/storage/voiceCallers.ts`) shows the lead name first, so it picks this up with no CRM change.

## Phase 4: Ship and verify

### Tasks
- [x] `cd /home/gabriel/automations && ./preflight.sh` and only on PASS `pm2 restart leadawaker-engine --update-env`; then `pm2 logs leadawaker-engine --lines 20 --nostream`
- [ ] After Gabriel's test calls (see action-required.md), check `Voice_Calls.end_reason` on the new rows, the `voice.phone.caller_memory` log lines, and lead 1273's `first_name`
- [ ] Update memory notes: new project memory for caller memory, and a line in `project_voice_phone_door_2026_10_03.md`

### Technical Details

Check query:

```sql
SELECT call_id, started_at, ended_at, turn_count, end_reason, outcome, summary->>'name' AS name
FROM p2mxx34fvbf3ll6."Voice_Calls"
WHERE caller_number = '+31737044356' ORDER BY started_at DESC LIMIT 5;

SELECT id, first_name, last_name FROM p2mxx34fvbf3ll6."Leads" WHERE id = 1273;
```

Lead 1273 (`+31737044356`, account 1) currently has `first_name = '+31737044356'` and recaps named "Gabriel", so the first wrapped-up call after deploy should rename it. Lead 354 (`+31617862359`) is named Danique and must stay Danique even though recent recaps say Gabriel.

Log lines: `voice.phone.caller_memory`, `voice.caller_memory.failed`, `voice.phone.hangup`, `voice.phone.session_closed`.

## Review fixes (2026-10-08, after /code-review)

- [x] Greeting sentence written in the call's language (nl / pt-BR / pt-PT / en), not English
- [x] Client scripted greetings (`slots.greeting`) stay verbatim: no returning-caller sentence there; the voice block's name line says "check this early, in one short question" instead
- [x] Dropped-call greeting variants allow a third short sentence (rows cap the greeting at two)
- [x] `_closed_reason(otherwise=...)` uses `_said_goodbye()` (her goodbye may still be in the buffer during end_call's 3s grace); the sideband-exception path checks goodbye before falling back to `lost`
- [x] `hangup()` records its reason only after the hangup request succeeds
- [x] `record_call_end()` closes the row (ended_at, end_reason) before the recap LLM call, so an immediate redial sees the dropped call; `record_wrap_up` keeps an existing ended_at
- [x] `load_caller_memory` wrapped in `asyncio.wait_for(..., 1.5s)`; takes `language` from `_start_call` for the timezone
- [x] `clean_name` rejects "Unknown", "N/A", "onbekend", "desconhecido" and similar
- [x] Backend block only applies the history once the transcript shows the caller is that person
- [x] One `close_out_call(call_id, abandoned)` in `tools/db/voice_calls.py` (outcome + name) used by phone wrap-up, browser wrap-up and the sweep
- [x] `lead_name_for_phone` orders by newest lead

## Round 2 (2026-10-08, Gabriel's feedback after the first live call)

First live call (15:53, +31737044356) worked: "Am I speaking with Gabriel again?", recalled the dealership enquiry, `end_reason = transferred`, lead 1273 renamed to Gabriel.

- [x] **Native language everywhere the voice model looks** (Gabriel: "the Portuguese AI should only see Portuguese"). New `src/automations/voice/greeting_copy.py` holds per-locale greeting rows (fallback + seed), stop sentence, disclosure sentence, client-greeting template, je/u line and the greeting cue. `live_session_config.py` imports them (`_GREETING_LANGUAGE` removed).
  - Prompt_Library rows 114 (en-GB), 118 (nl), 120 (pt-BR), 122 (pt-PT) rewritten from `GREETINGS`, version 2; old text snapshotted in Prompt_Versions with label `pre-native-2026-10-08`. Row 116 (en-US) unchanged.
  - Greeting cue (`session.commentary.append`) per locale: phone (`PhoneCall(locale=...)`) and browser (`/voice/live/session` returns `cue`, `useLiveCall.ts` uses it).
  - Screened-transfer result commentary per locale (`phone_transfer._TRANSFER_RESULT`).
  - Risk: on 2026-09-21 a Dutch-written greeting made her not open the call. The phone door has re-cued a silent greeting since 2026-10-07; watch `voice.phone.greeting_recue`. Revert = restore the Prompt_Versions snapshots.
  - Still English for nl/pt calls, by decision: the backend (delegation) prompt, which never speaks and is told to answer in the caller's language. Still English as DATA: the Lead Awaker persona's business line and knowledge base (stored once, in English).
- [x] **en-GB accent cue in the greeting** ("in your soft southern British accent", matching voice row 113).
- [x] **Never-remember numbers**: Demos page → Settings → Voice, "Never remember these numbers" (`Demo_Settings.voice.forgetNumbers`, zod max 20). Engine `demo_settings.forgotten_numbers()` (E.164, Dutch default); `_start_call` skips the lookup and logs `forgotten=True`.
- [x] **Recently confirmed callers greeted by name**: recap schema gains `name_confirmed` (true only when the caller said the name is theirs). If the newest named call has `name_confirmed` and started within 7 days (`CONFIRMED_WINDOW`), the greeting is the normal greeting ending in "how can I help, {name}?" and the voice/backend blocks state the name as confirmed. Copy moved to `caller_memory_copy.py`.
