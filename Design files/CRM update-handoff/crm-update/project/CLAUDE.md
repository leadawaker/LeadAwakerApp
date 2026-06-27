# Lead Awaker Design System — Project Handoff

This file persists across all Claude sessions in this project. Read it first when building new pages or components.

## Design System Overview

**Goal:** Centralize all design tokens in `design-system.css` so changing one value ripples project-wide. All product pages (.html files) + JSX components route through a frozen set of token families.

**Frozen Foundations** (DO NOT CHANGE):
- `design-system.css` — single source of truth for colors, spacing, radii, shadows, breakpoints, type scales
- `.la-btn` — button base class (inset, raised, ghost variants via modifiers)
- `.la-seg` — segmented control track
- `.la-seg-btn` — individual tab/button inside a track
- `.neu-*`, `.glass-*` utility classes — neumorphic + glassmorphic internals (frozen to avoid shifting all cards project-wide)

---

## Token Families (All Active)

### Colors
```css
--wine: #5E2230              /* accent, active states, interactive highlights */
--wine-tint: rgba(94,34,48,0.08)  /* soft wine background for inactive raised elements */
--paper: #FFFBF7            /* bright card/raised surfaces, text on wine */
--bg: #ECE7DD               /* page ground — warm, light */
--bg-2: #E4DCCC             /* secondary background (sidebar, bottom bar) */
--surface: #F5F1E8          /* card/raised-element surface */
--card: #FFFFFF             /* brightest white cards (used in raised shadows) */
--ink: #2D2622              /* main text */
--mute: #8B7F73             /* secondary text, disabled */
--mute-2: #D4C9BD           /* very light borders, dividers */
--line: #CDBCA8             /* dividing lines */
```

### Radii (Snap to these; NO raw px values in .jsx)
```css
--r-flush: 6px              /* micro-radii; buttons, small inputs */
--r-button: 8px             /* buttons, compact controls */
--r-surface: 11px           /* surfaces, cards */
--r-card: 16px              /* larger cards, panels */
--r-panel: 22px             /* big panels, modals */
--r-pill: 999px             /* fully rounded (pill shapes, avatars) */
```

**Rule:** In JSX inline styles, **ALWAYS use `borderRadius: 'var(--r-*)'` (quoted string)**. Bare `borderRadius: var(--r-card)` is a syntax error in Babel and breaks the page.

### Spacing
```css
--space-xxs: 4px
--space-xs: 6px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
--space-xl: 20px
--space-2xl: 24px
--space-3xl: 28px
```

### Shadows
```css
--sh-inset-crisp: inset 0 1px 2px rgba(0,0,0,0.08)
--sh-raised-crisp: 0 1px 3px rgba(0,0,0,0.12)
--sh-raised-medium: 0 4px 12px rgba(0,0,0,0.15)
--sh-raised-tall: 0 12px 32px rgba(0,0,0,0.18)
```

### Responsive Breakpoints
```css
--bp-sm: 480px    /* small phone */
--bp-md: 768px    /* tablet */
--bp-lg: 1024px   /* desktop */
--bp-xl: 1440px   /* wide desktop */
```

Use in media queries: `@media (max-width: var(--bp-md)) { ... }`

### Mobile Safe Areas (notch / bottom nav)
```css
--safe-top: env(safe-area-inset-top, 0)       /* notch clearance */
--safe-bottom: env(safe-area-inset-bottom, 0) /* bottom bar clearance */
--bottombar-h: 56px                           /* height of fixed bottom tab bar */
```

---

## Component Classes

### Buttons
```jsx
// Base: inset (default), raised, or ghost
<button className="la-btn">Regular</button>
<button className="la-btn la-btn--raised">Raised</button>
<button className="la-btn la-btn--ghost">Ghost</button>

// Wine accent variant
<button className="la-btn wine">Accent</button>

// Size modifiers: (default is normal; sm/xs below)
<button className="la-btn la-btn--sm">Small</button>
<button className="la-btn la-btn--xs">Tiny</button>
```

### Segmented Controls (Tabs / View Switchers)
```jsx
// Track container
<div className="la-seg">  {/* or .la-seg--fill for full-width flex layout */}
  <button className="la-seg-btn on">Active</button>  {/* .on = wine highlight + raised */}
  <button className="la-seg-btn">Inactive</button>
</div>

// Inside .la-seg, buttons auto-flex and center. Use .la-seg--fill for full-bleed:
<div className="la-seg la-seg--fill">
  <button className="la-seg-btn on">Option 1</button>
  <button className="la-seg-btn">Option 2</button>
</div>
```

**Key rule:** DO NOT convert custom selection-list controls (like the settings sidebar nav) to `.la-seg` — those are intentional vertical selections, not tab bars. Tokenize their radii, but keep the structure intact.

### Mobile Bottom Bar
```jsx
<div style={{ 
  flexShrink: 0, 
  display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
  background: 'var(--bg-2)', borderTop: '1px solid var(--line)',
  minHeight: 'var(--bottombar-h)',
  padding: '8px 6px calc(10px + var(--safe-bottom))',  // notch-aware bottom padding
}}>
  {tabs.map(t => (
    <button key={t.key} style={{
      border: 'none', background: 'transparent', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '4px 0',
    }}>
      <span style={{
        width: 56, height: 30, borderRadius: 'var(--r-pill)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: on ? 'var(--wine)' : 'var(--mute)',
        background: on ? 'var(--wine-tint)' : 'transparent',
        boxShadow: on ? 'inset 0 0 0 1px rgba(94,34,48,0.14)' : 'none',
        transition: 'all 160ms',
      }}>
        <Icon size={20} />
      </span>
      <span style={{ fontSize: 9, fontWeight: on ? 700 : 400, color: 'inherit' }}>{t.label}</span>
    </button>
  ))}
</div>
```

---

## Recipe: Migrating a New Page

When building a new page or refactoring an old one:

1. **Replace all raw color values** with `var(--wine)`, `var(--mute)`, `var(--surface)`, etc.
2. **Replace all padding/margin/gap with `var(--space-*)`** — never hardcode 8px, 12px, 20px.
3. **Replace all `borderRadius: <number>`** with `'var(--r-*)'` — snap to the nearest tier.
4. **Replace buttons** with `.la-btn` or `.la-btn--raised`, add wine variant if needed.
5. **Replace tabs/switchers** with `.la-seg` + `.la-seg-btn.on`.
6. **Check responsive** with `@media (max-width: var(--bp-md))` or the `--safe-*` tokens for mobile notches.

---

## Critical Gotchas

### JSX Inline Styles: Quoted Strings for CSS Variables
```jsx
// ✅ CORRECT
<div style={{ borderRadius: 'var(--r-card)', padding: 'var(--space-md)' }}>

// ❌ WRONG (Babel syntax error — page breaks)
<div style={{ borderRadius: var(--r-card), padding: var(--space-md) }}>
```

### Don't Convert Selection Lists to `.la-seg`
Vertical navigation menus (like the Settings section nav with 18px/20px padding) are intentional list-based UX, not tab bars. Keep their flex/grid structure; only tokenize their radii.

```jsx
// ✅ Keep structure, tokenize radii
<button style={{ padding: '18px 20px', borderRadius: 'var(--r-surface)' }}>Section A</button>

// ❌ Don't force into .la-seg
<div className="la-seg">  {/* Wrong UX for a vertical list */}
  <button className="la-seg-btn">Section A</button>
</div>
```

### Sub-6px Micro-Radii Stay Literal
Pill shapes, tiny badges, and micro-controls under 6px should stay as hardcoded px (e.g., `borderRadius: 3` for a small badge). The `--r-flush: 6px` tier is the floor.

### Frozen Foundations: Don't Snap `.neu-*` / `.glass-*`
The `design-system.css` file contains frozen utility classes (`.neu-raised`, `.glass-soft`, etc.) that use tuned px values. **DO NOT tokenize them.** Changing their radii shifts every card/panel project-wide and breaks the design. These are locked intentionally.

### Mobile Safe-Area Padding
Always use `calc(10px + var(--safe-bottom))` for bottom bar bottom-padding on mobile to account for the notch. Never hardcode the bottom padding.

---

## Files Structure

- **`design-system.css`** — All tokens, frozen utility classes, .la-btn, .la-seg definitions
- **`*.html`** — Entry points (Lead Awaker Mobile.html, CRM Stats Redesign.html, etc.)
- **`*-app.jsx`** — Page orchestrators (leads-app, tasks-app, campaign-workspace, etc.)
- **`*-views.jsx`** / **`*-components.jsx`** — Sub-components and layout helpers
- **`components.jsx`** — Shared primitives (Icon, Sidebar, Header, etc.)
- **`layout-bold.jsx`** / **`layout-safe.jsx`** — Desktop layout scaffolds

**Pages fully migrated (all tokens adopted):**
- Leads, Tasks, Campaign, Billing, Calendar, Prompt, Settings, shared chrome, all Mobile tabs

---

## Last-Session Summary

✅ **All `mobile-*` files migrated** — every segmented control (Stats/Settings, List/Pipeline, Agenda/Board, detail tabs) now uses `.la-seg`.
✅ **Dead `--cream` bug fixed** — mobile segments were falling back to no background; now route through proper `.la-seg-btn.on`.
✅ **~95 radii tokenized** — all mobile + settings-b radii snap to `--r-*` tiers.
✅ **Campaign re-verified** — the Stats/Settings toggle renders cleanly.
✅ **JSX-quoting gotcha recorded** — values must be quoted strings in inline styles.

**No console errors; verifier sweep in progress.**

---

## Starting a New Component or Page?

1. Read the color/radius/spacing tokens above.
2. Use `.la-btn` for buttons, `.la-seg` for tabs/switchers.
3. Quote all CSS variable values in JSX inline styles: `'var(--r-card)'`.
4. Snap all radii to the tier nearest the design (6/8/11/16/22/999).
5. If unsure, check `Leads Page.html` or `Tasks Page.html` as migration examples.

Questions? The full migration context is in `HANDOFF.md` at the project root.
