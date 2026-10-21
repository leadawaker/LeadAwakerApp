# Caption writer and Augusto's studio (Phase B, roadmap Project 2)

Date: 2026-10-20
Status: built on `feat/social-studio`, awaiting Gabriel's review

## Why

Augusto supplies topics and approves videos; Gabriel stays in control of scripts and posting. The
pieces were scattered (scripts in markdown files on the Pi, videos in the HeyGen web app, captions
typed by hand). This puts them on the Socials page, for any account, with Augusto's material as data.

## Data (all new tables, `script/create-social-studio-tables.mjs`, additive and idempotent)

| Table | What |
|---|---|
| `Social_Settings` | one row per account: `caption_style`, `voice_guide` (agency), `about_me` (agency or Managers), `dm_mode`, `dm_hourly_cap` (Phase C) |
| `Social_Topics` | topic ideas: text, `source` typed / voice / seed, `status` new / used / dismissed, the script made from it |
| `Social_Scripts` | title (the theme), body, status `idea -> draft -> approved -> video_ready -> scheduled -> published`, topic, linked post, `video_upload_id` (a pulled or uploaded mp4 waiting to be scheduled), `heygen_video_id`, the Manager's review (`none / waiting / ok / changes` + note), `seed_key` |
| `Social_Heygen_Pulls` | HeyGen videos already downloaded per account (unique), so the list marks them "already used" |

My call: a separate `Social_Settings` table instead of columns on `Accounts`. Drizzle selects every
`Accounts` column in every account query, so a new column there would break the live app between the
merge and running the script. A new table is only read by the new routes.

`scheduled` and `published` are not stored by hand: a script shows its linked post's state
(`effectiveScriptStatus` in `shared/socialStudio.ts`). Agency sets `idea / draft / approved` by hand;
`video_ready` follows a video.

## B1. Create caption

- `POST /api/social/accounts/:id/captions/suggest` with `{ scriptId }` (a linked studio script) or
  `{ about }` (the "What is this video about?" box, a pasted script or one line). Agency or a Manager.
- `claudeJson` (sonnet, 90 s, JSON schema of exactly 3 strings) from `server/aiTextHelper.ts`, the same
  isolated CLI call the other generators use. Prompt: `server/social/captions.ts`. The style comes from
  `Social_Settings.caption_style`, Sobre mim is added as facts, the language is the account's.
- Options are checked against Meta's limits (2,200 characters, 30 hashtags, 20 mentions) and deduplicated.
- Rate limit: 12 AI calls per user per 10 minutes, shared with "Draft with AI", one call in flight per user.
  Errors have their own messages (`no_input`, `ai_failed`, `no_options`, `rate_limited`, `busy`).
- Nothing is saved or published. Picking an option fills the caption field, still editable.
- No transcription of the video itself (no speech-to-text for video in this build).

## B2. Studio

- **Topics.** Agency or a Manager adds one, typed or spoken. Spoken: the browser records (same
  MediaRecorder and base64 path as the nav-bar voice note), `POST /topics/transcribe` sends it to Groq
  Whisper in the account's language (`whisperLanguage`: Portuguese -> `pt`). The Groq call moved to
  `server/lib/groqTranscribe.ts` and the Owner voice note uses it too. The Owner-only rule stays on the
  Owner endpoint; the Socials endpoint is behind the account gate and `canManageSocial`. A topic from a
  client notifies agency (`social_topic_new`).
- **Scripts.** Agency only: create (optionally from a topic, which is then marked used), edit, "Draft
  with AI" (claudeJson opus, 150 s, the account's `voice_guide` IS the system prompt, plus Sobre mim and
  the closing lines of the other scripts so a close is not reused), mark approved, send to the Manager
  (`social_script_review` to the account's Managers, in their language). Editing the body after the
  Manager answered drops the review back to "not sent".
- **The Manager's answer.** He sees only scripts sent to him. "Good to go" approves a draft; "Ask for
  changes" needs a note. Agency is told.
- **HeyGen, read-only.** `server/social/heygen.ts`: `listVideos`, `getVideo`, `downloadVideo`, GET only
  (a test reads the source and fails on any other method), key from `HEYGEN_API_KEY` only, sent only to
  `api.heygen.com` (the presigned download gets no key), any logged URL has its query string removed.
  The list sent to the browser never contains the presigned link. "Use this video" on a script:
  `server/social/heygenPull.ts` downloads through the same `receiveVideo` as a browser upload (size limit,
  faststart, probe, Reel spec check) into `<SOCIAL_UPLOAD_DIR>/<account>/<uuid>.mp4`, so the post is
  created with the existing `uploadId` flow. A link that expires (refused, or the stream dies) is read
  again once for a fresh link. Two pulls of one video at once: the unique index decides.
  Paging (`limit`, `token`, `next_token`, `has_more`) and `GET /v3/videos/{id}` were confirmed against
  HeyGen's reference through search; the docs host does not resolve from the build sandbox, so the
  parser accepts the documented shape and the obvious variants.
- **Manual path.** "Upload an mp4" on a script uses the existing upload endpoint, then attaches it.
- **Schedule post.** Opens the existing post panel with the script's video attached and the caption
  writer reading the script. When the post is created the script is linked to it and gives up the video.
- **Upload cleanup.** The 6-hourly cleanup deletes uploads older than 24 h that no post uses. It now also
  keeps a file a script still holds (a pulled video waiting a few days to be scheduled).
- **Calendar.** Month and week views of the account's posts, in the account's zone, a dot per post on
  the month grid and the picked day's posts below it. Phone first.
- **Sobre mim.** Per-account text, agency or Managers edit, Viewers read. Feeds both prompts.
- **Client home.** Managers and Viewers open the Socials page on Home: add a topic (Managers), videos
  waiting for approval (the existing approve / reject cards, unchanged), scripts waiting on them, links to
  the calendar and Sobre mim. Agency gets Posts, Studio, Calendar, About me, Settings.
- Approval before posting is unchanged (Project 1).

## Seed (Augusto)

`script/seed-social-studio.mjs --account 56 --data server/social/seedData/augusto.json`. The data file is
a copy of `specs/social-studio/source/` (voice guide + ElevenLabs v4 rules as the voice guide, the caption
findings from his profile as the caption style, a first Sobre mim, the 5 scripts with their status from
the file headers, themes 6 to 10 as ideas). Settings fields are only filled while empty, scripts are keyed
by `seed_key`, so re-running adds nothing. Proven twice against a scratch Postgres in the sandbox.

My call: the 3 example captions in the style are modelled on the findings, not copied from his profile
(the profile could not be read from the sandbox). They are labelled as such; replace them with 3 or 4
real recent captions.

## Future work (not built)

- A HeyGen key per account (today one env var, Augusto's HeyGen account).
- Transcribing an uploaded video for the caption writer.
- Creating or translating videos in HeyGen (costs money; deliberately absent).
