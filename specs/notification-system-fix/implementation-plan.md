# Notification System Fix: Implementation Plan

## Agent 1: Backend Fixes (server/)

### Task 1.1: Fix Telegram Integration
**Files:** `server/notification-dispatcher.ts`

1. Line 102: Change env var from `TELEGRAM_WEBHOOK_URL` to `TELEGRAM_BOT_TOKEN`, with fallback:
   ```typescript
   const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_WEBHOOK_URL;
   ```
2. Line 106: Validate botToken doesn't contain a full URL before constructing API URL
3. Add startup log: `console.log('[notifications] Telegram configured:', !!botToken)`
4. Ensure `chatId` from user preferences (notification_preferences.telegram_chat_id) is correctly passed to the fetch call
5. Add info-level logging on send success/failure for debugging

### Task 1.2: Fix Push Subscription Security
**Files:** `server/routes.ts`

1. Lines 1951-1956: Add user ownership check on DELETE /api/push-subscription:
   ```typescript
   // Verify the endpoint belongs to the requesting user before deleting
   ```
2. Line 1846: Change `.parse()` to `.safeParse()` with 400 response on failure
3. Lines 1939-1945: Validate user_id is not null/0 on push subscription creation

### Task 1.3: Wire SSE Notification Events
**Files:** `server/notification-dispatcher.ts`, `server/routes.ts`

1. In the `dispatchNotification()` function, after creating the DB notification, emit an SSE event to the user's connection
2. Check how SSE connections are managed (look for `sseClients` or similar map in routes.ts)
3. Send event type `notification` with the full notification object as data
4. This makes the hook's existing SSE listener (useNotificationStream.ts:156-176) actually work

### Task 1.4: VAPID Startup Check
**Files:** `server/index.ts`

1. At startup, log whether VAPID keys are configured:
   ```typescript
   console.log('[notifications] VAPID configured:', !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY));
   console.log('[notifications] Telegram configured:', !!process.env.TELEGRAM_BOT_TOKEN);
   ```

---

## Agent 2: Service Worker + Push + Hook Fixes (client/)

### Task 2.1: Harden Service Worker
**Files:** `client/public/sw.js`

1. Wrap `e.data.json()` in try-catch with fallback notification
2. On `notificationclick`, check for existing app window and focus it:
   ```javascript
   self.addEventListener('notificationclick', e => {
     e.notification.close();
     e.waitUntil(
       clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
         const existing = cls.find(c => c.url.includes(self.location.origin));
         if (existing) { existing.focus(); if (e.notification.data?.link) existing.navigate(e.notification.data.link); }
         else clients.openWindow(e.notification.data?.link || '/');
       })
     );
   });
   ```

### Task 2.2: Fix Push Registration Flow
**Files:** `client/src/pages/Settings.tsx`

1. Lines 591-629: After `pushManager.subscribe()`, verify the server POST succeeded before updating local state
2. Add better error messages for common failures:
   - Permission denied: "Please allow notifications in your browser settings"
   - VAPID missing: "Push notifications are not configured on this server"
   - Network error: "Could not register, please try again"
3. Check if `Notification.permission` is 'denied' and show appropriate message

### Task 2.3: Fix Notification Stream Hook
**Files:** `client/src/hooks/useNotificationStream.ts`

1. Lines 211-223: Add `onError` callback to rollback optimistic mark-as-read:
   ```typescript
   onError: (_err, _vars, context) => {
     queryClient.setQueryData(['notifications-count', ...], context?.previousCount);
   }
   ```
2. Verify SSE event listener for `notification` events matches what the backend sends (from Task 1.3)
3. Ensure toast deduplication works correctly with the new SSE events

---

## Agent 3: Frontend UX + i18n (client/src/components/, locales/)

### Task 3.1: Fix i18n Violations
**Files:**
- `client/src/components/crm/MobileNotificationsPanel.tsx` line 63
- `client/src/locales/en/crm.json`
- `client/src/locales/pt/crm.json`
- `client/src/locales/nl/crm.json`

1. Replace hardcoded "Notifications" with `t("notifications.title")` (already exists in crm namespace)
2. Add `notifications.loading` key to all three locale files:
   - en: "Loading..."
   - pt: "Carregando..."
   - nl: "Laden..."

### Task 3.2: Fix Badge Color Consistency
**Files:** `client/src/components/crm/Topbar.tsx`

1. Line 289: Change mobile badge from `bg-red-500` to `bg-brand-indigo` to match desktop (line 814)

### Task 3.3: Improve Delete Button Accessibility
**Files:** `client/src/components/crm/NotificationCenter.tsx`

1. Lines 360-367: Make delete button always visible on mobile (use `opacity-100 md:opacity-0 md:group-hover:opacity-100`)
2. Add `aria-label` for screen readers

### Task 3.4: Add "Clear All" and Count Display
**Files:** `client/src/components/crm/NotificationCenter.tsx`, `client/src/hooks/useNotificationStream.ts`

1. Add "Clear all" button next to "Mark all as read" in the header
2. Add a `deleteAllNotifications` mutation to the hook (calls DELETE /api/notifications with bulk)
3. When notifications are capped at 50, show "Showing latest 50" text
4. Add route: `DELETE /api/notifications/all` in routes.ts (Agent 1 should add this)

### Task 3.5: Add Type-Based Filter Tabs
**Files:** `client/src/components/crm/NotificationCenter.tsx`

1. Below the All/Unread toggle, add filter chips for notification types:
   - All | Messages | Tasks | Bookings | System
2. Filter the notification list client-side based on selected type
3. Add locale keys for filter labels to en/pt/nl crm.json

---

## Coordination Notes

- Agent 1 must add a `DELETE /api/notifications/all` route for Agent 3's "Clear all" feature
- Agent 2's SSE fix depends on Agent 1 wiring the SSE event emission
- All agents can work in parallel on their non-dependent tasks
- Agent 1 handles all server/ files, Agent 2 handles sw.js + Settings.tsx + hook, Agent 3 handles NotificationCenter + Topbar + locales + MobileNotificationsPanel
