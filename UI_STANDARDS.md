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
| `--brand-yellow` | `#FCB803` | `44 98% 50%` | **KPI accent.** Call Booked highlights, badges, sparklines, Kanban Booked column. Data emphasis only. |
| `--brand-indian-yellow` | `#E3A857` | `35 71% 62%` | **UI highlight base.** Warm gold from which all active/selected states are derived. |

**CRITICAL:** `--brand-indigo` (`#4F46E5`) is the primary interactive color — it replaces the old `#5170FF` periwinkle everywhere. `--primary` and `--brand-blue` CSS variables MUST both resolve to `#4F46E5`.

### 2.2 Highlight & Selection Colors

These replace the old lime-yellow `#FFF375` / `#FFF6C8` system entirely.

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--highlight-active` | `#FFE35B` | `50 100% 68%` | Active nav pill, active tab pill, detail panel bloom, selected filter pills. |
| `--highlight-selected` | `#FFF1C8` | `45 100% 89%` | Selected card background, highlighted table row, selected containers. |
| `--highlight-hover` | `#FFD938` | `50 100% 60%` | Hover state on already-highlighted elements. |
| `--brand-soft-yellow` | `#EDCC8A` | `40 73% 74%` | Warm ochre for decorative/secondary warm accents. |

**The rule:** `#FCB803` = data emphasis (KPIs, badges, Call Booked). `#FFE35B` / `#FFF1C8` = UI chrome (pills, selections, nav highlights, panel bloom gradients → use `#FFF286` as the gradient base color).

**NEVER USE:** `#FFF375`, `#FFF6C8`, `#FFF0A0`, `#FFF7CC`, or any lime/chartreuse yellow. These are banned from the codebase.

### 2.3 Surface Hierarchy (Stone-Gray System, Light Mode)

Depth is communicated through color stepping, NOT visible borders.

| Level | Token | Hex | HSL | Usage |
|-------|-------|-----|-----|-------|
| 1 (deepest) | `--background` | `#D1D1D1` | `0 0% 82%` | Page bg, sidebar, topbar — seamless base canvas. |
| 2 | `--muted` | `#E3E3E3` | `0 0% 89%` | Secondary panels, input backgrounds. |
| 3 | `--card` | `#F1F1F1` | `0 0% 94.5%` | Interactive cards, nav items, selectable elements. |
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

| Stage | Hex | Tailwind Approx |
|-------|-----|-----------------|
| New | `#6B7280` | gray-500 |
| Contacted | `#4F46E5` | indigo-600 (brand) |
| Responded | `#14B8A6` | teal-500 |
| Multiple Responses | `#22C55E` | green-500 |
| Qualified | `#84CC16` | lime-500 |
| Call Booked | `#FCB803` | brand-yellow |
| Closed | `#10B981` | emerald-500 |
| Lost | `#EF4444` | red-500 |
| DND | `#71717A` | zinc-500 |

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
| Toolbar pill height | 36px | `h-9 px-3 rounded-full` | Text pills, dropdowns. |
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
| `IconBtn` | `icon-btn.tsx` | Circle button — `h-10 w-10`, `h-4 w-4` icons. |
| `ViewTabBar` | `view-tab-bar.tsx` | Tab switcher. Active tab: `h-10 px-3 rounded-full` with `--highlight-active` bg. |
| `ToolbarPill` | `toolbar-pill.tsx` | Text pill for filter dropdowns. |
| `SearchPill` | `search-pill.tsx` | Expandable search input. |
| All shadcn/ui | `components/ui/*` | Prefer existing components. Don't rebuild. |

### 5.2 Active & Selected States

| State | Background | Text | Example Usage |
|-------|------------|------|---------------|
| Active tab/pill | `--highlight-active` (`#FFF28D`) | `--foreground` | ViewTabBar active, nav active pill. |
| Selected card | `--highlight-selected` (`#FFF9D9`) | `--foreground` | LeadsCardView selected, campaign selected. |
| Selected row | `--highlight-selected` (`#FFF9D9`) | `--foreground` | Highlighted table row. |
| Hover (warm) | `--highlight-hover` (`#EDCC8A`) | `--foreground` | Hover on already-highlighted element. |
| Hover (neutral) | `--card` (`#F1F1F1`) | `--foreground` | Default hover on cards, rows. |
| Focus ring | `--brand-indigo` (`#4F46E5`) | — | 2px outline, 2px offset. |
| Primary button | `--brand-indigo` (`#4F46E5`) | white | CTA buttons, primary actions. |
| KPI emphasis | `--brand-yellow` (`#FCB803`) | `--brand-deep-blue` | Call Booked badge, sparklines. |

### 5.3 Cards & Panels

- Cards float on `--card` (`#F1F1F1`) above the `--background` (`#D1D1D1`) canvas.
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

---

## 8. Glassmorphism

**Only for decorative accents.** Never on functional data surfaces (tables, cards, chat bubbles).

| Utility | Blur | Usage |
|---------|------|-------|
| `glass-overlay` | 12px | Frosted glass for overlay backgrounds (panels, modals). |
| `glass-divider` | 8px | Section dividers, sticky headers. |
| `glass-accent` | 16px | Decorative background panels. |
| `glass-surface` | 6px | Empty state backgrounds. |
| `glass-nav` | 14px | Mobile bottom bar, sticky sub-headers. |

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

## 14. Interaction Patterns

### 14.1 The Panel-First Rule

**No backdrop dialogs.** This is the single most important interaction rule.

When a user triggers "add", "create", or "edit", the UI must respond by revealing a panel or section within the existing layout — never by overlaying a darkened backdrop over the page.

| Trigger | Correct Pattern | Wrong Pattern |
|---------|----------------|---------------|
| Create / add a record | Right panel appears (e.g. `ContractCreatePanel`) | ❌ Modal dialog with backdrop |
| Edit a record | Right panel or inline form takes over | ❌ Modal dialog with backdrop |
| Filter / sort options | `Popover` anchored to the trigger button | ❌ Modal dialog with backdrop |
| Quick confirmation | Small `Popover` or inline confirm button | ❌ Full-screen confirm dialog |
| **Destructive confirm** | `Dialog` (the one exception — single purpose) | — |

### 14.2 Panel Anatomy

Every create/edit panel must follow this structure:

```
┌─────────────────────────┐
│ Header: title + X close │  ← shrink-0, border-b border-border/30
├─────────────────────────┤
│                         │
│  Scrollable form body   │  ← flex-1 overflow-y-auto, px-5 py-4
│                         │
├─────────────────────────┤
│ Footer: Cancel | Save   │  ← shrink-0, border-t border-border/30
└─────────────────────────┘
```

- Full height of its container (`flex flex-col h-full overflow-hidden`)
- No fixed pixel heights — grows to fill the right panel column
- Sticky footer always visible, no matter how long the form

### 14.3 Existing Panel Components

Reference these when building new panels:

| Component | Path |
|-----------|------|
| `ContractCreatePanel` | `client/src/features/billing/components/ContractCreatePanel.tsx` |
| `InvoiceCreatePanel` | `client/src/features/billing/components/InvoiceCreatePanel.tsx` |
| `ExpenseCreatePanel` | `client/src/features/billing/components/ExpenseCreatePanel.tsx` |
| `LeadInfoPanel` | `client/src/features/leads/components/LeadInfoPanel.tsx` |

---

## 15. Lead Card Standard

Applies to **both** `LeadsCardView.tsx` (list view) and `LeadsKanban.tsx` / `KanbanCardContent` (kanban cards). Both views must share the same base card style.

### 15.1 Card States (Left Panel Default)

| State | Background | Shadow |
|-------|-----------|--------|
| Default | `bg-[#F1F1F1]` | none |
| Hover | `hover:bg-[#FAFAFA]` | `shadow-[0_2px_8px_rgba(0,0,0,0.08)]` (optional) |
| Selected / Active | `bg-[#FFF9D9]` | none |
| Dragging (kanban only) | `bg-white scale-[1.02] rotate-1 opacity-95` | — |

> **DEFAULT:** All left panel cards (Leads, Campaigns, Accounts, Inbox, Calendar, Users, Billing) use `bg-[#F1F1F1]` as the unselected background. This matches the invoices/billing card standard. Kanban cards may still use `bg-white`.

### 15.1.1 Card Gaps

All left panel card lists must use **3px gaps**:
- **Vertical gap:** `gap-[3px]` on the card list container (`flex flex-col gap-[3px]`)
- **Scroll container padding:** `p-[3px]` on the scroll container — 3px in **all** directions (top, right, bottom, left)

#### Virtualized Lists

For lists using `@tanstack/react-virtual`, CSS `gap-[3px]` does not work (items are absolutely positioned). Instead, use the virtualizer's `gap` option:

```typescript
useVirtualizer({
  // ...
  gap: 3,
})
```

### 15.2 Card Anatomy

- **Outer wrapper:** `group/card relative mx-0.5 my-0.5 rounded-xl transition-all duration-150`
- **Content padding:** `px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5`
- **Row 1:** Avatar → Name + status dot + status label → Score ring + last activity (right-aligned)
  - Avatar: `h-10 w-10 rounded-full`, colors from `getStatusAvatarColor(status)` — must match `PIPELINE_HEX` palette (same in list and kanban)
  - Name: `text-[16px] font-semibold font-heading truncate text-foreground` (see §25)
  - Status: `h-1.5 w-1.5 rounded-full` dot (color from `PIPELINE_HEX`) + `text-[10px] text-muted-foreground/65`
  - Score ring: 34px SVG (`LIST_RING_SIZE = 34`, `LIST_RING_STROKE = 2.5`), stroke color from `PIPELINE_HEX[status]`
  - Last activity: `text-[10px] tabular-nums text-muted-foreground/60`
- **Hover expansion** (collapsed by default, `group-hover/card:max-h-36 group-hover/card:opacity-100`):
  - Last message: `text-[11px] text-muted-foreground/65 truncate`
  - Tags: `px-2 py-0.5 rounded-full text-[9px] bg-black/[0.06] text-foreground/55`
  - Phone / email: `text-[10px] text-muted-foreground/70`

### 15.3 Avatar & Score Color Palette

Both avatar background/text and score ring stroke color are determined by `PIPELINE_HEX` and `getStatusAvatarColor()`. These functions are the single source of truth — never hardcode stage colors in card components.

---

## 16. Left Panel Standard (All Split-Pane Pages)

Applies to: Leads, Accounts, Campaigns, Inbox/Conversations, Users, Billing, Calendar left panel.

### 16.1 Container

```
w-[340px] flex-shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden
```

### 16.2 Header Row

```
px-3.5 pt-5 pb-1  flex items-center justify-between
```
- **Left:** Page title — `text-2xl font-semibold font-heading text-foreground leading-tight`
- **Right:** Record count — `text-[12px] font-medium text-muted-foreground tabular-nums` (plain number, no circle, no border).

### 16.3 Controls Row

```
px-3 pt-1.5 pb-3  flex items-center gap-1.5
```

**Left side:** `ViewTabBar` component with page-specific tabs:
- Most pages: **List | Table**
- Calendar left panel: **Monthly | Weekly | Daily** (no Yearly tab)

**Right side:** Three controls using `IconBtn` (always — never raw `<button>` with hardcoded classes):

```
[+ IconBtn]  [Search IconBtn]  [⚙ Settings IconBtn]
```

**Settings `IconBtn`** opens a single dropdown/popover containing all of:
- Group by
- Sort by
- Status filter
- Tag / type filters
- Account / Campaign scoping (agency users only — NOT as visible pills; inside the dropdown only)

### 16.4 Rules

1. Always use `IconBtn` for +, Search, and Settings — never inline `<button>` with hardcoded classes.
2. `IconBtn active` prop = `true` when a non-default value is active.
3. Right-side gap is always `gap-1.5` (not `gap-1`).
4. Count is in the **header row** as plain `text-[12px]` text — never a circle, never in the controls row.
5. Account/Campaign filter pills visible below the header are **banned** — all scoping lives in the Settings dropdown.

### 16.5 Known Inconsistencies to Fix

| File | Issue |
|------|-------|
| `CampaignListView.tsx` | Count is `h-5 px-1.5` pill — must become plain text above Settings |
| `UsersListView.tsx` | Header `pt-7` → `pt-5`; count color muted |
| `AccountListView.tsx` | Inline `<button>` for Search/Settings — must use `IconBtn`; gap `gap-1` → `gap-1.5` |
| `CampaignListView.tsx` | Same inline button issue as Accounts |
| `InboxPanel.tsx` | Settings button uses `bg-foreground` fill when active — replace with `IconBtn active` prop |

---

## 17. Table Toolbar Standard

Reference implementation: `client/src/features/billing/components/BillingListView.tsx` table mode (lines 669–1442).

Applies to **all** table views: Leads, Accounts, Campaigns, Users, Tags, Automation Logs, Conversations, etc.

### 17.1 Button Base Classes

Define these constants at the top of every table component:

```ts
const tbBase    = "h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
const tbDefault = "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-card";
const tbActive  = "bg-card border border-black/[0.125] text-foreground";
```

### 17.2 Responsive Collapse

Use a `ResizeObserver` on a `toolbarRef`:

```ts
const [isNarrow, setIsNarrow] = useState(false);
const toolbarRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = toolbarRef.current;
  if (!el) return;
  const ro = new ResizeObserver(([e]) => setIsNarrow(e.contentRect.width < 920));
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

- **Wide (≥920px):** labeled pill buttons — `cn(tbBase, tbDefault)` with icon + text
- **Narrow (<920px):** icon-only circles — `icon-circle-lg icon-circle-base`
- **Search:** inline input when wide; `Popover` when narrow

### 17.3 Toolbar Layout

```
[ViewTabBar]  [│]  [+ New]  [Search]  [Sort]  [Filter]  [Group]  [Fields]  ··· [ml-auto → selection actions]
```

The separator `[│]` is `<div className="w-px h-5 bg-border/40 mx-1 shrink-0" />`.

### 17.4 Row Selection Actions

- Appear **only** when `selectedIds.size > 0`, floated right via `ml-auto` (use `<div className="flex-1 min-w-0" />` spacer)
- Appear **inline** in the toolbar row — NEVER as a separate bar below/above the toolbar
- InlineTable components must NOT render their own selection bars — all selection UI lives in the Page/orchestrator toolbar
- Order: action buttons (Change Stage, Duplicate, Delete) → count badge with X dismiss
- Count badge: `cn(tbBase, tbDefault, "cursor-default")` with `{count} <X>` inside
- **Edit button:** only in tables that do NOT support inline cell editing
- **Delete:** add `hover:text-red-600`
- Single-select-only actions: `disabled={selectedIds.size !== 1}` + `disabled:opacity-40 disabled:pointer-events-none`

### 17.5 Search Bar (Always Visible)

All table toolbars use a permanently visible search input — never a toggle/popup:

```tsx
<div className="h-9 flex items-center gap-1.5 rounded-full border border-border/30 bg-card px-3 shrink-0">
  <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
  <input
    className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
    placeholder="Search…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
  {search && (
    <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
      <X className="h-3 w-3" />
    </button>
  )}
</div>
```

Reference implementation: `AccountsPage.tsx` (lines 371–386).

### 17.6 Active Button Style (Outline Only)

Active/selected `IconBtn` and toolbar circles use **outline only** — transparent background with brand-indigo border and text:

```css
icon-circle-selected {
  background-color: transparent;
  border-color: hsl(var(--brand-indigo));
  color: hsl(var(--brand-indigo));
}
```

Never use filled indigo background for active toggle buttons.

---

## 18. Calendar Layout Standard

### 18.1 Left Panel

Inherits the §16 structure. Specific values:

- **Title:** "My Calendar" — `text-2xl font-semibold font-heading text-foreground leading-tight` (must match all other page titles)
- **ViewTabBar tabs:** Monthly | Weekly | Daily (3 tabs — **Yearly is removed**)
- **Tab active color:** `bg-[var(--highlight-active)] text-foreground` (warm yellow, **NOT** `bg-brand-indigo`)
- **Count:** plain appointment count above Settings `IconBtn` (§16.3 pattern)
- **Settings dropdown** contains: Group by, Sort by, Filter by status, Account filter (agency), Campaign filter
- **Account/Campaign filter pills** (previously below the header): **removed** — moved into Settings
- **Card backgrounds:** `bg-[#F1F1F1]` (matches §15.1 standard), with `gap-[3px]` between cards

### 18.2 Main Calendar Toolbar (right panel top)

Only two elements — view tabs are **not** here (moved to left panel):

```
[← Prev]  [date label]  [Next →]    [Today]
```

| Element | Classes |
|---------|---------|
| Prev / Next | `h-10 w-10 rounded-full border border-black/25` |
| Date label | `font-semibold text-[12px] text-center tabular-nums min-w-[140px]` |
| Today | `h-10 px-3 rounded-full border border-black/25 text-[12px] font-medium` |

---

## §19 — Modal & Overlay Policy

**BANNED: Glass/blur overlays** — Never use `glass-overlay`, `backdrop-blur`, `glass-surface`, or any glassmorphism CSS class on dialog overlays or modal backgrounds. The `DialogOverlay` component must use a plain `bg-black/50` backdrop only — no blur, no glass effects.

**BANNED: Dark blurry overlay modals for editing** — Never use `Dialog`/`Modal` components with dark overlays for in-context pickers, dropdowns, or selection UIs. The only exception is confirmation dialogs (delete, destructive actions).

**Prefer inline/slide-over editing** — For editing items (prompts, tags, user profiles), prefer inline editing or slide-over panels over modal dialogs with dark overlays.

**USE INSTEAD: Tooltip-style floating panels**
- Appearance: `bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] border border-border/30`
- Sizing: `min-w-[220px] max-w-[280px]` — never full-screen, never darkens background
- Positioning: `absolute z-50` anchored to the triggering button, `top-full mt-1` or `bottom-full mb-1` as space allows
- Dismiss: click outside (mousedown listener), Escape key
- Content: small search input at top + scrollable list `max-h-[280px] overflow-y-auto p-1.5`
- Row style: `px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-[12px] cursor-pointer flex items-center gap-2`
- Reference implementation: notification tooltip in Topbar.tsx

---

## §20 — Settings Page Layout

Settings uses the standard left-panel layout with section-based navigation:

- **Left nav:** `w-[200px] md:w-[240px]` with `border-r border-border/30`
- **Title:** Inside the left nav area, `px-3.5 pt-5 pb-3`, styled `text-2xl font-semibold font-heading text-foreground leading-tight` — aligned with menu titles
- **Sections:** Profile, Security, Notifications, Dashboard
- **Active section:** `bg-[var(--highlight-active)] text-foreground font-semibold` with `h-10 px-3 rounded-xl`

## §21 — Campaign Detail View

### 21.1 Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Gradient header                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Row 1: [Add][Search][Sort][Filter][Group]  …ml-auto… │   │
│  │         [Pause][Refresh][Delete]                      │   │
│  │ Row 2: [Avatar 72px]  Campaign Name + Badges         │   │
│  └──────────────────────────────────────────────────────┘   │
│  Tab row: [Summary] [1D 7D 1M All Custom] [Config] [Tags]  │
│  ────────────────────────────────────────────────────────    │
│  Body (scrollable, 3-col grid for Summary)                  │
└─────────────────────────────────────────────────────────────┘
```

### 21.2 Toolbar Row (Row 1)

The detail panel toolbar has **two groups on one line**:

- **LEFT:** Campaign-list controls — Add, Search (expanding input), Sort, Filter, Group. These are pill buttons (`h-9 px-4 rounded-full text-[12px] border border-black/[0.125]`). Only rendered when the detail view is inside a list context (props provided).
- **RIGHT (ml-auto):** Entity actions — Pause/Activate, Refresh, Delete. Same pill style.

When editing configurations: Save + Cancel replace the left-side controls.

### 21.3 Tab Row

Tabs: **Summary** | **Configurations** | **Tags** (agency-only).

- Tab height: **`h-9`** (36px) — exception to the global 40px rule in §4.1.
- Active: `bg-foreground text-background` (filled black/dark).
- Inactive: `border border-black/[0.125] text-foreground/60 hover:text-foreground`.
- DateRangeFilter pill bar appears **inline** after Summary tab when Summary is active.

### 21.4 Date Range Pill Bar

The date range filter (1D, 7D, 1M, All, Custom) renders as a **single unified pill bar** — NOT separate buttons:

```tsx
<div className="inline-flex items-center h-9 rounded-full border border-black/[0.125] bg-muted/30 p-0.5 gap-0">
  {/* Each option inside: */}
  <button className="px-3 h-full rounded-full text-[11px] font-semibold ...">1D</button>
  ...
</div>
```

- **Active option:** `bg-white text-foreground shadow-sm` — white "ceiling" highlight.
- **Inactive option:** `text-foreground/50 hover:text-foreground` — no background.
- **Custom:** Opens a calendar popover when clicked.

Component: `DateRangeFilter` in `@/components/crm/DateRangeFilter.tsx`.

### 21.5 Summary Tab — 3-Column Grid

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| Campaign Info/KPIs | Up Next (Agenda) | Pipeline Funnel |
| Financials + ROI Trend | Activity Feed | Conversions Doughnut |

- **Pipeline Funnel / Conversions:** Separate widgets (no toggle).
- **Activity Feed:** Uses `ActivityFeed` component.
- **Activity Feed in left panel:** REMOVED — activity feed is in the detail view only.

### 21.6 Tags Tab

Tags are NOT a standalone page — they live inside the Campaign detail panel as a tab.

- Component: `CampaignTagsSection` in `features/campaigns/components/CampaignTagsSection.tsx`.
- Hook: `useCampaignTags(campaignId, campaignName)` — filters tags by `campaign_id`.
- **Default group: category** — tags are grouped by category on first load.
- Toolbar: `[Search (always visible)] [+Add] [Sorting▼] [Filter▼] [Group▼]  …ml-auto… [count or selection]`.
- Uses compact `h-9` pills (NOT the full `h-10` table toolbar from §17).
- Selection bar: `"N selected" [X clear] [Delete]` — appears via `ml-auto` when tags are selected.
- Columns: reuses `TAG_TABLE_COLUMNS` from `@/features/tags/types` but hides Account and Campaign columns (redundant in campaign context).

### 21.7 Default Tags on Campaign Creation

When a new campaign is created, tags are **automatically cloned** from the existing campaign with the most tags. This ensures every campaign starts with a consistent set of tags. Implementation is in `CampaignsPage.tsx` → `handleAddCampaign`.

---

## §22 — Popups, Overlays & Field Styling

### Popup / Dialog Overlays
- **NEVER** darken or blur the background behind dialogs and popups
- Dialog overlay: use a very light shade of gray (e.g., `bg-black/8` or `bg-gray-200/40`), NOT `bg-black/50` or any heavy dark overlay
- No `backdrop-blur`, no `glass-overlay` on dialog backdrops
- The goal: clean, airy, non-intrusive overlays that don't obscure the page

### Form Field Styling
- All fillable fields (inputs, textareas, selects) must use `bg-input-bg` (CSS variable: `--input-bg`, light mode: `#F7F7F7`, dark mode: elevated surface)
- **No visible outlines** on form fields — use `border-border/40` for subtle definition, or `border-transparent`
- Focus state: use a subtle ring (`ring-brand-indigo/20`) — no heavy outlines
- Clean, minimal aesthetic — fields should blend into the surface, not stand out with heavy borders

### General Clean Aesthetic Rules
- No heavy borders or outlines on interactive elements
- Prefer subtle color stepping and shadows over visible borders
- Depth through background color differences, not border lines
- All UI should feel light, clean, and uncluttered

---

## §23 — Avatar / Entity Circle Standard

All entity avatar circles must use `EntityAvatar` from `@/components/ui/entity-avatar.tsx` and color functions from `@/lib/avatarUtils.ts`.

### Display Priority

1. **Photo** — If `photoUrl` exists (`logo_url`, `avatar_url`, etc.), show the photo
2. **Initials** — Fall back to `getInitials(name)` with entity-appropriate status/role colors

### Color Sources (from `@/lib/avatarUtils.ts`)

- **Leads**: `getLeadStatusAvatarColor(status)` — used across Leads page, Calendar, and Conversations
- **Accounts**: `getAccountAvatarColor(status)` — Active/Trial/Inactive/Suspended
- **Campaigns**: `getCampaignAvatarColor(status)` — Active/Paused/Draft/etc.
- **Users**: `getUserRoleAvatarColor(role)` — Admin/Operator/Manager/Agent/Viewer
- **Prompts**: `getPromptAvatarColor(status)` — Active/Archived

### Sizes

- **Standard**: 36px (`size={36}`, default) — list cards, table cells
- **Detail panel**: 34px (`size={34}`) — right-side detail panel header
- **Large**: 72px (`size={72}`) — profile headers (Settings, Users)
- **Compact**: 28px (`size={28}`) — inline mentions, compact lists

### Rules

- Never define local `getInitials()` or status color functions — always import from `@/lib/avatarUtils.ts`
- Lead status colors MUST be identical across Leads, Calendar, and Conversations pages
- Photo always takes priority over initials when the field exists and is non-empty

---

## §24 — Group Headers in Left Panel Lists

All left panel card lists (Leads, Campaigns, Accounts, Billing, Prompts, Users, Conversations, Calendar) that support grouping must use this standard for group header rendering.

### 24.1 Layout — Centered with Decorative Lines

```
——— Last 3 Months – 17 ———
[line]  [label]  [dash]  [count]  [line]
```

The label and count are centered, separated by a gray en-dash, with decorative `h-px` lines extending to each edge.

### 24.2 Exact Markup

```tsx
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">–</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}
```

### 24.3 Token Reference

| Element | Classes |
|---|---|
| Outer wrapper | `sticky top-0 z-20 bg-muted px-3 pt-3 pb-3` |
| Inner flex | `flex items-center gap-[10px]` |
| Decorative lines | `flex-1 h-px bg-foreground/15` |
| Label | `text-[12px] font-bold text-foreground tracking-wide shrink-0` |
| En-dash separator | `text-foreground/20 shrink-0` (literal `–` character) |
| Count | `text-[12px] font-medium text-muted-foreground tabular-nums shrink-0` |

### 24.4 Rules

- **Text format:** Title case label, en-dash, plain number — `"Last 3 Months – 17"` (not `"LAST 3 MONTHS 2"`, not `"17 leads"`)
- **No uppercase transform** — `uppercase` / `text-transform` is banned on group headers
- **Padding:** `pt-3 pb-3 px-3` — generous vertical padding for visual separation from cards
- **Background:** `bg-muted` — opaque, matches left panel background, covers cards scrolling underneath
- **Decorative lines:** `flex-1 h-px bg-foreground/15` on both sides — no `mx-[8px]` margin, lines extend edge to edge within `px-3`

### 24.5 Sticky Scroll Behavior

- `sticky top-0 z-20` — header stays pinned while its group's cards are visible
- Next group's header pushes the previous one away naturally
- `bg-muted` **must** be opaque — no transparency or blur
- Group headers must be **direct flex children** of the scroll container (no extra wrapper `<div>`s) for `position: sticky` to work

### 24.6 Implementation Notes

- Group headers are rendered as part of the `VirtualListItem` union type with `kind: "header"`
- The scroll container must have `overflow-y-auto` with the header as a direct flex child
- This pattern applies to **all** left panel card lists across the app — copy the exact markup above

---

## §25 — Entity Name & Widget Title Typography (16px Standard)

**One size for all entity names and widget titles: `text-[16px] font-semibold font-heading`.**

### 25.1 Left Panel Card Names

Every entity name displayed in a left panel card (list view) uses:

```
text-[16px] font-semibold font-heading leading-tight truncate text-foreground
```

Applies to: Leads, Accounts, Campaigns, Users, Prompts, Calendar appointments, Conversations/Inbox, and Kanban cards (pipeline view).

### 25.2 Widget Titles (Right Panel / Detail View)

Every widget heading in a detail/right panel uses:

```
text-[16px] font-semibold font-heading text-foreground
```

Applies to: Contact, Lead Score, Chat, Team, Notes, Activity, Overview, Campaigns & Contracts, Users, AI & Schedule, Twilio — all detail view widgets across Leads, Accounts, and other pages.

### 25.3 Rule

Never use `text-sm`, `text-[13px]`, `text-[14px]`, `text-[15px]`, `text-[17px]`, or `text-[19px]` for card names or widget titles. Always use `text-[16px]`.

---

## §26 — ViewTabBar Rigid Positioning Standard

The ViewTabBar (view-switcher circles) must sit at the **right edge** of the left panel, and that exact pixel position must be maintained when switching between views (List → Table → Kanban, etc.).

### 26.1 The Fixed-Width Wrapper Pattern

Wrap the page title + `ViewTabBar` in a fixed-width container with `justify-between`:

```tsx
<div className="flex items-center justify-between w-[309px] shrink-0">
  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
    My Leads
  </h2>
  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={...} />
</div>
```

### 26.2 Width Derivation

The `309px` value comes from the left panel inner content width:

```
340px (panel width)  −  17px (pl-[17px])  −  14px (pr-3.5)  =  309px
```

This ensures the rightmost circle aligns flush with the panel's right content edge.

### 26.3 Across Views

Every view within a page (List, Table, Kanban) must use the **same** 309px wrapper. In full-width views (Table, Pipeline), the wrapper is followed by a separator + toolbar buttons:

```
[Title ··· ◉ ◉ ◉]  |  [+Add] [Search] [Sort] [Filter] …
 ←── 309px ──→     sep    toolbar pills
```

### 26.4 Pages With Fewer Tabs

Most pages have only 2 view tabs (List | Table). The same `w-[309px] justify-between` wrapper is used — the gap between the title and the first circle is simply wider, which is the intended behavior.

| Tab Count | Visual Result |
|-----------|--------------|
| 3 tabs (Leads) | Title + compact gap + 3 circles |
| 2 tabs (most pages) | Title + wider gap + 2 circles |

### 26.5 Rules

1. **Always** use `w-[309px] shrink-0` with `justify-between` — never `gap-*` or `ml-auto` for ViewTabBar positioning.
2. The wrapper must appear in the **same row** as toolbar buttons (Table/Pipeline views) or in a dedicated header row (List view).
3. The rightmost ViewTabBar circle must visually align with the right content edge of the 340px left panel.
4. When adding ViewTabBar to a new page, copy this pattern exactly — do not invent new positioning approaches.

---

## §27 — Table Group Header Standard

Applies to **all** inline table views: Leads, Campaigns, Accounts, Users, Billing.

### 27.1 Structure — 3-Cell `<tr>`

Every group header row consists of exactly 3 `<td>` cells:

| Cell | Width | Sticky | Content |
|------|-------|--------|---------|
| Checkbox | 36px | `sticky left-0 z-30` | Group select checkbox |
| Label | auto | `sticky left-[36px] z-30` | `[▼ arrow] [Group Name] [count]` |
| Spacer | `colSpan={remaining}` | none | Empty, carries background color |

### 27.2 Row Styling

```tsx
<tr className="cursor-pointer select-none h-[44px]" onClick={toggleCollapse}>
```

- All 3 cells share the same background: `style={{ backgroundColor: \`${hexColor}12\` }}`
- `hexColor` comes from `PIPELINE_HEX[groupLabel]` or equivalent status color map

### 27.3 Checkbox Cell

```tsx
<td className="sticky left-0 z-30 w-[36px] px-0" style={{ backgroundColor: `${hexColor}12` }}>
  <div className="flex items-center justify-center h-full">
    <div className={cn(
      "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
      isGroupFullySelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
    )} onClick={(e) => { e.stopPropagation(); handleGroupCheckbox(label); }}>
      {isGroupFullySelected && <Check className="h-2.5 w-2.5 text-white" />}
    </div>
  </div>
</td>
```

Must align horizontally with data row checkboxes (also in a 36px sticky-left cell).

### 27.4 Label Cell

```tsx
<td className="sticky left-[36px] z-30 pl-1 pr-3" style={{ backgroundColor: `${hexColor}12` }}>
  <div className="flex items-center gap-2">
    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
    <span className="text-[11px] font-bold text-foreground/70">{label}</span>
    <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">{count}</span>
  </div>
</td>
```

- Arrow is **next to** the group name (left side), NOT at the far right (`ml-auto`)
- Label is **title case** (e.g., "Call Booked"), NOT `uppercase tracking-widest`
- No color dot — the tinted row background already conveys the group color

### 27.5 Data Row Checkbox Cell

Every data row must have a separate checkbox `<td>` — NOT embedded inside the name cell:

```tsx
<td className="sticky left-0 z-10 w-[36px] px-0" style bg={...}>
  <div className="flex items-center justify-center h-full">
    <div className={cn("h-4 w-4 rounded border ...", isSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40")} onClick={toggle}>
      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
    </div>
  </div>
</td>
```

The first visible data column (Name) then starts at `sticky left-[36px]`.

### 27.6 Header Row (`<thead>`)

The `<thead>` checkbox `<th>` must also be 36px sticky left-0, matching the data row checkbox column.

### 27.7 Rules

1. **Always** 3 cells for group headers — never a single `colSpan` td
2. **Always** separate checkbox `<td>` for data rows — never embedded in name cell
3. **Arrow near name** — never `ml-auto` to push it right
4. **Title case labels** — never `uppercase tracking-widest`
5. **Colored background** on all group header cells — never plain `bg-muted`
6. **Selection bars** inside InlineTable components are banned — use Page toolbar (§17.4)

---

## Changelog

- **2026-02-25:** Initial creation. Consolidated from CLAUDE.md, frontend.md, DESIGN_TOKENS.md, BUTTONS.md. Color system overhauled: primary shifted from `#5170FF` (periwinkle) → `#4F46E5` (indigo-600). Highlight system shifted from `#FFF375` (lime) → Indian Yellow `#E3A857` derived tints. `#FCB803` reserved for KPI/data emphasis only.
- **2026-02-26:** §9.2 rule #11 added: backdrop/overlay dialogs are banned. §14 Interaction Patterns added: panel-first rule, panel anatomy, existing panel reference table.
- **2026-02-26:** §15–§18 added: Lead Card Standard (white bg, shared kanban+list style), Left Panel Standard (count above Settings, `IconBtn` everywhere, no pills), Table Toolbar Standard (BillingListView pattern, 920px collapse), Calendar Layout Standard (3-tab left panel, date-nav-only main toolbar).
- **2026-02-27:** §15.1 updated: card default bg changed from `bg-white` to `bg-[#F1F1F1]` (stone gray) with 3px gaps. §18.1 updated: Calendar tab colors changed from indigo to yellow. §19 updated: glass overlays explicitly banned. §20 added: Settings page layout with Expenses/Contracts as sub-sections. §21 added: Campaign detail widget layout with Activity Feed and Funnel/Conversions toggle.
- **2026-02-27:** §20 updated: removed Expenses, Contracts, and Appearance from Settings sections. §22 added: Popups, Overlays & Field Styling — light overlays, no outlines on form fields, clean aesthetic rules.
- **2026-02-27:** §15.1.1 updated: added Virtualized Lists note for `@tanstack/react-virtual` gap handling. §23 added: Avatar / Entity Circle Standard — `EntityAvatar` component, `avatarUtils.ts` color functions, sizes, and rules.
- **2026-02-27:** §24 added: Group Headers in Left Panel Lists — centered layout with decorative lines, `text-[12px]` label + gray en-dash + count, `bg-muted` sticky headers. Applied to all 8 list views (Leads, Campaigns, Accounts, Billing, Prompts, Users, Calendar, Conversations).
- **2026-02-27:** §25 added: Entity Name & Widget Title Typography — unified `text-[16px] font-semibold font-heading` for all left panel card names and right panel widget titles. Updated §15.2. Applied to 11 files across Leads, Accounts, Campaigns, Users, Prompts, Calendar, Conversations, Kanban.
- **2026-02-28:** §27 added: Table Group Header Standard — 3-cell structure (checkbox, label, spacer), colored backgrounds, arrow near name, title case labels. §17.4 updated: selection actions must be inline in toolbar only. §17.5 added: always-visible search bar. §17.6 added: active button outline-only style. `icon-circle-selected` CSS changed from filled to outline.
- **2026-02-27:** §26 added: ViewTabBar Rigid Positioning Standard — fixed `w-[309px] justify-between` wrapper for title + ViewTabBar circles, ensuring the rightmost circle sits flush with the panel's right content edge. Same position maintained across all views (List, Table, Kanban). Pages with 2 tabs get a naturally wider gap.
- **2026-02-28:** §21 rewritten: Campaign Detail View — full structure documented (toolbar layout, tab row, date range pill bar, summary grid, tags tab, default tags on creation). §17.1 fixed: `h-10` → `h-9` to match §4.1 standard. §17.5 fixed: search bar height `h-10` → `h-9`.
