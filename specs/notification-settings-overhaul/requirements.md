# Requirements: Notification Settings Overhaul (role-aware + email channel)

## What and Why

The notification settings page ([NotificationsSection.tsx](client/src/features/settings/components/NotificationsSection.tsx))
was built for agency/admin power users: it exposes Telegram, a standalone browser-push enable card,
and per-type toggles for all 8 notification types. For **clients** (the read-only account users) this
is overwhelming and largely irrelevant:

- Clients only ever care about **Booked calls** and **Campaign finished**. The other six
  (task assigned/due/overdue, lead responded, manual takeover, critical automation failure) are
  agency-internal and should not be shown to clients.
- Clients won't set up Telegram.
- The standalone "enable browser push" card is redundant: if a per-type push toggle is on, we should
  just subscribe.
- The genuinely missing channel is **email** — there is currently NO email notification path at all,
  in EITHER notification system (see below). Email to the user's LeadAwaker account address is what
  most clients will actually use.

### Two notification systems (critical context — verified in code)

There are **two independent notification dispatchers**, and real bookings flow through the Python one:

1. **Express / TypeScript** — [server/notification-dispatcher.ts](server/notification-dispatcher.ts):
   web push + Telegram + SSE via `broadcastToUser`. Called from `server/routes/*` (tasks, ai-agents,
   conversations) and from [leads.ts:201](server/routes/leads.ts#L201) — but `leads.ts` only fires on
   a **manual CRM status flip**, and only to agency users (`accountsId === 1`). It does NOT fire on a
   real Cal.diy booking.
2. **Python** — `/home/gabriel/automations/tools/notification_service.py` (`notify()`): its own
   `DEFAULT_TYPE_CHANNELS`, its own Telegram + web push senders, its own in-process SSE bus, and DB
   persistence via `insert_notification`. **This is what fires on a real Cal.diy booking**
   (`booking_routes.py` ~line 639), and today it notifies only the **account owner** (looked up by
   `u.email = a.owner_email`).

**What this means for the gaps:**
- The account **owner already receives** in-app + push on real bookings (via the Python path). The
  premise is not "clients get nothing" — it's narrower: (a) **no email channel exists anywhere**,
  (b) only the *owner* user is notified, so **non-owner client users on the account get nothing**,
  and (c) the **agency may not get notified on a real booking at all** (the Python path notifies only
  the owner; the Express agency path only fires on manual flips).
- The frontend ([useNotificationStream.ts](client/src/hooks/useNotificationStream.ts)) does NOT
  consume a notification SSE event directly. It listens to `/api/interactions/stream` as a
  "something changed" ping and refetches `/api/notifications`. So **DB persistence with the correct
  recipient `user_id`(s) is what makes a toast appear** — not which SSE bus fired. The fix is
  therefore "persist a row for each correct recipient," which both systems already do via the shared
  `Notifications` table.
- Because real bookings run through Python, the **email channel and the recipient/role logic must be
  implemented in the Python `notification_service.py`** (the Express dispatcher gets the same email
  channel for parity on the flows it owns, but it is NOT the booking path).

## Acceptance Criteria

### Role-aware UI
- [ ] For a **client** (read-only / non-agency account user), the per-type list shows ONLY
      `booking_confirmed` and `campaign_finished`; the other six types are hidden
- [ ] For a client, the **Telegram** section/column is hidden entirely
- [ ] The standalone browser-push enable card (Section B) is removed for everyone; push becomes
      implicit (toggling a per-type push column on triggers the subscription flow if not yet subscribed)
- [ ] Admin/agency users keep the full set of types and channels (Telegram retained for them)

### Email channel (new)
- [ ] A new **Email** channel column in the per-type list, sending to the user's LeadAwaker account email
- [ ] Email channel respects per-type toggles and a global email enable, same pattern as web push / Telegram
- [ ] For clients, the per-type columns become **Email + Browser push** (Telegram dropped)
- [ ] Booking + campaign-finished emails are branded/clean (subject + short body + link into LeadAwaker)

### Booking recipients / scope fix
- [ ] On a real booking, the Python path notifies **all relevant recipients**, not just the account
      owner: every client (`Viewer`) user on the account AND the agency (so you get a toast too)
- [ ] A non-owner client user on the account receives the booking notification (today only the
      `owner_email` match is notified)
- [ ] The agency receives a booking notification on a **real** Cal.diy booking (today the agency is
      only notified on manual CRM flips via the Express path)
- [ ] Avoid duplicates: the booking notification has ONE canonical creator (the Python webhook). The
      Express `leads.ts` booking notification stays for manual flips only and must not double-fire for
      a webhook-driven booking
- [ ] Existing non-booking agency notifications are unchanged

## Related Features / Dependencies

- **Booking dispatch (the one that matters): Python `/home/gabriel/automations/tools/notification_service.py`**
  (`notify()` + `DEFAULT_TYPE_CHANNELS`) and its caller `booking_routes.py` (~line 639)
- Express dispatch (non-booking flows + manual flips): [server/notification-dispatcher.ts](server/notification-dispatcher.ts)
- Prefs schema (shared by both): `Notification_Preferences` table ([shared/schema.ts:1094](shared/schema.ts#L1094)) — Python reads it via `seed_default_preferences`
- Type list (UI): `NOTIF_TYPE_KEYS` ([client/src/features/settings/types.ts:33](client/src/features/settings/types.ts#L33))
- Manual-flip booking creator (keep, narrow scope): [server/routes/leads.ts:201](server/routes/leads.ts#L201)
- Toasts are driven by DB persistence + the frontend's `/api/notifications` refetch on an
  `/api/interactions/stream` ping — no SSE-bus change needed, just correct recipient rows

## Out of Scope

- SMS / WhatsApp notification channels
- Digest/batching of notification emails (send per-event for v1)
- Reworking how agency users are detected (reuse the existing role/account determination)
