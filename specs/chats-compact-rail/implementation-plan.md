# Chats — Implementation Plan

## Prerequisites

1. `compact-entity-rail` spec implemented
2. `leads-compact-rail` spec implemented (validates the shared component against a second page before landing here)

## Phase 1: Backend

**File:** [server/storage.ts](server/storage.ts)

```ts
interface ConversationsListParams {
  limit?: number; offset?: number;
  search?: string;                     // contact name + last message body
  status?: ('unread' | 'needs_reply' | 'booked' | 'archived')[];
  campaignId?: number; accountId?: number;
  sortBy?: 'recent_message' | 'name_asc' | 'unread_first';
  all?: boolean;
}
async getConversationsPaginated(params): Promise<{items, total, hasMore}>
async getConversationsByIds(ids): Promise<Conversation[]>
async getConversationsFilterOptions()
```

Key: `sortBy='recent_message'` must sort by MAX(messages.created_at) per conversation. Add index if missing.

**File:** [server/routes.ts](server/routes.ts)
- Rework `GET /api/conversations` to paginated shape
- `/by-ids`, `/filter-options`

## Phase 2: Client API + Hook

- `client/src/features/conversations/api/conversationsApi.ts` — `fetchConversationsPage`, `fetchConversationsByIds`, etc.
- `client/src/features/conversations/hooks/useConversationsPaginated.ts`

## Phase 3: Compact Avatar

**NEW:** `client/src/features/conversations/components/ConversationCompactAvatar.tsx`
- 40px initials circle from contact name (fallback phone last 4 digits)
- Unread visual:
  - Ring color: red when unread > 0, neutral otherwise
  - Small numeric badge bottom-right for unread count
  - Pulse animation on brand-new incoming (last 10s)
- `ring-2 ring-white` when selected

## Phase 4: Conversations Page Integration

**File:** [client/src/pages/Conversations.tsx](client/src/pages/Conversations.tsx)

1. Replace current conversation list fetch with `useConversationsPaginated`
2. Add hysteresis hook
3. Render `<CompactEntityRail>` when compact
4. Message-view panel stays as-is and gets the extra width
5. SSE `new_message` event → call `paginated.refetch()` (debounced ~400ms)
6. Keep the existing uncontacted-prospect picker working (already migrated to `fetchProspects` wrapper)

## Phase 5: Legacy Sweep

- Any feature that hard-coded `['/api/conversations']` cache reads
- Topbar global search of conversations → `?all=true`

## Phase 6: Validation

- [ ] Narrow chat window — rail appears, messages get the space
- [ ] Incoming WhatsApp message bumps conversation to top without page refresh
- [ ] Unread ring updates in real time when message arrives
- [ ] F-shortcut works on a conversation deep in the list
- [ ] Search by contact name / message body hits server and returns accurate results

## Open Questions

- Should compact mode show a tiny preview of last message on hover, or only identity? (Defer to hover-card implementation — use last message snippet to match current full-row info density)
- Archive tab: does archive already exist in schema? If not, defer archive filter to a follow-up spec
