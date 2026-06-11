# Session Handoff B — Tasks Page + Billing Page
## Toolbar / Header Unification

**Project:** Lead Awaker CRM (this project)
**Goal:** Apply the Campaigns left-card header pattern to `Tasks Page.html` and `Billing Page.html`.
**Reference file:** `CRM Stats Redesign.html` (Campaigns page — source of truth)

---

## The Pattern (read `components.jsx` → `CampaignList` to see it in full)

Every page's leftmost list/rail card now owns the complete page header:

```
Left card (356px, flexShrink: 0, borderRight: 1px solid var(--line)):
┌─────────────────────────────────────────────────────────────┐
│  60px header row  │  "[Page Title]"  serif 22px  +  mono ID │  ← aligned with sidebar 60px logo row
├─────────────────────────────────────────────────────────────┤
│  padding-top 12px                                           │
│  la-seg--fill  (taller: padding 10/14px, 11px, ls 0.13em)  │  ← view-switcher tabs
├─────────────────────────────────────────────────────────────┤
│  toolbar row  (padding 10px 4px):                           │
│    [search flex: 1 1 80px]  [Filter]  [Sort]  [Group]  [+]  │
│    <1200px: Filter+Sort+Group collapse into single ⚙ btn    │
├─────────────────────────────────────────────────────────────┤
│  rule  (margin 0 4px 10px)                                  │
│  scrolling list …                                           │
└─────────────────────────────────────────────────────────────┘
```

**Key CSS classes:**
- `la-seg la-seg--fill` — full-width seg track
- `la-seg-btn` / `la-seg-btn on` — tabs
- `la-btn la-btn--soft la-btn--icon` — icon-only toolbar buttons (Filter/Sort/Group/⚙)
- `la-btn la-btn--wine la-btn--icon` — wine + icon (the `+` new button)
- `neu-input` — search field

**No topbar** in the main content area — the right-side content starts flush at the top.

---

## Page B1 — Tasks Page

**Entry file:** `Tasks Page.html`
**Orchestrator:** `tasks-app.jsx` — exports `TasksApp`
**Supporting:** `tasks-views.jsx`, `tasks-data.js`, `components.jsx`

### Current structure (from reading `tasks-app.jsx`)
```
<Sidebar active="Tasks" />
<div (flex col)>
  <TasksHeader />      ← title "Tasks" + Schedule/Board seg + search + Filter/Group + "Add Task" btn
  <FilterChips />      ← All / Next 7 Days / Overdue / Waiting / Completed chips + assignee toggle
  <ScheduleView />     ← left list (384px) + right week calendar
    or
  <Board />            ← kanban board
</div>
```

### What to change

**Architecture shift:** The `TasksHeader` and `FilterChips` top bars are eliminated. Their controls move into the **left list card inside `ScheduleView`** (and a matching left panel in `Board`).

#### 1. Remove `TasksHeader` and `FilterChips` from `TasksApp`
Delete the two lines rendering `<TasksHeader ...>` and `<FilterChips ...>` from the return of `TasksApp`. The `<div (flex col)>` now renders only `<ScheduleView>` or `<Board>` directly.

Pass `view/setView`, `filter/setFilter`, `who/setWho`, `counts` down as props to `ScheduleView` and `Board`.

#### 2. Upgrade the left list card inside `ScheduleView`

The left list card is currently (in `ScheduleView`):
```jsx
<div style={{ width: 384, background: 'var(--bg-2)', borderRadius: 'var(--r-card)', ... }}>
  <div style={{ height: 48, ... }}>  {/* "Tasks" label + count */}
  ...list...
```

Replace this with the full Campaigns left-card pattern. The card becomes **flush** (no outer borderRadius/card shadow — it sits as the left edge of the page just like `CampaignList`). Remove `borderRadius` and `boxShadow` from the card; instead use `borderRight: '1px solid var(--line)'`. Width: **356px**.

New structure inside the left card:
```
60px title header: serif "Tasks" + mono count badge, borderBottom
12px gap
la-seg--fill: Schedule | Board  (taller: padding 10px 14px, 11px, ls 0.13em)
toolbar row:
  [search]  [Filter]  [Sort]  [Group collapsed < 1200]  [+ wine icon]
rule
FilterChips (the All/Next7/Overdue/Waiting/Completed chips — keep as-is but without the outer bar/padding)
assignee toggle (keep as-is, place at bottom of toolbar row or just below chips)
rule
scrolling task list
```

> The key insight: the Schedule/Board switcher that was in `TasksHeader` now lives in the left card's seg. Switching to Board from there still renders `<Board>` in the right area.

#### 3. Board view left panel
`Board` currently renders a kanban. Add a matching left-edge panel to Board (same 356px) with:
- 60px title + serif "Tasks"
- la-seg--fill: Schedule | Board (Board tab active)
- toolbar (search, filter, +)
- FilterChips
- Below it: the Board kanban fills the rest of the width

#### 4. TasksHeader / FilterChips components
Keep the component functions in `tasks-app.jsx` but they will no longer be rendered at the app level. They can be refactored inline into the left card, or kept as unexported helpers. Either is fine.

#### 5. Collapsed toolbar
```jsx
const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 1200);
React.useEffect(() => {
  const handler = () => setCollapsed(window.innerWidth < 1200);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

#### 6. Icons available in `tasks-app.jsx`
`tasks-app.jsx` already defines local icons: `TIconSearch`, `TIconFilter`, `TIconGroup`, `TIconPlus`. Use those for the toolbar. For Sort, add a local `TIconSort` if not present (a simple `↕` SVG or reuse `TIconGroup`).

---

## Page B2 — Billing Page

**Entry file:** `Billing Page.html`
**Orchestrator:** `billing-app.jsx` — exports `BillingApp`
**Supporting:** `billing-rail.jsx`, `billing-components.jsx`, `billing-views.jsx`, `billing-forms.jsx`, `billing-data.js`, `components.jsx`

### Current structure (from reading `billing-app.jsx`)
```
<BillingSidebar />
<div (flex col)>
  <div (topbar, height 60)>
    "Billing" title + RailTabs (Invoices/Expenses/Contracts) + Private badge
    + Client view banner + flex-1 + New btn + view seg + role seg
  </div>
  <div (content row)>
    <BillingRail (340px)>    ← filter chips + item list + footer total
    <detail area (flex-1)>   ← invoice/expense/contract detail
  </div>
</div>
```

### What to change

**Architecture shift:** The top toolbar moves into `BillingRail`. The rail becomes the full left-card owner of the header. Rail width → **356px**.

#### 1. Move the topbar controls into `BillingRail`

`BillingRail` is defined in `billing-rail.jsx`. Read that file first to understand its current header. Then:

Add a new header section at the top of `BillingRail`:

```
60px title header row:
  serif "Billing" 22px  +  view toggle (list/table icons, la-seg--sm)  +  role toggle (My view/Client view, la-seg--sm)
  borderBottom

12px gap

la-seg--fill:  Invoices  |  Expenses  |  Contracts  (taller: padding 10px 14px, 11px, ls 0.13em)
  - Invoices tab has BIInvoice icon, Expenses has BIExpense, Contracts has BIContract
  - If clientView, Expenses tab is hidden (as before)

toolbar row:
  [search]  [Filter icon]  [+] wine icon btn  (triggers formOpen)
  - No Sort/Group needed for billing
  - If clientView: hide the + button

Private badge:
  if tab === 'expenses' && !clientView: show the wine "Private" pill (as currently in topbar)
  Place it just below the toolbar, left-aligned

Client view banner (small):
  if clientView: show a compact one-liner "Client portal preview · {client.name}"
  (the full ClientBanner component can stay in the detail area)
```

Pass the following new props to `BillingRail`:
- `view`, `setView` — list/table toggle
- `role`, `setRole` — admin/client toggle  
- `tab`, `setTab`, `tabOpts` — already passed
- `onNew` — already passed
- `clientView` — already passed

#### 2. Remove the topbar div from `BillingApp`
Delete the `<div style={{ height: 60, ... }}>` topbar entirely. The content row becomes the direct child:
```jsx
<div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
  <BillingRail ... />
  <detail area />
</div>
```

#### 3. BillingRail width
Change from `flex: '0 0 340px'` to `width: 356px, flexShrink: 0`. Remove `borderRight` from the outer wrapper if present (the rail already has it via its own styling — check `billing-rail.jsx`).

#### 4. Table view
In table view, the `BillingRail` still renders (with the header) but the main area is the full-width table. The left card should still be visible in table view — it gives the user title + tabs + toolbar even in table mode. The table fills the rest of the width to the right.

#### 5. Form takeover
When `formOpen` is true, `BillingApp` currently hides `BillingSidebar` and renders only the form. This behavior is fine to keep — the form is a full-page takeover. No change needed there.

#### 6. Icons in billing-app / billing-rail
`billing-app.jsx` / `billing-components.jsx` define local billing icons: `BIPlus`, `BIList`, `BITable`, `BIInvoice`, `BIExpense`, `BIContract`. Reuse these in the new rail header. For search, use `IconSearch` from `components.jsx` (already on `window`). For Filter, use `IconFilter` from `components.jsx`.

---

## Shared Rules

- **Design tokens:** always `var(--wine)`, `var(--surface)`, `var(--r-*)`, `var(--space-*)`. No hardcoded hex or raw px for radii/spacing.
- **JSX inline styles with CSS vars MUST be quoted strings:** `borderRadius: 'var(--r-card)'` ✅ — `borderRadius: var(--r-card)` ❌ (Babel syntax error — page breaks).
- **Multiple babel script files** share globals via `Object.assign(window, {...})`. Don't `import` between files — use `window.ComponentName` or the existing exports.
- **`la-btn--wine la-btn--icon`** — verify this modifier combo exists in `design-system.css`. If not, it's: same as `.la-btn--wine` but `padding: 0; width: 32px; height: 32px;`. The `.la-btn--icon` modifier should already do this; check first.
- **After changes:** open both HTML files in preview, confirm no console errors. Visual check: left card (title + controls) → right content. The eye should never need to jump back left after landing on the right.

---

## Done Criteria

- [ ] Tasks Page: no top bar; left panel 356px with serif "Tasks" + Schedule/Board seg (taller) + toolbar + filter chips + list
- [ ] Tasks Board view: left panel also 356px with same header (Board tab active)
- [ ] Billing Page: no top bar; left rail 356px with serif "Billing" + view/role toggles + Invoices/Expenses/Contracts seg (taller) + search/filter/new toolbar
- [ ] Billing table view: left card still visible (not hidden)
- [ ] Toolbar collapses Filter/Sort/Group → ⚙ below 1200px on Tasks
- [ ] No console errors on either page
- [ ] Eye travels left → right on both pages
