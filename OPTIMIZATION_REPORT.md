# LeadAwakerApp — Full UI & Backend Optimization Report

> **Generated:** 2026-02-26 | **Branch:** `feat/leads-redesign`
> **Audited by:** 10 Opus code-analysis agents + 1 automation recommender
> **Scope:** Every post-login page, shared components, CSS, backend/API

---

## Executive Summary

This report covers **171 individual findings** across 10 domains, categorized by priority. The app has strong architectural bones — feature-based folder structure, Drizzle ORM, shadcn/ui components, and a comprehensive UI standards document. However, there are systemic issues that must be resolved before launch.

### Top 5 Systemic Issues

| # | Issue | Impact | Pages Affected |
|---|-------|--------|----------------|
| 1 | **`brand-blue` vs `brand-indigo` naming chaos** | In agency mode, `brand-blue` resolves to YELLOW — components using it turn yellow unintentionally | ALL pages (200+ occurrences) |
| 2 | **No pagination / full-table fetches** | Every page downloads ALL data on load. On Pi with 5K leads + 50K interactions, this is unusable | Leads, Conversations, Calendar, Dashboard |
| 3 | **Banned `transition-all` epidemic** | 50+ occurrences across every page, shell, and shadcn components. Causes jank on Pi | ALL pages |
| 4 | **Backdrop Dialog abuse** | 8+ pages use Dialog/Sheet for create/edit forms — explicitly banned by UI_STANDARDS §14.1 | Users, Prompts, Settings, Leads Detail, Campaigns, CSV Import |
| 5 | **Pipeline stage colors wrong everywhere** | 3+ different color maps with conflicting values — none match UI_STANDARDS §2.5 | Dashboard, Kanban, Card View, Detail Panels |

### Priority Distribution

| Priority | Count | Description |
|----------|-------|-------------|
| **P0 — Critical** | ~20 | Launch blockers: broken functionality, security issues, data bugs |
| **P1 — High** | ~45 | Must fix before launch: design system violations, UX gaps |
| **P2 — Medium** | ~60 | Polish: consistency, code quality, minor UX improvements |
| **P3 — Low** | ~46 | Future: nice-to-haves, minor optimizations |

### Security Issues (Fix Immediately)

1. **Hardcoded personal banking details** in frontend source code (IBAN, CPF, addresses) — visible to anyone inspecting JS bundle
2. **Session secret** has hardcoded dev fallback in production path
3. **Tag CRUD endpoints** use `requireAuth` instead of `requireAgency` — any logged-in user can modify tags
4. **No rate limiting on `/api/auth/login`** — vulnerable to brute force
5. **Account scoping missing** on `POST /api/leads/import-csv` and `POST /api/leads/bulk-update` — subaccount users could write to other accounts
6. **Invoice totals** calculated client-side and stored without server-side validation — crafted requests can set arbitrary totals
7. **Invoice/contract view tokens** have no rate limiting, no expiration, no IP logging
8. **No security headers** (helmet) — missing X-Frame-Options, CSP, HSTS

---

## 1. Dashboard

### Current State

1591-line mega-file serving two layouts: Agency View (KPI strip + accounts/campaigns panels) and Subaccount View (KPI strip + charts + funnel + pipeline). Widget visibility customizable via localStorage. Auto-refresh configurable.

### Issues Found

#### P0 — Critical

- **Pipeline stage colors don't match UI_STANDARDS §2.5**
  - What: `stagePalette` uses `#1a3a6f` for New, `#2d5aa8` for Contacted — standard says `#6B7280`, `#4F46E5`
  - Where: `client/src/pages/AppDashboard.tsx:299-307`
  - Fix: Import canonical `PIPELINE_HEX` from a shared constants file; update values to match §2.5

- **Pipeline card navigation uses raw `pushState` instead of wouter**
  - What: `window.history.pushState` + `PopStateEvent` bypass the router — may silently break
  - Where: `client/src/pages/AppDashboard.tsx:1508-1509`
  - Fix: Use `useLocation` from wouter and call `setLocation()`

#### P1 — High

- **`transition-all` — 14 occurrences (BANNED §7.3)**
  - Where: `AppDashboard.tsx:375,390,393,406,434,473,487,488,499,1304,1379,1390,1499,1545`; `HotLeadsWidget.tsx:193,251`
  - Fix: Replace each with specific properties (`transition-colors`, `transition-[box-shadow]`, etc.)

- **Toolbar buttons use `h-9` (36px) instead of mandatory `h-10` (40px)**
  - Where: `AppDashboard.tsx:375,406,415,434,473,499,508`
  - Fix: Change all to `h-10 rounded-full`; use `IconBtn` for icon-only buttons

- **`brand-blue` used — turns YELLOW in agency mode (visual bug)**
  - Where: `AppDashboard.tsx:391,487,1215`
  - Fix: Replace with `bg-brand-indigo` / `text-brand-indigo`

- **Hardcoded `#3b82f6` (Tailwind blue-500) for chart colors — not on-brand**
  - Where: `AppDashboard.tsx:601,640,724,1199,1235-1236,1259`
  - Fix: Replace with `#4F46E5` (brand indigo)

- **Zero accessibility — no `focus-visible`, no `aria-label` in entire 1591-line file**
  - Fix: Add focus-visible rings, aria-labels on icon buttons, role/aria-label on widget sections

- **Custom dropdowns instead of shadcn `Popover`/`Select`**
  - Where: `AppDashboard.tsx:157-168,170-181,372-401,432-465`
  - Fix: Replace with `Popover` + `PopoverTrigger` + `PopoverContent`

- **`KpiSparkline.tsx` uses `var` declarations (ES5-style)**
  - Where: `client/src/components/crm/KpiSparkline.tsx:31,59-65,119-133`
  - Fix: Replace all `var` with `const`/`let`

#### P2 — Medium

- **`computeLeadScore` duplicated in 3 files**
  - Where: `HotLeadsWidget.tsx:21-76`, `LeadScoreDistributionChart.tsx:28-82`, `ContactSidebar.tsx`
  - Fix: Extract to `client/src/lib/leadScoring.ts`

- **Dead `Stat` component**
  - Where: `AppDashboard.tsx:608-648`
  - Fix: Delete

- **1591-line mega-file needs decomposition**
  - Fix: Split into `features/dashboard/components/` — AgencyDashboard, SubaccountDashboard, KpiTile, PipelineCol, etc.

- **Countdown timer re-renders entire dashboard every second**
  - Where: `AppDashboard.tsx:217-224`
  - Fix: Extract countdown into its own component to isolate re-renders

- **Skeleton doesn't match actual layout**
  - Where: `client/src/components/ui/skeleton.tsx:134-153`
  - Fix: Create role-specific skeletons

- **50+ `any` types — no type safety**
  - Fix: Define proper TypeScript interfaces

- **"Calls Booked" KPI not prominent enough** (§1 says it's the north star metric)
  - Fix: Make it visually dominant — larger card, accent background, hero position

### Backend/API Assessment

- N+1 query in `/api/dashboard-trends` — fetches ALL campaign metrics then ALL campaigns to filter by account
- Frontend fetches ALL leads, campaigns, accounts, metrics on mount — needs a dedicated `/api/dashboard-stats` endpoint with pre-aggregated KPIs
- No error boundary — API failure leaves dashboard in perpetual loading
- No caching — every mount fires 5 parallel API requests
- Auto-refresh sends 5 requests every 60 seconds per connected tab

---

## 2. Leads — List / Card / Table Views

### Current State

Two view modes (List + Table) managed by `LeadsTable.tsx`. List view: 340px left panel with card list + right detail view with 3x2 widget grid. Table view: full-width inline-editable table with pagination (50/page). CSV import wizard.

### Issues Found

#### P0 — Critical

- **N+1 tag fetch storm — 500 leads = 500 HTTP requests**
  - Where: `client/src/features/leads/components/LeadsTable.tsx:274-312`
  - Fix: Create bulk endpoint `GET /api/leads/tags?leadIds=1,2,3` or include tags in leads response

- **No pagination — entire leads table downloaded on every load**
  - Where: `client/src/features/leads/api/leadsApi.ts:3-12`
  - Fix: Add `page` + `limit` params; implement server-side search

- **Three conflicting STATUS_DOT color maps**
  - Where: `LeadsTable.tsx:85-95` vs `LeadsInlineTable.tsx:69-78` vs `LeadsCardView.tsx` PIPELINE_HEX
  - Fix: Single shared constant file matching UI_STANDARDS §2.5

#### P1 — High

- **`brand-blue` in 45+ places** — `LeadsCardView.tsx` (15), `LeadsInlineTable.tsx` (5), `LeadsTable.tsx` (12), `CsvImportWizard.tsx` (7), `LeadFilters.tsx` (2)
  - Fix: Global replace `brand-blue` → `brand-indigo`

- **Card background `bg-[#F4F4F4]` — §15.1 says `bg-white`**
  - Where: `LeadsCardView.tsx:1808`
  - Fix: Change to `bg-white`

- **`transition-all` in 6 places (BANNED)**
  - Where: `LeadsCardView.tsx:1848`, `LeadsKanban.tsx:320,372`, `LeadInfoPanel.tsx:254`, `LeadDetailPanel.tsx:458,1143`
  - Fix: Specify exact properties

- **CsvImportWizard uses Dialog (BANNED for create/edit flows §14.1)**
  - Where: `CsvImportWizard.tsx:363`
  - Fix: Convert to right-panel pattern

- **LeadFilters component is dead code — imported but never rendered**
  - Where: `LeadsTable.tsx:180` — state initialized with no setter
  - Fix: Wire it up or delete it

- **Bulk delete sends N sequential DELETE requests**
  - Where: `client/src/features/leads/api/leadsApi.ts:59-61`
  - Fix: Create `POST /api/leads/bulk-delete` endpoint

- **Skeleton rows `h-9` (36px) instead of `h-[52px]`**
  - Where: `LeadsInlineTable.tsx:119-127`
  - Fix: Change to `h-[52px]`

- **No ResizeObserver for toolbar responsive collapse (§17.2)**
  - Where: `LeadsTable.tsx:824`
  - Fix: Add observer with `isNarrow` state at 920px threshold

#### P2 — Medium

- **Table view has no right detail panel (§11 says it should have LeadInfoPanel)**
  - Fix: Add 288px `LeadInfoPanel` when a lead is selected

- **`framer-motion` stagger on 50 cards — heavy on Pi**
  - Where: `LeadsCardView.tsx:2,2415-2442`
  - Fix: Remove; use CSS `@keyframes` if animation desired

- **No table header count, wrong separator height, toolbar classes don't use standard `tbBase/tbDefault/tbActive`**

- **Duplicate helpers across files** — `getLeadId`, `getFullName`, `getInitials`, etc.
  - Fix: Extract to `features/leads/utils/leadHelpers.ts`

#### P3 — Low

- Search is entirely client-side; no server-side search support
- No debouncing on inline cell edits
- No TanStack Query — manual `useState`/`useEffect` with no caching
- `BulkActionsToolbar.tsx` appears unused (dead code)

### Backend/API Assessment

- Pagination support exists in backend but frontend never uses it
- No server-side search/sort/filter (`?search=`, `?sort=`, `?status=`)
- CSV import iterates sequentially (one INSERT per row) — needs batched insert
- No rate limiting on bulk operations
- **Account scoping missing on `POST /api/leads/import-csv` and `POST /api/leads/bulk-update`**

---

## 3. Leads — Kanban + Detail Panels

### Current State

Kanban lives on a **separate Opportunities page** — NOT as a tab within the Leads page (despite §11 specifying 3 tabs: List|Table|Kanban). Uses @dnd-kit with DragOverlay. Detail panel is a Sheet slide-over (LeadDetailPanel) + 380px sidebar (KanbanDetailPanel) + 288px sidebar (LeadInfoPanel for table view).

### Issues Found

#### P0 — Critical

- **Kanban missing from Leads page entirely — lives on separate Opportunities page**
  - Where: `LeadsTable.tsx:72-75` — `VIEW_TABS` only has `list` and `table`
  - Fix: Either add Kanban as third tab or update §11 docs

- **LeadDetailPanel uses Sheet/backdrop overlay (BANNED §14.1)**
  - Where: `LeadDetailPanel.tsx:817`
  - Fix: Convert to right-panel inline pattern

- **PIPELINE_HEX colors don't match §2.5** — 5 of 9 stages wrong
  - Where: `LeadsKanban.tsx:104-114`, `LeadsCardView.tsx:154-163`
  - Fix: Update to match standard (New=`#6B7280`, Contacted=`#4F46E5`, Responded=`#14B8A6`, etc.)

#### P1 — High

- **`transition-all` in 6 locations** across Kanban and detail panels
- **STATUS_COLORS in InfoPanel/DetailPanel don't match PIPELINE_HEX** — same lead shows different colors in different views
  - Where: `LeadInfoPanel.tsx:30-38`, `LeadDetailPanel.tsx:131-140`
  - Fix: Derive all status colors from single PIPELINE_HEX source

- **No virtualization in Kanban columns** — "Load more" button but no virtual scrolling after expansion
- **"Closed" stage missing from PIPELINE_STAGES dropdown** in LeadDetailPanel
- **OpportunitiesPage toolbar doesn't follow §16/§17** — visible filter pills (banned), count in circle, no ViewTabBar/IconBtn
- **Interactions loaded all at once — no pagination**
  - Where: `LeadDetailPanel.tsx:546`

#### P2 — Medium

- Tag dropdown is manually positioned div, not Popover
- KanbanDetailPanel notes tab is read-only
- No status change capability in KanbanDetailPanel sidebar
- Collapsed column affordance is subtle (40px, easy to miss)
- Drop zone feedback nearly invisible (`ring-border/40` on `bg-card`)
- `brand-blue` used in 60+ occurrences across leads feature

#### P3 — Low

- Duplicate tag-fetching logic in 3 places
- `any` type used extensively for lead objects
- `getStatusAvatarColor` imported across files (circular dependency risk)
- No keyboard navigation in Kanban

### Backend/API Assessment

- Status update (drag) flow is **well-engineered** — optimistic updates, undo support, error rollback
- N+1 tag fetching — each lead triggers individual tag API call
- Interactions not paginated on frontend despite server support
- Duplicate data fetching across Leads and Opportunities pages

---

## 4. Campaigns

### Current State

Split-pane with List and Table views. Detail view has 3-column layout with funnel, financials, and inline editing. `CampaignDetailPanel` is a separate slide-over (read-only). Full CRUD with Zod validation.

### Issues Found

#### P0 — Critical

- **CampaignDetailPanel uses banned backdrop dialog pattern**
  - Where: `CampaignDetailPanel.tsx:473-479`
  - Fix: Remove — DetailView already has full inline editing via Configurations tab

- **Card background `bg-[#F1F1F1]` instead of `bg-white` (§15.1)**
  - Where: `CampaignListView.tsx:176,227`

- **Card hover uses `hover:bg-[#FAFAFA]` instead of shadow (§15.1)**
  - Where: `CampaignListView.tsx:176`

#### P1 — High

- **`text-brand-blue` in 14+ places across all campaign files** — deprecated token
- **`CampaignCardGrid.tsx` uses `transition-all` (BANNED)**
- **`useCampaignsData.ts` uses `any[]` types** — no type safety
- **Duplicate status/color constants in 5+ files** — `CAMPAIGN_STATUS_COLORS`, helpers duplicated 2-4x
- **No form/panel for campaign creation** — just creates "New Campaign" with hardcoded defaults
  - Where: `CampaignsPage.tsx:312-320`
  - Fix: Build a create panel following ContractCreatePanel pattern

- **Edit panel is read-only despite being opened via `onEditCampaign`** — misleading and redundant
- **Refresh and Delete buttons have no onClick handlers** — non-functional
  - Where: `CampaignDetailView.tsx:957-964`

- **`useCampaignsData` fetches ALL accounts on every refresh** just for name resolution
- **Missing `useCallback` on `handleRefresh`** causing unnecessary re-renders

#### P2 — Medium

- Table view tabs manually rendered instead of using `ViewTabBar`
- `ConfirmToolbarButton` doesn't follow standard toolbar patterns
- Controls row `gap-1` instead of `gap-1.5`
- Count in fixed `w-10` span — may truncate
- Two legacy files are dead code: `CampaignCardGrid.tsx`, `CampaignsTable.tsx`
- `CampaignFunnelWidget` fires full lead fetch per campaign selection
- Missing keyboard navigation on list cards
- `framer-motion` imported for stagger animations

#### P3 — Low

- Tiny pagination footer (`h-[18px]`, buttons at `text-[10px]`)
- Search always expanded (no responsive collapse)
- useEffect missing dependency
- No error state display when data fails

### Backend/API Assessment

- CRUD structure solid with Zod validation and proper scoping
- `GET /api/campaign-metrics-history` returns ALL metrics when no campaignId specified
- `useCampaignsData` makes 3+ API calls per page load (campaigns, accounts, all metrics)
- Client-side pagination with 20/page — server pagination available but unused

---

## 5. Conversations / Inbox

### Current State

Three-panel layout: InboxPanel (340px left) | ChatPanel (center) | ContactSidebar (340px right, xl+). Data via bulk fetch of ALL leads + ALL interactions, polled every 15 seconds.

### Issues Found

#### P0 — Critical

- **Full-table fetches with no pagination — downloads ALL leads + ALL interactions**
  - Where: `conversationsApi.ts:3-17`
  - Fix: Create `/api/conversations` endpoint returning `{lead, lastMessage, unreadCount}[]`; lazy-load messages per thread

- **Polling re-fetches ALL data every 15 seconds** — no delta/incremental mechanism
  - Where: `useConversationsData.ts:125-131`
  - Fix: Add `?since=<timestamp>` parameter

- **No message virtualization in ChatPanel** — all messages rendered in DOM
  - Where: `ChatPanel.tsx:240-278`
  - Fix: Use `@tanstack/react-virtual` (already a dependency)

#### P1 — High

- **Send button uses `rounded-lg bg-gray-900`** — should be `rounded-full bg-brand-indigo`
  - Where: `ChatPanel.tsx:315`

- **`transition-all` in ChatPanel and ContactSidebar (BANNED)**
- **`text-brand-blue` — 14 occurrences in InboxPanel**
- **Multiple buttons are wrong sizes** (`h-9`, `h-6` instead of `h-10`)
  - Where: `Conversations.tsx:147`, `ContactSidebar.tsx:420`

- **Thread card uses `bg-[#F1F1F1]` instead of `bg-white` (§15.1)**
  - Where: `InboxPanel.tsx:591`

- **Unread badge `bg-[#FCB803] text-white` fails WCAG contrast**
  - Where: `InboxPanel.tsx:609-614`
  - Fix: Use `text-brand-deep-blue` (#131B49) on yellow background

- **Raw `<button>` elements throughout** — should use `IconBtn`

#### P2 — Medium

- Unread tracking is client-side only (localStorage) — not synced across devices
- "New Conversation" button handler is undefined — does nothing
- `sendMessage` type defaults to "SMS" — should be "WhatsApp"
- Thread card name font `text-[15px]` — standard is `text-[13px]`
- Default Tailwind palette colors in tags and score bars
- Human agent bubble uses hardcoded `bg-[#166534]` — not in design system
- `useConversationsData` has `leads` dependency causing callback recreation

#### P3 — Low

- Icon size `h-3.5` in send button — should be `h-4 w-4`
- No Cmd+Enter keyboard shortcut for send
- Contact sidebar close button is raw `<button>`, not `IconBtn`

### Backend/API Assessment

- **No dedicated conversations endpoint** — threads built client-side from two full-table fetches
- Send message (`POST /api/interactions`) with optimistic updates is well-implemented
- 15s polling at 100 concurrent users = 200 full-table queries per 15 seconds
- **Missing:** `last_read_at` tracking, delta fetch, dedicated threads endpoint, WebSocket/SSE, message pagination

---

## 6. Accounts

### Current State

Split-pane with List + Table views. Rich detail view with 3x2 widget grid (Overview, Campaigns, Users, AI, Twilio, Activity). Create panel follows panel-first pattern.

### Issues Found

#### P0 — Critical

- **`apiFetch` return treated as parsed JSON — but it returns a `Response` object**
  - What: All inline `apiFetch` calls in AccountDetailView never call `.json()` — Campaigns, Contracts, Users sub-panels, and lead counts are **silently broken** (always empty)
  - Where: `AccountDetailView.tsx:309,321,408,526`; `AccountListView.tsx:355`
  - Fix: Add `.then(res => res.json())` to all inline `apiFetch` calls

- **"+" button is a no-op** — `onAddAccount={() => {}}`
  - Where: `AccountsPage.tsx:540`
  - Fix: Connect to `panelMode = "create"`

#### P1 — High

- **Legacy Dialog modals still exist** — `AccountCreateDialog.tsx` and `AccountDetailsDialog.tsx` (BANNED)
  - Fix: Delete both files; use `AccountCreatePanel.tsx` and inline editing

- **`LogoCropModal` uses Dialog** for non-destructive action
- **Left panel tabs hand-rolled instead of `ViewTabBar`**
  - Where: `AccountListView.tsx:491-514`

- **`transition-all` used** (`AccountListView.tsx:167,228`)
- **Card background `bg-[#F1F1F1]` instead of `bg-white`**
- **Table view has no right detail panel** (inconsistent with Leads)
- **`brand-blue` in 30+ places** across all account files

#### P2 — Medium

- Table toolbar doesn't follow §17 standard
- Skeleton rows `h-9` instead of `h-[52px]`
- Controls row `gap-1` / `pb-2.5` instead of `gap-1.5` / `pb-3`
- Count in fixed `w-10` container
- Card name `text-[14px]` instead of `text-[13px]`
- `framer-motion` for list stagger
- "Activity" widget shows "Coming soon" — looks unfinished
- Fixed `height: "48vh"` on widgets — brittle
- Legacy DataTable artifacts in `useAccountsData` hook
- Duplicate status color definitions in 4 files
- Create panel CTA uses `bg-foreground text-background` instead of `bg-brand-indigo text-white`

#### P3 — Low

- Duplicate helper functions (`getAccountId`, `getAccountInitials`, `formatRelativeTime`)
- ViewTabBar and tabs defined in two places
- Table view title lacks count

### Backend/API Assessment

- CRUD complete with proper `requireAgency` scoping
- **No aggregation endpoint** — frontend fetches with `page=1&limit=1` just to get `total` count
- Fetches ALL campaigns and ALL users then filters client-side
- **Logo stored as base64 data URL in database** — should use file storage
- Needs `GET /api/accounts/:id/stats` endpoint

---

## 7. Calendar

### Current State

1634-line file deriving appointments from Leads table (filtering for `booked_call_date IS NOT NULL`). Split-pane with appointment list + Month/Week/Day grid views. @dnd-kit for rescheduling. Popover-based booking form.

### Issues Found

#### P0 — Critical

- **ALL leads fetched — no date-range scoping or booking filter**
  - Where: `Calendar.tsx:382` (`useLeads()` with no parameters)
  - Fix: Add `?hasBooking=true&bookingFrom=X&bookingTo=Y` params

- **Year view still exists despite §18.1 removing it**
  - Where: `Calendar.tsx:48` — ViewMode type includes `"year"`, rendering at lines 976-1018
  - Fix: Remove all yearly view code

- **Left panel has no fixed width — relies solely on CSS Grid**
  - Where: `Calendar.tsx:1262-1264`

#### P1 — High

- **Does NOT use `ViewTabBar` component** — hand-rolled tabs with wrong active color (`bg-brand-indigo` instead of `--highlight-active`)
  - Where: `Calendar.tsx:1294-1320`

- **40+ deprecated `brand-blue` references**
- **Date label is `text-2xl` — §18.2 says `text-[12px]`** — dramatically oversized
  - Where: `Calendar.tsx:951`

- **Search button is non-functional** (`onClick={() => {}}`)
  - Where: `Calendar.tsx:1383-1385`

- **Prev/Next/Today are raw `<button>` elements**, not IconBtn
  - Where: `Calendar.tsx:943-972`

#### P2 — Medium

- `FiltersBar` imported but hidden — dead code
- Selected states use `bg-brand-blue/10` instead of `--highlight-selected` (warm gold)
- Hardcoded color classes on booking cards
- Count wrapped in `w-10 text-center` instead of plain text
- Time display font too dominant (`text-[15px] font-bold`)
- No click-to-create from calendar grid
- Current-time line renders in ALL week columns, not just today
- `selectedBooking` state is set but never displayed (dead-end interaction)

#### P3 — Low

- Duration edit uses raw `<select>` dropdown
- Missing `data-testid` on interactive elements
- Manual toast instead of shared toaster
- Dead `CalendarRange` import
- No keyboard navigation for month grid

### Backend/API Assessment

- **No dedicated calendar/booking endpoint** — downloads entire leads table
- No date-range query support
- No recurring events (acceptable for product scope)
- Needs: `?hasBooking=true`, `?bookingFrom=&bookingTo=`, lightweight `/api/bookings` projection endpoint

---

## 8. Settings, Users, Tags & Prompt Library

### Current State

Four admin pages with varying maturity. Settings has duplicate implementations (Settings.tsx + SettingsPanel.tsx). Users is full-featured with list/table views. Tags has clean architecture. Prompts has list/table with inline edit.

### Issues Found — Settings

#### P0

- **ChangePasswordDialog uses banned backdrop Dialog**
  - Where: `ChangePasswordDialog.tsx:106-107`
  - Fix: Use inline card approach from SettingsPanel.tsx

#### P1

- **Two parallel implementations** — Settings.tsx (stale) and SettingsPanel.tsx (current, correct)
  - Fix: Delete Settings.tsx; use SettingsPanel.tsx
- Left panel width `w-[240px]` instead of standard `w-[340px]`
- Left panel bg `#E8E8E8` instead of `bg-muted`

### Issues Found — Users

#### P0

- **Three Dialog modals for non-destructive flows** — Invite, View User, Edit User (BANNED)
  - Where: `UsersPage.tsx:841-1212`
  - Fix: Convert all to right panels

#### P1

- **Plain password field in Edit User dialog** — no current-password verification
  - Where: `UsersPage.tsx:1189-1191`
- Monolithic `UsersListView.tsx` (81KB, 1500+ lines)
- `framer-motion` dependency
- `brand-blue` in checkbox styling

### Issues Found — Tags

#### P1

- **Tag CRUD endpoints lack `requireAgency`** — any authenticated user can create/modify/delete
  - Where: `server/routes.ts:505-524`
- **Account/Campaign filter pills visible in toolbar** (BANNED §16.4)
  - Where: `TagsToolbar.tsx:293-351`
- Table row height `h-10` instead of `h-[52px]`

#### P2

- `brand-blue` references throughout
- No toolbar separator
- Doesn't follow §16 left panel standard

### Issues Found — Prompt Library

#### P0

- **PromptFormDialog uses backdrop Dialog for create/edit** (BANNED)
  - Fix: Convert to right panel; list view's inline EditPanel already works for editing

#### P1

- `brand-blue` in save button
- Monolithic `PromptsListView.tsx` (54KB)
- Raw `<select>` elements instead of shadcn `Select`

#### P2

- No template variable handling for WhatsApp prompts
- React Fragment missing keys on grouped rows

### Cross-Cutting Issues

- **Dialog modal abuse across all 4 pages** — 8+ instances total
- **`brand-blue` vs `brand-indigo` patchwork** across all files
- Settings uses 240px panel; Tags uses full-width; Users/Prompts use 340px — no consistency
- No admin-only visual indicators on any page
- Each page handles data fetching differently — no shared pattern

### Backend/API Assessment

- Tags endpoints under-protected (`requireAuth` instead of `requireAgency`)
- No rate limiting on change-password endpoint
- Bulk tag delete fires N sequential DELETE requests
- Users CRUD is well-protected with role checking
- Prompts correctly uses `requireAgency`

---

## 9. Billing, Invoices & Opportunities

### Current State

Full billing center with 3 tabs (Invoices, Expenses, Contracts). Each supports List + Table. Invoices: full CRUD, PDF generation via Playwright, view tokens. Contracts: deal structure modeling, template generation. Expenses: AI-powered PDF parsing via OpenAI. Opportunities: standalone Kanban page.

### Issues Found — Billing/Invoices

#### P0 — Critical

- **Hardcoded personal banking details in source code**
  - What: Full IBAN, CPF, addresses compiled into frontend bundle
  - Where: `InvoiceCreatePanel.tsx:28-52`, `ContractCreatePanel.tsx:51-53`
  - Fix: Move to server-side/env vars; fetch via authenticated API

- **Invoice view token endpoint has no rate limiting or expiration**
  - Where: `server/routes.ts:989,1091`

- **Expense endpoints use inconsistent auth** — manual role check instead of `requireAgency`
  - Where: `server/routes.ts:1157-1166,1253,1303,1330,1341`

#### P1 — High

- **`brand-blue` — 20+ instances** in BillingListView
- **`framer-motion` imported** — heavy on Pi
- **`formatCurrency` defaults to USD instead of EUR** for a Dutch business
  - Where: `client/src/features/billing/types.ts:123`, `InvoiceDetailView.tsx:127`
- **Orphan `/invoices` route shows "coming soon"** while real invoices work in Billing
  - Fix: Redirect to `/billing` or delete

#### P2 — Medium

- No error handling on invoice creation in hooks
- No financial summary widgets (total revenue, outstanding, overdue)
- Playwright PDF generation on Raspberry Pi — extremely heavy
- Expense PATCH doesn't handle PDF updates
- Invoice mark-paid doesn't validate current status
- Sequential bulk deletes (should use `Promise.all`)
- Revenue CSV has no header row, no duplicate check

### Issues Found — Opportunities

#### P1 — High

- **30+ `brand-blue` references**
- **Lead count in circle badge** — §16.2 says plain text
- **Account/campaign filter pills visible** (BANNED §16.4)
- **No Settings IconBtn** — filters are inline pills
- **No ViewTabBar/IconBtn/ToolbarPill usage** — all custom buttons
- **Search is always-visible input**, not SearchPill

#### P2 — Medium

- N+1 tag fetching (200+ leads = 200+ HTTP requests)
- `useEffect` depends on `leads` reference — can cause infinite loops
- No loading state while data loads
- Near-duplicate of Leads Kanban — shared logic should be extracted

### Backend/API Assessment

- **Invoice totals calculated client-side** — server stores without validation. Crafted requests can set arbitrary amounts.
- PDF generation fire-and-forget — failures logged but not reported to user
- Revenue CSV append has no concurrency protection
- Expense PATCH silently ignores PDF updates
- OpenAI PDF parsing is well-implemented with graceful degradation

---

## 10. Shell, Navigation, Shared Components & CSS

### Current State

Fixed sidebar + topbar layout via CrmShell. RightSidebar has nav items. PageTransition via framer-motion. Comprehensive CSS variables with light/dark mode. Shared components (IconBtn, ViewTabBar, ToolbarPill, SearchPill) are well-abstracted.

### Issues Found — Shell & Navigation

#### P0 — Critical

- **Dashboard missing from sidebar navigation**
  - What: 13 pages in sidebar, but no Dashboard link. Users can't navigate back after leaving.
  - Where: `RightSidebar.tsx:121-178`
  - Fix: Add Dashboard as first nav item with `LayoutDashboard` icon

#### P1 — High

- **DbStatusIndicator exists but is never rendered anywhere**
  - Fix: Add to sidebar bottom per §4.3

- **Mobile active nav uses `bg-brand-blue`** (yellow in agency mode) while desktop uses `bg-[#FFE35B]`
  - Where: `RightSidebar.tsx:374,436,450,464,477`
  - Fix: Unify to `--highlight-active` everywhere

- **Hardcoded `#FFE35B` instead of CSS variable** — breaks dark mode
  - Where: `RightSidebar.tsx:216,225,248`
  - Fix: Use `bg-[var(--highlight-active)]`

#### P2 — Medium

- `transition-all` in sidebar and CrmShell (`RightSidebar.tsx:489`, `CrmShell.tsx:148`)
- `notificationsCount` prop accepted but never passed/used

### Issues Found — CSS & Design Tokens

#### P1 — High

- **Dark mode highlight tokens drift from spec** — saturation/lightness values differ from §2.9
  - Where: `index.css:232-234`

#### P2 — Medium

- **630+ lines of hologram/glitch CSS loaded globally** — meant for marketing pages only
  - Where: `index.css:269-898`
  - Fix: Extract to separate file, load only on marketing pages

- Default Tailwind colors in DateRangeFilter (`text-orange-500`, `text-blue-500`)
  - Where: `DateRangeFilter.tsx:75,79-80`

### Issues Found — Shared Components

#### P1 — High

- **Toast uses `transition-all` (BANNED) and `rounded-md`** (resolves to 24px — extremely rounded)
  - Where: `toast.tsx:26`

#### P2 — Medium

- Dialog has full glass-overlay backdrop (encourages misuse)
- SearchPill close button missing standard classes, icon `h-3.5` instead of `h-4`
- Skeleton table rows don't match 52px standard
  - Where: `skeleton.tsx:71`

### Issues Found — Authentication

#### P0 — Critical

- **Session secret has hardcoded dev fallback**
  - Where: `server/auth.ts:51`
  - Fix: Refuse to start in production if `SESSION_SECRET` not set

#### P1 — High

- **`useSession` and login use raw `fetch()`** instead of `apiFetch`
  - Where: `useSession.ts:29,68`, `login.tsx:35-40`

- **No rate limiting on `/api/auth/login`** — brute force vulnerable

#### P2 — Medium

- Login page uses non-design-system colors (`bg-slate-50`, `border-slate-200`)
- Login button uses `transition-all`
- No loading state during initial auth check — flash of login page
- `logout()` doesn't clear all localStorage keys — stale personal data remains

### Cross-Cutting Consistency Issues

1. **`transition-all` is the most widespread violation** — found in Shell, Nav, Login, Dashboard, every shadcn base component (toast, switch, progress, tabs, accordion, toggle, sidebar)
2. **`brand-blue` vs `brand-indigo` confusion** — in agency mode, `brand-blue` resolves to YELLOW. Components that should always be indigo (notification badge) turn yellow.
3. **Desktop vs Mobile active nav completely different** — three different active state patterns
4. **No security headers** — missing helmet, X-Frame-Options, CSP, HSTS

### Backend/API Assessment

- Auth implementation is solid: scrypt hashing, timing-safe comparison, PostgreSQL session storage, user cache with TTL
- Accept-invite has proper rate limiting + token expiration
- **No rate limiting on login** — only accept-invite is rate-limited
- No CORS middleware (acceptable for same-origin, but needed if API accessed cross-origin)
- No request timeout middleware
- Error responses may expose internal details to client
- `scopeToAccount` uses type-unsafe `(req as any).forcedAccountId`

---

## 11. Automation Recommendations

The automation recommender analyzed the codebase and identified 8 improvements for the Claude Code workflow:

| Priority | Automation | Category | Impact |
|----------|-----------|----------|--------|
| 1 | **context7 MCP** — live docs for React 19, Tailwind v4, Drizzle, shadcn/ui | MCP Server | High |
| 2 | **Prettier auto-format hook** — PostToolUse hook on Edit/Write | Hook | High |
| 3 | **`ui-reviewer` subagent** — catch UI standard violations automatically | Subagent | High |
| 4 | **PostgreSQL MCP** — direct DB inspection without throwaway scripts | MCP Server | Medium |
| 5 | **`frontend-design` plugin** — structured frontend guidance | Plugin | Medium |
| 6 | **Lock file edit blocker** — PreToolUse hook preventing package-lock.json edits | Hook | Low |
| 7 | **`db-migrate` skill** — safe Drizzle schema migration workflow | Skill | Medium |
| 8 | **`security-reviewer` subagent** — catch auth/authz gaps in route changes | Subagent | Medium |

**Already in place (no changes needed):**
- PreToolUse `.env` blocker hook
- PostToolUse TypeScript checker (`tsc --noEmit`)
- `playwright-cli` skill
- Comprehensive CLAUDE.md, UI_STANDARDS.md, FILE_MAP.md

---

## Global Fix Roadmap (Recommended Order)

### Phase 1 — Security (Do First)
1. Move personal banking details server-side
2. Enforce SESSION_SECRET in production
3. Add rate limiting to `/api/auth/login`
4. Fix `requireAgency` on tag endpoints
5. Add account scoping to bulk lead endpoints
6. Add server-side invoice total validation
7. Add security headers (helmet)

### Phase 2 — Critical Functionality
8. Add Dashboard to sidebar navigation
9. Fix `apiFetch` bug in AccountDetailView (`.json()` missing)
10. Wire up dead "+" buttons (Accounts, Conversations "New")
11. Wire up dead buttons (Campaign Refresh/Delete, Calendar Search)
12. Fix PIPELINE_HEX colors to match §2.5 — single source of truth
13. Create shared constants file for all pipeline colors/statuses

### Phase 3 — Performance (Pi-Critical)
14. Add pagination to leads/interactions API calls
15. Create dedicated `/api/conversations` endpoint
16. Create `/api/dashboard-stats` aggregation endpoint
17. Add `?hasBooking=true` + date-range to calendar queries
18. Create bulk tag endpoint (`GET /api/leads/tags?leadIds=`)
19. Replace full-table polls with delta/incremental fetching
20. Remove `framer-motion` stagger animations (use CSS)
21. Extract 630 lines of marketing CSS from global stylesheet

### Phase 4 — Design System Compliance
22. Global replace `brand-blue` → `brand-indigo` (200+ occurrences)
23. Global replace `transition-all` → specific properties (50+ occurrences)
24. Fix all card backgrounds to `bg-white` (§15.1)
25. Fix all button sizes to `h-10` (§4.1)
26. Fix all icon sizes to `h-4 w-4` (§4.1)
27. Fix all skeleton row heights to `h-[52px]` (§4.2)
28. Replace hardcoded hex colors with CSS variables
29. Replace default Tailwind palette colors with brand tokens

### Phase 5 — Dialog → Panel Migration
30. Convert LeadDetailPanel Sheet to right panel
31. Convert CampaignDetailPanel to right panel (or remove — DetailView has inline editing)
32. Convert Users invite/view/edit dialogs to right panels
33. Convert PromptFormDialog to right panel
34. Convert ChangePasswordDialog to inline card
35. Convert CsvImportWizard Dialog to right panel
36. Delete legacy AccountCreateDialog + AccountDetailsDialog

### Phase 6 — Component Standardization
37. Replace all hand-rolled tabs with `ViewTabBar`
38. Replace all raw `<button>` icon actions with `IconBtn`
39. Replace all custom dropdowns with shadcn `Popover`/`Select`
40. Add `ResizeObserver` responsive collapse to all table toolbars
41. Standardize toolbar patterns (`tbBase`/`tbDefault`/`tbActive`)
42. Move Account/Campaign filters into Settings dropdowns (remove visible pills)
43. Add record counts to all left panel headers

### Phase 7 — Code Quality
44. Extract shared utilities per feature (leadHelpers, campaignHelpers, accountColors, etc.)
45. Decompose mega-files (AppDashboard 1591 lines, UsersListView 81KB, Calendar 1634 lines)
46. Add TypeScript interfaces to replace `any` types
47. Delete dead code (Stat component, CampaignCardGrid, CampaignsTable, BulkActionsToolbar, FiltersBar imports, LeadFilters, orphan InvoicesPage stub)
48. Migrate data hooks to TanStack Query for caching/deduplication
49. Consolidate Settings.tsx and SettingsPanel.tsx

### Phase 8 — Polish & UX
50. Make "Calls Booked" the hero KPI on dashboard
51. Add financial summary widgets to Billing page
52. Add loading/error states to all pages consistently
53. Fix `formatCurrency` default to EUR
54. Add accessibility (focus-visible, aria-labels, keyboard navigation)
55. Unify mobile/desktop active nav state
56. Build proper campaign creation flow
57. Populate or remove "Activity" widget in Accounts detail

---

*Report generated by 10 Opus analysis agents running in parallel. Each agent read UI_STANDARDS.md as the consistency baseline and analyzed 5-15 files in their domain.*
