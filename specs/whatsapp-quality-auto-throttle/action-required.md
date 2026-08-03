# WhatsApp Quality Auto-Throttle — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Build status
- [x] Built 2026-07-14. Schema column + migration run, `sync_max_daily_sends()` wired into
      `quality_rating_monitor.py` (folded into the existing `check_quality` log step), client
      merge + `Campaign` type + chip tooltip extension, en/nl i18n. Verified: migration ran
      clean, both Python files parse and the poller runs end-to-end with 0 accounts (still
      inert), Express + engine restarted with no new errors, chip tooltip confirmed via
      playwright-cli on live campaign #61 (Discovery Demo) in light + dark — correctly shows
      only the base "not yet checked" line since no `whatsapp_sender_sid` exists yet, proving
      the sender-gated tooltip lines are correctly suppressed.

## Still inert — same precondition as the parent spec
- [ ] Inert until `specs/messaging-provisioning/` Phase 2 ships and a real `whatsapp_sender_sid`
      exists. Zero accounts qualify today.

## Decisions made this session — recorded here so they aren't re-litigated
- [x] **Bidirectional, hands-off sync** (not the parent spec's original "human decides" stance for
      this one field). Gabriel: "why not let everything be automated but properly... I want this
      pretty handsoff." Resolved by recognizing `messaging_limit` is Meta's own already-decided
      value, not a guess — see `requirements.md`'s "Resolving an apparent tension" section.
- [x] **Throttle-down trigger**: every poll, not gated on a quality-rating transition (a
      `messaging_limit` change can happen without a rating change).
- [x] **Human overrides are respected, not silently clobbered upward** — this was the one piece of
      Gabriel's original "manual restore" answer worth preserving even inside a fully automated
      design: a deliberately stricter cap survives until Meta's real ceiling drops below it.
- [x] **≥50%/7-day Meta upgrade criterion surfaced in the chip tooltip**, not a notification — per
      Gabriel: "I won't remember this... add it to the actual tier indicator in the campaigns page."
- [x] **No dedicated "quality recovered" notification** — same reasoning (a notification is
      forgettable; the always-visible tooltip isn't). The existing downgrade-only
      `quality_rating_drop` alert from the parent spec is unchanged.

## Known bug flagged by /code-review, fixed via addendum
- [x] **Equality-based drift detection had two confirmed bugs**: (1) override-erasure — a temporary
      Meta dip below a human's manual cap caused the safety-pulldown branch to also erase the
      override signal, so a later Meta recovery silently discarded the human's original value; (2) a
      human cap that coincidentally equalled the last-synced Meta value was misclassified as
      poller-managed. Fixed 2026-07-14 via `addendum-manual-override-flag.md` — an explicit
      `Accounts.whatsapp_max_daily_sends_is_manual` boolean replaces the equality heuristic.
      `PATCH /api/accounts/:id` sets it true on any edit containing `maxDailySends`
      (`server/routes/accounts.ts`); `sync_max_daily_sends()` in `tools/db/accounts.py` reads it
      instead of comparing to `whatsapp_last_synced_max_daily_sends`; the safety-pulldown branch no
      longer clears the flag, fixing bug #1. `DetailViewHeader.tsx`'s tooltip branch now reads the
      flag directly instead of the old equality check. `AccountDetailsPanel.tsx`'s Daily Sends field
      shows "(manually set)" + a "Reset to auto-sync" button when the flag is true (accounts.json
      `fields.dailySendsManual` / `fields.dailySendsReset`, en+nl). New migration
      `migrate-quality-auto-throttle-manual-flag-column.js`, run clean. The two related
      null-interpolation tooltip bugs (cap/metaLimit rendering literal "null") found in the same
      review pass were fixed earlier the same session, already live.
      Verified via playwright-cli on live account #47 (Sandbox Client): edited Daily Sends → flag
      set, "(manually set)" + reset button appeared; clicked "Reset to auto-sync" → flag cleared,
      value unchanged; confirmed both transitions directly against the DB. Test account restored to
      its original state (500, unflagged) afterward.
- [x] **Bonus fix found during verification, unrelated to the code review**: `AccountDetailsPanel.tsx`'s
      Daily Sends field has always 422'd on save — its generic string-only edit input
      (`EditInput`/`useAccountEdit`) sent `max_daily_sends` as a string, but the Zod schema for that
      `bigint`-mode-number column expects a number, so every edit attempt through this panel silently
      failed (`{"path":"maxDailySends","message":"Expected number, received string"}`). This blocked
      verification of the flag above, so fixed in the same PATCH handler
      (`server/routes/accounts.ts`): coerce `maxDailySends` from string to number before Zod
      validation, mirroring the panel's own always-string edit flow rather than rewriting the shared
      edit infra. Pre-existing bug, not introduced by this spec or its addendum.

## Known limitation flagged, not fixed by this spec
- [ ] **`max_daily_sends` is not a true account-wide aggregate today** —
      `count_messages_sent_today()` counts per campaign, so N concurrent campaigns on one account can
      each independently reach the same shared ceiling (up to N× combined). This spec makes the
      ceiling itself trustworthy (never above Meta's real limit); it does not aggregate sends across
      campaigns. If Gabriel runs multiple concurrent campaigns per account at real volume against a
      tightly-throttled number, revisit this as its own spec — touches
      `campaign_launcher.py`'s guard and `count_messages_sent_today`, out of scope here.

## First real sync — verify against live data, not just docs
- [ ] Same caveat as the parent spec: `messaging_limit`'s exact field name/shape from Twilio's v2
      Senders endpoint hasn't been confirmed against a real response yet. Once the parent spec's
      "first real poll" action item is done, this spec's sync logic rides on the same verified value
      — no separate verification needed beyond confirming the `Accounts.max_daily_sends` write
      itself lands correctly on that first real account.
