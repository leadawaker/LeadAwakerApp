# Voice calls Callers view Implementation Plan

> **For agentic workers:** execute your lane task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One row per caller on `/platform/voice-calls` with call history, lead and booking chips, a logged human Call back, and an Owner-only Push to HubSpot.

**Architecture:** Express aggregates callers in SQL over the existing scoped call set and owns the Leads column, call-back logging and the Owner-only HubSpot proxy. The Python engine gets one internal-key endpoint that pushes a contact (and best-effort note) through the existing `HubSpotClient`. React adds a `Calls | Callers` switch, a callers list and a caller detail pane that reuses `VoiceCallDetail`.

**Tech Stack:** Express + Drizzle + pg, FastAPI + aiohttp (engine), React + react-i18next, `npx tsx --test` and pytest.

**Spec:** `specs/voice-calls-callers-tab/requirements.md` (binding contract). Earlier build for patterns: `specs/voice-calls-demo-tab/`.

## Global Constraints

- Never run `tsc` or `npm run dev`. Server auto-restarts via pm2 watch (5-8s); engine: `pm2 restart leadawaker-engine`, engine python is `/home/gabriel/automations/.venv/bin/python`.
- No em dashes anywhere. All user-facing strings via i18n in `client/src/locales/{en,nl,pt}/voiceCalls.json` (PT Brazilian). Tokens only, dark mode safe, files under 500 lines.
- Postgres schema `p2mxx34fvbf3ll6`; check columns with `information_schema` before writing SQL. Migrations by direct `pg` script with `node --env-file=.env`, `ADD COLUMN IF NOT EXISTS`.
- Do NOT commit. Do NOT push anything to HubSpot except in the single verification step that says so.
- Close every playwright browser you open.

## Review Focus

1. A client calling `/callers?scope=demo` gets 403; a client POSTing call-back or hubspot for a demo lead or another account's lead gets 404 / 403, never a write.
2. Re-pushing the same lead to HubSpot updates the stored contact, never creates a second one (also when the stored id was deleted in HubSpot: fall back to search, then create, and overwrite the stored id).
3. A caller with no phone: Call back buttons disabled, no `tel:` with `null`.
4. Account with no business hours or garbage values: `outOfHours` is false, no throw.
5. Note creation failing (missing scope) still returns the contact and `note_created: false`.

---

## LANE E: Engine (`/home/gabriel/automations`)

### Task E1: `push_voice_caller` (TDD)

**Files:** Create `src/automations/voice/hubspot_push.py`, `tests/voice/test_hubspot_push.py`; modify `tools/hubspot_enricher.py` only if a missing primitive is needed (add `search_contact_by_phone` and `create_note` methods there, same style as `search_contact_by_email`).

**Produces:** `async def push_voice_caller(client, session, *, contact_id, first_name, last_name, email, phone, company_name, recap_lines) -> dict` returning `{"contact_id": str, "url": str, "note_created": bool}`.

Logic:
1. Company: `company_name` or `"Voice callers"`; `search_company_by_name`, else `create_company({"name": ...})`.
2. Contact: if `contact_id`, `update_contact`; on a 404 RuntimeError from HubSpot, treat as missing. If none: `search_contact_by_email` (when email), then `search_contact_by_phone` (when phone), update if found, else `create_contact(session, company_id, props)`. Always `associate_contact_company` for found or updated contacts.
3. Properties: `firstname`, `lastname`, `email`, `phone`, `hs_lead_status: "NEW"` only on create. Skip `None` values.
4. Note: when `recap_lines`, create a note (`/crm/v3/objects/notes` with `hs_note_body` and `hs_timestamp`, associated to the contact); any exception gives `note_created: False` and a `log.warning`.
5. URL: `https://app-eu1.hubspot.com/contacts/148429886/record/0-1/{id}`.

- [ ] Write tests with a fake client object (record calls; no network): stored id updates; stored id 404 falls back to email search then create; phone match updates; new contact created under found company; missing company creates "Voice callers"; note failure gives `note_created False`.
- [ ] Run `.venv/bin/python -m pytest tests/voice/test_hubspot_push.py -q`, see fail; implement; see pass.

### Task E2: Route

**Files:** Create `src/webhooks/hubspot_voice_routes.py`; register it in `src/main.py` next to the other voice routers.

- [ ] `POST /voice/hubspot/push-caller`, header `X-Internal-Key` checked with `hmac.compare_digest` against `settings.internal_api_key` (copy the check in `src/webhooks/live_voice_routes.py` `live_recording`). Pydantic body per spec. Opens one `aiohttp.ClientSession`, builds `HubSpotClient()`, calls `push_voice_caller`. HubSpot RuntimeError gives 502 `{"detail": str}`. Missing `hubspot_api_key` gives 503.
- [ ] Restart engine, check logs clean, `curl` without key gives 401.

---

## LANE S: Server (`/home/gabriel/LeadAwakerApp`)

### Task S1: Migration and schema

- [ ] Script `scripts/migrate-leads-hubspot-contact-id.mjs`: `ALTER TABLE p2mxx34fvbf3ll6."Leads" ADD COLUMN IF NOT EXISTS hubspot_contact_id text`. Run twice.
- [ ] Declare `hubspotContactId: text("hubspot_contact_id")` on `leads` in `shared/schema.ts`.

### Task S2: Pure helpers (TDD)

**Files:** Create `server/storage/voiceCallersLogic.ts` + `.test.ts` (`npx tsx --test`).

**Produces:**
- `rankOutcome(o: VoiceOutcome): number` and `bestOutcome(list: VoiceOutcome[]): VoiceOutcome` (booked > transferred > callback > other > hung_up; empty list gives `other`).
- `isOutOfHours(hours: { start: unknown; end: unknown; openDays: unknown; timezone: unknown }, now: Date): boolean`. Inspect the live column types of `Accounts.business_hours_start/_end/open_days/timezone` first and parse them defensively; anything unparseable returns `false`.
- `isDnd(lead: { optedOut: unknown; dncReason: unknown; conversionStatus: unknown }): boolean`.
- Tests: ranking, empty list, inside/outside hours across a timezone, closed day, garbage hours give false, DND variants.

### Task S3: Callers aggregation

**Files:** Create `server/storage/voiceCallers.ts`; export through the `storage` barrel like `voiceCalls`.

**Produces:** `listVoiceCallers({ scope, accountId, isOwner, includeAccountName }): Promise<VoiceCaller[]>` and `getCallerLead(leadsId, { scope, accountId, allowDemo })` returning the lead row plus account id when the user may act on it, else `undefined`.

- [ ] Reuse `isDemoSql`, `durationSecondsSql`, `lastTurnAt` from `voiceCallsSql.ts`. Fetch all scoped calls (no 200 cap) with the fields needed, group in TypeScript by `leads_id` else `caller_number` (skip when both null). Per-call outcome via the existing `deriveOutcome` path used in `voiceCalls.ts` (extract a shared `outcomeOf(row)` helper there if needed, no duplication). Join lead fields (`first_name`, `last_name`, `phone`, `email`, `opted_out`, `dnc_reason`, `"Conversion_Status"`, `hubspot_contact_id`) and account hours once per account. Last call-back = latest `Interactions` row with `type = 'call_back'` for the lead (`Who`, `created_at`). Owner-only fields null for others.
- [ ] Verify against the live DB with a pg script: demo callers count equals distinct leads (15 at time of writing), live is 0.

### Task S4: Routes

**Files:** Create `server/routes/voiceCallers.ts` and register it from `server/routes/voice-calls.ts` (keep each file under 500 lines). Register `/api/voice-calls/callers` BEFORE `/api/voice-calls/:callId`.

- [ ] `GET /api/voice-calls/callers`: `requireAuth`, `scopeToAccount`, `resolveVoiceAccess` + `decideScope` exactly as the list route.
- [ ] `POST /api/voice-calls/callers/:leadsId/call-back`: validate `channel`; `getCallerLead` with the user's access (demo leads need Owner; client locked to own account); `undefined` gives 404. Insert the Interaction via `storage.createInteraction` (or a direct insert) with `type 'call_back'`, `direction 'internal'`, `ai_generated false`, `Users_id`, `Who` = user's display name, `Content` = "Called back by <name> (phone|whatsapp)", `accounts_id` = lead's account, `created_at` server-side. Never through `/api/interactions`. Return `{ lastCalledBackAt, lastCalledBackBy }`.
- [ ] `POST /api/voice-calls/callers/:leadsId/hubspot`: Owner (not impersonating) else 403. Load lead and up to 5 latest calls' conclusions as `recap_lines` ("<date>: <outcome label>: <conclusion>"). `company_name` = latest persona company, else lead's company field if one exists, else null. POST to `${ENGINE_URL || "http://localhost:8100"}/voice/hubspot/push-caller` with `X-Internal-Key`. On success store `hubspot_contact_id` on the lead and return `{ contactId, url, noteCreated }`. Engine failure gives 502 `{ message }`.
- [ ] HTTP checks as in the previous build: unauthenticated 401; Owner list 200; impersonated client `scope=demo` 403 and call-back on a demo lead 404 and hubspot 403. Do NOT call the hubspot route for real (the integrator does one controlled push).

---

## LANE F: Frontend + i18n (`client/src`)

Read `UI_STANDARDS.md`, `UI_PATTERNS.md`, and all of `client/src/features/voiceCalls/` first.

### Task F1: API + view state

- [ ] `voiceCallsApi.ts`: `VoiceCaller` type per spec; `useVoiceCallers(scope, accountId?)` key `["/api/voice-calls/callers", scope, accountId ?? null]`; `useCallBack()` and `usePushToHubspot()` mutations that invalidate the callers query.
- [ ] View state `"calls" | "callers"` remembered via `localPref.ts` key `la.voiceCalls.view`.

### Task F2: Topbar

- [ ] `VoiceCallsTopbar.tsx`: add the `Calls | Callers` `la-seg` (testids `voice-view-calls`, `voice-view-callers`) shown to everyone; `Live | Demo` stays Owner only. Filters/sort that only apply to calls are hidden in Callers view; search filters callers by name, number and persona.

### Task F3: Callers list and detail

**Files:** Create `components/CallerListCard.tsx`, `components/CallersInbox.tsx`, `components/CallerDetail.tsx`, `components/CallBackButton.tsx`, `components/HubspotPushButton.tsx` (each well under 500 lines).

- [ ] `CallersInbox` mirrors `VoiceCallsInbox` layout (348px list + detail, mobile one-pane with Back, auto-select first on desktop).
- [ ] `CallerListCard` per spec UI section; masking through `maskName` / `maskNumber` when `masked`.
- [ ] `CallerDetail`: header card (name, number, Lead chip linking `/platform/contacts/:id`, booking chip with slot, `CallBackButton`, Owner-only `HubspotPushButton`), then this caller's calls (filter the already-loaded `useVoiceCalls` list by `leadsId` or `callerNumber`), clicking one renders `VoiceCallDetail` under the header.
- [ ] `CallBackButton`: DND or out-of-hours gives an inline warning row with "Call anyway"; then `window.location.href = "tel:..."` (or `window.open("https://wa.me/<digits>")`) and fire `useCallBack`. Disabled with tooltip when no phone. Shows "Called back by X, <relative time>" when present.
- [ ] `HubspotPushButton`: the four states from the spec; "In HubSpot" shows an external link from the mutation result or from `hubspotContactId` (build the URL client-side with the same format).
- [ ] `VoiceCallsPage.tsx` switches between `VoiceCallsInbox` and `CallersInbox` by view.

### Task F4: i18n

- [ ] Add under `callers.*` in all three `voiceCalls.json` files (identical key sets): `view.calls`, `view.callers`, `view.aria`, `callCount_one`, `callCount_other`, `lead`, `booked`, `callBack`, `whatsapp`, `callAnyway`, `warnDnd`, `warnOutOfHours`, `noNumber`, `calledBackBy` (with `{{name}}` and `{{when}}`), `hubspot.push`, `hubspot.pushing`, `hubspot.inHubspot`, `hubspot.update`, `hubspot.failed`, `hubspot.open`, `calls`, `empty`. Verify parse and key parity with a node one-liner.

### Task F5: Visual check

- [ ] playwright-cli as Owner: Callers view on Demo shows ~15 rows, masking works, a caller's calls open the existing detail, DND warning flow renders (if no DND lead exists, say so). Do NOT click Push to HubSpot. Screenshots in the scratchpad, close the browser.

---

## INTEGRATION (main session)

- [ ] Run all new tests (pytest E1, tsx S2 and existing voice tests).
- [ ] One controlled HubSpot push of a single demo lead as Owner, then a second push of the same lead to prove it updates (same contact id). Report the contact URL to Gabriel.
- [ ] Impersonate client account 53: `/callers?scope=demo` 403, call-back on a demo lead 404, hubspot 403.
- [ ] Commit, then ask Gabriel to push (pushing is blocked for the agent).
