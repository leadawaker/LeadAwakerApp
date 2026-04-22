# Chats Page Compact-Rail + Server-Side Pagination Spec

## Overview

Port the compact-rail pattern to the Chats page (`Conversations.tsx`) using the shared `CompactEntityRail` component, and migrate conversations to server-side pagination.

## Goals

1. Chats page collapses conversation list to 65px avatar rail at <1000px width
2. Conversation avatars in compact mode: contact initials + unread indicator ring
3. Server-side pagination for conversations with filter/search
4. Selection via ring-2 ring-white on compact avatar
5. F-shortcut scrolls selected conversation into view
6. SSE-driven refetch on conversation changes (new message, status update)

## Server-Side Pagination (Phase 1)

### Backend (`server/storage.ts`)

```typescript
interface ConversationsListParams {
  limit?: number         // default 100, max 200
  offset?: number
  search?: string        // ILIKE on contactName, lastMessage, phone
  status?: string[]      // IN filter (open/closed/archived/needs_reply)
  tags?: string[]
  accountId?: number[]
  campaignId?: number[]
  unreadOnly?: boolean
  hasUnread?: boolean
  sortBy?: 'recent' | 'oldest' | 'unread_first' | 'name_asc'
  groupBy?: 'status' | 'account' | 'campaign' | null
  groupDirection?: 'asc' | 'desc'
  all?: boolean
}

getConversationsPaginated(params): Promise<{
  items: Conversation[]
  total: number
  hasMore: boolean
}>

getConversationsByIds(ids: number[]): Promise<Conversation[]>
getConversationsFilterOptions(): Promise<{...}>
```

### Routes

- `GET /api/conversations` — `{items, total, hasMore}` shape
- `GET /api/conversations/by-ids?ids=1,2,3`
- `GET /api/conversations/filter-options`

### Client API

`client/src/features/conversations/api/conversationsApi.ts`:
- `fetchConversationsPage(params)`
- `fetchConversationsByIds(ids)`
- `fetchConversationsFilterOptions()`
- Legacy `fetchConversations()` wraps `{all: true}`

### Pagination Hook

`client/src/features/conversations/hooks/useConversationsPaginated.ts`:
- useInfiniteQuery, PAGE_SIZE=100
- `ensureConversationLoaded(id)` for F-shortcut
- Returns standard paginated interface

## Compact Rail Integration (Phase 2)

### Conversation Avatar (compact)

`renderAvatar(conv, isActive, panelState)`:
- Initials circle (contact name) 40px fixed
- Status indicator: small dot at bottom-right (green=open, gray=closed, red=needs_reply)
- Unread indicator: ring around avatar colored by unread count (thickness/color)
- When `isActive`: ring-2 ring-white outer

### Conversation Hover Card

`renderHoverCard(conv)`:
- Contact name, phone/handle
- Last message preview (truncated, with sender indicator)
- Last message timestamp
- Unread count badge
- Status badge
- Quick actions: open, mark read, archive

### Toolbar

Conversation-specific filters:
- Search (contact name, message body, phone)
- Status filter (open/closed/archived/needs_reply)
- Tags
- Account
- Campaign
- Unread only toggle
- Sort: recent / oldest / unread first / name
- Group by: status / account / campaign / none

### Page Structure

```tsx
<CrmShell>
  <Header />
  <ViewTabBar />
  <ConversationsToolbar ... />

  <div className="flex gap-4 overflow-hidden min-h-0">
    <CompactEntityRail
      items={conversations}
      selectedId={selectedConvId}
      onSelect={setSelectedConvId}
      renderAvatar={renderConvAvatar}
      renderHoverCard={renderConvHoverCard}
      ...
    />
    <ChatPanel conversationId={selectedConvId} />
  </div>
</CrmShell>
```

## SSE Integration (Phase 3)

- Listen to `crm-data-changed` events
- On `conversation_changed` / `message_received` events: call `paginated.refetch()`
- Dispatch `crm-data-changed` from conversation SSE hook

## Consumer Migration (Phase 4)

- Topbar unread count: use `fetchConversationsPage({unreadOnly: true, all: true})` or dedicated count endpoint
- Notifications: migrate to new API shape
- Lead detail panel: use `fetchConversationsByIds` or filter by leadId

## F-Shortcut Scroll (Phase 5)

Same as Prospects/Leads: `ensureConversationLoaded(id)` + scrollIntoView.

## Special Considerations for Chats

- **High update frequency**: conversations change often (new messages). Debounce refetch to 400ms
- **Unread count accuracy**: after paginated load, ensure unread counts aggregate from server, not client
- **Selected conversation stays loaded**: if user has conv open and it falls out of pagination window due to filter/sort change, keep its data via `fetchConversationsByIds([selectedId])`
- **Real-time message arrival**: new message SSE should trigger optimistic cache update or refetch page containing that conversation
- **Threshold 1000px**: same as Prospects/Leads. Chat panel is width-sensitive but consistency wins

## Validation Checklist

- [ ] API returns `{items, total, hasMore}`
- [ ] Compact rail activates <1000px, deactivates >1300px
- [ ] Conversation avatar: initials + status dot + unread ring
- [ ] Selection: ring-2 ring-white
- [ ] Load More fetches next page
- [ ] SSE new-message triggers refetch without jank
- [ ] F-shortcut loads and scrolls to selected conversation
- [ ] Filters (status/tags/account/campaign/unread) work server-side
- [ ] Sort/group work server-side
- [ ] Chat panel still loads messages correctly
- [ ] Unread count in Topbar still correct
- [ ] Selected conversation remains loaded if filters exclude it

## Deliverables

1. `server/storage.ts` — `getConversationsPaginated`, `getConversationsByIds`, `getConversationsFilterOptions`
2. `server/routes.ts` — replace GET /api/conversations, add /by-ids and /filter-options
3. `client/src/features/conversations/api/conversationsApi.ts` — new API + legacy wrapper
4. `client/src/features/conversations/hooks/useConversationsPaginated.ts`
5. `client/src/features/conversations/hooks/useConversationsData.ts` — dispatch crm-data-changed
6. `client/src/pages/Conversations.tsx` — consume CompactEntityRail
7. `client/src/features/conversations/components/ConversationCompactAvatar.tsx`
8. `client/src/features/conversations/components/ConversationHoverCard.tsx`
9. `client/src/features/conversations/components/ConversationsToolbar.tsx`
10. Migrate Topbar unread count, Notifications, Lead detail panel

## Dependencies

- `CompactEntityRail` component (spec: `specs/compact-entity-rail/SPEC.md`)
- Leads port complete (validates pattern on non-Prospects page first)

## Order

1. CompactEntityRail extraction
2. Leads port (validates shared component)
3. Chats port (this spec)
4. Campaigns, Accounts, etc. later
