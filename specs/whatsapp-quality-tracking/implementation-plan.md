# WhatsApp Quality & Tier Visibility — Implementation Plan

> Paths verified against the current tree (this session). CRM = `/home/gabriel/LeadAwakerApp/`,
> Engine = `/home/gabriel/automations/`. Builds on `specs/messaging-provisioning/` (Phase 2, not yet
> built) for `Accounts.whatsapp_sender_sid`.

## Architecture decision: one new engine job, reuse three existing patterns, zero send-path or route changes

- **The poller lives in the automations engine**, not the Express server, because it's a recurring
  background check (like `metrics_aggregator`), not a user-triggered action (unlike
  `messaging-provisioning`'s one-click provision, which correctly lives in Express). It reuses
  `tools/twilio_service.py`'s per-account client builder — no new Twilio auth plumbing.
- **The v2 Senders endpoint is called via the SDK's low-level `.request()`**, not a typed resource —
  the installed `twilio==9.4.3` has no `messaging/v2` module. Confirmed by inspecting
  `.venv/lib/python3.13/site-packages/twilio/rest/messaging/` (only `v1/` exists). No dependency
  bump; smaller blast radius than upgrading the SDK for one endpoint.
- **Alerting reuses the exact pattern in `nightly_summary.py:190-211`**: resolve the account owner
  via `Users JOIN Accounts ON owner_email`, then `tools/notification_service.notify(...)`. No new
  "who do we tell" mechanism needed.
- **No new Express route, no new API endpoint.** `server/storage/accounts.ts:165-168`'s
  `getAccounts()` selects `getTableColumns(accounts)` minus `voiceFileData` — a deny-list — so the
  four new columns ride along on the existing `fetchAccounts()` call automatically. The only client
  change is extending the existing merge in `useCampaignsData.ts`.

Net: new code is one Python job + one scheduler registration + four schema columns + a ~4-line
client-side merge + one new header chip component. Nothing else in the send path, storage layer, or
routing moves.

## Phase 1 — Schema ✅ DONE (2026-07-03)

- [x] `shared/schema.ts`: add to the `accounts` table, next to `whatsappSenderStatus` /
  `whatsappSenderSid` / `whatsappDisplayName` / `messagingProvisionedAt` (`schema.ts:85-88`):
  ```ts
  whatsappQualityRating: text("whatsapp_quality_rating").default("unknown"),
  whatsappPreviousQualityRating: text("whatsapp_previous_quality_rating"),
  whatsappMessagingLimit: bigint("whatsapp_messaging_limit", { mode: "number" }),
  whatsappQualityCheckedAt: timestamp("whatsapp_quality_checked_at", { withTimezone: true }),
  ```
- [x] Migration: `migrate-quality-rating-columns.js` (mirrors `migrate-messaging-columns.js`), run via
  `node --env-file=.env migrate-quality-rating-columns.js`. Columns confirmed present on `Accounts`.

## Phase 2 — Engine: poller job ✅ DONE (2026-07-03)

- [x] Built as planned, with one small deviation: instead of renaming `_get_client`,
  `tools/twilio_service.py` gained a thin public `get_client()` wrapper around it — zero risk to
  the 4 existing internal call sites.
- [x] `tools/db/accounts.py`: `get_accounts_with_whatsapp_sender()` and `update_whatsapp_quality()`
  added, matching the query/update shape below.
- [x] `tools/notification_service.py`: added `"quality_rating_drop"` to `DEFAULT_TYPE_CHANNELS`
  (in_app + telegram + web_push, no email) — without this the alert would have silently only
  reached the in-app bell (any type absent from that dict defaults to in-app-only).
- [x] Manually invoked `run()` once against the live DB: logged `fetch_accounts` → "0 accounts to
  check" → done, no errors. Automation_Logs row confirmed. Matches spec's zero-account acceptance
  criterion exactly.

**New file**: `/home/gabriel/automations/src/automations/quality_rating_monitor.py`

```python
"""Quality Rating Monitor — polls Twilio's Senders API for WhatsApp quality
rating + messaging limit on every account with a registered sender, and
alerts on any downgrade. No push webhook exists for this signal (only
message-delivery-status webhooks do), so this must be polled."""
```

- `run()`:
  1. `AsyncLogStep("quality_rating_monitor", "fetch_accounts")` — query `Accounts` where
     `whatsapp_sender_sid IS NOT NULL` (new query in `tools/db/accounts.py`, e.g.
     `get_accounts_with_whatsapp_sender()`). Log count (expect 0 today — not an error).
  2. For each account, `AsyncLogStep("quality_rating_monitor", "check_quality", accounts_id=...)`:
     - Build a client via `tools.twilio_service._get_client(account_sid, auth_token)` (may need to
       drop the leading underscore / add a thin public wrapper if this stays private — check at
       build time; renaming a "private" helper that's already used only within its own module is a
       one-line change).
     - `client.request("GET", f"https://messaging.twilio.com/v2/Channels/Senders/{sender_sid}")`.
     - Parse `quality_rating`, `messaging_limit` from the JSON body.
     - Wrap the Twilio call in `try/except`: on failure, log and `continue` to the next account
       (matches `task_reminders.py` / `nightly_summary.py`'s per-item resilience convention).
  3. Diff: if `new_rating` is worse than the account's current `whatsapp_quality_rating` on an
     ordinal scale (`unknown` < `green` < `yellow` < `red`, worse = higher), resolve the owner
     (`Users JOIN Accounts ON owner_email`, copy `nightly_summary.py:192-198`) and call
     `tools.notification_service.notify(notification_type="quality_rating_drop", title=..., body=...,
     user_id=..., account_id=..., link=f"/campaigns")`.
  4. Update the account row: `whatsapp_previous_quality_rating = <old value>`,
     `whatsapp_quality_rating = <new>`, `whatsapp_messaging_limit = <new>`,
     `whatsapp_quality_checked_at = NOW()` (new `tools/db/accounts.py` helper, e.g.
     `update_whatsapp_quality(account_id, rating, limit)`).

**Config**: `src/config.py` — add `quality_rating_monitor_interval_seconds: int = 3600`, matching
the naming convention of the 7 existing interval settings (`config.py:53-59`).

**Registration**: `src/scheduler/jobs.py` — import `run as quality_rating_monitor_run`, register:
```python
scheduler.add_job(
    quality_rating_monitor_run,
    trigger=IntervalTrigger(seconds=settings.quality_rating_monitor_interval_seconds),
    id="quality_rating_monitor",
    name="Quality Rating Monitor",
    replace_existing=True,
)
```

## Phase 3 — Client merge + UI chip ✅ DONE (2026-07-03)

- [x] `client/src/features/campaigns/hooks/useCampaignsData.ts:45-46` — extend the existing merge:
  ```ts
  account_whatsapp_quality_rating: (account as any)?.whatsapp_quality_rating || null,
  account_whatsapp_messaging_limit: (account as any)?.whatsapp_messaging_limit ?? null,
  account_whatsapp_quality_checked_at: (account as any)?.whatsapp_quality_checked_at || null,
  ```
- [x] `client/src/types/models.ts` — added the three `account_whatsapp_*` fields to `Campaign`.
- [x] `client/src/features/campaigns/components/detailView/DetailViewHeader.tsx`:
  - `qualityDotColor()` helper colocated near `statusClass()`, using `--good`/`--warn`/
    `hsl(var(--destructive))`/`--mute-2` tokens (no raw hex, dark-mode-safe).
  - `renderMetaChip()` gained an optional 4th `title` param (was label/value/icon only) to carry the
    checked-at tooltip without a one-off wrapper.
  - Chip inserted right after Daily Limit: dot as the `icon` slot, `account_whatsapp_messaging_limit`
    (or `"—"`) as the value, tooltip via `formatDate()` on `account_whatsapp_quality_checked_at` when
    present, else an "unknown" copy string.
- [x] i18n: `meta.whatsappQuality` / `meta.whatsappQualityCheckedAt` / `meta.whatsappQualityUnknown`
  added to `client/src/locales/{en,nl}/campaigns.json`.

## Files touched (actual)

**New (Engine)**: `src/automations/quality_rating_monitor.py`.
**Edited (Engine)**: `src/scheduler/jobs.py` (registration), `src/config.py` (interval setting),
`tools/db/accounts.py` (`get_accounts_with_whatsapp_sender`, `update_whatsapp_quality`),
`tools/twilio_service.py` (public `get_client()` wrapper), `tools/notification_service.py`
(`quality_rating_drop` added to `DEFAULT_TYPE_CHANNELS`).
**New (CRM)**: `migrate-quality-rating-columns.js`.
**Edited (CRM)**: `shared/schema.ts` (4 columns), `client/src/features/campaigns/hooks/useCampaignsData.ts`
(merge), `client/src/types/models.ts` (Campaign fields), `client/src/features/campaigns/components/detailView/DetailViewHeader.tsx`
(chip), `client/src/locales/{en,nl}/campaigns.json` (copy).
**None touched**: `send_service.py`, `channel_fallback.py`, `campaign_launcher.py`, any Express route,
`server/storage/accounts.ts` (deny-list column selection already covers new columns) — confirmed.

## Verification

Confirmed 2026-07-03 (see items marked ✅); the rest need a real `whatsapp_sender_sid` and are
tracked in `action-required.md`.

1. ✅ **Poll with zero eligible accounts (today's actual state)**: manually invoked `run()` against
   the live DB — logged `fetch_accounts` → "0 accounts to check" → done, no error, no notification.
   Confirmed row in `Automation_Logs`. The registered hourly `IntervalTrigger` will repeat this
   automatically; not re-verified via the scheduler's own clock (would require an hour's wait).
2. **Poll with one eligible account**: manually set a test account's `whatsapp_sender_sid` to a real
   sender SID → next run populates `whatsapp_quality_rating` / `whatsapp_messaging_limit` /
   `whatsapp_quality_checked_at`.
3. **Downgrade alert**: manually set the account's stored `whatsapp_quality_rating` to `green`, then
   force the next poll to see a `yellow`/`red` value (or stub the Twilio response in a quick script)
   → confirms exactly one notification is inserted, addressed to the account owner.
4. **No re-alert while flat**: run the poll again with the same (already-degraded) rating → no
   second notification (diff is against `whatsapp_previous_quality_rating`, not "not green").
5. **UI**: open the Campaigns page on that account's campaign → chip shows the colored dot +
   messaging limit next to Daily Limit; hover shows the checked-at tooltip. Open any other (still
   sender-SID-less) campaign → gray dot + "—", no crash.
6. **Twilio error path**: temporarily point `whatsapp_sender_sid` at a bogus value → job logs the
   failure for that account via `AsyncLogStep` and continues (verify via `pm2 logs` /
   AutomationLogs page), does not crash the whole job.
