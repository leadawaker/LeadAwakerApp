# Implementation Plan: WhatsApp Quality Auto-Throttle

> Paths verified against the current tree (this session). Builds directly on
> `specs/whatsapp-quality-tracking/` (built 2026-07-03) — same repos: CRM =
> `/home/gabriel/LeadAwakerApp/`, Engine = `/home/gabriel/automations/`.

## Overview

Extend the existing `quality_rating_monitor.py` poller so it also keeps `Accounts.max_daily_sends`
synced to Twilio's polled `messaging_limit`, in both directions, without ever overwriting a human's
intentionally stricter cap upward and without ever leaving the cap above Meta's real ceiling. One new
column, no new job, no new route.

## Phase 1: Schema

### Tasks
- [ ] Add `whatsappLastSyncedMaxDailySends` to the `accounts` table in `shared/schema.ts`, next to
  `whatsappQualityCheckedAt` (the last field added by the parent spec).
- [ ] Write `migrate-quality-auto-throttle-column.js`, mirroring
  `migrate-quality-rating-columns.js`'s structure (schema-lookup + `ADD COLUMN IF NOT EXISTS`
  pattern), and run it via `node --env-file=.env migrate-quality-auto-throttle-column.js`.

### Technical Details
```ts
// shared/schema.ts — next to whatsappQualityCheckedAt
whatsappLastSyncedMaxDailySends: bigint("whatsapp_last_synced_max_daily_sends", { mode: "number" }),
```
```js
// migrate-quality-auto-throttle-column.js
const cols = [
  ['whatsapp_last_synced_max_daily_sends', 'bigint'],
];
```

## Phase 2: Engine — extend the poller's per-account check

### Tasks
- [ ] Add `sync_max_daily_sends(account_id, current_max_daily_sends, last_synced, new_limit) ->
  int | None` to `tools/db/accounts.py` — pure decision function (Functional Requirement 3's
  pseudocode from `requirements.md`) plus the actual `UPDATE`. Returns the new `max_daily_sends`
  value if it changed, else `None`, so the caller can log what happened.
- [ ] Call it from `quality_rating_monitor.py`'s `_check_account()`, **after** the existing
  `update_whatsapp_quality()` call and **independent of** the `_is_downgrade()` branch — this must
  run every poll for every in-scope account, not just on a detected downgrade (Functional
  Requirement 2). Needs `account.get("max_daily_sends")` and
  `account.get("whatsapp_last_synced_max_daily_sends")` added to the `SELECT` in
  `get_accounts_with_whatsapp_sender()`.
- [ ] Log the outcome via the same `AsyncLogStep` used for `check_quality` — either fold into that
  step's `step.output` (e.g. `"rating=green limit=2000 cap=2000 (synced)"`) or add a second
  `AsyncLogStep("quality_rating_monitor", "sync_send_cap", ...)` — prefer folding into the existing
  step to avoid doubling the log volume for what's logically one poll pass. [complex]
- [ ] No changes to the resilience/try-except structure — the existing per-account
  `try/except` in `run()` already covers this, since the sync call lives inside `_check_account()`.

### Technical Details
```python
# tools/db/accounts.py

async def get_accounts_with_whatsapp_sender() -> list[dict]:
    # extend existing SELECT to also fetch:
    #   max_daily_sends, whatsapp_last_synced_max_daily_sends
    ...

async def sync_max_daily_sends(
    account_id: int, current: int | None, last_synced: int | None, new_limit: int | None,
) -> int | None:
    """Drift-aware sync — see requirements.md Functional Requirement 3.
    Returns the new max_daily_sends value if this call changed it, else None."""
    if new_limit is None:
        return None  # Twilio didn't report a limit this poll — don't touch the cap on a guess

    next_value = None
    if current is None or current == last_synced:
        if new_limit != current:
            next_value = new_limit
    elif new_limit < current:
        next_value = new_limit

    pool = get_pool()
    async with pool.acquire() as conn:
        if next_value is not None:
            await conn.execute(
                f'UPDATE {fq(Table.ACCOUNTS)} '
                f'SET max_daily_sends = $1, whatsapp_last_synced_max_daily_sends = $2 '
                f'WHERE id = $3',
                next_value, new_limit, account_id,
            )
        else:
            await conn.execute(
                f'UPDATE {fq(Table.ACCOUNTS)} '
                f'SET whatsapp_last_synced_max_daily_sends = $1 WHERE id = $2',
                new_limit, account_id,
            )
    return next_value
```
```python
# quality_rating_monitor.py — inside _check_account(), after update_whatsapp_quality(...)
new_cap = await sync_max_daily_sends(
    account_id,
    account.get("max_daily_sends"),
    account.get("whatsapp_last_synced_max_daily_sends"),
    new_limit,
)
if new_cap is not None:
    log.info("quality_rating_monitor.cap_synced", account_id=account_id, new_cap=new_cap)
```

## Phase 3: Client — surface sync state in the existing chip tooltip

### Tasks
- [ ] `client/src/features/campaigns/hooks/useCampaignsData.ts` — extend the merge (same block as
  the parent spec's three fields, ~line 45-48) with `account_max_daily_sends` and
  `account_whatsapp_last_synced_max_daily_sends`.
- [ ] `client/src/types/models.ts` — add both fields to `Campaign`, next to the parent spec's
  `account_whatsapp_*` block.
- [ ] `client/src/features/campaigns/components/detailView/DetailViewHeader.tsx` — extend the
  `title` argument already passed to the WhatsApp Quality chip's `renderMetaChip()` call
  (`DetailViewHeader.tsx:351-356`, the 4th `title` param added by the parent spec) with the two new
  lines from Functional Requirement 6: the auto-synced/manually-set state, and the static
  ≥50%/7-day educational line. Keep it one `title` string (multi-line via `\n`, matching how a
  native `title` tooltip already wraps).
- [ ] i18n: add `meta.whatsappQualitySyncedTo`, `meta.whatsappQualityManualCap`, and
  `meta.whatsappQualityUpgradeInfo` to `client/src/locales/{en,nl}/campaigns.json`, in the same
  `meta` block as the parent spec's three keys.

### Technical Details
```ts
// useCampaignsData.ts — same merge block as parent spec
account_max_daily_sends: (account as any)?.max_daily_sends ?? null,
account_whatsapp_last_synced_max_daily_sends: (account as any)?.whatsapp_last_synced_max_daily_sends ?? null,
```
```tsx
// DetailViewHeader.tsx — building the title string for the existing chip call
const isAutoSynced = campaign.account_max_daily_sends != null
  && campaign.account_max_daily_sends === campaign.account_whatsapp_last_synced_max_daily_sends;
const capLine = campaign.account_whatsapp_sender_sid // only once a sender exists at all
  ? (isAutoSynced
      ? t("meta.whatsappQualitySyncedTo", { limit: campaign.account_max_daily_sends })
      : t("meta.whatsappQualityManualCap", { cap: campaign.account_max_daily_sends, metaLimit: campaign.account_whatsapp_messaging_limit }))
  : null;
// append capLine + "\n" + t("meta.whatsappQualityUpgradeInfo") to the existing title string
```
Note: `account_whatsapp_sender_sid` isn't currently merged onto `Campaign` (the parent spec merges
only the quality/limit/checked-at fields, not the sender SID itself) — add it in the same Phase 3
merge step above if it's needed to gate the tooltip lines to "sender exists" rather than just
"limit is non-null" (a `messaging_limit` of `0` is falsy-adjacent and must not be confused with "no
sender"). Use `!= null` checks throughout, not truthiness, for this reason.

## Files touched (representative)

**Edited (Engine)**: `tools/db/accounts.py` (`get_accounts_with_whatsapp_sender` extended,
`sync_max_daily_sends` added), `src/automations/quality_rating_monitor.py` (call the sync after the
existing quality update).
**New (CRM)**: `migrate-quality-auto-throttle-column.js`.
**Edited (CRM)**: `shared/schema.ts` (1 column), `client/src/features/campaigns/hooks/useCampaignsData.ts`
(2-field merge), `client/src/types/models.ts` (Campaign fields), `client/src/features/campaigns/components/detailView/DetailViewHeader.tsx`
(tooltip copy), `client/src/locales/{en,nl}/campaigns.json` (3 new keys).
**None touched**: `server/routes/accounts.ts`, `send_service.py`, `channel_fallback.py`,
`campaign_launcher.py` (reads `max_daily_sends`, doesn't need to know it's now poller-managed),
`src/scheduler/jobs.py` (no new job — this rides inside the existing `quality_rating_monitor` job).

## Verification (end-to-end, once a real `whatsapp_sender_sid` exists)

1. **No prior cap set** (`max_daily_sends IS NULL`): first poll sets it to the polled
   `messaging_limit` and records `whatsapp_last_synced_max_daily_sends` to match.
2. **Meta ceiling drops below an auto-synced cap**: next poll lowers `max_daily_sends` to match;
   every campaign on the account inherits the lower `effective_limit` on its next `campaign_launcher`
   pass, no campaign-level edit.
3. **Human sets a stricter cap** (e.g. 300, while `messaging_limit` is 2,000): next several polls
   leave `max_daily_sends` at 300 (current ≠ last_synced, new_limit ≥ current) while
   `whatsapp_last_synced_max_daily_sends` keeps tracking the live 2,000 in the background.
4. **Meta ceiling later drops below that human value** (e.g. to 250, while human cap is still 300):
   next poll pulls it down to 250 despite the human override — safety wins.
5. **Human sets a cap above the current ceiling** (e.g. 5,000 while `messaging_limit` is 2,000): next
   poll clamps it back to 2,000.
6. **UI**: chip tooltip shows "auto-synced to N" immediately after a fresh sync, switches to the
   manual-cap wording after a human edit in Settings, and always shows the ≥50%/7-day line once a
   sender exists. No sender → unchanged from the parent spec's gray "—" placeholder, no new lines.
7. **Twilio error path** (reused from parent spec): a failed fetch for one account raises before the
   sync call runs, so that account's `max_daily_sends` is untouched that poll; other accounts
   unaffected.
