# Prospects: Server-Side Pagination + Infinite Scroll

## Goal

Stop loading the entire prospects table on every page load. Fetch a paginated slice from the server with filters/sort/group applied. Add a "Load more" button at the bottom of the list view to progressively reveal more.

Also: remove the separator line below the puck tab track in compact mode, and add an `F` shortcut on the Prospects page that scrolls the selected card into view (bumping the visible slice if needed).

## Problem

Today the client calls `GET /api/prospects`, receives **all rows** (200 today, growing), holds them in TanStack Query, and does every filter / sort / group / paginate operation in memory. This does not scale: by 5k–10k rows, initial-load latency and memory pressure make the page feel heavy, and the payload over a weak network is wasteful.

Additional consumers share this global array (Topbar global search, Conversations page prospect lookup, Pipeline/Kanban column counts). The refactor must not break them.

## Scope

**In scope:**
- Backend: new paginated + filtered endpoint for prospects
- Frontend: new data hook that supports cursor/offset-based fetching with the same filter / sort / group inputs the list view already has
- List view: replace 25-per-page client pagination with infinite-scroll via `visibleCount` growth driven by a "Load more" button
- F shortcut to scroll the selected prospect into view (works in both full and compact modes, advances load if needed)
- Remove separator line below vertical puck tab track in compact mode
- Pipeline/Kanban and Topbar global search: either adopt new endpoint with no pagination bounds, or get a dedicated "fetch all" endpoint designed for their needs

**Out of scope:**
- Windowing (react-window). Skip for now, revisit only if rendering 500+ rows in the list view becomes sluggish.
- Server-side search indexing (full-text, trigram). ILIKE on name/company/email is fine for the expected volume.
- Refactoring the table view / pipeline view filtering models. They keep working the way they do today; they just call a different endpoint underneath.
- AI chat context, dashboard widgets, or any non-prospects feature.

## Acceptance criteria

1. Visiting the Prospects page triggers a single API call that returns **at most 100 prospects**, filtered/sorted/grouped server-side by the current toolbar state.
2. List view shows the first 100 and a "Load more" button if more exist. Clicking "Load more" fetches the next 100 and appends to the list. The button disappears when all results are loaded.
3. Changing any filter, sort, group, or the search field **resets** pagination to page 1 and re-fetches.
4. The detail panel still opens when a prospect is selected, and the selected prospect stays selected when filters do not remove it.
5. Pressing `F` anywhere on the prospects page (when no input/textarea has focus) scrolls the selected card into view. If the selected prospect is not yet in the loaded slice, the hook fetches enough pages to include it, then scrolls.
6. Separator line below the vertical tab puck in compact mode is gone.
7. Pipeline/Kanban view still shows accurate per-column counts across all matching prospects.
8. Topbar global search still finds prospects that are not in the loaded list view slice.
9. Conversations page still resolves prospect names/companies by id, even for prospects not in the loaded slice.
10. No regression in: inline edit, create, delete, convert-to-account, SSE-driven refresh.

## Success measurement

- Prospects page initial-load payload drops from O(all rows) to O(100) regardless of DB size.
- Verified manually: seed 1,000 prospects locally, confirm first paint < 300ms and scroll behavior smooth.
- No errors from Conversations, Topbar search, Pipeline view after change.

## Non-goals / explicit decisions

- **Offset-based, not cursor-based.** Offset is fine up to ~50k rows; cursor adds complexity we don't need yet.
- **Single endpoint gets two modes.** `GET /api/prospects?limit=100&offset=0` returns paginated; `GET /api/prospects?all=true` returns the full unpaginated result (for pipeline/topbar/conversations). Both accept the same filter params.
- **No optimistic pagination.** Load-more is a real fetch; show a spinner on the button.
- **localStorage for filters/sort/group stays**, but `visibleCount` / `offset` does not persist — page always starts at 100.
