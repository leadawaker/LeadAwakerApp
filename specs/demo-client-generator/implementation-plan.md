# Demo Client Generator v2: Implementation Plan

> Requirements: `requirements.md` in this folder. Paths verified 2026-09-19. Each phase ships on its
> own. Do not touch `client/src/features/voiceDemo/` or `voice/live_session_config.py` (another
> session). Never run tsc unless Gabriel asks.

## Gotchas to respect throughout

- **Prompt_Library autosave.** The CRM prompt editor autosaves its buffer and silently overwrites SQL
  writes to Prompt_Library (keeps the version number, restores the old body). Before any SQL write to
  row 91 or the new directions row: Gabriel closes the editor tab, snapshot the old text into
  `Prompt_Versions` under the old version, write with an exactly-one-match assertion, then poll
  `updated_at`/`updated_by`/`length(prompt_text)` for ~60s to confirm it held.
- **Two copies of the generator prompt.** Row 91 and `NICHE_GENERATOR_SYSTEM_FALLBACK`
  (`server/demo-session.ts:331-396`). Update both in the same phase.
- **`demo_niche` is a frozen snapshot.** Any regenerated or language-filled Client reaches only newly
  minted links. Existing Leads keep their old blob; refresh with `/client <id>` from WhatsApp or mint
  a new link. A demo restart does not refresh it.
- **Cloudflare 100s limit.** `app.leadawaker.com` is a Cloudflare tunnel. Anything that can exceed
  ~90s is a background job the browser polls.
- **Claude CLI context leak.** `tryClaude()` (`server/aiTextHelper.ts:30`) runs with the server's cwd,
  so Claude Code loads the repo `CLAUDE.md` into a generation call. `--bare` is not an option (it
  disables OAuth, i.e. the subscription). Use a neutral cwd plus the flags in Phase 1 and verify.
- **Pi resources.** Opus runs as a `claude` Node process. At most 2 concurrent generation processes
  (Phase 4 runs two languages in parallel); a simple in-process semaphore is enough.

## Phase 1: Fail loudly + provider plumbing

Backend
1. `server/aiTextHelper.ts`: add `claudeJson({ system, user, model, timeoutMs, jsonSchema? })`.
   Spawn (not execFile) so the prompt goes over stdin: `claude -p --model <opus|sonnet>
   --system-prompt <system> --tools "" --output-format json --no-session-persistence --max-turns 1`
   (+ `--json-schema` when given), `cwd` = a neutral dir under `os.tmpdir()`, `env` = `cleanClaudeEnv()`.
   Parse the CLI's JSON envelope, then `extractJsonObject()` (`:142`) on the result text. Returns
   `{ text } | { error }`, never throws. Verify once by hand that the repo CLAUDE.md is not in context
   (ask the model to list its instructions); if it leaks, add `--setting-sources ""` and re-check auth.
2. New `server/demoGenerator/providers.ts`: `runJson({ system, user, provider, claudeModel,
   validate, openai: { model, maxTokens, timeoutMs } })` returns `{ data, providerUsed }` or throws
   `GenerationError(message, stage)`. Order: Claude (if chosen) then OpenAI on error, timeout, parse or
   `validate` failure. OpenAI leg reuses the request shape now inline in `generateNicheContext`
   (`demo-session.ts:497-535`: `gpt-5.6-terra`, `json_object`, `max_completion_tokens`).
3. `server/demo-session.ts`: split `generateNicheContext` (`:398`) into build-prompt, call (via
   `runJson`) and `normalizeGenerated()` (the coercions at `:560-650`). Add options
   `{ provider?, claudeModel?, brief?, siteFacts? }`; default provider `openai` so the public flow
   (`routes/demo.ts:471`), `/generate` (`:728`) and create-link (`:620`) behave as today. Keep the
   existing `null` return for those callers via a thin wrapper; the new routes use the throwing form.
   Validation for the full context: `first_message` contains `{agent_name}` and `{first_name}`,
   `scoping_ladder` has 4-7 `SLOT` blocks, `opener_phrase`, `service_name`, `niche_label` non-empty.
4. `server/routes/demo.ts:289-291`: drop the `buildFallbackNicheContext` fallback on `from-website`;
   on failure return 502 `{ message, stage: "generate", retryable: true }` and save nothing. Accept
   `provider` and `claudeModel` in its schema (`:236`).

Timeouts: Claude Opus 240s, Claude Sonnet 150s, OpenAI 90s (full generation); directions (Phase 2)
Claude 60s, OpenAI 45s. Scrape stays 120s (`routes/demo.ts:265`). Until Phase 2 lands, `from-website`
can exceed 100s with Opus, so Phase 1 ships with Sonnet as the default and flips to Opus in Phase 2.

Frontend
5. New `client/src/features/demos/components/ProviderToggle.tsx`: segmented control Claude / OpenAI
   plus Opus / Sonnet select when Claude. localStorage keys `demos.gen.provider`,
   `demos.gen.claudeModel`, every access in try/catch, defaults `claude` / `sonnet` (Opus from Phase 2).
6. `NewDemoForm.tsx`: send provider fields from `scanWebsite()` (`:66-74`); on error show the message
   with a Retry button that re-runs the same call; show "via Claude Opus" / "via OpenAI" in the
   success note (`:82`).
7. i18n: new keys in `client/src/locales/{en,nl,pt}/demos.json` (provider labels, retry, "via ...").

## Phase 2: Jobs + directions step

Backend
1. New `server/demoGenerator/jobs.ts`: in-memory `Map<jobId, { status, stage, result, error,
   createdAt }>`, 30 min TTL sweep, owner = session user id. Lost on server restart (tsx watch
   restarts on save); the UI treats a 404 job as "restart the step".
2. New `server/demoGenerator/directions.ts`: loads the prompt from Prompt_Library use_case
   `demo_client_directions` (new row, in-file fallback, same pattern as `demo-session.ts:421-434`).
   Input: site facts (company, service, description, kb from the scrape) or typed niche / notes,
   market, optional previous directions. Output validated with zod: exactly 3 items of
   `{ offer, lead_situation, booking_goal, booking_is_call: boolean, scope_outline: string[4..5] }`.
   Pass the same shape as `--json-schema` on the Claude leg and use `json_object` on OpenAI.
   Draft prompt (lean, positive):
   ```
   You help set up a sales demo for one business. Propose three different directions the demo
   could take. Each direction is one realistic way this business wins a customer:
   - offer: the one service or product the conversation is about, in the customer's words.
   - lead_situation: what the lead did before we contact them (for example asked for a quote on
     the website, visited the showroom, had a call), one sentence.
   - booking_goal: the appointment the AI books at the end, and with whom.
   - booking_is_call: true when that appointment is a phone or video call.
   - scope_outline: 4 or 5 short questions, in order, that walk the lead from their situation to
     that booking. Start with what they are after now, then the two or three things that most change
     what gets proposed, then what matters most to them.
   Base everything on the business facts given. Make the three directions differ in offer or
   booking goal. Write in English. Return JSON {"directions": [...]}.
   ```
3. New `server/routes/demoClientGen.ts` (keeps `routes/demo.ts` from growing past 1073 lines),
   registered in `server/routes/index.ts`, all `requireAgency`:
   - `POST /api/demo/clients/directions` body `{ url? | text? | niche?, language, market?, provider,
     claudeModel, previous?, scrapeRef? }` -> `{ jobId }`. Job: scrape via engine `/api/site-kb` when
     url/text and no `scrapeRef` (moved from `routes/demo.ts:252-275`), then directions. The scrape
     result is kept on the job so "3 new directions" and generation reuse it (`scrapeRef` = jobId).
   - `POST /api/demo/clients/generate` body `{ scrapeRef?, niche?, direction, note?, language,
     market?, provider, claudeModel, clientKey? }` -> `{ jobId }`. Job: `generateNicheContext` with
     `brief` = direction + note and `siteFacts`; overlay site facts (logic moved from
     `routes/demo.ts:293-305`); `saveDemoClient`; screenshot capture (`:310` onward). Result
     `{ client, providerUsed, pages_scraped, screenshot }`.
   - `GET /api/demo/jobs/:id` -> job state.
   - `from-website` in `routes/demo.ts:230` becomes a thin legacy wrapper or is removed once the UI
     no longer calls it (grep first: only `NewDemoForm.tsx:66` uses it today).
4. Brief injection (no row 91 change yet): `generateNicheContext` appends to the user message:
   `Chosen direction: offer / lead situation / booking goal / scope questions (use these as the
   ladder slots, same order)` + `Note from the presenter: ...`. `booking_mode_call` is set in code
   from `booking_is_call` after generation, so the model cannot contradict the card.

Frontend
5. New `client/src/features/demos/api/clientGeneratorApi.ts` (start + poll helpers, 2s interval,
   stop on done/error/unmount) and `client/src/features/demos/hooks/useClientGenerator.ts` (state
   machine: idle -> scanning -> directions -> generating -> done | error with the failed stage).
6. New `client/src/features/demos/components/DirectionsPicker.tsx`: three cards (offer, lead situation,
   booking goal, numbered scope outline), select one, note textarea, "3 new directions", "Build
   Client". Follow `UI_STANDARDS.md` tokens (no raw hex; `NewDemoForm.tsx:256` has one to fix).
7. `NewDemoForm.tsx`: website, notes and typed niche all start the directions job; the typed niche
   input (`:216-223`) gets a "Suggest directions" button (it is dead UI today). On done, select the
   new Client (`setClientNiche`). Keep the file under ~300 lines by moving the source inputs into a
   `ClientSourceInputs.tsx` if needed.
8. i18n keys for all new strings in the three `demos.json` files (PT is Brazilian).

## Phase 3: Prompt rewrites

1. **Row 91** (use_case `universal_demo_niche_generator`): rewrite per `requirements.md` "Row 91
   review": cut `what_lead_did` and `second_message`, replace lines 35-90 with the replacement ladder
   guidance, one statement per rule, no ALL-CAPS emphasis, target under 6k chars. Add a "Chosen
   direction" paragraph: "When a chosen direction is given, the offer, lead situation and booking
   goal come from it and the ladder follows its scope questions in order." Follow the autosave
   procedure above. Mirror into `NICHE_GENERATOR_SYSTEM_FALLBACK` (`demo-session.ts:331`).
2. **Per-language style block** built in code next to the market block (`demo-session.ts:455-464`):
   one short block per language, written in that language (nl: je-vorm, labels Doel/Vraag/Opties;
   pt: Brazilian, você, labels Objetivo/Pergunta/Opções, the BR word list from row 91 line 90; en:
   labels Purpose/Ask/Options).
3. **site_kb summarizer** (`automations/tools/site_kb.py:70-90`): rephrase "Never invent" as "Use only
   what the site states; leave a field empty when the site is silent". Keep the 200-400 word KB target
   (observed average ~1k chars is fine). Language line changes only in Phase 4.
4. Test on 5 fresh niches per language before calling it done (not one sample): ladder has 4-5 slots,
   follows the card order, each Ask answerable in a few words. Say "should improve, test it", never
   "fixes it".

## Phase 4 (Pending confirmation): languages

Schema (needs Gabriel's OK; apply with a direct `pg` script via `node --env-file=.env`, since
`db:push` needs a TTY):
- `Niche_Vocabulary.generation_brief jsonb` (direction, note, provider, source_language, source_url,
  created_at) and `source_language text`, in `shared/schema.ts:337` table def.

Work
1. `automations/tools/site_kb.py`: `scrape_site` (`:130`) returns `html_lang` read from the homepage
   `<html lang>`; summarizer writes every field in the site's own language and returns `site_language`
   (replaces the translate line `:88`). `src/api/site_kb.py` passes `language` only as a hint.
2. Directions job result carries `siteLanguage`; `NewDemoForm` prefills the language select
   (`:207-213`) from it, still overridable.
3. Generate job: when demo language is nl or pt, run en and that language in parallel (semaphore of
   2), each a native generation from the same direction; KB for the non-site language is written by
   the same call from the site-language KB facts (field `kb` added to the brief). Save both via
   `saveDemoClient` (already merges per language, `demo-clients.ts:259`), plus `generation_brief`.
4. `POST /api/demo/clients/:niche/add-language { language, provider, claudeModel }` -> job: reads
   `generation_brief` (or, for older rows, builds a brief from the row's en fields), generates that
   language, writes only empty slots. Button in `client/src/features/campaigns/components/clients/
   ClientActionsMenu.tsx`, hook in `client/src/features/campaigns/api/demoClientsApi.ts`.
5. `clientLanguages()` (`server/demo-clients.ts:185`): a language counts only when `firstMessage`,
   `scopingLadder`, `openerPhrase` and `kbTemplate` are all non-empty for it; add
   `partialLanguages` to `DemoClientSummary` (`:190`) so `ClientsTab.tsx` can warn. Check the effect on
   the create-link 409 (`routes/demo.ts:591`) and `/generate` fall-through (`:712-722`).

## Files touched (summary)

CRM: `server/aiTextHelper.ts`, `server/demo-session.ts`, `server/demo-clients.ts` (P4),
`server/routes/demo.ts`, `server/routes/index.ts`, new `server/routes/demoClientGen.ts`, new
`server/demoGenerator/{providers,jobs,directions}.ts`, `shared/schema.ts` (P4),
`client/src/features/demos/components/NewDemoForm.tsx`, new `ProviderToggle.tsx`,
`DirectionsPicker.tsx`, optional `ClientSourceInputs.tsx`, new `api/clientGeneratorApi.ts`,
`hooks/useClientGenerator.ts`, `client/src/features/campaigns/components/clients/ClientActionsMenu.tsx`
+ `ClientsTab.tsx` + `api/demoClientsApi.ts` (P4), `client/src/locales/{en,nl,pt}/demos.json`.
Engine: `tools/site_kb.py`, `src/api/site_kb.py` (P4). DB: Prompt_Library 91 + new
`demo_client_directions` row.

## Open questions

1. Schema for P4: `generation_brief` + `source_language` columns OK? Store the raw scrape text too
   (up to 24k chars) so an added language gets a KB written from the site, not from another KB?
2. The campaign Share dialog (`detailView/atoms.tsx:467`) still mints typed-niche links through
   create-link with the fallback (`routes/demo.ts:620-622`, reported as `generated:false`). Fail
   loudly there too?
3. Existing fallback Clients 65 (Real Coaching Co.) and 67 (HAYAI SUZUKI): delete, or regenerate
   through the new flow?
4. Direction cards in English only, or in the demo language?
