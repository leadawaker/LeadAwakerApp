# Voice calls: Live / Demo split

Status: DESIGN, awaiting Gabriel's review. Date: 2026-10-06.
Companion spec (not part of this build): `specs/voice-calls-callers-tab/requirements.md`.

## Goal

`/platform/voice-calls` becomes a page every client can use for their own voice agent, with a
Demo tab only Gabriel (role Owner) can see. The Demo tab must look good enough to screenshare
to prospects.

## Access model (the rule that shapes everything)

| Who | Sees | Never sees |
|---|---|---|
| Client user (account != 1) | Live calls of their own account only. No tab bar, no stats about other accounts. | Any demo call, any other account's call |
| Agency Admin (account 1, not Owner) | Live calls across accounts (same as other pages, `?accountId=` to narrow) | Demo |
| Owner (Gabriel) | `Live` and `Demo` tabs. Live across accounts with an account filter. | n/a |

- **Enforced on the server**, never only by hiding UI. `scope=demo` returns 403 for non-Owners.
  Live queries always add `is_demo = false`, even for a user whose account would not match anyway.
- Client impersonation (`session.impersonation`) is respected: an impersonating Owner sees exactly
  what that client sees, with no Demo tab.
- Non-Owners get no tab bar at all. The page is simply "your calls".
- **Nav entry:** Owner always. Other users only when their account has an enabled `Voice_Numbers`
  row. Otherwise the entry is hidden and `/platform/voice-calls` redirects to campaigns.
  Backed by a tiny `GET /api/voice-calls/capabilities` returning `{ live: boolean, demo: boolean }`.
- **Recording audio** is the leak risk. Today the browser fetches the WAV straight from the
  engine's unauthenticated `/voice/live/recording/{session_id}`. Clients must not hit that. New
  Express route `GET /api/voice-calls/:callId/recording` checks the same access rule, then proxies
  the engine call using the internal key. The engine route then requires `x-internal-key`.
  `useCallAudio.ts` switches to the Express route.

## Classification: Demo vs Live

Computed in SQL (no stored flag, so nothing to backfill or keep in sync). A call is **Demo** when
any of these holds, otherwise **Live**:

1. its campaign has `is_demo = true` (campaign 60), or
2. its lead has a demo marker (`demo_niche` not null, or `channel_identifier` starting `wa-demo:` / `web-demo:`), or
3. its `Voice_Numbers` line has `client_niche IS NULL` (the agency demo line), or it has no line
   and no client-owned campaign (browser `/voice-demo`).

Today all 75 calls are Demo and Live is empty until the first client voice line exists.

## Data changes

### `Voice_Calls` new columns (engine writes them going forward)

| Column | Type | Written by |
|---|---|---|
| `persona_company` | text null | Engine, when the call opens |
| `persona_niche` | text null | Engine, when the call opens |
| `outcome` | text null, one of `booked, callback, transferred, hung_up, other` | Engine, when the call ends |

- **Persona source:** the engine resolves it server-side when the session is created
  (`/voice/live/session` for the browser demo, `_start_call` for the phone door) and keeps it
  keyed by `session_id` until `record_call_open` links the row. The persona is never taken from
  a browser-supplied field, because `/voice/relay` is unauthenticated. The plan must verify where
  the session-to-call link happens and pick the exact hand-off.
- **Outcome source:** set in the shared recap path (`voice/call_recap.py`) and in the sweep that
  closes abandoned calls. Rules: `booked_slot` present gives `booked`; phone door performed the
  transfer gives `transferred`; `callback_now` intent gives `callback`; closed by the sweep or
  shorter than 10s with no summary gives `hung_up`; anything else `other`.
- **Precedence** when several apply: `transferred`, `booked`, `callback`, `hung_up`, `other`.

### Old calls (no backfill)

The API derives missing values: persona falls back to the localized "Universal demo", outcome is
derived with the same rules from `booked_slot`, intents and duration. Transfer cannot be derived
for old rows, so they never show `transferred`.

### Drizzle catch-up

`shared/schema.ts` lacks `dialed_number`, `caller_number`, `voice_numbers_id` that already exist
in the live table (added by `migrate_add_voice_numbers.py`). Declare them. New columns go through
a direct `pg` script (db:push needs a TTY), idempotent `ADD COLUMN IF NOT EXISTS`.

## API contract (shared by all build lanes)

`GET /api/voice-calls?scope=live|demo&limit&offset&accountId`
- `scope` defaults to `live`. `demo` requires Owner. `accountId` is honored for agency users only.
- Each item adds to the existing `VoiceCallListItem`:
  - `scope: "live" | "demo"`
  - `personaCompany: string | null`, `personaNiche: string | null` (null for Live)
  - `outcome` is now the enum `"booked" | "callback" | "transferred" | "hung_up" | "other"`
  - `conclusion: string | null` (the old free-text `summary.outcome`, renamed so the enum can take `outcome`)
  - `accountId: number`, `accountName: string | null` (only populated for agency users)

`GET /api/voice-calls/:callId`: same item plus `summary` and `turns`. Returns 404 (not 403) when
the call is outside the caller's access, so existence does not leak.

`GET /api/voice-calls/stats?scope=live|demo&accountId`
- Rolling last 7 days. Returns `{ calls, bookedRate, avgDurationSeconds }`.
- `bookedRate` = calls with a booked slot / `calls` (0 when no calls). Uses `booked_slot`, the ground truth, so a transferred call that also booked still counts.
- `avgDurationSeconds` ignores calls under 10s. Null when none qualify.
- Computed in SQL so the 200-row list cap does not matter.

`GET /api/voice-calls/:callId/recording`: audio/wav, same access rule.

`GET /api/voice-calls/capabilities`: `{ live, demo }` as above.

## UI

Standards: UI_STANDARDS.md and UI_PATTERNS.md, tokens only, dark mode, `la-seg` tab pattern as in
`features/demos/pages/DemosPage.tsx:39-55`, files under 500 lines.

### Topbar
- Owner only: `Live | Demo` `la-seg` control after the page title. Last choice remembered in
  localStorage (wrapped in try/catch). Default is `Demo` for Owner, since that is what is being shown.
- The old `All / Booked / Not booked` buttons move into the Filter menu as an Outcome group
  (booked, callback, transferred, hung up, other). Search, sort and group stay.
- Owner only: a `Presenting` eye toggle at the far right (see below).
- Owner on Live: an account filter chip (all accounts by default).

### Stats strip (both tabs, three cards)
- Same component, different labels: Demo shows "Demos this week", Live shows "Calls this week".
  Then "Booked rate" and "Average call length".
- Neumorphic stat cards in the style of the app's existing KPI cards (check
  `BookedCallsKpi.tsx` for the pattern before building). Single row, stacks under 640px.
- Shown above the two panes. While loading, skeletons. No data: "0" and an en dash, not blanks.

### List row
- **Demo row:** avatar tinted by outcome (existing `status.ts` palette), title = persona company,
  a small niche chip, second line "caller, m:ss" and time. Outcome pill on the right; booked rows
  show the slot ("Thu 14:30") inside the pill.
- **Live row:** as today (caller name or number as title, one-line conclusion), plus the outcome pill.
- Outcome pills use the shared `Pill` primitive (`components/crm/primitives/Pill.tsx`) and the
  status palette, not new colours. The local `BookedPill` is replaced by it.

### Detail pane
Layout unchanged (raised header card, conversation with player, 290px recap). Header chip row adds
persona and outcome on Demo calls. Recap keeps the mini calendar for booked calls.

### Empty states
- Live, no client line yet: "Calls on your voice line appear here." with a one-line hint.
- Demo, no calls: the existing demo empty state.

### Presenting mode (Owner only)
- Default **on** for Owner (masked). The eye toggle reveals; the choice is kept in localStorage.
- Masks in list, detail header, recap and stats-adjacent text: numbers become `+31 6 ••• ••• 47`,
  names become first name plus initial. One helper (`maskIdentity.ts`), applied at the render edge.
- Applies on both tabs for the Owner (a screenshare of a client's Live calls is just as sensitive).
- **Not masked:** transcript text and recording audio, since callers may say their name aloud.
  Known limitation, stated in the UI as a one-line tooltip on the toggle. Clients viewing their
  own account see their own callers unmasked, with no toggle.

## i18n

New keys in `client/src/locales/{en,nl,pt}/voiceCalls.json` (Brazilian PT): tabs, stat labels,
outcome labels, presenting tooltip, empty states, "Universal demo". `sidebar.voiceCalls` already
exists. No hardcoded strings.

## Build lanes (parallel, after plan approval)

| Lane | Files | Depends on |
|---|---|---|
| A. Engine (Python, `/home/gabriel/automations`) | migration script, persona stamp, outcome stamp, transfer flag, recording route key | none |
| B. Server | `shared/schema.ts`, `server/storage/voiceCalls.ts`, `server/routes/voice-calls.ts`, recording proxy, capabilities | API contract above |
| C. Frontend | `features/voiceCalls/*`, `app.tsx` guard, `RightSidebar.tsx` gating | API contract above |
| D. i18n | three `voiceCalls.json` files | key list from C |

Lanes B and C code against the contract above so they do not wait on each other. Verification:
`pm2 logs`, then a playwright-cli pass as Owner (both tabs, masking on/off) and as a client user
(no tab bar, no demo rows, `?scope=demo` returns 403, recording of another account's call returns 404).
Close all browsers afterwards. No tsc unless Gabriel asks.

## Out of scope

- The Callers tab (separate spec). The `scope` tab control leaves room for a third segment.
- Backfilling personas for the 75 existing calls.
- Redacting transcript or audio.
- HubSpot, call-back actions, task creation from a call.

## Design-for-Callers notes

`leads_id`, `caller_number`, `outcome`, persona and `account_id` are all on the list item so the
Callers tab can group by caller without another contract change.
