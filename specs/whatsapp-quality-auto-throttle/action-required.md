# WhatsApp Quality Auto-Throttle — Action Required (manual steps)

Steps a human must do that code can't, in rough order. Check off as completed.

## Build status
- [ ] Not built. Spec only, written 2026-07-04.

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
