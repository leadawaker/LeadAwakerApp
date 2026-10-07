# Requirements: Account Workspace "Voice" Tab

## What & Why

A live voice-receptionist client is spread over three stores that are not linked by a real key:

| Store | Holds | Edited via |
|-------|-------|-----------|
| Accounts (+ `Account_Communication_Profile`, `Account_Knowledge_Base`) | profile, `setup` jsonb, KB, hours | CRM Account workspace / wizard |
| `Niche_Vocabulary` "Client persona" row | company text, description, USP | Demos page |
| `Voice_Numbers` | number, agent name, voice, transfer number | `scripts/voice_numbers.py` only |

`Voice_Numbers` points at the Account by `accounts_id` but at the persona by the *text* value `client_niche`. A persona row has no account column. Nothing tells you when a piece is missing, and some pieces never reach a call: Robben Rosmalen (Account 53) has 9 KB entries the phone never reads, and no number, no transfer number and no mobile number.

The Voice tab becomes the **single home for a live client**: one place to see "is this client ready to take calls?", fix what is missing, and watch how the line performs. Robben Rosmalen (Account 53, used cars, Sophie) is the first client to fit.

## Decisions (agreed with Gabriel, 2026-10-06)

1. **Account-owned data.** The tab is the only writer of a live client's voice config. `Voice_Numbers` gets real keys to the account and persona.
2. **The tab owns a live persona.** One live persona row per account, linked by id. The Demos page lists live personas read-only so a demo edit cannot change a live client.
3. **Assign existing numbers only.** Ordering numbers (Telnyx paperwork) stays manual and out of scope.
4. **Extra instructions field.** An optional free-text box per client, appended to the prompt under a fixed heading. Everything else about the prompt (the template) stays in Prompt_Library and engine code and is NOT editable from the tab or wizard.
5. **Hours stay on the Account** (`business_hours_*`, `timezone`). No second voice-hours field.
6. **Bookings tile (v1)** counts calls with `booked_iso` set. A proper link to a booking record is a v2 improvement.

## What

### Source of truth per field

| Field | Stored in | Engine reads |
|-------|-----------|--------------|
| Number | `Voice_Numbers.phone_number` (+ `accounts_id`) | yes (existing) |
| Linked persona | `Niche_Vocabulary` live row (`accounts_id`, `is_live`); id in `Voice_Numbers.persona_id` | yes, by id, fallback `client_niche` |
| KB | `Account_Knowledge_Base` | **new**: read live for client lines |
| Voice | `setup.voice.voice`, mirrored to `Voice_Numbers.voice` | yes (mirror) |
| Locale | `setup.voice.locale`, mirrored to `Voice_Numbers.locale` | yes (mirror) |
| Agent name | `Account_Communication_Profile.agent_name`, mirrored to `Voice_Numbers.agent_name` | yes (mirror) |
| Transfer number | `setup.handoff.number`, mirrored to `Voice_Numbers.transfer_number` | yes (mirror) |
| Hours | `Accounts.business_hours_start/end`, `timezone` | **new** |
| Greeting, pronunciation, after-hours | `setup.voice.*` | **new** |
| Extra instructions | `setup.voice.extraInstructions` (<= 1000 chars) | **new** |

Mirrors are written in one server transaction by the tab's save. The tab is the only writer, so they cannot drift. `scripts/voice_numbers.py set` stays for ops but warns when it touches a mirrored field on a live line.

### Setup section

- **Readiness checklist** at the top: one row each for number, persona, KB, voice, agent name, transfer number, hours. Each is green or "missing, fix". Extra instructions is shown as optional and never blocks readiness.
- Below it, section cards to edit each item. Existing components are reused where they exist (`AvailabilityCard` for hours, `KBPanel` for KB, the wizard's voice/locale constants).
- **Number card:** pick an unassigned `Voice_Numbers` row or enter an E.164 number, and attach it to the account. Status chip derived from the row: no row = not set, `enabled=false` = pending review, `enabled=true` = live.
- **Persona card:** shows the linked live persona. "Create live persona" builds it from the account; the persona text fields are generated from account data (see below), not hand-edited.
- **Extra instructions card:** plain textarea, character counter, agency-only edit in v1.

### Try her out (added 2026-10-07, BUILT)

Agency-only card under the dashboard (`TestCard.tsx`):

- **Test in browser** opens `/voice-demo?account=<id>&company=…&locale=…&start=1` in a new tab. The engine's browser door (`/voice/live/session`, field `account`, staff only via the CRM-minted admin pass) answers exactly as the account's line: its `Voice_Numbers` row (real number first), else its live persona, so a client can be tried before a number is attached. Test calls file under the demo account (1), not the client's stats.
- **What she is told**: the greeting instruction, the voice layer and the backend prompt, rendered by the engine's `/voice/prompt-preview` with `account_id` and no text (the saved prompts), via `POST /api/voice-prompts/preview` with `accountId`. Same builder as a call, so it cannot drift. It shows the phone version (transfer section included when a transfer number is set).

### Persona generation

For a live persona the tab sets `company_name_template`, `description_template` (from `Accounts.business_description`), `usp` (from the profile differentiator), `service_name` and `niche_label` (from `business_niche`) in the account's voice locale slot with an `en` fallback. `kb_template` is left empty for live personas because the engine reads `Account_Knowledge_Base` directly.

### Dashboard section

Four stat tiles with a month selector (month boundaries in the account's timezone, `Europe/Amsterdam` for Robben):

- **Calls:** count of `Voice_Calls` rows for the account in the month.
- **Bookings:** calls with `booked_iso` set.
- **Transfers:** calls with `transfer_outcome = 'transferred'` (failed transfers are counted separately in a tooltip).
- **Minutes:** sum of `ended_at - started_at`, falling back to the last transcript turn when `ended_at` is null, shown in whole minutes.

Empty state: zeros with a "no calls yet" line, not an error (Robben starts here).

### Wizard feed

The onboarding wizard stays the first-time flow. Each step save writes through the same endpoint, so what the wizard collects (`setup.handoff`, `setup.voice`, agent name) immediately shows up in the tab. After onboarding, the tab is the place to edit.

### Engine changes (Python service, `/home/gabriel/automations`)

- Pick the persona by `Voice_Numbers.persona_id`, falling back to `client_niche`.
- For client lines, load profile `setup`, `Account_Knowledge_Base` and Account hours, and apply greeting, pronunciation, after-hours behavior and extra instructions.
- Append extra instructions under a fixed heading ("Business-specific notes") after the core prompt, so they add business facts but cannot override core behavior.
- Write `transfer_outcome` on `Voice_Calls` when a transfer is attempted.
- Any new prompt wording is checked against the GPT-Live guide and kept lean (no "never" rules).

## Acceptance criteria

- Robben's Voice tab shows a readiness checklist with number and transfer number "missing" and everything else green.
- Assigning a number and transfer number to Account 53 and saving results in a `Voice_Numbers` row with `accounts_id=53` and `persona_id` set, and a test call to that number is answered as Sophie for Robben.
- A KB entry added on Account 53 is used by Sophie on the next call (the 9 existing entries reach the call).
- An after-hours call follows `setup.voice.afterHours`; greeting and pronunciation from the wizard are audibly applied.
- Text in extra instructions is reflected in the call; the 1000 character cap is enforced server-side.
- Editing a live persona from the Demos page is not possible (read-only there).
- Dashboard tiles match a manual count from `Voice_Calls` for a month with known calls (account 1 can be used as the fixture).
- A transfer on a live call sets `transfer_outcome` and the Transfers tile increments.
- Client users can view the tab; only agency users can save. Another account's data is never returned.
- Mobile: the tab appears in the segmented control and the layout works at phone width.
- All strings go through i18n in `en`, `nl` and `pt` (Brazilian).
- `scripts/voice_numbers.py` still works and warns on mirrored fields of live lines.

## Out of scope

- Ordering or provisioning numbers from the tab (Telnyx paperwork stays manual).
- A forwarding test-call checker.
- Hourly stock sync from `setup.stock.feedUrl`.
- Owner WhatsApp alerts, the "took over" pause and the daily recap.
- Client self-serve onboarding and client editing of extra instructions.
- A proper booking link for the Bookings tile (v2).
- Editing the prompt template itself.

## Open questions

- Which existing record would a booking link point to (billable bookings table vs calendar booking)? Decide before v2.
- Should clients be allowed to edit extra instructions later? Default is no.
- Persona text is generated for one locale slot plus `en`. If a client needs several voice languages, revisit.

## Dependencies / related

- `specs/receptionist-onboarding/` (the wizard and `setup` jsonb this tab reads and writes)
- `specs/voice-receptionist/` (Tier-3 phone door, `phone_voice_routes.py::_start_call`)
- `specs/voice-calls/` (the owner-only demo calls page; this tab adds an account-scoped view)
- `GET /api/accounts/:id/booking-stats` (`server/routes/billing.ts`) is the pattern for `voice-stats`
