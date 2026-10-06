# Voice setup slots: wizard answers reach the phone prompt

Status: BUILT 2026-10-06 (engine code uncommitted, engine not yet restarted). Open items resolved with the recommended defaults.
Related: `specs/receptionist-onboarding/` (the wizard, built), `specs/voice-receptionist/` (the engine).
Engine code lives in `/home/gabriel/automations`, this spec lives here because the wizard is the source.

## Goal

A client fills in the receptionist wizard once. Their answers change how the phone receptionist behaves on their line, through a fixed set of slots in the shared prompt. One prompt per locale stays one prompt per locale: no forked prompt per client, no client text outside the slots.

## What the wizard actually stores (verified 2026-10-06)

The candidate list (greeting style, tone notes, urgent-call rules, hours, extra rules) maps onto real fields like this:

| Candidate | Where it really lives | Slot? |
|---|---|---|
| Greeting | `setup.voice.greeting`, free text | yes |
| Pronunciation | `setup.voice.pronunciation`, rows of `{word, sayAs}` | yes |
| Hours | Accounts columns `open_days`, `business_hours_start`, `business_hours_end`, `min_booking_notice_hours`, plus `timezone` | yes |
| After hours | `setup.voice.afterHours`: `message`, `callback`, `ringHot` | yes |
| Urgent-call rule | `setup.handoff.ringWhen`: `anytime`, `hours`, `never` | yes, reduced (see below) |
| Tone | profile columns `address_form` (je/u) and `perception` (up to 3 keys), NOT in `setup` | yes |
| Extra rules | does not exist anywhere | no (not in v1) |

Also read, replacing Voice_Numbers values when set: `setup.voice.locale`, `setup.voice.voice`, profile `agent_name_custom` / `agent_name`.

Nothing validates `setup` (no length limits, enums enforced only by UI chips, blank pronunciation rows are persisted). The engine must treat every field as untrusted.

## Decisions (from Gabriel, 2026-10-06)

1. Cover all four groups: greeting + pronunciation, hours + after-hours, tone, ringWhen.
2. Prompt slots only. Wiring `handoff.number` into `Voice_Numbers.transfer_number` stays in the later "set this up" phase.
3. Phone door only. The browser /voice-demo door is unchanged.
4. Setup and profile win over `Voice_Numbers` for locale, voice and agent name; `Voice_Numbers` is the fallback when the wizard is blank.

## Design

### Principles

- **No setup means byte-identical output.** Every slot has an empty or today's-text default, so a call with no account, no profile, or no `voice` service produces exactly today's prompt. This is the regression test.
- **Facts and rules go to the backend layer; only how she sounds goes to the voice layer.** (GPT-Live guide: short voice prompt, business rules with the backend.)
- **Slots are rendered by code, not by prompt conditionals.** `{{#if}}` does not exist in the voice path, and the resolver cannot nest. Each enum maps to a finished sentence per locale in a Python table (same pattern as `_DISCLOSURE_LINES`). Free text passes through sanitised.
- **Positive phrasing, no "never" rules.** Slot sentences say what to do.
- **No CRM changes.** The wizard already stores everything needed.

### Data flow

```
phone_incoming -> _start_call
  route.accounts_id  (Voice_Numbers, client lines only)
    -> load_client_setup(account_id)         one indexed read at call start
         Account_Communication_Profile (services, setup, address_form, perception, agent_name*)
         Accounts (open_days, business_hours_*, min_booking_notice_hours, timezone)
    -> ClientSetup | None                     None if no account, no profile, or "voice" not in services
  -> render_slots(setup, locale)              pure function, returns Slots
  -> build_live_session_config(..., slots=)   fills voice-layer placeholders
  -> build_backend_instructions(..., slots=)  appends the backend section
```

No cache: the next call after a wizard edit picks it up, no restart. `Voice_Numbers.accounts_id` is NULL on the only row today, so the live Lead Awaker line is untouched.

### New module `src/automations/voice/client_setup.py`

- `ClientSetup` dataclass: typed, already-clamped fields.
- `load_client_setup(account_id) -> ClientSetup | None`: the only DB code. Table is in schema `p2mxx34fvbf3ll6`; confirm qualification against how `tools/db/voice_numbers.py` does it.
- `render_slots(setup, locale) -> Slots`: pure. `Slots` has `tone`, `address`, `pronunciation`, `greeting`, `client_section`, each a string, empty when unset.
- Per-locale tables: perception key to adjective, address form to sentence, after-hours enum to sentence, ringWhen enum to sentence, weekday names (reuse `_DAY_NAMES`).
- Sanitising: strip `{`, `}` and control characters from free text, collapse newlines, trim, cap greeting at 200 chars, cap pronunciation at 12 rows and 40 chars per field, drop rows with a blank word or blank sayAs. Unknown enum or key: skip that slot and write one warning (structlog warning `voice.client_setup.fields_skipped`), never fail the call.

### Voice layer (`_VOICE_PROMPTS`, per locale)

Three new placeholders, replaced with `.replace` like `{agent}`:

| Placeholder | Renders | Default (unset) | Guideline served | Replaces |
|---|---|---|---|---|
| `{tone}` | "Sound warm, unhurried and professional." built from up to 3 perception adjectives, placed right after the existing personality line | empty | "personality in a few sentences" | nothing |
| `{address}` | nl: je/jij or u. pt-BR: você or o senhor / a senhora. Other locales: empty | today's hard-coded address line (nl: the existing "use je/jij" line, copied verbatim at build) | one explicit instruction per behaviour | the hard-coded nl line becomes the default of the slot |
| `{pronunciation}` | one line: `Say these words this way: Porsche as "Por-sjuh", ...` | empty | guide appendix "Language and pronunciation", inline respelling | nothing |

The greeting is not a prompt placeholder. `_GREETINGS[locale]` is the instruction sent at call start; when `setup.voice.greeting` is set it becomes: greet now in the call's language by saying the sentence in quotes, then stop and listen. The guide treats a greeting as an instruction, so the wording can drift slightly. Exact wording would need pre-rendered audio, which is out of scope. The wizard's help text already says to include "digital assistant", so the disclosure stays inside the client's own sentence; `_DISCLOSURE_LINES` logic is unchanged.

Net growth of the voice prompt: at most 3 short lines when a client fills them, zero otherwise. No new section, no new policy label.

### Backend layer (`build_backend_instructions`)

One appended block after the KB, before caller/today, titled `## This client's setup`, in the call's language, only when it has at least one line:

- **Opening hours:** "Opening hours: Monday to Friday, 08:00 to 17:30 (Europe/Amsterdam)." Built from the Accounts columns. Booking notice is left out: the booking tool already enforces it.
- **After hours** (`afterHours`): the backend already receives today's date and time in the caller's timezone, so it can judge. One sentence per enum:
  - `message`: outside opening hours, take name and reason, the team calls back.
  - `callback`: outside opening hours, offer a callback slot on the next opening day and book it like any appointment.
  - `ringHot`: as `message`, and when the caller is clearly ready to buy, say so at the top of the call summary.
- **Urgent calls** (`ringWhen`, reduced): live transfer is not wired, so a promise to ring the owner would be false. `ringWhen` therefore renders only a summary instruction: when the caller is a serious buyer, the first line of the call summary says so, so the owner sees it first. All three enum values produce that same line today; the enum is stored in `ClientSetup` so the transfer phase can use it without a schema change. Assumption, see Open items.

Prompt_Library rows 109/110/111 need no edit: they are filled by `_fill_persona` and the new block is appended in code, so the rows stay untouched (avoids the CRM autosave revert gotcha). Their "How you work" bullets already say answers come from the knowledge base and this conversation; the new block sits under its own heading and does not conflict with them.

The voice layer's delegation policy says to answer from business knowledge when possible. Hours are not in the voice layer, so "when are you open?" delegates to the backend. This costs one backend hop. Add a one-line hours fact to the voice layer only if test calls show the delay is noticeable (guide: add controls when testing shows a need).

### Precedence

| Setting | Order |
|---|---|
| locale | `setup.voice.locale` (nl, en-GB, en-US, pt-BR) then `Voice_Numbers.locale` then default |
| voice | `setup.voice.voice` (marin, gleam, willow, bossa) then `Voice_Numbers.voice` then the locale's default |
| agent name | `agent_name_custom`, then `Voice_Numbers.agent_name`, then default Sara. The profile's `agent_name` (thomas, mark, sophie, lisa) is the chat persona and is NOT used for voice, see Open items. |

### Failure behaviour

- Any DB error in `load_client_setup`: log, return None, the call proceeds with today's prompt. A call is never refused for a setup problem.
- A slot that fails sanitising is skipped alone; the rest still render.

## Out of scope

- Transfer wiring, owner alerts, recap (later "set this up" phase).
- Browser /voice-demo door and demo lines.
- Free-text "extra rules" field.
- Hours inside the voice layer (see above).
- Greeting as pre-rendered audio.
- pt-PT (the wizard offers pt-BR only).

## Lean-prompt checklist (feedback_voice_prompt_lean_openai_check)

- Each slot line is listed above with the guideline it serves and what it replaces.
- No "never" wording in any rendered sentence.
- One prompt per locale, slot sentences written in that locale.
- Slot sentences added one group at a time, with the same test calls re-run after each (see testing), per [[feedback-never-tune-prompts-against-one-sample]]: a single call proves nothing.
- Untested territory per the guide: formal vs informal address and brand-name respelling. Both need real test calls before we call them working.

## Testing

Automated (`tests/voice/test_client_setup.py`, extend `test_live_session_config.py`):
- No setup gives output identical to today for all five locales (regression).
- Each renderer, each locale, every enum value.
- Malformed input: wrong types, unknown enum, braces and newlines in free text, 500-char greeting, 100 pronunciation rows, blank rows, null parts.
- Voice-layer prompt contains no leftover `{placeholder}`.
- `load_client_setup` returns None without `voice` in services.

Live (Gabriel on a scratch `Voice_Numbers` row pointing at Robben's account, or a test account):
- Greeting: three calls, check the sentence is said close to as written.
- Pronunciation: one brand word, checked by ear.
- Hours: call inside and outside hours, check after-hours behaviour per each of the three enum values.
- Address: nl `je` vs `u`.

## Open items for review

1. **ringWhen is reduced.** Because transfer is deferred, it only flags serious buyers in the call summary. I assumed `update_call_summary` can carry that line; confirm against the tool schema at build. If you would rather skip ringWhen until transfer exists, drop that one bullet.
2. **Agent name.** The profile's `agent_name` is a chat persona (thomas, mark, sophie, lisa), which can clash with the feminine voices. The default above ignores it for voice and only honours `agent_name_custom`. Say if you want it used.
3. **No status gate.** The slots read the profile whatever its `status` (draft, in_progress, completed) as long as `voice` is a ticked service. Empty slots are harmless, but a half-typed greeting could go live. Alternative: require `status = completed`.
4. **`shared/schema.ts:303`** says the engine does not read `setup`. Update that comment when this ships.

## Built (2026-10-06)

- `src/automations/voice/client_setup.py` (parse, clamp, `load_client_setup`), `client_setup_slots.py` (renderers), `tools/db/client_setup.py` (one joined read), `Table.ACCOUNT_COMMUNICATION_PROFILE`.
- `live_session_config.py`: placeholders `{tone}`, `{pronunciation}`, `{address}`, `{you}` in en-GB, en-US, nl, pt-BR (pt-PT untouched); `slots=` on `build_live_session_config`, `build_backend_instructions`, `greeting_instruction`.
- `phone_voice_routes.py`: loads the setup for client lines, applies locale, voice and `agent_name_custom` precedence, passes the account timezone so the backend's "now" and the opening hours share a zone.
- Tests: `tests/voice/test_client_setup.py` (31). A no-setup call renders byte-identical prompts and greetings (checked against a pre-change snapshot).
- Decisions on the open items: ringWhen stays reduced to the summary flag (the summary is a list, so "first item" works); profile `agent_name` ignored for voice; no status gate.
- Greeting: when the client's sentence already says digital/assistant, the engine's own "mention you are the digital assistant" sentence is dropped so it is not said twice.
