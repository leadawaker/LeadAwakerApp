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

- [ ] Add `emailEnabled` boolean to `Notification_Preferences` ([shared/schema.ts:1094](shared/schema.ts#L1094)), default `true`
- [ ] Create the column on the Pi via a direct `pg` SQL script (`db:push` has no TTY): `ALTER TABLE "Notification_Preferences" ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;`
- [ ] Extend `typeOverrides` channel keys to include `email` (it's a free-form JSON map; no schema change, just handle the `email` key in code + defaults)
- [ ] Update `getDefaultNotifPrefs()` and the `NotificationPreferences` type in
      [client/src/features/settings/types.ts](client/src/features/settings/types.ts) to include
      `email_enabled` and an `email` key in each type override default

### Technical Details

- Per-type override shape becomes `{ telegram: bool, web_push: bool, email: bool }`.
- Server prefs API (`GET/PATCH /api/notifications/preferences`) must read/write `email_enabled` —
  update the route + storage method that currently handle `telegram_enabled`/`web_push_enabled`.

---

## Phase 2: Dispatcher — send email channel

### Tasks

- [ ] In [server/notification-dispatcher.ts](server/notification-dispatcher.ts), add a `sendEmailNotification(...)` path
  - [ ] Resolve the recipient's email from the app user row (`storage.getAppUsers()` / a get-by-id);
        skip if no email
  - [ ] Send via `sendRawEmail({ to, subject, text, html })` from [server/email.ts](server/email.ts)
  - [ ] Subject = notif title; body = notif body + a link into LeadAwaker (`WEBAPP_URL + notif.link`)
- [ ] Add `"email"` to the `isChannelEnabled()` channel union and wire the global `emailEnabled` fallback
- [ ] In `dispatchExternal()`, call the email path when `isChannelEnabled(prefs, "email", type)`

### Technical Details

- `isChannelEnabled` already checks per-type override then global toggle — extend the `channel` type
  to `"telegram" | "web_push" | "email"` and add `if (channel === "email") return prefs.emailEnabled;`
- Keep email fire-and-forget + try/catch like the existing channels; never let an email failure break
  the in-app notification.
- Reuse the `sendRawEmail` transporter; a simple branded HTML wrapper (logo + title + body + button)
  can mirror the invite email builder already in `server/email.ts`.

---

## Phase 3: Booking scope fix — notify the client too

### Tasks

- [ ] In [server/routes/leads.ts:201-222](server/routes/leads.ts#L201), in addition to agency users,
      dispatch `booking_confirmed` to the account's **client user(s)** (the `Viewer`(s) whose
      `accountsId === lead.accountsId`)
  - [ ] Fetch those users via `storage.getAppUsers()` filtered by `accountsId === lead.accountsId`
        (and not already in the agency set), dispatch the same notification with their `userId`
- [ ] Mirror the same fix in the second booking creator at [server/routes/leads.ts:992](server/routes/leads.ts#L992)
- [ ] Mirror in the Python webhook path `/home/gabriel/automations/src/webhooks/booking_routes.py` (~line 639, `notification_type="booking_confirmed"`) so the client is included there too [complex]
  - [ ] Read `/home/gabriel/automations/CLAUDE.md` first; confirm which path actually fires on a real Cal.diy booking to avoid double-notifying

### Technical Details

- The toast/SSE already targets the recipient via `broadcastToUser(notif.userId, ...)`
  ([notification-dispatcher.ts:147](server/notification-dispatcher.ts#L147)) — once a notification row
  exists with the client's `userId`, the client gets the in-app toast automatically. No SSE change.
- Guard against double-notify: if the Express path and the Python webhook can both fire for one
  booking, pick ONE as the canonical client-notifier (recommend the Python webhook, since it's the
  true Cal.diy booking source; the Express `leads.ts` path fires on manual status flips). Document
  the decision in the spec when implementing.

---

## Phase 4: Role-aware settings UI

### Tasks

- [ ] In [client/src/features/settings/components/NotificationsSection.tsx](client/src/features/settings/components/NotificationsSection.tsx),
      derive `isAgency` from the session role (`Owner`/`Admin`) vs client (`Viewer`)
- [ ] **Remove the standalone Browser Push card (Section B) for everyone**; instead, when a user
      toggles a per-type push column on and is not yet push-subscribed, run the existing
      `handleEnablePush()` flow inline (keep the function, drop the dedicated card UI)
- [ ] For clients (`Viewer`):
  - [ ] Filter `NOTIF_TYPE_KEYS` to `["booking_confirmed", "campaign_finished"]`
  - [ ] Hide the Telegram section (Section A) and the Telegram column in the per-type grid
  - [ ] Per-type columns = **Email + Browser push**
- [ ] For agency (`Owner`/`Admin`): keep all 8 types; columns = **Telegram + Web push + Email**
      (add the new Email column for everyone)
- [ ] Add the **Email** column header + per-row toggle wired to the `email` override key
- [ ] i18n: add email-channel + any new strings to `client/src/locales/{en,nl,pt}/settings.json`

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
