# WhatsApp Quality Auto-Throttle — Requirements

> **Depends on `specs/whatsapp-quality-tracking/`** (the poller, schema columns, and chip this spec
> extends). Also inert until a real `Accounts.whatsapp_sender_sid` exists — same precondition as the
> parent spec.

## Context & goal

The parent spec (`whatsapp-quality-tracking`) deliberately shipped visibility + alerting only: on a
quality downgrade, a human gets notified and has to manually go lower `daily_lead_limit` or
`max_daily_sends`. Gabriel wants this handsoff — the risk (Meta restricting or banning a number for
over-sending against a degraded quality rating) shouldn't depend on someone seeing a notification in
time.

Goal: keep the account's send cap continuously in sync with what Twilio's Senders API actually
reports as `messaging_limit`, in both directions, with no manual step in the common case.

## Resolving an apparent tension (read this first)

While scoping this, two requests looked like they pulled opposite ways: "manual restore, and put the
Meta upgrade criteria somewhere I won't forget" vs. "why not automate everything, I want this
handsoff." They resolve cleanly once one fact is made explicit: **`messaging_limit` is not our
guess — it's Meta's own already-decided, currently-live ceiling for that number**, polled hourly.
Mirroring it in both directions isn't "the system deciding to upgrade you"; Meta already decided that
the moment the number's tier changed. There is no additional risk in raising our cap to match a
number Meta is already enforcing on their end regardless of what we do.

So: full bidirectional auto-sync, continuously, no manual step — satisfying "handsoff" — while never
inventing a number ahead of what Meta has actually granted, which is what the "manual restore"
instinct was really protecting against. The one thing worth keeping manual: a human's own *stricter*
pacing choice (e.g. "cap at 300/day even though Meta allows 2,000, I don't want to burn through leads
that fast") must not get silently overwritten upward by the poller — see Functional Requirement 3.

The ≥50%-utilization/7-day Meta upgrade criterion Gabriel asked to have surfaced "somewhere I won't
forget" is educational copy, not logic our code needs to gate on (Meta computes it, we only mirror
the result) — it goes in the WhatsApp Quality chip's tooltip on the Campaigns page, per his own
suggestion, since that's always visible rather than a notification that scrolls away.

## What already exists (verified against the tree)

- `specs/whatsapp-quality-tracking/` (built 2026-07-03): `Accounts.whatsapp_quality_rating` /
  `whatsapp_messaging_limit` / `whatsapp_quality_checked_at` / `whatsapp_previous_quality_rating`,
  the hourly `quality_rating_monitor.py` poller, the `quality_rating_drop` notification, and the
  WhatsApp Quality chip in `DetailViewHeader.tsx`. This spec extends that poller; it does not
  replace it.
- `automations/src/automations/campaign_launcher.py:83-89` — the existing daily-send guard:
  ```python
  DEFAULT_DAILY_LIMIT = 500
  daily_limit = data.get("daily_lead_limit") or DEFAULT_DAILY_LIMIT
  account_max = data.get("account_max_daily_sends") or DEFAULT_DAILY_LIMIT
  effective_limit = min(daily_limit, account_max)
  remaining = max(0, effective_limit - sent_today)
  ```
  `account_max_daily_sends` (aliased in `tools/db/campaigns.py:38` from `Accounts.max_daily_sends`)
  already applies **per-campaign** as one side of a `min()` — but it's the same value read by every
  campaign under the account, since it's a single `Accounts` column. This is the correct, minimal
  lever: lowering it protects every campaign on that WhatsApp number without touching any campaign's
  own `daily_lead_limit`.
- **Known pre-existing gap, out of scope for this spec but worth flagging given we're about to lean
  on this column harder**: `count_messages_sent_today(campaign_id, ...)` counts sends **per
  campaign**, not per account. So `account_max_daily_sends` is not a true aggregate account-wide
  budget today — an account running 3 campaigns could send up to 3× `max_daily_sends` combined, each
  campaign independently topping out at the same shared ceiling. Auto-throttle makes the ceiling
  itself trustworthy (always ≤ Meta's real limit); it does not fix cross-campaign aggregation. If
  Gabriel runs multiple concurrent campaigns per account at real volume against a tightly-throttled
  number, this gap becomes the actual risk, not this spec's mechanism. Flagged in
  `action-required.md`, not fixed here.
- `server/routes/accounts.ts:87-101` — `PATCH /api/accounts/:id` persists `maxDailySends` (and
  anything else in the partial Zod schema) via `storage.updateAccount`, no per-field side effects
  beyond a couple of `"field" in parsed.data` checks (Cal.diy resync). No changes needed here — see
  Functional Requirement 3 for why a manual edit self-corrects without touching this route.
- `client/src/features/accounts/components/workspace/AccountDetailsPanel.tsx` — where a human edits
  `max_daily_sends` today (Settings UI), unaffected by this spec.

## In scope

- Extend `quality_rating_monitor.py`'s per-account check: after recording the polled
  `quality_rating` / `messaging_limit` (unchanged from the parent spec), also sync
  `Accounts.max_daily_sends` toward the polled `messaging_limit` — see Functional Requirement 3 for
  the exact drift-aware rule.
- One new column, `Accounts.whatsapp_last_synced_max_daily_sends`, to detect whether the current
  `max_daily_sends` is still "under poller management" or has been manually overridden since the
  last sync.
- Extend the WhatsApp Quality chip's tooltip (`DetailViewHeader.tsx`, built in the parent spec) with:
  a note when the send cap is currently auto-synced, and a static educational line about Meta's
  ≥50%-utilization/7-day upgrade criterion.

## Out of scope

- **Fixing the per-campaign vs. per-account aggregation gap** described above — real, but a separate
  structural fix (would touch `count_messages_sent_today` / the guard in `campaign_launcher.py`
  itself), not part of "keep the cap synced to Meta's reported ceiling."
- **A dedicated "quality recovered" notification.** Per Gabriel's own framing ("I won't remember a
  notification"), the always-visible chip tooltip carries the ongoing state; the existing
  `quality_rating_drop` alert (downgrade only, from the parent spec) is untouched and unexpanded.
- **Per-campaign throttling.** Confirmed account-wide (Functional Requirement 1) — a campaign's own
  `daily_lead_limit` is never written by this spec.
- **UI to manually trigger a re-sync or view sync history.** v1 is fire-and-forget each poll; no
  history table, no manual "resync now" button.

## Functional requirements

1. **Scope & mechanism.** Unchanged target: `Accounts.max_daily_sends`, the same column already
   consumed by every campaign under the account via the existing `min(daily_lead_limit,
   account_max_daily_sends)` guard. No per-campaign field is touched.
2. **Trigger.** Runs on every poll for every in-scope account (`whatsapp_sender_sid IS NOT NULL`) —
   not gated on a quality-rating transition. `messaging_limit` can change without a quality-rating
   change (e.g. Meta re-evaluates utilization on an already-green number), so the sync check must be
   unconditional per poll, independent of the existing downgrade-alert branch.
3. **Drift-aware sync rule** (the core logic — replaces the parent spec's "a human decides" for this
   one field):
   ```
   current      = Accounts.max_daily_sends                      # nullable
   last_synced  = Accounts.whatsapp_last_synced_max_daily_sends  # nullable
   new_limit    = polled messaging_limit                         # this run

   if current is None or current == last_synced:
       # No human override since our last sync (or no cap ever set) — fully mirror Meta.
       if new_limit != current:
           SET Accounts.max_daily_sends = new_limit
   elif new_limit < current:
       # Human's cap is now above Meta's real ceiling — safety wins regardless of intent.
       SET Accounts.max_daily_sends = new_limit
   # else: human deliberately set a stricter/different cap and Meta's ceiling hasn't dropped
   # below it — leave their value alone.

   SET Accounts.whatsapp_last_synced_max_daily_sends = new_limit   # always, every poll
   ```
   This makes a manual edit in the Settings UI self-correcting: the moment a human changes
   `max_daily_sends` to anything other than the last-synced value, the next poll detects the drift
   and stops overwriting it upward — no route change, no flag to clear, no extra plumbing.
4. **Never exceeds Meta's reported ceiling.** Regardless of the branch taken above, `max_daily_sends`
   is never left above the most recently polled `messaging_limit`. This is the actual protection
   this spec exists for.
5. **Resilience.** Runs inside the same per-account try/except as the existing quality check in
   `quality_rating_monitor.py` — a Twilio error for one account still must not touch that account's
   `max_daily_sends` (no write happens if the fetch step raised) and must not abort the loop for
   other accounts, matching the parent spec's existing convention.
6. **UI.** The WhatsApp Quality chip's tooltip gains two lines when a `whatsapp_sender_sid` exists:
   - "Daily send cap: auto-synced to `N`" when `max_daily_sends === whatsapp_last_synced_max_daily_sends`
     (derived client-side by comparing the two merged fields — no new boolean column); otherwise
     "Daily send cap: `N` (manually set, below Meta's `M` limit)" when a human's stricter value is
     being respected.
   - A static line, always present once a sender exists: "Meta re-evaluates roughly every 6h; tier
     upgrades require using ≥50% of the current limit over a rolling 7 days."

## Non-functional requirements

- **i18n**: new tooltip copy via the `campaigns` namespace, en/nl only, alongside the existing
  `meta.whatsappQuality*` keys.
- **No new Express route, no new API endpoint** — `whatsapp_last_synced_max_daily_sends` rides along
  on the existing `fetchAccounts()` deny-list column selection (same mechanism the parent spec
  relies on), merged client-side in `useCampaignsData.ts` alongside the parent spec's three fields.
- **Idempotent**: re-running the sync rule with the same polled value is a no-op write-wise beyond
  refreshing `whatsapp_last_synced_max_daily_sends` (already equal, so effectively a no-op).
- **Zero send-path change beyond the one field**: `send_service.py`, `channel_fallback.py`, and every
  guard in `campaign_launcher.py` other than reading the (now poller-managed) `max_daily_sends` value
  are untouched.

## Data model changes (flagged, not edited here)

- `Accounts.whatsapp_last_synced_max_daily_sends` (bigint, nullable) — sits next to
  `whatsapp_quality_checked_at` in `schema.ts`.

## Acceptance criteria

- With a real `whatsapp_sender_sid` and no prior manual override, a `messaging_limit` change (either
  direction) updates `Accounts.max_daily_sends` within one poll interval, and every campaign under
  that account immediately inherits the new effective cap via the existing `min()` guard — no
  campaign-level edit needed.
- A human-set `max_daily_sends` stricter than the current `messaging_limit` survives repeated polls
  unchanged, as long as Meta's ceiling doesn't drop below it.
- A human-set `max_daily_sends` **above** Meta's current ceiling gets pulled down to match on the
  next poll, regardless of how it got there.
- The WhatsApp Quality chip tooltip shows the auto-synced/manually-set state correctly and always
  carries the ≥50%/7-day educational line once a sender exists.
- A Twilio error on one account during the fetch step leaves that account's `max_daily_sends`
  untouched and doesn't block the sync for other in-scope accounts.
