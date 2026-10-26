# Voice Call Review and Prompt Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stored weekly review of an account's ElevenLabs phone calls with surgical prompt change cards, a draft of the shared ElevenLabs prompt that cards and edits go into, a browser test of that draft with faked writes, a manual Save to live with rollback, and a chat coach beside the editor.

**Architecture:** CRM (Express + Drizzle) owns four new tables, the review runner (Claude opus via `claudeJson`), an hourly in-process scheduler, the coach (Claude sonnet) and the UI in the Voice tab's "Prompt & test" section. Every decision that can be pure (week window, stats, find/replace rules, draft plans, prompt building and answer parsing) lives in small tested modules under `server/voice/`; storage and routes are thin. The Python engine (`~/automations`, edited in place, never committed) gains a `draft` flag on browser test sessions: it builds the prompt from the draft row and fakes every write tool.

**Tech Stack:** TypeScript, Express, Drizzle (Postgres schema `p2mxx34fvbf3ll6`), React + TanStack Query + react-i18next, node:test via `npx tsx --test`; Python 3.13, FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-10-25-voice-call-review-and-prompt-coach-design.md` (its "Decisions after the builder check" override older sections).

## Global Constraints

- Work only in the worktree `/home/gabriel/LeadAwakerApp-wt-voice-review` (branch `feat/voice-review`). The shell's cwd resets: prefix every CRM command with `cd /home/gabriel/LeadAwakerApp-wt-voice-review &&`. Run CRM tests from that directory (the rules loader reads a path relative to cwd).
- Never run `tsc` (project rule). Never run `npm run dev` or `npm run build`. Never `pm2 restart leadawaker` (production runs the main checkout, not this worktree).
- Tests: node:test files run with `npx tsx --test <file>`. Pure modules must not import `../db` at top level (lazy `await import("../db")` like `server/storage/voiceCallReview.ts`), and use `import type` for `@shared/*` types.
- Every user-facing string goes through i18n in `en`, `nl` and `pt` (Brazilian Portuguese). New strings live in a new namespace `voiceCoach` (Task 9 creates it).
- No em dashes (U+2014) anywhere: code comments, copy, prompts, the rules document, locale files. No raw hex or `bg-white` in components: tokens only (`var(--ink)`, `var(--mute)`, `var(--wine)`, `var(--good)`, `var(--good-tint)`, `var(--stage-lost)`, `var(--r-card)`, `var(--r-button)`, classes `la-btn la-btn--wine|--soft`, `neu-inset-crisp`, `la-seg`). Never `transition-all`. Dialog only for destructive confirmations; use inline confirm rows instead.
- Mobile first: every new component is one column at 390px with no horizontal scroll, buttons wrap, touch targets at least 36px tall; desktop layout of existing cards unchanged.
- Files under 500 lines. New server routes are Owner only (`requireOwner` + `accountIdFor`), like `server/routes/voiceAccountPrompts.ts`, because "Prompt & test" is Owner only.
- The account id is always a parameter; never hardcode 53. The prompt rows are the shared `eleven_layer_nl` / `eleven_layer_en` (decision 1): drafts are per prompt row, reviews, cards and coach history per account.
- Nothing reaches live calls except "Save to live" (`saveElevenDraftsToLive`). No scheduler or AI path writes `Prompt_Library`.
- Review counts only phone calls: `accounts_id = <account>`, `left(call_id, 3) = 'el_'`, `test_account_id IS NULL` (browser tests, live or draft, carry `test_account_id`; checked in the DB on 2026-10-25: 37 browser rows on account 53 all have it).
- Models: weekly review `opus`, timeout 600 000 ms; coach `sonnet`, timeout 180 000 ms; both through `claudeJson` from `server/aiTextHelper.ts` with a `jsonSchema`, injected as a dependency so tests never call a model.
- Engine (`/home/gabriel/automations`): edit in place, no git commits there, back up each touched file first to `/tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/engine-backup/`.
- Commits: one per task in the worktree, message prefix `voice-review:`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push or merge.

## Review Focus

1. A card whose find text appears twice, or no longer appears because the draft was edited after the card was made: it must become `stale` and never be applied to the wrong spot (tests in Task 3 `applyEdit` ambiguous and Task 3 `planAccept`/`isStale`).
2. Live changed on the Prompt Library page after the draft started: the draft card warns (`liveMoved`), and Save to live snapshots the live text it actually replaces, not the stale `baseText` (Task 3 `planSaveToLive` test "snapshots current live, not base").
3. A period with zero ElevenLabs phone calls: the scheduler skips the account (no empty weekly row, no AI call), and "Run now" stores a `done` review with zero stats and no model call (Task 6 `runReview` zero-calls test, Task 6 tick test).
4. A model answer that breaks the template (`{marks}` the live text does not have), repeats a rejected card, uses em dashes, or cites call ids that were not in the period: proposals dropped or cleaned, call ids filtered (Task 3 `validateProposal`, Task 5 `parseReviewAnswer`, Task 6 `runReview` filter test).
5. A server restart or failure mid-review, and two ticks overlapping: a failed or stuck weekly row is retried at most 3 attempts, a tick never runs twice at once, and one account failing never stops the others (Task 6 `guarded` and tick tests; the claim SQL in Task 5).

---

### Task 1: Prompt rules document and loader

**Files:**
- Create: `server/voice/elevenPromptRules.md`
- Create: `server/voice/promptRules.ts`
- Test: `server/voice/promptRules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadPromptRules(): string` (the file's text, read once with `readFileSync(path.join(process.cwd(), "server", "voice", "elevenPromptRules.md"), "utf8")` and cached in a module variable); `resetPromptRulesCache(): void`. Tasks 5, 6 and 8 put this text into their system prompts.

- [ ] **Step 1: Read the sources.** `~/.claude/skills/voice-prompt-repair/SKILL.md`, `~/.claude/skills/voice-prompt-repair/code-map.md`, `~/.claude/skills/voice-call-analyst/SKILL.md`, `~/automations/src/automations/voice/eleven_template.py` (lines 1 to 60: marks, PLACEHOLDERS, FLAGS, MIN_CHARS), `~/automations/src/automations/voice/eleven_prompt.py` docstring. Load WebFetch with ToolSearch (`select:WebFetch`) and read `https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide` (if it 404s, WebSearch "ElevenLabs agents prompting guide" and use the official docs page). The skills predate the `eleven_layer` rows and talk about `eleven_prompt_copy.py`: translate that to "the Prompt_Library row".

- [ ] **Step 2: Write the failing test** `server/voice/promptRules.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPromptRules, resetPromptRulesCache } from "./promptRules";

test("rules load, are cached and carry every required section", () => {
  resetPromptRulesCache();
  const a = loadPromptRules();
  assert.equal(loadPromptRules(), a);
  for (const h of ["## How our prompt is built", "## Structure", "## Spoken style", "## Tools", "## Silence, interruptions and ending",
    "## Guardrails", "## How to change the prompt", "## Diagnosing a call", "## What not to propose"]) {
    assert.ok(a.includes(h), h);
  }
  assert.ok(a.length > 4000 && a.length < 30000, String(a.length));
});

test("no em dashes and the template marks are explained", () => {
  const a = loadPromptRules();
  assert.equal(a.includes("\u2014"), false);
  assert.ok(a.includes("{?") && a.includes("eleven_layer_nl") && a.includes("eleven_layer_en"));
});
```

- [ ] **Step 3: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/promptRules.test.ts` Expected: FAIL, module not found.

- [ ] **Step 4: Write `server/voice/elevenPromptRules.md`** (English, 150 to 350 lines, real content, no em dashes) with exactly these `##` sections, in this order:
  - `## How our prompt is built`: the engine builds the prompt per call from `Prompt_Library` rows `eleven_layer_nl` / `eleven_layer_en` (Portuguese reads `en`), shared by every ElevenLabs line, 30 s cache; `{name}` parts and `{?flag}` / `{?!flag}` line conditions; a line whose parts are empty is dropped; a saved row rendering under 200 characters falls back to the code copy; the knowledge base is injected per call; the prompt used on a call is not stored.
  - `## Structure`: the sections ElevenLabs recommends (personality, environment, tone, goal, guardrails, tools), headings, short bullets, one rule per bullet, the order matters.
  - `## Spoken style`: short spoken sentences, one question per turn, numbers, prices, dates, times and phone numbers written for speech (both languages, with examples), no markdown read aloud.
  - `## Tools`: one "when to use" line per tool, availability before booking, never say booked unless the tool answered booked, what to say while a tool runs, what to do on an error result.
  - `## Silence, interruptions and ending`: handling silence, being interrupted, end_call only after a goodbye.
  - `## Guardrails`: from the guide plus the skills (no invented facts, prices or promises; transfers; screening).
  - `## How to change the prompt`: the repair skill's rules: surgical, one behaviour per sentence, "Als X, dan Y" / "If X, then Y", put the rule where the agent is when it needs it, remove a conflicting line instead of adding a louder one, mirror NL and EN, keep every `{mark}` and never invent one, no em dashes, find text copied verbatim.
  - `## Diagnosing a call`: the analyst skill's cause classes, stage audit and latency baseline (numbers from the skill).
  - `## What not to propose`: engine-side causes (model, turn-taking, latency, agent settings in `scripts/eleven_setup.py`), knowledge base wording (named as a recommendation instead), whole-prompt rewrites.

- [ ] **Step 5: Implement `server/voice/promptRules.ts`** with the two functions in Interfaces.

- [ ] **Step 6: Run the test.** Same command. Expected: PASS (2 tests).

- [ ] **Step 7: Commit.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && git add server/voice/elevenPromptRules.md server/voice/promptRules.ts server/voice/promptRules.test.ts && git commit -m "voice-review: ElevenLabs prompt rules document and loader"` (with the Co-Authored-By line).

---

### Task 2: Tables (script, run it, Drizzle declarations)

**Files:**
- Create: `script/create-voice-review-tables.mjs` (modelled on `script/create-social-studio-tables.mjs`: same SCHEMA constant, one SQL string of `CREATE TABLE IF NOT EXISTS` / `CREATE [UNIQUE] INDEX IF NOT EXISTS`, then the column-count and index listing)
- Modify: `shared/schema.ts` (append a `// ─── Voice review and prompt coach ───` section at the end of the file)

**Interfaces:**
- Produces (Drizzle exports, used by Tasks 4, 5, 8):
  - `voiceReviews` = `Voice_Reviews`: `id serial pk`, `accountsId accounts_id int not null`, `kind text not null` (`weekly|manual`), `weekKey week_key text` (null for manual), `periodStart period_start timestamptz not null`, `periodEnd period_end timestamptz not null`, `status text not null default 'running'` (`running|done|failed`), `attempts int not null default 1`, `stats jsonb not null default '{}'`, `report jsonb`, `error text`, `model text`, `startedAt started_at timestamptz not null default now()`, `finishedAt finished_at timestamptz`, `createdAt created_at timestamptz not null default now()`. Indexes: unique `voice_reviews_weekly_week` on `(accounts_id, week_key) WHERE kind = 'weekly'`; `voice_reviews_account_created_idx` on `(accounts_id, created_at)`.
  - `voicePromptSuggestions` = `Voice_Prompt_Suggestions`: `id serial pk`, `accountsId accounts_id int not null`, `source text not null` (`review|chat`), `reviewId review_id int`, `coachMessageId coach_message_id int`, `promptsId prompts_id int not null`, `language text not null` (`nl|en`), `title text not null`, `reason text not null`, `findText find_text text not null`, `replaceText replace_text text not null`, `mirrorPromptsId mirror_prompts_id int`, `mirrorFindText mirror_find_text text`, `mirrorReplaceText mirror_replace_text text`, `evidenceCallIds evidence_call_ids text[] not null default '{}'`, `status text not null default 'proposed'` (`proposed|accepted|rejected|stale|live`), `statusNote status_note text`, `decidedBy decided_by text`, `decidedAt decided_at timestamptz`, `createdAt`, `updatedAt` (`timestamptz not null default now()`). Index `voice_prompt_suggestions_account_status_idx` on `(accounts_id, status)`.
  - `voicePromptDrafts` = `Voice_Prompt_Drafts`: `id serial pk`, `promptsId prompts_id int not null` (unique index `voice_prompt_drafts_prompt`), `useCase use_case text not null`, `draftText draft_text text not null`, `baseText base_text text not null`, `acceptedIds accepted_ids int[] not null default '{}'`, `updatedBy updated_by text`, `createdAt`, `updatedAt`.
  - `voiceCoachMessages` = `Voice_Coach_Messages`: `id serial pk`, `accountsId accounts_id int not null`, `role text not null` (`user|assistant`), `content text not null`, `suggestionIds suggestion_ids int[] not null default '{}'`, `createdBy created_by text`, `createdAt created_at timestamptz not null default now()`. Index `voice_coach_messages_account_created_idx` on `(accounts_id, created_at)`.
  - Types: `VoiceReviewRow`, `VoicePromptSuggestionRow`, `VoicePromptDraftRow`, `VoiceCoachMessageRow` (`$inferSelect`). Arrays follow `socialTopics.tagIds` (`.array().notNull().default(sql\`'{}'\`)`). The engine (Task 8) reads `Voice_Prompt_Drafts.use_case` and `draft_text` by raw SQL: keep those names.

- [ ] **Step 1: Write the script** with the four tables and indexes above and `TABLES = ["Voice_Reviews", "Voice_Prompt_Suggestions", "Voice_Prompt_Drafts", "Voice_Coach_Messages"]`. Header comment: purely additive and idempotent, run line `node --env-file=.env script/create-voice-review-tables.mjs`.

- [ ] **Step 2: Run it against the real DB (additive only).** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && node --env-file=.env script/create-voice-review-tables.mjs` Expected: `Voice_Coach_Messages: 7 columns`, `Voice_Prompt_Drafts: 9 columns`, `Voice_Prompt_Suggestions: 21 columns`, `Voice_Reviews: 15 columns`, and the five index names. Run it a second time: same output, no error (idempotent).

- [ ] **Step 3: Add the Drizzle declarations** to `shared/schema.ts` as listed.

- [ ] **Step 4: Prove the declarations match the tables.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --env-file=.env -e '(async () => { const { db } = await import("./server/db"); const s = await import("./shared/schema"); for (const t of [s.voiceReviews, s.voicePromptSuggestions, s.voicePromptDrafts, s.voiceCoachMessages]) console.log((await db.select().from(t).limit(1)).length); process.exit(0) })()'` Expected: four lines `0`, no "column does not exist" error.

- [ ] **Step 5: Commit** `script/create-voice-review-tables.mjs shared/schema.ts` with message `voice-review: tables for reviews, cards, drafts and coach messages`.

---

### Task 3: Pure core (shared types, week window, stats, find/replace rules, draft plans)

**Files:**
- Create: `shared/voiceReview.ts`
- Create: `server/voice/review/weekWindow.ts`, `server/voice/review/reviewStats.ts`, `server/voice/review/promptEdits.ts`, `server/voice/review/draftPlans.ts`
- Test: `server/voice/review/weekWindow.test.ts`, `reviewStats.test.ts`, `promptEdits.test.ts`, `draftPlans.test.ts` (same folder)

**Interfaces:**
- Produces, `shared/voiceReview.ts` (types only plus one constant; client and server import it):

```ts
export type PromptLang = "nl" | "en";
export type ReviewKind = "weekly" | "manual";
export type ReviewStatus = "running" | "done" | "failed";
export interface ReviewStats { calls: number; byOutcome: Record<string, number>; byEndReason: Record<string, number>;
  latencyAvgMs: number | null; latencyP90Ms: number | null; costUsd: number; minutes: number }
export interface ReviewProblem { title: string; detail: string; callIds: string[] }
export interface ReviewWorstCall { callId: string; why: string }
export interface ReviewReport { summary: string; comparison: string; problems: ReviewProblem[]; worstCalls: ReviewWorstCall[];
  knowledgeBase: string[]; droppedProposals: number }
export interface ReviewDto { id: number; accountId: number; kind: ReviewKind; weekKey: string | null; periodStart: string; periodEnd: string;
  status: ReviewStatus; stats: ReviewStats | null; report: ReviewReport | null; error: string | null; startedAt: string; finishedAt: string | null }
export interface ProposalInput { language: PromptLang; title: string; reason: string; find: string; replace: string;
  mirrorFind: string | null; mirrorReplace: string | null; callIds: string[] }
export type SuggestionStatus = "proposed" | "accepted" | "rejected" | "stale" | "live";
export interface SuggestionDto { id: number; accountId: number; source: "review" | "chat"; reviewId: number | null; promptId: number;
  language: PromptLang; title: string; reason: string; find: string; replace: string; mirrorPromptId: number | null;
  mirrorFind: string | null; mirrorReplace: string | null; callIds: string[]; status: SuggestionStatus; statusNote: string | null;
  createdAt: string; decidedAt: string | null }
export interface DraftView { promptId: number; useCase: string; language: PromptLang; liveText: string; liveUpdatedAt: string | null;
  draftText: string; hasDraft: boolean; liveMoved: boolean; acceptedIds: number[]; updatedAt: string | null }
export interface CoachMessageDto { id: number; role: "user" | "assistant"; content: string; suggestionIds: number[]; createdAt: string }
export const MAX_PROPOSALS = 5;
```

- Produces, `weekWindow.ts`: `interface ReviewWeek { weekKey: string; periodStart: Date; periodEnd: Date }`; `amsterdamToUtc(y: number, month: number /*1-12*/, d: number, h: number): Date` (wall clock in Europe/Amsterdam to UTC, via `Intl.DateTimeFormat` offset lookup, DST safe); `dueWeek(now: Date): ReviewWeek` = the latest Monday to Sunday Amsterdam week whose following Monday 07:00 Amsterdam is at or before `now`; `periodStart` and `periodEnd` are Monday 00:00 Amsterdam (end exclusive); `weekKey` is the ISO week of `periodStart` as `YYYY-Www`; `lastDays(now: Date, days = 7): { periodStart: Date; periodEnd: Date }`.
- Produces, `reviewStats.ts`: `interface ReviewCallRow { callId: string; startedAt: string; endedAt: string | null; outcome: string | null; endReason: string | null; costUsd: number | null; latencyMs: number | null; latencyP90Ms: number | null; toolErrors: number }`; `computeStats(calls: ReviewCallRow[]): ReviewStats` (null outcome or end reason counts as `"unknown"`; `latencyAvgMs` = rounded mean of non-null `latencyMs`; `latencyP90Ms` = nearest-rank 90th percentile of non-null `latencyP90Ms`; both null when no values; `costUsd` summed, rounded to 2 decimals; `minutes` = sum of `endedAt - startedAt` over calls with `endedAt`, in minutes rounded to 1 decimal); `problemScore(c: ReviewCallRow): number` (+2 when outcome is null, `hung_up` or `other`; +2 when endReason is `silence`, `lost`, `caller_hung_up`, `time_limit` or `no_greeting`; +2 when `toolErrors > 0`; +1 when `latencyP90Ms > 2500`); `pickTranscriptCalls(calls: ReviewCallRow[], max: number): string[]` (score descending, then `startedAt` descending).
- Produces, `promptEdits.ts`: `countOccurrences(text: string, find: string): number` (non-overlapping; empty find gives 0); `applyEdit(text, find, replace): { ok: true; text: string } | { ok: false; reason: "not_found" | "ambiguous" }` (exactly one occurrence required); `newMarks(replace: string, fullText: string): string[]` (marks matching `/\{\??!?[A-Za-z_][A-Za-z0-9_]*\}/g` in `replace` that do not occur in `fullText`); `cleanCopy(s: string): string` (replaces `/\s*\u2014\s*/g` with `", "`, trims); `type ProposalProblem = "empty" | "no_change" | "too_long" | "not_found" | "ambiguous" | "new_mark" | "mirror_not_found" | "mirror_ambiguous" | "mirror_new_mark" | "rejected_before"`; `validateProposal(p: ProposalInput, texts: Partial<Record<PromptLang, string>>, rejected: { find: string; replace: string }[]): { ok: true } | { ok: false; reason: ProposalProblem }` (rules in order: empty find or title gives `empty`; `find === replace` gives `no_change`; find over 2000 or replace over 3000 chars gives `too_long`; target text missing gives `not_found`; `applyEdit` on `texts[p.language]`; `newMarks`; when `mirrorFind` is a non-empty string: mirror target is the other language, `mirrorReplace ?? ""`, same checks with `mirror_*` reasons; whitespace-collapsed `find`+`replace` equal to a rejected pair gives `rejected_before`).
- Produces, `draftPlans.ts`:

```ts
export interface DraftRowState { promptId: number; useCase: string; language: PromptLang; liveText: string;
  draft: { draftText: string; baseText: string; acceptedIds: number[] } | null }
export interface DraftWrite { promptId: number; useCase: string; draftText: string; baseText: string; acceptedIds: number[] }
export type CardEdit = Pick<SuggestionDto, "id" | "promptId" | "find" | "replace" | "mirrorPromptId" | "mirrorFind" | "mirrorReplace">;
export function draftTextOf(row: DraftRowState): string; // draft?.draftText ?? liveText
export function planAccept(card: CardEdit, rows: DraftRowState[]): { ok: true; writes: DraftWrite[] } | { ok: false; reason: "no_row" | "not_found" | "ambiguous" };
export function isStale(card: CardEdit, rows: DraftRowState[]): boolean; // !planAccept(card, rows).ok
export interface SavePlan { versions: { promptId: number; versionNumber: string | null; promptText: string; systemMessage: string | null; label: string }[];
  updates: { promptId: number; promptText: string }[]; liveCardIds: number[]; deleteDraftPromptIds: number[] }
export function planSaveToLive(rows: DraftRowState[], current: { promptId: number; liveText: string; version: string | null; systemMessage: string | null }[], today: string): SavePlan;
```

  `planAccept`: the target row is `card.promptId`, the mirror row `card.mirrorPromptId` when `mirrorFind` is non-empty; each edit applies to `draftTextOf(row)`; a write keeps the existing `baseText` or starts from `liveText`; `acceptedIds` gets `card.id` once. `planSaveToLive`: every row with a draft goes into `deleteDraftPromptIds` and its `acceptedIds` into `liveCardIds`; when `draftText` differs from the current live text, one version snapshots the CURRENT live text (from `current`) with label `Before save to live ${today}` plus `, cards #4 #7` when there are accepted ids, and one update writes the draft text.

- [ ] **Step 1: Write the failing tests.** Key assertions (write each as its own `test`):

```ts
// weekWindow.test.ts
const w = dueWeek(new Date("2026-10-26T06:30:00Z")); // Mon 07:30 CET, the day after DST ended
assert.equal(w.weekKey, "2026-W43");
assert.equal(w.periodStart.toISOString(), "2026-10-18T22:00:00.000Z");
assert.equal(w.periodEnd.toISOString(), "2026-10-25T23:00:00.000Z");
const before = dueWeek(new Date("2026-10-26T05:30:00Z")); // Mon 06:30 CET: last week is not due yet
assert.equal(before.weekKey, "2026-W42");
assert.equal(before.periodStart.toISOString(), "2026-10-11T22:00:00.000Z");
assert.equal(before.periodEnd.toISOString(), "2026-10-18T22:00:00.000Z");
assert.equal(dueWeek(new Date("2026-10-28T12:00:00Z")).weekKey, "2026-W43"); // midweek
const ny = dueWeek(new Date("2027-01-04T08:00:00Z"));
assert.equal(ny.weekKey, "2026-W53");
assert.equal(ny.periodStart.toISOString(), "2026-12-27T23:00:00.000Z");
assert.equal(ny.periodEnd.toISOString(), "2027-01-03T23:00:00.000Z");
assert.equal(amsterdamToUtc(2026, 7, 1, 7).toISOString(), "2026-07-01T05:00:00.000Z");
const l = lastDays(new Date("2026-10-26T12:00:00Z"));
assert.equal(l.periodStart.toISOString(), "2026-10-19T12:00:00.000Z");

// reviewStats.test.ts
const s = computeStats([
  row({ outcome: "booked", endReason: "goodbye", latencyMs: 800, latencyP90Ms: 1500, costUsd: 0.12, startedAt: "2026-10-20T10:00:00Z", endedAt: "2026-10-20T10:03:00Z" }),
  row({ outcome: null, endReason: null, latencyMs: 1200, latencyP90Ms: 3000, costUsd: 0.2049, startedAt: "2026-10-21T10:00:00Z", endedAt: null }),
]);
assert.deepEqual(s.byOutcome, { booked: 1, unknown: 1 });
assert.deepEqual(s.byEndReason, { goodbye: 1, unknown: 1 });
assert.equal(s.latencyAvgMs, 1000); assert.equal(s.latencyP90Ms, 3000);
assert.equal(s.costUsd, 0.32); assert.equal(s.minutes, 3); assert.equal(s.calls, 2);
assert.deepEqual(computeStats([]), { calls: 0, byOutcome: {}, byEndReason: {}, latencyAvgMs: null, latencyP90Ms: null, costUsd: 0, minutes: 0 });
// pickTranscriptCalls: a hung_up call with a tool error comes before a newer booked one; max respected
assert.deepEqual(pickTranscriptCalls([ok("el_a", "2026-10-22"), bad("el_b", "2026-10-20")], 1), ["el_b"]);

// promptEdits.test.ts
assert.deepEqual(applyEdit("a X b", "X", "Y"), { ok: true, text: "a Y b" });
assert.deepEqual(applyEdit("X X", "X", "Y"), { ok: false, reason: "ambiguous" });
assert.deepEqual(applyEdit("abc", "Z", "Y"), { ok: false, reason: "not_found" });
assert.equal(countOccurrences("aaaa", "aa"), 2); assert.equal(countOccurrences("a", ""), 0);
assert.deepEqual(newMarks("Hi {agent} {?closed} {newthing}", "Je bent {agent}. {?closed}x"), ["{newthing}"]);
assert.equal(cleanCopy("Ja \u2014 nee"), "Ja, nee");
const texts = { nl: "- Zeg nooit X.\n- Je bent {agent}.", en: "- Never say X.\n- You are {agent}." };
const p = { language: "nl", title: "t", reason: "r", find: "- Zeg nooit X.", replace: "- Als X, dan Y.", mirrorFind: "- Never say X.", mirrorReplace: "- If X, then Y.", callIds: [] };
assert.deepEqual(validateProposal(p, texts, []), { ok: true });
assert.deepEqual(validateProposal({ ...p, replace: "{bogus}" }, texts, []), { ok: false, reason: "new_mark" });
assert.deepEqual(validateProposal({ ...p, mirrorFind: "- Gone." }, texts, []), { ok: false, reason: "mirror_not_found" });
assert.deepEqual(validateProposal(p, texts, [{ find: "- Zeg  nooit X.", replace: "- Als X,  dan Y." }]), { ok: false, reason: "rejected_before" });
assert.deepEqual(validateProposal({ ...p, replace: p.find }, texts, []), { ok: false, reason: "no_change" });
assert.deepEqual(validateProposal({ ...p, mirrorFind: null }, { nl: texts.nl }, []), { ok: true });

// draftPlans.test.ts
const nl = { promptId: 130, useCase: "eleven_layer_nl", language: "nl", liveText: "A\nB", draft: null };
const en = { promptId: 131, useCase: "eleven_layer_en", language: "en", liveText: "a\nb", draft: null };
const card = { id: 9, promptId: 130, find: "B", replace: "C", mirrorPromptId: 131, mirrorFind: "b", mirrorReplace: "c" };
assert.deepEqual(planAccept(card, [nl, en]), { ok: true, writes: [
  { promptId: 130, useCase: "eleven_layer_nl", draftText: "A\nC", baseText: "A\nB", acceptedIds: [9] },
  { promptId: 131, useCase: "eleven_layer_en", draftText: "a\nc", baseText: "a\nb", acceptedIds: [9] } ] });
// a card made against live is stale once the draft no longer has its text
const edited = { ...nl, draft: { draftText: "A\nZ", baseText: "A\nB", acceptedIds: [] } };
assert.equal(isStale(card, [edited, en]), true);
// snapshots current live, not base
const plan = planSaveToLive([{ ...nl, draft: { draftText: "A\nC", baseText: "OLD", acceptedIds: [9, 4] } }, en],
  [{ promptId: 130, liveText: "A\nB2", version: "3", systemMessage: null }, { promptId: 131, liveText: "a\nb", version: null, systemMessage: null }], "2026-10-26");
assert.deepEqual(plan.versions, [{ promptId: 130, versionNumber: "3", promptText: "A\nB2", systemMessage: null, label: "Before save to live 2026-10-26, cards #9 #4" }]);
assert.deepEqual(plan.updates, [{ promptId: 130, promptText: "A\nC" }]);
assert.deepEqual(plan.liveCardIds, [9, 4]); assert.deepEqual(plan.deleteDraftPromptIds, [130]);
// a draft equal to live: no version, no update, draft still removed
```

- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/review/weekWindow.test.ts server/voice/review/reviewStats.test.ts server/voice/review/promptEdits.test.ts server/voice/review/draftPlans.test.ts` Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** `shared/voiceReview.ts` and the four modules with the signatures above. No database imports.

- [ ] **Step 4: Run them again.** Expected: PASS, all tests.

- [ ] **Step 5: Commit** the nine files: `voice-review: pure core for weeks, stats, card edits and draft plans`.

---

### Task 4: Drafts and cards storage, routes, and the live-autosave guard

**Files:**
- Create: `server/storage/voicePromptDrafts.ts` (drafts plus cards; split into `server/storage/voiceSuggestions.ts` if it passes 400 lines)
- Create: `server/routes/voicePromptDrafts.ts`
- Modify: `server/storage/voiceAccountPrompts.ts` (export `elevenPromptRow`)
- Modify: `server/routes/voiceAccountPrompts.ts:22-38` (refuse the eleven row in the PUT)
- Modify: `server/storage.ts` (spread `voicePromptDraftsStorage` into the barrel)
- Modify: `server/routes/index.ts` (import and call `registerVoicePromptDraftRoutes(app)` after `registerVoiceAccountPromptRoutes(app)`)
- Test: `server/routes/voicePromptDraftsSchemas.test.ts` (route body schemas, exported from the routes file)

**Interfaces:**
- Consumes: Task 2 tables; Task 3 `planAccept`, `isStale`, `planSaveToLive`, `draftTextOf`, `DraftRowState`, and the `shared/voiceReview.ts` DTOs.
- Produces:
  - `elevenPromptRow(lang: PromptLang): Promise<VoicePromptRow | null>` in `server/storage/voiceAccountPrompts.ts` (the existing `elevenRow` query, keyed by language instead of locale; `elevenRow(locale)` then calls it).
  - `voicePromptDraftsStorage` with:
    - `getElevenDraftView(lang: PromptLang): Promise<DraftView | null>` (null when the row is missing; no draft gives `draftText = liveText`, `hasDraft false`, `liveMoved false`; with a draft `liveMoved = baseText !== liveText`)
    - `saveElevenDraftText(lang: PromptLang, text: string, by: string | null): Promise<DraftView | null>` (upsert on `prompts_id`; a new draft's `baseText` is the live text)
    - `discardElevenDraft(lang: PromptLang): Promise<DraftView | null>` (deletes the draft; its accepted cards that are still `accepted` go back to `proposed`)
    - `saveElevenDraftsToLive(by: string | null): Promise<{ saved: { promptId: number; language: PromptLang }[]; liveCardIds: number[] }>` (one `db.transaction`: reads both eleven rows' current `prompt_text`, `version`, `system_message`, runs `planSaveToLive` with today's Amsterdam date `YYYY-MM-DD`, inserts the versions into `Prompt_Versions` with `savedAt: new Date()` and `savedBy: by`, updates `Prompt_Library.prompt_text` and `updated_at`, sets the cards to `live`, deletes the drafts)
    - `listVoiceSuggestions(accountId: number, limit = 100): Promise<SuggestionDto[]>` (newest first; before returning, every `proposed` card for which `isStale` holds is updated to `stale` with `status_note = 'find_text_gone'`)
    - `acceptVoiceSuggestion(accountId: number, id: number, by: string | null): Promise<{ status: 200; card: SuggestionDto } | { status: 404 | 409; reason: "not_found" | "not_proposed" | "stale" }>` (only `proposed`; `planAccept` failure marks it `stale` and answers 409 `stale`; success upserts the draft writes and sets `accepted`, `decided_by`, `decided_at`, in one transaction)
    - `rejectVoiceSuggestion(accountId, id, by)`: same result shape; allowed from `proposed` or `stale`, else 409 `not_proposed`
    - `insertVoiceSuggestions(rows: NewSuggestion[]): Promise<number[]>` with `interface NewSuggestion { accountId: number; source: "review" | "chat"; reviewId: number | null; coachMessageId: number | null; promptId: number; mirrorPromptId: number | null; proposal: ProposalInput }`
    - `recentRejectedSuggestions(accountId: number, days = 60): Promise<{ find: string; replace: string }[]>`
  - Routes (all `requireOwner`, `accountIdFor`, `wrapAsync`, zod via `handleZodError`), exported schemas `langQuery = z.enum(["nl","en"])`, `draftBodySchema = z.object({ lang: z.enum(["nl","en"]), text: z.string().max(60_000) })`:
    - `GET /api/accounts/:id/voice/eleven-draft?lang=nl` gives `DraftView` (404 when null)
    - `PUT /api/accounts/:id/voice/eleven-draft` body `{ lang, text }` gives `DraftView`
    - `DELETE /api/accounts/:id/voice/eleven-draft?lang=nl` gives `DraftView`
    - `POST /api/accounts/:id/voice/eleven-draft/save` gives `{ saved, liveCardIds }`
    - `GET /api/accounts/:id/voice/suggestions` gives `SuggestionDto[]`
    - `POST /api/accounts/:id/voice/suggestions/:sid/accept` and `/reject` give the card, or the 404/409 with `{ message, reason }`
  - The old `PUT /api/accounts/:id/voice/prompts/:promptId` answers 400 `{ message: "The ElevenLabs prompt is edited through its draft." }` when `promptId === eleven?.id` (decision 2: the Voice tab never autosaves live).

- [ ] **Step 1: Write the failing schema test** `server/routes/voicePromptDraftsSchemas.test.ts`: `draftBodySchema` accepts `{ lang: "nl", text: "" }`, rejects `lang: "pt"`, rejects 60 001 characters; `langQuery` rejects `undefined`.
- [ ] **Step 2: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/routes/voicePromptDraftsSchemas.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the storage functions, routes, barrel entry, route registration and the PUT guard as specified. Map rows to DTOs in one `toSuggestionDto(row)` and one `toDraftView(row, live)`; timestamps leave as ISO strings.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Smoke the storage against the real DB, read only.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --env-file=.env -e '(async () => { const { storage } = await import("./server/storage"); const v = await storage.getElevenDraftView("nl"); console.log(v?.promptId, v?.hasDraft, v?.liveText.length); console.log((await storage.listVoiceSuggestions(53)).length); process.exit(0) })()'` Expected: `130 false <about 7600>` and `0`.
- [ ] **Step 6: Bundle check (no tsc).** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx esbuild server/index.ts --bundle --platform=node --format=esm --packages=external --log-level=error --outfile=/tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/server-check.mjs` Expected: exit 0, no errors.
- [ ] **Step 7: Commit** the touched files: `voice-review: prompt draft and change card storage and routes`.

---

### Task 5: Review data storage and the review prompt

**Files:**
- Create: `server/storage/voiceReviews.ts`
- Create: `server/voice/review/reviewPrompt.ts`
- Modify: `server/storage.ts` (spread `voiceReviewsStorage`)
- Test: `server/voice/review/reviewPrompt.test.ts`

**Interfaces:**
- Consumes: Task 2 `voiceReviews`, `voiceCalls`, `voiceCallEvents`, `interactions`, `testAccountIdSql` from `server/storage/voiceCallsSql.ts`; Task 3 types, `ReviewCallRow`, `cleanCopy`.
- Produces, `server/storage/voiceReviews.ts` as `voiceReviewsStorage`:
  - `interface TranscriptTurn { role: "caller" | "agent"; text: string }`; `interface ToolEventLite { tool: string; status: string | null; error: string | null; args: string }`
  - `listReviewCalls(accountId: number, start: Date, end: Date): Promise<ReviewCallRow[]>` (filter from Global Constraints; `started_at >= start AND started_at < end`, ordered by `started_at`; `toolErrors` = count of that call's `Voice_Call_Events` with `kind = 'tool'` and `error IS NOT NULL OR status = 'error'`)
  - `accountsWithElevenCalls(start: Date, end: Date): Promise<number[]>` (distinct `accounts_id`, same filter)
  - `loadReviewTranscripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>>` (`Interactions` with `type = 'voice_call'` and `conversation_thread_id` in the ids, ordered by `created_at, id`; `direction = 'inbound'` is the caller; rows whose `metadata.kind` is `receipt` skipped)
  - `loadReviewToolEvents(callIds: string[]): Promise<Map<string, ToolEventLite[]>>` (`kind = 'tool'`; `args` is `JSON.stringify(args)` cut to 200 characters with top-level keys matching `/secret|token|header|authoriz|password|api[-_]?key|cookie/i` removed first)
  - `loadAccountKnowledge(accountId: number): Promise<{ title: string; content: string }[]>` (raw SQL on `"p2mxx34fvbf3ll6"."Account_Knowledge_Base"` by `account_id`, excluding titles starting with `Current stock, updated every hour`)
  - `accountNameOf(accountId: number): Promise<string>`
  - `claimWeeklyReview(accountId: number, week: ReviewWeek): Promise<number | null>`: one statement, so a missed or repeated run can never duplicate a week:

```sql
INSERT INTO "p2mxx34fvbf3ll6"."Voice_Reviews" (accounts_id, kind, week_key, period_start, period_end, status, attempts, started_at)
VALUES ($1, 'weekly', $2, $3, $4, 'running', 1, now())
ON CONFLICT (accounts_id, week_key) WHERE kind = 'weekly'
DO UPDATE SET status = 'running', attempts = "Voice_Reviews".attempts + 1, started_at = now(), error = NULL
WHERE "Voice_Reviews".attempts < 3 AND ("Voice_Reviews".status = 'failed'
  OR ("Voice_Reviews".status = 'running' AND "Voice_Reviews".started_at < now() - interval '30 minutes'))
RETURNING id
```

  - `createManualReview(accountId: number, start: Date, end: Date): Promise<number | null>` (null when this account has a `running` review started in the last 30 minutes)
  - `finishVoiceReview(id: number, out: { stats: ReviewStats; report: ReviewReport; model: string | null }): Promise<void>` (status `done`, `finished_at = new Date()`); `failVoiceReview(id: number, error: string): Promise<void>` (status `failed`, error cut to 500)
  - `listVoiceReviews(accountId: number, limit = 20): Promise<ReviewDto[]>` (newest `period_end` first, then id); `getVoiceReview(accountId, id): Promise<ReviewDto | null>`; `previousVoiceReview(accountId: number, beforeId: number): Promise<ReviewDto | null>` (latest `done` review with a smaller id); `latestDoneVoiceReview(accountId): Promise<ReviewDto | null>`
- Produces, `server/voice/review/reviewPrompt.ts`:
  - `REVIEW_TIMEOUT_MS = 600_000`, `MAX_TRANSCRIPT_CALLS = 40`, `TRANSCRIPT_CHARS_PER_CALL = 6000`
  - `interface ReviewCallForPrompt { callId: string; startedAt: string; outcome: string | null; endReason: string | null; latencyMs: number | null; latencyP90Ms: number | null; tools: ToolEventLite[]; transcript: TranscriptTurn[] | null }`
  - `interface ReviewPromptInput { accountName: string; periodStart: string; periodEnd: string; stats: ReviewStats; previous: ReviewDto | null; rules: string; prompts: Partial<Record<PromptLang, string>>; knowledge: { title: string; content: string }[]; rejected: { find: string; replace: string }[]; calls: ReviewCallForPrompt[] }`
  - `clipTranscript(turns: TranscriptTurn[], maxChars: number): TranscriptTurn[]` (keeps whole turns in order while the running text length stays within `maxChars`, then appends `{ role: "agent", text: "[rest of the call cut]" }` when anything was dropped)
  - `REVIEW_SCHEMA`: JSON schema object, `additionalProperties: false`, required `summary` (string), `comparison` (string), `problems` (array, maxItems 5, of `{ title, detail, callIds: string[] }`), `worstCalls` (maxItems 3, `{ callId, why }`), `knowledgeBase` (maxItems 3, strings), `proposals` (maxItems `MAX_PROPOSALS`, of `{ language: enum nl|en, title, reason, find, replace, mirrorFind: string|null, mirrorReplace: string|null, callIds: string[] }`)
  - `buildReviewPrompt(input: ReviewPromptInput): { system: string; user: string }`: the system prompt is the rules text followed by the task: review this account's ElevenLabs phone calls for the period; English report, quote callers in their own language; the report is short (summary one line, at most 5 problems of one line each, at most 3 worst calls, comparison one line against the previous review or "No earlier review"); proposals are surgical find/replace edits whose `find` is copied verbatim from the live prompt and occurs exactly once, with the mirror edit in the other language when the same rule exists there; never invent `{marks}`; no em dashes; prefer removing or rewording a conflicting line over adding a louder one; do not repeat a rejected edit unless new calls show it again; knowledge base wording goes in `knowledgeBase`, never in proposals; only cite call ids from the list. The user text has labelled sections in this order: period and account, stats (JSON), previous review (summary, comparison, problems) or "None", live prompt NL, live prompt EN, knowledge base, rejected edits, calls (one block per call: id, start in Europe/Amsterdam, outcome, end reason, latency, tools, transcript or "(transcript not included)").
  - `parseReviewAnswer(text: string): { ok: true; report: ReviewReport; proposals: ProposalInput[] } | { ok: false; reason: "not_json" | "bad_shape" }` (uses `extractJsonObject` from `server/aiTextHelper.ts`; checks types; clips arrays to their maxima and strings to title 120, detail 300, why 160, knowledgeBase item 300, summary and comparison 300; runs `cleanCopy` on every text field including `replace` and `mirrorReplace`; `droppedProposals: 0`).

- [ ] **Step 1: Write the failing test** `reviewPrompt.test.ts`: `clipTranscript` keeps the first turns and appends the cut marker; `buildReviewPrompt` user text contains both prompts' text, each call id, "(transcript not included)" for a call with `transcript: null`, and the system prompt starts with the rules text and contains no em dash; `parseReviewAnswer` on a fenced JSON answer with 7 problems keeps 5, turns `"a \u2014 b"` in a `replace` into `"a, b"`, and returns `bad_shape` when `problems` is a string and `not_json` for `"sorry"`.
- [ ] **Step 2: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/review/reviewPrompt.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `reviewPrompt.ts`, then `server/storage/voiceReviews.ts` and its barrel entry.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Read-only smoke against the real DB.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --env-file=.env -e '(async () => { const { storage } = await import("./server/storage"); const c = await storage.listReviewCalls(53, new Date("2026-10-19T00:00:00Z"), new Date("2026-10-26T00:00:00Z")); console.log(c.length, c.every(x => x.callId.startsWith("el_"))); console.log(await storage.accountsWithElevenCalls(new Date("2026-10-19T00:00:00Z"), new Date("2026-10-26T00:00:00Z"))); const t = await storage.loadReviewTranscripts(c.slice(0,1).map(x => x.callId)); console.log([...t.values()][0]?.length); process.exit(0) })()'` Expected: `21 true` (the 21 phone calls, not the 37 browser tests), `[ 53 ]`, a turn count above 0.
- [ ] **Step 6: Bundle check** (command from Task 4 Step 6). Expected: exit 0.
- [ ] **Step 7: Commit:** `voice-review: review data loading and the review prompt`.

---

### Task 6: Review runner, scheduler and routes

**Files:**
- Create: `server/voice/review/runReview.ts`
- Create: `server/voice/review/scheduler.ts`
- Create: `server/routes/voiceReviews.ts`
- Modify: `server/routes/index.ts` (register routes; add `startVoiceReviewScheduler();` with a comment `// ElevenLabs weekly call review (1h tick, Monday 07:00 Europe/Amsterdam)` at the end of the background jobs list, after the `DISABLE_BACKGROUND_JOBS` guard, so it only runs where the other jobs run)
- Test: `server/voice/review/runReview.test.ts`, `server/voice/review/scheduler.test.ts`

**Interfaces:**
- Consumes: Task 1 `loadPromptRules`; Task 3 `computeStats`, `pickTranscriptCalls`, `validateProposal`, `dueWeek`, `lastDays`, `ReviewWeek`; Task 4 `elevenPromptRow`, `insertVoiceSuggestions`, `recentRejectedSuggestions`, `NewSuggestion`; Task 5 storage and prompt functions.
- Produces, `runReview.ts`:

```ts
export type AiComplete = typeof import("../../aiTextHelper").claudeJson;
export interface ReviewStore {
  listCalls(accountId: number, start: Date, end: Date): Promise<ReviewCallRow[]>;
  transcripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>>;
  toolEvents(callIds: string[]): Promise<Map<string, ToolEventLite[]>>;
  knowledge(accountId: number): Promise<{ title: string; content: string }[]>;
  accountName(accountId: number): Promise<string>;
  previous(accountId: number, beforeReviewId: number): Promise<ReviewDto | null>;
  livePrompts(): Promise<Partial<Record<PromptLang, { id: number; text: string }>>>;
  rejected(accountId: number): Promise<{ find: string; replace: string }[]>;
  insertSuggestions(rows: NewSuggestion[]): Promise<number[]>;
  finish(reviewId: number, out: { stats: ReviewStats; report: ReviewReport; model: string | null }): Promise<void>;
  fail(reviewId: number, error: string): Promise<void>;
}
export interface ReviewDeps { ai: AiComplete; rules: () => string; store: ReviewStore }
export interface ReviewJob { reviewId: number; accountId: number; periodStart: Date; periodEnd: Date }
export async function runReview(deps: ReviewDeps, job: ReviewJob): Promise<"done" | "failed">; // never throws
export function liveReviewDeps(): ReviewDeps; // claudeJson, loadPromptRules, storage
```

  Flow: list calls; `computeStats`; zero calls gives `finish` with `report = { summary: "No ElevenLabs phone calls in this period.", comparison: "", problems: [], worstCalls: [], knowledgeBase: [], droppedProposals: 0 }`, `model: null`, and no AI call. Otherwise transcripts for `pickTranscriptCalls(calls, MAX_TRANSCRIPT_CALLS)` (each `clipTranscript(..., TRANSCRIPT_CHARS_PER_CALL)`), tool events for all calls, `ai({ ...buildReviewPrompt(...), model: "opus", timeoutMs: REVIEW_TIMEOUT_MS, jsonSchema: REVIEW_SCHEMA })`; an `error` or a failed parse calls `fail` (error text, or `parse: <reason>`). Call ids in problems, worst calls and proposals are filtered to the period's ids (worst calls with an unknown id dropped). Each proposal is validated against the live texts and the rejected pairs; valid ones become `NewSuggestion` (`source: "review"`, `reviewId`, `promptId = live[lang].id`, `mirrorPromptId = live[other].id` when the proposal has a mirror); `report.droppedProposals` counts the rest. Then `finish(..., model: "opus")`. Any thrown error ends in `fail`.

- Produces, `scheduler.ts`:

```ts
export interface WeeklyDeps { now(): Date; accountsWithCalls(start: Date, end: Date): Promise<number[]>;
  claim(accountId: number, week: ReviewWeek): Promise<number | null>; run(job: ReviewJob): Promise<"done" | "failed"> }
export async function tickWeeklyReviews(deps: WeeklyDeps): Promise<number>; // reviews run; one account's error is logged, the loop goes on
export function guarded(fn: () => Promise<unknown>): () => Promise<void>; // a call while the previous is still running returns at once
export function startVoiceReviewScheduler(): void; // logs "[voice-review] started (1h)"; first tick after 5 min, then setInterval 60 min; ticks through guarded()
```

- Produces, routes (`requireOwner`, `accountIdFor`): `GET /api/accounts/:id/voice/reviews` gives `ReviewDto[]`; `GET /api/accounts/:id/voice/reviews/:rid` gives `ReviewDto` or 404; `POST /api/accounts/:id/voice/reviews/run` takes `lastDays(new Date())`, calls `createManualReview`, answers 409 `{ message: "A review is already running." }` on null, else 202 `{ id }` and starts `void runReview(liveReviewDeps(), job)` without awaiting.

- [ ] **Step 1: Write the failing tests** with an in-memory fake store and a fake `ai` that records its calls:
  - `runReview`: zero calls stores `done` with `calls: 0`, the summary sentence above, and the fake `ai` was never called.
  - `runReview`: two calls, an answer with one valid proposal, one proposal whose `find` is not in the live text, a problem citing `el_x` plus an unknown `el_zzz`: one suggestion inserted with `source "review"`, `promptId 130`, `mirrorPromptId 131`; `report.droppedProposals === 1`; the problem's `callIds` is `["el_x"]`; `ai` got `model "opus"` and a `jsonSchema`.
  - `runReview`: `ai` returns `{ error: "timed out" }` leads to `fail(id, "timed out")` and result `"failed"`; `store.listCalls` throwing leads to `"failed"` too (never throws).
  - `tickWeeklyReviews`: `now` = `2026-10-26T06:30:00Z`, accounts `[53, 60]`, claim returns `null` for 60: `run` called once with `{ reviewId, accountId: 53, periodStart: 2026-10-18T22:00Z, periodEnd: 2026-10-25T23:00Z }`, result 1; `run` throwing for the first of two accounts still runs the second; no accounts gives 0 and no claim.
  - `guarded`: two calls while the first promise is pending run the inner function once.
- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/review/runReview.test.ts server/voice/review/scheduler.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the three files and the `routes/index.ts` changes.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Bundle check** (Task 4 Step 6 command). Expected: exit 0.
- [ ] **Step 6: Commit:** `voice-review: weekly review runner, hourly scheduler and routes`.

---

### Task 7: Prompt coach (server)

**Files:**
- Create: `server/voice/coach/coachPrompt.ts`, `server/voice/coach/runCoach.ts`
- Create: `server/storage/voiceCoach.ts`
- Create: `server/routes/voiceCoach.ts`
- Modify: `server/storage.ts` (spread `voiceCoachStorage`), `server/routes/index.ts` (register)
- Test: `server/voice/coach/coachPrompt.test.ts`, `server/voice/coach/runCoach.test.ts`

**Interfaces:**
- Consumes: Task 1 rules; Task 3 `validateProposal`, DTOs; Task 4 `getElevenDraftView`, `insertVoiceSuggestions`, `recentRejectedSuggestions`, `listVoiceSuggestions`; Task 5 `listReviewCalls`, `loadReviewTranscripts`, `latestDoneVoiceReview`, `TranscriptTurn`; Task 6 `AiComplete`.
- Produces, `coachPrompt.ts`: `COACH_TIMEOUT_MS = 180_000`; `MAX_COACH_TRANSCRIPTS = 10`; `COACH_TRANSCRIPT_CHARS = 4000`; `COACH_SCHEMA` (required `reply` string and `proposals` array, maxItems `MAX_PROPOSALS`, same proposal item schema as `REVIEW_SCHEMA`; import and reuse that item schema); `callIdsIn(text: string): string[]` (unique matches of `/\bel_[A-Za-z0-9_-]{4,}/g` in order); `interface CoachPromptInput { rules: string; lineLanguage: PromptLang; drafts: Partial<Record<PromptLang, { live: string; draft: string }>>; review: ReviewDto | null; callIndex: { callId: string; startedAt: string; outcome: string | null; endReason: string | null }[]; transcripts: { callId: string; startedAt: string; turns: TranscriptTurn[] }[]; history: { role: "user" | "assistant"; content: string }[]; message: string }`; `buildCoachPrompt(input): { system: string; user: string }` (system: the rules, then: you are Gabriel's prompt coach for the shared ElevenLabs receptionist prompt; answer briefly in the language Gabriel writes in; explain, brainstorm, propose; you never edit the prompt: changes go in `proposals` as find/replace edits on the DRAFT text, `find` verbatim and occurring once, with the mirror edit in the other language; no new marks, no em dashes; to discuss a call that is not among the transcripts, name its id from the call index and ask Gabriel to confirm); `parseCoachAnswer(text): { ok: true; reply: string; proposals: ProposalInput[] } | { ok: false; reason: "not_json" | "bad_shape" }` (`cleanCopy` on every text field, reply clipped to 4000).
- Produces, `voiceCoach.ts` storage as `voiceCoachStorage`: `listCoachMessages(accountId: number, limit = 50): Promise<CoachMessageDto[]>` (the newest `limit`, returned oldest first); `addCoachMessage(accountId: number, role: "user" | "assistant", content: string, by: string | null): Promise<CoachMessageDto>`; `setCoachMessageSuggestions(messageId: number, ids: number[]): Promise<void>`.
- Produces, `runCoach.ts`:

```ts
export interface CoachStore {
  history(accountId: number): Promise<CoachMessageDto[]>;
  addMessage(accountId: number, role: "user" | "assistant", content: string, by: string | null): Promise<CoachMessageDto>;
  setSuggestions(messageId: number, ids: number[]): Promise<void>;
  drafts(): Promise<Partial<Record<PromptLang, DraftView>>>;
  latestReview(accountId: number): Promise<ReviewDto | null>;
  callIndex(accountId: number, since: Date, until: Date): Promise<ReviewCallRow[]>;
  transcripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>>;
  rejected(accountId: number): Promise<{ find: string; replace: string }[]>;
  insertSuggestions(rows: NewSuggestion[]): Promise<number[]>;
  suggestions(accountId: number): Promise<SuggestionDto[]>;
}
export interface CoachDeps { ai: AiComplete; rules: () => string; store: CoachStore; now: () => Date }
export async function runCoachTurn(deps: CoachDeps, input: { accountId: number; lineLanguage: PromptLang; message: string; by: string | null }):
  Promise<{ status: 200; messages: CoachMessageDto[]; suggestions: SuggestionDto[] } | { status: 502; message: string }>;
export function liveCoachDeps(): CoachDeps;
```

  Flow: store the user message first; history = the last 12 messages before it; call index = the account's calls of the last 14 days; transcript ids = `callIdsIn` of this message and of the last 6 history messages, then the latest review's problem call ids, unique, known to the index, capped at `MAX_COACH_TRANSCRIPTS`, each clipped to `COACH_TRANSCRIPT_CHARS`; `ai` with `model: "sonnet"`, `COACH_TIMEOUT_MS`, `COACH_SCHEMA`; on `error` or a failed parse answer 502 `{ message: "The coach could not answer. Try again." }` (the user message stays stored). Otherwise store the assistant message, validate proposals against the DRAFT texts (`DraftView.draftText`) and the rejected pairs, insert the valid ones (`source: "chat"`, `coachMessageId` = the assistant message id, `promptId`/`mirrorPromptId` from the draft views), `setSuggestions`, and return the two new messages plus the new cards.
- Produces, routes (`requireOwner`, `accountIdFor`): `GET /api/accounts/:id/voice/coach` gives `{ messages: CoachMessageDto[] }`; `POST /api/accounts/:id/voice/coach` body `z.object({ message: z.string().trim().min(1).max(4000), lang: z.enum(["nl","en"]) })` gives the 200 body or 502; a module-level `Set<number>` of accounts in flight answers 429 `{ message: "The coach is still answering." }`.

- [ ] **Step 1: Write the failing tests.** `coachPrompt.test.ts`: `callIdsIn("see el_conv_abc12 and el_conv_abc12, el_x")` gives `["el_conv_abc12"]`; the built user text contains the draft text and the live text of both languages, the history in order, and the review summary; `parseCoachAnswer` cleans em dashes. `runCoach.test.ts` (fake store and ai): the user message is stored even when `ai` returns an error, and the result is 502; a proposal whose `find` exists in the draft but not in live is accepted (validated against the draft) and inserted with `source "chat"` and the assistant message id; a transcript is loaded for an id named in the message and for the latest review's problem ids, never for an id outside the call index; the `ai` call used `model "sonnet"`.
- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/coach/coachPrompt.test.ts server/voice/coach/runCoach.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Bundle check** (Task 4 Step 6). Expected: exit 0.
- [ ] **Step 6: Commit:** `voice-review: prompt coach chat with cards`.

---

### Task 8: Engine draft tests with faked writes (in place) and the CRM relay flag

**Files (engine, `/home/gabriel/automations`, not committed):**
- Create: `src/automations/voice/eleven_draft_fakes.py`
- Modify: `src/automations/voice/voice_prompt_store.py` (add `eleven_draft_text`)
- Modify: `src/automations/voice/phone_call.py` (two hook methods used by `wrap_up`)
- Modify: `src/automations/voice/eleven_browser_call.py` (draft attribute, faked tools, hook overrides)
- Modify: `src/webhooks/eleven_browser_routes.py` (draft flag)
- Create: `tests/voice/test_eleven_draft_test.py`
- Modify: `tests/voice/test_eleven_browser_routes.py` (three new tests)

**Files (CRM, committed):**
- Modify: `server/routes/voiceElevenTestRelay.ts` (`elevenTestSchema` gains `draft: z.boolean().optional()`)
- Modify: `server/routes/voiceElevenTest.ts` (payload gains `draft: parsed.data.draft === true`)
- Modify: `server/routes/voiceElevenTest.test.ts`

**Interfaces:**
- Consumes: Task 2 table `Voice_Prompt_Drafts` (`use_case`, `draft_text`, `updated_at`).
- Produces (engine):
  - `voice_prompt_store.eleven_draft_text(lang: str) -> str | None` (async; no cache; `SELECT draft_text FROM {SCHEMA}."Voice_Prompt_Drafts" WHERE use_case = $1 ORDER BY updated_at DESC LIMIT 1` with `f"{ELEVEN_LAYER}{lang}"`; blank or missing gives None; a DB error is logged as `voice.prompt_store.draft_failed` and gives None).
  - `eleven_draft_fakes.FAKED_TOOLS = frozenset({"book_appointment", "cancel_appointment", "request_callback", "update_call_summary", "transfer_to_human"})` and `fake_write_result(name: str, arguments: dict, lang: str) -> dict`: `book_appointment` gives `{"status": "booked", "slot": <real_diary_slots.spoken(start, lang), or the raw start when it does not parse>, "start": <start>}` plus `"kind"` when given; `cancel_appointment` gives `{"status": "cancelled"}`; `request_callback` gives `{"status": "noted", "detail": callback_request._DETAIL.format(when=...)}` with `when` built as in `callback_request` (`ASAP` gives "as soon as possible", else `f"at the moment they asked for ({when})"`); `update_call_summary` gives `{"ok": True}`; `transfer_to_human` gives `{"status": "transferred"}` (decision 3: a realistic success).
  - `PhoneCall._close_out(self) -> None` (async: `await close_out_call(call_id=self.session_id, abandoned=False, adopt_name=not self.fresh_caller)`) and `PhoneCall._schedule_followup(self) -> None` (`after_call_followup.schedule_task(self.session_id)`); `wrap_up` calls these two instead of the inline lines (behaviour unchanged).
  - `BrowserElevenCall.draft: bool = False` (class attribute). When `draft` is true: `tool(name, args)` for a name in `FAKED_TOOLS` opens and closes a tool event (`ev_tool_open` / `ev_tool_close`, as the existing transfer fake does) with the fake result plus `"faked": True` in the event, logs `voice.eleven.draft_fake`, and returns the fake result without `faked`; every other tool (`check_availability`, `search_stock`, `car_details`, `rdw_plate_lookup`) goes through the normal path. `_close_out` only runs `finalize_outcome(call_id=..., abandoned=False)` (no name adoption, no diary line, no client alert); `_schedule_followup` does nothing (no WhatsApp follow-up). When `draft` is false nothing changes, including today's transfer fake.
  - `SessionBody.draft: bool = False`. With `draft` true, `browser_session` (after the persona check, before the busy check and the token) reads `await voice_prompt_store.eleven_draft_text(template_lang(locale))` and answers 409 `"There is no draft to test."` when None; `_open_session` takes `draft_text: str | None`, and after `door.eleven_opening(plan)` sets `opening["conversation_config_override"]["agent"]["prompt"]["prompt"] = eleven_prompt.build(eleven_in, draft_text)`; after `build_call` it sets `call.draft = True`; the response gains `"draft": bool`. The draft test still runs `mark_test_call` and `flag_test_call`, so it carries `test_account_id` and stays out of the weekly review.
- Produces (CRM): body field `draft?: boolean` on `POST /api/voice/eleven-test`, relayed as `draft` (false when absent).

- [ ] **Step 1: Back up every engine file this task touches.** `mkdir -p /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/engine-backup && cd /home/gabriel/automations && cp --parents src/automations/voice/voice_prompt_store.py src/automations/voice/phone_call.py src/automations/voice/eleven_browser_call.py src/webhooks/eleven_browser_routes.py tests/voice/test_eleven_browser_routes.py /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/engine-backup/` Expected: the five files exist under the backup dir with their paths.

- [ ] **Step 2: Write the failing engine tests.** `tests/voice/test_eleven_draft_test.py` (reuse `_call()` from `tests/voice/test_eleven_browser_call.py` as a local helper):
  - `test_draft_fakes_each_write_tool_without_the_real_path`: `call.draft = True`; patch `eleven_call.ElevenCall.tool` with an `AsyncMock`; for each name in `FAKED_TOOLS` the result status is the fake one (`book_appointment` with `{"start": "2026-10-27T10:00"}` gives `status "booked"` and `start "2026-10-27T10:00"`) and the patched real tool was never awaited.
  - `test_draft_lookups_stay_real`: same setup, `check_availability`, `search_stock`, `car_details`, `rdw_plate_lookup` each reach the patched `ElevenCall.tool`.
  - `test_live_browser_test_is_unchanged`: `draft` false, `book_appointment` reaches `ElevenCall.tool`; `transfer_to_human` still answers `status "failed"` with the copy message.
  - `test_draft_close_out_only_finalizes`: patch `eleven_browser_call.finalize_outcome` and `phone_call.close_out_call` with `AsyncMock`, `phone_call.after_call_followup.schedule_task` with `MagicMock`; `await call._close_out()` and `call._schedule_followup()` with `draft = True`: finalize awaited once with `call_id="el_c1", abandoned=False`, `close_out_call` and `schedule_task` not called. With `draft = False`: `close_out_call` awaited with `adopt_name=not call.fresh_caller`, `schedule_task` called with `"el_c1"`.
  - `test_fake_write_result_shapes`: `request_callback` with `{}` gives `status "noted"` and a detail containing "as soon as possible"; `book_appointment` with `{"start": "not a time"}` keeps `slot == "not a time"`.
  In `tests/voice/test_eleven_browser_routes.py` add (using `_session` and an extra `patch.object(browser.voice_prompt_store, "eleven_draft_text", AsyncMock(...))`):
  - `test_draft_session_runs_the_draft_prompt`: draft text `"# Rol\n- Je bent {agent} van {company}.\n" + "- Wees kort.\n" * 20`; body `{"account_id": 53, "line_id": 7, "draft": True}`; 200; `overrides.agent.prompt.prompt` starts with `"# Rol\n- Je bent Frank van Robben Rosmalen."`; `r.json()["draft"] is True`; `eleven_call.calls["conv_1"].draft is True`; `f["mark"]` awaited with `test_account_id=53`; the fake was awaited with `"nl"`.
  - `test_draft_session_without_a_draft_is_409`: fake returns None; 409; `f["token"]` not awaited; no call registered.
  - `test_no_draft_flag_keeps_the_live_prompt`: fake not awaited; `r.json()["draft"] is False`.

- [ ] **Step 3: Run them to see them fail.** `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/voice/test_eleven_draft_test.py tests/voice/test_eleven_browser_routes.py -q` Expected: FAIL (import error or missing attributes).

- [ ] **Step 4: Implement** the engine changes listed in Interfaces. Import style in `eleven_browser_routes.py`: `from src.automations.voice import call_costs, eleven_api, eleven_call, eleven_prompt, voice_engines, voice_prompt_store` and `from src.automations.voice.eleven_template import template_lang`.

- [ ] **Step 5: Run the engine tests.** `cd /home/gabriel/automations && .venv/bin/python -m pytest tests/voice/test_eleven_draft_test.py tests/voice/test_eleven_browser_routes.py tests/voice/test_eleven_browser_call.py tests/voice/test_eleven_call.py tests/voice/test_eleven_prompt.py tests/voice/test_eleven_routes.py tests/voice/test_eleven_engine.py -q` and then every other test file that mentions `wrap_up` or `close_out_call`: `grep -rlE "wrap_up|close_out_call|schedule_task" tests | xargs .venv/bin/python -m pytest -q`. Expected: all pass. If a test fails in code this task did not touch, name it in the report and do not fix it (never use git stash or git checkout in `~/automations`: the live engine runs that working tree).

- [ ] **Step 6: Import check.** `cd /home/gabriel/automations && bash -c 'set -a; source .env; set +a; .venv/bin/python -c "import src.main; print(\"ok\")"'` Expected: `ok`.

- [ ] **Step 7: Wait until no phone call is live, then restart the engine.** Check: `cd /home/gabriel/LeadAwakerApp-wt-voice-review && node --env-file=.env -e 'const pg=require("pg");const p=new pg.Pool({connectionString:process.env.DATABASE_URL});p.query(`select count(*)::int n from "p2mxx34fvbf3ll6"."Voice_Calls" where ended_at is null and started_at > now() - interval $$20 minutes$$`).then(r=>{console.log(r.rows[0].n);return p.end()})'` Expected `0`; if not, check again every 2 minutes (Monitor tool with an until-loop, at most 30 minutes). Then `pm2 restart leadawaker-engine`, wait 15 s (Monitor until `curl -s http://localhost:8100/health` answers), then `pm2 logs leadawaker-engine --lines 40 --nostream` and `curl -s http://localhost:8100/health`. Expected: health has `"status":"ok"` and `"scheduler_running":true`; no `Traceback`, `ImportError` or `Error` lines after the restart.

- [ ] **Step 8: On any failure in Steps 6 or 7, roll back.** `cp -r /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/engine-backup/src /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/engine-backup/tests /home/gabriel/automations/ && rm -f /home/gabriel/automations/src/automations/voice/eleven_draft_fakes.py /home/gabriel/automations/tests/voice/test_eleven_draft_test.py && pm2 restart leadawaker-engine`, confirm health is ok again, and report the failure instead of continuing.

- [ ] **Step 9: CRM relay flag, test first.** Add to `server/routes/voiceElevenTest.test.ts`: `elevenTestSchema` accepts `draft: true`, `draft: false` and no `draft`, rejects `draft: "yes"`. Run `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/routes/voiceElevenTest.test.ts` (FAIL), implement the schema field and the payload field, run again (PASS).

- [ ] **Step 10: Commit the CRM part only:** `git add server/routes/voiceElevenTestRelay.ts server/routes/voiceElevenTest.ts server/routes/voiceElevenTest.test.ts && git commit -m "voice-review: relay the draft flag to the engine's browser test"`. In the task report list the engine files changed in place and the backup location.

---

### Task 9: UI, the draft card (namespace, API hooks, diff, versions, Save to live)

**Files:**
- Create: `client/src/locales/en/voiceCoach.json`, `client/src/locales/nl/voiceCoach.json`, `client/src/locales/pt/voiceCoach.json`
- Modify: `client/src/i18n.ts` (import the three files, add `voiceCoach` to each language's resources and to the `ns` list)
- Create: `client/src/features/accounts/components/workspace/voice/coach/coachApi.ts`
- Create: `client/src/features/accounts/components/workspace/voice/coach/lineDiff.ts` and `lineDiff.test.ts`
- Create: `client/src/features/accounts/components/workspace/voice/coach/DraftDiff.tsx`, `DraftVersions.tsx`, `ElevenDraftCard.tsx`
- Modify: `client/src/features/accounts/components/workspace/voice/SharedPromptCard.tsx` (export `FilledIn`)
- Modify: `client/src/features/accounts/components/workspace/voice/PromptSection.tsx` (the `onEleven && eleven` branch renders `ElevenDraftCard` instead of `SharedPromptCard`)

**Interfaces:**
- Consumes: Task 4 routes; Task 3 DTOs from `@shared/voiceReview`; existing `apiFetch` (`@/lib/apiUtils`), `useAutosave`, `AutosaveBadge`, `PromptCodeEditor`, `PromptCounts`, `VoiceCardShell`, `helpStyle`, `formatDateTime` (`@/features/voiceCalls/format`), `PromptVersion` type (`@/features/prompts/types`).
- Produces, `coachApi.ts` (Tasks 10 and 11 use these; every mutation invalidates the keys it changes):
  - keys: `draftKey(accountId, lang)`, `suggestionsKey(accountId)`, `reviewsKey(accountId)`, `coachKey(accountId)`, all starting with `["/api/accounts", accountId, "voice", ...]`
  - `useElevenDraft(accountId: number, lang: PromptLang)` (query, `staleTime: Infinity`, `refetchOnWindowFocus: false`, as `useAccountVoicePrompts`)
  - `saveElevenDraft(accountId, lang, text): Promise<DraftView | null>` (PUT; updates the query cache with the answer)
  - `useDraftActions(accountId)` gives `{ discard(lang): Promise<boolean>; saveToLive(): Promise<{ ok: boolean; saved: number }> }`
  - `useSuggestions(accountId)`; `useSuggestionActions(accountId)` gives `{ accept(id): Promise<{ ok: true } | { ok: false; reason: string }>; reject(id): Promise<...same> }` (accept invalidates the drafts too)
  - `useReviews(accountId)` (refetch every 5 s while any review is `running`); `runReviewNow(accountId): Promise<{ ok: true } | { ok: false; busy: boolean }>`
  - `useCoachMessages(accountId)`; `sendCoachMessage(accountId, lang, message): Promise<{ ok: true } | { ok: false; status: number }>` (invalidates coach and suggestions)
  - `promptLangOf(locale: string | null): PromptLang` (`nl` when the locale starts with `nl`, else `en`)
- Produces, `lineDiff.ts`: `type DiffLine = { kind: "same" | "add" | "del"; text: string }`; `lineDiff(before: string, after: string): DiffLine[]` (LCS over lines, deletions before additions at a change); `diffCounts(lines: DiffLine[]): { added: number; removed: number }`. No imports.
- Produces, components: `DraftDiff({ before, after })` (unchanged runs longer than 3 lines fold into one "N unchanged lines" row; added lines on `var(--good-tint)` with `var(--good)` text, removed lines struck through in `var(--stage-lost)` on `color-mix(in srgb, var(--stage-lost) 10%, transparent)`, monospace, `white-space: pre-wrap`, `overflow-wrap: anywhere`); `DraftVersions({ promptId, onRestore(text: string) })` (History toggle loads `GET /api/prompts/:id/versions`, rows show `v`, date, label, Restore with an inline confirm; Restore only hands the text back, it never posts a version); `ElevenDraftCard({ accountId, lineId, defaultLang })` using `VoiceCardShell` with `card="promptEleven"`.
- `ElevenDraftCard` behaviour: a `la-seg` NL | EN switch (starts on `defaultLang`); a notice that this prompt is shared by every ElevenLabs line and that edits here go to a draft that calls never hear until Save to live; when `liveMoved`, a warning that live changed since the draft started, with "Start over from live" (discard); a status line ("Same as live" or "+A / -R lines against live"); a view switch Edit | Changes | Filled in (Filled in posts `{ kind: "eleven", accountId, lineId, text }` to `/api/voice-prompts/preview` and renders `FilledIn` with `resolvedSegments`, as `SharedPromptCard` does); the editor (`PromptCodeEditor` keyed by `${promptId}-${lang}-${rev}`) autosaves through `useAutosave(text, view.draftText, (t) => saveElevenDraft(...).then(Boolean))`; when `view.draftText` changes from outside (a card accepted) and the editor text still equals the last server text, adopt it and bump `rev` (the `seen` ref pattern of `AccountTextCard` in `PromptSection.tsx`); actions row: "Save to live" (wine; inline confirm "Calls use it within 30 seconds"; disabled when no draft or the draft equals live) and "Discard draft" (soft; inline confirm); `DraftVersions` whose Restore puts the version text in the editor (autosave then writes the draft); `PromptCounts` with `resolve={{ kind: "eleven", accountId, lineId }}` and `approx`.

- [ ] **Step 1: Write the failing test** `lineDiff.test.ts`: identical texts give only `same`; `lineDiff("a\nb\nc", "a\nx\nc")` equals `[same a, del b, add x, same c]`; `lineDiff("", "a")` equals `[add a]`; `diffCounts` of the second case is `{ added: 1, removed: 1 }`.
- [ ] **Step 2: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test client/src/features/accounts/components/workspace/voice/coach/lineDiff.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `lineDiff.ts`; run the test again: PASS.
- [ ] **Step 4: Implement** the namespace (keys grouped under `draft.*`, `versions.*`, `common.*`; nl and pt fully translated, no em dashes), `coachApi.ts`, the three components, the `FilledIn` export and the `PromptSection` swap (`defaultLang={promptLangOf(line.locale)}`, `lineId={line.number?.id}`).
- [ ] **Step 5: Check the locale files parse and match.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && node -e 'const k=o=>Object.entries(o).flatMap(([a,v])=>typeof v==="object"?k(v).map(x=>a+"."+x):[a]);const [e,n,p]=["en","nl","pt"].map(l=>k(require("./client/src/locales/"+l+"/voiceCoach.json")).sort().join());console.log(e===n&&e===p)'` Expected: `true`. And `grep -c $'\u2014' client/src/locales/*/voiceCoach.json` gives 0 for each.
- [ ] **Step 6: Client build check.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx vite build --outDir /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/vb --emptyOutDir` Expected: "built in", exit 0.
- [ ] **Step 7: Commit:** `voice-review: ElevenLabs prompt draft card with diff, versions and Save to live`.

---

### Task 10: UI, weekly review and change cards

**Files:**
- Create: `client/src/features/accounts/components/workspace/voice/coach/ReviewCard.tsx`, `ReviewReportView.tsx`, `SuggestionCards.tsx`, `SuggestionItem.tsx`, `CallChip.tsx`
- Modify: `client/src/features/accounts/components/workspace/voice/readiness.ts` (`VoiceCard` gains `"promptReview" | "promptCards" | "promptCoach"`, each in `CARD_SECTION` as `"prompt"`)
- Modify: `client/src/features/accounts/components/workspace/voice/PromptSection.tsx` (on an ElevenLabs line, after the greeting card: `ReviewCard`, then `SuggestionCards`, then `ElevenDraftCard`)
- Modify: `client/src/locales/{en,nl,pt}/voiceCoach.json` (keys under `review.*`, `cards.*`)

**Interfaces:**
- Consumes: Task 9 `coachApi.ts` hooks and `DraftDiff`; Task 6 and Task 4 routes; `useOptionalVoiceTest()` from `../test/VoiceTestProvider` (its `openReview(callId)` opens a call's review in the test panel).
- Produces: `CallChip({ callId })` (a small mono button with the last 6 characters of the id, `title` = full id; click calls `useOptionalVoiceTest()?.openReview(callId)`; plain text when there is no provider); `SuggestionItem({ card, accountId, compact?: boolean })` (Task 11 reuses it inline in the coach); `ReviewCard({ accountId })`; `SuggestionCards({ accountId })`.
- `ReviewCard`: header action "Run now" (soft, disabled with a spinner while a review is running; a 409 shows "A review is already running"); a picker of stored reviews (a `select` styled with `inputStyle`, labels `Week 43, 19 to 25 Oct` for weekly and `Last 7 days, run 26 Oct` for manual, dates through `Intl.DateTimeFormat` in the UI language); `ReviewReportView` for the picked one: the one-line summary, a wrapping row of figures (calls, booked share, average reply, p90, cost, minutes; mono labels like `PromptCounts`), the comparison line, problems (title, detail, `CallChip`s), worst calls (chip plus why), knowledge base recommendations, and "N proposals were dropped" when `droppedProposals > 0`; `running` shows a spinner line, `failed` shows the error in `var(--stage-lost)`; no reviews yet shows a one-line empty state.
- `SuggestionCards`: a `la-seg` filter Open (proposed and stale) | Accepted | Done (live and rejected) with counts; empty states per tab. `SuggestionItem`: title, pills for language, source (`Review` or `Coach`) and status, the reason, the edit as `DraftDiff` of `find` to `replace`, a fold "Also in English/Dutch" with the mirror edit, `CallChip`s, and Accept (wine) / Reject (soft) for `proposed`; `stale` shows "The text this card changes is no longer in the draft" and only Reject; an accept answering 409 shows the same sentence.

- [ ] **Step 1: Implement** the components, the readiness types and the `PromptSection` order, with the new keys in all three locale files.
- [ ] **Step 2: Locale parity and em dash check** (Task 9 Step 5 commands). Expected: `true` and 0.
- [ ] **Step 3: Readiness test still passes and the build works.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && ls client/src/features/accounts/components/workspace/voice/*.test.ts | xargs npx tsx --test` Expected: PASS. Then the Task 9 Step 6 build. Expected: exit 0.
- [ ] **Step 4: Commit:** `voice-review: weekly review report and change cards in the Voice tab`.

---

### Task 11: UI, the coach panel and the Test draft button

**Files:**
- Create: `client/src/features/accounts/components/workspace/voice/coach/CoachPanel.tsx`
- Modify: `client/src/features/accounts/components/workspace/voice/PromptSection.tsx` (render `CoachPanel` after `ElevenDraftCard` on ElevenLabs lines)
- Modify: `client/src/features/accounts/components/workspace/voice/useElevenTestCall.ts` (`start(opts?: { draft?: boolean })` sends `{ accountId, lineId, draft: opts?.draft === true }`)
- Modify: `client/src/features/accounts/components/workspace/voice/test/VoiceTestProvider.tsx` (`start(opts?: { draft?: boolean })` on `VoiceTestValue`; new `callDraft: boolean` state set at start, true only for an ElevenLabs draft test; exposed on the value)
- Modify: `client/src/features/accounts/components/workspace/voice/test/TestPanelHead.tsx` (the Test draft button and note)
- Modify: `client/src/features/accounts/components/workspace/voice/test/LiveCallView.tsx` (a "Draft" pill while `callDraft`)
- Modify: `client/src/locales/{en,nl,pt}/voiceCoach.json` (keys under `coach.*`, `testDraft.*`)

**Interfaces:**
- Consumes: Task 9 `useCoachMessages`, `sendCoachMessage`, `useElevenDraft`, `promptLangOf`; Task 10 `SuggestionItem`; Task 7 and Task 8 routes.
- Produces: `CoachPanel({ accountId, lang })` with `VoiceCardShell card="promptCoach"`: the thread (user messages right on `var(--wine)` tint, assistant left on `neu-inset-crisp`, `white-space: pre-wrap`), each assistant message followed by its cards as `SuggestionItem compact` (looked up in `useSuggestions` by `suggestionIds`), a scroll box at most 520px tall that keeps the newest message in view, a `textarea` (Enter sends, Shift+Enter is a new line, max 4000) and a Send button; while waiting a "Thinking" row with a spinner and the input disabled; 429 and 502 show their sentence; a one-line help under the title that the coach proposes cards and never edits the prompt.
- Test draft: in `TestPanelHead`, when `engine === "elevenlabs"` and `useElevenDraft(line.accountId, promptLangOf(line.locale)).data?.hasDraft`, a second full-width soft button "Test draft" under the main one, calling `test.start({ draft: true })`, hidden during a call, and a note: in a draft test bookings, messages, caller details and transfers are faked; free times, caller memory and car lookups are real. `VoiceTestProvider.start` passes `opts` to `eleven.start(opts)` only on the ElevenLabs engine (it still flushes autosaves first, so the draft's last keystrokes are saved before the call).

- [ ] **Step 1: Implement** the panel, the start option through hook and provider, the button, the pill and the copy.
- [ ] **Step 2: Existing voice tests still pass.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && ls client/src/features/accounts/components/workspace/voice/*.test.ts client/src/features/accounts/components/workspace/voice/test/*.test.ts | xargs npx tsx --test` Expected: PASS.
- [ ] **Step 3: Locale checks** (Task 9 Step 5) and **build** (Task 9 Step 6). Expected: `true`, 0, exit 0.
- [ ] **Step 4: Commit:** `voice-review: prompt coach panel and Test draft button`.

---

### Task 12: Full verification

**Files:** none created; fixes only if a check fails (each fix in the task that owns the file, committed with `voice-review: fix ...`).

- [ ] **Step 1: All new and existing voice tests (CRM).** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --test server/voice/promptRules.test.ts server/voice/review/*.test.ts server/voice/coach/*.test.ts server/routes/voicePromptDraftsSchemas.test.ts server/routes/voiceElevenTest.test.ts server/storage/voiceCallReview.test.ts server/routes/voiceCallReviewView.test.ts server/routes/voiceCallsAccess.test.ts server/storage/voiceCallersLogic.test.ts server/storage/voiceLineEngine.test.ts client/src/features/accounts/components/workspace/voice/*.test.ts client/src/features/accounts/components/workspace/voice/test/*.test.ts client/src/features/accounts/components/workspace/voice/coach/*.test.ts` Expected: every test passes, 0 failures.
- [ ] **Step 2: Engine tests.** The Task 8 Step 5 commands. Expected: pass. `curl -s http://localhost:8100/health` shows `"status":"ok"`.
- [ ] **Step 3: Server bundle check** (Task 4 Step 6) and **client build** (Task 9 Step 6). Expected: both exit 0.
- [ ] **Step 4: No em dashes in anything this branch added.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && git diff --name-only main...HEAD | grep -v '^docs/' | xargs grep -ln $'\u2014'` Expected: no output (the spec file itself is not in the branch diff). Also `grep -ln $'\u2014' /home/gabriel/automations/src/automations/voice/eleven_draft_fakes.py /home/gabriel/automations/tests/voice/test_eleven_draft_test.py` gives no output.
- [ ] **Step 5: File sizes.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && git diff --name-only main...HEAD | grep -E "\.(ts|tsx)$" | xargs wc -l | sort -n | tail -5` Expected: no file this branch created above 500 lines (`shared/schema.ts` and `server/storage.ts` excepted).
- [ ] **Step 6: Read-only end-to-end data check.** `cd /home/gabriel/LeadAwakerApp-wt-voice-review && npx tsx --env-file=.env -e '(async () => { const { dueWeek } = await import("./server/voice/review/weekWindow.ts"); const { storage } = await import("./server/storage"); const w = dueWeek(new Date()); console.log(w.weekKey, await storage.accountsWithElevenCalls(w.periodStart, w.periodEnd)); process.exit(0) })()'` Expected: a week key and an account list (53 when that week had ElevenLabs phone calls). Do not start a real review here (it costs an opus run and writes rows); Gabriel runs "Run now" himself.
- [ ] **Step 7: Report** the commit list (`git log --oneline main..HEAD`), the engine files changed in place with the backup path, and anything that failed and was fixed. Commit, merge and push are the orchestrator's.

---

## Self-review notes

- Spec coverage: rules doc (Task 1); weekly review with Run now, idempotent per week, excluded browser tests, stats, problems, worst calls, comparison, opus (Tasks 3, 5, 6, 10); cards with find/replace, mirror, reason, evidence, statuses, reject memory, stale (Tasks 3, 4, 10); draft store, diff, Save to live with forced snapshot and card `live`, rollback through the draft (Tasks 3, 4, 9); Test draft with faked writes, lookups real, live test unchanged, excluded from reviews (Task 8, 11); coach with history, proposals as cards, never editing (Tasks 7, 11); shared-prompt notice (Task 9); scheduler hourly in the job runner (Task 6); additive tables script (Task 2). Deferred by the spec: per-call prompt version (decision 7), knowledge base cards (plain recommendations instead).
- Not done on purpose: updating `~/.claude/skills/voice-call-analyst` and `voice-prompt-repair` to point at the rules document (outside this repo; a one-line follow-up for Gabriel).
