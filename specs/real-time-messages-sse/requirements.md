# Requirements: Real-Time Messages via SSE

## What & Why

Currently, the conversations view polls for new messages every 15 seconds. This means a lead's reply or an AI response can take up to 15 seconds to appear — requiring the user to wait or manually refresh.

This feature replaces polling with **Server-Sent Events (SSE)**: the server pushes new interactions to connected clients the moment they are written to the database. The result is near-instant message display without page refreshes.

## Acceptance Criteria

- [ ] New messages (incoming from lead or AI-generated) appear in the chat view within ~1 second of being saved to the database
- [ ] No manual refresh required
- [ ] The SSE connection reconnects automatically if dropped (browser handles this natively)
- [ ] Works for all interaction types: inbound (lead), outbound AI, manual follow-up
- [ ] The 15-second polling is removed from conversations; SSE handles updates instead
- [ ] The existing polling in `useApiData.ts` (`useInteractions`) is also removed or replaced
- [ ] No impact on desktop layout or other pages

## Scope

- Only the **Conversations** feature is in scope (chat panel, interaction list)
- Lead list updates (new leads appearing) are out of scope for this feature
- Notifications are out of scope

## Dependencies

- Express server on the Pi (already running, no infra changes needed)
- PostgreSQL interactions table (already exists)
- No new npm packages required (SSE is native HTTP)

## Related Files

- `client/src/features/conversations/hooks/useConversationsData.ts` — main polling to replace
- `client/src/hooks/useApiData.ts` — secondary polling (`useInteractions`, `useInteractionsPaginated`)
- `client/src/features/conversations/components/ChatPanel.tsx` — renders messages
- `server/routes.ts` — where SSE endpoint will be added
- `server/storage.ts` — where interactions are saved (hook point for push)
