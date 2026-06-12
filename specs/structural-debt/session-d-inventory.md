# Session D — Inventory (Milestone 1)

Map of where each Leads/Accounts list view builds its flat/grouped row array, and the
migrate / partial / skip decision per file. No code changed in M1.

## Shared helper recap

`buildEntityRows({ items, predicate?, comparator?, groupKeyOf?, groupDirection?,
orderGroups?, collapsedGroups?, makeHeader, makeItem })` → flat `R[]`.
`makeHeader(key, count)` receives the **raw group key**, so any header-label i18n
transform (e.g. `kanban.stageLabels.*`) happens inside `makeHeader`. The
custom group ordering (STATUS_GROUP_ORDER, date order) maps to `orderGroups`, and the
`asc/desc` reverse maps to `groupDirection`.

## Leads

The leads card/list, table, and inline-table views are fed by **two** row-building
useMemos, both producing the same `VirtualListItem` union
(`{kind:"header"|"lead", ...}` from `cardView/types.ts`):

| # | File | Builds rows? | Decision | Notes |
|---|------|--------------|----------|-------|
| 1 | `useLeadsFilters.ts` `flatItems` useMemo (L132–252) | **yes** | **migrate** | Owns the card/list row array. Consumed by `cardView/LeadsCardViewMain.tsx` → `cardView/LeadsListPanel.tsx`. |
| 2 | `LeadsTable.tsx` `tableFlatItems` useMemo (L598–677) | **yes** | **migrate** | Owns the table row array. Has `tableGroupDirection` asc/desc. |
| 3 | `cardView/LeadsCardViewMain.tsx` | no — calls `useLeadsFilters`, passes `flatItems` down | **skip** | No own grouping. |
| 4 | `cardView/LeadsListPanel.tsx` | no — renders `flatItems` prop | **skip** | Pure consumer. |
| 5 | `LeadsInlineTable.tsx` | no — receives `flatItems` prop (L330), only search-filters/paginates it | **skip** | Pure consumer. |

### useLeadsFilters `flatItems` shape
- **predicate:** text search + status + tag + account + campaign + upcoming-calls filters.
- **comparator:** `sortBy` enum (name/score/latest_message/recent). Default `recent`
  still sorts (so always pass comparator).
- **groupKeyOf:** `groupBy` enum (date/status/campaign/tag); `none` ⇒ flat (`groupKeyOf: null`).
- **orderGroups:** STATUS_GROUP_ORDER for status, fixed dateGroupOrder for date, else `.sort()`.
- **groupDirection:** always `asc` here (no direction toggle in card/list view).
- **makeHeader:** status ⇒ `t('kanban.stageLabels.<key>')`, else raw key.
- **makeItem:** `{kind:"lead", lead, tags: leadTagsInfo.get(id) || []}`.

### LeadsTable `tableFlatItems` shape
- **predicate:** status + account + campaign filters (search/base filters already applied
  in upstream `filteredLeads` useMemo — that one stays as-is).
- **comparator:** `tableSortBy` enum (oldest/name/score); `recent` ⇒ no sort (keep guard).
- **groupKeyOf:** `tableGroupBy` (campaign/account/status); `none` ⇒ flat.
- **orderGroups:** STATUS_GROUP_ORDER for status, else `.sort()`.
- **groupDirection:** `tableGroupDirection` (asc/desc).
- **makeHeader / makeItem:** same as above.

## Accounts

| # | File | Builds rows? | Decision | Notes |
|---|------|--------------|----------|-------|
| 1 | `features/accounts/components/AccountListView.tsx` `flatItems` useMemo (L171–240) | **yes** | **migrate** | Owns the account row array. `VirtualListItem` = `{kind:"header"|"account"}` from `listWidgets`. |
| 2 | `features/accounts/components/AccountsInlineTable.tsx` | no — receives `flatItems` prop (L169) | **skip** | Pure consumer; only search-filters/paginates. |
| 3 | `features/accounts/pages/AccountsPage.tsx` | no — orchestrator, owns selection/state | **skip** | No row-building. |
| 4 | `pages/Accounts.tsx` | n/a — mounted only at `/test-table` | **skip** | Out of the real route. |

### AccountListView `flatItems` shape
- **predicate:** text search (name/owner_email/business_niche/type) + status filter.
- **comparator:** `sortBy` (name_asc/name_desc/recent); default still sorts.
- **groupKeyOf:** `groupBy` (status/type); `none` ⇒ flat.
- **orderGroups:** STATUS_GROUP_ORDER for status, else `.sort()`.
- **groupDirection:** `groupDirection` (asc/desc).
- **makeHeader:** status ⇒ `t(STATUS_I18N_KEY[key] ?? key)`, type ⇒ raw key.
- **makeItem:** `{kind:"account", account: a}`.

## Summary of decisions

- **migrate (3):** `useLeadsFilters.ts`, `LeadsTable.tsx`, `AccountListView.tsx`.
- **skip (6):** the four pure consumers + orchestrator + the `/test-table` page.

No shared-state surprises: all three migration targets own a self-contained useMemo whose
only output is the `VirtualListItem` array passed to children by prop. Child prop APIs
stay identical.
