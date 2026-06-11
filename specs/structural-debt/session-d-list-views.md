# Session D — Leads & Accounts List View Migration

Read `specs/structural-debt/README.md` first (ownership boundaries, hard rules, no tsc).
Read `specs/structural-debt/session-b-summary.md` for the shared infrastructure this
session builds on.

**Why:** Sessions A+B cleaned up the server and migrated Tags, Prompts, Prospects, and
Billing list views onto the shared `buildEntityRows`/`groupItemsToMap` helpers in
`client/src/components/crm/entityList/`. The Leads list views and Accounts list view were
explicitly deferred as the highest-risk pages. This session finishes that migration.

The value: when the flatten/group pipeline logic needs to change (new sort direction
behavior, new group-key semantics, performance tweak), it changes once in
`buildEntityRows.ts` and all pages benefit automatically.

## Background — the shared helpers

`buildEntityRows<T, R>(opts)` — filter → sort → group → flatten into a flat row array.
`groupItemsToMap<T>(items, groupKeyOf, direction, orderGroups?)` — sort + group only.

Exported from `@/components/crm/entityList`. Read `buildEntityRows.ts` before starting
so you understand the `opts` shape and the `orderGroups` extension point.

## Milestone 1 — Inventory (no edits)

Read each of the four target files fully. For each, map:
- How items arrive (server-side filtered API call? client `useMemo` filter? both?)
- Where the flat/grouped row array is currently built (`useMemo`? inline?)
- What shape the row type is (flat item, or `{type:'header'|'item', ...}`?)
- Which variables feed into filter / sort / group / flatten
- Whether any row-building logic is also used by a sibling component (shared via props or context)

Target files:
1. `client/src/features/leads/components/LeadsCardView.tsx` (or the nearest orchestrator)
2. `client/src/features/leads/components/LeadsListPanel.tsx` (the card-column)
3. `client/src/features/leads/components/LeadsTable.tsx` (table view)
4. `client/src/features/leads/components/LeadsInlineTable.tsx` (if it owns its own rows)
5. `client/src/pages/Accounts.tsx` or `client/src/features/accounts/` (find it via FILE_MAP.md)

Save the inventory as `specs/structural-debt/session-d-inventory.md`. Include a
recommendation per file: **migrate** (clean fit), **partial** (e.g. server-filters items
but client groups them — use groupItemsToMap only), or **skip** (structure incompatible,
e.g. deeply nested like InvoicesInlineTable). Do not change any code in M1.

## Milestone 2 — Migrate Accounts list view

Migrate Accounts first because it is less visited and lower-risk than Leads.

Same pattern as Sessions B: find the `useMemo` that builds the flat/grouped rows, replace
it with a `buildEntityRows` or `groupItemsToMap` call, keep all surrounding state
untouched. If the row shape is custom, map it via `makeItem`.

Verify: load the Accounts page (`app.leadawaker.com/accounts`), check all group headers
render, sorting works, filtering works. Watch `pm2 logs`.

Commit: `refactor(ui): migrate Accounts list view onto buildEntityRows`

## Milestone 3 — Migrate Leads list views

Leads is the most complex because it has three views (card/list, table, inline-table)
that may share state from a common orchestrator. Work top-down:

1. **Read the inventory** to understand which views own their own rows and which inherit.
2. **Migrate the orchestrator first** (if it owns the flat list), then each view that
   owns its own row-building separately.
3. For server-filtered pages: if the API already returns filtered items, `predicate` in
   `buildEntityRows` is `undefined` (omit it). Only pass `comparator` and `groupKeyOf`
   if client-side sort/group is also happening.
4. If a view has a row shape incompatible with the helper (nested year→quarter tree,
   drag-and-drop rank, etc.), mark it **skip** in the summary and leave it unchanged.

Verify each view: switch between card, table, and list views on the Leads page, exercise
sort/filter/group toggles, open a lead detail panel, confirm nothing regressed.

Commit per view: `refactor(ui): migrate LeadsCardView onto buildEntityRows` etc.

## Final summary must include

- Inventory decisions (migrate / partial / skip) with reason per file
- Final LOC delta per file
- Any view that was skipped and why
- Any shared-state assumptions that turned out wrong

## Hard rules (repeat from README)

- No tsc, no `npm run dev`. Verify via `pm2 logs` + live page.
- Commit per file/view. Working tree always green.
- Move code verbatim where possible; only reshape the `useMemo` body.
- Keep all child prop APIs unchanged — only the row-building useMemo should change.
- If you discover a file is out of scope (server/routes/storage), stop and note it.
