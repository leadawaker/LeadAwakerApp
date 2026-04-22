# Leads Page Compact-Rail + Server-Side Pagination Spec

## Overview

Port the compact-rail pattern from Prospects to the Leads page, using the shared `CompactEntityRail` component, and migrate Leads to server-side pagination.

**Leads page = `LeadsCardView.tsx`** (the card/list view with chat panel). Not `LeadDetailPanel.tsx`.

## Goals

1. Leads page collapses left panel to 65px avatar rail at <1000px width
2. Lead avatars in compact mode: initials circle + status progress ring (option B, matching Prospects visual language)
3. Server-side pagination with limit/offset and filter support
4. Selection via ring-2 ring-white on compact avatar
5. F-shortcut scrolls selected lead into view, loading pages as needed
6. SSE-driven refetch on lead changes

## Server-Side Pagination (Phase 1)

### Backend (`server/storage.ts`)

Add to storage.ts:

```typescript
interface LeadsListParams {
  limit?: number         // default 100, max 200
  offset?: number        // default 0
  search?: string        // ILIKE on name, phone, email, notes
  status?: string[]      // IN filter
  tags?: string[]        // array overlap filter
  accountId?: number[]
  campaignId?: number[]
  overdue?: boolean
  sortBy?: 'recent' | 'name_asc' | 'name_desc' | 'status' | 'priority'
  groupBy?: 'status' | 'account' | 'campaign' | 'tag' | null
  groupDirection?: 'asc' | 'desc'
  all?: boolean          // bypass pagination (for Topbar, pickers)
}

getLeadsPaginated(params: LeadsListParams): Promise<{
  items: Lead[]
  total: number
  hasMore: boolean
}>

getLeadsByIds(ids: number[]): Promise<Lead[]>

getLeadsFilterOptions(): Promise<{
  statuses: string[]
  tags: string[]
  accounts: { id: number; name: string }[]
  campaigns: { id: number; name: string }[]
}>
```

### Routes (`server/routes.ts`)

- `GET /api/leads` — returns `{items, total, hasMore}`, parses query params
- `GET /api/leads/by-ids?ids=1,2,3` — batch fetch
- `GET /api/leads/filter-options` — distinct values

Legacy consumers pass `?all=true` to receive all items in `items`.

### Client API (`client/src/features/leads/api/leadsApi.ts`)

```typescript
interface LeadsPage {
  items: Lead[]
  total: number
  hasMore: boolean
}

fetchLeadsPage(params: LeadsListParams): Promise<LeadsPage>
fetchLeadsByIds(ids: number[]): Promise<Lead[]>
fetchLeadsFilterOptions(): Promise<{...}>
```

Legacy `fetchLeads()` wraps `fetchLeadsPage({all: true})` and returns `.items`.

### Pagination Hook

`client/src/features/leads/hooks/useLeadsPaginated.ts`:
- `useInfiniteQuery` with queryKey `["/api/leads", "paginated", params]`
- `ensureLeadLoaded(id)` fetches pages until lead is in DOM
- `PAGE_SIZE = 100`
- Returns `{items, total, hasMore, isLoading, isFetchingNextPage, fetchNextPage, ensureLeadLoaded, refetch, invalidate}`

## Compact Rail Integration (Phase 2)

### Lead Avatar (compact mode)

`renderAvatar(lead, isActive, panelState)`:
- Initials circle: 40px fixed, background gradient from name hash or lead color
- Status progress ring: SVG circle wrapping avatar, stroke color per status (contacted/pending/booked/converted)
- Ring visually communicates pipeline stage (0-100% based on status enum position)
- When `isActive`: wrap with `ring-2 ring-white` (outer ring)
- Tooltip on hover: lead name + status

### Lead Hover Card

`renderHoverCard(lead)`:
- Shows: name, company, status badge, phone, last interaction, quick actions (message, edit)
- Positioned absolutely to right of rail

### Toolbar Adaptation

Lead-specific filters:
- Search input (portal)
- Status filter (multi-select)
- Tags filter (multi-select)
- Account filter
- Campaign filter
- Overdue toggle
- Sort: recent / name / status / priority
- Group by: status / account / campaign / tag / none

Uses existing `ToolbarButton` pattern (icon-only → expanded on hover/active).

### Page Structure

```tsx
<CrmShell>
  <Header ... />
  <ViewTabBar ... />
  <LeadsToolbar onStateChange={setToolbarState} />

  <div className="flex gap-4 overflow-hidden min-h-0">
    <CompactEntityRail
      items={leadsItems}
      total={total}
      hasMore={hasMore}
      isLoading={isLoading}
      selectedId={selectedLeadId}
      onSelect={setSelectedLeadId}
      onLoadMore={fetchNextPage}
      getItemId={(l) => l.id}
      getItemLabel={(l) => l.name}
      renderAvatar={renderLeadAvatar}
      renderHoverCard={renderLeadHoverCard}
      searchInputNode={searchInput}
      toolbarContent={toolbarButtons}
    />
    <LeadChatPanel leadId={selectedLeadId} />
  </div>
</CrmShell>
```

## SSE Integration (Phase 3)

- Listen to `crm-data-changed` events in LeadsCardView
- On `lead_changed` event: call `paginated.refetch()`
- Dispatch `crm-data-changed` from existing lead SSE hook (mirror `useProspectsData.ts`)

## Consumer Migration (Phase 4)

Find all `fetchLeads()` and `/api/leads` consumers:

- **Topbar**: add `?all=true` param, fallback to `.items`
- **Conversations**: replace cache lookup with `fetchLeadsByIds([leadId])`
- **Lead pickers/dropdowns**: use `fetchLeads()` wrapper (returns all)
- **Campaign detail**: use `fetchLeadsPage({campaignId: [id], all: true})` or paginated

## F-Shortcut Scroll (Phase 5)

In LeadsCardView:
- On `F` key: if selectedLeadId not in DOM, call `paginated.ensureLeadLoaded(selectedLeadId)`
- After loaded, scroll element into view with smooth behavior

## Validation Checklist

- [ ] Leads API returns `{items, total, hasMore}` shape
- [ ] `?all=true` returns full list for legacy consumers
- [ ] Compact rail activates at <1000px, deactivates at >1300px
- [ ] Lead avatar shows initials + status ring in compact mode
- [ ] Selection: ring-2 ring-white on active avatar
- [ ] Load More button fetches next page
- [ ] SSE lead_changed triggers refetch
- [ ] F-shortcut loads and scrolls to selected lead
- [ ] Filters (status/tags/account/campaign/overdue) work server-side
- [ ] Sort/group work server-side
- [ ] Hover card shows correctly, doesn't clip on scroll
- [ ] Chat panel still works when lead selected
- [ ] Topbar lead count still correct
- [ ] Conversations page still resolves lead names

## Deliverables

1. `server/storage.ts` — add `getLeadsPaginated`, `getLeadsByIds`, `getLeadsFilterOptions`
2. `server/routes.ts` — replace GET /api/leads, add /by-ids and /filter-options
3. `client/src/features/leads/api/leadsApi.ts` — new API functions + legacy wrapper
4. `client/src/features/leads/hooks/useLeadsPaginated.ts` — new hook
5. `client/src/features/leads/hooks/useLeadsData.ts` — dispatch crm-data-changed
6. `client/src/features/leads/components/LeadsCardView.tsx` — consume CompactEntityRail + paginated hook
7. `client/src/features/leads/components/LeadCompactAvatar.tsx` — initials + status ring renderer
8. `client/src/features/leads/components/LeadHoverCard.tsx` — hover card content
9. `client/src/features/leads/components/LeadsToolbar.tsx` — extracted toolbar state
10. Migrate Topbar, Conversations, pickers to new API shape

## Dependencies

Requires `CompactEntityRail` component from `specs/compact-entity-rail/SPEC.md` to be extracted first.

## Notes

- Keep `LeadsCardView.tsx` as the Leads page (per CLAUDE.md terminology rule)
- Status ring colors follow existing lead status color tokens
- Threshold 1000px same as Prospects for consistency
- After Leads is complete, port pattern to Chats (`Conversations.tsx`) with same approach
