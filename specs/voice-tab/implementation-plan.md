# Implementation Plan: Account Workspace "Voice" Tab

## Overview

Five phases: data model, server, engine, client, Robben adoption. Phases 1 to 3 can be verified without any UI (SQL, curl, a test call). Run no `tsc` unless asked. `db:push` needs a TTY, so migrations are direct `pg` scripts run with `node --env-file=.env`. `Voice_Numbers` and `Voice_Calls` are owned by the Python engine's migration scripts, so their migration lives in `/home/gabriel/automations/scripts/`.

## API contract (fixed so server and client can be built in parallel)

`GET /api/accounts/:id/voice` returns:

```json
{
  "accountId": 53,
  "number": { "id": 2, "phoneNumber": "+31...", "enabled": false, "status": "not_set|pending|live" },
  "persona": { "id": 71, "niche": "Robben Rosmalen", "companyName": "...", "description": "...", "usp": "...", "isLive": true },
  "agentName": "sophie", "agentNameCustom": null,
  "voice": "marin", "locale": "nl",
  "transferNumber": "+31...", "transferName": "Robben",
  "greeting": "...", "pronunciation": [{ "word": "", "sayAs": "" }],
  "afterHours": "message|callback|ringHot|null",
  "extraInstructions": "",
  "hours": { "start": "09:00", "end": "18:00", "timezone": "Europe/Amsterdam" },
  "kbCount": 9,
  "readiness": {
    "items": [{ "key": "number|persona|kb|voice|agent|transfer|hours", "ok": true }],
    "ready": false
  }
}
```

`number` and `persona` are `null` when absent (`status` is then `not_set`). Readiness is computed server-side: number ok when a row exists, persona ok when a live persona is linked, kb ok when `kbCount > 0`, voice ok when `voice` and `locale` are set, agent ok when `agentName` is set, transfer ok when `transferNumber` is set, hours ok when start and end are set. `extraInstructions` is never part of readiness.

`PUT /api/accounts/:id/voice` (agency only) takes any subset of: `numberId` (attach an unassigned row, or `null` to detach), `phoneNumber` (E.164, finds or creates a row and attaches it), `createPersona` (boolean), `agentName`, `agentNameCustom`, `voice`, `locale`, `transferNumber`, `transferName`, `greeting`, `pronunciation`, `afterHours`, `extraInstructions` (max 1000 chars). It returns the same shape as GET.

`GET /api/accounts/:id/voice-stats?month=YYYY-MM` returns `{ "month": "2026-10", "calls": 0, "bookings": 0, "transfers": 0, "transfersFailed": 0, "minutes": 0 }`.

`GET /api/voice-numbers/unassigned` (agency only) returns `[{ "id": 1, "phoneNumber": "+31...", "label": "...", "enabled": true }]`.

## Phase 1: Data model

### Tasks
- [ ] Engine migration script `migrate_voice_tab.py` (idempotent):
  - `Voice_Numbers`: add `persona_id` (int, nullable, FK to `Niche_Vocabulary.id`); index on `accounts_id`.
  - `Niche_Vocabulary`: add `accounts_id` (nullable) with a partial unique index where not null, and `is_live` (bool, default false).
  - `Voice_Calls`: add `transfer_outcome` (text, `none|transferred|failed`, default `none`); index on `(accounts_id, started_at)`.
- [ ] App side: declare `Voice_Numbers` and the missing `Voice_Calls` columns (`dialed_number`, `caller_number`, `voice_numbers_id`, `transfer_outcome`) in `shared/schema.ts`.
- [ ] Add `accountsId` and `isLive` to the `Niche_Vocabulary` Drizzle definition.

### Technical Details
- Schema is `p2mxx34fvbf3ll6`; every raw query is schema-qualified.
- Existing demo line (`Voice_Numbers` id 1, `client_niche="Lead Awaker"`, `accounts_id` null) is left untouched; `persona_id` null falls back to `client_niche`.
- `shared/schema.ts` stays under the repo's file-size habits: put the new table in its own block, not a rewrite.

### Verification
- Query the columns and indexes in a read-only transaction; confirm the demo line still resolves.

## Phase 2: Server

### Tasks
- [ ] `server/storage/voiceLines.ts`: `getVoiceLine(accountId)` (number row, persona, readiness inputs), `saveVoiceLine(accountId, patch)` (one transaction: profile `setup` + `agent_name`, `Voice_Numbers` mirrors, persona generation), `listUnassignedNumbers()`. Re-export through the `server/storage.ts` barrel.
- [ ] `server/storage/voiceStats.ts`: `getAccountVoiceStats(accountId, month)` per the dashboard definitions, with the last-turn fallback for minutes.
- [ ] `server/routes/voice-line.ts`, registered in `server/routes/index.ts`:
  - `GET /api/accounts/:id/voice` (requireAuth + account access)
  - `PUT /api/accounts/:id/voice` (requireAgency)
  - `GET /api/accounts/:id/voice-stats?month=YYYY-MM` (requireAuth + account access)
  - `GET /api/voice-numbers/unassigned` (requireAgency)
- [ ] Zod schema for the PUT body: enforce `extraInstructions` <= 1000 chars, E.164 for numbers. `setup` stays a loose record at the table level, so validate the voice keys here.
- [ ] Demos page API: live personas (`is_live`) are returned read-only; `PATCH/DELETE/duplicate` on a live persona returns 409.

### Technical Details
- Timestamps are set server-side with `new Date()`, never ISO strings from the client.
- Month boundaries use `Accounts.timezone`.
- Copy the access-check pattern from `getAccountBookingStats` and the communication-profile routes (`server/routes/accounts.ts:255-270`).
- Mirrors: `agent_name`, `voice`, `locale`, `transfer_number` on the `Voice_Numbers` row are written only here.

### Verification
- curl each endpoint as agency, as a client of the same account and as a client of another account (must be refused).
- Month stats against account 1 equal a manual `SELECT count(*)` for the same month.

## Phase 3: Engine

### Tasks
- [ ] Read `/home/gabriel/automations/CLAUDE.md` first.
- [ ] `tools/db/voice_numbers.py`: resolve persona by `persona_id`, fall back to `client_niche`.
- [ ] Add a resolver `load_account_voice_context(accounts_id)` returning profile `setup`, `Account_Knowledge_Base` rows and Account hours.
- [ ] `realtime_voice_routes.py` (client-line branch, around lines 275-350): add the KB rows as Q/A, apply greeting, pronunciation and after-hours, append extra instructions under "Business-specific notes".
- [ ] `phone_call.py` (around lines 333-363): set `Voice_Calls.transfer_outcome` on transfer success and failure.
- [ ] `scripts/voice_numbers.py`: warn when `set` touches a mirrored field on a line with a live persona.

### Technical Details
- Prompt wording additions are checked against the GPT-Live guide, lean, one prompt per language in that language, no "never" rules.
- Engine restarts: pm2 `leadawaker-engine`, port 8100.

### Verification
- Real test call to a Robben test line: KB question answered from an `Account_Knowledge_Base` row, greeting as configured, extra instructions reflected, a transfer sets `transfer_outcome`.
- Demo line (id 1) behavior unchanged.

## Phase 4: Client

### Tasks
- [ ] Register the tab: extend `WorkspaceTab` (`workspace/types.ts:6`), `ACCOUNT_TABS` (`AccountsWorkspace.tsx:24`), `TABS` and `TAB_ICONS` (`AccountsTopBar.tsx`), and the `TabContent` branch (`OverviewTab.tsx:56`). Mobile segmented control picks it up automatically.
- [ ] New folder `client/src/features/accounts/components/workspace/voice/` with small files: `VoiceTab.tsx`, `ReadinessChecklist.tsx`, `readiness.ts`, `NumberCard.tsx`, `PersonaCard.tsx`, `AgentVoiceCard.tsx`, `TransferCard.tsx`, `ExtraInstructionsCard.tsx`, `VoiceStatsRow.tsx`, `useVoiceLine.ts`, `useVoiceStats.ts`.
- [ ] Reuse `AvailabilityCard` (hours), `KBPanel` (KB), `StatCard` from `features/billing/components/workspace/atoms.tsx` (or the accounts copy), `SectionCard` from `components/crm/primitives`.
- [ ] Wizard write-through: voice and handoff step saves call `PUT /api/accounts/:id/voice`.
- [ ] i18n: `workspace.tabs.voice` in `locales/{en,nl,pt}/accounts.json`, plus a new `voiceTab.json` namespace in all three locales, imported in `client/src/i18n.ts`. PT is Brazilian.
- [ ] Demos page: render live personas read-only with a "managed in Account > Voice" link.
- [ ] Update `FILE_MAP.md` with the new folder.

### Technical Details
- Follow `UI_STANDARDS.md` and `UI_PATTERNS.md`; tokens only, no raw hex; `.la-page` shell rules; content-width cap on the outer flex child.
- Agency users get edit controls; client users get a read-only view of the same data.

### Verification
- playwright-cli on Account 53 (login in memory): checklist states, mobile width, dark mode, a save round trip. Close the browser afterwards.

## Phase 5: Robben (Account 53) adoption

### Tasks
- [ ] Adopt persona row 71: set `accounts_id=53`, `is_live=true`, strip the demo "switch euro to pounds" instruction from `kb_template` (live personas leave it empty), regenerate the live text fields.
- [ ] Do not create a `Voice_Numbers` row until a number exists (see action-required).
- [ ] Once Gabriel supplies a number and a transfer number, attach them through the tab and run the test call.

### Verification
- Tab shows number and transfer number as missing, all else green; dashboard shows zeros.
- After attaching: acceptance criteria in `requirements.md` pass.
