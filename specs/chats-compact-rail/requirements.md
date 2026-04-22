# Chats — Compact Rail + Server-Side Pagination

## What

Port the compact-rail pattern to the Chats / Conversations page and migrate to server-side pagination. This is the highest-value application of the rail because the chat panel is the most width-hungry screen in the CRM.

## Goals

- Conversations list collapses to 65px rail when chat panel needs the space
- Compact threshold: 1000px right-panel width (hysteresis 1000/1300)
- Server-paginated conversation list with search across contact name / last message
- Avatar in compact mode: initials circle + **unread badge ring** (pulse if new incoming)
- F-shortcut scrolls selected conversation into view
- Real-time SSE already exists for messages — extend to refresh conversation order on new message

## Non-Goals

- No change to message view / composer
- No virtualization of messages themselves
- No mobile redesign

## Acceptance Criteria

- [ ] Conversations page uses `CompactEntityRail`
- [ ] Server endpoints: `GET /api/conversations` paginated, `/by-ids`, `/filter-options`
- [ ] `useConversationsPaginated` hook
- [ ] Compact avatar shows unread state visually (ring/dot)
- [ ] New incoming message moves conversation to top via SSE refetch
- [ ] Tabs: All / Unread / Needs reply / Booked / Archived
