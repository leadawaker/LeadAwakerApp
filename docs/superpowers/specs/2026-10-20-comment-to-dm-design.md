# Comment-to-DM (Phase C, roadmap Project 3), safe by default

Date: 2026-10-20
Status: built on `feat/social-studio`, dry run by default, awaiting Gabriel's review

## Why

The live version of the Socials demo (`specs/social-reply-demo/`): someone comments a keyword on a
post, the account sends a private reply (DM), and the conversation continues in the CRM Chats page
under the Instagram type.

## Where the demo's engine lives (and what that means here)

The demo's conversation runs in the Python automations service: the browser talks to
`/api/web-demo/:token`, which Express proxies to the engine's `web_demo_routes.py` and
`inbound_handler.process_inbound`. Express has no AI conversation of its own. This build does not edit
or restart that service and could not read its `CLAUDE.md` (cloud build), so it treats it as a black box:

- Comment matching, the private reply, the DM log, opt-outs and the CRM rows are Express.
- **AI follow-up is recorded, not sent.** A rule can have it on; a reply from the person then writes an
  `ai_follow_up` log row `skipped / engine_not_connected`. Reason: the engine has no Instagram channel
  and adding one is an engine change. A person answers from the Chats page instead (below).
- The engine already has an Instagram DM webhook for account 1 (`instagram_routes.py`, Graph v19 on
  graph.facebook.com, plaintext `Accounts.instagram_*` columns). Untouched. See "Before live" for the
  callback URL question.

Assumed (not verified, engine not readable): the engine never picks up a lead that has no campaign and
`automation_status = 'paused'`, which is how the new `ig:` leads are created.

## Data (`script/create-social-studio-tables.mjs`, additive and idempotent)

| Table | What |
|---|---|
| `Social_Settings.dm_mode`, `dm_hourly_cap` | per account: `off` (default) / `dry_run` / `live`, and the cap (default 20) |
| `Social_Dm_Rules` | keyword (+ normalised), one published post (its `ig_media_id`) or all posts, first message, AI follow-up, active |
| `Social_Webhook_Events` | one row per `comment:<id>` / `message:<mid>`, unique: the dedupe (Meta delivers at least once) |
| `Social_Dm_Log` | every private reply, reply, inbound message, opt-out and AI follow-up, with mode and status; unique `(account, comment_id)` for private replies: one per comment, ever |
| `Social_Dm_Opt_Outs` | people who wrote a stop word |

## The switches (enforced in code)

- `effectiveDmMode` (`server/social/dmSafety.ts`): `live` only when the account says `live` AND
  `INSTAGRAM_DM_LIVE=1`; an account on `live` without the env switch behaves as dry run.
- The only two functions that can send (`sendPrivateReply`, `sendDirectMessage` in
  `server/social/igMessaging.ts`) call `assertLiveAllowed` before any request. Tests try every mode
  against every env value and count fetch calls; another test fails if any other server file builds the
  messages URL.
- Dry run writes the log only: no CRM lead, no Interaction, nothing sent.

## Flow

**Webhook** `/api/social/instagram/webhook` (`webhookRoutes.ts`): GET handshake with
`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`; POST checks `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with
`INSTAGRAM_APP_SECRET`, timing-safe), answers 200 straight away, then processes the delivery in a queue
(one at a time, so the cap and the "first reply" check see each other's writes).

**A comment** (`dmEngine.ts`): the connection by `entry.id` (the professional account id) -> dedupe ->
ignore the account's own comments -> mode `off` stops here -> the rule (a post's own keyword wins over an
"all posts" one; matching as the demo: case, accents and punctuation ignored, whole word) -> opted out?
-> within 7 days? -> under the hourly cap? -> insert the log row first (the unique index decides a
redelivery) -> dry run: done; live: private reply, then a lead `ig:<IG-scoped id>` (Source "Instagram",
no campaign, paused) with the comment as inbound and the reply as outbound Interaction. An error is
recorded on the log row, agency is told, nothing is retried.

**A DM** from someone the flow wrote to (others are ignored: the account's other DMs are not the CRM's
business): a stop word (`parar`, `pare`, `stop`, `sair`, `stoppen`, `unsubscribe`, alone or with one more
word) opts the person out and marks the lead `opted_out`; anything else is an inbound Interaction (live)
and an `inbound` log row (both modes). Agency is told on the first reply.

**A reply typed in Chats** to an `ig:` lead: `server/routes/conversations.ts` now hands it to
`deliverInstagramReply` instead of the Telegram default it would otherwise fall into. Same switches,
never to an opted-out person, only within 24 h of their last message, within the cap. Dry run marks the
Interaction `dry_run`.

**Chats.** `getConversationType` treats an `ig:` channel as Instagram, next to the demo's
`social_reply` campaigns.

## Meta reference (re-check before live)

`developers.facebook.com` does not resolve from the build sandbox, so the endpoint and limits were taken
from secondary write-ups of Meta's Private Replies and Send API references, all in
`server/social/igMessaging.ts`: `POST graph.instagram.com/v26.0/{ig-user-id}/messages` with
`recipient.comment_id` (private reply) or `recipient.id` (DM), token in the Authorization header; one
private reply per comment within 7 days; more only after the person replies, within 24 h; scopes
`instagram_business_manage_messages` and `instagram_business_manage_comments` (already granted);
webhook fields `comments` and `messages`.

## UI

Socials page, agency only, section "Comments to DM": the mode (live asks for an inline confirm and says
when the server switch is off), the webhook readiness, the hourly cap and how much of it was used, the
keywords (inline form, no dialog), and the latest 50 log rows.

## My calls

- Dry run writes no CRM rows (only the log), so Chats never fills with conversations that did not happen.
- Only people who got a private reply become leads; other DMs to the account are ignored.
- AI follow-up is a recorded flag until the engine gets an Instagram channel.
- A rule targets a published post (it has a media id) or all posts; a scheduled post cannot be picked yet.
- No retries: a failed private reply stays failed (Meta allows one per comment anyway).
