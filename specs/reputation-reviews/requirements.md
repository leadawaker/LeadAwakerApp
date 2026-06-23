# Reputation v2 — Public Review Response (Google Business Profile) — Requirements

> The **second half** of reputation management, complementing the v1 feedback-ask in
> `specs/reputation-management/`. v1 *generates* reviews + intercepts unhappy customers **before** they
> post; v2 monitors reviews **already posted** publicly and **responds** to them. Reuses the existing
> per-account Google OAuth infra. Schema additions noted but **not edited here** (parallel session owns
> `shared/schema.ts`). en/nl only (pt-BR dropped from campaigns).

## Context & goal

For premium home improvement, Google Maps reviews are decisive — buyers research a contractor's
reviews hard before choosing. v1 cannot touch what's already public. v2 closes that: **watch each
client's public Google reviews and reply to them** — AI-drafted, human-approved for anything negative —
so a professional response sits under every 1-star (a visible trust signal to every future prospect)
and a thank-you under the 5-stars. You can't delete a 1-star, but responding well is the legitimate,
policy-safe move (responding is a normal owner feature; *fake reviews* and *suppression* are what
violate policy — so v2 is actually cleaner than v1's interception half).

## What already exists (verified against the tree)

- **v1 reputation:** `enable_reputation_management`, `google_review_url`, `reputation_alert_target`
  (Accounts), `reputation_handler.py` / `reputation_scheduler.py` / `reputation_prompts.py` (engine),
  `ReputationSettingsPanel.tsx` (account UI).
- **Per-account Google OAuth is already built** — `server/calendar/google.ts`, `server/gmail.ts`,
  `server/gmail-sync.ts` implement Google consent, token storage, and refresh. **Reuse this** for the
  Business Profile scope instead of building OAuth from scratch.
- **AI + plumbing:** Prompt_Library (DB) + OpenAI **EU** endpoint (GDPR), `broadcastToUser`
  notifications, `AsyncLogStep` logging — all reused.
- **No existing review-reading/response integration** — this is net-new (grep confirmed).

## The gap

Nothing reads or replies to public reviews. v2 adds: connect → poll → draft → approve → post.

## In scope

- **Per-account Google Business Profile connection** (OAuth — reuse the calendar consent flow + add the
  `business.manage` scope), with location selection.
- A **poller** that fetches new reviews per location, dedups by external review id, and stores rating +
  text + author + timestamp.
- **AI-drafted reply** per review (`system:review-reply`, en/nl), tone by sentiment.
- **Approval workflow:** negatives + neutrals **always** human-approved; positives optionally
  auto-posted (per-account flag).
- **Posting** the approved reply via the Google Business Profile API.
- A **minimal approval surface** (a reviews queue) now; the richer reputation workspace comes later
  from Claude Design.
- Manager **notification** on a new negative review (`broadcastToUser` to `reputation_alert_target`).

## Out of scope

- v1 feedback-ask (separate, complementary — keep both).
- **Non-Google platforms** (Trustpilot/Facebook later; **Yelp excluded** — no API replies). Google is
  the v1 surface and the one that matters for the niche.
- **Autonomous negative replies** — negatives/neutrals are never auto-posted.
- The rich reputation **workspace screen** (Claude Design output, integrated later).

## Functional requirements

1. **Connect.** An account authorizes Google Business Profile via OAuth (reuse the calendar connect
   button pattern + `business.manage` scope), picks its location(s); the connection is stored. Gated by
   `enable_review_response`.
2. **Poll.** Periodically fetch new reviews per connected location (Business Profile API
   `reviews.list`), dedup by external review id, store each (`rating`, `text`, `author`,
   `review_created_at`, `status='new'`). Real-time optional via Google Pub/Sub review notifications.
3. **Draft.** For each `new` review, AI generates a reply (`system:review-reply`) — empathetic for
   negative, grateful for positive — **in the review's language** (en/nl), using business context
   (optionally the account knowledge base). `status='drafted'`.
4. **Approve.** Negatives (1–2★) and neutrals (3★) require human approval (edit / approve / reject) in
   the CRM; on a new negative, notify `reputation_alert_target` via `broadcastToUser`. Positives
   (4–5★) auto-post **only** if `review_reply_auto_positive=true`, else also queued for approval.
5. **Post.** On approval, post the reply via Business Profile API `reviews.updateReply` (one reply per
   review, editable). `status='posted'`, `posted_at` set server-side.
6. **Idempotency.** Never double-reply; an already-replied review is updated, not duplicated; re-polling
   creates no duplicates.
7. **Logging.** Every step logs to `Automation_Logs` with `workflow_name="review_response"`, scoped by
   account.
8. **Account control.** Runs only when `enable_review_response=true` and a Google Business Profile
   connection exists.

## Non-functional requirements

- **Policy/compliance:** responding is Google-allowed; never post fake/deceptive content; **always**
  human-approve negatives; never suppress reviews. **GDPR:** minimal public author data; AI via the
  OpenAI **EU** endpoint.
- **Brand safety:** AI never auto-posts to negative/neutral; default to human when uncertain.
- **Quota/rate:** respect Business Profile API quotas; backoff; poll interval ≥ ~15–30 min (or Pub/Sub
  push) — no tight polling.
- **i18n:** en/nl; the reply matches the review's language.
- **Timestamps server-side**; **notifications via `broadcastToUser`** (never `broadcast`).
- **Token security:** Google refresh tokens encrypted at rest (confirm current calendar/gmail handling
  and match it).

## Data model changes (summary — NOT edited here; flag for the schema-owning session)

- **Accounts:** `enable_review_response` (bool, default false), `review_reply_auto_positive` (bool,
  default false). Google Business Profile connection (location id/name) — store as a connection record
  akin to the existing calendar connections + reuse the existing Google token storage.
- **New table `Account_Reviews`:** `id`, `accounts_id`, `platform` (`'google'`), `external_review_id`
  (unique per account), `author_name`, `rating` (int), `review_text`, `review_created_at`, `status`
  (`new|drafted|approved|posted|skipped`), `draft_reply`, `posted_reply`, `posted_at`, `language`.
  New table → on the Pi create it via a direct `pg` SQL script (`node --env-file=.env`; `db:push` has
  no TTY).
- **Prompt_Library:** `system:review-reply` (en/nl), defaults baked into the engine like v1's prompts.

## Acceptance criteria

- Connecting Google Business Profile lists the location; the poller picks up a new review within the
  interval, stores it, and drafts a reply.
- A new 1★ → `drafted` + manager notified; nothing posts until approved; on approve, the reply appears
  publicly on Google; `status='posted'`.
- A 5★ with `review_reply_auto_positive=true` → thank-you posts automatically; with it off → queued.
- Never double-replies; re-poll creates no duplicates; an already-replied review is left alone.
- Disabling `enable_review_response` stops polling and posting.
- All steps appear in the Automation Logs page under `review_response`.
