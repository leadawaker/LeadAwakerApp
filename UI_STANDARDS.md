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

### 2.1 Brand Colors (Primary Palette)

| Token | Hex | HSL | Role |
|-------|-----|-----|------|
| `--brand-indigo` | `#4F46E5` | `243 75% 59%` | **Primary brand color.** Buttons, links, focus rings, active nav, CTAs. |
| `--brand-deep-blue` | `#131B49` | `231 59% 18%` | Deep accent. Text on yellow backgrounds, sidebar headers, strong emphasis. |
| `--brand-yellow` | `#FFDF3D` | `50 100% 62%` | **KPI accent.** Call Booked highlights, badges, sparklines, Kanban Booked column. Data emphasis only. |
| `--brand-soft-yellow` | `#FCCA47` | `43 97% 63%` | Secondary highlights, hover states, decorative warm accents. |
| `--brand-indian-yellow` | `#FFFFFF` | `0 0% 100%` | Legacy token — currently mapped to white in CSS. Not actively used for tinting. |

**CRITICAL:** `--brand-indigo` (`#4F46E5`) is the primary interactive color — it replaces the old `#5170FF` periwinkle everywhere. `--primary` and `--brand-blue` CSS variables MUST both resolve to `#4F46E5`.

### 2.2 Highlight & Selection Colors

These replace the old lime-yellow `#FFF375` / `#FFF6C8` system entirely.

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--highlight-active` | `#FFF28D` | `53 100% 78%` | Active nav pill, active tab pill, detail panel bloom, selected filter pills. |
| `--highlight-selected` | `#FFF9D9` | `51 100% 93%` | Selected card background, highlighted table row, selected containers. |
| `--highlight-hover` | `#949BFF` | `236 100% 79%` | Hover state on already-highlighted elements (indigo-tinted, not yellow). |

**The rule:** `#FFDF3D` = data emphasis (KPIs, badges, Call Booked). `#FFF28D` / `#FFF9D9` = UI chrome (pills, selections, nav highlights, panel bloom gradients → use `#FFF286` as the gradient base color).

**NEVER USE:** `#FFF375`, `#FFF6C8`, `#FFF0A0`, `#FFF7CC`, or any lime/chartreuse yellow. These are banned from the codebase.

### 2.3 Surface Hierarchy (Stone-Gray System, Light Mode)

Depth is communicated through color stepping, NOT visible borders.

| Level | Token | Hex | HSL | Usage |
|-------|-------|-----|-----|-------|
| 1 (deepest) | `--background` | `#DEDEDE` | `0 0% 87%` | Page bg, sidebar, topbar — seamless base canvas. |
| 2 | `--muted` | `#EDEDED` | `0 0% 93%` | Secondary panels, input backgrounds. |
| 3 | `--card` | `#F8F8F8` | `0 0% 97%` | Interactive cards, nav items, selectable elements. |
| 4 (highest) | `--popover` | `#FFFFFF` | `0 0% 100%` | Dropdowns, popovers, topmost elevation. |

**Borders:** `--border: 0 0% 75%` (`#BFBFBF`) exists for system use but should be applied sparingly with opacity (e.g., `border-border/30`). Depth comes from the color stepping above, not from visible lines.

**Radius:** `--radius: 1.5rem` (24px) globally. All bordered elements use this rounded curvature.

### 2.4 Text Colors

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--foreground` | `#1F1F1F` | `0 0% 12%` | Primary text, headings, body copy. |
| `--muted-foreground` | `#616161` | `0 0% 38%` | Secondary text, captions, icon default color. |
| `--secondary-foreground` | `#262626` | `0 0% 15%` | Slightly muted primary text. |

### 2.5 Pipeline Stage Colors

These are fixed hex values used in Kanban columns, status badges, and pipeline charts.

| Stage | Hex | Notes |
|-------|-----|-------|
| New | `#6B7280` | gray-500 |
| Contacted | `#7A73FF` | Violet |
| Responded | `#3ACBDF` | Cyan |
| Multiple Responses | `#31D35C` | Green |
| Qualified | `#AED62E` | Lime |
| Booked | `#F7BF0E` | Gold |
| Closed | `#FFFFFF` | White |
| Lost | `#FF0000` | Red |
| DND | `#CB257D` | Magenta |

> **Source of truth:** `PIPELINE_HEX` in `client/src/lib/avatarUtils.ts`. If you update stage colors, update there — docs follow code.

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
| `--chart-1` | `243 75% 59%` | Brand Indigo |
| `--chart-2` | `160 60% 45%` | Teal |
| `--chart-3` | `44 98% 50%` | Brand Yellow |
| `--chart-4` | `280 65% 55%` | Purple |
| `--chart-5` | `0 72% 55%` | Red |

### 2.9 Dark Mode

Dark mode uses **brand-tinted navy surfaces**, never pure black.

| Token | HSL (Dark) | Notes |
|-------|-----------|-------|
| `--background` | `228 35% 10%` | Deep navy page bg. |
| `--foreground` | `220 20% 93%` | Off-white with slight warmth. |
| `--card` | `226 32% 14%` | Elevated card surface. |
| `--muted` | `226 28% 18%` | Hover states, subtle fills. |
| `--border` | `226 25% 20%` | Visible but subtle. |
| `--brand-indigo` | `243 85% 68%` | Brighter for dark bg legibility. |
| `--brand-yellow` | `44 98% 55%` | Brighter for dark bg legibility. |
| `--highlight-active` | `40 77% 35%` | Muted warm gold on dark. |
| `--highlight-selected` | `40 50% 20%` | Subtle warm card tint on dark. |
| `--sidebar-bg` | `228 40% 8%` | Sidebar background. |

---

## 3. Typography

| Property | Value |
|----------|-------|
| Body font | `Inter` (`--font-sans`) |
| Heading font | `Outfit` (`--font-heading`) |
| Headings | `font-heading font-bold tracking-tight` |
| Body | `font-sans antialiased` |

**Rules:**
- All `<h1>` through `<h6>` use `Outfit` automatically via the base layer.
- Never override heading font to Inter. Never use Outfit for body text.
- No additional font imports. Inter + Outfit only.

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
| Active tab/pill | `--highlight-active` (`#FFF28D`) | `--foreground` | ViewTabBar active, nav active pill. |
| Selected card | `--highlight-selected` (`#FFF9D9`) | `--foreground` | LeadsCardView selected, campaign selected. |
| Selected row | `--highlight-selected` (`#FFF9D9`) | `--foreground` | Highlighted table row. |
| Hover (warm) | `--highlight-hover` (`#949BFF`) | `--foreground` | Hover on already-highlighted element. |
| Hover (neutral) | `--card` (`#F8F8F8`) | `--foreground` | Default hover on cards, rows. |
| Focus ring | `--brand-indigo` (`#4F46E5`) | — | 2px outline, 2px offset. |
| Primary button | `--brand-indigo` (`#4F46E5`) | white | CTA buttons, primary actions. |
| KPI emphasis | `--brand-yellow` (`#FFDF3D`) | `--brand-deep-blue` | Call Booked badge, sparklines. |

### 5.3 Cards & Panels

- Cards float on `--card` (`#F8F8F8`) above the `--background` (`#DEDEDE`) canvas.
- **Widget cards in detail/list views:** `bg-white/60 dark:bg-white/[0.10]` (semi-transparent white, lets gradient backgrounds show through).
- **Highlighted widget cards** (Key Metrics, Financials): `bg-white dark:bg-white/[0.12]` (pure white, fully opaque for prominence).
- No visible borders on cards — depth comes from color contrast.
- Detail panel right sidebar (LeadInfoPanel): 288px wide (`w-72`).
- Full slide-over panel (LeadDetailPanel): Sheet component.
- Detail panel header bloom effect: use `--highlight-active` (`#FFF28D`), not lime yellow.

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

## 8. Glassmorphism — BANNED

**Never use glassmorphism anywhere.** No `backdrop-blur`, no semi-transparent backgrounds on functional UI (popovers, dialogs, dropdowns, panels, modals). All overlays and surfaces use solid white (`bg-white`) or solid `bg-popover`/`bg-card` with a clean `shadow-md` and `border border-border/60`. Use the `bg-white` tooltip-style pattern (§19).

---

## 9. Coding Rules

### 9.1 Mandatory

1. **Use CSS variables for all brand colors.** Never hardcode `#4F46E5` in component files — use `bg-brand-indigo`, `text-brand-indigo`, or `hsl(var(--brand-indigo))`.
2. **Use `apiFetch`** from `@/lib/apiUtils` for data requests. **Use `apiRequest`** from `queryClient.ts` for mutations.
3. **Use existing shadcn/ui components.** Don't rebuild dialogs, buttons, dropdowns, etc.
4. **Use `IconBtn`** for all icon-only buttons. Don't create custom circle buttons.
5. **Follow feature-based folder structure:** `client/src/features/{domain}/`.
6. **Respect database field names exactly:** `Conversion_Status`, `Accounts_id`, `full_name_1`, etc.
7. **Include `credentials: "include"`** on all API calls (handled by `apiFetch`/`apiRequest`).
8. **Always invoke the `frontend-design` skill** before writing any frontend code.

### 9.2 Forbidden (NEVER DO)

1. **NEVER** use `#FFF375`, `#FFF6C8`, or any lime/chartreuse yellow. These are banned.
2. **NEVER** use `#5170FF` (old periwinkle blue). Use `#4F46E5` (brand indigo) instead.
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

- No default Tailwind blue (`blue-500`/`blue-600`). Only brand indigo.
- Layered shadows over single `shadow-md`. Use `shadow-sm` + `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`.
- Paired fonts: Outfit for headings, Inter for body. Never mix.
- No gratuitous gradients. If you use a gradient, it must serve a purpose (e.g., brand-indigo → brand-deep-blue for a hero section).
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

- Brand-tinted dark surfaces, NOT pure black.
- All brand colors get slightly brighter for legibility on dark backgrounds.
- The stone-gray hierarchy inverts to navy-blue tinting.
- Agency mode (`.agency-mode`) swaps `--brand-blue` to yellow globally.
- Use CSS variables everywhere — dark mode adjustments happen automatically.

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
