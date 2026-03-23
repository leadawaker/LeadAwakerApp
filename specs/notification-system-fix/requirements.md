# Notification System Fix: Requirements

## Problem Statement

The notification system has been built out but has several critical bugs preventing it from working:
1. Telegram notifications never send (wrong env var + malformed API URL)
2. Browser push notifications fail ("registration failed permission")
3. SSE notification events are dead code (toasts never fire from real-time events)
4. Security gaps in push subscription management
5. Frontend UX gaps (no bulk actions, accessibility issues, i18n violations)

## Acceptance Criteria

### Phase 1: Critical Backend Fixes
- [ ] Telegram bot token is read from a proper `TELEGRAM_BOT_TOKEN` env var (with fallback to extracting from `TELEGRAM_WEBHOOK_URL`)
- [ ] Telegram API URL is constructed correctly
- [ ] Telegram chat ID from user preferences is passed correctly to the sendMessage call
- [ ] DELETE /api/push-subscription verifies user ownership before deleting
- [ ] POST /api/notifications uses `.safeParse()` with proper error response
- [ ] VAPID environment variables are documented and checked at startup with a clear log message

### Phase 2: Push + SSE Fixes
- [ ] Service worker `push` event handler has try-catch around `e.data.json()`
- [ ] Service worker `notificationclick` focuses existing app tab instead of opening new window
- [ ] SSE stream actually emits `notification` events when a notification is created (or the hook listens to the right event)
- [ ] Push subscription flow in Settings verifies server persistence before showing "enabled"
- [ ] Optimistic mark-as-read has rollback on server error

### Phase 3: Frontend UX Improvements
- [ ] Hardcoded "Notifications" in MobileNotificationsPanel uses i18n
- [ ] `notifications.loading` key added to en/pt/nl locale files
- [ ] Mobile badge color matches desktop (`bg-brand-indigo`)
- [ ] Delete button accessible on mobile (visible without hover, or swipe-to-delete)
- [ ] "Mark all as read" has a companion "Clear all" button
- [ ] Notification panel shows count when capped ("Showing 50 of X")
- [ ] Filter tabs: All | Unread | Messages | Tasks | System (type-based filtering)

## Out of Scope (future)
- Notification digest/batching
- Do Not Disturb scheduling
- Notification sound options
- Notification search
- Email fallback channel
- Notification click tracking/analytics
