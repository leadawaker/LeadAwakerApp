# Reputation v2 — Public Review Response — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Google Cloud / API (one-time, ours) ⚠️ lead-time item
- [ ] **Request access to the Google Business Profile APIs** (Google requires an application + quota
      approval) — this has lead time, start early.
- [ ] Add the **`business.manage`** scope to the existing Google OAuth app (the one calendar/gmail
      use) and update the OAuth consent screen.
- [ ] Decide real-time vs poll: set up **Google Pub/Sub** review notifications, or rely on a
      ~15–30 min poll (start with poll, add Pub/Sub later).

## Per-client
- [ ] Client **authorizes Google Business Profile** (they must own/manage the location) via the connect
      card, then picks the location.
- [ ] Set `enable_review_response = true`; choose `review_reply_auto_positive` (recommend **off**
      initially — review everything until tone is trusted).
- [ ] Reuse v1's `reputation_alert_target` so negative-review approval requests reach the right person.

## Prompts
- [ ] `system:review-reply` (en/nl) — empathetic for negatives, grateful for positives, in the
      business's brand voice; optionally pull the account knowledge base for specifics. Bake en/nl
      defaults into the engine like v1's reputation prompts; Prompt_Library rows override.

## Compliance / policy
- [ ] Responding to reviews is **Google-allowed**; never post fake/deceptive replies; **always
      human-approve negatives**; never suppress reviews. Document for clients so expectations are set.
- [ ] **GDPR:** AI drafting uses the OpenAI **EU** endpoint; store only minimal public author data.
- [ ] **Token security:** confirm Google **refresh tokens are encrypted at rest** (match whatever
      calendar/gmail already do).

## Schema (new table + flags)
- [ ] Create **`Account_Reviews`** via a direct `pg` SQL script (`node --env-file=.env`) — `db:push`
      has no TTY on the Pi.
- [ ] Add `enable_review_response` + `review_reply_auto_positive` to Accounts (parallel schema session
      owns `shared/schema.ts` — do not edit from a docs session).

## Engine / restart
- [ ] If AI drafting runs in the **engine**, `pm2 restart leadawaker-engine --update-env`. If the whole
      loop is in the **CRM server**, it auto-reloads via pm2 watch (no manual restart).

## Open decisions to confirm before build
- [ ] **Poll vs Pub/Sub** for new-review detection (poll first; Pub/Sub for near-real-time later).
- [ ] **AI drafting home:** CRM server (direct OpenAI EU) vs engine (Prompt_Library cascade). Recommend
      engine, to keep all AI in one place.
- [ ] **Auto-post positives by default**, or approve everything at launch? (Recommend approve-all,
      then enable auto-positive once trusted.)
- [ ] **Approval queue location:** a minimal Reviews panel now, vs wait for the Claude Design reputation
      workspace.
- [ ] **Next platform after Google:** Trustpilot vs Facebook (Yelp excluded — no API replies).
