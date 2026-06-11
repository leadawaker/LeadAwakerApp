# Session B — Frontend Structural Debt

Read `specs/structural-debt/README.md` first (ownership boundaries, hard rules, no tsc, no visual changes).

**Why:** Five features (Leads, Prospects, Accounts, Billing, Prompts/Tags) each hand-rolled the same trio — ListView + InlineTable + DetailPanel — duplicating an estimated 5–8K lines of filter/sort/group/search logic (LeadsTable 1,674 + ProspectsInlineTable 1,139 + BillingListView 1,512 + ...). Consolidate the shared logic, then split the giant LeadDetailPanel. Build on the existing wine primitives so later reskins propagate from one place.

Take a before-screenshot of every page you'll touch (playwright-cli) before editing anything.

## Milestone 1 — Extract the shared list logic (build, don't migrate yet)

Read first: `client/src/features/leads/components/LeadsTable.tsx`, `LeadsInlineTable.tsx`, `client/src/features/prospects/components/ProspectsInlineTable.tsx`, `client/src/features/billing/components/BillingListView.tsx`, `client/src/components/DataTable/DataTable.tsx` (1,326 lines, already generic), and `client/src/components/crm/primitives/`.

Create `client/src/components/crm/entityList/`:
- `useEntityList.ts` — generic hook for filter/sort/group/search/selection state (the logic currently copy-pasted per feature). Persisted-state pattern should follow `usePersistedSelection.ts`.
- `EntityListView.tsx` — composition shell: toolbar slot, grouped card list (uses `ListCard`/`GroupHeader` primitives), detail-panel slot. Feature passes columns/renderers/actions as props.
- Reuse `DataTable.tsx` for the inline-table mode rather than writing a new table.

Keep it minimal: only abstract what at least 3 features actually share. Anything used by one feature stays in that feature.

Commit: `refactor(ui): add shared entityList infrastructure`.

## Milestone 2 — Proof migration: Prompts and Tags (smallest, lowest risk)

Migrate `features/prompts/` (PromptsListView 1,285, PromptsInlineTable, PromptsCardView) and `features/tags/` onto the new infrastructure. These pages are also not yet reskinned, so moving them onto primitives is allowed to change their look toward the standard primitives — this is the ONE exception to the no-visual-change rule, and only for these two unskinned pages. Screenshot before/after anyway.

Commit per feature. If the abstraction fights you here, fix the abstraction now before touching bigger features.

## Milestone 3 — Migrate Prospects, then Billing list views

- `ProspectListView.tsx` (988), `ProspectsInlineTable.tsx` (1,139), parts of `ProspectsPage.tsx` (1,584).
- `BillingListView.tsx` (1,512), `InvoicesInlineTable.tsx` (940) and sibling contract/expense tables.

These pages keep their current look pixel-identical (billing reskin is a separate task). Commit per feature, screenshot-compare per feature.

## Milestone 4 — Split LeadDetailPanel.tsx (2,237 lines)

Do NOT migrate the Leads list views yet (they're the most polished and riskiest — explicitly out of scope for this session; note remaining work in the summary). Instead split the detail panel:

`client/src/features/leads/components/LeadDetailPanel.tsx` → `leadDetail/` subfolder with one file per section (read the file for natural seams: header/identity, activity feed, chat/interactions, scoring, AI controls, action buttons). Move JSX and handlers verbatim; the panel file becomes a composition (<300 lines). The Leads page is the core of the product: verify every section (open lead, edit fields, send message, check chat updates) after the split.

## Milestone 5 — Wrap-up

- Update `FILE_MAP.md`: your moves + the list Session A leaves in its summary.
- Final summary: line-count deltas per feature, what was NOT migrated (Leads list views, Accounts), any abstraction limitations discovered, before/after screenshot paths.
