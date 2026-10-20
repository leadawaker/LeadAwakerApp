# Social studio build: Action Required (manual steps)

Branch: `feat/social-studio`, pushed to origin, **not merged**. Cut from `chore/studio-prompt` (= `main` plus the
build prompt and the copied source material). Built in a cloud session: no Pi, no pm2, no live database, no network
to Meta, HeyGen, Claude or Groq. Everything Instagram-, HeyGen-, AI- and DB-facing is tested against in-memory fakes;
the new storage SQL was also run against a throwaway local Postgres (details in section 4).

Specs (one per phase):
- A `docs/superpowers/specs/2026-10-20-socials-nav-page-design.md`
- B `docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md`
- C `docs/superpowers/specs/2026-10-20-comment-to-dm-design.md`
- D `docs/superpowers/specs/2026-10-20-insights-design.md`

**Type check: done in the cloud, passed.** `npx tsc --noEmit` reports 30 errors, all in files this branch does not
touch, and `main` has 31 (one fewer here because the old account Social tab is gone). Zero errors in any new or
changed file. No "run a type check" morning item.

## 0. Pi steps, in this order

1. [ ] Read the four specs and the "My calls" list (section 5). Merge when happy:
       `cd /home/gabriel/LeadAwakerApp && git fetch origin && git merge origin/feat/social-studio` into `main`.
2. [ ] **Tables first, before the restart** (the new code reads them; until they exist the new pages error and the
       insights job logs one warning per run): `node --env-file=.env script/create-social-studio-tables.mjs`.
       Additive and idempotent (`CREATE ... IF NOT EXISTS` only, no existing table or row touched). Prints the
       11 tables and their indexes. A second run changes nothing.
3. [ ] Seed Augusto (account 56), dry run first, then for real:
       `node --env-file=.env script/seed-social-studio.mjs --account 56 --data server/social/seedData/augusto.json --dry-run`
       then the same without `--dry-run`. Expect "Social_Settings: created" and "Social_Scripts: 10 added". Re-running
       adds nothing and never overwrites a field someone already filled in the CRM.
4. [ ] `.env` on the Pi:
       - `HEYGEN_API_KEY=<the value of HeyGen= in /home/gabriel/Video/.env>` (read-only use: list and download).
       - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<a new random string>` (e.g. `openssl rand -hex 24`), also typed into Meta (section 2).
       - `INSTAGRAM_APP_SECRET` is already set (Project 1); the webhook signature check uses it.
       - **Leave `INSTAGRAM_DM_LIVE` unset.** Without it no DM can be sent, whatever an account's mode says.
       - Optional, never on the live server: `DISABLE_BACKGROUND_JOBS=1` skips every background job (for a second
         test copy of the server on other ports).
5. [ ] `pm2 restart leadawaker`, then `pm2 logs leadawaker --lines 80 --nostream`. Expect, next to the existing lines,
       `[social-insights] started (1h)` and no import errors. Within 2 to 7 minutes the first insights run:
       `[social-insights] account 56: account (30 days), N media`. That first run backfills 30 days of account totals
       and the newest 50 media of Augusto's account with GET calls only.
6. [ ] Browser checks (section 3).
7. [ ] Meta dashboard (section 2), only when ready to try comment-to-DM.

## 1. What was built

### Phase A: Socials in the nav bar
- `/platform/social`, lazy page. Nav item "Socials" (pt "Redes sociais") in the nav bar (Engage group for agency;
  after Calendar for clients), the mobile bottom bar (clients with a free slot) or More page, and the command palette.
- Agency: account picker listing only accounts with Social on; it drives the global account switcher.
- Clients see their own account, only when Social is on; otherwise they are sent to Home (the server refuses too).
- The account workspace's `social` tab is gone. Old `?tab=social` links and notifications open Socials. New
  notifications link to `/platform/social?account=<id>` so an agency user lands on the right account.
- Integrations keeps Connect / Disconnect and the Social switch, plus a "Go to Socials" link once connected; the
  OAuth toast has "Open Socials".

### Phase B: caption writer and the studio
- **Create caption** in the post panel: 3 options from the linked script or a "What is this video about?" box,
  in the account's caption style (`Social_Settings.caption_style`, data not code). Saves and publishes nothing.
- **Studio** (agency): topic ideas, scripts by status, "Draft with AI" (the account's voice guide is the system
  prompt), send to the client, the client's answer, **Videos from HeyGen** (read-only, already-used marked, the mp4 is
  downloaded and checked like an upload), mp4 upload on a script, **Schedule post** with the caption writer reading
  the script.
- **Calendar** (month and week), **Sobre mim** (agency or Managers edit), **Settings** (caption style, voice guide).
- **Client home** (Manager, Viewer; pt-BR for Augusto): add a topic by typing or speaking, videos to approve (the
  existing approval flow, unchanged), scripts to answer, links to calendar and Sobre mim.
- Notifications: a new topic from the client to agency; "a script to look at" to the account's Managers; the
  client's answer to agency.

### Phase C: comment-to-DM (off by default)
- Webhook `/api/social/instagram/webhook` (GET handshake, POST with the `X-Hub-Signature-256` check).
- Keywords per account (one published post or all posts), first message, AI follow-up flag (recorded only).
- Modes off / dry run / live. **A real send needs the account on live AND `INSTAGRAM_DM_LIVE=1`**, enforced in the
  only two send functions; tests prove no request is made otherwise.
- Guards: dedupe, own comments ignored, stop words and the CRM's DNC flag, 7-day window, one private reply per
  comment and one message per person per keyword, hourly cap, errors recorded never retried.
- Live conversations become an `ig:<id>` lead with Interactions: Chats shows them under Instagram, and a reply typed
  there goes out through the same guards within 24 h of the person's last message.

### Phase D: insights
- Hourly job: media list, followers and account day totals every 6 h (30-day backfill on the first run), each media
  item hourly in its first 3 days, every 6 h after. Snapshots never duplicate. A metric Meta refuses is stored as a
  skip with Meta's reason.
- Socials page section Insights (agency, Managers, Viewers): 7/30-day tiles, follower trend, best weekday and hour
  (not enough data under 8 posts), every post in a table sortable by views.

## 2. Meta dashboard (Gabriel; nothing here was possible from the sandbox)

**Read this first.** The automations engine already has an Instagram DM webhook for account 1 (Lead Awaker) in
`/home/gabriel/automations/src/webhooks/instagram_routes.py` (Graph v19 on graph.facebook.com, the old plaintext
`Accounts.instagram_*` columns). Meta allows one callback URL per webhook object per app. Before changing anything,
look at which callback URL the Instagram webhooks of **this** app (the one with `INSTAGRAM_APP_ID`) point to:
- if it is empty or another app is used for the old setup: go ahead;
- if it is the engine's URL: setting the new URL cuts off the engine's DM webhook for account 1. Decide first.

Then:
- [ ] App dashboard > Instagram > Webhooks (API setup with Instagram business login): callback URL
      `https://app.leadawaker.com/api/social/instagram/webhook`, verify token = `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
      Meta calls the GET handshake; it answers with the challenge only when the token matches.
- [ ] Subscribe the fields `comments` and `messages`.
- [ ] The professional account must also be subscribed to the app's webhooks (Meta's "subscribed_apps" step for
      Instagram Login) for events to arrive for it. Check this in the dashboard after Augusto's connection; this
      build adds no call for it.
- [ ] Cloudflare must let Meta POST to `/api/social/instagram/webhook` (no challenge page), like `/media/social/*`.
- [ ] Development mode: Augusto (and anyone testing) must be an Instagram tester of the app for messaging.
      `instagram_business_manage_messages` and `instagram_business_manage_comments` are already in the granted
      scopes; App Review is needed before strangers' comments reach the app.
- [ ] **Before going live, re-check against Meta's docs** (`developers.facebook.com` did not resolve from the build
      sandbox; secondary write-ups were used): the private-reply call `POST graph.instagram.com/v26.0/{ig-user-id}/messages`
      with `recipient.comment_id` and a Bearer token, the 7-day window, one private reply per comment, follow-ups only
      within 24 h after the person replies, and the webhook payload shape (`entry[].changes[]` with `field: comments`,
      `entry[].messaging[]`). All constants live in `server/social/igMessaging.ts` and the parser in `dmEngine.ts`.

## 3. Check in the browser after the restart

Seen in a browser in the cloud (Chromium via Playwright, the real client on a Vite dev server, every `/api` call
answered by fixtures, no backend): screenshots in `.playwright-cli/` (uncommitted, not on the Pi). A1 to A7 (nav,
picker, Manager and Viewer, old tab link, 375 px dark), B1 to B6 (caption writer incl. error state, studio desktop and
375 px, schedule from a script, client home, review with a note, calendar month and week, Sobre mim, Viewer, settings),
C1 to C4 (comment-to-DM, live confirm, new keyword, Manager has no tab), D1 to D3 (insights desktop and 375 px dark).
Not seen against the real server and data. Please check:
- [ ] As agency: Socials in the nav bar, the picker shows only accounts with Social on, Augusto's posts listed.
- [ ] Impersonate the Manager of account 56: Socials opens on Início; the bottom bar has Redes sociais; no studio,
      settings or comment-to-DM tab; approve still works.
- [ ] Impersonate a Viewer: no buttons that change anything.
- [ ] An old notification link `/platform/accounts?tab=social` opens Socials.
- [ ] Studio: the seeded scripts (5) and ideas (5) appear; Videos from HeyGen lists his web-app videos (needs
      `HEYGEN_API_KEY`); "Use this video" on a test script downloads it (look for the file under
      `SOCIAL_UPLOAD_DIR/56/`), then Schedule post. **Use a time in the future and keep approval on**, or cancel the
      post afterwards: it is a real scheduled post.
- [ ] Create caption: on the post panel, type a line and press it. Takes up to a minute (Claude CLI, sonnet).
- [ ] Draft with AI on a script: up to two minutes (opus).
- [ ] Speak a topic as the Manager on a phone (Groq Whisper, Portuguese).
- [ ] Insights after the first run: tiles, follower trend after a second day, the posts table.
- [ ] 375 px and dark mode on the phone.
- [ ] Gabriel reviews the pt-BR strings (`client/src/locales/pt/social.json`) and the new client notification in
      `server/social/notify.ts` (`script_review`).

## 4. Tests and what was run

- **Node suites: 359 pass, 0 fail, 0 skipped** (`node --import tsx --test shared/*.test.ts server/social/*.test.ts
  client/src/features/social/lib/*.test.ts client/src/components/crm/navGates.test.ts
  client/src/features/leads/components/conversationType.test.ts`). Baseline before this build: 219.
- **Scratch Postgres** (local, in the sandbox, thrown away): both scripts run twice (idempotent: the second run adds
  nothing; a field edited between runs survived the re-seed). The new storage modules were exercised against it:
  settings upsert, topics and scripts scoped by account, the HeyGen pull unique index, webhook event dedupe, one
  private reply per comment via the partial unique index, opt-outs, the DM log, insights media upsert and post
  linking, snapshot upsert (same bucket replaced, never duplicated), `DISTINCT ON` latest values.
- **Wiring smoke** (scratch Postgres, the real route modules and live wiring mounted on an Express app): every new
  route answers 401 without a session; the webhook handshake echoes the challenge only with the right token; an
  unsigned POST gets 401, a signed one 200 and is processed through the real storage (`unknown_account` for an
  Instagram id with no connection).
- **Not run against a database:** the CRM writes of comment-to-DM (creating the `ig:` lead and its Interactions) and
  everything that needs the full Leads / Interactions tables. Only the in-memory fakes cover them.
- **Never run:** the server itself (no database in the sandbox), real Meta calls of any kind, HeyGen (the optional
  read-only manual check was skipped: no key in the cloud), the Claude CLI (caption and script prompts are tested with
  a fake model only), Groq transcription, microphone recording in a browser, the OAuth flow.
- Reviews: one reviewer subagent per phase; every finding was fixed (see the `fix(social)` commits).

## 5. My calls (decide or accept)

- A separate `Social_Settings` table, not columns on `Accounts`: Drizzle selects every Accounts column, so a new one
  would break the live app between the merge and the script.
- The agency account picker drives the global account switcher (one source of truth).
- Clients with a free bottom-bar slot (no voice line, like Augusto) get Socials in the bar; others find it on More.
- Caption writer: sonnet, 90 s; Draft with AI: opus, 150 s; both share a limit of 12 calls per user per 10 minutes.
- Augusto's caption style holds 3 **example** captions modelled on the findings, not copied from his profile (it could
  not be read from the sandbox). They are labelled as examples: replace them with 3 or 4 real recent captions in
  Socials > Settings. His Sobre mim is a short starting text for him to complete.
- Scripts: Gabriel writes; the Manager only answers scripts sent to him (with the version he saw: an edit since is
  refused); any edit after sending takes it back. Scheduled / published are read from the linked post.
- HeyGen thumbnails are not shown (they may be signed links); a film icon instead.
- Comment-to-DM: dry run writes only the log, no CRM rows; only people who got a private reply become leads; AI
  follow-up is recorded, not sent (the AI engine has no Instagram channel and was not to be edited); keywords are one
  word; one message per person per keyword.
- Insights: one hourly job; the follower trend is our own daily snapshots of `followers_count`; collected for every
  connected account; `plays` and `impressions` are not requested (removed by Meta in 2025).
- New chart token `--chart-wine` (light and dark), because the brand wine is too dark to read as a data mark.
- The build doc asked for commits signed "Co-Authored-By: Claude Sonnet 5.5"; the commits carry this session's
  actual attribution line instead.
- Design notes were written per phase; separate plan files under `docs/superpowers/plans/` were not.

## 6. Real-world test of comment-to-DM, when ready

1. [ ] Section 2 done, `pm2 logs` shows no webhook errors. Socials > Comments to DM on account 56 shows no
       "webhook is not set up" warning.
2. [ ] Mode **Dry run**. Add a keyword (e.g. `GUIA`) on one published Reel with a short first message.
3. [ ] From a tester account (not Augusto's), comment "guia!" on that Reel. Within seconds the log shows
       "Private reply · Would send" with the text. Nothing arrives in the tester's DMs.
4. [ ] Comment again: "already got this keyword's message". Comment something else: nothing.
5. [ ] Only when the log looks right: set `INSTAGRAM_DM_LIVE=1` in `.env`, `pm2 restart leadawaker`, switch the
       account to **Live** (it asks to confirm). Comment from another tester account. Expected: one DM arrives, the
       log says "Sent", Chats shows the conversation under Instagram.
6. [ ] Reply from the tester in DM: it appears in Chats; answer from Chats within 24 h: it arrives.
7. [ ] Reply "parar": the person is opted out; a new comment from them gets nothing.
8. [ ] To stop everything at once: remove `INSTAGRAM_DM_LIVE` and restart (live accounts fall back to dry run), or
       switch the account to Off.

## 7. Left for later (not built)

- AI follow-up in DMs: needs an Instagram channel in the Python engine (send and receive through
  `server/social/igMessaging.ts` or its own), then the rule flag can hand replies to it.
- A HeyGen key per account (today one env var, Augusto's HeyGen account). Creating or translating videos in HeyGen
  (costs money; deliberately absent).
- Transcribing an uploaded video for the caption writer.
- Keywords on posts that are scheduled but not live yet.
- Webhook subscription of the professional account by API (done by hand in the dashboard for now).
