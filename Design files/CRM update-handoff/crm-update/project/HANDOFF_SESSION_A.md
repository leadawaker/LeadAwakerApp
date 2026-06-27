# Session Handoff A — Leads Page + Calendar Page
## Toolbar / Header Unification

**Project:** Lead Awaker CRM (this project)
**Goal:** Apply the Campaigns left-card header pattern to `Leads Page.html` and `Calendar Page.html`.
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
**AI TLDR** (if present): remove any inset box-shadow; sit directly on `var(--bg)`.

---

## Page A1 — Leads Page

**Entry file:** `Leads Page.html`
**Orchestrator:** `leads-app.jsx` (read it first — it exports `LeadsApp`)
**Supporting:** `leads-components.jsx`, `leads-views.jsx`, `leads-data.js`, `components.jsx`

### What to read first
1. `leads-app.jsx` — find the `LeadsApp` function and how the left rail (`LeadsRail` or similar) and top header are composed
2. `leads-components.jsx` — find the left list component (likely `LeadRail` or `LeadList`)
3. Look for any `Header`, `TopBar`, or top-level bar component rendered above the content

### What to change

1. **Remove the top header bar** from `LeadsApp` (or wherever it renders). The title, view-switcher, search, and action buttons must move into the left list card.

2. **Upgrade the left rail card header** to the Campaigns pattern:
   - 60px header row with serif "Leads" title + mono ID/count badge, `borderBottom: '1px solid var(--line)'`
   - Below it: `la-seg--fill` for the view switcher (e.g. List/Pipeline or whatever views exist), taller padding `10px 14px`, font `11px`, `letterSpacing: '0.13em'`
   - Below it: toolbar row with narrow search + Filter/Sort/Group icon buttons + wine `+` icon button
   - Below 1200px viewport width: Filter, Sort, Group collapse into a single `⚙` `la-btn--soft la-btn--icon` button
   - Use a `ResizeObserver` on the left card (or a `window resize` listener) to toggle collapsed state

3. **Left card width:** 356px (matching Campaigns). Check if `leads-app.jsx` passes a `width` prop; update it.

4. **The main content area** (lead detail, pipeline board, etc.) should have no top bar above it — content starts immediately. Any padding/gap at the top of the main pane should be from the content itself, not a header row.

5. **Consistent icons:** use `IconSearch`, `IconFilter`, `IconSort`, `IconLayers`, `IconSettings`, `IconPlus` from `components.jsx`. All are already exported via `Object.assign(window, {...})`.

### Collapsed toolbar (< 1200px)
```jsx
const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 1200);
React.useEffect(() => {
  const handler = () => setCollapsed(window.innerWidth < 1200);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// In toolbar:
{collapsed
  ? <button className="la-btn la-btn--soft la-btn--icon"><IconSettings size={13} /></button>
  : <>
      <button className="la-btn la-btn--soft la-btn--icon"><IconFilter size={13} /></button>
      <button className="la-btn la-btn--soft la-btn--icon"><IconSort size={13} /></button>
      <button className="la-btn la-btn--soft la-btn--icon"><IconLayers size={13} /></button>
    </>
}
<button className="la-btn la-btn--wine la-btn--icon"><IconPlus size={14} /></button>
```

---

## Page A2 — Calendar Page

**Entry file:** `Calendar Page.html`
**Orchestrator:** `calendar-app.jsx` — exports `CalendarApp`
**Supporting:** `calendar.jsx`, `calendar-data.js`, `components.jsx`, `leads-components.jsx`, `leads-data.js`

### Current structure (from reading `calendar-app.jsx`)
```
<Sidebar />
<div (flex col)>
  <CalendarHeader />   ← title "Calendar" + Week/Month seg + KPI chips row
  <div (3 cards row)>
    left card (318px bg-2):  FilterTabs header + AgendaList/AgendaRail
    center card (flex-1):    CenterHeader (nav) + WeekGrid/MonthGrid + CalLegend
    right card (372px):      CalendarDetail
  </div>
</div>
```

### What to change

1. **Remove `CalendarHeader`** from `CalendarApp`. The title and Week/Month switcher move into the left agenda card.

2. **Upgrade the left agenda card** (currently width `narrow ? 68 : 318px`):
   - At full width (not narrow): use the full Campaigns left-card pattern
     - 60px header row: serif "Calendar" + `borderBottom`
     - `la-seg--fill` with "Week" / "Month" (taller padding `10px 14px`, 11px, ls `0.13em`) — this replaces the Week/Month seg that was in `CalendarHeader`
     - Toolbar: search + Filter + `+` icon buttons (no Sort/Group needed for calendar, but Filter yes)
     - Then the existing `FilterTabs` row (All / Booked / No-show / Rescheduled) — keep these as-is below the toolbar, they filter the list content
   - At narrow width (< 1480): the card collapses to the icon rail as before (this is fine — the narrow breakpoint already handles it)

3. **KPI chips** (`CalKpi` components): these were in the top header. Move them into the center card's header (`CenterHeader`) on the right side — the center header has `justify-content: center` with a "Today" button on the left and prev/next arrows; add the KPIs to the right side of that header. Or, if it feels crowded, drop them into a subtle row just below the center card header (inside the card, above the grid). Do NOT put them back in a top bar.

4. **No top bar** — after removing `CalendarHeader`, the `<div (3 cards row)>` becomes the direct child of the flex column (after the sidebar). Give it `padding-top: 14px` (it had `padding: 4px 14px 14px` before — just use `padding: 14px`).

5. **Left card width at full width:** change from 318px to 356px to match the pattern. (Keep narrow at 68px.)

6. **`view` state** (`week`/`month`) was owned by `CalendarApp` and passed down to `CalendarHeader`. After removing `CalendarHeader`, `CalendarApp` still owns `view`/`setView` — pass `setView` into the left card component instead.

### KPI placement in center card header
```jsx
// CenterHeader — add stats prop
function CenterHeader({ rangeLabel, onPrev, onNext, onToday, stats }) {
  return (
    <div style={{ height: HEADER_H, ..., position: 'relative' }}>
      <button onClick={onToday} className="la-btn la-btn--soft" style={{ position: 'absolute', left: 14 }}>Today</button>
      <button onClick={onPrev} ...><CIconChevL /></button>
      <span ...>{rangeLabel}</span>
      <button onClick={onNext} ...><CIconChevR /></button>
      {/* KPIs on the right */}
      <div style={{ position: 'absolute', right: 14, display: 'flex', alignItems: 'stretch', height: 44 }}>
        {stats.map((s, i) => <CalKpi key={i} {...s} />)}
      </div>
    </div>
  );
}
```

---

## Shared Rules

- **Design tokens:** always use `var(--wine)`, `var(--surface)`, `var(--r-*)`, `var(--space-*)` etc. from `design-system.css`. No hardcoded hex or raw px for radii/spacing.
- **JSX inline styles with CSS vars MUST be quoted strings:** `borderRadius: 'var(--r-card)'` ✅ — `borderRadius: var(--r-card)` ❌ (Babel syntax error).
- **Multiple babel script files** share globals via `Object.assign(window, {...})` at the end of each file. Don't import between them — read existing exports to find what's already on `window`.
- **After all changes**, open `Leads Page.html` and `Calendar Page.html` in the preview, confirm no console errors, and do a visual check that the left-to-right eye flow reads naturally: left card (title + controls) → center content.
- **Verify `la-btn--wine la-btn--icon`** is defined in `design-system.css`. If it isn't, add it as: same as `.la-btn--wine` but `padding: 0; width: 32px; height: 32px; justify-content: center;` (check the existing `.la-btn--icon` modifier first and extend it).

---

## Done Criteria

- [ ] Leads Page: no top bar; left rail 356px with title + seg (taller) + toolbar + list
- [ ] Calendar Page: no top header bar; left agenda card 356px with title + Week/Month seg + toolbar + filter tabs + list
- [ ] KPIs visible somewhere in Calendar (center card header recommended)
- [ ] Toolbar collapses Filter/Sort/Group → ⚙ below 1200px on Leads
- [ ] No console errors on either page
- [ ] Eye travels left → right naturally on both pages
