# Prospects: Server-Side Pagination + Infinite Scroll — Implementation Plan

Phased so each phase is shippable independently. Between phases the app stays green.

---

## Phase 0 — Quick wins (unrelated to pagination)

Can ship before or alongside Phase 1. Small surface area.

**0.1 Remove separator line under vertical puck tab track**
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Delete the `<div className="h-px bg-foreground/8 mx-2.5 shrink-0" />` that appears directly under the compact tab track (search for it in the compact header block).

**0.2 F shortcut to scroll selected into view**
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Add a `useEffect` on the component that registers a window `keydown` listener:
  - Bail if `e.key !== "f"` and `e.key !== "F"`
  - Bail if `e.metaKey || e.ctrlKey || e.altKey` (don't hijack browser shortcuts)
  - Bail if the active element is `INPUT`, `TEXTAREA`, or `[contenteditable]`
  - Bail if no `selectedProspect`
  - Find the card's DOM node via `data-prospect-id={pid}` (already present)
  - If found: `scrollIntoView({ block: "center", behavior: "smooth" })` using the existing `scrollContainerRef`
  - If not found (not in loaded slice yet): call a new `ensureProspectLoaded(pid)` function exposed by the data hook after Phase 2. Until Phase 2, just log and no-op.
- Cleanup listener on unmount.

These two are independent of the pagination work and can land today.

---

## Phase 1 — Backend: paginated + filtered prospects endpoint

**File: `server/storage.ts`**

Add a new method `getProspectsPaginated(accountId, params)` that:
- Takes `params: { limit?: number; offset?: number; search?: string; niche?: string[]; status?: string[]; country?: string[]; priority?: string[]; source?: string[]; overdue?: boolean; sortBy?: string; groupBy?: string; groupDirection?: "asc" | "desc"; all?: boolean }`
- Builds a Drizzle query on the `prospects` table with:
  - `WHERE account_id = ?` (or whatever current scoping is — check existing `getProspects()`)
  - Filter clauses (each optional, each `IN (...)` for array filters)
  - Search: `ILIKE '%search%'` on `name`, `company`, `email`, `contact_name` (OR'd together)
  - Overdue: `next_follow_up_date < NOW()`
  - Sort: whitelist columns (`updated_at`, `created_at`, `name`, `priority`). Reject unknown columns to prevent SQL injection via column name.
  - Group direction affects the primary ORDER BY (group column first, then sort column)
- If `all === true`: no `LIMIT`/`OFFSET` (used by pipeline, topbar, conversations)
- Else: `LIMIT ? OFFSET ?` with defaults `limit=100`, `offset=0`, `limit` capped at 200
- Returns `{ items: ProspectRow[], total: number, hasMore: boolean }` — `total` is a separate `COUNT(*)` with the same `WHERE` but no `LIMIT`/`OFFSET`

**File: `server/routes.ts`**

Replace the current `GET /api/prospects` handler (lines 375-383) with logic that:
- Parses query params (use existing helpers where applicable)
- Parses array params (`niche`, `status`, etc.) as comma-separated strings → arrays
- Parses `all` as boolean
- Calls `storage.getProspectsPaginated(accountId, params)`
- Returns `{ items, total, hasMore }` always (consistent shape). `all=true` still returns this shape, just with `items` containing everything and `hasMore: false`.

**Breaking change:** response shape changes from `ProspectRow[]` to `{ items, total, hasMore }`. Every consumer (Phase 2) must be updated.

**Tests:** add a manual smoke test plan at the end of action-required.md — hit the endpoint with curl, verify filters work.

---

## Phase 2 — Frontend: new data hook + API client

**File: `client/src/features/prospects/api/prospectsApi.ts`**

Update `fetchProspects()`:
- Accept params: `{ limit?, offset?, search?, filters?, sortBy?, groupBy?, groupDirection?, all? }`
- Serialize arrays as comma-joined strings
- Return type changes to `{ items: ProspectRow[]; total: number; hasMore: boolean }`

Keep all other methods (`updateProspect`, `createProspect`, etc.) unchanged.

**File: `client/src/features/prospects/hooks/useProspectsData.ts`**

This hook currently does `fetchProspects()` once and stores everything in `rows`. Split responsibilities:

- **Create a new hook** `useProspectsPaginated(params)` that uses TanStack Query infinite query:
  - `queryKey: ["/api/prospects", "paginated", params]` (params object includes all filter/sort/group/search)
  - `queryFn` takes `pageParam` (offset), calls `fetchProspects({ limit: 100, offset: pageParam, ...params })`
  - `getNextPageParam` returns `offset + limit` if `hasMore`, else `undefined`
  - Returns `{ items: ProspectRow[] (flattened from all pages), total, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading, refetch }`
  - Expose `ensureProspectLoaded(pid: number)`: iterates `fetchNextPage()` until the target `pid` is in the flattened items or `hasNextPage === false`. Used by the F shortcut and by initial auto-select.

- **Keep `useProspectsData`** for table view + page-level operations. Change its underlying fetch to use `fetchProspects({ all: true })`. Table view still gets all rows. This matches the "out of scope" decision in requirements.md.

- **List view** switches from `useProspectsData` to `useProspectsPaginated`. The list view receives live toolbar state (filters, sort, group, search) as props from `ProspectsPage`, and passes them as hook params. When any of them change, the query key changes, TanStack Query fetches fresh page 1. This replaces the client-side filter/sort/group pipeline.

**File: `client/src/features/prospects/components/useProspectListFiltering.ts`**

Refactor: this hook no longer needs to filter, sort, group, or paginate — the server does. It becomes a **view-model hook** that:
- Receives the server-returned `items` (already filtered/sorted/grouped)
- Interleaves group headers based on the group-by field (reading the grouped values from consecutive items — since the server sorted by group column, the client just needs to detect boundaries and insert headers)
- Computes per-group counts (from `total` + per-group accumulators? or a small supplemental endpoint `GET /api/prospects/group-counts` if needed — defer this, try client-side accumulation first)
- Exposes `availableNiches`, `availableCountries`, `availableSources` — these need to come from a separate endpoint (see Phase 4) because the loaded slice won't have them all

For Phase 2, stub these "available X" arrays from the currently loaded items. It'll be imperfect (filters might be missing options until you scroll). Phase 4 fixes this properly.

**File: `client/src/features/prospects/pages/ProspectsPage.tsx`**

No structural change; just make sure toolbar state is passed to the list view as props (likely already is). If other views receive a `prospects` prop from the page, keep the old `useProspectsData({ all: true })` hook to feed them. Only the list view gets the paginated hook.

---

## Phase 3 — List view consumes paginated data

**File: `client/src/features/prospects/components/ProspectListView.tsx`**

- Remove the old `paginatedItems` / `currentPage` / `maxPage` / `PAGE_SIZE` logic.
- Render the full `items` array from the paginated hook (already pre-sliced by server).
- At the bottom of the scroll container, render a sentinel div that:
  - When `hasNextPage`: shows a "Load more" button (triggers `fetchNextPage()`)
  - When `isFetchingNextPage`: shows a spinner on the button
  - When `!hasNextPage && items.length > 0`: shows subtle text "No more prospects" (or nothing)
- Remove the `<div className="h-[18px] px-3 py-1 border-t border-border/20 ...">` pagination footer entirely.
- Keep the SSE-driven refresh behavior, but instead of mutating local array, call `refetch()` on the paginated hook (which re-runs page 1 and invalidates subsequent pages).
- Wire the F shortcut's `ensureProspectLoaded` path now that Phase 2 exposes it.

---

## Phase 4 — Keep other consumers working

**4.1 Pipeline/Kanban view**
- File: `client/src/features/prospects/components/OutreachPipelineView.tsx`
- Currently receives `prospects: ProspectRow[]` from `ProspectsPage`. That comes from `useProspectsData` which now returns `{ all: true }` results. No change needed — it still gets every prospect. ✅

**4.2 Table view**
- File: `client/src/features/prospects/components/ProspectsInlineTable.tsx`
- Same story as pipeline. Still uses `useProspectsData` with `all: true`. ✅ (Acceptable for now since table is expected to be used less than list view. If table becomes heavy, do server-side pagination for it in a follow-up.)

**4.3 Topbar global search**
- File: `client/src/components/crm/Topbar.tsx`
- Currently does `apiFetch('/api/prospects')` directly. Update to `/api/prospects?all=true` and use the new `{ items }` response shape. Keep the rest of the local filtering logic.

**4.4 Conversations page prospect lookup**
- File: `client/src/pages/Conversations.tsx:102`
- Currently reads `queryClient.getQueryData<any[]>(["/api/prospects"])`. After refactor, the query key shape is different. Options:
  - (Preferred) Create a dedicated lightweight endpoint `GET /api/prospects/by-ids?ids=1,2,3` that returns just `{ id, name, company, contact_name, email }` for a list of ids. Conversations page fetches on demand.
  - (Fallback) Have Conversations also call `useProspectsData({ all: true })`. Simpler, but loads every prospect into a page that only needs a few.
- Spec decision: go with the dedicated `by-ids` endpoint. It's the minimum-payload solution that scales.

**4.5 UncontactedProspectPicker, ProspectChatPanel, TemplatePicker**
- File: `client/src/features/conversations/components/**`
- Audit what they read from the `["/api/prospects"]` cache. If they need full list, use `useProspectsData({ all: true })`. If they need lookup by id, use the new `by-ids` endpoint.

**4.6 SSE invalidation**
- Files: anywhere that does `queryClient.invalidateQueries(["/api/prospects"])`
- Update invalidation keys. The paginated query key is `["/api/prospects", "paginated", params]` and the all-mode key is `["/api/prospects", "all"]`. Invalidate both (use a predicate: `queryKey[0] === "/api/prospects"`).

---

## Phase 5 — Supplemental endpoint for filter options

**Problem:** available filter values (niches, countries, sources) currently come from the full client-side array. With pagination, the slice doesn't contain every distinct value.

**Solution:** add `GET /api/prospects/filter-options` that returns `{ niches: string[], countries: string[], sources: string[] }` — a `SELECT DISTINCT` on each column, scoped to account.

- `server/routes.ts` — add the endpoint
- `server/storage.ts` — add `getProspectsFilterOptions(accountId)`
- `client/src/features/prospects/api/prospectsApi.ts` — add `fetchProspectsFilterOptions()`
- `client/src/features/prospects/components/useProspectListFiltering.ts` — use this endpoint to populate `availableNiches`, `availableCountries`, `availableSources`
- Cache aggressively: TanStack Query with `staleTime: 5 * 60 * 1000` (5 min). Invalidate when a prospect is created/updated with a new niche.

---

## Sequencing and validation

Order of work:
1. Phase 0 (separator + F shortcut stub) — 15 min
2. Phase 1 (backend) — 1-2h
3. Phase 2 (hook + api client) — 2h
4. Phase 3 (list view wiring) — 1h
5. Phase 4 (other consumers) — 2h
6. Phase 5 (filter options endpoint) — 30min

**Total:** 6-8 hours of focused work.

**Between each phase, verify:**
- Prospects page loads
- List view shows data
- Selecting a prospect opens detail panel
- Pipeline view shows columns with counts
- Topbar search finds prospects
- Conversations page shows prospect names
- SSE refresh still triggers list refresh on prospect change

**Risks to watch:**
- TanStack Query key structure change will cause stale data until restart. Warn to open a fresh tab.
- The `all=true` mode is a footgun — a future dev might call it without thinking and regress the payload problem. Add a comment on the endpoint and prefer `by-ids` where possible.
- Sort column whitelist — make sure every column referenced in the sort dropdown maps to a real column. Test each sort option.
- SSE refresh may now cause jank if the user is mid-scroll (refetching page 1 drops later pages). Consider only re-invalidating on `prospect_changed` for prospects that are in the current slice, not blanket invalidation.

---

## Migration notes

- No DB migration needed. Schema stays the same.
- Existing localStorage keys (filters, sort, group, column widths) stay valid.
- On first load after deploy, TanStack Query cache on the client is cold. No stale-cache issue.
- The `?all=true` fallback means the endpoint is backwards-compatible for internal callers if we miss one — worst case they get the same data they had before, just wrapped in `{ items }`.
