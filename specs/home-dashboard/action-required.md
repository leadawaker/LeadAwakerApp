# Action required: Home dashboard

State on 2026-10-13. The page, the eight `/api/home/*` endpoints and the engine's channel stamping are built and live on `app.leadawaker.com`. Nothing is committed.

## 1. Run the history backfill (one command, about a second)

Old messages and bookings have no channel yet, so per-channel numbers only cover what happened since 2026-10-12 21:56. The script fills only empty values and is safe to run twice.

```bash
cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels --dry-run   # look first
cd /home/gabriel/automations && .venv/bin/python -m scripts.backfill_home_dashboard_channels             # then write
```

What the dry run showed on 2026-10-13:

| | Result |
|---|---|
| Messages (5,819) | phone 2,343, WhatsApp 2,247, website 960, other 120, email 54, unclassified 95 |
| Bookings (85) | WhatsApp 41, website 22, booking page 8, phone 1, unclassified 13 |

- The unclassified messages are old rows with no markers at all (86 of them on deleted account 42). They stay empty on purpose.
- The script also fills `booked_at` on 20 old bookings. None is in the future, so no reminder is triggered.
- To undo: the 27 leads that had no `booked_at` before are listed in `.superpowers/sdd/implementation-plan-home-dashboard/backfill-pre-null-booked_at.json`. The two channel columns are new, so clearing them is harmless.

## 2. Restart the engine when the other engine work is ready

The engine was last restarted on 2026-10-12 21:56 (not by this work). Channel stamping is live since then and checked: new WhatsApp, website and phone rows carry the right channel.

Three small engine changes from this feature are on disk and wait for the next restart:

- **Reminders for booking-page bookings are switched back off.** Since the 21:56 restart, a booking made through the public link gets the "tomorrow" and "in about 1 hour" reminder messages, which it never did before. That was a side effect of this work. The fix is in `src/automations/booking_reminder.py`. If you would rather keep those reminders, remove the `booking_channel IS DISTINCT FROM 'booking_page'` line.
- The daily recap's "did a person reply" rule now ignores letter case, like the dashboard (`client_alerts/recap_data.py`).
- Nothing else.

The engine tree also holds other sessions' unfinished work, and 33 engine tests in voice and setup files fail. Check that before restarting:

```bash
cd /home/gabriel/automations && ./preflight.sh && pm2 restart leadawaker-engine --update-env
pm2 logs leadawaker-engine --lines 20 --nostream
```

## 3. Before the first client login

- Run step 1 first, or the client sees per-channel numbers that start on 2026-10-12.
- Compare one day of the Overview tab with that day's recap email for the same account.
- Reputation and Social tabs show only in your all-accounts view. No account has real data for either yet.

## 4. Commit

Both repos hold other uncommitted work in some of the same files, so stage by path.

- **CRM, new:** `shared/homeTypes.ts`, `shared/homePeriod.ts` (+ test), `server/storage/home*.ts`, `server/storage/interactionChannel.ts` (+ test), `server/routes/home.ts`, `server/routes/homeScope.ts` (+ test), everything under `client/src/features/home/`, `client/src/assets/home/*.webp`, `script/home/gen-images.cjs`, `specs/home-dashboard/`.
- **CRM, edited (shared with other work, stage by hunk):** `shared/schema.ts`, `server/storage.ts`, `server/routes/index.ts`, `server/storage/interactions.ts`, `server/storage/voiceCallers.ts`, `server/channel-sender.ts`, `client/src/pages/app.tsx`, `client/src/lib/landingPage.ts`, `client/src/components/crm/RightSidebar.tsx`, `CommandPalette.tsx`, `mobile/MobileMorePage.tsx`, `client/src/features/billing/components/workspace/atoms.tsx`, `client/src/styles/variables.css`, `client/src/locales/{en,nl,pt}/home.json`, `FILE_MAP.md`, `.gitignore`.
- **CRM, deleted:** the old Home sample files, `client/src/hooks/useDashboardWidgetPrefs.ts`, `client/src/components/crm/BookedCallsKpi.tsx`, `client/src/assets/home/speed.webp`.
- **Engine, new:** `tools/channels.py`, `scripts/migrate_home_dashboard_channels.py`, `scripts/backfill_home_dashboard_channels.py`, five test files (`test_channels`, `test_interaction_channel`, `test_booking_channel`, `test_insert_sites_stamp_channel`, `test_booking_reminder_selection`).
- **Engine, edited (stage by hunk):** `tools/db/interactions.py`, `tools/db/telnyx_sms.py`, `tools/send_service.py`, `tools/whatsapp_client_send.py`, `src/webhooks/booking_routes.py`, `src/automations/conversation/slot_booking.py`, `src/automations/booking_reminder.py`, `src/automations/client_alerts/recap_data.py`, and the one-line `channel=` additions in about 25 sender and webhook files.

## Known limits

- "New contacts" counts people who wrote in, not phone-only callers (same rule as the recap).
- Cost per booking on the Reactivation tab is lifetime, in EUR, not per period.
- A booking counts once, when it was made. A cancelled booking drops out.
- Website visits and widget-open rates are not counted anywhere yet.
