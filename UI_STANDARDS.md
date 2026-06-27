# Lead Awaker — UI Standards

> **This is the single canonical source of truth for all UI work.**
> Every Claude session MUST read this file before writing any frontend code.
> If a rule exists here, it overrides anything in CLAUDE.md, frontend.md, or memory files.

---

## 1. Brand Identity

**Lead Awaker** is an AI-powered WhatsApp lead reactivation engine. It is NOT a generic CRM.

- **North Star KPI:** Calls Booked — must be the most prominent element on the Dashboard.
- **Mental Model:** Accounts → Campaigns → Leads → Interactions → Pipeline Movement.
- **Default Pipeline:** New → Contacted → Responded → Multiple Responses → Qualified → Call Booked → Lost → DND.

**Design Priorities (in order of tradeoff):**
1. Pipeline visibility
2. Perceived speed
3. Cognitive clarity
4. Operational efficiency
5. Professional SaaS polish

**Personality:** Linear/Stripe energy — confident, minimal, data-dense. Not playful, not enterprise-gray.

---

## 2. Color System

> ### ⭐ Source of truth: `client/src/styles/variables.css`
> The **token names** below are canonical. Their **values live in `variables.css`** (mirrored
> into Tailwind via `tokens.css`) — that file is the one place colors are defined, and it is
> what ships. Any hex written in this doc is illustrative of the *current* value and may lag the
> CSS; when they disagree, **the CSS wins.** Never hardcode a hex in a component — reference the
> token (`bg-primary`, `text-primary`, `hsl(var(--brand-indigo))`). This is what makes a full
> re-skin (e.g. going neumorphic, or swapping the accent) a single-file edit.

**Current palette: warm-bone neumorphic with deep wine accent.** The primary accent is deep wine
`#5E2230` (`346 43% 25%`) on a warm bone page (`#ECE7DD`, `38 27% 88%`) with white neumorphic cards.
The design uses directional-light neumorphic shadows (bilateral dark + light highlights) and
frosted glass for overlays. (The earlier indigo `#4F46E5` + yellow `#FFDF3D` + wine `#8D354B`
palettes have been retired; `--brand-indigo`/`--brand-yellow` token *names* still exist but
resolve to deep wine for backwards-compat — see `variables.css` and `neu.css` for the full system.)
**Dark mode is live** (warm charcoal): `.dark` token overrides live in `variables.css` and
`design-system.css`. Never hardcode `bg-white`, `text-black`, or raw hex in components; anything
not going through tokens breaks in dark mode. (Known debt: Settings forms, billing panels, and
some mobile sheets still hardcode `bg-white`.)

### 2.1 Brand Colors (Primary Palette)

Token **roles** (exact values in `variables.css`):

| Token | Role |
|-------|------|
| `--primary` / `--accent` | **Primary brand accent (wine).** Buttons, links, focus rings, active nav, CTAs. |
| `--brand-indigo`, `--brand-blue` | Legacy accent token names — now resolve to `--primary` (wine). Prefer `--primary`. |
| `--brand-deep-blue` | Deep accent — strong emphasis, dark wine. |
| `--brand-yellow`, `--brand-soft-yellow` | Legacy KPI-accent names — now resolve to wine. |
| `--foreground` / `--muted-foreground` | Text — near-black / muted gray. |

**Rule:** `--primary` and `--brand-blue` resolve to the same wine accent. New code should reach
for `--primary` (or the `primary` Tailwind color), not the legacy `--brand-*` aliases.

### 2.2 Highlight & Selection Colors

| Token | Usage |
|-------|-------|
| `--highlight-active` | Active nav pill, active tab pill, selected filter pills (light wine tint). |
| `--highlight-selected` | Selected card background, highlighted table row, selected containers (light wine tint). |
| `--highlight-hover` | Hover state on already-highlighted elements. |

Selection/active tints are wine-derived (`--wine-tint: rgba(94,34,48,0.08)`) for hover/inactive
and `--wine-glow: rgba(94,34,48,0.18)` for stronger emphasis — both defined in `variables.css`.
**NEVER USE** any lime/chartreuse yellow (`#FFF375`, `#FFF6C8`, etc.) — banned.

### 2.25 Surface Primitives & Layout Tokens

Recurring surfaces (list rows, group headers, panels, pills, toolbar buttons) are **not**
hand-rolled per page. They are rendered by shared primitives in
`client/src/components/crm/primitives/`, each of which bakes in CSS tokens from `variables.css`.
Change the token (or the primitive) once → every page follows. This is the same single-edit
re-skin principle as the color system, extended to dimensions/shadows/spacing.

**The rule: new list / card / panel / pill UI MUST compose a primitive. Never hand-roll
`rounded-*`, `shadow-*`, or card padding on a list row.** Per-instance tweaks go through
`className` (tailwind-merge lets a page override without forking the component).

| Primitive | Use for | Key tokens |
|-----------|---------|-----------|
| `<ListCard>` | Any selectable list row (Leads, Prospects, Conversations, Tasks, Campaigns) | `--list-card-radius`, `--list-card-radius-mobile`, `--list-card-pad-x/y`, `--list-card-min-h`, `--list-card-shadow`, `--list-card-shadow-hover` |
| `<GroupHeader>` | Sticky section divider in list views | `--group-header-pad-x/y`, `--group-header-sticky-top`, `--group-header-bg` |
| `<SectionCard>` | Larger container (kanban column, detail section, widget shell) | `--panel-radius`, `--panel-bg`, `--panel-pad`, `--panel-shadow` |
| `<Pill>` | Status / label badge | `--pill-radius`, `--pill-pad-x/y` |
| `<ToolbarButton>` + `toolbarButtonClasses` | Expand-on-hover toolbar filter/action buttons | (Tailwind strings; active state reads `--primary`) |

`<ListCard>` props of note: `selected`, `interactive` (cursor + hover bg, default on),
`hoverShadow` (lift on hover — **opt-in**, so pages that never had one keep parity), `padded`
(bake the standard padding, default on; set false when a card manages its own inner padding),
`as` (`div`/`button`/`li`), `accentColor`. Import from `@/components/crm/primitives`.

All dimensional tokens live in `:root` in `variables.css`; only color-bearing ones (shadows on
dark navy, selection tints) carry a `.dark` override. To overhaul the look of every card/panel
in the app (radius, density, elevation, even a neumorphic pass), edit those tokens — not the pages.

### 2.3 Surface Hierarchy (Warm-Bone Neumorphic System)

Depth is communicated through neumorphic directional-light shadows, NOT visible borders.

| Level | Token | Hex | HSL | Usage |
|-------|-------|-----|-----|-------|
| 0 (page) | `--background` | `#ECE7DD` | `38 27% 88%` | Page ground, inset surface background |
| 1 (sidebar) | `--bg-2` | `#E4DCCC` | `38 29% 85%` | Sidebar, nav rail, bottom bar |
| 2 (muted) | `--muted` | warm near-white | `39 30% 96%` | Secondary panels, surface fills |
| 3 (card) | `--card` | `#FFFFFF` | `0 0% 100%` | White neumorphic raised cards |
| 4 (surface) | `--surface` | `#FBF8F2` | hex | Near-white raised chips, buttons |

**Shadows:** Neumorphic bilateral shadows (dark cast + light highlight) defined in `neu.css`.
Use `.neu-raised`, `.neu-raised-crisp`, `.neu-inset`, `.neu-polished`, `.glass`, `.glass-strong`
utility classes. See `neu.css` for the complete shadow token system.

> **Narrow icon buttons** (small square/icon-only triggers like a popover toggle,
> a settings gear, an inline action icon) use **`.neu-inset-super-crisp`** — the
> shallowest inset. Never leave them as bare transparent buttons; the shallow inset
> gives them a tactile, pressable affordance without reading as a deep well.

**Radius tiers:** Six semantic tiers (`--r-flush: 6px`, `--r-button: 8px`, `--r-surface: 11px`,
`--r-card: 16px`, `--r-panel: 22px`, `--r-pill: 999px`). Snap all corners to these tiers —
never use ad-hoc px values. The legacy `--radius: 1.5rem` still exists for backwards compatibility
with existing shadcn components.

### 2.4 Text Colors

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--foreground` | `#1F1A14` | `30 14% 10%` | Primary text, headings, body copy. |
| `--ink-soft` | `#322B22` | hex | Softened headings, secondary text. |
| `--muted-foreground` | `#6C6354` | `39 15% 38%` | Secondary text, captions, icon default color. |
| `--secondary-foreground` | `#322B22` | hex | Slightly muted primary text. |

### 2.5 Pipeline Stage Colors

These are fixed hex values used in Kanban columns, status badges, and pipeline charts.

| Stage | Hex | Notes |
|-------|-----|-------|
| New | `#6C5A8C` | Muted purple |
| Contacted | `#547BB0` | Steel blue |
| Responded | `#3F8E8E` | Teal |
| Multiple Responses | `#5E8E5E` | Sage green |
| Qualified | `#B58F3E` | Warm gold |
| Booked | `#C48A2F` | Amber-gold |
| Closed | `#6E7A5E` | Muted olive |
| Lost | `#A24B3F` | Warm red |
| DND | `#9D8E76` | Warm taupe |

> **Source of truth:** `PIPELINE_STAGE_COLORS` in `client/src/lib/avatarUtils.ts`. If you update stage colors, update there — docs follow code.

### 2.6 Status Colors (Campaigns, Accounts)

**Campaign Status:**

| Status | Badge BG | Badge Text | Dot Color |
|--------|----------|------------|-----------|
| Active | `#DCFCE7` | `#15803D` | `#22C55E` |
| Paused | `#FEF3C7` | `#92400E` | `#F59E0B` |
| Completed | `#DBEAFE` | `#1D4ED8` | `#3B82F6` |
| Finished | `#DBEAFE` | `#1D4ED8` | `#3B82F6` |
| Inactive | `#F4F4F5` | `#52525B` | `#94A3B8` |
| Archived | `#F4F4F5` | `#52525B` | `#94A3B8` |
| Draft | `#E5E7EB` | `#374151` | `#6B7280` |

**Account Status:**

| Status | Color |
|--------|-------|
| Active | `#10B981` |
| Trial | `#F59E0B` |
| Inactive | `#94A3B8` |
| Suspended | `#F43F5E` |
| Paused | `#F59E0B` |

### 2.7 Semantic Colors

| Token | Hex | Role |
|-------|-----|------|
| `--destructive` | `hsl(0 84% 60%)` | Errors, delete actions, dangerous operations. |
| `--success` | `hsl(142 71% 45%)` | Success toasts, positive confirmation. |
| `--info` | `#4F46E5` | Informational — same as brand indigo. |
| `--accent` | `hsl(35 95% 55%)` | Orange/gold accent from logo rays. |

### 2.8 Chart Colors

| Chart Token | HSL | Notes |
|-------------|-----|-------|
| `--chart-1` | `346 43% 25%` | Deep Wine |
| `--chart-2` | `150 52% 38%` | Emerald |
| `--chart-3` | `37 70% 50%` | Warm Amber |
| `--chart-4` | `260 23% 45%` | Muted Purple |
| `--chart-5` | `10 50% 40%` | Warm Red |

### 2.9 Dark Mode

**Dark mode is deferred.** Dark-mode overrides have been removed from `variables.css` for the
current phase. The warm-bone neumorphic system targets light mode only. Dark equivalents will
be added as a follow-up phase after the full light-mode migration is approved.

---

## 3. Typography

| Property | Value |
|----------|-------|
| Body font | `Manrope` (`--font-sans`) |
| Heading font | `Playfair Display` (`--font-heading`) |
| Mono font | `Geist Mono` — eyebrows, labels, data, status pills |
| Headings | `font-heading font-bold tracking-tight` |
| Body | `font-sans antialiased` |

**Rules:**
- All `<h1>` through `<h6>` use `Playfair Display` automatically via the base layer.
- Never override heading font to Manrope. Never use Playfair Display for body text.
- Geist Mono is used for eyebrows (`.eyebrow`), UI labels, status pills (`.la-status`),
  segmented controls (`.la-seg-btn`), and compact buttons (`.la-btn`).
- No additional font imports needed beyond Manrope + Playfair Display + Geist Mono.

---

## 4. Spacing, Sizing & Layout

### 4.1 The ONE Size Rule

There is ONE standard size for interactive circle/pill elements: **36px** (`h-9`). No sm/md/lg variants.

| Element | Size | Tailwind | Notes |
|---------|------|----------|-------|
| Icon button circle | 36px | `h-9 w-9` | Outline circle, `rounded-full border border-border/60` |
| Icon inside circle | 16px | `h-4 w-4` | Always. No exceptions. |
| Toolbar action button | 36px | `h-9 pl-[9px] rounded-full` | **Expand-on-hover pill** — icon-only at rest (`max-w-9`), label slides in on hover. See §24. |
| Nav active pill | 44px | `h-[44px]` | Sidebar selected page highlight. |
| Lead avatar circle | 36px | `h-9 w-9` | Uses `getStatusAvatarColor(status)`. |
| Lead score circle | 36px | `h-9 w-9` | — |

### 4.2 Table Row Heights

| Context | Height | Tailwind |
|---------|--------|----------|
| Data rows (all tables) | 52px | `h-[52px]` |
| Skeleton rows | 52px | `h-[52px]` |
| Header rows | auto | `py-2` |

**This is project-standard.** All new data tables (`Leads`, `Campaigns`, `Accounts`, `Users`, etc.) MUST use `h-[52px]` for data rows.

### 4.3 Sidebar Layout

| Property | Value |
|----------|-------|
| Position | `fixed left-0 top-16 bottom-0` |
| Collapsed width | `w-[86px]` |
| Expanded width | `w-[259px]` |
| Nav icon circles | `h-10 w-10` with `border border-black/25` (overlay mode) |
| Active pill (expanded) | `h-[43px] rounded-full bg-[var(--highlight-active)]` |
| Active pill (collapsed) | Circle fills `bg-[var(--highlight-active)]` |
| DbStatusIndicator | Bottom-left, `h-10 w-10` circle, `justify-start` |

### 4.4 Border Radius

`--radius: 1.5rem` (24px) is the global radius. All shadcn components inherit this. Do not use `rounded-sm`, `rounded-md`, `rounded-lg` — they all resolve to the same 24px value intentionally.

For pills and circles: `rounded-full` (infinite radius).

### 4.5 Design System Token File

`client/src/styles/design-system.css` is the canonical token file for the warm-bone neumorphic system. It runs in parallel with `variables.css` — old tokens keep working, new tokens are available immediately on any page.

**Border Radius Scale** (snap all corners to these — never use ad-hoc px values):

| Token | Value | Usage |
|-------|-------|-------|
| `--r-flush` | 6px | Wells, tracks, inset-crisp surfaces, tiny glyph tiles |
| `--r-button` | 8px | Buttons, segmented controls, small action chips |
| `--r-surface` | 11px | List rows, message balloons, mono tiles, raised chips |
| `--r-card` | 16px | Cards and panels that carry a header |
| `--r-panel` | 22px | Hero bands, modals, the largest floating surfaces |
| `--r-pill` | 999px | Pills, toggles, circular icon buttons, avatars-as-pill |

**Spacing Scale** (8px base unit — use these for gap and padding):

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xxs` | 4px | Micro gaps |
| `--space-xs` | 8px | Tight gaps |
| `--space-sm` | 12px | Default inner padding |
| `--space-md` | 16px | Standard padding |
| `--space-lg` | 20px | Relaxed padding |
| `--space-xl` | 24px | Section padding |
| `--space-xxl` | 32px | Wide section padding |
| `--space-section` | 80px | Full-bleed editorial bands only |

**Breakpoints** (mirror the values used in `@media` queries and JS width checks):

| Token | Value | Behavior |
|-------|-------|----------|
| `--bp-phone` | 768px | Below: mobile app (bottom tabs, sheets) |
| `--bp-tablet` | 1024px | 768–1023: sidebar + stacked detail |
| `--bp-desktop` | 1240px | Below 1240: Leads list collapses to icon rail |
| `--bp-wide` | 1680px | 1680+: detail splits chat + summary columns |

**Elevation Scale** (shadow tokens, defined in `design-system.css` `:root`):

| Token | Usage |
|-------|-------|
| `--sh-raised-crisp` | Small raised surfaces, cards, buttons |
| `--sh-raised-medium` | Medium depth — standard card elevation |
| `--sh-raised-large` | Hero bands, modals, prominent floating surfaces |
| `--sh-inset-crisp` | Inset wells, active pressed state |
| `--sh-inset-medium` | Deeper wells |
| `--sh-polished-medium` | Polished/hero surfaces with inner light edge |
| `--sh-polished-large` | Large polished hero panels |

**Responsive Behavior:**
- Below `--bp-phone` (768px): mobile shell — bottom tab bar (`--bottombar-h: 64px`), full-screen panels, safe-area insets apply
- 768–1023px: sidebar + stacked detail panel
- 1024–1239px: full sidebar, Leads list icon rail
- 1240–1679px: full Leads list + detail panel
- 1680px+: detail panel splits into chat column + summary column

**JSX inline style rule:** CSS vars in inline styles MUST be quoted strings:
```jsx
// Correct
<div style={{ borderRadius: 'var(--r-card)', padding: 'var(--space-md)' }}>
// Wrong (Babel syntax error)
<div style={{ borderRadius: var(--r-card) }}>
```

---

## 5. Component Patterns

### 5.1 Shared UI Components

These components live in `client/src/components/ui/` and MUST be used instead of building custom equivalents:

| Component | File | Purpose |
|-----------|------|---------|
| `IconBtn` | `icon-btn.tsx` | Circle button — `h-9 w-9`, `h-4 w-4` icons. Icon-only, no label. |
| `ViewTabBar` | `view-tab-bar.tsx` | Tab switcher. Active tab: `h-9 px-3 rounded-full` with `--highlight-active` bg. |
| `SearchPill` | `search-pill.tsx` | Expandable search input. Collapses to icon circle; expands on hover/focus/value. Use `open={true}` for always-expanded. |
| ~~`ToolbarPill`~~ | `toolbar-pill.tsx` | **DEPRECATED.** Do not use. Replace with the expand-on-hover pattern (§24). |
| All shadcn/ui | `components/ui/*` | Prefer existing components. Don't rebuild. |

### 5.2 Active & Selected States

| State | Background | Text | Example Usage |
|-------|------------|------|---------------|
| Active tab/pill | `--wine-tint` (rgba wine 8%) | `--wine` | ViewTabBar active, nav active pill. |
| Selected card | `--card` (white) + `--sh-raised-crisp` | `--foreground` | Campaign selected, leads selected. |
| Selected row | `--wine-tint` | `--foreground` | Highlighted table row. |
| Hover (warm) | `--wine-tint` | `--foreground` | Hover on cards, rows. |
| Hover (neutral) | `--card-hover` (near-white) | `--foreground` | Default hover on cards, rows. |
| Focus ring | `--primary` (deep wine #5E2230) | — | 2px outline, 2px offset. |
| Primary button | `--wine-grad` (wine gradient) | white | CTA buttons, primary actions. |
| KPI emphasis | `--warn` (amber #DA9426) | `--foreground` | Call Booked badge, sparklines. |

### 5.3 Cards & Panels

- Cards float on `--card` (`#F8F8F8`) above the `--background` (`#DEDEDE`) canvas.
- **Widget cards in detail/list views:** `bg-white/60 dark:bg-white/[0.10]` (semi-transparent white, lets gradient backgrounds show through).
- **Highlighted widget cards** (Key Metrics, Financials): `bg-white dark:bg-white/[0.12]` (pure white, fully opaque for prominence).
- No visible borders on cards — depth comes from color contrast.
- Detail panel right sidebar (LeadInfoPanel): 288px wide (`w-72`).
- Full slide-over panel (LeadDetailPanel): Sheet component.
- Detail panel header bloom effect: use `--highlight-active` (`#FFF28D`), not lime yellow.

**Never let a parent container clip a card's neumorphic shadow/highlight.** This bug recurs every time a new list panel is built:
- Any flex child that scrolls (`overflow-y-auto`) must also have `overflow-hidden`'s sibling/ancestor wired with `min-h-0` — without it, the child refuses to shrink, overflows its flex parent, and the parent's `overflow-hidden` silently clips the raised/inset shadow on cards (usually only noticed on the selected/active card, since that's the one with the visible shadow). Audit pattern: `cn("flex-col h-full min-h-0 ... overflow-hidden", widthClass)` on the panel root, `flex-1 overflow-y-auto la-list-area` on the scroll child.
- If a card needs its own `overflow-hidden` wrapper (e.g. for a swipe gesture), do **not** put the active-state `box-shadow` inside that wrapper — emit it on the wrapper's own inline style instead, or it gets clipped by its own clipping context. See `LeadListCard.tsx`'s outer swipe wrapper for the pattern.
- Reference implementation with no clipping: the Calendar page's agenda cards (`DesktopCalendar.tsx`). When building a new neumorphic list/grid, copy its scroll-container structure, not just its shadow tokens.

### 5.4 Tables (DataTable pattern)

- Row height: `h-[52px]` (standard for all tables).
- Hover: `bg-card` or similar neutral lift.
- Selected: `bg-[var(--highlight-selected)]`.
- Header: `py-2`, `text-muted-foreground`, `text-xs`, `font-medium`.
- Skeleton loading rows: same `h-[52px]` height.

### 5.5 Forms & Inputs

- Input background: `--input` (same as `--muted`, `#E3E3E3`).
- Focus: 2px ring in `--brand-indigo`.
- No visible borders at rest — background differentiation only.
- Radius: inherits global `--radius` (24px).

---

## 6. Interactive States

Every clickable element MUST have all four states:

| State | Treatment |
|-------|-----------|
| **Default** | Base styling. |
| **Hover** | `filter: brightness(1.08)` and/or subtle shadow via `hover-elevate` utility. |
| **Active/Press** | `transform: scale(0.97)`, `filter: brightness(0.95)` via `active-elevate-2` utility. |
| **Focus-visible** | `outline: 2px solid hsl(var(--ring)); outline-offset: 2px;` (keyboard only). |
| **Disabled** | `opacity: 0.35`, `cursor: not-allowed`. |

---

## 7. Animation & Transitions

### 7.1 Duration Tiers

| Tier | Duration | Usage |
|------|----------|-------|
| `--t-micro` | 150ms | Color, opacity, hover states (buttons, badges, inputs, table rows). |
| `--t-standard` | 200ms | UI open/close (dialogs, dropdowns, popovers, tooltips). |
| `--t-panel` | 250ms | Larger slides (sheets, sidebar, panels, drawers). |
| `--t-page` | 220ms | Full page transitions. |

### 7.2 Easing

| Curve | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | All standard transitions. |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toggle/checkbox micro-interactions. |

### 7.3 Rules

- **NEVER** use `transition-all`. Always specify exact properties: `transition: background-color 150ms ease, color 150ms ease`.
- Only animate `transform` and `opacity` for GPU acceleration. Avoid animating `width`, `height`, `margin`, `padding`.
- Performance-first: this app runs on Raspberry Pi. No heavy animations.
- Use `will-change` sparingly and only on elements that actually animate.

### 7.4 Named Keyframes (index.css)

| Class | Keyframe | Duration | Easing | Usage |
|-------|----------|----------|--------|-------|
| `animate-card-enter` | `card-enter` — fade + `translateY(6px→0)` | 220ms | `ease-out` | Left-panel card list stagger on load |
| `animate-fade-in` | `fade-in` — opacity only | 220ms | `ease-out` | Virtualized list items (no transform conflict) |
| `animate-bubble-left` | `bubble-enter-left` — fade + `translateX(-8px→0)` | 200ms | `ease-out` | Inbound chat bubbles |
| `animate-bubble-right` | `bubble-enter-right` — fade + `translateX(8px→0)` | 200ms | `ease-out` | Outbound chat bubbles |
| `animate-panel-slide-up` | `panel-slide-up` — fade + `translateY(12px→0)` | 250ms | `cubic-bezier(0.22,1,0.36,1)` | Reserved — do not use for card selection (see §29) |

### 7.5 Card Selection Scroll

Selecting a card in a split-pane left panel **smoothly scrolls** the list to bring that card to the top — it never jumps. See **§29** for the full standard and reference implementation.

---

## 8. Glassmorphism

Glassmorphism is permitted in the neumorphic warm-bone design system. Use `.glass` (55% opacity warm white + backdrop-blur 22px + 12px radius) and `.glass-strong` (75% opacity + blur 28px + warm ambient glow + 14px radius) for:
- Mobile bottom sheets and overlays
- Tweak/config panels
- Profile dropdown menus

For functional UI (popovers, dialogs, dropdowns), prefer solid `.neu-raised` cards over glass.
The old blanket ban is retired — the new glass tokens are defined in `neu.css` and use the
warm-bone palette rather than cold transparency.

---

## 9. Coding Rules

### 9.1 Mandatory

1. **Use CSS variables for all brand colors.** Never hardcode a hex in component files — use the token (`bg-primary`, `text-primary`, or `hsl(var(--primary))`). Values live in `variables.css`.
1b. **Compose a surface primitive for list/card/panel/pill UI** (`ListCard`, `GroupHeader`, `SectionCard`, `Pill` from `@/components/crm/primitives`). Don't hand-roll the surface — see §2.25.
2. **Use `apiFetch`** from `@/lib/apiUtils` for data requests. **Use `apiRequest`** from `queryClient.ts` for mutations.
3. **Use existing shadcn/ui components.** Don't rebuild dialogs, buttons, dropdowns, etc.
4. **Use `IconBtn`** for all icon-only buttons. Don't create custom circle buttons.
5. **Follow feature-based folder structure:** `client/src/features/{domain}/`.
6. **Respect database field names exactly:** `Conversion_Status`, `Accounts_id`, `full_name_1`, etc.
7. **Include `credentials: "include"`** on all API calls (handled by `apiFetch`/`apiRequest`).
8. **Always invoke the `frontend-design` skill** before writing any frontend code.

### 9.2 Forbidden (NEVER DO)

1. **NEVER** use `#FFF375`, `#FFF6C8`, or any lime/chartreuse yellow. These are banned.
2. **NEVER** hardcode a brand hex (`#4F46E5`, `#8D354B`, `#5170FF`, …) in a component. Use the token (`primary` / `--primary`). The accent is defined once in `variables.css`.
2b. **NEVER** hand-roll `rounded-*`, `shadow-*`, or padding on a list card / group header / panel. Compose the primitive (§2.25) so a global re-skin stays a single CSS edit.
3. **NEVER** use `transition-all`. Specify exact properties.
4. **NEVER** use default Tailwind palette colors (`blue-500`, `yellow-400`, etc.) for brand elements. Use CSS variable-based classes.
5. **NEVER** add new npm packages without explicit user approval.
6. **NEVER** modify backend/Express server code.
7. **NEVER** modify landing/marketing pages (pre-login).
8. **NEVER** use raw `fetch()` — always go through `apiFetch` or `apiRequest`.
9. **NEVER** use icons larger than `h-4 w-4` (16px) inside circle buttons or smaller than `h-4 w-4`.
10. **NEVER** create button size variants (sm, md, lg). Everything is 36px (`h-9`).
11. **NEVER** use `Dialog` / backdrop-modal components for create/edit forms, add-item flows, or option menus. These darken and blur the surrounding UI and are banned. Use instead:
    - **Right-panel** (inline, no overlay — same layout as `ContractCreatePanel` / `InvoiceCreatePanel` / `ExpenseCreatePanel`) for create/edit forms.
    - **`Popover`** for lightweight option menus (sort, filter, quick actions).
    - **Inline expansion** (accordion, collapsible row) for contextual forms within a list.
    - `Dialog` is **only** permitted for destructive confirmation prompts (e.g. "Confirm delete?").

### 9.3 Anti-Generic Guardrails

These rules prevent the UI from looking like generic AI-generated output:

- No default Tailwind blue (`blue-500`/`blue-600`). Only deep wine (`#5E2230`, `--primary`).
- Neumorphic shadows over generic `shadow-md`. Use `.neu-raised`, `.neu-inset`, `.neu-polished`, etc.
- Paired fonts: Playfair Display for headings, Manrope for body, Geist Mono for labels/data.
- No gratuitous gradients. If you use a gradient, use `--wine-grad` for wine or the `.neu-polished` radial overlay for hero surfaces.
- Every clickable needs hover + focus + active states. No exceptions.

---

## 10. CSS Utilities Reference

These custom utilities are defined in `index.css` and available globally:

| Utility | Purpose |
|---------|---------|
| `icon-circle-lg` | 36px circle container (h-9 w-9, flex, centered). |
| `icon-circle-base` | Border + hover/active/focus states for icon circles. |
| `icon-circle-selected` | Brand-indigo filled circle (selected state). |
| `toolbar-pill-base` | 36px-tall text pill with border + states. |
| `toolbar-pill-active` | Active state modifier for toolbar pills. |
| `hover-elevate` | Brightness lift + shadow on hover. |
| `active-elevate-2` | Press-down scale on active. |
| `micro-check` | Checkbox tick bounce animation. |
| `micro-icon-hover` | Icon button hover scale. |
| `glass-overlay/divider/accent/surface/nav` | Glassmorphism utilities. |
| `scrollbar-hide` | Hides scrollbar (keeps scroll functional). |
| `scrollbar-visible` | Shows thin styled scrollbar. |

---

## 11. Leads Views Reference

The Leads feature has three views managed by `LeadsTable.tsx`:

| View | Component | Layout |
|------|-----------|--------|
| List (default) | `LeadsCardView.tsx` | D365-style split-pane: compact lead list left + detail panel right. |
| Table | `LeadsInlineTable.tsx` | Full-width data table + `LeadInfoPanel` (288px sidebar). |
| Kanban | `LeadsKanban.tsx` | Pipeline columns. Supports `onCardClick` + `selectedLeadId`. |

- `LeadInfoPanel.tsx`: Right sidebar in Table view / Kanban card click. 288px wide.
- `LeadDetailPanel.tsx`: Full slide-over Sheet for deep editing / interaction timeline.

---

## 12. Dark Mode Notes

**Dark mode is deferred.** The `.dark` overrides have been removed from `variables.css`. The
current design system targets light mode only (warm-bone neumorphic). Dark mode equivalents
will be added as a separate follow-up phase after the full warm-bone migration is approved
and stabilized. The themed color variables (`bg-card`, `text-foreground`, etc.) still work —
they just render the light-mode values regardless of user preference for now.

---

## 13. File Locations

| What | Path |
|------|------|
| CSS variables & utilities | `client/src/index.css` |
| All shadcn/ui components | `client/src/components/ui/` |
| IconBtn | `client/src/components/ui/icon-btn.tsx` |
| ViewTabBar | `client/src/components/ui/view-tab-bar.tsx` |
| ToolbarPill | `client/src/components/ui/toolbar-pill.tsx` |
| SearchPill | `client/src/components/ui/search-pill.tsx` |
| API helpers | `client/src/lib/apiUtils.ts`, `client/src/lib/queryClient.ts` |
| Feature modules | `client/src/features/{domain}/` |
| Route pages | `client/src/pages/` |
| Full file index | `FILE_MAP.md` (project root) |

---

## Implementation Patterns (§14–§30)

> **Detailed implementation patterns, exact markup, and code-level references have been moved to [`UI_PATTERNS.md`](UI_PATTERNS.md).**
> This keeps `UI_STANDARDS.md` focused on rules, tokens, and design decisions (the "what" and "why").
> `UI_PATTERNS.md` contains the "how" — copy-pasteable markup, exact class strings, and reference implementations.

### Quick Reference — Pattern Index

| Section | Topic | Key Rule (read `UI_PATTERNS.md` for markup) |
|---------|-------|----------------------------------------------|
| §14 | Interaction Patterns | **No backdrop dialogs.** Use right-panels for create/edit, Popovers for menus. `Dialog` only for destructive confirms. |
| §15 | Lead Card Standard | Default `bg-[#F1F1F1]`, selected `bg-[#FFF9D9]`, `gap-[3px]` between cards, virtualized lists use `gap: 3` on virtualizer. Tag/label pills: `rgba(0,0,0,0.09)` unselected, `rgba(255,255,255,0.75)` selected — always inline `style`, never Tailwind bg classes. |
| §16 | Left Panel Standard | `w-[340px]`, header `px-3.5 pt-5 pb-1`, controls `px-3 pt-1.5 pb-3 gap-1.5`. Always `IconBtn`. Account/Campaign pills banned. |
| §17 | Table Toolbar | All buttons use expand-on-hover (§28). `SearchPill` for search. Selection actions inline via `ml-auto`. |
| §18 | Calendar Layout | Left panel: Monthly\|Weekly\|Daily. Yellow active tabs. Main toolbar: only `← date →` + Today. |
| §19 | Modal & Overlay Policy | **BANNED:** glass/blur overlays, dark modals for editing. Use `bg-white` tooltip-style panels. |
| §20 | Settings Page | Left nav `w-[200px]`, active section `bg-[var(--highlight-active)]`. |
| §21 | Campaign Detail | Gradient header, toolbar row, tab row (Summary\|Config\|Tags), date range pill bar. |
| §22 | Popups & Fields | **NEVER** darken/blur behind popups. Fields: `bg-input-bg`, no outlines, subtle `ring-brand-indigo/20` focus. |
| §23 | Avatar Standard | Always `EntityAvatar` + `avatarUtils.ts`. Photo > initials. Sizes: 36/34/72/28px. |
| §24 | Group Headers | `sticky top-0 z-30 bg-muted`. Centered label – count with decorative lines. Title case, no `uppercase`. |
| §25 | Typography | Card names + widget titles: `text-[16px] font-semibold font-heading`. No other sizes. |
| §26 | ViewTabBar Position | `w-[309px] shrink-0 justify-between` wrapper. Same position across all views. |
| §27 | Table Group Headers | 3-cell `<tr>`: checkbox (36px) + label + spacer. `PIPELINE_HEX` tinted backgrounds. |
| §28 | Expand-on-Hover Buttons | `xBase`/`xDefault`/`xActive`/`xSpan` constants. `pl-[9px]` centering. `ToolbarPill` deprecated. |
| §29 | Card Selection Scroll | `scrollTo({ behavior: "smooth" })`. `useLayoutEffect`. Detail panel: no remount, no `key`. |
| §30 | Inline Confirm Tooltip | `Popover` with `bg-white rounded-xl`. No dark overlay. Cancel + Confirm buttons. `AlertDialog` only for hard deletes. |

### Dropdown & Popover Background Rule

**All dropdowns, popovers, and tooltips must use `bg-white`** — never `bg-popover`, `bg-background`, or theme-variable backgrounds. This ensures consistent white surfaces across all floating UI.
