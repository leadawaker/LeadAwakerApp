# Prospects: Server-Side Pagination — Manual Actions

No DB migrations. No infra changes. All work is code-only.

## Before starting

- Seed 300+ test prospects in local DB so you can actually observe pagination working (100, 200, 300 rows load sequentially via "Load more").
- Open a fresh browser tab to avoid stale TanStack Query cache from the old flat-array shape.

## Testing checklist after each phase

### Phase 0
- [ ] Separator line below vertical tab puck is gone in compact mode (resize < 1000px width)
- [ ] Pressing F with a prospect selected scrolls it into view (log only, no fetch, still pre-Phase-2)
- [ ] Pressing F while typing in the search field does nothing

### Phase 1
Run these curl commands against the local API and verify response shape:
```
curl 'http://localhost:3000/api/prospects?limit=10' | jq '.items | length'   # 10
curl 'http://localhost:3000/api/prospects?limit=10&offset=10' | jq          # next slice
curl 'http://localhost:3000/api/prospects?search=gabriel' | jq '.total'     # count matching
curl 'http://localhost:3000/api/prospects?niche=Solar,HVAC' | jq '.total'   # filter by arrays
curl 'http://localhost:3000/api/prospects?sortBy=name_asc' | jq '.items[0]' # alphabetized
curl 'http://localhost:3000/api/prospects?all=true' | jq '.items | length'  # every row
```

### Phase 3 (list view)
- [ ] Page loads showing 100 rows or all-if-fewer
- [ ] "Load more" appears if total > 100, disappears when loaded
- [ ] Changing search / filter / sort / group resets to page 1
- [ ] Selected prospect still highlighted after pagination reset
- [ ] F shortcut fetches enough pages to reveal selected prospect, then scrolls to it
- [ ] SSE: edit a prospect in another tab, verify list refreshes

### Phase 4 (other consumers)
- [ ] Topbar search finds prospects not currently in the list view slice
- [ ] Pipeline view shows accurate column counts and drag-drop still works
- [ ] Conversations page shows prospect names/companies correctly for every thread
- [ ] Table view still shows all prospects (no pagination)

### Phase 5 (filter options)
- [ ] Filter dropdowns show every niche / country / source from the DB, even ones not in the currently loaded slice

## Known gotchas

**TanStack Query cache invalidation:** any existing `queryClient.invalidateQueries(["/api/prospects"])` calls will need to be updated to use a predicate that matches both the paginated and all-mode keys. Grep for invalidations before Phase 4 starts.

**Sort column injection:** whitelist sort columns in the backend. Reject unknown column names rather than passing them through to Drizzle. Unlikely exploit path today, but cheap to prevent.

**Pipeline view still uses all=true:** this is acceptable now but re-evaluate if the prospect count grows past ~5000. At that point pipeline should switch to fetching only counts per column (`SELECT outreach_status, COUNT(*) ... GROUP BY outreach_status`) and fetch actual rows only when a column is expanded.
