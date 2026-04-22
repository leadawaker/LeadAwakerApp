# Leads — Compact Rail + Server-Side Pagination

## What

Port the Prospects compact-rail pattern to the Leads page (`LeadsCardView.tsx`) and migrate Leads from client-side filtering to server-side pagination, matching the architecture established in the prospects-server-pagination spec.

## Why

1. Leads list can grow to thousands; current client-side fetch will not scale
2. Chat panel on Leads page is width-sensitive; compact rail reclaims space for the conversation view
3. Consistent UX across CRM list pages

## Goals

- Leads page has three left-panel states: full / compact (65px rail) / hidden
- Compact threshold: 1000px right-panel width (same hysteresis 1000/1300 as Prospects)
- Server-side pagination: `GET /api/leads?limit=100&offset=0&status=&search=&...`
- Lead avatar in compact mode: **initials circle + status progress ring** (Option B from conversation)
- F-shortcut scrolls selected lead into view, fetching pages if needed
- SSE `crm-data-changed` triggers refetch
- Reuses `CompactEntityRail` shared component (see compact-entity-rail spec)

## Non-Goals

- No change to Leads kanban/table/tree/gantt views (only the card/list view)
- No mobile redesign
- No change to LeadDetailPanel content

## Acceptance Criteria

- [ ] Leads card view uses `CompactEntityRail` in compact mode
- [ ] Server endpoints `GET /api/leads` (paginated) and `GET /api/leads/by-ids`, `GET /api/leads/filter-options`
- [ ] `useLeadsPaginated` hook mirrors `useProspectsPaginated`
- [ ] Legacy `fetchLeads()` wrapper keeps existing consumers working
- [ ] Avatar shows initials + status-progress ring
- [ ] Load more button works; total/hasMore accurate
- [ ] F-shortcut, SSE refresh, hover card all functional
