# Voice call review and prompt coach (Robben)

Date: 2026-10-25
Status: approved to build end to end (Gabriel, 2026-10-25). Calls marked "my call" were made by Claude
while Gabriel was away and are listed for his review.

## Decisions after the builder check (all my calls)

1. **The prompt is shared.** `eleven_layer_nl` / `eleven_layer_en` belong to account 52 and every
   ElevenLabs line reads them. Today only Robben's test line runs on ElevenLabs, so reviews and cards are
   per account (they come from that account's calls), while the draft and Save write the shared rows. The
   UI says plainly that the prompt is shared by all ElevenLabs lines. Per-account prompt rows are a later
   project, when a second ElevenLabs client arrives.
2. **Existing edit paths.** The Voice tab's eleven prompt card stops autosaving to live and edits the
   draft instead. The Prompt Library page keeps its editor (out of scope), so live can still change there:
   the draft records the live text it started from and warns when live has moved on since, and cards whose
   "find" text is gone become stale.
3. **Faking in test calls applies to draft tests only.** The existing browser test (on live) keeps
   behaving like a real phone call. A new "Test draft" mode runs the draft prompt and fakes every write
   (bookings, caller/lead writes, messages, transfers) with a realistic success response. Lookups stay real
   (free slots, caller memory, car search, plate lookup) so returning-caller tests still work.
4. **What the review counts.** All phone calls for the account in the period. Browser tests (live or
   draft) are excluded. There is no separate "test vs real" split: today every ElevenLabs call is on the
   test line, so it would say nothing.
5. **Run now** stores its own review row (kind `manual`). The scheduler creates at most one `weekly` row
   per account per week.

6. **Engine changes are not committed.** In `~/automations` all ElevenLabs code is untracked and the
   checkout has ~267 uncommitted changes (the live engine runs that working tree). Committing only our
   edits is impossible without committing Gabriel's WIP, so engine edits are made in place, covered by
   pytest, backed up first, and applied with a checked `pm2 restart leadawaker-engine`.
7. **Recording the prompt version per call is deferred** (engine schema work on the live call path, not
   needed for v1). The review compares with last week instead.

Correction to "What exists today": test calls do NOT use the editor's unsaved template. The `template`
override in `eleven_prompt.build` is only used by the prompt preview; browser tests always run the saved
live row, and `BrowserElevenCall.tool` only fakes `transfer_to_human`. Sending the draft into a test call
and faking writes are new work in the CRM relay and the engine.

## Why

Improving the Robben voice receptionist is a manual loop today: Gabriel asks Claude Code to run the
`voice-call-analyst` skill on recent calls, then `voice-prompt-repair` to fix the prompt. That works but
depends on Gabriel remembering to do it, and the ElevenLabs dashboard (and its new "Architect"
assistant) is no help, because our prompt is not stored on the ElevenLabs agent.

This brings the loop into the CRM: a weekly review that is stored, proposed prompt changes Gabriel
accepts or rejects one by one, an assistant to talk changes through, a browser test of the draft, and a
manual save to live with rollback.

## Goals

- A weekly review of last week's Robben calls, stored so past weeks can be reread. Also a "Run now" button.
- The report is short and to the point: numbers, the problems that matter, links to the calls that show them.
- Proposed prompt changes as individual cards: exact before/after text, why, which calls show the problem.
  Accept or Reject each one.
- A chat assistant beside the prompt editor that knows the current prompt, the latest report and the calls.
  It explains, brainstorms and proposes. It never edits the prompt itself: its proposals become cards.
- Both the weekly review and the assistant follow one written rules document on how a good ElevenLabs
  real-time prompt is built.
- Accepted changes go into a draft. Gabriel tests the draft in the browser, then saves it to live.
- Every save to live snapshots the previous prompt so it can be restored.

## Non-goals

- Other accounts. Robben (account 53) only for now, but take the account id as a parameter rather
  than hardcoding 53 everywhere.
- Changes to the ElevenLabs agent itself (tool descriptions, turn settings, model: `scripts/eleven_setup.py`).
- GPT Live (`live_...`) calls.
- Using ElevenLabs Architect.

## Anti-goals (a failure even if it works)

- Anything reaching live calls without Gabriel pressing Save. No automatic upgrades.
- A browser test call booking a real appointment, writing to the real CRM, or sending messages.
- Long reports. If Gabriel has to scroll through a wall of text it has failed.
- Suggestions that pile up louder rules instead of surgical fixes (the repair skill's rule: remove the
  conflicting line rather than add a louder one).

## What exists today (facts from the codebase)

- **The prompt lives in our DB.** The engine builds the ElevenLabs prompt per call
  (`~/automations/src/automations/voice/eleven_prompt.py`) from the `Prompt_Library` rows
  `eleven_layer_nl` / `eleven_layer_en` (Portuguese uses `en`), with a 30 s cache. Saving that row is
  what makes a change live. Template marks: `{name}` / `{?flag}` (`eleven_template.py`).
- **Versions:** `Prompt_Versions` (`shared/schema.ts` ~1239). `server/storage/voiceAccountPrompts.ts`
  snapshots during autosave at most once per 15 minutes per prompt.
- **Knowledge base:** `Account_Knowledge_Base` (not in Drizzle), `/api/accounts/:id/knowledge`, injected per call.
- **Calls:** `Voice_Calls` (outcome, end_reason, cost, `latency_ms`, `latency_p90_ms`, `turn_metrics`,
  `summary`, `is_test`), transcript turns in `Interactions` (`type='voice_call'`,
  `conversation_thread_id = call_id`), tool calls in `Voice_Call_Events`. Audio stays at ElevenLabs,
  proxied by `GET /api/voice-calls/:callId/recording`. Per-call review: `GET /api/voice-calls/:callId/review`.
- **The prompt used on each call is not stored in our DB** (only fetchable from ElevenLabs).
- **UI:** account Voice tab, "Prompt & test" section (`client/src/features/accounts/components/workspace/voice/`,
  `PromptSection.tsx`, `VoiceTestPanel`), with `server/routes/voiceElevenTest.ts`. The engine already
  prefers the editor's unsaved template over the saved row for test calls.
- **AI:** `claudeJson({ system, user, model, jsonSchema })` in `server/aiTextHelper.ts` (Claude CLI on
  the subscription, with Groq/OpenAI fallback).
- **Existing analysis knowledge:** `~/.claude/skills/voice-call-analyst/SKILL.md` (cause classes, stage
  audit, latency baseline), `~/.claude/skills/voice-prompt-repair/SKILL.md` and `code-map.md`
  (surgical fixes, "Als X, dan Y", one behaviour per sentence, mirror NL and EN, no em dashes).
  Note: those skills predate the `eleven_layer` rows and still describe editing `eleven_prompt_copy.py`.
  `~/automations/tools/voice_call_digest.py` is a read-only digest worth reusing.

## The design

### 1. Prompt rules document

One file, e.g. `server/voice/elevenPromptRules.md`, loaded into both the weekly review and the assistant.
Built from the two skills above plus ElevenLabs' own prompting guide (structure of sections, short spoken
sentences, writing numbers, dates and times for speech, guardrails, when and how to call tools,
handling silence and interruptions). Gabriel can read and edit it. Keeping it as a file in the repo is my
call: it changes rarely and benefits from review in git.

### 2. Weekly review

- Runs every Monday at 07:00 Europe/Amsterdam for the previous Monday to Sunday, plus a "Run now"
  button (agency only) that reviews the last 7 days. One review per account per week, so a missed or
  repeated run cannot duplicate it.
- Input: the account's ElevenLabs calls in the period with transcripts, metrics and tool events, the live
  prompt (NL and EN), the knowledge base, the rules document, and last week's review for comparison.
- Browser test calls (live or draft) are excluded. All phone calls for the account count (decision 4).
- Output, stored in a new table (e.g. `Voice_Reviews`): period, counts by outcome and end reason, latency
  avg/p90, cost, the top problems (each one line, with the call ids that show it), the worst calls, and
  a one-line comparison with last week. Plus the proposed changes (section 3).
- Model: opus for the weekly synthesis. If a week has too many calls for one call, the builder may do a
  per-call pass first (sonnet) and synthesise after.
- The report is written in English, quoting callers in their own language (my call).

### 3. Change cards

- New table (e.g. `Voice_Prompt_Suggestions`): account, source (`weekly` review id, or `chat`), target
  prompt row, the exact text to find and its replacement (surgical, not a whole-prompt rewrite), the
  matching edit in the other language when the rule exists in both, reason, evidence call ids,
  status `proposed / accepted / rejected / stale / live`.
- Accept applies the edit to the draft (section 4). Reject keeps it on record so the review does not
  propose the same thing again next week without new evidence.
- A card whose "find" text is no longer in the draft becomes `stale` and cannot be accepted.
- In v1 cards target the prompt only. Knowledge base problems are named in the report as plain
  recommendations (my call, to keep v1 small).

### 4. Draft, save to live, rollback

- Accepted cards and Gabriel's own edits collect in a draft that live calls never read. Autosave in the
  Voice tab currently writes the live row (`saveVoicePromptText`), so the eleven card switches to a
  separate draft store (new table, one draft per prompt row, holding the draft text and the live text it
  started from).
- The draft shows a diff against live.
- "Save to live" writes the draft to the `Prompt_Library` row and always snapshots the previous text in
  `Prompt_Versions` (not subject to the 15 minute limit), labelled with the date and the accepted cards.
  Accepted cards become `live`.
- Rollback: a version list with "Restore", which loads that version into the draft. It goes live only
  through the same Save.
- To compare before and after, each call should record which prompt version it ran on (engine side,
  e.g. a version id or hash on `Voice_Calls`). The weekly report uses it to say "calls on the new prompt".

### 5. Browser test of the draft

- A "Test draft" button in the existing `VoiceTestPanel` starts a browser call that runs the draft prompt
  (new: the CRM relay passes a draft flag, the engine builds the prompt from the draft row).
- In draft tests every write is faked: bookings, caller/lead writes, messages and transfers return a
  realistic success response without touching the calendar, CRM or anyone's phone. Lookups stay real
  (decision 3). The transcript shows which tools were called and with what.
- The existing live browser test is unchanged.
- Browser tests never appear in the weekly review.

### 6. Prompt coach (chat)

- A chat panel next to the prompt editor in the Voice tab. Agency only.
- Each turn it sees: the draft and live prompt, the latest review, the rules document, and the transcripts
  of calls Gabriel mentions or the review cites. It can answer "why did it say that on Tuesday's call?",
  "what else would you improve?", "make this softer".
- Its replies may include proposals, which become cards (source `chat`) shown inline. It never writes to
  the draft directly.
- Chat history is stored per account so a conversation can be picked up later.

## Where things go

- UI: the account Voice tab, around "Prompt & test": weekly reviews list and report, cards, draft diff,
  Save, versions, coach panel. Mobile-first per the `leadawaker-dev` skill.
- Server: new routes and storage in `server/routes/` and `server/storage/`, prompts in `server/voice/`.
  Keep files under 500 lines.
- Schedule: the CRM server (where `claudeJson`, the DB and the UI are), an hourly `setInterval` that
  runs the review if this week's is missing after Monday 07:00 (my call).
- Engine (`~/automations`): only the faked tools for test calls and recording the prompt version per call.
- New tables via an additive, idempotent script, like `script/create-social-studio-tables.mjs`.

## Left to the builder

- Exact table and column names, JSON schemas for `claudeJson`, the report layout.
- How much transcript to send per call and how to batch a large week.
- How the coach loads call transcripts (ids in the message, or a lookup step).
- Whether the skills `voice-call-analyst` and `voice-prompt-repair` are updated to point at the new
  rules document (recommended, so there is one source).
