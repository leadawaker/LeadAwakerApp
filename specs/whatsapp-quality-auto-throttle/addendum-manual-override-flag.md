# Addendum: explicit manual-override flag (replaces equality-based drift detection)

> Written 2026-07-14, after `/code-review` on the built feature surfaced two related bugs in the
> original equality-based drift heuristic. Gabriel confirmed: fix the null-interpolation tooltip bugs
> immediately (done, same session — see `action-required.md`), and design this fix as an addendum
> rather than code it blind. Gabriel has no strong opinion on mechanism; asked for the simplest
> correct option. Built and verified 2026-07-14, same session — see `action-required.md` for the
> verification log.

## The two bugs this fixes

Both live in `sync_max_daily_sends()` (`tools/db/accounts.py`) and stem from the same root cause:
using `Accounts.max_daily_sends == Accounts.whatsapp_last_synced_max_daily_sends` as a *proxy* for
"a human hasn't touched this since we last synced it." Equality is not the same fact as intent, and
two confirmed bugs came from that gap:

1. **Override-erasure on recovery.** When Meta's ceiling dips below a human's manual cap, the
   "safety wins" branch correctly pulls `max_daily_sends` down — but it also advances
   `whatsapp_last_synced_max_daily_sends` to match, which erases the *only* signal that a human ever
   set this field. When Meta's ceiling later recovers, the next poll sees `current == last_synced` and
   "helpfully" raises the cap back to Meta's ceiling — silently discarding a value the human chose on
   purpose and never asked to have restored.
2. **Coincidental-equality false negative.** If a human happens to set `max_daily_sends` to the exact
   value Meta's ceiling was last synced to, the system can't tell that apart from "the poller set
   this" — a deliberate choice is silently treated as auto-managed from that point on.

Both disappear once "is this human-owned" is a stored fact instead of an inference from equality.

## Data model change

- `Accounts.whatsapp_max_daily_sends_is_manual` (boolean, default `false`) — sits next to
  `whatsapp_last_synced_max_daily_sends` in `schema.ts`.
- `whatsapp_last_synced_max_daily_sends` is kept (still useful for the tooltip's "synced to N"
  copy and as an audit trail of the last polled value) but is **no longer used for override
  detection** — that's now `whatsapp_max_daily_sends_is_manual`, set explicitly, never inferred.

## Behavior change (what Gabriel sees)

Nothing changes in the day-to-day edit flow: the Daily Send Cap field in
`AccountDetailsPanel.tsx` (`client/src/features/accounts/components/workspace/AccountDetailsPanel.tsx:71`)
works exactly as it does today — same field, same input, same save. Two additions, both
conditional on the flag being `true`:

- A small `"(manually set)"` label next to the field.
- A `"Reset to auto-sync"` link/button next to that label. Clicking it clears the flag
  (`whatsapp_max_daily_sends_is_manual = false`) via the same PATCH the field already uses — no new
  endpoint. The field then keeps its current numeric value until the next poll re-syncs it, at which
  point it silently starts tracking Meta's ceiling again, same as if the flag had never been set.

If the flag is `false` (the default, and the state of every account today since none have a
`whatsapp_sender_sid` yet), nothing is visibly different from what's built now.

## Functional requirements

1. **Setting the flag.** `PATCH /api/accounts/:id` (`server/routes/accounts.ts:98-123`) sets
   `whatsapp_max_daily_sends_is_manual = true` whenever the request body contains `maxDailySends` —
   mirrors the existing `"businessHoursStart" in parsed.data` / `"meetingType" in parsed.data`
   side-effect pattern already used twice in that same handler (lines 115, 119). No new route, no
   new Zod field to validate — just one more `if ("maxDailySends" in parsed.data) { ... }` block.
2. **Clearing the flag.** The "Reset to auto-sync" action is a normal `PATCH` with
   `{ whatsappMaxDailySendsIsManual: false }` in the body — add this one field to
   `insertAccountsSchema`'s allowed partial fields (it already flows through the deny-list column
   selection like every other Accounts field, per the parent spec's established convention — no
   custom handling needed beyond exposing it in the Zod schema).
3. **Poller decision rule** (`sync_max_daily_sends()` in `tools/db/accounts.py`), replacing
   Functional Requirement 3 from `requirements.md`:
   ```
   current      = Accounts.max_daily_sends
   new_limit    = polled messaging_limit
   is_manual    = Accounts.whatsapp_max_daily_sends_is_manual

   if new_limit is None:
       return  # Twilio didn't report a limit — don't touch anything

   if not is_manual:
       # Fully poller-managed — mirror Meta unconditionally.
       if new_limit != current:
           SET Accounts.max_daily_sends = new_limit
   elif current is not None and new_limit < current:
       # Human's cap is now above Meta's real ceiling — safety wins, but the override survives.
       SET Accounts.max_daily_sends = new_limit
       # whatsapp_max_daily_sends_is_manual stays TRUE — this was a safety pulldown, not a
       # poller-initiated sync, so the human's original intent is still "manual" and Meta's later
       # recovery must NOT silently raise the cap back up. This is the exact fix for bug #1.
   # else: manual cap is below Meta's ceiling, nothing to do.

   SET Accounts.whatsapp_last_synced_max_daily_sends = new_limit   # unchanged — still an audit trail
   ```
   The key difference from the old rule: the safety-pulldown branch no longer clears the override
   signal, because the override signal is no longer tied to the value it pulled down to.
4. **Never exceeds Meta's reported ceiling.** Unchanged from the original spec — this invariant
   didn't depend on the buggy mechanism and doesn't change here.
5. **Resilience.** Unchanged — same per-account try/except in `quality_rating_monitor.py`.
6. **UI.** `DetailViewHeader.tsx`'s tooltip branch selection changes from comparing
   `account_max_daily_sends === account_whatsapp_last_synced_max_daily_sends` to reading
   `account_whatsapp_max_daily_sends_is_manual` directly — simpler than the current nested ternary,
   and no longer vulnerable to the null-interpolation bugs fixed this session (those fixes remain
   correct and are preserved: `cap == null` still shows "not yet synced", `metaLimit == null` still
   drops the trailing clause).
7. **Settings UI.** `AccountDetailsPanel.tsx`'s Daily Sends `FieldRow` gains the conditional
   `"(manually set)"` label + "Reset to auto-sync" affordance described above, visible only when
   `whatsapp_max_daily_sends_is_manual` is true on the loaded account.

## Out of scope

- Any change to `campaign_launcher.py`'s guard, `count_messages_sent_today`, or the per-campaign vs.
  per-account aggregation gap — still a separate, already-flagged limitation.
- Any change to the downgrade-alert (`quality_rating_drop`) notification path.
- A history/audit view of manual-override changes — v1 is just the one boolean, no log table.

## Migration

New idempotent script `migrate-quality-auto-throttle-manual-flag-column.js`, same pattern as the two
prior migrations in this spec family: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS
"whatsapp_max_daily_sends_is_manual" boolean DEFAULT false;`. Existing rows (all of them, today) get
`false`, which is correct — no account has ever had a real manual edit under the old mechanism worth
preserving as `true`.

## Files touched (representative)

**Edited (Engine)**: `tools/db/accounts.py` (`sync_max_daily_sends` rule rewritten to read the flag
instead of comparing to `last_synced`).
**New (CRM)**: `migrate-quality-auto-throttle-manual-flag-column.js`.
**Edited (CRM)**: `shared/schema.ts` (1 column), `server/routes/accounts.ts` (1 conditional
side-effect on PATCH, mirroring the existing pattern), `shared/schema.ts`'s `insertAccountsSchema`
partial (expose the new field), `client/src/features/campaigns/hooks/useCampaignsData.ts` (merge 1
more field), `client/src/types/models.ts` (1 more field), `DetailViewHeader.tsx` (branch selection
simplified to read the flag), `client/src/features/accounts/components/workspace/AccountDetailsPanel.tsx`
(manual-set label + reset affordance on the Daily Sends field), i18n keys for the label/reset button
text in `client/src/locales/{en,nl}/accounts.json` (check correct namespace — `AccountDetailsPanel`
likely uses `accounts`, not `campaigns`).

## Verification (once a real `whatsapp_sender_sid` exists)

1. Human sets `max_daily_sends=150` while Meta's ceiling is 1000 → flag becomes `true`, field shows
   "(manually set)".
2. Meta's ceiling drops to 100 → poller pulls the cap to 100 (safety wins), flag **stays true**.
3. Meta's ceiling recovers to 1000 → poller does **not** touch `max_daily_sends` (still 100, still
   flagged manual) — this is the fixed behavior; under the old mechanism this would have silently
   jumped to 1000.
4. Human clicks "Reset to auto-sync" → flag clears, next poll immediately mirrors Meta's current
   ceiling.
5. Fresh account, never touched → flag is `false` by default, poller fully manages the value, tooltip
   shows "auto-synced to N" exactly as today.
6. Human sets `max_daily_sends` to a value that happens to equal the current Meta ceiling → flag still
   becomes `true` (set unconditionally on any PATCH containing the field), so the coincidental-equality
   false negative from the old mechanism cannot recur.
