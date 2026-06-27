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
- The genuinely missing channel is **email** — there is currently NO email notification path at all
  ([notification-dispatcher.ts](server/notification-dispatcher.ts) only does web push + Telegram).
  Email to the user's LeadAwaker account address is what most clients will actually use.

There is also a **scope bug**: the `booking_confirmed` notification at
[leads.ts:205](server/routes/leads.ts#L205) is dispatched only to agency users (`accountsId === 1`),
so the client who owns the account never receives a booking notification or in-app toast at all. The
SSE/toast plumbing already targets the recipient correctly via `broadcastToUser`
([notification-dispatcher.ts:147](server/notification-dispatcher.ts#L147)) — the recipient list just
never includes the client.

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

### Booking toast / scope fix
- [ ] When a lead flips to Booked, the account's **client user(s)** also receive the
      `booking_confirmed` notification (in-app toast + their enabled channels), not only agency users
- [ ] Verify the same for the Python webhook booking path
      (`/home/gabriel/automations/src/webhooks/booking_routes.py` ~line 639) so both creators include the client
- [ ] Existing agency notifications are unchanged

## Related Features / Dependencies

- Channels + dispatch logic: [server/notification-dispatcher.ts](server/notification-dispatcher.ts)
- Prefs schema: `Notification_Preferences` table ([shared/schema.ts:1094](shared/schema.ts#L1094))
- Type list: `NOTIF_TYPE_KEYS` ([client/src/features/settings/types.ts:33](client/src/features/settings/types.ts#L33))
- Booking creators: [server/routes/leads.ts:201](server/routes/leads.ts#L201) and the Python webhook
- Toast/SSE already works via `broadcastToUser`; no SSE change needed beyond fixing the recipient set

## Out of Scope

- SMS / WhatsApp notification channels
- Digest/batching of notification emails (send per-event for v1)
- Reworking how agency users are detected (reuse the existing role/account determination)
