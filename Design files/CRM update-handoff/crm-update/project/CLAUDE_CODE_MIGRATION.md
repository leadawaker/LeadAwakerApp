# Lead Awaker CRM — Design Migration Brief
## Instructions for Claude Code

---

## What This Is

You are a **styling migration agent**. Your job is to apply a finished, reviewed design system to this codebase. The design was built and verified in a separate environment. You are NOT here to improve architecture, refactor logic, change routing, or redesign anything. You are here to make the app look exactly like the reference.

**Do not get creative. Do not improvise. Follow this document precisely.**

---

## Read-First Protocol (MANDATORY)

Before touching a single file:

1. Read `design-system.css` in full — it is the source of truth for every visual token.
2. Read `CLAUDE.md` in full — it lists frozen foundations, component classes, and critical gotchas.
3. Read the target file(s) you are about to change.
4. Write out a migration plan as comments or a brief note. Only then start editing.

If you skip the read-first step you will make errors that require back-and-forth to fix. Don't skip it.

---

## What You Must Never Do

- **Never rewrite business logic.** If a component fetches data, manages state, or handles routing — leave that code exactly as-is. Only change the visual output (className, style props, layout structure).
- **Never delete a component.** If an existing component is being relocated (e.g. a header bar moving into a left card), keep the function in the file and change where it's rendered.
- **Never change the `design-system.css` file.** It is frozen. Copy it verbatim into the project; do not edit it.
- **Never hardcode colors, radii, or spacing.** Every visual value must come from a CSS token. See the token list below.
- **Never add new dependencies.** The design uses Google Fonts (already in `design-system.css` @import), Lucide icons (already loaded), and React/Babel (already loaded in the HTML files).
- **Never work on more than one file at a time.** Finish a file, verify it has no console errors, then move to the next.

---

## Step 0 — Copy the Design System

Copy `design-system.css` into your project root (or wherever your stylesheets live). Then link it in every HTML entry-point file **before any other stylesheet**:

```html
<link rel="stylesheet" href="design-system.css">
```

This one file provides every token, every utility class, every component class. Nothing else needs to be installed.

---

## The Token System

All visual values must use these CSS custom properties. Never hardcode the equivalent px/hex value.

### Colors
```
--wine: #5E2230              Primary accent, active states, interactive highlights
--wine-tint: rgba(94,34,48,0.08)  Soft wine background for inactive/hover
--wine-grad: linear-gradient(145deg, #6E2638, #4B1A26)  Wine button fill
--paper: #FFFFFF             Bright card surfaces, text on wine backgrounds
--bg: #ECE7DD                Page ground color
--bg-2: #E4DCCC              Secondary background (sidebar, bottom bar, rails)
--surface: #FBF8F2           Raised chips, controls, near-white surfaces
--card: #FFFFFF              White cards — the brightest lift
--ink: #1F1A14               Primary text
--ink-soft: #322B22          Slightly softened primary text
--mute: #6C6354              Secondary text, disabled, placeholder
--mute-2: #948A77            Very light secondary text
--line: rgba(110,95,65,0.14) Dividing lines, subtle borders
--line-strong: rgba(110,95,65,0.24) Stronger dividers
--good: #2F9461              Success / positive status
--good-tint: rgba(47,148,97,0.12)
--warn: #DA9426              Warning / amber status
--warn-tint: rgba(218,148,38,0.13)
```

### Radii — snap every corner to one of these six tiers
```
--r-flush:   6px    Wells, tracks, inset surfaces, tiny tiles
--r-button:  8px    Buttons, segmented controls, small chips
--r-surface: 11px   List rows, message balloons, raised chips
--r-card:    16px   Cards and panels with a header
--r-panel:   22px   Hero bands, modals, large floating surfaces
--r-pill:    999px  Pills, toggles, circular buttons, avatars
```

### Spacing — use these for all gap/padding
```
--space-xxs: 4px
--space-xs:  8px
--space-sm:  12px
--space-md:  16px
--space-lg:  20px
--space-xl:  24px
--space-xxl: 32px
```

### Shadows
```
--sh-raised-crisp    Tight directional light shadow (elevated cards, buttons)
--sh-raised-medium   Deeper elevation (main cards)
--sh-raised-large    Highest elevation (modals, pop-overs)
--sh-inset-crisp     Recessed/pressed state (inputs, wells, inset buttons)
--sh-inset-medium    Deeper inset (large wells)
```

### Typography
```
--serif: "Instrument Serif", "Newsreader", Georgia, serif   Page/section titles
--sans:  "Manrope", ui-sans-serif, system-ui, sans-serif    Body, UI copy
--mono:  "Geist Mono", ui-monospace, monospace              Labels, tags, eyebrows, button text
```

---

## Component Classes (copy exactly — defined in design-system.css)

### Buttons — `.la-btn`

```html
<!-- Base modifier (add exactly one surface modifier) -->
<button class="la-btn la-btn--wine">Primary action</button>
<button class="la-btn la-btn--soft">Secondary action</button>
<button class="la-btn la-btn--inset">Utility / icon</button>

<!-- Icon-only (square) -->
<button class="la-btn la-btn--soft la-btn--icon">⚙</button>
<button class="la-btn la-btn--wine la-btn--icon">+</button>

<!-- Pill shape -->
<button class="la-btn la-btn--wine la-btn--pill">Send</button>
```

**Wine is the ONE primary action per view. Everything else is --soft or --inset.**

### Segmented Controls / Tabs — `.la-seg`

```html
<!-- Inline (wraps content) -->
<div class="la-seg">
  <button class="la-seg-btn on">Active tab</button>
  <button class="la-seg-btn">Inactive tab</button>
</div>

<!-- Full-width (stretches to fill container) -->
<div class="la-seg la-seg--fill">
  <button class="la-seg-btn on">List</button>
  <button class="la-seg-btn">Pipeline</button>
</div>

<!-- Pill track (for compact toggles) -->
<div class="la-seg la-seg--pill">
  <button class="la-seg-btn on">Week</button>
  <button class="la-seg-btn">Month</button>
</div>
```

Active state = add class `on` to the active `la-seg-btn`. In React: `className={\`la-seg-btn\${view==='list'?' on':''\`}`.

### Surface Classes (frozen — do not change their px values)

```html
<div class="neu-raised">      Medium raised card</div>
<div class="neu-raised-crisp">Tight raised surface</div>
<div class="neu-raised-large">Deep raised panel</div>
<div class="neu-inset">       Recessed well / tray</div>
<div class="neu-inset-crisp"> Tight inset input area</div>
<div class="neu-polished">    Polished hero surface</div>
```

### Inputs

```html
<input class="neu-input" placeholder="Search…" />
```

### Status Pills

```html
<span class="la-status active-s"><span class="dot"></span>Active</span>
<span class="la-status paused"><span class="dot"></span>Paused</span>
<span class="la-status inactive"><span class="dot"></span>Inactive</span>
```

---

## The Universal Left-Card Pattern

Every page in this app follows the same left-card layout. The left card (356px wide) **owns the page header**. There is no separate top bar.

```
Left card (width: 356px, flexShrink: 0, borderRight: 1px solid var(--line)):
┌───────────────────────────────────────────────────────────┐
│  60px header row:                                         │
│    Serif page title (22px)  +  mono ID/count badge        │
│    borderBottom: 1px solid var(--line)                    │
├───────────────────────────────────────────────────────────┤
│  12px gap                                                 │
│  la-seg la-seg--fill (view switcher)                      │
│    la-seg-btn padding: 10px 14px, font-size 11px          │
│    letter-spacing: 0.13em                                 │
├───────────────────────────────────────────────────────────┤
│  Toolbar row (padding: 10px 4px, gap: 6px):               │
│    [search — flex: 1]  [Filter]  [Sort]  [Group]  [+]     │
│    Below 1200px: Filter+Sort+Group → single ⚙ button      │
├───────────────────────────────────────────────────────────┤
│  <hr class="rule" style="margin: 0 4px 10px">             │
│  Scrolling list content…                                  │
└───────────────────────────────────────────────────────────┘
```

**The right-side content area has NO top bar of any kind.** Content starts flush.

### Responsive toolbar collapse (copy this pattern exactly)

```jsx
const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 1200);
React.useEffect(() => {
  const handler = () => setCollapsed(window.innerWidth < 1200);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// In the toolbar JSX:
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

## Critical Gotchas — Read Before Writing a Single Line

### 1. JSX inline styles: CSS vars MUST be quoted strings

```jsx
// ✅ CORRECT
<div style={{ borderRadius: 'var(--r-card)', padding: 'var(--space-md)' }}>

// ❌ WRONG — Babel syntax error, page will break with no clear error message
<div style={{ borderRadius: var(--r-card), padding: var(--space-md) }}>
```

This is the single most common mistake. Every CSS variable in a JSX style prop must be a quoted string.

### 2. Multiple Babel script files — sharing components via window

Each `<script type="text/babel">` file is its own isolated scope. Components are shared by attaching them to `window` at the end of each file:

```js
// At the bottom of components.jsx:
Object.assign(window, { Icon, Sidebar, Header, ... });
```

Never use `import` between Babel script files — it doesn't work. Always check what's already on `window` before re-defining a component.

### 3. Do NOT convert vertical navigation lists to `.la-seg`

`.la-seg` is for horizontal tab bars and view switchers only. Vertical navigation menus (settings sidebar, filter lists) are intentional list-based UX. Tokenize their radii, but keep their structure.

```jsx
// ✅ Vertical nav: keep flex/grid structure, tokenize radii
<button style={{ padding: '18px 20px', borderRadius: 'var(--r-surface)' }}>Section</button>

// ❌ Wrong — forcing nav into a tab bar
<div class="la-seg"><button class="la-seg-btn">Section</button></div>
```

### 4. Frozen utility classes — do NOT tokenize `.neu-*` or `.glass-*`

These classes in `design-system.css` have tuned px values. Changing them breaks every card/panel project-wide. They are intentionally locked. Never edit them.

### 5. Sub-6px micro-radii stay literal

Tiny badges, micro-elements under 6px stay hardcoded (`borderRadius: 3`). The `--r-flush: 6px` tier is the floor.

### 6. Background lighting — `.la-app` class required

The warm neumorphic lighting effect (the radial gradients + directional shadows) only activates when the page root has `class="la-app"`. Make sure every page's top-level container has this class.

### 7. Style object naming in JSX — never use `const styles = {}`

If multiple JSX files are loaded, a global `const styles = {}` in each one causes a collision. Always use a unique name: `const leadsStyles = {}`, `const billingStyles = {}`, etc.

---

## Per-Page Migration Checklist

Work through these **one page at a time**. Do not start a new page until the current one has zero console errors.

---

### Page 1 — Campaigns / CRM Stats
**File:** `CRM Stats Redesign.html` + `campaign-workspace.jsx`
**Status:** ✅ Reference implementation — already done. Read this first to understand the target.

---

### Page 2 — Leads Page
**Files:** `Leads Page.html`, `leads-app.jsx`, `leads-components.jsx`, `leads-views.jsx`

**Read first:**
- `leads-app.jsx` — find the `LeadsApp` function; locate any top header bar and the left rail component
- `leads-components.jsx` — find the left list component

**What to change:**

1. **Remove any top header bar** from `LeadsApp`. The title, view-switcher, search, and action buttons all move into the left list card.

2. **Left card** — apply the universal left-card pattern:
   - Width: `356px`, `flexShrink: 0`, `borderRight: '1px solid var(--line)'`
   - NO `borderRadius`, NO `boxShadow` on the outer card (it's flush with the page edge)
   - 60px header row: serif "Leads" title (22px) + mono count badge on the right
   - `borderBottom: '1px solid var(--line)'` on the header row
   - `la-seg la-seg--fill` view switcher below (List/Pipeline or whatever views exist), taller padding `10px 14px`, `11px`, `letterSpacing: '0.13em'`
   - Toolbar row: search input + Filter/Sort/Group icon buttons + wine `+` icon button
   - Collapsed toolbar below 1200px (see pattern above)

3. **Right content area** — no top bar. Content starts immediately.

**Done criteria:**
- [ ] No top bar visible
- [ ] Left card 356px, flush edge, serif title
- [ ] Seg tabs taller than before
- [ ] Toolbar collapses below 1200px
- [ ] Zero console errors

---

### Page 3 — Tasks Page
**Files:** `Tasks Page.html`, `tasks-app.jsx`, `tasks-views.jsx`

**Read first:**
- `tasks-app.jsx` — find `TasksApp`; locate `TasksHeader`, `FilterChips`, and `ScheduleView`/`Board`

**What to change:**

1. **Remove `<TasksHeader>` and `<FilterChips>`** from `TasksApp`'s return. Pass their state (`view/setView`, `filter/setFilter`) as props down to `ScheduleView` and `Board`.

2. **Upgrade the left list card inside `ScheduleView`:**
   - Universal left-card pattern (356px, flush, no outer radius/shadow)
   - Header: serif "Tasks" + count
   - Seg: "Schedule" | "Board" (taller padding)
   - Toolbar: search + Filter + Sort + Group + wine `+`
   - Below toolbar: `FilterChips` (All/Next 7 Days/Overdue/Waiting/Completed) — keep these, just remove the outer bar padding
   - Assignee toggle: place just below chips or in the toolbar row

3. **Board view:** add a matching left panel (same 356px, same header) with "Board" tab active.

4. Keep `TasksHeader` and `FilterChips` functions in the file — just don't render them at the app level anymore.

**Done criteria:**
- [ ] No top bar on Tasks page
- [ ] Left panel 356px in both Schedule and Board views
- [ ] Schedule/Board seg switch works
- [ ] Filter chips visible below toolbar
- [ ] Zero console errors

---

### Page 4 — Calendar Page
**Files:** `Calendar Page.html`, `calendar-app.jsx`, `calendar.jsx`

**Read first:**
- `calendar-app.jsx` — find `CalendarApp`; locate `CalendarHeader` and the 3-column layout
- `calendar.jsx` — find `CenterHeader`

**What to change:**

1. **Remove `<CalendarHeader>`** from `CalendarApp`. The title and Week/Month switcher move into the left agenda card.

2. **Upgrade the left agenda card** (currently `narrow ? 68 : 318px`):
   - At full width: universal left-card pattern, width 356px
   - Header: serif "Calendar"
   - Seg: "Week" | "Month" — replaces the old `CalendarHeader` seg
   - Toolbar: search + Filter + wine `+`
   - Below toolbar: existing `FilterTabs` (All/Booked/No-show/Rescheduled) — keep them
   - At narrow width (< 1480px): keep existing icon-rail collapse behavior

3. **KPI chips** (previously in `CalendarHeader`): move them into `CenterHeader` on the far right side (using `position: absolute; right: 14px`).

4. `view` state stays in `CalendarApp` — pass `setView` into the left card component.

**Done criteria:**
- [ ] No top header bar
- [ ] Left agenda card 356px with Week/Month seg
- [ ] KPI chips visible in center card header
- [ ] Narrow collapse still works
- [ ] Zero console errors

---

### Page 5 — Billing Page
**Files:** `Billing Page.html`, `billing-app.jsx`, `billing-rail.jsx`, `billing-components.jsx`

**Read first:**
- `billing-app.jsx` — find the topbar div (height 60); find `BillingRail` and its props
- `billing-rail.jsx` — understand current rail header structure

**What to change:**

1. **Delete the topbar `<div>` from `BillingApp`** (the one with `height: 60`). Pass the controls it contained as props to `BillingRail`: `view/setView`, `role/setRole`.

2. **Upgrade `BillingRail`** — add new header at the top:
   - 60px header row: serif "Billing" + view toggle (list/table, `la-seg--sm`) + role toggle (My/Client, `la-seg--sm`)
   - `borderBottom: '1px solid var(--line)'`
   - `la-seg la-seg--fill`: Invoices | Expenses | Contracts (taller)
     - If `clientView`: hide Expenses tab
   - Toolbar: search + Filter icon + wine `+` button
     - If `clientView`: hide `+`
   - Private badge: if `tab === 'expenses' && !clientView`, show wine pill just below toolbar

3. **Rail width:** change from 340px to 356px.

4. **Table view:** left card remains visible even in table mode.

5. **Form takeover:** leave existing full-page form takeover behavior untouched.

**Done criteria:**
- [ ] No top bar
- [ ] Left rail 356px with Billing title + two toggle rows
- [ ] Tab switching (Invoices/Expenses/Contracts) still works
- [ ] Private badge appears on Expenses tab
- [ ] Client view hides Expenses tab and `+` button
- [ ] Table view still shows the left card
- [ ] Zero console errors

---

### Page 6 — Mobile App
**Files:** `Lead Awaker Mobile.html`, `mobile-app.jsx`, `mobile-shell.jsx`, `mobile-leads.jsx`, `mobile-tasks.jsx`, `mobile-billing.jsx`, `mobile-calendar.jsx`, `mobile-detail.jsx`

**Read first:**
- `mobile-app.jsx` — the tab orchestrator
- `mobile-shell.jsx` — the bottom tab bar

**Key mobile patterns:**

Bottom tab bar:
```jsx
<div style={{
  flexShrink: 0,
  display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
  background: 'var(--bg-2)', borderTop: '1px solid var(--line)',
  minHeight: 'var(--bottombar-h)',
  padding: '8px 6px calc(10px + var(--safe-bottom))',
}}>
  <button style={{
    border: 'none', background: 'transparent', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    padding: '4px 0',
  }}>
    <span style={{
      width: 56, height: 30, borderRadius: 'var(--r-pill)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: active ? 'var(--wine)' : 'var(--mute)',
      background: active ? 'var(--wine-tint)' : 'transparent',
      boxShadow: active ? 'inset 0 0 0 1px rgba(94,34,48,0.14)' : 'none',
      transition: 'all 160ms',
    }}>
      <Icon size={20} />
    </span>
    <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{label}</span>
  </button>
</div>
```

Mobile segmented controls use `.la-seg la-seg--fill`.
Mobile active states use `var(--wine)` color + `var(--wine-tint)` background.

**Done criteria:**
- [ ] Bottom tab bar uses wine tint for active tab
- [ ] Segmented controls use `.la-seg la-seg--fill`
- [ ] All spacing uses `var(--space-*)` tokens
- [ ] Zero console errors

---

### Page 7 — Settings
**Files:** `settings-a.jsx`, `settings-b.jsx`, `settings-components.jsx`

**Key rule:** Settings uses a vertical navigation list on the left — do NOT convert it to `.la-seg`. It is intentional list-based UX.

**What to check:**
- All radii use `var(--r-*)` tokens
- All colors use `var(--wine)`, `var(--mute)`, `var(--surface)` etc.
- Active nav item: `background: var(--surface)`, `boxShadow: var(--sh-inset-crisp)`, `color: var(--wine)`
- Form inputs use `.neu-input`
- Save/action buttons use `.la-btn la-btn--wine`

---

### Page 8 — Prompt Library
**Files:** `Prompt Library.html`, `prompt-app.jsx`, `prompt-panels.jsx`, `prompt-engine.jsx`

Apply same universal left-card pattern. Left card owns header (serif "Prompt Library"), seg switcher (if any), search toolbar.

---

## Final Verification Checklist

After all pages are done, run through these:

- [ ] Every page links to `design-system.css` before any other stylesheet
- [ ] Every page's root container has `class="la-app"`
- [ ] No page has a visible top header bar (title + controls live in the left card)
- [ ] All segmented controls use `.la-seg` / `.la-seg-btn.on`
- [ ] All primary action buttons use `.la-btn la-btn--wine`
- [ ] All secondary/icon buttons use `.la-btn la-btn--soft` or `.la-btn la-btn--inset`
- [ ] All form inputs use `.neu-input`
- [ ] All CSS variables in JSX inline styles are quoted strings
- [ ] No hardcoded hex color values outside of `design-system.css`
- [ ] No hardcoded px border-radius values outside of `design-system.css`
- [ ] Zero console errors on every page
- [ ] Mobile bottom bar uses `calc(10px + var(--safe-bottom))` for bottom padding

---

## Reference Files (Read These First)

| File | Purpose |
|---|---|
| `design-system.css` | Single source of truth for all tokens + component classes |
| `CLAUDE.md` | Frozen foundations, gotchas, component API |
| `CRM Stats Redesign.html` | Reference page — already fully migrated |
| `components.jsx` | Shared primitives (Icon, Sidebar, icons — all on window) |
| `Leads Page.html` + `leads-app.jsx` | Second fully-migrated page — also a good reference |

Start with `CRM Stats Redesign.html`. Open it, read `campaign-workspace.jsx`. That is the exact pattern every other page should match. When in doubt, compare against it.
