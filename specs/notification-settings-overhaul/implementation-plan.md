# Implementation Plan: Notification Settings Overhaul

## Overview

Three threads: (1) add an **email** notification channel to the dispatcher + prefs schema, (2) make
the settings UI **role-aware** (clients see only booking + campaign types, Email + Push channels, no
Telegram, no standalone push card), and (3) fix the **booking notification scope** so the account's
client user(s) receive booking notifications + toast, not just agency users.

Role model: agency = role `Owner`/`Admin`; client = role `Viewer` (see `useSession.ts:60`).

---

## Phase 1: Schema + prefs — add email channel

### Tasks

- [x] Add `emailEnabled` boolean to `Notification_Preferences` ([shared/schema.ts:1094](shared/schema.ts#L1094)), default `true`
- [x] Create the column on the Pi via a direct `pg` SQL script (`db:push` has no TTY): `ALTER TABLE "Notification_Preferences" ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;`
- [x] Extend `typeOverrides` channel keys to include `email` (it's a free-form JSON map; no schema change, just handle the `email` key in code + defaults)
- [x] Update `getDefaultNotifPrefs()` and the `NotificationPreferences` type in
      [client/src/features/settings/types.ts](client/src/features/settings/types.ts) to include
      `email_enabled` and an `email` key in each type override default

### Technical Details

- Per-type override shape becomes `{ telegram: bool, web_push: bool, email: bool }`.
- Server prefs API (`GET/PATCH /api/notifications/preferences`) must read/write `email_enabled` —
  update the route + storage method that currently handle `telegram_enabled`/`web_push_enabled`.

---

## Phase 2: Email channel — add to BOTH dispatchers (Python is the booking path)

The email channel must exist in the **Python** `notification_service.py` (that is what fires on real
bookings) and, for parity, in the Express dispatcher (for the flows it owns).

### Tasks

- [x] **Python** `/home/gabriel/automations/tools/notification_service.py` [complex]
  - [x] Add `"email"` to each row of `DEFAULT_TYPE_CHANNELS` (at minimum `booking_confirmed` and
        `campaign_finished` default `email: True`; others `False` or as desired)
  - [x] In `notify()`, after the web_push block, add an email block gated by
        `type_cfg.get("email")` AND `prefs.get("email_enabled", True)`
  - [x] Add `_send_email_task(user_id, title, body, link, notif_id)`: look up the user's email,
        send via the engine's existing email sender (the same SMTP relay used for openers/fallback —
        confirm the helper in `tools/`, e.g. `send_email()`), set `email_sent` flag, log the step
  - [x] Ensure `seed_default_preferences` / the prefs row includes `email_enabled` (Phase 1 column)
- [x] **Express** [server/notification-dispatcher.ts](server/notification-dispatcher.ts) (parity for
      non-booking flows)
  - [x] Add a `sendEmailNotification(...)` path: resolve the recipient email from the app user row;
        send via `sendRawEmail({ to, subject, text, html })` from [server/email.ts](server/email.ts)
  - [x] Extend `isChannelEnabled()` channel union to `"telegram" | "web_push" | "email"` and add
        `if (channel === "email") return prefs.emailEnabled;`
  - [x] In `dispatchExternal()`, call the email path when `isChannelEnabled(prefs, "email", type)`

### Technical Details

- Both dispatchers read the SAME `Notification_Preferences` table, so the `email_enabled` column +
  the `email` key inside `type_overrides` are honored by both. Keep the merge order identical
  (type default ← user override ← global toggle).
- Keep email fire-and-forget + try/catch in both; an email failure must never break the in-app
  notification.
- Express side: reuse the `sendRawEmail` transporter; a simple branded HTML wrapper can mirror the
  invite email builder already in `server/email.ts`. Python side: reuse the engine's existing SMTP
  send helper (do NOT spin up a second transport).

---

## Phase 3: Booking recipients — notify all client users + the agency (in Python)

The real booking notification is created in the **Python webhook**, which today notifies only the
account owner (`owner_email` match). Broaden the recipient set there.

### Tasks

- [x] In `/home/gabriel/automations/src/webhooks/booking_routes.py` (~line 623-645, the
      `booking_confirmed` block), replace the single `owner_email` lookup with a recipient list [complex]
  - [x] Resolve **all `Viewer` users on the account** (`Users.accounts_id = account_id`, role
        `Viewer`) — covers owner and non-owner client users
  - [x] Resolve the **agency users** (`accounts_id = 1`, roles `Owner`/`Admin`) so you also get a toast
  - [x] Call `notify(...)` once per distinct recipient `user_id` (dedupe the list first)
- [x] Keep the Express `leads.ts:201` + `:992` booking notifications for **manual CRM flips only**;
      ensure they do NOT also fire for a webhook-driven booking (guard already exists:
      `newStatus === "Booked" && oldStatus !== "Booked"` — confirm the webhook updates the DB directly
      and does not re-enter the Express PATCH path, so there is no double-fire). Document the finding.

### Technical Details

- Recipients persist a `Notifications` row each (via `insert_notification` inside `notify`). The
  frontend then surfaces each recipient's row on its next `/api/notifications` refetch — no SSE-bus
  work needed.
- Role values: agency = `Owner`/`Admin`; client = `Viewer` (mirror `useSession.ts:60`).
- Dedupe so a user who is somehow both owner and in another set is notified once.
- Per-recipient channels still respect each user's prefs inside `notify()` (so an agency user who
  turned booking emails off won't get the email, etc.).

---

## Phase 4: Role-aware settings UI

### Tasks

- [x] In [client/src/features/settings/components/NotificationsSection.tsx](client/src/features/settings/components/NotificationsSection.tsx),
      derive `isAgency` from the session role (`Owner`/`Admin`) vs client (`Viewer`)
- [x] **Remove the standalone Browser Push card (Section B) for everyone**; instead, when a user
      toggles a per-type push column on and is not yet push-subscribed, run the existing
      `handleEnablePush()` flow inline (keep the function, drop the dedicated card UI)
- [x] For clients (`Viewer`):
  - [x] Filter `NOTIF_TYPE_KEYS` to `["booking_confirmed", "campaign_finished"]`
  - [x] Hide the Telegram section (Section A) and the Telegram column in the per-type grid
  - [x] Per-type columns = **Email + Browser push**
- [x] For agency (`Owner`/`Admin`): keep all 8 types; columns = **Telegram + Web push + Email**
      (add the new Email column for everyone)
- [x] Add the **Email** column header + per-row toggle wired to the `email` override key
- [x] i18n: add email-channel + any new strings to `client/src/locales/{en,nl,pt}/settings.json`

### Technical Details

- Role source: `useSession()` exposes the user; `role === "Owner" || role === "Admin"` ⇒ agency
  (mirror `useSession.ts:60`). Clients are `Viewer`.
- The per-type grid is currently `grid-cols-[1fr_auto_auto]` (label + 2 channel columns). For agency
  it becomes 3 channel columns (`[1fr_auto_auto_auto]`); for clients 2 columns (Email + Push). Drive
  the column set from an array of active channels so the grid template + headers + rows stay in sync.
- Keep the auto-save (`updateNotifPrefs`) pattern; just add the `email` key to the override updates.
- When removing the standalone push card, preserve `pushDevices` management somewhere minimal for
  agency (a small "registered devices" list can stay under the push column, or move to an
  advanced/collapsed area) — confirm with Gabriel if device management UI should remain for agency.
