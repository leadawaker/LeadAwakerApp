# Reputation v2 — Public Review Response — Implementation Plan

> Paths verified against the current tree (this session). CRM = `/home/gabriel/LeadAwakerApp/`,
> Engine = `/home/gabriel/automations/`. Reuses the existing Google OAuth integration and the v1
> reputation surfaces.

## Architecture decision: Google API I/O in the CRM server, co-located with the existing Google integrations

- **Put the Google Business Profile integration in the CRM Express server**, next to
  `server/calendar/google.ts` and `server/gmail.ts`, because **OAuth consent + token refresh already
  live there**. This avoids duplicating Google token-refresh logic in Python.
- **AI drafting** uses Prompt_Library + the OpenAI **EU** endpoint. Two clean options (pick one in
  action-required): the CRM server calls OpenAI EU directly, **or** it delegates drafting to the engine
  (`ai_service` + prompt cascade) so all AI sits in one place. Recommendation: keep AI in the engine
  for consistency, CRM owns Google I/O + the approval UI.
- **Approval + posting** in the CRM (it holds the tokens). Human approves → CRM posts via the Business
  Profile API.
- **Alternative considered — an engine poller job** (like `reputation_scheduler.py`, reading tokens
  from the DB): rejected to avoid re-implementing Google OAuth refresh in Python. Revisit only if we
  want every scheduled job in the engine.

Net: the existing Google OAuth, v1 reputation settings, AI plumbing, notifications, and logging are
reused; new code is the Business Profile client, a poller, a drafting call, an approval surface, and
the `Account_Reviews` table.

## Phase 1 — Connect → poll → draft → approve → post (Google only)

**a) Connect (OAuth)** — `server/reviews/google.ts`, mirroring `server/calendar/google.ts`: add the
`business.manage` scope, run consent, store tokens + the chosen location (reuse the existing Google
token storage). UI: a **"Google Business Profile" connect card** added to `ReputationSettingsPanel.tsx`
(reuse the calendar OAuth connect-button pattern), plus `enable_review_response` and
`review_reply_auto_positive` toggles.

**b) Poll** — a scheduled CRM task (node-cron / interval) or Google **Pub/Sub** push: for each
connected location, `reviews.list`, dedup by `external_review_id`, insert new rows
(`status='new'`). Interval ≥ 15–30 min (NFR).

**c) Draft** — for each `new` review, generate a reply via `system:review-reply` (engine AI or server
OpenAI EU), set `draft_reply` + `status='drafted'`. For negatives/neutrals, notify
`reputation_alert_target` via `broadcastToUser`. Reply language = review language (en/nl).

**d) Approve** — CRM routes (`server/routes/reviews.ts`, `requireAgency`): `GET
/api/accounts/:id/reviews?status=drafted` (queue), `PATCH /api/reviews/:id` (edit/approve/reject). On
approve → post.

**e) Post** — `reviews.updateReply` via `server/reviews/google.ts`; `status='posted'`,
`posted_at=new Date()` (server-side). Positives with `review_reply_auto_positive=true` skip the queue
and post on draft.

**f) Log** — `AsyncLogStep("review_response", "<step>", accounts_id=, ...)` (or a server-side write in
the same `Automation_Logs` shape) so it surfaces in the existing Automation Logs page.

## Phase 2 — Automation & workspace

- Auto-post positives by default (per `review_reply_auto_positive`); sentiment-based routing; a soft
  SLA ("draft within N minutes of a review appearing"); integrate the richer **reviews workspace**
  (queue / sentiment funnel / response stream) from the Claude Design pass.

## Phase 3 — Other platforms

- **Trustpilot** (replies API, business tier), **Facebook** (Graph, limited). **Yelp excluded** (no
  API replies). Each is a new adapter writing into the same `Account_Reviews` table + approval flow —
  `platform` discriminates. The poll/draft/approve/post pipeline is platform-agnostic.

## Files touched (representative)

**New (CRM):** `server/reviews/google.ts` (OAuth + list + reply), `server/routes/reviews.ts`
(queue/approve/post), `client/src/features/.../api/reviewsApi.ts`, an approval surface (a Reviews panel
or a section in `ReputationSettingsPanel.tsx`). **Edited (CRM):** `ReputationSettingsPanel.tsx`
(connect card + toggles), `server/routes/index.ts`. **Engine (optional):** a draft helper + the
`system:review-reply` prompt (if AI drafting lives in the engine). **Schema:** `Account_Reviews` table
+ `enable_review_response` / `review_reply_auto_positive` on Accounts + the prompt row — flagged for the
schema session (new table via direct `pg` SQL on the Pi). **Locales:** en/nl (`accounts` or a new
`reviews` namespace).

## Verification (end-to-end)

1. **Connect:** authorize Google Business Profile → location listed; connection stored.
2. **Poll + draft:** a new review appears → poller stores it, AI drafts a reply; a negative notifies
   `reputation_alert_target`.
3. **Approve negative:** approve a 1★ draft → reply posts publicly (verify on Google Maps);
   `status='posted'`.
4. **Auto-positive:** with the flag on, a new 5★ thank-you posts automatically; with it off, it queues.
5. **Idempotency:** re-poll creates no duplicates; an already-replied review is untouched.
6. **Disable:** `enable_review_response=false` stops polling/posting.
7. **Logs:** all steps appear under `review_response`.
