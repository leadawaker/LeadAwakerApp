# Client Phone Instructions and Scoped Change Cards Implementation Plan (round 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each account gets its own ElevenLabs phone instructions (a client prompt row with draft, Test draft and Save to live); every change card says where it belongs (All clients, Only this client, Knowledge, Setting) and the review and coach choose; knowledge and whitelisted setting cards apply on Accept with Undo; the unused "extra instructions" field is removed; and the review can start at the last Save to live.

**Architecture:** The client text is one `Prompt_Library` row per account (`use_case = 'eleven_client_<accountId>'`), so the existing draft table, `Prompt_Versions`, find/replace cards and Save to live carry it; the engine appends it to the built prompt by code (before `# Guardrails`), never through a template mark. Cards gain a `scope` and per-scope columns on `Voice_Prompt_Suggestions`; a knowledge or setting card stores on itself what its Undo needs. Every decision that can be pure (scoped validation, staleness, client append, setting values, undo checks) lives in tested modules under `server/voice/review/`; storage and routes stay thin.

**Tech Stack:** TypeScript, Express, Drizzle (Postgres schema `p2mxx34fvbf3ll6`), React + TanStack Query + react-i18next, node:test via `npx tsx --test`; Python 3.13, FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-10-26-client-phone-instructions-design.md`, its "Scope: round 1" section first (builds on `docs/superpowers/specs/2026-10-25-voice-call-review-and-prompt-coach-design.md`; the previous plan `docs/superpowers/plans/2026-10-25-voice-call-review-and-prompt-coach.md` shows the conventions reused here). Out of this round: the knowledge history table and History/Restore UI (decision 6 except the card Undo), goal 7 (the review told what changed) and goal 8 (the reach count). Where the spec contradicts itself, Goal 5 and "Gabriel's" decisions win: extra instructions are removed for GPT Live too (the non-goal line "Their extra instructions field stays" and "My call" 3 predate that).

## Global Constraints

- CRM work happens only in the worktree `/home/gabriel/LeadAwakerApp-wt-client-instructions` (branch `feat/client-instructions`). Before Task 1 the orchestrator runs: `git -C /home/gabriel/LeadAwakerApp worktree add -b feat/client-instructions /home/gabriel/LeadAwakerApp-wt-client-instructions main && ln -s /home/gabriel/LeadAwakerApp/node_modules /home/gabriel/LeadAwakerApp-wt-client-instructions/node_modules && ln -s /home/gabriel/LeadAwakerApp/.env /home/gabriel/LeadAwakerApp-wt-client-instructions/.env`. The shell's cwd resets: prefix every CRM command with `cd /home/gabriel/LeadAwakerApp-wt-client-instructions &&` (the rules loader reads a path relative to cwd).
- Never run `tsc` (`npx tsc --noEmit`). Never `npm run dev` or `npm run build`. Never `pm2 restart leadawaker` (pm2 runs the main checkout, live).
- Verification is only: node:test via `npx tsx --test <files>`; pytest via `.venv/bin/python -m pytest -q <files>` in `/home/gabriel/automations`; "the bundle check" `npx esbuild server/index.ts --bundle --platform=node --packages=external --format=esm --outfile=/tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/srv.mjs --log-level=warning` (exit 0, no output); "the client build" `npx vite build --outDir /tmp/claude-1000/-home-gabriel/946cf31b-b243-416c-b220-c5114cc4e727/scratchpad/vbuild --emptyOutDir` (exit 0, "built in").
- Em dash checks use the byte form so no command carries the character: `EMDASH="$(printf '\342\200\224')"`.
- Pure modules never import `../db` at top level and use `import type` for `@shared/*` and storage types (as `server/voice/review/*.ts` do today).
- Every user-facing string goes through i18n in `en`, `nl` and `pt` (Brazilian Portuguese), voice strings in namespace `voiceCoach`. After any locale edit run "the locale check": `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && for ns in voiceCoach voiceTab; do node -e 'const k=o=>Object.entries(o).flatMap(([a,v])=>v&&typeof v==="object"?k(v).map(x=>a+"."+x):[a]);const ns=process.argv[1];const [e,n,p]=["en","nl","pt"].map(l=>k(require("./client/src/locales/"+l+"/"+ns+".json")).sort().join());console.log(ns,e===n&&e===p)' $ns; done; EMDASH="$(printf '\342\200\224')"; grep -c "$EMDASH" client/src/locales/*/voiceCoach.json` Expected: two `true` lines and `0` for each voiceCoach file.
- No em dashes anywhere this plan adds: code, comments, copy, prompts, the rules document, locale files, engine files. Tokens only in UI (`var(--ink)`, `var(--mute)`, `var(--wine)`, `var(--good)`, `var(--warn)`, `var(--stage-lost)`, `var(--r-card)`, `var(--r-button)`, `la-btn la-btn--wine|--soft`, `neu-inset-crisp`, `la-seg`); never `transition-all`; inline confirm rows, no dialogs. One column at 390px, buttons wrap, touch targets at least 36px tall.
- Files under 500 lines (new and touched ones; `shared/schema.ts`, `server/storage.ts` and the already-larger `server/storage/voiceLines.ts` excepted). Match the surrounding comment density.
- Owner only (`requireOwner` + `accountIdFor`) for every review, coach, draft, card and client-instruction route.
- New columns: additive SQL in `script/create-client-instructions-columns.mjs` (pattern: `script/create-voice-review-tables.mjs`) plus hand-edited Drizzle declarations in `shared/schema.ts`. No NocoDB, no `db:push`. Relaxing a NOT NULL on a column only these features write counts as additive.
- Nothing reaches the live shared prompt (`Prompt_Library` 130 `eleven_layer_nl`, 131 `eleven_layer_en`) or an account's live client row except `saveElevenDraftsToLive`. Knowledge cards and whitelisted setting cards write live on Accept and always keep on the card what Undo needs. No AI path writes anything but cards.
- The account id is always a parameter; never hardcode 53 outside tests and smoke commands.
- Engine (`/home/gabriel/automations`, branch `feature/dbr-scoping-mode`): edit in place. The working tree already has someone's uncommitted changes (`line_purpose.py`, `tests/voice/test_eleven_preview.py`, `tests/voice/test_line_engine.py` on 2026-10-26): before editing run `git status --short`; if a file your task must edit is already modified, stop and report. Never `git add -A`, `git stash` or `git checkout` there; commit only the files your task names, message prefix `voice:`, ending with the Co-Authored-By line. After engine edits `./preflight.sh` must print PASS. Restart the engine only in Task 12, and only with no live call.
- CRM commits: one per task in the worktree, prefix `client-instructions:`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push or merge.

## Review Focus

1. An account's client text or draft leaking into another account: account 53's rules must never reach a call, preview, Test draft or Save to live of another account (engine cache keyed per `use_case`; CRM save and discard touch only the requesting account's client row). Tests: Task 4 `test_for_call_reads_only_this_accounts_rules`; Task 7 `planSaveToLive` with only the requested client row and the smoke (account 60 view unaffected).
2. An empty client text: no row, an empty live row, and a client draft cleared to "" (a real draft meaning "no rules") must all give a prompt with no client section; a Test draft with only an empty client draft is allowed and runs without rules. Tests: Task 4 `test_blank_rules_add_nothing`, `test_client_draft_text_keeps_an_empty_draft`; Task 5 `test_empty_client_draft_runs_without_rules`.
3. Undo after the target changed since Accept (the entry edited by hand, retitled or deleted; the setting changed in the Voice tab): Undo answers `changed_since` and only overwrites with `force`; a deleted entry answers `entry_gone` and nothing is written. Tests: Task 3 `knowledgeUndo` and `settingUndo` cases; Task 8 rolled-back knowledge smoke.
4. A model proposal that cannot be applied: a knowledge edit of the stock entry or an unknown id, a setting value `VoiceLinePatch` would refuse (`afterHours: "sometimes"`, 51 pronunciation rows), a client edit containing `{marks}`, a setting already at that value. Dropped and counted in `droppedProposals`, never failing the run, never more than 5 cards in total. Tests: Task 3 `validateScoped`; Task 9 `runReview` mixed-kinds test.
5. A card made against a value that moved before Accept (setting changed, entry content edited, client draft edited): it goes `stale` on the next list and Accept answers 409 `stale` without writing; when the value comes back it is `proposed` again. Tests: Task 3 `judgeTransitions` cases; Task 8 accept re-runs the same judge.

---

### Task 1: Card columns and Drizzle declarations

**Files:**
- Create: `script/create-client-instructions-columns.mjs`
- Modify: `shared/schema.ts` (`voicePromptSuggestions` in the `// ─── Voice review and prompt coach ───` section)

**Interfaces:**
- Produces (SQL on `"Voice_Prompt_Suggestions"`): `ADD COLUMN IF NOT EXISTS` `scope text NOT NULL DEFAULT 'shared'` (`shared|client|knowledge|setting`), `edit_op text NOT NULL DEFAULT 'replace'` (`replace|add`), `kb_id integer` (the entry edited, or the entry an add card created), `kb_title text` (the entry's title when proposed, or the new title), `kb_category text` (add: the new entry's category), `kb_prev_title text`, `kb_prev_content text` (edit: the entry as it was right before Accept, for Undo), `setting_key text`, `setting_old jsonb` (the value the card was made against; also what Undo writes back), `setting_new jsonb`; `ALTER COLUMN prompts_id DROP NOT NULL`, `ALTER COLUMN language DROP NOT NULL`. 31 columns in all.
- Produces (Drizzle): fields `scope`, `editOp`, `kbId`, `kbTitle`, `kbCategory`, `kbPrevTitle`, `kbPrevContent`, `settingKey`, `settingOld` (`jsonb`), `settingNew` (`jsonb`); `promptsId` and `language` lose `.notNull()`; comments in the style of the existing ones.

- [ ] **Step 1: Write the script.** Header: purely additive and idempotent (`ADD COLUMN IF NOT EXISTS`; `DROP NOT NULL` is a no-op once dropped), run line `node --env-file=.env script/create-client-instructions-columns.mjs`; prints the column count of `Voice_Prompt_Suggestions`.
- [ ] **Step 2: Run it twice.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && node --env-file=.env script/create-client-instructions-columns.mjs` Expected both times: `Voice_Prompt_Suggestions: 31 columns`, no error.
- [ ] **Step 3: Add the Drizzle declarations.**
- [ ] **Step 4: Prove they match.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --env-file=.env -e '(async () => { const { db } = await import("./server/db"); const s = await import("./shared/schema"); const r = await db.select().from(s.voicePromptSuggestions).limit(1); console.log(r.length ? r[0].scope : "none"); process.exit(0) })()'` Expected: `shared` or `none`; no "column does not exist".
- [ ] **Step 5: Commit** both files: `client-instructions: scope columns on change cards`.

---

### Task 2: Shared types, setting values and the client append (pure)

**Files:**
- Modify: `shared/voiceReview.ts`
- Create: `shared/voiceSettings.ts`, `shared/knowledgeBase.ts`
- Create: `server/voice/voiceLineFields.ts`
- Modify: `server/routes/voice-line.ts` (`putBodySchema` uses the field schemas), `server/storage/voiceLines.ts` (`AFTER_HOURS` re-exported from `@shared/voiceSettings`)
- Modify: `client/src/features/accounts/components/workspace/knowledge/useKnowledgeBase.ts` (`KB_CATEGORIES` re-exported from `@shared/knowledgeBase`)
- Create: `server/voice/review/settingCards.ts`, `server/voice/review/clientRules.ts`
- Test: `server/voice/review/settingCards.test.ts`, `server/voice/review/clientRules.test.ts`

**Interfaces:**
- Produces, `shared/voiceReview.ts` (additions; existing names unchanged):

```ts
export type CardScope = "shared" | "client" | "knowledge" | "setting";
export type CardOp = "replace" | "add";
export type SuggestionStatus = "proposed" | "accepted" | "rejected" | "stale" | "live" | "undone" | "done";
export const CLIENT_USE_CASE_PREFIX = "eleven_client_";
export const clientUseCase = (accountId: number) => `${CLIENT_USE_CASE_PREFIX}${accountId}`;
export const CLIENT_TEXT_SOFT_MAX = 3000;   // the UI counter warns above it; saving still works
export const CLIENT_TEXT_MAX = 20_000;      // the draft route refuses more
// ProposalInput: `language` becomes PromptLang | null (null for client, knowledge and setting), plus optional
//   scope?: CardScope (absent = "shared"); op?: CardOp; kbId?: number | null; kbTitle?: string | null;
//   kbCategory?: string | null; settingKey?: string | null; settingValue?: string | null
// SuggestionDto: promptId and language become nullable, plus
//   scope: CardScope; op: CardOp; kbId: number | null; kbTitle: string | null; kbCategory: string | null;
//   settingKey: string | null; settingOld: unknown; settingNew: unknown; settingApplies: boolean
export interface ClientDraftView { accountId: number; accountName: string; promptId: number | null; useCase: string;
  liveText: string; liveUpdatedAt: string | null; draftText: string; hasDraft: boolean; liveMoved: boolean;
  acceptedIds: number[]; updatedAt: string | null }
```

- Produces, `shared/voiceSettings.ts`: `AFTER_HOURS = ["message", "callback", "ringHot"] as const`; `SETTING_CARD_KEYS = ["greeting", "intake", "pronunciation", "afterHours", "screening"] as const`; `type SettingCardKey`; `isSettingCardKey(k: unknown): k is SettingCardKey`; `interface SettingValues { greeting: string; intake: string; pronunciation: { word: string; sayAs: string }[]; afterHours: (typeof AFTER_HOURS)[number] | null; screening: { sales: boolean; robocalls: boolean; abuse: boolean } }`. Settings outside the list (hours, transfer number, voice, live switch, follow-up, number) are note cards only.
- Produces, `shared/knowledgeBase.ts`: `KB_CATEGORIES` (moved verbatim from `useKnowledgeBase.ts`: pricing, services, faq, objections, team, hours, location, policies, testimonials; the panel shows only these), `KB_DEFAULT_CATEGORY = "faq"`, `KB_STOCK_PREFIX = "Current stock"`.
- Produces, `server/voice/voiceLineFields.ts` (zod only, no db): `greetingField = z.string().max(500)`, `intakeField = z.string().max(5000)`, `pronunciationField = z.array(z.object({ word: z.string().max(80), sayAs: z.string().max(120) })).max(50)`, `afterHoursField = z.enum(AFTER_HOURS).nullable()`, `screeningPatchField` (today's partial strict object), `settingCardSchemas: Record<SettingCardKey, z.ZodTypeAny>` (the four plus a full strict `{ sales, robocalls, abuse }` booleans object for `screening`). `putBodySchema` uses each with `.optional()`, so the Voice tab and setting cards validate with the same rules.
- Produces, `server/voice/review/settingCards.ts`:
  - `settingsOf(line: { greeting: string | null; intake: string | null; pronunciation: { word: string; sayAs: string }[] | null; afterHours: SettingValues["afterHours"]; screening: SettingValues["screening"] }): SettingValues` (nulls become `""` / `[]`, intake through `normalizeIntake`)
  - `parseSettingValue(key: SettingCardKey, raw: string): { ok: true; value: unknown } | { ok: false }` (greeting and intake take `raw` as plain text; pronunciation, afterHours and screening `JSON.parse` it; then `settingCardSchemas[key]`; intake normalized)
  - `sameSetting(key: SettingCardKey, a: unknown, b: unknown): boolean` (canonical JSON with sorted object keys; intake compared after `normalizeIntake`)
  - `settingText(value: unknown): string` (strings as is, everything else `JSON.stringify`): what goes in `replace_text` and the prompts.
- Produces, `server/voice/review/clientRules.ts`:
  - `interface ClientRowState { promptId: number | null; liveText: string; draft: { draftText: string; baseText: string; acceptedIds: number[] } | null }`
  - `clientTextOf(s: ClientRowState): string` (`draft?.draftText ?? liveText`)
  - `appendRule(text: string, rule: string): string` (`text.trimEnd()`, then `"\n"` only when that is non-empty, then `rule.trim()`)
  - `planClientAccept(card: { id: number; op: CardOp; find: string; replace: string }, s: ClientRowState): { ok: true; draftText: string; baseText: string; acceptedIds: number[] } | { ok: false; reason: "not_found" | "ambiguous" | "no_change" }` (replace: `applyEdit` on `clientTextOf`; add: `appendRule`, `no_change` when the trimmed rule already occurs; `baseText` keeps the draft's or starts from `liveText`; `acceptedIds` gets `card.id` once)

- [ ] **Step 1: Write the failing tests.** Key assertions:

```ts
// settingCards.test.ts
assert.deepEqual(parseSettingValue("greeting", "Goedemiddag, met Frank."), { ok: true, value: "Goedemiddag, met Frank." });
assert.deepEqual(parseSettingValue("afterHours", "\"callback\""), { ok: true, value: "callback" });
assert.deepEqual(parseSettingValue("afterHours", "\"sometimes\""), { ok: false });
assert.deepEqual(parseSettingValue("afterHours", "null"), { ok: true, value: null });
assert.deepEqual(parseSettingValue("screening", "{\"sales\":true,\"robocalls\":true}"), { ok: false }); // full object required
assert.deepEqual(parseSettingValue("pronunciation", JSON.stringify(Array(51).fill({ word: "a", sayAs: "b" }))), { ok: false });
assert.deepEqual(parseSettingValue("pronunciation", "not json"), { ok: false });
assert.deepEqual(parseSettingValue("intake", " Kenteken \n\n Kilometerstand "), { ok: true, value: "Kenteken\nKilometerstand" });
assert.equal(sameSetting("screening", { sales: true, robocalls: false, abuse: true }, { abuse: true, robocalls: false, sales: true }), true);
assert.equal(sameSetting("intake", "a\n\nb ", "a\nb"), true);
assert.deepEqual(settingsOf({ greeting: null, intake: null, pronunciation: null, afterHours: null, screening: { sales: false, robocalls: true, abuse: true } }).pronunciation, []);
assert.equal(settingText("hi"), "hi"); assert.equal(settingText({ a: 1 }), "{\"a\":1}");

// clientRules.test.ts
assert.equal(appendRule("", "- Vraag eerst het kenteken. "), "- Vraag eerst het kenteken.");
assert.equal(appendRule("- A.\n\n", "- B."), "- A.\n- B.");
const s = { promptId: 900, liveText: "- A.", draft: null };
assert.deepEqual(planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, s), { ok: true, draftText: "- A.\n- B.", baseText: "- A.", acceptedIds: [4] });
assert.deepEqual(planClientAccept({ id: 4, op: "add", find: "", replace: "- A." }, s), { ok: false, reason: "no_change" });
assert.deepEqual(planClientAccept({ id: 5, op: "replace", find: "A", replace: "C" }, { ...s, draft: { draftText: "- A. A", baseText: "- A.", acceptedIds: [4] } }), { ok: false, reason: "ambiguous" });
assert.deepEqual(planClientAccept({ id: 4, op: "add", find: "", replace: "- B." }, { promptId: null, liveText: "", draft: null }), { ok: true, draftText: "- B.", baseText: "", acceptedIds: [4] });
```

- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/voice/review/settingCards.test.ts server/voice/review/clientRules.test.ts` Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the shared files, `voiceLineFields.ts` and the two modules; switch `putBodySchema`, `AFTER_HOURS` and `KB_CATEGORIES` to the shared sources (behaviour unchanged).
- [ ] **Step 4: Run them again,** plus `npx tsx --test server/voice/review/*.test.ts server/voice/coach/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Bundle check.** Expected: exit 0.
- [ ] **Step 6: Commit:** `client-instructions: shared card types, setting values and the client rule append`.

---

### Task 3: Scoped validation, staleness and undo checks (pure)

**Files:**
- Create: `server/voice/review/scopedProposals.ts`, `server/voice/review/cardJudge.ts`
- Test: `server/voice/review/scopedProposals.test.ts`, `server/voice/review/cardJudge.test.ts`

**Interfaces:**
- Consumes: Task 2; `applyEdit`, `newMarks`, `validateProposal`, `ProposalProblem` from `promptEdits.ts`; `isStale`, `DraftRowState` from `draftPlans.ts`.
- Produces, `scopedProposals.ts`:

```ts
export interface KnowledgeFact { id: number; title: string; content: string; category: string }
export interface ScopedFields { scope: CardScope; op: CardOp; kbId: number | null; kbTitle: string | null; kbCategory: string | null;
  settingKey: string | null; settingOld: unknown; settingNew: unknown }
export const SHARED_FIELDS: ScopedFields; // shared, replace, every other field null
export interface ProposalContext { shared: Partial<Record<PromptLang, string>>; client: string; knowledge: KnowledgeFact[]; settings: SettingValues | null }
export type ScopedProblem = ProposalProblem | "bad_scope" | "kb_unknown" | "kb_stock" | "setting_invalid";
export function validateScoped(p: ProposalInput, ctx: ProposalContext, rejected: { find: string; replace: string }[]):
  { ok: true; fields: ScopedFields } | { ok: false; reason: ScopedProblem };
```

  Rules, in order: empty title gives `empty`; whitespace-collapsed `find`+`replace` equal to a rejected pair gives `rejected_before` (all scopes). Then per `p.scope ?? "shared"`:
  - `shared`: `op` must be `replace` and `language` set (else `bad_scope`); then `validateProposal(p, ctx.shared, rejected)`; fields `SHARED_FIELDS`.
  - `client`: any template mark in `replace` (`newMarks(replace, "")` non-empty) gives `new_mark` (the client text is inserted raw, never rendered); `replace` over 3000 characters gives `too_long`. `replace` op: `find` non-empty, `applyEdit(ctx.client, find, replace)`. `add` op: `find` must be `""`, `replace` non-empty (`empty`), already in the text gives `no_change`.
  - `knowledge`: `replace` op: `kbId` must be an id in `ctx.knowledge` (`kb_unknown`; the stock entry is never in that list), then `applyEdit` on its content; `kbTitle` = that entry's title. `add` op: `kbTitle` and `replace` non-empty (`empty`), a title starting with `KB_STOCK_PREFIX` gives `kb_stock`; `kbCategory` kept when it is in `KB_CATEGORIES` and among `ctx.knowledge`'s categories, else `KB_DEFAULT_CATEGORY`.
  - `setting`: empty `settingKey` gives `empty`. A key in `SETTING_CARD_KEYS`: `ctx.settings` null or `parseSettingValue` failing gives `setting_invalid`; `sameSetting(new, current)` gives `no_change`; fields `settingOld = current`, `settingNew = parsed`. Any other key: a note card, `settingOld: null`, `settingNew: settingValue ?? ""`.
  - `language` is stored null for every scope but `shared`.
- Produces, `cardJudge.ts` (covers all scopes; Task 8 deletes `staleTransitions` from `draftPlans.ts`):

```ts
export type StaleNote = "find_text_gone" | "entry_gone" | "setting_changed";
export interface JudgedCard { id: number; scope: CardScope; op: CardOp; promptId: number | null; find: string; replace: string;
  mirrorPromptId: number | null; mirrorFind: string | null; mirrorReplace: string | null; kbId: number | null;
  settingKey: string | null; settingOld: unknown; status: string; statusNote: string | null }
export interface JudgeContext { shared: DraftRowState[]; client: string | null; knowledge: Map<number, string> | null; settings: SettingValues | null }
export function staleReason(card: JudgedCard, ctx: JudgeContext): StaleNote | null;
export function judgeTransitions(cards: JudgedCard[], ctx: JudgeContext): { toStale: { id: number; note: StaleNote }[]; toProposed: number[] };
export function knowledgeUndo(card: { op: CardOp; find: string; replace: string; kbTitle: string | null; kbPrevTitle: string | null; kbPrevContent: string | null },
  current: { title: string; content: string } | null): { action: "restore" | "delete" | "nothing" | "gone"; changedSince: boolean };
export function settingUndo(key: SettingCardKey, current: unknown, cardNew: unknown): { changedSince: boolean };
```

  `staleReason`: a context part that is null (or an empty `shared` list) is not judged (null). shared: `isStale` gives `find_text_gone`. client `replace`: `applyEdit(ctx.client, ...)` fails gives `find_text_gone`. knowledge `replace`: id missing gives `entry_gone`, edit fails gives `find_text_gone`. setting with a whitelisted key: `!sameSetting(current, settingOld)` gives `setting_changed`. Every `add` card and every note card is never stale. `judgeTransitions`: `proposed` with a reason goes stale with that note; `stale` with one of the three notes whose reason is now null goes back to proposed. `knowledgeUndo` replace: `current` null gives `{ gone, true }`; `kbPrevContent` null gives `{ nothing, false }`; else `changedSince = current.title !== kbPrevTitle || current.content !== applyEdit(kbPrevContent, find, replace).text` (a failed re-apply counts as changed) and action `restore`. add: `current` null gives `{ nothing, false }`; else `changedSince = current.title !== kbTitle || current.content !== replace` and action `delete`.

- [ ] **Step 1: Write the failing tests.** Key assertions (each its own `test`):

```ts
// scopedProposals.test.ts
const ctx = { shared: { nl: "- Zeg nooit X.", en: "- Never say X." }, client: "- Vraag het kenteken.",
  knowledge: [{ id: 12, title: "Inruil", content: "Wij nemen elke auto in.", category: "services" }],
  settings: { greeting: "Hoi", intake: "", pronunciation: [], afterHours: "message", screening: { sales: true, robocalls: true, abuse: true } } };
const base = { language: null, title: "t", reason: "r", find: "", replace: "", mirrorFind: null, mirrorReplace: null, callIds: [] };
assert.deepEqual(validateScoped({ ...base, language: "nl", find: "- Zeg nooit X.", replace: "- Als X, dan Y." }, ctx, []), { ok: true, fields: SHARED_FIELDS });
assert.equal(validateScoped({ ...base, scope: "client", op: "add", replace: "- Noem nooit een levertijd." }, ctx, []).ok, true);
assert.deepEqual(validateScoped({ ...base, scope: "client", op: "add", replace: "- Zeg {agent}." }, ctx, []), { ok: false, reason: "new_mark" });
assert.deepEqual(validateScoped({ ...base, scope: "client", op: "add", replace: "- Vraag het kenteken." }, ctx, []), { ok: false, reason: "no_change" });
assert.deepEqual(validateScoped({ ...base, scope: "knowledge", op: "replace", kbId: 99, find: "a", replace: "b" }, ctx, []), { ok: false, reason: "kb_unknown" });
const kb = validateScoped({ ...base, scope: "knowledge", op: "replace", kbId: 12, find: "elke auto", replace: "elke auto tot 15 jaar" }, ctx, []);
assert.equal(kb.ok && kb.fields.kbTitle, "Inruil");
assert.deepEqual(validateScoped({ ...base, scope: "knowledge", op: "add", kbTitle: "Current stock, updated every hour", replace: "x" }, ctx, []), { ok: false, reason: "kb_stock" });
const add = validateScoped({ ...base, scope: "knowledge", op: "add", kbTitle: "Garantie", kbCategory: "sales_strategy", replace: "6 maanden." }, ctx, []);
assert.equal(add.ok && add.fields.kbCategory, "faq");
assert.deepEqual(validateScoped({ ...base, scope: "setting", settingKey: "afterHours", settingValue: "\"sometimes\"" }, ctx, []), { ok: false, reason: "setting_invalid" });
assert.deepEqual(validateScoped({ ...base, scope: "setting", settingKey: "afterHours", settingValue: "\"message\"" }, ctx, []), { ok: false, reason: "no_change" });
const set = validateScoped({ ...base, scope: "setting", settingKey: "afterHours", settingValue: "\"callback\"" }, ctx, []);
assert.deepEqual(set.ok && [set.fields.settingOld, set.fields.settingNew], ["message", "callback"]);
const note = validateScoped({ ...base, scope: "setting", settingKey: "hours", settingValue: "Open op zaterdag tot 17:00" }, ctx, []);
assert.deepEqual(note.ok && [note.fields.settingOld, note.fields.settingNew], [null, "Open op zaterdag tot 17:00"]);
assert.deepEqual(validateScoped({ ...base, scope: "shared", op: "add", language: "nl", replace: "x" }, ctx, []), { ok: false, reason: "bad_scope" });

// cardJudge.test.ts: every staleTransitions case of draftPlans.test.ts, rewritten for judgeTransitions as scope "shared" (same expectations), plus
// fixtures: card0 = { id: 1, scope: "shared", op: "replace", every id null, texts "", settingKey null, settingOld null, status "proposed", statusNote null };
// ctx0 = { shared: [], client: null, knowledge: null, settings: null }; settings = ctx.settings above
const settingCard = { ...card0, scope: "setting", settingKey: "afterHours", settingOld: "message" };
assert.equal(staleReason(settingCard, { ...ctx0, settings: { ...settings, afterHours: "callback" } }), "setting_changed");
assert.equal(staleReason({ ...settingCard, settingKey: "hours" }, { ...ctx0, settings }), null);
assert.equal(staleReason({ ...card0, scope: "knowledge", kbId: 12, find: "elke" }, { ...ctx0, knowledge: new Map() }), "entry_gone");
assert.equal(staleReason({ ...card0, scope: "client", op: "add" }, { ...ctx0, client: "" }), null);
assert.deepEqual(judgeTransitions([{ ...settingCard, status: "stale", statusNote: "setting_changed" }], { ...ctx0, settings }), { toStale: [], toProposed: [1] });
const edit = { op: "replace", find: "elke auto", replace: "elke auto tot 15 jaar", kbTitle: "Inruil", kbPrevTitle: "Inruil", kbPrevContent: "Wij nemen elke auto in." };
assert.deepEqual(knowledgeUndo(edit, { title: "Inruil", content: "Wij nemen elke auto tot 15 jaar in." }), { action: "restore", changedSince: false });
assert.deepEqual(knowledgeUndo(edit, { title: "Inruil", content: "hand edited" }), { action: "restore", changedSince: true });
assert.deepEqual(knowledgeUndo(edit, { title: "Inruilen", content: "Wij nemen elke auto tot 15 jaar in." }), { action: "restore", changedSince: true });
assert.deepEqual(knowledgeUndo(edit, null), { action: "gone", changedSince: true });
const made = { op: "add", find: "", replace: "6 maanden.", kbTitle: "Garantie", kbPrevTitle: null, kbPrevContent: null };
assert.deepEqual(knowledgeUndo(made, { title: "Garantie", content: "6 maanden." }), { action: "delete", changedSince: false });
assert.deepEqual(knowledgeUndo(made, null), { action: "nothing", changedSince: false });
assert.deepEqual(settingUndo("afterHours", "message", "callback"), { changedSince: true });
```

- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/voice/review/scopedProposals.test.ts server/voice/review/cardJudge.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the two modules (no db imports). Leave `staleTransitions` and its tests in place (Task 8 removes them once nothing calls it).
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit:** `client-instructions: scoped card validation, staleness and undo checks`.

---

### Task 4: Engine, the client rules section in every ElevenLabs prompt

**Files (engine, `/home/gabriel/automations`):**
- Create: `src/automations/voice/eleven_client_rules.py`
- Modify: `src/automations/voice/voice_prompt_store.py`, `src/automations/voice/eleven_prompt.py`, `src/automations/voice/eleven_prompt_input.py`, `src/webhooks/phone_voice_routes.py` (`eleven_opening` only), `src/automations/voice/eleven_preview.py`, `src/webhooks/voice_prompt_preview_routes.py`
- Test: `tests/voice/test_eleven_client_rules.py`

**Interfaces:**
- Produces:
  - `eleven_client_rules.HEADING = {"nl": "# Afspraken van dit bedrijf", "en": "# This business's own rules"}`, `LEAD = {"nl": "Deze afspraken zijn van dit bedrijf zelf. Ze gaan voor de algemene regels hierboven, maar nooit voor de guardrails.", "en": "These rules are this business's own. They come before the general rules above, but never before the guardrails."}`; `section(rules: str, lang: str) -> str` (`""` when `rules.strip()` is empty, else `f"{HEADING[lang]}\n{LEAD[lang]}\n{rules.strip()}"`); `insert(prompt: str, rules: str, lang: str) -> str` (no section: prompt unchanged; else the section plus `"\n\n"` right before the first line that is exactly `# Guardrails` (regex `(?m)^# Guardrails[ \t]*$`), or `prompt.rstrip() + "\n\n" + section` when there is none). Module docstring: why by code and not by a mark (a shared edit that dropped a mark would switch every client's rules off).
  - `voice_prompt_store.CLIENT_LAYER = "eleven_client_"`; `refresh` also loads `use_case LIKE 'eleven_client_%'` (same DISTINCT ON, same empty-text filter); `eleven_client_text(account_id: int | None) -> str | None` (cache, None for None); `async eleven_client_draft_text(account_id: int) -> str | None` (no cache; `SELECT draft_text FROM Voice_Prompt_Drafts WHERE use_case = $1 ORDER BY updated_at DESC LIMIT 1`; a found row gives its text even when `""` (an emptied client draft means "no rules"); no row gives None; a DB error logs `voice.prompt_store.client_draft_failed` and gives None).
  - `ElevenPromptInput.client_rules: str = ""` (last field); `build` applies `eleven_client_rules.insert(text, p.client_rules, lang)` on all three return paths (template, row, code copy), after the `MIN_CHARS` check so client text never hides a broken row.
  - `eleven_prompt_input.for_call(..., account_id: int | None = None)`: `client_rules = (voice_prompt_store.eleven_client_text(account_id) or "") if account_id else ""`. One text per account, used for the NL and the EN prompt alike.
  - `phone_voice_routes.eleven_opening` passes `account_id=plan.account_id`.
  - `eleven_preview(account_id, line_id, *, now=None, template=None, client_text: str | None = None)`: `for_call(..., account_id=account_id)`, then `dataclasses.replace(p, client_rules=client_text)` when `client_text is not None`. `PreviewBody.client_text: str | None = None`, passed through for `kind == "eleven"`.

- [ ] **Step 1: `git status --short` in `/home/gabriel/automations`.** If a file in this task's list is modified, stop and report.
- [ ] **Step 2: Write the failing tests** in `tests/voice/test_eleven_client_rules.py` (reuse `_robben` and `_for_call` from `tests/voice/test_eleven_prompt.py`; cache via `monkeypatch.setattr(voice_prompt_store, "_cache", {...})`; a fake pool like `_pool_returning` in `tests/voice/test_phone_door.py`):
  - `test_blank_rules_add_nothing`: `insert(P, "", "nl") == P` and `insert(P, " \n ", "nl") == P`.
  - `test_section_sits_right_before_guardrails`: `P = "# Rol\n- a\n\n# Guardrails\n- b\n\n# Tools\n- c"`; `insert(P, "- Vraag eerst het kenteken.\n", "nl") == "# Rol\n- a\n\n# Afspraken van dit bedrijf\n" + LEAD["nl"] + "\n- Vraag eerst het kenteken.\n\n# Guardrails\n- b\n\n# Tools\n- c"`.
  - `test_no_guardrails_heading_appends_at_the_end`: `insert("# Role\n- a\n", "- x", "en") == "# Role\n- a\n\n# This business's own rules\n" + LEAD["en"] + "\n- x"`.
  - `test_braces_in_rules_stay_text`: `"Zeg nooit {agent}." in insert(P, "- Zeg nooit {agent}.", "nl")`.
  - `test_build_puts_client_rules_in_on_every_path`: with `_cache` `{}` (code copy), with `{"eleven_layer_nl": <a valid row from test_eleven_template.py>}`, and with `template=` that row: each `eleven_prompt.build(replace(_robben(), client_rules="- Vraag eerst het kenteken."), ...)` contains the heading at an index below that of `"# Guardrails"`.
  - `test_build_without_client_rules_is_unchanged`: `"# Afspraken van dit bedrijf" not in eleven_prompt.build(_robben())`.
  - `test_for_call_reads_only_this_accounts_rules`: `_cache = {"eleven_client_53": "- Regel 53.", "eleven_client_60": "- Regel 60."}`; `_for_call(account_id=53).client_rules == "- Regel 53."`; `60` gives `"- Regel 60."`; `61` gives `""`; no `account_id` gives `""`.
  - `test_refresh_loads_client_rows`: fake pool `fetch` records the SQL and returns `[{"use_case": "eleven_client_53", "prompt_text": "- x"}]`; after `asyncio.run(voice_prompt_store.refresh(force=True))`: `"eleven_client_" in sql` and `eleven_client_text(53) == "- x"`.
  - `test_client_draft_text_keeps_an_empty_draft`: `fetchval` returning `""` gives `""`; `None` gives None; raising gives None.
- [ ] **Step 3: Run them.** `cd /home/gabriel/automations && .venv/bin/python -m pytest -q tests/voice/test_eleven_client_rules.py` Expected: FAIL (import error).
- [ ] **Step 4: Implement** the Interfaces.
- [ ] **Step 5: Run the ElevenLabs and door suites.** `cd /home/gabriel/automations && .venv/bin/python -m pytest -q tests/voice/test_eleven_client_rules.py tests/voice/test_eleven_prompt.py tests/voice/test_eleven_template.py tests/voice/test_eleven_preview.py tests/voice/test_eleven_browser_routes.py tests/voice/test_eleven_draft_routes.py tests/voice/test_eleven_call.py tests/voice/test_phone_door.py` Expected: all pass (the golden prompt test is unchanged: no client rules, no section). A failure in code this task did not touch: name it in the report, do not fix it.
- [ ] **Step 6: Preflight.** `cd /home/gabriel/automations && ./preflight.sh` Expected: PASS.
- [ ] **Step 7: Commit** only this task's files: `git add src/automations/voice/eleven_client_rules.py src/automations/voice/voice_prompt_store.py src/automations/voice/eleven_prompt.py src/automations/voice/eleven_prompt_input.py src/webhooks/phone_voice_routes.py src/automations/voice/eleven_preview.py src/webhooks/voice_prompt_preview_routes.py tests/voice/test_eleven_client_rules.py && git commit -m "voice: per-account ElevenLabs client rules, placed before the guardrails by code"` (with the Co-Authored-By line).

---

### Task 5: Engine, Test draft with the client draft

**Files (engine):**
- Modify: `src/webhooks/eleven_browser_routes.py`
- Test: `tests/voice/test_eleven_client_draft.py` (new; `tests/voice/test_eleven_draft_routes.py` stays as it is)

**Interfaces:**
- Consumes: Task 4 `voice_prompt_store.eleven_client_draft_text`, `ElevenPromptInput.client_rules`.
- Produces: with `draft: true`, `browser_session` reads `shared = await eleven_draft_text(template_lang(locale))` and `client = await eleven_client_draft_text(body.account_id)`; 409 `"There is no draft to test."` only when both are None. `_open_session(..., draft_text: str | None = None, client_draft: str | None = None)`; `is_draft = draft_text is not None or client_draft is not None` replaces every current `draft_text is not None` test (caller number left off the row, `call.draft`, the log field, the response's `"draft"`); when `is_draft` the prompt override is `eleven_prompt.build(replace(eleven_in, client_rules=client_draft) if client_draft is not None else eleven_in, draft_text)` (no shared draft means the live shared row, as `build` does with `template=None`).

- [ ] **Step 1: `git status --short`** (stop if `eleven_browser_routes.py` is modified by someone else).
- [ ] **Step 2: Write the failing tests** (import `_session`, `KEY`, `_clean` as `test_eleven_draft_routes.py` does; patch both store reads with `AsyncMock`; `_cache` holds a live `eleven_client_53` of `"- Live regel."`):
  - `test_client_draft_alone_runs_a_draft_test`: shared None, client `"- Draft regel."`; 200; the override prompt contains `"- Draft regel."`, not `"- Live regel."`; `r.json()["draft"] is True`; `eleven_call.calls["conv_1"].draft is True`; the client read was awaited with `53`.
  - `test_shared_and_client_drafts_together`: shared `DRAFT` (from `test_eleven_draft_routes.py`), client `"- Draft regel."`: the prompt starts with `"# Rol\n- Je bent Frank van Robben Rosmalen."` and contains `"- Draft regel."`.
  - `test_shared_draft_alone_keeps_the_live_client_rules`: shared `DRAFT`, client None: the prompt contains `"- Live regel."`.
  - `test_empty_client_draft_runs_without_rules`: shared None, client `""`: 200 and `"# Afspraken van dit bedrijf" not in` the prompt.
  - `test_no_drafts_at_all_is_409`: both None: 409, token not awaited.
  - `test_live_test_ignores_both_drafts`: no `draft` flag: neither read awaited; the prompt contains `"- Live regel."`.
- [ ] **Step 3: Run them.** `cd /home/gabriel/automations && .venv/bin/python -m pytest -q tests/voice/test_eleven_client_draft.py` Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** `tests/voice/test_eleven_client_draft.py tests/voice/test_eleven_draft_routes.py tests/voice/test_eleven_draft_test.py tests/voice/test_eleven_browser_routes.py tests/voice/test_eleven_browser_call.py` Expected: all pass. Then `./preflight.sh`: PASS.
- [ ] **Step 6: Commit** `src/webhooks/eleven_browser_routes.py tests/voice/test_eleven_client_draft.py`: `voice: Test draft runs the account's client draft too`.

---

### Task 6: Remove the unused extra instructions field (CRM and engine)

**Files (CRM):**
- Modify: `client/src/features/accounts/components/workspace/voice/PromptSection.tsx` (drop the `promptExtra` card and the `NotebookPen` and `EXTRA_INSTRUCTIONS_MAX` imports), `voiceApi.ts` (drop `extraInstructions` from `VoiceLine` and `VoiceLinePatch`, drop `EXTRA_INSTRUCTIONS_MAX`), `readiness.ts` (drop `"promptExtra"` from `VoiceCard` and `CARD_SECTION`)
- Modify: `server/storage/voiceLines.ts` (type field, the read at ~299, the patch type, the `applyProfile` line ~404), `server/routes/voice-line.ts` (`extraInstructions` in `putBodySchema`)
- Modify: `client/src/locales/{en,nl,pt}/voiceTab.json` (remove the top-level `extra` object and `prompt.extra`; remove the readiness label `extra` only if `grep -rn "extra" client/src/features/accounts/components/workspace/voice` shows no reader of it)

**Files (engine):**
- Modify: `src/automations/voice/client_setup.py` (drop `ClientSetup.extra`, `EXTRA_MAX`, the `extraInstructions` read at ~222), `src/automations/voice/client_setup_slots.py` (drop `_EXTRA` and the `setup.extra` lines ~170)
- Modify: `tests/voice/test_client_setup.py` (replace the three extra-instruction tests), `tests/voice/test_eleven_prompt.py` (delete `test_for_call_leaves_out_the_gpt_live_extra_instructions`: `ClientSetup` no longer takes `extra`)

**Interfaces:**
- Produces: stored `setup.voice.extraInstructions` values (none exist; checked 2026-10-26) stay in the JSON and are ignored. The ElevenLabs template keeps the `extra` mark and flag (`ElevenPromptInput.extra` stays, always `""`), so the live rows' `{?extra}` lines drop out, never showing braces.

- [ ] **Step 1: Engine test first.** In `tests/voice/test_client_setup.py` replace the three tests under `# --- extra instructions` with `test_extra_instructions_are_ignored`: `backend(row(setup=json.dumps({"voice": {"extraInstructions": "No test drives on Sundays."}})))` has neither `"Business-specific notes"` nor `"No test drives"`, and `not hasattr(parse_client_setup(row()), "extra")`. Delete the eleven_prompt test named above. Run `cd /home/gabriel/automations && .venv/bin/python -m pytest -q tests/voice/test_client_setup.py` Expected: FAIL (the field still exists).
- [ ] **Step 2: Engine change.** `grep -rn "\.extra\b\|EXTRA_MAX\|extraInstructions" src` then shows only the template's own `extra` in `eleven_prompt.py`, `eleven_template.py`, `eleven_prompt_input.py`. Run `.venv/bin/python -m pytest -q tests/voice/test_client_setup.py tests/voice/test_eleven_prompt.py tests/voice/test_eleven_template.py` and `grep -rlE "client_setup|render_slots" tests | xargs .venv/bin/python -m pytest -q` Expected: pass. `./preflight.sh`: PASS.
- [ ] **Step 3: Commit the engine part** (`git status --short` first; add only the four files): `voice: drop the unused extra instructions from client setup`.
- [ ] **Step 4: CRM change.** Then `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && grep -rn "extraInstructions\|promptExtra\|EXTRA_INSTRUCTIONS_MAX" server client/src shared` Expected: no output.
- [ ] **Step 5: CRM checks.** `ls client/src/features/accounts/components/workspace/voice/*.test.ts | xargs npx tsx --test` (PASS), the locale check, the bundle check, the client build.
- [ ] **Step 6: Commit the CRM part:** `client-instructions: remove the unused extra instructions field`.

---

### Task 7: Client draft, combined Save to live and Discard, last save (CRM server)

**Files:**
- Create: `server/storage/voiceClientDraft.ts`
- Modify: `server/storage/voicePromptDrafts.ts` (export `inDraftTx`, `loadElevenState`, `LiveSnapshot`; discard and save include the client row; `lastPromptSaveAt`), `server/voice/review/draftPlans.ts` (`DraftRowState.language: PromptLang | null`, null = the client row)
- Modify: `server/routes/voicePromptDrafts.ts`, `server/routes/voicePromptDraftsSchemas.ts`
- Modify: `server/routes/voiceAccountPrompts.ts` (its PUT also refuses a row whose `use_case` starts with `eleven_client_`, same 400 message)
- Modify: `server/routes/voicePrompts.ts` (`previewSchema.clientText: z.string().max(CLIENT_TEXT_MAX).optional()`, relayed as `client_text`)
- Modify: `server/storage.ts` (spread `voiceClientDraftStorage`)
- Test: `server/routes/voicePromptDraftsSchemas.test.ts` (extend), `server/voice/review/draftPlans.test.ts` (one new case)

**Interfaces:**
- Consumes: Task 2 `ClientDraftView`, `clientUseCase`, `CLIENT_TEXT_MAX`; `accountNameOf` from `server/storage/voiceReviews.ts`.
- Produces, `voiceClientDraft.ts`:
  - `clientPromptRow(accountId: number, exec: DbLike = db): Promise<VoicePromptRow | null>` (active row with `use_case = clientUseCase(accountId)`, newest `updated_at` first, like `elevenPromptRow`)
  - `ensureClientPromptRow(accountId: number, tx: Tx): Promise<VoicePromptRow>` (inserts `name = "ElevenLabs client rules: <account name>"`, `Accounts_id`, `use_case`, `status 'active'`, `category 'voice'`, `version '1'`, `prompt_text ''`, `created_at`/`updated_at = new Date()`; only called inside `inDraftTx`, so two first saves cannot make two rows)
  - `loadClientState(exec: DbLike, accountId: number, lock = false): Promise<{ row: DraftRowState | null; current: LiveSnapshot | null }>` (`row.language = null`; nulls when the account has no client row)
  - `voiceClientDraftStorage.getClientDraftView(accountId): Promise<ClientDraftView>` (no row: `promptId null`, `liveText ""`, `draftText ""`, `hasDraft false`) and `saveClientDraftText(accountId, text, by): Promise<ClientDraftView>` (in `inDraftTx`: ensure the row, upsert the draft; a new draft's `baseText` is the live text)
- Produces, in `voicePromptDrafts.ts`: `discardElevenDrafts(accountId: number): Promise<{ nl: DraftView | null; en: DraftView | null; client: ClientDraftView }>` (also deletes this account's client draft; its accepted cards go back to proposed with the shared ones); `saveElevenDraftsToLive(accountId: number, by: string | null)` (the client row joins `rows`/`current` of `planSaveToLive`, locked like the shared rows; `saved` entries carry `language: PromptLang | null`; never another account's client row); `lastPromptSaveAt(accountId: number): Promise<string | null>` (max `Prompt_Versions.saved_at` over the two eleven row ids and this account's client row id: every live change snapshots there first).
- Produces, routes (Owner only): `GET /api/accounts/:id/voice/client-draft` gives `ClientDraftView`; `PUT /api/accounts/:id/voice/client-draft` body `clientDraftBodySchema = z.object({ text: z.string().max(CLIENT_TEXT_MAX) })` gives `ClientDraftView`; `DELETE /api/accounts/:id/voice/eleven-draft` gives `{ nl, en, client }`; `POST .../eleven-draft/save` passes the account; `GET /api/accounts/:id/voice/last-save` gives `{ at: string | null }`.

- [ ] **Step 1: Write the failing tests.** `clientDraftBodySchema` accepts `{ text: "" }`, rejects 20 001 characters and a missing `text`. `draftPlans.test.ts`: `planSaveToLive` with a shared row without draft and the client row `{ promptId: 900, useCase: "eleven_client_53", language: null, liveText: "", draft: { draftText: "- B.", baseText: "", acceptedIds: [7] } }`, current `[{ promptId: 900, liveText: "", version: "1", systemMessage: null }]`, today `"2026-10-26"`: one version for 900 (`promptText ""`, label `Before save to live 2026-10-26, cards #7`), one update `{ promptId: 900, promptText: "- B." }`, `liveCardIds [7]`, nothing for the shared row.
- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/routes/voicePromptDraftsSchemas.test.ts server/voice/review/draftPlans.test.ts` Expected: the schema test FAILs (the plan case may already pass: the plan does not read `language`).
- [ ] **Step 3: Implement** storage, routes, the PUT guard and the preview relay.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Read-only smoke.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --env-file=.env -e '(async () => { const { storage } = await import("./server/storage"); const v = await storage.getClientDraftView(53); console.log(v.promptId, v.hasDraft, v.accountName); console.log((await storage.getClientDraftView(60)).promptId); console.log(typeof (await storage.lastPromptSaveAt(53))); process.exit(0) })()'` Expected: `null false <the account's name>`, `null`, `string`. (No client row exists yet; Gabriel's first save makes it.)
- [ ] **Step 6: Bundle check.** Expected: exit 0.
- [ ] **Step 7: Commit:** `client-instructions: client draft, combined save and discard, last save`.

---

### Task 8: Scoped change cards (server)

**Files:**
- Create: `server/storage/voiceSuggestions.ts` (moved out of `voicePromptDrafts.ts`: `NewSuggestion`, `SuggestionDecision`, `toSuggestionDto`, insert, list, accept, reject, clear, recent rejected; plus undo and done)
- Create: `server/storage/voiceScopedAccept.ts` (per-scope accept and undo, with the knowledge writes as raw SQL on `"p2mxx34fvbf3ll6"."Account_Knowledge_Base"`, every statement scoped by `account_id`)
- Modify: `server/storage/voicePromptDrafts.ts` (cards removed; drafts only), `server/storage.ts` (spread `voiceSuggestionsStorage`)
- Modify: `server/voice/review/draftPlans.ts` and `draftPlans.test.ts` (delete `staleTransitions` and its tests; Task 3 rewrote them)
- Modify: `server/routes/voicePromptDrafts.ts`, `server/routes/voicePromptDraftsSchemas.ts`
- Test: `server/routes/voicePromptDraftsSchemas.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 columns; Task 2 `planClientAccept`, `settingsOf`, `settingText`; Task 3 `ScopedFields`, `SHARED_FIELDS`, `staleReason`, `judgeTransitions`, `knowledgeUndo`, `settingUndo`; Task 7 `inDraftTx`, `loadElevenState`, `loadClientState`, `ensureClientPromptRow`; `storage.getVoiceLine`, `storage.saveVoiceLine`.
- Produces:
  - `NewSuggestion` gains `promptId: number | null` and `fields?: ScopedFields` (absent = `SHARED_FIELDS`); insert writes `scope`, `edit_op`, `kb_*`, `setting_*`, and `language` null for non-shared scopes. Text columns: knowledge add `find_text ''` and `replace_text` = content; client add `find_text ''`; setting `find_text ''` and `replace_text = settingText(settingNew)`.
  - `toSuggestionDto` fills the new DTO fields; `settingApplies = scope === "setting" && isSettingCardKey(settingKey)`.
  - `SuggestionDecision` reasons: `"not_found" | "not_proposed" | "stale" | "changed_since" | "entry_gone" | "not_undoable"`.
  - `listVoiceSuggestions(accountId, limit = 100)`: loads only the context its open cards need (shared rows; client text = draft ?? live ?? `""`; the account's knowledge contents by id; `settingsOf(await getVoiceLine(accountId))`), runs `judgeTransitions`, writes `stale` with the note or `proposed`, then lists newest first.
  - Knowledge cores in `voiceScopedAccept.ts`, exported for the smoke: `applyKnowledgeCardIn(tx: Tx, accountId: number, card: KnowledgeCardRow): Promise<{ ok: true; set: Partial<VoicePromptSuggestionRow> } | { ok: false; reason: "stale" }>` and `undoKnowledgeCardIn(tx: Tx, accountId: number, card: KnowledgeCardRow, force: boolean): Promise<{ ok: true } | { ok: false; reason: "changed_since" | "entry_gone" }>`, with `type KnowledgeCardRow = Pick<VoicePromptSuggestionRow, "editOp" | "findText" | "replaceText" | "kbId" | "kbTitle" | "kbCategory" | "kbPrevTitle" | "kbPrevContent">`. Apply, replace: lock the entry `FOR UPDATE`, re-check `applyEdit` on its content (fail: `stale`), update `content` and `updated_at` only (campaign limits and other fields kept), `set = { kbPrevTitle: <title before>, kbPrevContent: <content before> }`. Apply, add: insert `(account_id, category, title, content, campaign_ids NULL, min_inbound_messages NULL, created_at, updated_at)`, `set = { kbId: <new id> }`. Undo: `knowledgeUndo(card, current entry)`; `gone` gives `entry_gone` (nothing written, even with `force`); `changedSince && !force` gives `changed_since`; `restore` writes back `kb_prev_title` and `kb_prev_content`; `delete` deletes the entry; `nothing` writes nothing.
  - `acceptVoiceSuggestion(accountId, id, by)` by scope; every scope first re-runs `staleReason` and on a reason marks the card stale with that note and answers 409 `stale`:
    - `shared`: as today.
    - `client`: in `inDraftTx`: `ensureClientPromptRow`, `planClientAccept`, upsert the client draft (`use_case` = the client use case), status `accepted`.
    - `knowledge`: one `db.transaction` running `applyKnowledgeCardIn`, then the card gets `set`, status `live`, `decided_by`, `decided_at`.
    - `setting`, whitelisted key: `getVoiceLine`, compare with `setting_old` (differs: stale), `saveVoiceLine(accountId, { [key]: settingNew })`, then status `live` with `WHERE status = 'proposed'`. A note-only setting card cannot be accepted: 409 `not_proposed` (it uses Done).
  - `undoVoiceSuggestion(accountId, id, by, force: boolean)`: only `live` knowledge cards and `live` whitelisted setting cards (else 409 `not_undoable`). knowledge: `undoKnowledgeCardIn` in a transaction. setting: `settingUndo(key, current, settingNew)`; `changedSince && !force` gives 409 `changed_since`; else `saveVoiceLine(accountId, { [key]: settingOld })`. Status `undone`.
  - `markVoiceSuggestionDone(accountId, id, by)`: a proposed note-only setting card becomes `done` (else 409 `not_proposed`).
  - Routes: `POST /api/accounts/:id/voice/suggestions/:sid/undo` body `undoBodySchema = z.object({ force: z.boolean().optional() })`; `POST /api/accounts/:id/voice/suggestions/:sid/done`. `DECISION_MESSAGES` gains `changed_since: "This changed again after the card was accepted"`, `entry_gone: "The knowledge entry was deleted since"`, `not_undoable: "This card cannot be undone"`.

- [ ] **Step 1: Write the failing test.** `undoBodySchema` accepts `{}` and `{ force: true }`, rejects `{ force: "yes" }`.
- [ ] **Step 2: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/routes/voicePromptDraftsSchemas.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** the move (no behaviour change for shared cards), the scoped paths and the routes. `voicePromptDrafts.ts`, `voiceSuggestions.ts` and `voiceScopedAccept.ts` each stay under 400 lines.
- [ ] **Step 4: Run** the schema test and `npx tsx --test server/voice/review/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Knowledge smoke inside a rolled-back transaction** (nothing is kept): `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --env-file=.env -e '(async () => { const { db } = await import("./server/db"); const { sql } = await import("drizzle-orm"); const k = await import("./server/storage/voiceScopedAccept"); class Rollback extends Error {} try { await db.transaction(async (tx) => { const ins = await tx.execute(sql`insert into "p2mxx34fvbf3ll6"."Account_Knowledge_Base" (account_id, category, title, content) values (53, $$faq$$, $$Plan smoke$$, $$Wij nemen elke auto in.$$) returning id`); const id = ins.rows[0].id; const card = { editOp: "replace", findText: "elke auto", replaceText: "elke auto tot 15 jaar", kbId: id, kbTitle: "Plan smoke", kbCategory: null, kbPrevTitle: null, kbPrevContent: null }; const a = await k.applyKnowledgeCardIn(tx, 53, card); console.log(a.ok, a.ok && a.set.kbPrevContent); const done = { ...card, ...(a.ok ? a.set : {}) }; await tx.execute(sql`update "p2mxx34fvbf3ll6"."Account_Knowledge_Base" set content = $$hand edit$$ where id = ${id}`); console.log(JSON.stringify(await k.undoKnowledgeCardIn(tx, 53, done, false))); console.log(JSON.stringify(await k.undoKnowledgeCardIn(tx, 53, done, true))); console.log((await tx.execute(sql`select content from "p2mxx34fvbf3ll6"."Account_Knowledge_Base" where id = ${id}`)).rows[0].content); console.log(JSON.stringify(await k.undoKnowledgeCardIn(tx, 60, done, true))); throw new Rollback(); }); } catch (err) { if (!(err instanceof Rollback)) throw err; } process.exit(0) })()'` Expected: `true Wij nemen elke auto in.`, `{"ok":false,"reason":"changed_since"}`, `{"ok":true}`, `Wij nemen elke auto in.`, `{"ok":false,"reason":"entry_gone"}` (another account cannot reach the entry). Then `npx tsx --env-file=.env -e '(async () => { const { pool } = await import("./server/db"); console.log((await pool.query(`select count(*)::int n from "p2mxx34fvbf3ll6"."Account_Knowledge_Base" where title = $$Plan smoke$$`)).rows[0].n); process.exit(0) })()'` Expected: `0`.
- [ ] **Step 6: Read-only list smoke.** `npx tsx --env-file=.env -e '(async () => { const { storage } = await import("./server/storage"); const l = await storage.listVoiceSuggestions(53); console.log(l.every((c) => typeof c.scope === "string")); process.exit(0) })()'` Expected: `true` (existing cards read as `shared`).
- [ ] **Step 7: Bundle check.** Expected: exit 0.
- [ ] **Step 8: Commit:** `client-instructions: change cards for all clients, this client, knowledge and settings, with undo`.

---

### Task 9: The review and the coach choose where a change belongs

**Files:**
- Modify: `server/voice/elevenPromptRules.md`, `server/voice/promptRules.test.ts`
- Create: `server/voice/review/proposalSchema.ts` (moved from `reviewPrompt.ts`: `PROPOSAL_ITEM_SCHEMA`, `readProposal`, `readProposals`; update the imports in `reviewPrompt.ts` and `coachPrompt.ts`)
- Modify: `server/voice/review/reviewPrompt.ts`, `server/voice/review/runReview.ts`, `server/voice/coach/coachPrompt.ts`, `server/voice/coach/runCoach.ts`, `server/storage/voiceReviews.ts` (`loadAccountKnowledge`), `server/routes/voiceReviews.ts` (`sinceSave`)
- Test: `server/voice/review/reviewPrompt.test.ts`, `server/voice/review/runReview.test.ts`, `server/voice/coach/coachPrompt.test.ts`, `server/voice/coach/runCoach.test.ts` (extend each)

**Interfaces:**
- Consumes: Task 3 `validateScoped`, `ProposalContext`, `KnowledgeFact`; Task 7 `getClientDraftView`, `clientPromptRow`, `lastPromptSaveAt`; Task 8 `NewSuggestion.fields`.
- Produces:
  - Rules document: a new `## Where a change belongs` section after `## How to change the prompt`: All clients for a behaviour right for any business, written generically (no names, cars, brands, numbers); Only this client for a behaviour only this business wants, as short "Als X, dan Y" / "If X, then Y" bullets in the client's language, never with `{marks}` (the text is inserted as typed, before `# Guardrails`, and wins over the general rules but never over the guardrails); Knowledge for facts (prices, procedures, opening details, policies), noting that WhatsApp reads the same entries and the stock entry is never a target; Setting for what a setting controls (the five keys with their value shapes; any other setting only as a note); at most 5 cards in total per review; when in doubt between all clients and this client, this client. `## What not to propose` stops sending knowledge wording to recommendations. In the test the length cap becomes `< 40000` and the heading list gains `"## Where a change belongs"`.
  - `PROPOSAL_ITEM_SCHEMA` required keys add `scope` (enum shared, client, knowledge, setting), `op` (enum replace, add), `kbId` (`["integer","null"]`), `kbTitle`, `kbCategory`, `settingKey`, `settingValue` (`["string","null"]` each); `language` becomes `{ type: ["string","null"], enum: ["nl","en",null] }`. `readProposal`: `scope` absent or unknown reads `shared`; `language` required only for `shared`; text fields cleaned as today (`find` and `kbId` never cleaned); `settingValue` kept verbatim.
  - `ReviewPromptInput` gains `clientText: string` and `settings: SettingValues | null`; `knowledge` becomes `KnowledgeFact[]` (shown as `### [kb 12] Inruil (services)`). New user sections after `Live prompt EN`, in order: `Client instructions (only <accountName>)` (the live client text, or `(none yet)`), then `Knowledge base`, then `Settings` (`JSON.stringify(settings)` plus the line `Other settings (note cards only): hours, transfer number, voice, live switch, follow-up, number`), then rejected edits and calls as today. The TASK text says: each proposal names its `scope`; shared edits copy `find` from the live shared prompt as today; client edits copy `find` from the client instructions, or use `op "add"` with `find ""` for a new rule; knowledge edits use `kbId` and `find` from that entry's content, or `op "add"` with `kbTitle`, a `kbCategory` from the existing categories and the content in `replace`; setting cards put the key in `settingKey` and the full new value in `settingValue` (plain text for greeting and intake, JSON for the others); `knowledgeBase` only holds observations with no concrete edit.
  - `ReviewStore` gains `clientText(accountId): Promise<string>` (live, `""` without a row) and `settings(accountId): Promise<SettingValues | null>`; `knowledge` returns `KnowledgeFact[]` (`loadAccountKnowledge` selects `id, title, content, category`, stock still excluded). `runReview` builds `ProposalContext` from the live shared texts, the live client text, knowledge and settings; each proposal goes through `validateScoped`; valid ones become `NewSuggestion` with `fields` and `promptId` (shared: `live[lang].id`, mirror as today; others null); invalid ones count in `droppedProposals`.
  - `CoachStore` gains `clientDraft(accountId): Promise<ClientDraftView>`, `knowledge(accountId)`, `settings(accountId)`. `CoachPromptInput` gains `client: { live: string; draft: string; accountName: string }`, `knowledge: KnowledgeFact[]`, `settings: SettingValues | null`; sections `Client instructions (live)` and `Client instructions draft (proposals are edits of this text)` follow the shared draft sections, then knowledge and settings. The coach validates against the DRAFT texts (shared drafts and the client draft). Its TASK gets the same scope rules in the coach's words.
  - Review run route: body `{ sinceSave: true, withTests? }` takes `lastPromptSaveAt(accountId)` as `periodStart` and `new Date()` as `periodEnd`; no save gives 400 `{ message: "No Save to live yet", reason: "no_save" }`; a save more than 92 days ago gives 400 `reason: "too_long"`. `from`/`to` keep working.

- [ ] **Step 1: Write the failing tests.**
  - `promptRules.test.ts`: the new heading, the 40 000 cap, and the section contains "All clients", "Only this client", "Knowledge" and "Setting".
  - `reviewPrompt.test.ts`: the user text holds `[kb 12] Inruil (services)`, the client text and `"afterHours"` from the settings JSON; `clientText ""` gives `(none yet)`; `parseReviewAnswer` on an answer with one proposal of each scope keeps all four with their fields (`kbId 12` a number, `settingValue` verbatim, `language null` for the non-shared ones), reads a proposal without `scope` as `shared`, and drops and counts a shared proposal with `language: null`.
  - `runReview.test.ts` `"mixed kinds"`: the fake model answers five proposals (valid shared with mirror, valid client add, knowledge edit of `kbId 99`, setting `afterHours` `"\"sometimes\""`, valid knowledge add): three suggestions inserted with scopes `shared`, `client`, `knowledge`; the client one has `promptId null`; `report.droppedProposals === 2`.
  - `coachPrompt.test.ts`: the user text holds the client draft and live text and the knowledge ids. `runCoach.test.ts`: a client `replace` proposal whose `find` is only in the client DRAFT is inserted; a setting proposal is checked against `settings` (an unchanged value is dropped).
- [ ] **Step 2: Run them.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/voice/promptRules.test.ts server/voice/review/*.test.ts server/voice/coach/*.test.ts` Expected: the new cases FAIL.
- [ ] **Step 3: Implement** the rules section (no em dashes; the whole document under 40 000 characters), the schema move, the prompt and runner changes, the storage select and the `sinceSave` route.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Bundle check.** Expected: exit 0.
- [ ] **Step 6: Commit:** `client-instructions: review and coach pick all clients, this client, knowledge or a setting`.

---

### Task 10: UI, the client tab in the draft card and Test draft

**Files:**
- Create: `client/src/features/accounts/components/workspace/voice/coach/ClientDraftEditor.tsx`, `coach/DraftActionsRow.tsx`
- Modify: `coach/ElevenDraftCard.tsx` (third tab; the Save/Discard block moves to `DraftActionsRow`), `coach/coachApi.ts`, `voice/test/TestPanelHead.tsx`
- Modify: `client/src/locales/{en,nl,pt}/voiceCoach.json` (keys under `client.*`, `draft.*`)

**Interfaces:**
- Consumes: Task 7 routes; `ClientDraftView`, `CLIENT_TEXT_SOFT_MAX`, `CLIENT_TEXT_MAX`.
- Produces, `coachApi.ts`: `clientDraftKey(accountId)` (`[...base(accountId), "client-draft"]`); `useClientDraft(accountId)` (same query options as `useElevenDraft`); `cachedClientDraft(accountId)`; `saveClientDraft(accountId, text): Promise<ClientDraftView | null>` (PUT, writes the cache); `lastSaveKey(accountId)` and `useLastSave(accountId)` (`{ at }`, `LIST_STALE_MS`). `discard` also sets `clientDraftKey` from `views.client`; `saveToLive` also invalidates `clientDraftKey(accountId)` and `lastSaveKey(accountId)`.
- Produces, `DraftActionsRow({ accountId, accountName, syncDraft: () => Promise<boolean>, canSave: boolean, canDiscard: boolean, onDiscarded: () => void, notes?: React.ReactNode })`: the existing inline confirm rows, buttons, messages and test ids (`voice-draft-save-live`, `voice-draft-discard`, `voice-draft-confirm-save|discard`) moved out of `DraftEditor` unchanged, except the save confirm reads `draft.saveConfirmClient` with `{ name: accountName }`.
- `ElevenDraftCard`: tabs NL | EN | `<accountName>` (`data-testid="voice-draft-lang-client"`); the client tab renders `ClientDraftEditor` keyed by `client-${promptId ?? "new"}`. Both editors compute `canSave` and `canDiscard` over all three drafts (shared NL, shared EN, client); the shared editor's "other changed" note also names the client tab when its draft differs. Filled in (both editors) posts `{ kind: "eleven", accountId, lineId, text, clientText }`: `text` = the shared text of the line's language (the screen text when on that tab), `clientText` = the client text (the screen text when on the client tab).
- `ClientDraftEditor({ accountId, lineId, view: ClientDraftView, langSwitch, sharedText: string })`: help line `client.help`; the same autosave, outside-change adoption (`seen` ref), Edit | Changes | Filled in views and `DraftVersions` (hidden while `promptId` is null) as the shared editor; a plain `textarea` (no template marks here) at `EDITOR_HEIGHT`; under it a counter `{n} / 3000` in `var(--mute)`, `var(--warn)` with `client.overSoft` above `CLIENT_TEXT_SOFT_MAX`; input stops at `CLIENT_TEXT_MAX`.
- `TestPanelHead`: `canTestDraft` also holds when `useClientDraft(line.accountId).data?.hasDraft`.
- Copy (en; nl and pt translated): `client.help` "Rules only {{name}}'s calls get. They sit just above the guardrails and win over the shared rules above them. One rule per line, for example: If someone asks about trade-in, ask for the plate first.", `client.overSoft` "Long rules make every call slower. Keep them short.", `client.empty` "No rules for {{name}} yet.", `draft.saveConfirmClient` "Calls use it within 30 seconds. The shared prompt reaches every ElevenLabs line, the {{name}} rules only {{name}}'s calls.".

- [ ] **Step 1: Implement** the hooks, the two components, the card changes, the Test draft condition and the copy.
- [ ] **Step 2: Existing voice tests still pass.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && ls client/src/features/accounts/components/workspace/voice/*.test.ts client/src/features/accounts/components/workspace/voice/test/*.test.ts client/src/features/accounts/components/workspace/voice/coach/*.test.ts | xargs npx tsx --test` Expected: PASS.
- [ ] **Step 3: Locale check and client build.** Expected: `true` x2, `0`s, build exit 0. `wc -l` of `ElevenDraftCard.tsx`, `ClientDraftEditor.tsx`, `DraftActionsRow.tsx`: each under 400.
- [ ] **Step 4: Commit:** `client-instructions: client rules tab in the draft card, Test draft with a client draft`.

---

### Task 11: UI, scoped change cards and the review since the last Save to live

**Files:**
- Create: `client/src/features/accounts/components/workspace/voice/coach/ScopePill.tsx`, `coach/KnowledgeCardBody.tsx`, `coach/SettingCardBody.tsx`, `coach/UndoRow.tsx`, `coach/settingFormat.ts`, `coach/settingFormat.test.ts`
- Modify: `coach/SuggestionItem.tsx`, `coach/SuggestionCards.tsx` (Done tab holds `live`, `rejected`, `undone`, `done`), `coach/ReviewCard.tsx`, `coach/coachApi.ts`
- Modify: `client/src/features/accounts/components/workspace/knowledge/useKnowledgeBase.ts` (refetch on the `la:knowledge-changed` window event for its account)
- Modify: `client/src/locales/{en,nl,pt}/voiceCoach.json` (keys under `scope.*`, `knowledgeCard.*`, `settingCard.*`, `undo.*`, `review.sinceSave.*`, `cards.status.undone|done`, `cards.staleNote.*`)

**Interfaces:**
- Consumes: Task 8 routes; Task 9 `sinceSave`; Task 10 `useClientDraft` (for the account name), `useLastSave`.
- Produces, `coachApi.ts`: `useSuggestionActions` gains `undo(id: number, force?: boolean): Promise<Decision>` and `done(id: number): Promise<Decision>`; after a knowledge card accept or undo it dispatches `window.dispatchEvent(new CustomEvent("la:knowledge-changed", { detail: { accountId } }))`; after a setting card accept or undo it invalidates `voiceLineKey(accountId)`; a client card accept invalidates `clientDraftKey`. `runReviewNow(accountId, body: { from: string; to: string; withTests: boolean } | { sinceSave: true; withTests: boolean })` answers `{ ok: false; busy; badRange; noSave }`.
- Produces, `settingFormat.ts` (pure): `formatSetting(key: string, value: unknown, t: (k: string, o?: object) => string): string[]` (greeting and other strings: one line; intake: its lines; pronunciation: `word → sayAs` per row; afterHours: `t("settingCard.afterHours.<value|none>")`; screening: one line per switch in the order sales, robocalls, abuse, `t("settingCard.screening.<key>", { on })`; anything else: `JSON.stringify`).
- Produces, components: `ScopePill({ scope, accountName })` ("All clients" / "Only {{name}}" / "Knowledge" / "Setting"; shared cards keep their language pill too); `KnowledgeCardBody({ card })` (entry title; replace: `DraftDiff` of find to replace; add: title, category label from `accounts:knowledge.categories.*`, the content as added lines; a one-line note that WhatsApp reads the same entry); `SettingCardBody({ card })` (setting name, "Now" and "New" from `formatSetting` of `settingOld` / `settingNew`, two columns on desktop, one on mobile; a note card shows "Not set from a card" and the text); `UndoRow({ card, accountId })` (for `live` knowledge and whitelisted setting cards: Undo (soft); a 409 `changed_since` turns into the inline confirm "This changed again after you accepted it. Undo anyway?" whose "Undo anyway" calls `undo(id, true)`; `entry_gone` shows "The entry was deleted since, so there is nothing to undo.").
- `SuggestionItem` per scope: shared as today plus the pill; client: pill and diff (add shows only added lines), no language pill; knowledge and setting: their bodies; Accept / Reject while proposed (a note setting card: Done / Reject); after Accept, knowledge and setting cards show `UndoRow`; stale shows the note for its `statusNote` (`find_text_gone` as today, `entry_gone` "The knowledge entry this card changes is gone", `setting_changed` "This setting changed since the card was made"). `SuggestionItem.tsx` stays under 250 lines.
- `ReviewCard`: beside the dates a soft toggle chip "Since the last Save to live" (`data-testid="voice-review-since-save"`), disabled with the hint "No Save to live yet" when `useLastSave` gives null; when on, the date fields give way to the line "From the Save to live of {{date}} to now" (date and time in Amsterdam through `Intl.DateTimeFormat`), and Run sends `{ sinceSave: true, withTests }`.

- [ ] **Step 1: Write the failing test** `settingFormat.test.ts` with a stub ``t = (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k)``: pronunciation `[{ word: "RDW", sayAs: "er dee wee" }]` gives `["RDW → er dee wee"]`; screening `{ sales: true, robocalls: false, abuse: true }` gives three lines in the order sales, robocalls, abuse; afterHours `null` gives `["settingCard.afterHours.none"]`; intake `"a\nb"` gives `["a", "b"]`; an unknown key with `{ x: 1 }` gives `["{\"x\":1}"]`.
- [ ] **Step 2: Run it.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test client/src/features/accounts/components/workspace/voice/coach/settingFormat.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement** `settingFormat.ts`; run again: PASS.
- [ ] **Step 4: Implement** the components, the card and review changes, the hook changes and the copy.
- [ ] **Step 5: Voice tests, locale check, client build** (Task 10 Steps 2 and 3 commands). Expected: PASS, `true` x2, `0`s, exit 0.
- [ ] **Step 6: Commit:** `client-instructions: scope pills, knowledge and setting cards with undo, review since the last save`.

---

### Task 12: Full verification and the engine restart

**Files:** none created; fixes only if a check fails (each fix in the task that owns the file, committed with `client-instructions: fix ...` or `voice: fix ...`).

- [ ] **Step 1: All CRM tests.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && npx tsx --test server/voice/promptRules.test.ts server/voice/review/*.test.ts server/voice/coach/*.test.ts server/routes/voicePromptDraftsSchemas.test.ts server/routes/voiceElevenTest.test.ts server/storage/voiceCallReview.test.ts server/routes/voiceCallReviewView.test.ts server/routes/voiceCallsAccess.test.ts server/storage/voiceCallersLogic.test.ts server/storage/voiceLineEngine.test.ts client/src/features/accounts/components/workspace/voice/*.test.ts client/src/features/accounts/components/workspace/voice/test/*.test.ts client/src/features/accounts/components/workspace/voice/coach/*.test.ts` Expected: 0 failures.
- [ ] **Step 2: Engine tests.** `cd /home/gabriel/automations && .venv/bin/python -m pytest -q tests/voice/test_eleven_client_rules.py tests/voice/test_eleven_client_draft.py tests/voice/test_eleven_draft_routes.py tests/voice/test_eleven_draft_test.py tests/voice/test_eleven_browser_routes.py tests/voice/test_eleven_prompt.py tests/voice/test_eleven_template.py tests/voice/test_eleven_preview.py tests/voice/test_client_setup.py tests/voice/test_phone_door.py` Expected: pass (report, do not fix, failures in files no task touched). `./preflight.sh`: PASS.
- [ ] **Step 3: Bundle check and client build.** Expected: both exit 0.
- [ ] **Step 4: No em dashes added.** `EMDASH="$(printf '\342\200\224')"; cd /home/gabriel/LeadAwakerApp-wt-client-instructions && git diff main...HEAD -U0 -- . ':!docs' | grep '^+' | grep -c "$EMDASH"` Expected: `0`. `cd /home/gabriel/automations && git diff b7e27e1..HEAD -U0 | grep '^+' | grep -c "$EMDASH"` Expected: `0` (b7e27e1 is the engine head before this plan; use the commit before Task 4's if Gabriel committed in between).
- [ ] **Step 5: File sizes.** `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && git diff --name-only main...HEAD | grep -E "\.(ts|tsx)$" | xargs wc -l | sort -n | tail -6` Expected: nothing this branch created or touched above 500 lines except `shared/schema.ts`, `server/storage.ts` and `server/storage/voiceLines.ts`.
- [ ] **Step 6: Restart the engine with no live call.** Check: `cd /home/gabriel/LeadAwakerApp-wt-client-instructions && node --env-file=.env -e 'const pg=require("pg");const p=new pg.Pool({connectionString:process.env.DATABASE_URL});p.query(`select count(*)::int n from "p2mxx34fvbf3ll6"."Voice_Calls" where ended_at is null and started_at > now() - interval $$20 minutes$$`).then(r=>{console.log(r.rows[0].n);return p.end()})'` Expected `0`; otherwise wait with the Monitor tool (until-loop, every 2 minutes, at most 30 minutes). Then `pm2 restart leadawaker-engine --update-env`, wait until `curl -s http://localhost:8100/health` answers, then `pm2 logs leadawaker-engine --lines 40 --nostream`. Expected: `"status":"ok"`, `"scheduler_running":true`, no `Traceback`, `ImportError` or `Error` after the restart. On failure: `git -C /home/gabriel/automations revert --no-edit <this plan's engine commits, newest first>`, `./preflight.sh`, restart again, confirm health, and report instead of continuing.
- [ ] **Step 7: Live engine smoke, read only.** `curl -s -X POST http://localhost:8100/voice/prompt-preview -H "Content-Type: application/json" -H "X-Internal-Key: $(grep ^INTERNAL_API_KEY /home/gabriel/automations/.env | cut -d= -f2-)" -d '{"kind":"eleven","account_id":53,"line_id":1,"client_text":"- Vraag eerst het kenteken."}' | grep -c "Afspraken van dit bedrijf"` Expected: `1` (the preview uses the given client text; nothing is saved).
- [ ] **Step 8: Report** `git log --oneline main..HEAD` (CRM), the engine commits on `feature/dbr-scoping-mode`, and anything that failed and was fixed. Merging the CRM branch into `main` (which pm2 serves) is the orchestrator's, after Gabriel's go.

---

## Self-review notes

- Round 1 coverage: client instructions per account as a `Prompt_Library` row with draft, versions, Test draft and Save to live (Tasks 4, 5, 7, 10); placement by code before `# Guardrails` with a fixed NL/EN heading and sentence, one text for both languages (Task 4); the client tab's counter (Task 10); cards labelled All clients / Only this client / Knowledge / Setting, chosen by the review and coach within the 5-card cap (Tasks 3, 8, 9, 11); knowledge cards edit or add, never delete, never the stock entry, live on Accept with Undo from data on the card (Tasks 3, 8, 11); whitelisted setting cards validated like `VoiceLinePatch`, stale check on Accept, Undo that asks, notes for other settings (Tasks 2, 3, 8, 11); rules document section (Task 9); extra instructions removed in CRM and engine with the template mark kept (Task 6); "since the last Save to live" (Tasks 7, 9, 11); Save and Discard act on the shared drafts plus this account's client draft only (Task 7); a Test draft with only a client draft (Task 5); existing cards read as All clients (Task 1 default, Task 8 smoke).
- Left out for round 2, per the spec's scope section: knowledge history table and History/Restore UI, versioning of manual knowledge edits, the review told what changed (goal 7), the reach count (goal 8).
- Decisions taken here (the spec left them to the builder): `use_case = 'eleven_client_<accountId>'` (the engine's `DISTINCT ON (use_case)` cache and the draft lookup stay as they are); scope stored as columns on `Voice_Prompt_Suggestions` with `prompts_id`/`language` made nullable; client cards carry no `prompts_id` (the account decides the row, created on the first save or accept); soft cap 3000, hard cap 20 000 characters; a cleared client draft means "no rules", not "no draft"; no `{marks}` in client text; a knowledge Undo whose entry was deleted since answers `entry_gone` and writes nothing (round 1 keeps only the previous title and content, not enough to re-create an entry with its campaign limits); a hand-changed title also counts as "changed since"; new knowledge entries default to `faq` when the model's pick is not an existing, displayable category; setting values travel as a string (`settingValue`: plain text for greeting and intake, JSON for the rest) because the CLI's JSON schema has no free-form type; "last save" is any `Prompt_Versions` row of the shared rows or the client row (every live change snapshots there).
