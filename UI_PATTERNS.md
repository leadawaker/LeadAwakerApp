# Lead Awaker — UI Patterns & Implementation Reference

> **This file contains detailed implementation patterns, exact markup, and code-level references.**
> For rules, tokens, bans, and design decisions, see [`UI_STANDARDS.md`](UI_STANDARDS.md).
> Both files are canonical — `UI_STANDARDS.md` for "what" and "why", this file for "how".

---

## §14 — Interaction Patterns

### 14.1 The Panel-First Rule

**No backdrop dialogs.** When a user triggers "add", "create", or "edit", reveal a panel within the existing layout — never overlay a darkened backdrop.

| Trigger | Correct Pattern | Wrong Pattern |
|---------|----------------|---------------|
| Create / add a record | Right panel appears (e.g. `ContractCreatePanel`) | Modal dialog with backdrop |
| Edit a record | Right panel or inline form takes over | Modal dialog with backdrop |
| Filter / sort options | `Popover` anchored to the trigger button | Modal dialog with backdrop |
| Quick confirmation | Small `Popover` or inline confirm (§30) | Full-screen confirm dialog |
| **Destructive confirm** | `Dialog` (the one exception — single purpose) | — |

### 14.2 Panel Anatomy

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

- Full height: `flex flex-col h-full overflow-hidden`
- No fixed pixel heights — grows to fill the right panel column
- Sticky footer always visible

### 14.3 Reference Panel Components

| Component | Path |
|-----------|------|
| `ContractCreatePanel` | `features/billing/components/ContractCreatePanel.tsx` |
| `InvoiceCreatePanel` | `features/billing/components/InvoiceCreatePanel.tsx` |
| `ExpenseCreatePanel` | `features/billing/components/ExpenseCreatePanel.tsx` |
| `LeadInfoPanel` | `features/leads/components/LeadInfoPanel.tsx` |

---

## §15 — Lead Card Standard

Applies to **both** `LeadsCardView.tsx` (list) and `LeadsKanban.tsx` / `KanbanCardContent` (kanban).

### 15.1 Card States

| State | Background | Shadow |
|-------|-----------|--------|
| Default | `bg-card` (`#F8F8F8`) | none |
| Hover | `hover:bg-card-hover` (`#FFFFFF`) | `shadow-[0_2px_8px_rgba(0,0,0,0.08)]` (optional) |
| Selected / Active | `bg-[#FFF9D9]` | none |
| Dragging (kanban) | `bg-white scale-[1.02] rotate-1 opacity-95` | — |

> All left panel cards (Leads, Campaigns, Accounts, Inbox, Calendar, Users, Billing) use `bg-card`. Use the CSS variable, not hardcoded hex.

### 15.1.1 Card Gaps

- **Vertical gap:** `gap-[3px]` on `flex flex-col` container
- **Scroll container padding:** `p-[3px]` (all directions)
- **Virtualized lists:** use `gap: 3` on virtualizer config (CSS gap doesn't work with absolute positioning)

### 15.2 Card Anatomy

- **Outer wrapper:** `group/card relative mx-0.5 my-0.5 rounded-xl transition-all duration-150`
- **Content padding:** `px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5`
- **Row 1:** Avatar → Name + status dot + label → Score ring + last activity (right)
- **Hover expansion:** collapsed by default, `group-hover/card:max-h-36 group-hover/card:opacity-100`

### 15.3 Tag / Label Pill Colors (All Left Panel Cards)

Tag and label pills on left panel cards use **transparent overlays** — never opaque Tailwind bg classes. This ensures they sit correctly above the card's selection highlight.

```tsx
// Unselected card
style={{ backgroundColor: "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }}

// Selected / active card
style={{ backgroundColor: "rgba(255,255,255,0.75)", color: "rgba(0,0,0,0.45)" }}
```

**Rules:**
- Always `style={{ backgroundColor: ... }}` — never `bg-black/[...]` or Tailwind palette classes for tag pills
- Unselected baseline: `rgba(0,0,0,0.09)` — do NOT use `0.06` or lower (too faint)
- Selected baseline: `rgba(255,255,255,0.75)` — near-white so tags read above `--highlight-selected` (`#FFF9D9`)
- Text is always `rgba(0,0,0,0.45)` regardless of card state
- Applies to: Leads (list + kanban), Conversations inbox threads, Accounts card campaign chips, and any future left panel card

**Implementation pattern:**
```tsx
const isActive = selectedId === item.id;  // or equivalent active/selected state

<span
  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
  style={{
    backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)",
    color: "rgba(0,0,0,0.45)",
  }}
>
  {tag.name}
</span>
```

### 15.4 Avatar & Score Colors

Both avatar bg/text and score ring stroke come from `PIPELINE_HEX` and `getStatusAvatarColor()` — never hardcode stage colors.

---

## §16 — Left Panel Standard (All Split-Pane Pages)

Applies to: Leads, Accounts, Campaigns, Inbox/Conversations, Users, Billing, Calendar.

### 16.1 Container

```
w-[340px] flex-shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden
```

### 16.2 Header Row

```
px-3.5 pt-5 pb-1  flex items-center justify-between
```
- **Left:** Page title — `text-2xl font-semibold font-heading text-foreground leading-tight`
- **Right:** Record count — `text-[12px] font-medium text-muted-foreground tabular-nums` (plain number, no circle)

### 16.3 Controls Row

```
px-3 pt-1.5 pb-3  flex items-center gap-1.5
```
- **Left:** `ViewTabBar` (List|Table, or Monthly|Weekly|Daily for Calendar)
- **Right:** `[+ IconBtn] [Search IconBtn] [Settings IconBtn]` — all `IconBtn`, `gap-1.5`
- **Settings dropdown** contains: Group by, Sort by, Status filter, Tag filters, Account/Campaign scoping (agency only)

### 16.4 Rules

1. Always use `IconBtn` — never inline `<button>` with hardcoded classes
2. Count is in the header row as plain text — never a circle, never in controls row
3. Account/Campaign filter pills are **banned** — all scoping lives in Settings dropdown

---

## §17 — Table Toolbar Standard

> All toolbar buttons use the **expand-on-hover** pattern (§28). `ToolbarPill` is deprecated.

### 17.1 Button Constants

```ts
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
```

### 17.2 Toolbar Layout

```
[ViewTabBar]  [│]  [+ New]  [SearchPill]  [Sort]  [Filter]  [Group]  [Fields]  ··· [ml-auto → selection actions]
```

Separator: `<div className="w-px h-5 bg-border/40 mx-1 shrink-0" />`.

### 17.3 Row Selection Actions

- Appear only when `selectedIds.size > 0`, floated right via `ml-auto`
- Appear inline in the toolbar — NEVER as a separate bar
- Order: action buttons → count badge with X dismiss
- **Delete:** `border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600`

### 17.4 Search (SearchPill)

```tsx
<SearchPill value={search} onChange={setSearch} open={true} onOpenChange={() => {}} placeholder="Search…" />
```

---

## §18 — Calendar Layout Standard

### 18.1 Left Panel

Inherits §16. Specific values:
- **Title:** "My Calendar"
- **ViewTabBar:** Monthly | Weekly | Daily (no Yearly)
- **Tab active color:** `bg-[var(--highlight-active)]` (yellow, NOT indigo)
- **Card backgrounds:** `bg-card`, `gap-[3px]`

### 18.2 Main Calendar Toolbar

```
[← Prev]  [date label]  [Next →]    [Today]
```

| Element | Classes |
|---------|---------|
| Prev / Next | `h-10 w-10 rounded-full border border-black/25` |
| Date label | `font-semibold text-[12px] text-center tabular-nums min-w-[140px]` |
| Today | `h-10 px-3 rounded-full border border-black/25 text-[12px] font-medium` |

---

## §20 — Settings Page Layout

- **Left nav:** `w-[200px] md:w-[240px]` with `border-r border-border/30`
- **Title:** `px-3.5 pt-5 pb-3`, `text-2xl font-semibold font-heading text-foreground leading-tight`
- **Sections:** Profile, Security, Notifications, Dashboard
- **Active:** `bg-[var(--highlight-active)] text-foreground font-semibold` with `h-10 px-3 rounded-xl`

---

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
│  Body (scrollable, 3-col grid for Summary)                  │
└─────────────────────────────────────────────────────────────┘
```

### 21.2 Toolbar

- **LEFT:** Add, SearchPill, Sort, Filter, Group (expand-on-hover §28)
- **RIGHT (`ml-auto`):** Pause/Activate, Refresh, Delete

### 21.3 Tab Row

Tabs: **Summary** | **Configurations** | **Tags** (agency-only). Height `h-9`.
- Active: `bg-foreground text-background`
- Inactive: `border border-black/[0.125] text-foreground/60 hover:text-foreground`

### 21.4 Date Range Pill Bar

```tsx
<div className="inline-flex items-center h-9 rounded-full border border-black/[0.125] bg-muted/30 p-0.5 gap-0">
  <button className="px-3 h-full rounded-full text-[11px] font-semibold ...">1D</button>
</div>
```
- Active: `bg-white text-foreground shadow-sm`
- Inactive: `text-foreground/50 hover:text-foreground`

### 21.5 Summary Grid

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| Campaign Info/KPIs | Up Next (Agenda) | Pipeline Funnel |
| Financials + ROI Trend | Activity Feed | Conversions Doughnut |

### 21.6 Tags Tab

- Component: `CampaignTagsSection` + `useCampaignTags(campaignId, campaignName)`
- Default group: category
- Toolbar: `[Search] [+Add] [Sort] [Filter] [Group] …ml-auto… [count/selection]`

### 21.7 Default Tags on Creation

New campaigns auto-clone tags from the most-tagged existing campaign.

---

## §23 — Avatar / Entity Circle Standard

All avatars use `EntityAvatar` from `@/components/ui/entity-avatar.tsx` + colors from `@/lib/avatarUtils.ts`.

### Display Priority

1. **Photo** — If `photoUrl` exists, show photo
2. **Initials** — `getInitials(name)` with entity-appropriate colors

### Color Sources

| Entity | Function |
|--------|----------|
| Leads | `getLeadStatusAvatarColor(status)` |
| Accounts | `getAccountAvatarColor(status)` |
| Campaigns | `getCampaignAvatarColor(status)` |
| Users | `getUserRoleAvatarColor(role)` |
| Prompts | `getPromptAvatarColor(status)` |

### Sizes

| Context | Size | Tailwind |
|---------|------|----------|
| Standard (cards, tables) | 36px | `size={36}` |
| Detail panel header | 34px | `size={34}` |
| Large (profile headers) | 72px | `size={72}` |
| Compact (inline) | 28px | `size={28}` |

### Rules

- Never define local `getInitials()` — always import from `avatarUtils.ts`
- Lead status colors MUST be identical across Leads, Calendar, and Conversations
- Photo always takes priority when the field is non-empty

---

## §24 — Group Headers in Left Panel Lists

### 24.1 Layout

```
——— Last 3 Months – 17 ———
[line]  [label]  [dash]  [count]  [line]
```

### 24.2 Exact Markup

```tsx
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-30 bg-muted px-3 pt-3 pb-3">
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

### 24.3 Rules

- Title case label, en-dash, plain number — no `uppercase`, no "X leads"
- `bg-muted` must be opaque — no transparency
- `sticky top-0 z-30` — z-30 to beat `animate-card-enter` stacking contexts
- Group headers must be direct flex children of the scroll container

---

## §25 — Entity Name & Widget Title Typography

**One size: `text-[16px] font-semibold font-heading`** for all card names and widget titles.

- **Card names:** `text-[16px] font-semibold font-heading leading-tight truncate text-foreground`
- **Widget titles:** `text-[16px] font-semibold font-heading text-foreground`
- Never use `text-sm`, `text-[13px]`, `text-[14px]`, etc. for these elements.

---

## §26 — ViewTabBar Rigid Positioning

### The Fixed-Width Wrapper

```tsx
<div className="flex items-center justify-between w-[309px] shrink-0">
  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={...} />
</div>
```

Width derivation: `340px (panel) − 17px (pl-[17px]) − 14px (pr-3.5) = 309px`

### Rules

1. Always `w-[309px] shrink-0` with `justify-between` — never `gap-*` or `ml-auto`
2. Same wrapper across all views (List, Table, Kanban)
3. Rightmost circle aligns with panel's right content edge

---

## §27 — Table Group Header Standard

### Structure — 3-Cell `<tr>`

| Cell | Width | Sticky | Content |
|------|-------|--------|---------|
| Checkbox | 36px | `sticky left-0 z-30` | Group select checkbox |
| Label | auto | `sticky left-[36px] z-30` | `[▼] [Group Name] [count]` |
| Spacer | `colSpan={remaining}` | none | Carries background color |

### Styling

- Row: `cursor-pointer select-none h-[44px]`
- All cells: `style={{ backgroundColor: \`${hexColor}12\` }}` (from `PIPELINE_HEX`)
- Arrow next to name (left), NOT `ml-auto`
- Title case labels, NOT `uppercase tracking-widest`

### Rules

1. Always 3 cells — never single `colSpan` td
2. Always separate checkbox `<td>` for data rows
3. Selection bars inside InlineTable are banned — use Page toolbar (§17.3)

---

## §28 — Expand-on-Hover Button Pattern (Global Default)

> Default for ALL toolbar, filter, sort, group, and action buttons. `ToolbarPill` is deprecated.

### Pattern

```tsx
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
```

### Centering Math

`pl-[9px]` (not `px-2.5`): 9px + 1px border = 10px from edge → icon (16px) center = 18px = button center.

### `hover:max-w` Sizing

| Label | max-w | Examples |
|-------|-------|---------|
| 3–4 chars | `[80px]` | Add, CSV, Edit |
| 5–6 chars | `[100px]` | Group, Sort, Filter |
| 7–9 chars | `[120px]` | Refresh, Import |
| 10+ chars | `[150px]` | Change Status |

### Delete / Danger Variant

```tsx
<button className={cn(xBase, "hover:max-w-[100px] border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")}>
```

### What NOT to Change

`IconBtn`, `ViewTabBar`, filled CTA buttons, form/dialog buttons, table cell buttons, Calendar nav arrows.

---

## §29 — Split-Pane Card Selection Behaviour

### Smooth Scroll

```ts
container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
```

- Use `scrollTo` with `behavior: "smooth"` — never assign `scrollTop` directly
- Walk `previousElementSibling` to find `[data-group-header="true"]` for header offset
- Offset `-3` = `p-[3px]` gap

### Reference Implementation

`LeadsCardView.tsx` — `useLayoutEffect` on `selectedLead` change (use `useLayoutEffect`, not `useEffect`).

### Rules

- Detail panel must NOT remount on selection change — update in place
- No `key={selectedId}` on detail panel
- No entrance animation on selection change

---

## §30 — Inline Confirmation Tooltip

> Default for all reversible/soft-destructive confirmations. `AlertDialog` reserved for hard deletes only.

### Implementation

```tsx
<Popover open={showConfirm} onOpenChange={setShowConfirm}>
  <PopoverTrigger asChild>
    <button ...>{/* action button */}</button>
  </PopoverTrigger>
  <PopoverContent
    align="end" side="bottom" sideOffset={6}
    className="w-auto p-3 shadow-md border border-black/[0.08] bg-white rounded-xl"
  >
    <p className="text-[12px] text-foreground/70 mb-2.5 max-w-[200px]">
      Brief explanation. One or two sentences max.
    </p>
    <div className="flex items-center gap-2 justify-end">
      <button className="text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors">
        Cancel
      </button>
      <button className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors">
        Confirm
      </button>
    </div>
  </PopoverContent>
</Popover>
```

### Rules

1. Always `bg-white` — no `bg-popover`, no `bg-background`
2. No dark overlay
3. Button labels: Cancel (muted) + action verb (filled indigo). Never "Yes/No".

---

## Changelog

- **2026-02-25:** Initial creation (was part of UI_STANDARDS.md).
- **2026-02-26:** §14 Interaction Patterns added. §15–§18 added.
- **2026-02-27:** §15.1 card bg → `bg-card`. §20 Settings added. §21 Campaign detail added. §22 Popups added. §23 Avatar standard added. §24 Group Headers added. §25 Typography added.
- **2026-02-28:** §26 ViewTabBar positioning added. §27 Table Group Header added. §21 rewritten.
- **2026-03-01:** §28 Expand-on-Hover added. §17 rewritten.
- **2026-03-03:** §30 Inline Confirmation Tooltip added. Split from UI_STANDARDS.md into separate file. §15.3 Tag/Label Pill Colors standard added (transparent rgba overlays for all left panel cards).
