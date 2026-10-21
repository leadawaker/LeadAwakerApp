# Overnight build: Socials in the nav bar + Augusto's studio, comment-to-DM, insights

You are an autonomous builder. Gabriel is asleep and will not answer questions. Everything he would
have decided is decided below. Where something is open, pick the sensible default, write it down as
"my call" in the spec, and keep going. Never stop to ask. Never wait for approval: this document IS
the approval of scope. Read it fully before touching anything.

Why this exists: Project 1 (Instagram connect + scheduled Reel publishing) is live on `main` and
works (Augusto's account is id 56, connection id 2, Manager user id 41). What is missing is the
rest of the roadmap and one UX fix. Goal for tomorrow morning: Gabriel opens the CRM and finds
Socials in the left nav, a caption writer, Augusto's studio, comment-to-DM (safe, dry-run) and
insights, all on a branch he can review and merge.

## Run mode: decide this first

- **Cloud mode** (you are in a cloud sandbox, `/home/gabriel` does not exist): this is the intended mode.
- **Pi mode** (you run on Gabriel's Raspberry Pi): follow section 0 exactly as written.

**In cloud mode these overrides apply, everything else in this document stands:**
- You work in your own clone. Create `feat/social-studio` from `main`, push that branch to `origin`, never
  push or merge `main`. Section 0 rules 1 and 3 do not apply (no live checkout, no live jobs). Rule 2 reduces
  to: never touch `main`.
- **Type checking is allowed and expected.** The memory limit that forbids `tsc` is the Pi's, not yours. Run
  `npx tsc --noEmit` at the end of every phase and fix every error you caused. `npm install` is fine.
- **No database, no network to Meta, HeyGen or Claude.** Rule 4 becomes: fakes everywhere, no real calls of any
  kind. Rule 6 becomes: write the idempotent DB scripts and the seed scripts but do not run them against any real
  database (none is reachable). If the sandbox has a local Postgres, you may run them against a scratch database
  to prove they work and are idempotent.
- **Files under `/home/gabriel/` are not available to you.** Everything you need from there was copied into the
  repo under `specs/social-studio/source/`:
  `source/video-scripts/*.md` (Augusto's 5 scripts), `source/themes.md`, `source/reference/voice-guide.md`,
  `source/reference/elevenlabs-v4.md`, `source/reference/heygen-web.md`, `source/reference/heygen-api.md`.
  Wherever this document points to `/home/gabriel/augusto-avatar/...`, read the copy there instead. Seed scripts
  must read from `specs/social-studio/source/` (copy the needed text into `server/` seed data files), never from
  an absolute path. `/home/gabriel/automations/CLAUDE.md` is unavailable: treat the Python engine as a black box,
  read the Express side only, and note in the spec what you assumed.
- **The HeyGen manual API check and any "run against the real X" step are skipped.** Do not ask for keys.
- **Browser verification:** try to run the client with a mocked API and `playwright-cli` (375 px, dark mode). If the
  sandbox cannot do it, say plainly in the final file that the UI was not seen in a browser. Never claim
  verification you did not do.
- **Finish line changes:** the "run a type check" morning item disappears if `tsc` passed (say so with the
  result). `action-required.md` lives on the branch only. Add a "Pi steps" section at the top: merge, run the
  new scripts on the Pi database, set env vars (`HEYGEN_API_KEY`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, leave
  `INSTAGRAM_DM_LIVE` unset), `pm2 restart leadawaker`, check logs, browser check, Meta dashboard steps.

## 0. Safety rules (read twice, these override everything below)

1. **`/home/gabriel/LeadAwakerApp` is LIVE.** The Pi runs `main` there under pm2 with tsx watch, so
   saving any file in that checkout reloads production. **Do all work in a git worktree**:
   `cd /home/gabriel/LeadAwakerApp && git worktree add ../LeadAwakerApp-studio -b feat/social-studio main`.
   That checkout has uncommitted edits by another session (voice files). Never touch, stash, reset
   or commit them. Never edit files in the main checkout except creating files under `specs/social-studio/`.
2. **Never push to `main`, never merge into `main`, never `pm2 restart`/`pm2 stop` anything.** You may
   `git push -u origin feat/social-studio` (branches do not deploy). Gabriel merges.
3. **Never start a second full server against the live database with the background jobs on.** The
   social publisher runs every 60s and would publish Augusto's scheduled posts a second time, from
   your process. Before you run any dev server, find how to disable the jobs (look in `server/index.ts`
   and wherever `[social-publisher] started` is logged). If there is no switch, add an env flag
   `DISABLE_BACKGROUND_JOBS=1` that skips every setInterval job, in the worktree, and use it. Run your
   dev server on non-production ports (not 5000 or 5001).
4. **Never publish, send or post anything real.** No `media_publish`, no real DMs, no real comment
   replies, no ElevenLabs calls, no calls with Augusto's Instagram token. HeyGen: only the read-only calls
   described in B2 (list, get, download an existing video). Never create, translate, regenerate or POST
   anything to HeyGen: generation spends money. All
   Instagram-facing code is tested against in-memory fakes, like Project 1's tests.
5. **Never read, print or log an access token.** (A token leaked into a transcript earlier today
   through a paging URL. Strip `paging.next` and any URL containing `access_token` from anything you
   print.) Do not touch Augusto's `Social_Connections` row or his `Social_Posts` rows.
6. **Database changes are additive and idempotent only**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF
   NOT EXISTS`, in a script under `script/` modelled on `script/create-social-tables.mjs`. Never drop,
   rename, alter existing columns or rewrite existing rows. Tables are shared with production, so
   anything you add must be inert until the new code runs. UI tests use a throwaway test account you
   create and delete yourself, never Augusto's (account 56) or any real client.
7. **Never run `tsc` or `npx tsc`.** It OOMs the Pi. Verification is: `node --import tsx --test ...`
   for the suites, esbuild syntax checks on every file you touch, and running the UI. List "run a
   type check" as a morning item. Never run `npm install` in the main checkout (it overwrites the tsc
   wrapper). In the worktree, symlink `node_modules` and `.env` from the main checkout instead.
8. **Do not build the parked avatar photo generator** (`specs/instagram/parked-avatar-generator.md`).
   Gabriel said not to until he picks it up.
9. Writing rules for everything you produce (code comments, UI text, docs, commit messages): **no em
   dashes**. Use colons, periods, commas or parentheses.

## 1. How to work

- Skills to load first: `leadawaker-dev` (design system, mobile-first, i18n, file layout), then for
  each project: `superpowers:writing-plans`, `superpowers:subagent-driven-development`,
  `superpowers:test-driven-development`, `superpowers:verification-before-completion`. Skip the
  interactive part of `superpowers:brainstorming`: scope is already approved here. Still write the
  design document, and still run its builder check with a subagent (dispatch it, apply the answers
  yourself, never forward questions to Gabriel).
- Read first: `UI_STANDARDS.md`, `UI_PATTERNS.md`, `FILE_MAP.md`, the Project 1 spec and plan
  (`docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md`, `docs/superpowers/plans/...`),
  `specs/instagram/action-required.md`, everything under `server/social/` and
  `client/src/features/social/`. Build on what exists: same store/service/route layering, same
  `accountGate` access rules (agency, Manager, Viewer), same neumorphic wine design system, same i18n
  namespaces under `client/src/locales/{en,nl,pt}/`. Portuguese is Brazilian.
- Per project: spec in `docs/superpowers/specs/2026-10-DD-<topic>-design.md`, plan in
  `docs/superpowers/plans/`, then implement with subagents (max 4 in parallel, none running tsc),
  tests first where logic exists, small commits on `feat/social-studio` ending with the line
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Run `/code-review`-style review
  (a reviewer subagent) after each project and fix what it finds.
- Mobile first, 375 px and dark mode. Right-panels or drawers for forms (never Dialog for create or
  edit). New pages are `React.lazy` in `client/src/pages/app.tsx` and `App.tsx`. No raw hex, use
  tokens. 36px circle controls via `IconBtn`. Files under 500 lines: split into hooks, libs, subcomponents.
- Verify UI for real with `playwright-cli` against your own dev server (non-production ports, jobs
  disabled, see rule 3): the nav item, each new screen, at 375 px and in dark mode. Screenshots go in
  `.playwright-cli/` (uncommitted).
- Order: Phase A, then B, then C, then D. **Finish each phase to a clean, tested state before starting
  the next. Never leave a half-built feature reachable.** If you run low on budget, stop at a phase
  boundary and write down exactly what is left in the final file (section 6).

## 2. Phase A: Socials in the left nav bar

Gabriel's request: "I want Socials on the left menu bar, not tucked within the account."

Today: a `social` tab inside the account workspace (`AccountsWorkspace.tsx`, `ACCOUNT_TABS`, using
`SocialTab.tsx`), and the Connect Instagram card in Integrations. Make Socials a top-level page.

- New route `/platform/social` (and the agency/client prefixes the other pages use, check `RightSidebar.tsx`
  `prefix` handling) and a nav item with a social icon (add a `social` key to `ClientNavKey` and
  `AgencyBarKey` in `navGates.ts`, an icon in `navIcons.ts`, labels in the sidebar locale files).
  Show it in the left nav (`RightSidebar.tsx`), the mobile bottom bar or More page, and the command palette.
- Visibility: agency users always. Client users (Manager, Viewer) only when Social is enabled for their
  account (reuse `useSocialStatus` and `showSocialTab` from `features/social/lib/posts.ts`). Update
  `navGates.test.ts` for the new key. Follow `navVisibility.ts` for the gate shape.
- The page reuses the existing Social UI. An agency user needs an account picker at the top of the
  page (the global account switcher if the shell has one, otherwise a compact selector listing only
  accounts with Social enabled). A client user sees their own account, no picker.
- Remove the `social` tab from the account workspace tabs. Keep the Connect/Disconnect card and the
  Social on/off switch in Integrations (that is account setup, not daily use), and add a visible
  "Go to Socials" link from the card to the new page once connected. Keep the
  `/platform/accounts?instagram=...` return flow working (the OAuth callback redirects there with
  `?instagram=connected|error&reason=...`): after the toast it may link on to Socials.
- i18n for all three languages. Done when: agency sees the nav item, picks Augusto, sees his posts;
  a Manager of account 56 impersonated sees only their account's Socials; Viewer has no write buttons;
  the old tab is gone; nothing else in the nav changed.

## 3. Phase B: "Create caption" button and Augusto's avatar studio (roadmap Project 2)

### B1. Create caption (build this first, it is small and useful immediately)
In the New post / Edit post panel (`PostSheet.tsx`), next to the caption field, a **Create caption**
button. It returns 3 caption options for the video, written in the account's caption style, shown as
choices to pick and edit. Picking one fills the field. Nothing is saved or published by the button.

- Input: the linked script text if the post is linked to a studio script (B2), otherwise a free-text
  box "What is this video about?" that the button reads (the panel must offer one, a pasted script or
  a topic line). No video transcription in this build (no speech-to-text service is available).
- Generation: follow how existing generators call Claude (`server/aiTextHelper.ts`,
  `server/offerIdeasGenerator.ts`, `claude -p`). Read them and reuse the helper. Server endpoint under
  `/api/social/accounts/:id/captions/suggest`, agency and Manager only, rate limited, timeouts handled,
  clear error text in the UI on failure, never blocks the panel.
- **Style is data, not code.** Add a per-account `caption_style` text field (additive column on
  `Accounts`, or a small `Social_Settings` table: your call) editable in the Socials page settings by
  agency. Seed Augusto's from the findings below via a script, never hardcode him in code. Findings
  from his real profile `@draugustobfronza` (4,171 followers, bio "Dr. Augusto Fronza | Especialista
  em Emagrecimento e Longevidade", "CRM 28148/SC"), read on 2026-10-20:
  - His 2026 captions are sober: no alert emoji, 3 to 5 hashtags, hook is often a patient question in
    quotes ("Posso continuar comendo normal tomando tirzepatida?"), body in short paragraphs, closes
    with a question to the audience and "salva esse post". Posts from 2025 used a 🚨 hook, 👉 and 📲
    bullets, "agende sua consulta (link na bio)" and the disclaimer
    "Vídeo informativo. Não substitui uma consulta médica." (that disclaimer is his habit, keep it).
  - In captions he writes the generic names **tirzepatida** and **semaglutida** and "canetas
    emagrecedoras", not brand names (the spoken video says Mounjaro and Ozempic, that is fine, only the
    caption differs). His call to action is booking: "agende sua avaliação (link na bio)".
  - `#draugustofronza` appears in most captions. Portuguese (Brazil), "teu/tua" is for speech, captions
    use "você/seu". Never promise results, never make claims stronger than the script.
  - Pass the style text plus 3 to 4 of his real recent captions as examples into the prompt (store the
    examples in the style text, not in code).
- Tests: prompt builder and response parsing with a fake Claude (no real calls in tests). The UI states:
  idle, loading, 3 options, error.

### B2. Augusto's studio (agency view + his phone view)
Scope from the roadmap: Augusto supplies topics and approves videos; Gabriel stays in control of
scripts. Data lives in new tables (additive script, rule 6). Built as sections of the Socials page,
not a separate app.

- **Topic ideas (Augusto's view).** A Manager can add a topic idea by typing or by voice. For voice,
  reuse the existing voice-note recorder and transcription path (`client/src/lib/voiceRecorder.ts`, the
  `leadawaker-voice-note-result` flow, and its server endpoint). Read how it works and reuse it, adapt
  it for pt-BR if a language setting exists. If it is Owner-only, build a Manager-allowed variant at
  the endpoint level, behind `accountGate`.
- **Script pipeline (agency view).** A script has: title (the theme), body, status
  `idea -> draft -> approved -> video_ready -> scheduled -> published`, the topic it came from, and an
  optional linked post. Gabriel can **write a script in the platform** with a "Draft a script" action
  that calls Claude (same helper as B1) using the account's **voice guide** as the system prompt. The
  voice guide is data (per-account field next to `caption_style`), seeded from
  `/home/gabriel/augusto-avatar/reference/voice-guide.md` and `reference/elevenlabs-v4.md`. Import his
  five existing scripts from `/home/gabriel/augusto-avatar/scripts/*.md` and the theme list
  `/home/gabriel/augusto-avatar/themes.md` (10 themes) with a seed script (idempotent, status mapped
  from the file headers: "final" or "approved" -> approved, "draft" -> draft). Do not edit files in
  `/home/gabriel/augusto-avatar`.
- **Video pull (HeyGen), read-only.** Verified 2026-10-20: Gabriel's existing HeyGen API key lists the
  videos made in the HeyGen web app (`GET https://api.heygen.com/v3/videos?limit=N`, header `X-Api-Key`)
  even though its API wallet balance is 0, because reading costs nothing. Each item has `id`, `title`,
  `status`, `duration`, `created_at`, `thumbnail_url`, `video_page_url` and a presigned `video_url` (the
  mp4, the link expires, so download it, never store the link). Docs: https://developers.heygen.com/reference/list-videos.md
  and https://developers.heygen.com/video-details.md (fetch them to confirm paging and the single-video
  endpoint). Build this:
  - A server module `server/social/heygen.ts` with `listVideos`, `getVideo` and `downloadVideo`, GET only,
    key from env `HEYGEN_API_KEY` (never from a file at runtime, never logged, strip query strings from any
    URL you log), injectable fetch for tests. No create, translate or POST calls exist in the module.
  - In the studio (agency view): a "Videos from HeyGen" list (title, length, date, thumbnail, status
    "completed" only selectable) with a **Use this video** button on a script. The server downloads the mp4,
    stores it exactly like a Reel upload (same paths, same `inspectVideo` and Reel spec checks, same
    `uploadId`), then offers "Schedule post" with the caption writer prefilled from the script. Remember
    which HeyGen video ids were already pulled so the list can mark them "already used". Handle the link
    expiring mid-download by re-fetching `getVideo` once.
  - The manual path stays: dropping an mp4 on the script uses the existing upload endpoint.
  - Works for any account later: the key is a single env var for now (Augusto's HeyGen account). Put the
    per-account key idea in the spec as future work, do not build it.
  - Testing: unit tests with a fake fetch. You may do ONE manual read-only check against the real API
    (list 5 videos, download one short video into a temp dir, delete it) using the key from
    `/home/gabriel/Video/.env` (variable `HeyGen`), read into the environment of that one command and
    never printed. Never call any other HeyGen endpoint. Optional, only if it is cheap; the fakes are enough.
  - Morning item for Gabriel: add `HEYGEN_API_KEY` to the Pi `.env`.
- **Calendar.** A simple month/week view of scheduled and published posts for the account (the Reel
  data already exists), usable on a phone.
- **"Sobre mim" (Augusto's view).** A short profile page he can edit (bio facts, credentials, services,
  things never to say). It feeds the caption and script prompts as extra context. Per-account text, edited
  by Augusto or agency.
- **Augusto's phone view.** For a Manager the Socials page opens on a phone-first home: add a topic,
  see scripts waiting on him, videos waiting for approval (the existing approve/reject flow), the calendar,
  Sobre mim. Portuguese. Gabriel's view is the fuller agency layout. Same page, role-aware, mobile-first.
- Approval before posting already exists (Project 1, keep it, do not weaken it).
- Notifications: reuse `server/social/notify.ts` for "new topic from Augusto" (to agency) and "script ready
  for your video" if it fits. Keep it small.

## 4. Phase C: Comment-to-DM (roadmap Project 3), safe by default

Goal: a live version of the Socials demo in `specs/social-reply-demo/` (`requirements.md`,
`implementation-plan.md`, `action-required.md`; read all three, and the existing reply engine behind
the `social_reply` campaign type, prompt 108 and demo Chats under Instagram type). A viewer comments
a keyword on a post, the account sends a private reply (DM) via the Instagram API, and the
conversation continues in the CRM Chats page under the Instagram type, with the AI qualifying and
booking as in the demo.

- Before touching anything about AI conversations or campaigns, read `/home/gabriel/automations/CLAUDE.md`
  (the campaign and AI-conversation engine is a separate Python service, do not edit it, and do not
  restart it). Find out whether the demo's reply engine lives in Express or in that service and build
  on it from the Express side only.
- **Rules per post:** for a published post (or all posts), a keyword (case and punctuation
  insensitive, matching how the demo normalises, `kozijn!` matched `KOZIJN`), a first-message
  template, optional AI follow-up. Stored in new tables. UI inside the Socials page, agency only.
- **Webhook:** `/api/social/instagram/webhook` with Meta's GET verify handshake (verify token from
  env `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`) and POST with `X-Hub-Signature-256` HMAC check using the app
  secret (follow `server/social/signedRequest.ts` for the style). Subscribe to the `comments` and
  `messages` fields. Dedupe on comment id and message id (unique indexes). Ignore comments by the
  account itself. Respond 200 fast, process async.
- **Sending:** private reply to a comment via the Instagram messaging endpoint (`recipient` with
  `comment_id`), then normal replies inside the 24h window. **Check the current Meta reference with
  WebFetch** for endpoint names, the 7-day private-reply window, one private reply per comment, and the
  required scopes (`instagram_business_manage_messages` and `instagram_business_manage_comments` are
  already in the granted scope list). Put the endpoint constants in one file like `AI_LABEL_PARAM`.
- **DRY-RUN IS THE DEFAULT AND IS ENFORCED IN CODE.** A per-account `dm_mode` of `off | dry_run | live`,
  default `off`, and a global env kill switch `INSTAGRAM_DM_LIVE=1` that must ALSO be set for any real
  send (a real send needs both). In `dry_run` the system processes events, matches keywords and writes
  what it would have sent to a log table the UI shows, and sends nothing. Tests must prove that without
  both switches no network call to Meta is possible.
- Safety: per-account hourly send cap, do not message the same person twice for the same comment, a
  stop-word opt-out ("parar", "stop", "sair") that blocks further automated messages to that person,
  never send to private accounts of unknown state without an error path, errors recorded not retried
  forever. Chats from this appear in the existing CRM Chats under the Instagram type: reuse the
  Interactions tables and the demo's thread shape, do not invent a parallel inbox.
- Manual steps for Gabriel (put them in the final file, you cannot do them): Meta dashboard webhook
  callback URL + verify token, subscribing the comments and messages fields, adding the Instagram tester
  permission for messaging, and a real-world test plan with the DM mode flipped to live.

## 5. Phase D: Insights (roadmap Project 4)

- Collect, per account, with the existing `instagram_business_manage_insights` scope (already granted):
  account insights (reach, views, profile visits, follower count over time as the API offers) and
  per-post insights for published Reels (views, reach, likes, comments, shares, saves, plays, average
  watch time, skip rate if available). **Verify metric names against the current Meta reference with
  WebFetch** (they change between API versions and Reels metrics differ from feed metrics), keep the list
  in one constants file, and make an unsupported metric a recorded skip, never a crash.
- Store snapshots in a new table (post id, metric, value, captured_at) so growth over time is visible.
  A job like `server/social/tokenRefresher.ts` (same pattern, start/stop, jitter, errors logged, disabled
  by the rule 3 flag) refreshes every 6 hours, and a post is polled more often in its first 3 days.
  Posts published before this existed: backfill the account's recent media on first run.
- UI: an Insights section in the Socials page. Use the `dataviz` skill before writing any chart. Show:
  headline numbers for the last 7/30 days, a per-post table (sortable by views), follower trend, best
  weekday and hour to post (computed from the data, say "not enough data" under a threshold). Mobile
  first. Portuguese labels for Augusto, English/Dutch for Gabriel (i18n like everything else).
- Tests with a fake Graph client: parsing, unsupported metrics, snapshot idempotency, backfill.

## 6. Finish line (do this even if you stopped early)

1. All suites pass: `node --import tsx --test shared/*.test.ts server/social/*.test.ts <your new test dirs>`.
   Report the pass and fail counts honestly, including any skipped tests and why.
2. Branch `feat/social-studio` pushed. Not merged.
3. Write `specs/social-studio/action-required.md` in the same format as `specs/instagram/action-required.md`:
   what was built per phase, what was verified in a browser (screenshots list), what was NOT verified, the
   decisions you made ("my call" list), the idempotent DB scripts to run on the Pi (and whether you ran them
   on the live DB), env vars to set, Meta dashboard steps, the morning merge steps
   (`git merge feat/social-studio` into `main`, `pm2 restart leadawaker`, check logs), and "run a type
   check once" at the top. Put it in the main checkout's `specs/social-studio/` as an uncommitted file AND
   commit a copy on the branch.
4. Do not message Gabriel with questions. Your last message is a short, honest summary: what works, what
   is untested, what is left, in that order.

## Facts you will need

- Stack: React + Vite client in `client/`, Express + TypeScript in `server/`, Postgres schema
  `p2mxx34fvbf3ll6`, Drizzle, shared types in `shared/schema.ts`. Pi runs `main` via pm2 (`leadawaker`).
- Social tables exist: `Social_Connections`, `Social_Posts`; `Accounts.social_enabled`. Augusto: account 56
  ("Augusto", `America/Sao_Paulo`, Portuguese), Manager user 41, IG `draugustobfronza`, connection id 2.
  Gabriel has already scheduled a real test post there. Leave account 56 data alone.
- Test videos exist in `/home/gabriel/augusto-avatar/reels/` (read-only for you, use a short synthetic clip
  made with ffmpeg for tests instead).
- Gabriel's rules: never auto-run tsc, no em dashes, files under 500 lines, offload research to
  subagents, mobile-first, never push `main`.
