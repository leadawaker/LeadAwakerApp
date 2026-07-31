# Tier-3 Voice Receptionist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **DO NOT START until a client has committed.** Per `project_voice_demo_platform_decision_2026_07_23`, real-time calling is not built on unconfirmed demand. This plan is the "ready the day a client bites" artifact. Keep demoing with the OpenAI playground until then.

**Goal:** A real-time voice AI receptionist ("Emma", Brightside Solar) that answers a live phone call or a browser click-to-talk session, greets first, answers from the Account Knowledge Base, books a real Cal.diy appointment mid-call, and streams the whole conversation into the existing CRM Conversations thread live.

**Architecture:** One OpenAI Realtime session brain, two transport front doors (SIP phone number + WebRTC browser page). The Pi (Python automations engine) is control-plane + logging only, never in the media path. Transcript/tool events land as `Interactions` rows via the existing `create_interaction()` helper, which fires a Postgres `NOTIFY new_interaction` that the CRM's `sse-listener.ts` already relays to the browser — so live rendering is reused, not rebuilt.

**Tech Stack:** Python 3.11 + FastAPI (automations engine), OpenAI Realtime API (`gpt-realtime`), Telnyx SIP trunk (Twilio fallback), asyncpg/Postgres, Cal.diy (`tools/caldiy_api.py`), React + TanStack Query (CRM), vanilla JS WebRTC (click-to-talk page).

## Global Constraints

- **Pi is never in the media path** — audio is caller/browser <-> OpenAI only. The engine only handles webhooks, session config, events, and tool calls.
- **Prompt lives in `Prompt_Library`** as the single source of truth (`feedback_prompt_source_of_truth`). Never hardcode the prompt in Python.
- **Interactions timestamps are server-side** — `create_interaction()` already sets them; never pass ISO strings for timestamp columns (drizzle-zod rejects them silently).
- **Live push is automatic** — every `create_interaction()` fires `NOTIFY new_interaction`; do not add a second SSE path. The CRM must SSE via `broadcastToUser`, never `broadcast`, but no CRM SSE code changes are needed for the phone door.
- **Lead is never titled "Unknown"** — formatted phone number, then real name once captured.
- **Booking never causes dead air** — filler speech ("let me check the diary") + ~2s timeout on Cal.diy; on failure Emma offers to have someone confirm.
- **Web-door abuse guard** — ephemeral tokens are short-lived and set `OpenAI-Safety-Identifier`.
- **Demo scope is single-tenant** (Brightside Solar, English). Multi-tenant provisioning, Dutch, posture dial, and owner notifications are later milestones — do not build them here.
- **Reuse, do not fork:** interaction writes go through `tools/db/interactions.py::create_interaction`; booking goes through `tools/caldiy_api.py` / `src/automations/conversation/slot_booking.py`; prompt+KB via `src/automations/conversation/prompt_builder.py::_load_prompt`. Reference `src/automations/conversation/voice_live.py` for the voice-interaction `type`/`who` conventions.

---

## File Structure

**Automations engine (`/home/gabriel/automations`):**
- Create: `src/webhooks/realtime_voice_routes.py` — FastAPI routes: SIP incoming-call webhook, ephemeral-token endpoint, web-relay endpoint. Sibling to `twilio_voice_mc_routes.py`.
- Create: `src/automations/voice/session_config.py` — session config builder (prompt + KB + tools + voice).
- Create: `src/automations/voice/booking_tool.py` — Cal.diy tool schema + executor.
- Create: `src/automations/voice/event_logger.py` — realtime-event -> Lead + Interactions mapper (idempotent per call id).
- Create: `tests/voice/test_session_config.py`, `tests/voice/test_booking_tool.py`, `tests/voice/test_event_logger.py`, `tests/voice/test_token_endpoint.py`, `tests/voice/test_web_relay.py`.
- Modify: engine app wiring (wherever FastAPI routers are registered — grep `include_router` in `src/main.py` or equivalent).

**CRM (`/home/gabriel/LeadAwakerApp`):**
- Create: `client/public/voice-demo/index.html` — minimal WebRTC click-to-talk page.
- Modify: the Conversations message renderer to badge a `type == 'voice_call'` interaction (grep the component that switches on interaction `type`).

**Data:**
- One `Prompt_Library` row (the Brightside voice-receptionist prompt, migrated from `docs/voice-demo/solar-receptionist-prompt.md`).

---

## Task 1: Prompt_Library entry (source of truth)

**Files:**
- Modify (data): insert one row into `Prompt_Library`.
- Source: `docs/voice-demo/solar-receptionist-prompt.md`.

**Interfaces:**
- Produces: a `Prompt_Library` row keyed so `_load_prompt(campaign_id, account_id)` (or a dedicated fetch) returns the Brightside voice prompt text. Confirm the exact key/column convention by reading an existing `Prompt_Library` row first.

- [ ] **Step 1: Read the existing Prompt_Library shape**

Run: `cd /home/gabriel/automations && rg -n "Prompt_Library" tools/db/ src/automations/conversation/prompt_builder.py` and read `prompt_builder.py::_load_prompt` fully to learn which column holds the prompt body and how a prompt is selected (by campaign, by name/slug, by type).

- [ ] **Step 2: Insert the row**

Use the direct `pg` script pattern (`node --env-file=.env`, per `drizzle-push-needs-tty`) OR an asyncpg one-off, inserting the contents of `docs/voice-demo/solar-receptionist-prompt.md` into the body column with a stable identifier (e.g. name `voice-receptionist-brightside` or the type the loader expects). Do not invent columns — match Step 1.

- [ ] **Step 3: Verify the loader returns it**

Write a throwaway script that calls the same fetch the session config builder will use and prints the first 200 chars. Expected: the Brightside prompt text.

- [ ] **Step 4: Commit**

```bash
git add docs/voice-demo/solar-receptionist-prompt.md
git commit -m "feat(voice): seed Brightside voice-receptionist prompt in Prompt_Library"
```

---

## Task 2: Session config builder

**Files:**
- Create: `src/automations/voice/session_config.py`
- Test: `tests/voice/test_session_config.py`

**Interfaces:**
- Consumes: prompt text (Task 1), KB rows (`Account_Knowledge_Base`), the booking tool schema (Task 3, `BOOKING_TOOL_SCHEMA`).
- Produces: `build_session_config(*, prompt_text: str, kb_rows: list[dict], voice: str = "marin", language: str = "en") -> dict` returning the OpenAI Realtime `session` object (keys: `type="realtime"`, `instructions`, `audio.output.voice`, `tools`, `tool_choice="auto"`). The exact JSON shape must be confirmed against current OpenAI Realtime docs at build time; the test asserts our invariants, not OpenAI's full schema.

- [ ] **Step 1: Write the failing test**

```python
# tests/voice/test_session_config.py
from src.automations.voice.session_config import build_session_config

def test_config_embeds_prompt_and_kb_and_tool():
    cfg = build_session_config(
        prompt_text="You are Emma.",
        kb_rows=[{"question": "Do you cover Bath?", "answer": "Yes, Bath and Bristol."}],
        voice="marin",
        language="en",
    )
    instructions = cfg["instructions"]
    assert "You are Emma." in instructions
    assert "Bath and Bristol" in instructions          # KB injected
    assert cfg["audio"]["output"]["voice"] == "marin"
    assert any(t["name"] == "book_appointment" for t in cfg["tools"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/gabriel/automations && python -m pytest tests/voice/test_session_config.py -v`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```python
# src/automations/voice/session_config.py
from src.automations.voice.booking_tool import BOOKING_TOOL_SCHEMA

def _format_kb(kb_rows: list[dict]) -> str:
    if not kb_rows:
        return ""
    lines = [f"Q: {r['question']}\nA: {r['answer']}" for r in kb_rows]
    return "\n\n# KNOWLEDGE BASE\n" + "\n\n".join(lines)

def build_session_config(*, prompt_text: str, kb_rows: list[dict],
                         voice: str = "marin", language: str = "en") -> dict:
    instructions = prompt_text + _format_kb(kb_rows)
    return {
        "type": "realtime",
        "instructions": instructions,
        "audio": {"output": {"voice": voice}},
        "tools": [BOOKING_TOOL_SCHEMA],
        "tool_choice": "auto",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/voice/test_session_config.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/automations/voice/session_config.py tests/voice/test_session_config.py
git commit -m "feat(voice): session config builder with prompt + KB injection"
```

---

## Task 3: Cal.diy booking tool (schema + executor)

**Files:**
- Create: `src/automations/voice/booking_tool.py`
- Test: `tests/voice/test_booking_tool.py`

**Interfaces:**
- Consumes: `tools/caldiy_api.py` (`get_availability`, `create_booking`, `get_event_type_id`, `resolve_account_credentials`) and/or `src/automations/conversation/slot_booking.py`.
- Produces:
  - `BOOKING_TOOL_SCHEMA: dict` — an OpenAI function-tool with `name="book_appointment"`, params `{preferred_day: str, preferred_time: str, name: str}`.
  - `async def execute_booking(args: dict, *, account_id: int, lead_id: int, phone: str) -> dict` — returns `{"status": "booked", "slot": "<human slot>"}` or `{"status": "unavailable"}` or `{"status": "error"}`. Must enforce a ~2s timeout on the Cal.diy call.

- [ ] **Step 1: Read the existing booking path**

Run: `cd /home/gabriel/automations && sed -n '461,540p' src/automations/conversation/slot_booking.py` and `sed -n '341,460p' tools/caldiy_api.py`. Reuse `_create_booking_from_slot` / `_resolve_booking_target` if they fit; otherwise call `caldiy_api` directly. Note the email rule: use `f"leadawaker+lead{lead_id}@gmail.com"`, never a real lead email.

- [ ] **Step 2: Write the failing test**

```python
# tests/voice/test_booking_tool.py
import asyncio
from unittest.mock import AsyncMock, patch
from src.automations.voice.booking_tool import BOOKING_TOOL_SCHEMA, execute_booking

def test_schema_shape():
    assert BOOKING_TOOL_SCHEMA["name"] == "book_appointment"
    assert "preferred_day" in BOOKING_TOOL_SCHEMA["parameters"]["properties"]

def test_execute_booking_success():
    async def run():
        with patch("src.automations.voice.booking_tool._book", new=AsyncMock(
                return_value={"slot": "Thursday 2pm"})):
            return await execute_booking(
                {"preferred_day": "Thursday", "preferred_time": "afternoon", "name": "Sam"},
                account_id=52, lead_id=999, phone="+441234567890")
    result = asyncio.run(run())
    assert result["status"] == "booked"
    assert result["slot"] == "Thursday 2pm"

def test_execute_booking_timeout_returns_error():
    async def slow(*a, **k):
        await asyncio.sleep(5)
    async def run():
        with patch("src.automations.voice.booking_tool._book", new=slow):
            return await execute_booking(
                {"preferred_day": "Thursday", "preferred_time": "afternoon", "name": "Sam"},
                account_id=52, lead_id=999, phone="+441234567890")
    result = asyncio.run(run())
    assert result["status"] == "error"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/voice/test_booking_tool.py -v`
Expected: FAIL (module not found).

- [ ] **Step 4: Write minimal implementation**

```python
# src/automations/voice/booking_tool.py
import asyncio

BOOKING_TOOL_SCHEMA = {
    "type": "function",
    "name": "book_appointment",
    "description": "Book a survey/consultation slot once the caller agrees to a day and time.",
    "parameters": {
        "type": "object",
        "properties": {
            "preferred_day": {"type": "string", "description": "e.g. Thursday, tomorrow"},
            "preferred_time": {"type": "string", "description": "e.g. morning, 2pm"},
            "name": {"type": "string", "description": "Caller's full name"},
        },
        "required": ["preferred_day", "preferred_time", "name"],
    },
}

_BOOKING_TIMEOUT_S = 2.0

async def _book(args, *, account_id, lead_id, phone):
    # Thin wrapper over the existing booking machinery. Confirm the exact
    # slot-resolution call from Step 1 (slot_booking._create_booking_from_slot
    # or caldiy_api.get_availability + create_booking). Returns {"slot": str}.
    ...

async def execute_booking(args: dict, *, account_id: int, lead_id: int, phone: str) -> dict:
    try:
        booked = await asyncio.wait_for(
            _book(args, account_id=account_id, lead_id=lead_id, phone=phone),
            timeout=_BOOKING_TIMEOUT_S,
        )
    except (asyncio.TimeoutError, Exception):
        return {"status": "error"}
    if not booked:
        return {"status": "unavailable"}
    return {"status": "booked", "slot": booked["slot"]}
```

> NOTE: `_book` body is filled in at Step 1 against the real `slot_booking`/`caldiy_api` functions — it is the one integration point that must be wired to live code, not mocked. The test mocks `_book`; a follow-up manual booking test (Task 8) exercises it for real.

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/voice/test_booking_tool.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/automations/voice/booking_tool.py tests/voice/test_booking_tool.py
git commit -m "feat(voice): Cal.diy booking tool schema + timeout-guarded executor"
```

---

## Task 4: Event logger (realtime events -> Lead + Interactions)

**Files:**
- Create: `src/automations/voice/event_logger.py`
- Test: `tests/voice/test_event_logger.py`

**Interfaces:**
- Consumes: `tools/db/interactions.py::create_interaction`, a get-or-create-lead-by-phone helper (confirm from `src/webhooks/whatsapp_cloud_routes.py` inbound path / `tools/db/leads.py`), `execute_booking` (Task 3).
- Produces: `class CallLogger` with:
  - `async def ensure_lead(self) -> int` — idempotent get-or-create by `(account_id, phone)`; caches `lead_id` on the instance so repeated events don't create duplicate leads.
  - `async def handle_event(self, event: dict) -> None` — routes one realtime event: caller transcript -> inbound interaction; Emma transcript -> outbound interaction (`ai_generated=True`); function_call -> `execute_booking` + a "Booked" interaction. Unknown event types are ignored.
  - Constructor: `CallLogger(*, account_id: int, campaign_id: int, phone: str, call_id: str)`.
- The interaction `type` for voice turns: reuse the value `voice_live.py` uses (confirm; likely `"Voice"` or `"voice_call"`). `who` = `"lead"` inbound / `"ai"` outbound (confirm against `voice_live.py`).

- [ ] **Step 1: Confirm conventions**

Run: `cd /home/gabriel/automations && sed -n '340,365p' src/automations/conversation/voice_live.py` to copy the exact `type`/`who`/`direction` values, and `rg -n "get_or_create|def create_lead|by_phone" tools/db/leads.py src/webhooks/whatsapp_cloud_routes.py` for the lead helper.

- [ ] **Step 2: Write the failing test**

```python
# tests/voice/test_event_logger.py
import asyncio
from unittest.mock import AsyncMock, patch
from src.automations.voice.event_logger import CallLogger

def _logger():
    return CallLogger(account_id=52, campaign_id=60, phone="+441234567890", call_id="c1")

def test_lead_creation_is_idempotent():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=777)) as m:
            a = await lg.ensure_lead()
            b = await lg.ensure_lead()
            return a, b, m.call_count
    a, b, count = asyncio.run(run())
    assert a == b == 777
    assert count == 1  # cached; not created twice

def test_caller_transcript_logs_inbound():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.create_interaction",
                   new=AsyncMock(return_value=1)) as ci:
            await lg.handle_event({
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": "do you cover Bath?"})
            return ci.await_args.kwargs
    kwargs = asyncio.run(run())
    assert kwargs["direction"] == "inbound"
    assert "Bath" in kwargs["content"]

def test_function_call_books_and_logs():
    async def run():
        lg = _logger()
        with patch.object(lg, "_get_or_create_lead", new=AsyncMock(return_value=1)), \
             patch("src.automations.voice.event_logger.execute_booking",
                   new=AsyncMock(return_value={"status": "booked", "slot": "Thu 2pm"})), \
             patch("src.automations.voice.event_logger.create_interaction",
                   new=AsyncMock(return_value=1)) as ci:
            await lg.handle_event({
                "type": "response.function_call_arguments.done",
                "name": "book_appointment",
                "arguments": '{"preferred_day":"Thursday","preferred_time":"afternoon","name":"Sam"}'})
            return [c.kwargs.get("content") for c in ci.await_args_list]
    contents = asyncio.run(run())
    assert any("Thu 2pm" in (c or "") for c in contents)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/voice/test_event_logger.py -v`
Expected: FAIL (module not found).

- [ ] **Step 4: Write minimal implementation**

```python
# src/automations/voice/event_logger.py
import json
from tools.db.interactions import create_interaction
from src.automations.voice.booking_tool import execute_booking

# Confirm exact OpenAI Realtime event type strings at build time; centralise here.
EV_CALLER_TRANSCRIPT = "conversation.item.input_audio_transcription.completed"
EV_AI_TRANSCRIPT = "response.output_audio_transcript.done"
EV_FUNCTION_CALL = "response.function_call_arguments.done"
VOICE_TYPE = "Voice"  # match voice_live.py (Step 1)

class CallLogger:
    def __init__(self, *, account_id: int, campaign_id: int, phone: str, call_id: str):
        self.account_id = account_id
        self.campaign_id = campaign_id
        self.phone = phone
        self.call_id = call_id
        self._lead_id: int | None = None

    async def _get_or_create_lead(self) -> int:
        # Wire to the real get-or-create-by-phone helper found in Step 1.
        ...

    async def ensure_lead(self) -> int:
        if self._lead_id is None:
            self._lead_id = await self._get_or_create_lead()
        return self._lead_id

    async def _log(self, *, who: str, direction: str, content: str, ai: bool):
        lead_id = await self.ensure_lead()
        await create_interaction(
            accounts_id=self.account_id, campaigns_id=self.campaign_id, leads_id=lead_id,
            who=who, type=VOICE_TYPE, direction=direction, content=content,
            from_number=self.phone if direction == "inbound" else None,
            to_number=self.phone if direction == "outbound" else None,
            ai_generated=ai,
        )

    async def handle_event(self, event: dict) -> None:
        et = event.get("type")
        if et == EV_CALLER_TRANSCRIPT:
            await self._log(who="lead", direction="inbound",
                            content=event.get("transcript", ""), ai=False)
        elif et == EV_AI_TRANSCRIPT:
            await self._log(who="ai", direction="outbound",
                            content=event.get("transcript", ""), ai=True)
        elif et == EV_FUNCTION_CALL and event.get("name") == "book_appointment":
            args = json.loads(event.get("arguments", "{}"))
            result = await execute_booking(args, account_id=self.account_id,
                                           lead_id=await self.ensure_lead(), phone=self.phone)
            if result["status"] == "booked":
                await self._log(who="ai", direction="outbound",
                                content=f"Booked: {result['slot']}", ai=True)
            # NOTE: also return the tool result to the session (Task 5 wires the
            # send-back so Emma can confirm verbally).
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/voice/test_event_logger.py -v`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add src/automations/voice/event_logger.py tests/voice/test_event_logger.py
git commit -m "feat(voice): realtime event logger -> Lead + Interactions (idempotent)"
```

---

## Task 5: SIP call handler + token + relay routes

**Files:**
- Create: `src/webhooks/realtime_voice_routes.py`
- Test: `tests/voice/test_token_endpoint.py`, `tests/voice/test_web_relay.py`
- Modify: engine router registration (grep `include_router`).

**Interfaces:**
- Consumes: `build_session_config` (Task 2), `CallLogger` (Task 4), OpenAI REST (`POST /v1/realtime/client_secrets`, call accept), `_load_prompt` + KB fetch (Task 1 findings).
- Produces three FastAPI routes:
  - `POST /voice/incoming` — OpenAI SIP incoming-call webhook: accept the call, build+send session config, fire `response.create`, then stream server-side events into a `CallLogger`.
  - `POST /voice/token` — returns a short-lived ephemeral `client_secret` (sets `OpenAI-Safety-Identifier`).
  - `POST /voice/relay` — body `{call_id, account_id, campaign_id, phone, event}`; feeds `event` into a `CallLogger` (keyed/cached per `call_id`).

- [ ] **Step 1: Confirm current OpenAI Realtime SIP + token flow**

At build time, read the current OpenAI Realtime docs for: the incoming-call webhook shape, how to accept a SIP call, the events transport (WebSocket vs SSE) for server-side sessions, and the `client_secrets` request body. Centralise endpoint URLs/event names as constants. (The Realtime API changes; this is a verification step, not optional.)

- [ ] **Step 2: Write the failing test (token endpoint, mocked OpenAI)**

```python
# tests/voice/test_token_endpoint.py
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.webhooks.realtime_voice_routes import router
from fastapi import FastAPI

app = FastAPI(); app.include_router(router)
client = TestClient(app)

def test_token_endpoint_returns_secret():
    with patch("src.webhooks.realtime_voice_routes._mint_client_secret",
               new=AsyncMock(return_value={"value": "ek_test", "expires_at": 123})):
        r = client.post("/voice/token", json={})
    assert r.status_code == 200
    assert r.json()["value"] == "ek_test"
```

- [ ] **Step 3: Write the failing test (relay routes to logger)**

```python
# tests/voice/test_web_relay.py
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from src.webhooks.realtime_voice_routes import router

app = FastAPI(); app.include_router(router)
client = TestClient(app)

def test_relay_feeds_logger():
    with patch("src.webhooks.realtime_voice_routes.CallLogger") as CL:
        inst = CL.return_value
        inst.handle_event = AsyncMock()
        r = client.post("/voice/relay", json={
            "call_id": "c1", "account_id": 52, "campaign_id": 60, "phone": "+44123",
            "event": {"type": "response.output_audio_transcript.done", "transcript": "hi"}})
    assert r.status_code == 200
    inst.handle_event.assert_awaited_once()
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `python -m pytest tests/voice/test_token_endpoint.py tests/voice/test_web_relay.py -v`
Expected: FAIL (module not found).

- [ ] **Step 5: Write minimal implementation**

```python
# src/webhooks/realtime_voice_routes.py
import os, httpx
from fastapi import APIRouter, Request
from src.automations.voice.session_config import build_session_config
from src.automations.voice.event_logger import CallLogger

router = APIRouter()
_loggers: dict[str, CallLogger] = {}   # keyed per call_id (web door)

async def _mint_client_secret() -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                     "OpenAI-Safety-Identifier": "leadawaker-voice-demo"},
            json={})  # session shape confirmed in Step 1
        r.raise_for_status()
        return r.json()

@router.post("/voice/token")
async def voice_token():
    return await _mint_client_secret()

@router.post("/voice/relay")
async def voice_relay(req: Request):
    body = await req.json()
    cid = body["call_id"]
    lg = _loggers.get(cid)
    if lg is None:
        lg = CallLogger(account_id=body["account_id"], campaign_id=body["campaign_id"],
                        phone=body["phone"], call_id=cid)
        _loggers[cid] = lg
    await lg.handle_event(body["event"])
    return {"ok": True}

@router.post("/voice/incoming")
async def voice_incoming(req: Request):
    # 1) parse OpenAI SIP incoming-call webhook (Step 1)
    # 2) accept the call
    # 3) send build_session_config(prompt_text=..., kb_rows=..., voice=..., language="en")
    # 4) fire response.create  (SPEAK FIRST)
    # 5) open the server-side event stream; for each event: await CallLogger(...).handle_event(ev)
    #    and send tool results back to the session for book_appointment.
    ...
```

> NOTE: `/voice/token` and `/voice/relay` are fully unit-tested (they cover the whole web door). `/voice/incoming` is integration/manual — its body is completed against the confirmed OpenAI SIP flow (Step 1) and exercised in Task 8's E2E. Keep the demo's DEMO account/campaign ids in env, not hardcoded.

- [ ] **Step 6: Register the router**

Add `app.include_router(realtime_voice_routes.router)` where the engine registers routers (grep `include_router`). Server auto-reloads via pm2 watch (~5-8s).

- [ ] **Step 7: Run tests to verify they pass**

Run: `python -m pytest tests/voice/test_token_endpoint.py tests/voice/test_web_relay.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/webhooks/realtime_voice_routes.py tests/voice/test_token_endpoint.py tests/voice/test_web_relay.py
git commit -m "feat(voice): SIP incoming + ephemeral token + web relay routes"
```

---

## Task 6: Click-to-talk page (web door)

**Files:**
- Create: `client/public/voice-demo/index.html` (in the CRM repo; served as a static page).

**Interfaces:**
- Consumes: `POST /voice/token` (engine), OpenAI Realtime WebRTC endpoint, `POST /voice/relay` (engine).
- Produces: a page with one "Call Emma" button that (1) fetches a token, (2) opens a WebRTC connection to OpenAI with mic audio, (3) fires `response.create` on the data channel open (SPEAK FIRST), (4) forwards every received event to `/voice/relay` with the call metadata.

- [ ] **Step 1: Build the page**

Minimal vanilla JS: `getUserMedia({audio:true})`, `RTCPeerConnection`, a data channel `oai-events`, POST the SDP offer to the OpenAI calls endpoint with the ephemeral token, on `datachannel.onopen` send `{type:"response.create"}`, on `datachannel.onmessage` `fetch('/voice/relay', {method:'POST', body: JSON.stringify({call_id, account_id, campaign_id, phone:'web', event: JSON.parse(e.data)})})`. Confirm the exact WebRTC handshake URL/headers against current OpenAI docs.

- [ ] **Step 2: Manual test (browser)**

Open the page, click Call Emma, confirm: mic permission prompt, Emma greets first, you hear her, and interactions appear in the CRM Conversations thread live (proves the relay -> create_interaction -> NOTIFY -> sse-listener path).

- [ ] **Step 3: Commit**

```bash
git add client/public/voice-demo/index.html
git commit -m "feat(voice): browser click-to-talk page (WebRTC web door)"
```

---

## Task 7: CRM voice-call interaction badge

**Files:**
- Modify: the Conversations message renderer that switches on interaction `type` (grep `type ===` / a `switch` in `client/src/features/conversations/`).

**Interfaces:**
- Consumes: an `Interactions` row with `type == "Voice"` (Task 4's `VOICE_TYPE`).
- Produces: the thread renders voice turns as normal chat bubbles with a small "Call" badge; no crash on the new type.

- [ ] **Step 1: Write the failing test**

Add a render test (Vitest/RTL, following the existing conversations test pattern) asserting a message with `type: "Voice"` renders its content and a "Call" badge.

- [ ] **Step 2: Run it, confirm fail; implement the badge branch; run, confirm pass.**

- [ ] **Step 3: Commit**

```bash
git add client/src/features/conversations/
git commit -m "feat(voice): badge voice-call interactions in Conversations thread"
```

---

## Task 8: Wiring, provisioning & manual E2E (the demo)

**Files:**
- Config only (env + Telnyx/OpenAI dashboards). No test file; this task's deliverable is a working demo verified by checklist.

- [ ] **Step 1: Provision the phone door**

Buy a US / US-toll-free number on Telnyx (dodges the UK proof-of-address bundle; Twilio fallback if verification stalls). Create a SIP connection pointing inbound calls at OpenAI's project SIP address. Set OpenAI's incoming-call webhook to the engine's public `/voice/incoming` URL (via the existing Cloudflare tunnel).

- [ ] **Step 2: Set env**

`OPENAI_API_KEY` (already present), the DEMO `account_id`/`campaign_id` for Brightside (reuse the isolated demo account pattern from `project_demo_cal_account_routing`), and the Cal.diy demo calendar credentials. Confirm `_book` (Task 3) resolves them.

- [ ] **Step 3: Wire the booking send-back**

Complete the `/voice/incoming` loop so a `book_appointment` tool result is returned to the session (so Emma confirms verbally) AND logged (Task 4). Verify against Step 1 of Task 5.

- [ ] **Step 4: Manual E2E — phone door**

Call the number. Verify: Emma greets first; discloses she's AI; answers a KB question (e.g. "do you cover Bath?"); books a slot ("let me check the diary" filler, then a real Cal.diy entry); the whole transcript appears live in the CRM Conversations thread; "Booked" shows. Check the Cal.diy calendar for the real appointment.

- [ ] **Step 5: Manual E2E — web door**

Open the click-to-talk page from a different network (simulate a US/UK prospect). Verify the same flow end to end.

- [ ] **Step 6: Commit any config/docs**

```bash
git add specs/voice-receptionist/ docs/voice-demo/
git commit -m "docs(voice): Tier-3 demo provisioning notes + E2E checklist"
```

---

## Self-Review (completed at write time)

- **Spec coverage:** two doors (Tasks 5+6), OpenAI Realtime brain (Tasks 2+5), speak-first (Tasks 5 step5, 6 step1), KB grounding (Task 2), live transcript into existing thread (Tasks 4+7, reusing NOTIFY/sse-listener), real Cal.diy booking (Tasks 3+8), never-"Unknown" lead (Task 4 `ensure_lead`), prompt in Prompt_Library (Task 1), abuse guard + timeouts + server-side timestamps (Global Constraints, enforced in Tasks 3/5). Later milestones intentionally omitted.
- **Known verification points (external, evolving API):** OpenAI Realtime event names, SIP webhook/accept shape, token body, and WebRTC handshake are each gated behind an explicit "confirm against current docs" step (Tasks 5.1, 6.1) rather than fabricated — correct handling for an API that changes, not a placeholder.
- **Type consistency:** `build_session_config`, `BOOKING_TOOL_SCHEMA`, `execute_booking`, `CallLogger`, `VOICE_TYPE` names match across tasks.
