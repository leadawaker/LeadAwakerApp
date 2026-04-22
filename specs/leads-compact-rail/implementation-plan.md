# Leads — Implementation Plan

## Prerequisite

`compact-entity-rail` spec must be implemented first — this plan consumes `CompactEntityRail`.

## Phase 1: Backend Pagination

**File:** [server/storage.ts](server/storage.ts)

Add (mirror prospects pattern):
```ts
interface LeadsListParams {
  limit?: number; offset?: number;
  search?: string;
  status?: string[]; tags?: string[];
  accountId?: number; campaignId?: number;
  sortBy?: 'recent' | 'name_asc' | 'name_desc' | 'score' | 'last_contact';
  groupBy?: 'status' | 'campaign' | 'account' | 'none';
  groupDirection?: 'asc' | 'desc';
  all?: boolean;
}
async getLeadsPaginated(params: LeadsListParams): Promise<{items, total, hasMore}>
async getLeadsByIds(ids: number[]): Promise<Lead[]>
async getLeadsFilterOptions(): Promise<{statuses, tags, accounts, campaigns}>
```

**File:** [server/routes.ts](server/routes.ts)
- Rework `GET /api/leads` to return `{items, total, hasMore}`; accept the params above; `?all=true` returns everything
- `GET /api/leads/by-ids?ids=1,2,3`
- `GET /api/leads/filter-options`

## Phase 2: Client API Layer

**NEW:** `client/src/features/leads/api/leadsApi.ts` (or extend existing)
- `fetchLeadsPage(params): Promise<LeadsPage>`
- `fetchLeadsByIds(ids): Promise<Lead[]>`
- `fetchLeadsFilterOptions()`
- Legacy `fetchLeads()` → `fetchLeadsPage({all: true}).then(r => r.items)`

## Phase 3: Paginated Hook

**NEW:** `client/src/features/leads/hooks/useLeadsPaginated.ts`
- `useInfiniteQuery` with key `["/api/leads", "paginated", params]`
- PAGE_SIZE = 100
- Returns `{items, total, hasMore, isLoading, isFetchingNextPage, fetchNextPage, ensureLeadLoaded(id), refetch, invalidate}`

## Phase 4: Lead Avatar (Option B)

**NEW:** `client/src/features/leads/components/LeadCompactAvatar.tsx`
- 40px circle with initials (from lead.name)
- Surrounding `ListScoreRing` / status-progress ring:
  - Ring color keyed to `lead.status` (new / contacted / replied / booked / won / lost)
  - Progress % based on status stage index / total stages
- `ring-2 ring-white` when selected

Reuse existing `LeadAvatar` primitive if it exists; otherwise mirror `ProspectAvatar`.

## Phase 5: LeadsCardView Integration

**File:** [client/src/features/leads/components/LeadsCardView.tsx](client/src/features/leads/components/LeadsCardView.tsx) (or current leads card component)

1. Swap client-side `useQuery(['/api/leads'], fetchLeads)` for `useLeadsPaginated(filterParams)`
2. Add hysteresis state (wrap `useCompactRailHysteresis` from shared component)
3. Render `<CompactEntityRail>` when compact:
   - `items` = paginated.items
   - `renderAvatar` = `<LeadCompactAvatar lead={item} isSelected={...} />`
   - `renderHoverCard` = existing lead preview card (extract from full list row)
   - `tabs` = lead status filters (All / New / Contacted / Replied / Booked)
   - `toolbar.sortOptions` = recent / name / score / last_contact
   - `toolbar.groupOptions` = status / campaign / account / none
   - `toolbar.filterSlot` = tags/accounts/campaigns dropdowns
4. Full-state list unchanged
5. Add F-shortcut wired to `paginated.ensureLeadLoaded`
6. SSE `crm-data-changed` listener calls `paginated.refetch()`

## Phase 6: Legacy Consumer Sweep

Grep for direct `fetchLeads()` / `['/api/leads']` usage:
- Topbar search → `?all=true`
- Any feature referencing leads by cached id → switch to `fetchLeadsByIds`
- Campaign/account detail panels showing lead lists

## Phase 7: Validation

- [ ] `pm2 logs` clean after deploy
- [ ] Open leads page, narrow right panel, confirm compact rail appears at 1000px and disappears at 1300px
- [ ] Scroll/search/filter/sort all hit server
- [ ] F-shortcut on lead not yet loaded triggers page fetch, then scrolls
- [ ] Creating a new lead (SSE) appears in list without manual refresh
- [ ] Chat panel on right side benefits from reclaimed width

## File Map

| New / Edit | Path |
|---|---|
| Edit | [server/storage.ts](server/storage.ts) |
| Edit | [server/routes.ts](server/routes.ts) |
| New | [client/src/features/leads/api/leadsApi.ts](client/src/features/leads/api/leadsApi.ts) |
| New | [client/src/features/leads/hooks/useLeadsPaginated.ts](client/src/features/leads/hooks/useLeadsPaginated.ts) |
| New | [client/src/features/leads/components/LeadCompactAvatar.tsx](client/src/features/leads/components/LeadCompactAvatar.tsx) |
| Edit | [client/src/features/leads/components/LeadsCardView.tsx](client/src/features/leads/components/LeadsCardView.tsx) |
| Edit | [client/src/components/crm/Topbar.tsx](client/src/components/crm/Topbar.tsx) |
