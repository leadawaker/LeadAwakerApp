# Voice calls Live/Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give `/platform/voice-calls` a per-account Live view for every client and an Owner-only Demo tab with persona rows, outcome pills, a stats strip and a Presenting (masking) mode.

**Architecture:** The Python engine stamps `persona_company`, `persona_niche` and `outcome` on `Voice_Calls`. Express classifies Demo vs Live in SQL, scopes by account, and proxies recordings with an access check. The React page adds a `Live | Demo` tab, a stats strip and masking, reusing the existing inbox, player and recap.

**Tech Stack:** Express + Drizzle + pg (raw SQL for the live table), Python/FastAPI/asyncpg engine with pytest, React + Vite + react-i18next, `tsx --test` for pure TS tests.

**Spec:** `specs/voice-calls-demo-tab/requirements.md` (read it first, the API contract there is binding).

## Global Constraints

- Never run `tsc`. Never run `npm run dev`. App is pm2: server restarts itself in 5-8s, engine is `leadawaker-engine` (restart with `pm2 restart leadawaker-engine` after Python edits).
- No em dashes in any text, comment or locale string.
- Every user-facing string goes through i18n in `client/src/locales/{en,nl,pt}/voiceCalls.json` (PT is Brazilian).
- Tokens only for colour (`var(--ink)`, `var(--paper)`, etc.), no `bg-white`, no raw hex. Read `UI_STANDARDS.md` and `UI_PATTERNS.md` before any UI work.
- Files under 500 lines. New pages stay lazy (no new page here).
- Do NOT commit. Gabriel has unrelated uncommitted changes (`server/email.ts`, `server/index.ts`); leave the tree uncommitted and report the changed files.
- Timestamps are set server-side with `new Date()` / `now()`, never ISO strings from the client.
- Close any playwright browser you open. Do not run more than the lane agents' own processes (Raspberry Pi).
- Postgres schema is `p2mxx34fvbf3ll6`. Live tables have capitalised columns on some tables (`Interactions."Content"`, `Leads."Conversion_Status"`). Check with `\d` before writing SQL against a table you have not touched.
- DB access for scripts: `node --env-file=.env` with `pg` (db:push needs a TTY and must not be used).

## Review Focus

1. A client user requests `?scope=demo`: must get 403, never an empty 200.
2. A client user requests a demo call, or another account's call, by id: must get 404, and `/recording` the same.
3. Owner impersonating a client: must see no Demo tab and no demo rows (server-driven, not UI-driven).
4. A call with `summary = {}`, null persona, null outcome, no lead, no `ended_at`: list and detail render with fallbacks, no throw.
5. Zero calls in the 7-day window: stats return `calls: 0`, `bookedRate: 0`, `avgDurationSeconds: null` and the strip shows "0" and an en dash.
6. Presenting masking of short, foreign, or null numbers and single-word or null names must not throw and must never reveal the middle digits.
7. Engine restart between `/voice/live/session` and the call's first turn loses the in-memory persona: the row must still be written with the "Universal demo" fallback.

## File Structure

| File | Responsibility |
|---|---|
| `/home/gabriel/automations/scripts/migrate_add_voice_call_persona_outcome.py` (new) | Idempotent ADD COLUMN for 3 columns |
| `/home/gabriel/automations/tools/db/voice_outcome.py` (new) | Pure `derive_outcome` |
| `/home/gabriel/automations/tools/db/voice_calls.py` (modify) | persona + outcome writers |
| `/home/gabriel/automations/src/webhooks/persona_registry.py` (new) | session_id to persona map for the web demo |
| `/home/gabriel/automations/tests/test_voice_outcome.py` (new) | outcome rules |
| `shared/schema.ts` (modify) | 6 columns on `voiceCalls` |
| `shared/voiceOutcome.ts` (new) | TS `deriveOutcome`, mirrors Python |
| `server/routes/voiceCallsAccess.ts` (new) | Pure access resolver |
| `server/storage/voiceCallsSql.ts` (new) | Scope/duration SQL fragments |
| `server/storage/voiceCalls.ts` (modify) | list/detail/stats/capabilities |
| `server/routes/voice-calls.ts` (modify) | routes + recording proxy |
| `client/src/features/voiceCalls/maskIdentity.ts` (new) | Pure masking |
| `client/src/features/voiceCalls/usePresenting.ts` (new) | Presenting state |
| `client/src/features/voiceCalls/components/StatsStrip.tsx` (new) | 3 stat cards |
| `client/src/features/voiceCalls/components/OutcomePill.tsx` (new) | Outcome pill over shared `Pill` |
| `client/src/features/voiceCalls/api/voiceCallsApi.ts` (modify) | scope, stats, capabilities hooks |
| `VoiceCallsPage.tsx`, `VoiceCallsInbox.tsx`, `VoiceCallListCard.tsx`, `VoiceCallDetail.tsx`, `VoiceCallsMenus.tsx`, `listOptions.ts`, `useCallAudio.ts`, `bits.tsx` (modify) | wire it together |
| `client/src/pages/app.tsx`, `client/src/components/crm/RightSidebar.tsx` (modify) | guard + nav gating |
| `client/src/locales/{en,nl,pt}/voiceCalls.json` (modify) | strings |

## Shared contract: i18n keys (Lane C uses them, Lane D writes them)

All inside `voiceCalls.json`, same nesting in en/nl/pt:

```
tabs.live, tabs.demo, tabs.aria
stats.demosWeek, stats.callsWeek, stats.bookedRate, stats.avgLength, stats.last7Days, stats.noValue
outcomes.booked, outcomes.callback, outcomes.transferred, outcomes.hungUp, outcomes.other
menus.outcome            (Filter menu group title)
presenting.label, presenting.on, presenting.off, presenting.tooltip
persona.universal        ("Universal demo")
emptyLive.title, emptyLive.hint
accountFilter.all, accountFilter.label
```

Existing keys (`title`, `views.*`, `status.*`, `menus.*`, `sort.*`, `group.*`, `empty`, `nothingHere`, `showing`) stay. `views.*` may remain unused.

## Shared contract: API types (Lane B produces, Lane C consumes)

```ts
export type VoiceOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";
export type VoiceScope = "live" | "demo";

export interface VoiceCallListItem {          // server/storage/voiceCalls.ts, mirrored in client api file
  callId: string; sessionId: string | null; leadsId: number | null;
  callerName: string | null; language: string | null; startedAt: string;
  durationSeconds: number | null; turnCount: number;
  bookedSlot: string | null; bookedIso: string | null;
  outcome: VoiceOutcome;                       // always set, derived when column null
  conclusion: string | null;                   // old free-text summary.outcome
  intents: string[]; leadStatus: string | null; callerNumber: string | null;
  scope: VoiceScope;
  personaCompany: string | null; personaNiche: string | null;   // null on Live
  accountId: number; accountName: string | null;                // accountName only for agency users
}
export interface VoiceStats { calls: number; bookedRate: number; avgDurationSeconds: number | null }
export interface VoiceCapabilities { live: boolean; demo: boolean }
```

Endpoints (see spec): `GET /api/voice-calls?scope&limit&offset&accountId`, `GET /api/voice-calls/stats?scope&accountId`, `GET /api/voice-calls/capabilities`, `GET /api/voice-calls/:callId`, `GET /api/voice-calls/:callId/recording`. Static routes (`stats`, `capabilities`) register before `/:callId`.

---

# LANE A: Engine (Python, `/home/gabriel/automations`)

Read `/home/gabriel/automations/CLAUDE.md` first.

### Task A1: Migration

**Files:** Create `scripts/migrate_add_voice_call_persona_outcome.py`. Model it on `scripts/migrate_add_voice_numbers.py` (read it, copy its connection and schema handling).

- [ ] **Step 1:** Write the script. It runs, inside the schema used by `fq(Table.VOICE_CALLS)`:

```sql
ALTER TABLE <voice_calls> ADD COLUMN IF NOT EXISTS persona_company text;
ALTER TABLE <voice_calls> ADD COLUMN IF NOT EXISTS persona_niche text;
ALTER TABLE <voice_calls> ADD COLUMN IF NOT EXISTS outcome text;
```

- [ ] **Step 2:** Run it twice (`python scripts/migrate_add_voice_call_persona_outcome.py`); second run must succeed unchanged.
- [ ] **Step 3:** Verify: `psql` or a one-off asyncpg query listing `information_schema.columns` for the table shows the 3 new columns.

### Task A2: `derive_outcome` (TDD)

**Files:** Create `tools/db/voice_outcome.py`, `tests/test_voice_outcome.py`.

**Produces:** `derive_outcome(*, transferred: bool, booked_slot: str | None, intents: list[str], duration_seconds: float | None, has_summary: bool, abandoned: bool) -> str`.

- [ ] **Step 1: failing test**

```python
from tools.db.voice_outcome import derive_outcome

def kw(**o):
    base = dict(transferred=False, booked_slot=None, intents=[], duration_seconds=120,
                has_summary=True, abandoned=False)
    base.update(o)
    return base

def test_transferred_beats_booked():
    assert derive_outcome(**kw(transferred=True, booked_slot="Thu 14:30")) == "transferred"

def test_booked():
    assert derive_outcome(**kw(booked_slot="Thu 14:30")) == "booked"

def test_callback_intent():
    assert derive_outcome(**kw(intents=["info", "callback_now"])) == "callback"

def test_booked_beats_callback():
    assert derive_outcome(**kw(booked_slot="x", intents=["callback_now"])) == "booked"

def test_abandoned_is_hung_up():
    assert derive_outcome(**kw(abandoned=True)) == "hung_up"

def test_short_without_summary_is_hung_up():
    assert derive_outcome(**kw(duration_seconds=4, has_summary=False)) == "hung_up"

def test_short_with_summary_is_other():
    assert derive_outcome(**kw(duration_seconds=4)) == "other"

def test_unknown_duration_no_summary_is_other():
    assert derive_outcome(**kw(duration_seconds=None, has_summary=False)) == "other"

def test_default_other():
    assert derive_outcome(**kw()) == "other"
```

- [ ] **Step 2:** `cd /home/gabriel/automations && python -m pytest tests/test_voice_outcome.py -q` fails (module missing).
- [ ] **Step 3: implement**

```python
"""Outcome of one voice call. Mirrors shared/voiceOutcome.ts (the CRM derives
the same rules for rows from before this column existed)."""

OUTCOMES = ("booked", "callback", "transferred", "hung_up", "other")
HUNG_UP_MAX_SECONDS = 10


def derive_outcome(*, transferred: bool, booked_slot: str | None, intents: list[str],
                   duration_seconds: float | None, has_summary: bool, abandoned: bool) -> str:
    if transferred:
        return "transferred"
    if booked_slot:
        return "booked"
    if "callback_now" in intents:
        return "callback"
    if abandoned:
        return "hung_up"
    if duration_seconds is not None and duration_seconds < HUNG_UP_MAX_SECONDS and not has_summary:
        return "hung_up"
    return "other"
```

- [ ] **Step 4:** pytest passes.

### Task A3: Writers in `tools/db/voice_calls.py`

**Files:** Modify `tools/db/voice_calls.py`.

**Produces:**
- `record_persona(*, call_id, accounts_id, persona_company, persona_niche)`: upsert, `COALESCE(existing, new)` so first stamp wins and `None` never overwrites.
- `record_call_open(...)` gains optional `persona_company: str | None = None, persona_niche: str | None = None` and writes them (`COALESCE` on conflict).
- `mark_transferred(*, call_id)`: `UPDATE ... SET outcome = 'transferred', updated_at = now() WHERE call_id = $1`.
- `finalize_outcome(*, call_id, abandoned: bool)`: reads the row (`outcome, booked_slot, summary, started_at, ended_at`), keeps `transferred` if already set, otherwise computes with `derive_outcome` (intents from `summary["items"][*]["intent"]`, tolerate malformed summary like the TS `normalizeSummary`; duration = `ended_at - started_at` seconds or None) and `UPDATE`s `outcome`.

- [ ] **Step 1:** Add a pytest for the pure parsing helper `_intents_of(summary: object) -> list[str]` (handles `None`, `{}`, `{"items": "x"}`, items with non-dict entries). Run, see fail.
- [ ] **Step 2:** Implement `_intents_of` and the four writers (reuse `_execute`, `get_pool`).
- [ ] **Step 3:** Call `finalize_outcome(call_id=..., abandoned=False)` at the end of the wrap-up route in `src/webhooks/live_voice_routes.py` (after `record_wrap_up`) and in `PhoneCall.wrap_up` (`src/automations/voice/phone_call.py`, after its summary write). Call `finalize_outcome(..., abandoned=True)` in `src/automations/voice_call_sweep.py` right after `close_abandoned_call`. Wrap each in try/except that logs `voice.calls.outcome_failed` and never raises.
- [ ] **Step 4:** In `PhoneCall._transfer` and `_bridge_transfer`, at the two spots that log `voice.phone.transferred`, `await mark_transferred(call_id=<this call's id>)` (find the attribute that holds the call id; it is the same id passed to `record_call_open`). Never raise.
- [ ] **Step 5:** pytest for the new tests passes; `pm2 restart leadawaker-engine`; `pm2 logs leadawaker-engine --lines 30 --nostream` shows clean startup.

### Task A4: Persona for the browser demo

**Files:** Create `src/webhooks/persona_registry.py`; modify `src/webhooks/live_voice_routes.py`, `src/webhooks/realtime_voice_routes.py` (`RelayEventBody`, `voice_relay`), `src/automations/voice/event_logger.py` (`CallLogger`), `/home/gabriel/LeadAwakerApp/client/src/features/voiceDemo/useLiveCall.ts:258` (send `session_id`).

Persona is resolved server-side only. The browser sends just `session_id`, a lookup key.

- [ ] **Step 1: failing test** `tests/test_persona_registry.py`:

```python
from src.webhooks.persona_registry import remember, recall, MAX_ENTRIES

def test_roundtrip():
    remember("live_a", company="Acme Solar", niche="Solar")
    assert recall("live_a") == ("Acme Solar", "Solar")

def test_unknown_is_none_pair():
    assert recall("live_missing") == (None, None)

def test_bounded():
    for i in range(MAX_ENTRIES + 50):
        remember(f"live_{i}", company="c", niche="n")
    assert recall("live_0") == (None, None)
    assert recall(f"live_{MAX_ENTRIES + 49}") == ("c", "n")
```

- [ ] **Step 2:** Implement with an `OrderedDict`, `MAX_ENTRIES = 500`, evict oldest.
- [ ] **Step 3:** In `live_session`, after `session_id` is known, `remember(session_id, company=company, niche=<niche>)`. Niche: read what `_load_demo_persona(body.token)` / `resolve_persona_prompt` already expose (look at the persona blob keys, e.g. `niche`, `industry`, or the Niche_Vocabulary name; if only a free-text `business` is available, use the niche name from the persona blob and fall back to `None`). Do not invent a new LLM call.
- [ ] **Step 4:** Add optional `session_id: str | None = None` to `RelayEventBody`; in `voice_relay`, pass it into `CallLogger(session_id=...)`. `CallLogger.__init__` gets `session_id: str | None = None`; in `_log` after `record_turn`, if `session_id` and not yet stamped, `recall()` and `_record(record_persona, ...)` once (guard with `self._persona_done`).
- [ ] **Step 5:** `useLiveCall.ts` relay body adds `session_id: sessionIdRef.current`.
- [ ] **Step 6:** pytest passes. `pm2 restart leadawaker-engine`.
- [ ] **Step 7 (manual evidence):** run one browser demo turn through the relay with a known token via a small script or curl and confirm the row has `persona_company` set. If the persona is missing (restart case) the row stays null and the CRM shows the fallback (Review Focus 7).

### Task A5: Persona for the phone door

**Files:** Modify `src/webhooks/phone_voice_routes.py` (`_start_call`, around lines 166-290) and the `record_call_open` call.

- [ ] **Step 1:** Demo line: parse `demo_niche` JSON of the lead returned by `find_demo_lead` for `company_name` / niche name (look at how `_load_demo_persona` or the demo-niche overlay names these, and reuse that parser). Client line: company and niche from the `Niche_Vocabulary` row already loaded as `client_persona`. No match: both `None`.
- [ ] **Step 2:** Pass `persona_company`, `persona_niche` into `record_call_open`.
- [ ] **Step 3:** `pm2 restart leadawaker-engine`, `pm2 logs ... --nostream`; unit test the parser with pytest using two fixtures (valid JSON, garbage string).

---

# LANE B: Server

### Task B1: Drizzle catch-up

**Files:** Modify `shared/schema.ts:837-858`.

- [ ] **Step 1:** Add to `voiceCalls`: `dialedNumber: text("dialed_number")`, `callerNumber: text("caller_number")`, `voiceNumbersId: integer("voice_numbers_id")`, `personaCompany: text("persona_company")`, `personaNiche: text("persona_niche")`, `outcome: text("outcome")`.
- [ ] **Step 2:** Confirm the columns exist in the live DB (A1 may still be running; if `persona_*`/`outcome` are missing, wait for Lane A's migration, do not create them yourself).

### Task B2: `deriveOutcome` (TDD)

**Files:** Create `shared/voiceOutcome.ts`, `shared/voiceOutcome.test.ts`. Run tests with `npx tsx --test shared/voiceOutcome.test.ts`.

- [ ] **Step 1: failing test** (node:test + assert/strict), mirroring A2: transferred beats booked; booked; callback via `callback_now`; booked beats callback; `abandoned` gives `hung_up`; `durationSeconds 4` with no summary gives `hung_up`, with summary gives `other`; null duration gives `other`.
- [ ] **Step 2: implement**

```ts
export type VoiceOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";
export const HUNG_UP_MAX_SECONDS = 10;

export function deriveOutcome(a: {
  transferred: boolean; bookedSlot: string | null; intents: string[];
  durationSeconds: number | null; hasSummary: boolean; abandoned: boolean;
}): VoiceOutcome {
  if (a.transferred) return "transferred";
  if (a.bookedSlot) return "booked";
  if (a.intents.includes("callback_now")) return "callback";
  if (a.abandoned) return "hung_up";
  if (a.durationSeconds !== null && a.durationSeconds < HUNG_UP_MAX_SECONDS && !a.hasSummary) return "hung_up";
  return "other";
}

export function isVoiceOutcome(v: unknown): v is VoiceOutcome {
  return v === "booked" || v === "callback" || v === "transferred" || v === "hung_up" || v === "other";
}
```

- [ ] **Step 3:** tests pass.

### Task B3: Access resolver (TDD)

**Files:** Create `server/routes/voiceCallsAccess.ts`, `server/routes/voiceCallsAccess.test.ts`.

**Produces:**

```ts
export interface VoiceAccess {
  isOwner: boolean;            // Owner role and NOT impersonating
  isAgency: boolean;           // account 1 or Owner/Admin role, and NOT impersonating
  lockedAccountId: number | null; // set for clients and impersonation
}
export function resolveVoiceAccess(input: {
  role: string; accountsId: number | null; impersonatedAccountId: number | null;
}): VoiceAccess;

export type ScopeDecision =
  | { ok: true; scope: "live" | "demo"; accountId: number | null }
  | { ok: false; status: 403 };
export function decideScope(access: VoiceAccess, q: { scope?: unknown; accountId?: unknown }): ScopeDecision;
```

Rules: impersonating gives `isOwner=false, isAgency=false, lockedAccountId=impersonated`. Role `Owner`, not impersonating: `isOwner`, `isAgency`. Role `Admin` or `accountsId === 1`, not impersonating: `isAgency`, not owner. Otherwise `lockedAccountId = accountsId`. `decideScope`: `scope` missing or anything other than `demo` becomes `live`; `demo` and `!isOwner` gives `{ok:false,status:403}`; `accountId` query honored only if `isAgency`, else `lockedAccountId`.

- [ ] **Step 1:** tests: owner demo ok; admin demo 403; client demo 403; client with `accountId=99` is locked to own account; impersonating owner demo 403 and locked to impersonated; garbage `scope` becomes live; owner `accountId=7` honored.
- [ ] **Step 2:** fail, implement, pass (`npx tsx --test server/routes/voiceCallsAccess.test.ts`).

### Task B4: SQL fragments

**Files:** Create `server/storage/voiceCallsSql.ts`.

- [ ] **Step 1:** Inspect live tables: `Campaigns` (`is_demo`), `Leads` (`demo_niche`, `channel_identifier`), `Voice_Numbers` (find the account column name and `client_niche`, `enabled`, `id`). Record exact names in a comment.
- [ ] **Step 2:** Export:

```ts
// A call is Demo when ANY holds (spec "Classification").
export const isDemoSql = sql<boolean>`(
  EXISTS (SELECT 1 FROM <Campaigns> c WHERE c.id = ${voiceCalls.campaignsId} AND c.is_demo = true)
  OR EXISTS (SELECT 1 FROM <Leads> l WHERE l.id = ${voiceCalls.leadsId}
             AND (l.demo_niche IS NOT NULL OR l.channel_identifier LIKE 'wa-demo:%' OR l.channel_identifier LIKE 'web-demo:%'))
  OR EXISTS (SELECT 1 FROM <Voice_Numbers> n WHERE n.id = ${voiceCalls.voiceNumbersId} AND n.client_niche IS NULL)
  OR (${voiceCalls.voiceNumbersId} IS NULL AND ${voiceCalls.campaignsId} IS NULL)
)`;
export const durationSecondsSql = sql<number | null>`EXTRACT(EPOCH FROM (COALESCE(${voiceCalls.endedAt}, <lastTurnAt>) - ${voiceCalls.startedAt}))`;
```

(`<...>` = the real schema-qualified, quoted names.) Reuse `lastTurnAt` from `voiceCalls.ts` by moving it into this file and importing it back.

- [ ] **Step 3:** In `psql`/pg, run `SELECT count(*) FILTER (WHERE <isDemo>) , count(*) FROM Voice_Calls`: expect 75 of 75 demo today. Paste the numbers in your report.

### Task B5: Storage

**Files:** Modify `server/storage/voiceCalls.ts` (keep under 500 lines; move `normalizeSummary` to `voiceCallsSql.ts` or a `voiceCallsNormalize.ts` if needed).

**Produces:** `listVoiceCalls({limit, offset, scope, accountId, includeAccountName})`, `getVoiceCall(callId, {scope?: "live", accountId, allowDemo})`, `getVoiceStats({scope, accountId})`, `getVoiceCapabilities(access)`.

- [ ] **Step 1:** `toItem` gains `scope` (from `isDemoSql`), persona (`personaCompany/Niche` only when `scope==="demo"`), `accountId`, `accountName` (subselect on `Accounts` only when `includeAccountName`), `conclusion = summary?.outcome`, and `outcome`: stored column if `isVoiceOutcome`, else `deriveOutcome({transferred:false, bookedSlot, intents, durationSeconds, hasSummary: !!summary, abandoned: endedAt===null && startedAt older than 15 min})`.
- [ ] **Step 2:** list: `WHERE (scope==="demo" ? isDemoSql : NOT isDemoSql)` plus `accounts_id = accountId` when set. Live ALWAYS applies `NOT isDemoSql`, regardless of caller.
- [ ] **Step 3:** detail: fetch, then return `undefined` when the call is demo and `!allowDemo`, or when `accountId` is set and differs. (Route turns `undefined` into 404.)
- [ ] **Step 4:** stats: one SQL over the last 7 days (`started_at > now() - interval '7 days'`), same scope/account filters:

```sql
SELECT count(*)::int AS calls,
       count(*) FILTER (WHERE booked_slot IS NOT NULL)::int AS booked,
       avg(dur) FILTER (WHERE dur >= 10) AS avg_dur
FROM (SELECT booked_slot, <durationSeconds> AS dur FROM Voice_Calls WHERE ...) t
```

`bookedRate = calls ? booked/calls : 0`, `avgDurationSeconds = avg_dur === null ? null : Math.round(avg_dur)`.
- [ ] **Step 5:** capabilities: `demo = access.isOwner`; `live = access.isOwner || EXISTS enabled Voice_Numbers row for lockedAccountId` (agency non-owner: any enabled row with `client_niche IS NOT NULL`).
- [ ] **Step 6:** Verify with a pg script: list demo returns 75 rows with `scope:"demo"`; list live returns 0; stats demo returns `calls` about 29 (rolling 7 days at time of writing, will drift).

### Task B6: Routes and recording proxy

**Files:** Modify `server/routes/voice-calls.ts`.

- [ ] **Step 1:** Replace `requireOwner` with `requireAuth` + `scopeToAccount`; build `VoiceAccess` from `req.user`, `req.session?.impersonation?.accountId`; use `decideScope`.
- [ ] **Step 2:** Routes in this order: `GET /api/voice-calls/capabilities`, `GET /api/voice-calls/stats`, `GET /api/voice-calls`, `GET /api/voice-calls/:callId/recording`, `GET /api/voice-calls/:callId`.
  - 403 `{message}` when `decideScope` says so.
  - Detail/recording: load via `getVoiceCall(callId, {accountId: access.lockedAccountId, allowDemo: access.isOwner})`; `undefined` gives 404 `Call not found`. Never 403 here.
  - Recording: needs `sessionId`; none gives 404. Proxy `GET ${ENGINE_URL}/voice/live/recording/${sessionId}` with header `x-internal-key` (find how other server code reaches the engine and the key: grep `INTERNAL_API_KEY` / `x-internal-key` / the engine base URL env), stream with `Content-Type: audio/wav`, `Cache-Control: private, max-age=300`. Engine non-2xx gives 502.
- [ ] **Step 3:** After the server restarts (5-8s), check `pm2 logs --nostream` is clean. Exercise with a pg-free approach: an unauthenticated `curl -i localhost:<port>/api/voice-calls` returns 401, and `/api/voice-calls/capabilities` returns 401.
- [ ] **Step 4:** Do NOT change the engine recording route here (Task INT-1 does it after the client switches).

---

# LANE C: Frontend (`client/src`)

Read `UI_STANDARDS.md`, `UI_PATTERNS.md`, `features/voiceCalls/**`, `features/demos/pages/DemosPage.tsx:39-55`, `components/crm/primitives/Pill.tsx`, and find the KPI card pattern (`BookedCallsKpi.tsx`) before writing UI.

### Task C1: `maskIdentity` (TDD)

**Files:** Create `features/voiceCalls/maskIdentity.ts`, `maskIdentity.test.ts` (`npx tsx --test ...`).

**Produces:** `maskNumber(n: string | null): string | null`, `maskName(n: string | null): string | null`.

- [ ] **Step 1: failing tests**

```ts
import test from "node:test"; import assert from "node:assert/strict";
import { maskNumber, maskName } from "./maskIdentity";

test("number keeps country-ish prefix and last 2 digits", () => {
  assert.equal(maskNumber("+31612345647"), "+31 6 ••• ••• 47");
});
test("short or odd numbers never reveal the middle", () => {
  assert.equal(maskNumber("12345"), "••• 45");
  assert.equal(maskNumber("web"), "web");        // not digits: leave the label
  assert.equal(maskNumber(null), null);
  assert.equal(maskNumber(""), null);
});
test("name is first name plus initial", () => {
  assert.equal(maskName("Jan de Vries"), "Jan V.");
  assert.equal(maskName("Madonna"), "Madonna");
  assert.equal(maskName("  "), null);
  assert.equal(maskName(null), null);
});
```

(Adjust `de Vries`: initial of the LAST word.)
- [ ] **Step 2:** fail, implement (strip non-digits except leading `+`; need >= 7 digits for the long form, else `"••• " + last2`), pass.

### Task C2: API layer

**Files:** Modify `features/voiceCalls/api/voiceCallsApi.ts`.

**Consumes:** the API types in the shared contract.

- [ ] **Step 1:** Update `VoiceCallListItem`/`VoiceCallDetail` types to the contract.
- [ ] **Step 2:** `useVoiceCalls(scope: VoiceScope, accountId?: number)` with query key `["/api/voice-calls", scope, accountId ?? null]`, URL `/api/voice-calls?scope=${scope}&limit=200[&accountId=]`, 30s stale / 60s refetch as today. `useVoiceStats(scope, accountId?)` key `["/api/voice-calls/stats", scope, accountId ?? null]`. `useVoiceCapabilities()` key `["/api/voice-calls/capabilities"]`, stale 5 min. Reuse the existing fetch helper in the file.

### Task C3: Presenting state

**Files:** Create `features/voiceCalls/usePresenting.ts`.

- [ ] **Step 1:** `usePresenting(isOwner: boolean): { masked: boolean; toggle(): void }`. Default `masked = isOwner`. Persisted in `localStorage` key `la.voiceCalls.presenting` (`"1"` masked, `"0"` revealed), every access in try/catch. For non-owners `masked` is always `false` and `toggle` does nothing.

### Task C4: StatsStrip and OutcomePill

**Files:** Create `components/StatsStrip.tsx`, `components/OutcomePill.tsx`; modify `bits.tsx` (remove local `BookedPill` once nothing uses it).

- [ ] **Step 1:** `StatsStrip({ scope })` uses `useVoiceStats`. Three cards (label key `stats.demosWeek` or `stats.callsWeek` by scope, `stats.bookedRate`, `stats.avgLength`), caption `stats.last7Days`. Values: calls as integer, booked rate as `Math.round(rate*100) + "%"`, length as `m:ss` via existing `format.ts` (add `formatAvg` if absent); no data shows `0` for calls and `stats.noValue` (an en dash) for the others. Loading shows skeleton blocks. Card markup follows the KPI card pattern in the repo; row is `grid grid-cols-3`, `grid-cols-1` under 640px.
- [ ] **Step 2:** `OutcomePill({ outcome, bookedSlot? })` wraps the shared `Pill` with label `outcomes.*`, colours taken from `status.ts` palette per outcome (booked=Booked yellow, callback=Responded teal, transferred=Contacted blue, hung_up=muted token, other=muted token). Booked shows the slot text inside the pill when `bookedSlot` is set.

### Task C5: Page shell, tabs, filters

**Files:** Modify `VoiceCallsPage.tsx`, `VoiceCallsMenus.tsx`, `listOptions.ts`.

- [ ] **Step 1:** `useVoiceCapabilities()` gives `{live, demo}`. `scope` state: `demo` allowed only if `capabilities.demo`; initial from localStorage `la.voiceCalls.scope` (try/catch) else `demo` when allowed else `live`. If neither capability is true, render nothing but a redirect-safe empty state (guard in C7 normally prevents this).
- [ ] **Step 2:** Topbar (`la-page-header`): serif title, then, only when `capabilities.demo`, the `la-seg` control with `tabs.live` / `tabs.demo` (`aria-label` `tabs.aria`), then search, then the Filter/Sort/Group menus, then (owner only) the Presenting eye toggle: icon `Eye`/`EyeOff` from lucide, `title`/`aria-label` from `presenting.tooltip`, visible state from `presenting.on|off`.
- [ ] **Step 3:** Remove the All/Booked/Not booked inline buttons. In `listOptions.ts` replace `view` with `outcomes: VoiceOutcome[]` (empty = all) and update `filterCalls`; in `VoiceCallsMenus.tsx` add an "Outcome" checkbox group (title `menus.outcome`, items `outcomes.*`) next to the existing status/language groups. Keep the status/language filters.
- [ ] **Step 4:** Owner on Live: an account filter chip (`accountFilter.label`, default `accountFilter.all`) built from the distinct `accountId/accountName` in the loaded calls; selecting one passes `accountId` to `useVoiceCalls`.
- [ ] **Step 5:** Render `<StatsStrip scope={scope} />` above the inbox. Keep `VoiceCallsPage.tsx` under 500 lines; extract `VoiceCallsTopbar.tsx` if it grows.

### Task C6: List row, detail, masking

**Files:** Modify `VoiceCallListCard.tsx`, `VoiceCallDetail.tsx`, `CallRecap.tsx`, `VoiceCallsInbox.tsx`, `bits.tsx`, `status.ts`.

- [ ] **Step 1:** `VoiceCallsInbox` takes `scope`, `masked` and passes them down; empty state: Live uses `emptyLive.title` / `emptyLive.hint`, Demo keeps the existing text.
- [ ] **Step 2:** Row. Demo: title `personaCompany ?? t("persona.universal")`, niche chip when `personaNiche`, second line `callerLabel · m:ss`, time, `<OutcomePill>` on the right. Live: title is the caller label, second line is `conclusion`, `<OutcomePill>` on the right. Avatar tint comes from `callStatus()` (update `status.ts` so `outcome` feeds it: `booked`, `callback` uses `info`, `transferred` uses `quote`; keep dnc/default logic). Keep `data-testid="voice-call-row"`.
- [ ] **Step 3:** `callerLabel` and every place a number or name is shown (row, detail header, recap) goes through `maskName` / `maskNumber` when `masked`. Detail header chip row adds persona + `OutcomePill` on Demo calls.
- [ ] **Step 4:** Rows with `outcome` missing or unknown values render as `other` (defensive).

### Task C7: Route guard and nav

**Files:** Modify `client/src/pages/app.tsx` (around lines 208-213), `client/src/components/crm/RightSidebar.tsx:280`.

- [ ] **Step 1:** Replace `<OwnerOnly>` around `VoiceCallsPage` with a `VoiceCallsGuard` that calls `useVoiceCapabilities()`; while loading render the existing page loader; `!live && !demo` redirects to `${prefix}/campaigns`. Keep the lazy import untouched.
- [ ] **Step 2:** Sidebar item drops `ownerOnly: true`, gains a `voiceCallsOnly: true` flag in the item type and the filter logic that renders items: hide unless `useVoiceCapabilities().data` says `live || demo`. Hidden while loading.

### Task C8: Recording through Express

**Files:** Modify `features/voiceCalls/useCallAudio.ts`.

- [ ] **Step 1:** Fetch `/api/voice-calls/${callId}/recording` (same-origin, credentials included, using the app's existing fetch convention) instead of `${ENGINE_BASE_URL}/voice/live/recording/${sessionId}`. Thread `callId` into the hook (callers already hold it). Keep error behavior unchanged.

---

# LANE D: i18n

### Task D1: Locale strings

**Files:** Modify `client/src/locales/{en,nl,pt}/voiceCalls.json`.

- [ ] **Step 1:** Add every key in "Shared contract: i18n keys". English examples: `tabs.live` "Live", `tabs.demo` "Demo", `stats.demosWeek` "Demos this week", `stats.callsWeek` "Calls this week", `stats.bookedRate` "Booked rate", `stats.avgLength` "Average call length", `stats.last7Days` "Last 7 days", `stats.noValue` "–", `outcomes.booked` "Booked", `callback` "Callback", `transferred` "Transferred", `hungUp` "Hung up", `other` "Conversation", `menus.outcome` "Outcome", `presenting.label` "Presenting", `presenting.on` "Identities hidden", `presenting.off` "Identities shown", `presenting.tooltip` "Hides caller names and numbers. Transcript text and audio are not hidden.", `persona.universal` "Universal demo", `emptyLive.title` "No calls yet", `emptyLive.hint` "Calls on your voice line appear here.", `accountFilter.all` "All accounts", `accountFilter.label` "Account".
- [ ] **Step 2:** NL and PT-BR translations (PT uses unicode escapes only if the file already does; match the file's existing style). No en dashes except the `stats.noValue` glyph, which must be the same in all three.
- [ ] **Step 3:** `node -e "for (const l of ['en','nl','pt']) JSON.parse(require('fs').readFileSync('client/src/locales/'+l+'/voiceCalls.json','utf8'))"` passes and a key-diff script shows identical key sets across the three files.

---

# INTEGRATION (main session, after A, B, C, D are done)

### Task INT-1: Lock the engine recording route

**Files:** `/home/gabriel/automations/src/webhooks/live_voice_routes.py:211`.

- [ ] **Step 1:** Add a header check: reject unless `x-internal-key` matches the engine's existing internal key setting (find how other engine routes validate it). `pm2 restart leadawaker-engine`.
- [ ] **Step 2:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/voice/live/recording/live_x` is 401/403; as Owner in the CRM a call's recording still plays (proxy path).

### Task INT-2: End-to-end verification

- [ ] **Step 1:** `pm2 logs --nostream --lines 60` for server and engine: no errors.
- [ ] **Step 2:** playwright-cli as Owner on `app.leadawaker.com/platform/voice-calls`: Demo tab default, stats strip populated, rows show persona or "Universal demo", numbers masked, eye toggle reveals, Live tab shows the empty state, a recording plays. Screenshot to the scratchpad. Close the browser.
- [ ] **Step 3:** Impersonate a client account (e.g. account 53): no tab bar, no demo rows, nav entry hidden unless the account has a voice line, `fetch('/api/voice-calls?scope=demo')` from the console returns 403, `fetch('/api/voice-calls/<a demo call id>')` returns 404.
- [ ] **Step 4:** Report changed files, anything that failed, and what was not verified. Do not commit.

---

## Self-review

- Spec coverage: access model (B3, B5, B6, C7), classification (B4), persona/outcome columns (A1 to A5), Drizzle catch-up (B1), API contract (B5, B6), stats (B5, C4), UI (C4 to C6), presenting (C1, C3, C5, C6), i18n (D1), recording security (B6, C8, INT-1), Callers spec is separate and untouched.
- Deviation from spec, deliberate: booked rate counts `booked_slot IS NOT NULL` (the ground truth) rather than `outcome = 'booked'`, so a transferred call that also booked still counts as booked.
- Type consistency: `VoiceOutcome`, `VoiceScope`, `VoiceCallListItem` fields, `deriveOutcome` and `derive_outcome` argument names match across lanes.
