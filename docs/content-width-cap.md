# Content-Width Cap — CRM Panel Layout

**Feature:** Prevent CRM panel content from stretching infinitely on ultra-wide screens (2560px+), while keeping the left-hand nav and side panels fixed. Applied to all right-side detail/content panels as of March 2026.

**Cap value:** `max-w-[1386px]` (matches the leads page, the reference implementation).
**Alignment:** Left-aligned (`mr-auto`, not `mx-auto`).

---

## The Problem

The CRM uses a split-panel layout: fixed-width left panel (340px) + `flex-1` right content area. On ultra-wide monitors the right area grows indefinitely, stretching headers, message areas, and kanban boards far beyond readable width.

Secondary problem: some panels have a contact card column to the right of the center content. When the center column has no cap, the contact card shifts further right as the screen widens.

---

## Layout Types and Where to Apply the Cap

### Flex layouts (Conversations page)

**Structure:**
```
layout-conversations (flex row)
  ├── InboxPanel        (w-[340px] flex-shrink-0)
  ├── chat area wrapper (flex-1 min-w-0)          ← cap HERE
  │     └── ChatPanel > <section>
  │           ├── absolute gradient backgrounds
  │           └── inner content wrapper (header + messages + input)
  └── ContactSidebar    (w-[340px] flex-shrink-0)
```

**Fix:** Add `max-w-[1386px]` to the **flex child wrapper** around `ChatPanel` in [Conversations.tsx](../client/src/pages/Conversations.tsx):

```tsx
<div className={cn(
  "flex-1 min-w-0 flex flex-col max-w-[1386px]",   // ← max-w here
  mobileView === "inbox" ? "hidden md:flex" : "flex"
)} data-onboarding="conversations-chat">
  <ChatPanel className="flex-1 min-w-0" ... />
</div>
```

**Do NOT** apply max-w only to an inner wrapper inside ChatPanel — the `<section>` background fills the outer flex child and keeps expanding regardless.

**ContactSidebar side-effect:** Once the flex child is capped, `ContactSidebar` (flex-shrink-0 sibling) stops shifting right automatically — it sits immediately after the capped flex child.

---

### Grid layouts (Calendar page)

**Structure:**
```
layout-calendar (grid)
  ├── col 1 (340px):  calendar-list (lg:order-1)
  ├── col 2 (1fr):    calendar-main (lg:order-2)    ← cap HERE
  └── col 3 (340px):  contact card  (lg:order-3)
```

**Fix:** Change `1fr` to `minmax(0, 1386px)` in the **grid-template-columns** in [Calendar.tsx](../client/src/pages/Calendar.tsx):

```tsx
// 3-column (contact card open):
"grid grid-cols-[340px_minmax(0,1386px)_340px]"

// 2-column (no contact card):
"grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1386px)]"
```

**Do NOT** rely on `max-w` on the grid item (`calendar-main`) — this only caps the item's content, not the grid cell itself. The contact card column's position is determined by the grid cell size, not the item inside it.

**ContactSidebar side-effect:** Fixing the column cap in the grid template automatically pins the contact card column — it no longer shifts right.

---

## Cap Applied Per Panel (all features)

| Feature | File | Where cap is applied |
|---------|------|----------------------|
| Chat (whole panel) | Conversations.tsx | flex child wrapper around `ChatPanel` |
| Calendar (whole panel) | Calendar.tsx | `minmax(0,1386px)` in grid-cols |
| Campaign detail | CampaignDetailView.tsx | Header inner div + summary/config grids |
| Account detail | AccountDetailView.tsx | Header inner div + top/bottom row grids |
| Invoice detail | InvoiceDetailView.tsx | Main content grid div |
| Contract detail | ContractDetailView.tsx | Main content grid div |
| Expense detail | ExpenseDetailView.tsx | Main content grid div |
| Settings | SettingsPanel.tsx | Scrollable content div |
| Prompts list | PromptsListView.tsx | Main content grid div |
| Tasks page header | TasksPage.tsx | Page header div |
| Tasks kanban board | TasksKanbanView.tsx | DndContext board container |

---

## Mistakes and What Goes Wrong

### Mistake 1 — Capping only the inner content wrapper

Applying `max-w-[1386px]` to an inner `<div>` (e.g. the content wrapper inside `ChatPanel`) caps the text/bubbles but **not** the panel background (gradients, solid colors, wallpaper). The outer `<section>` still fills the full `flex-1` container, so the panel visually keeps expanding.

**Fix:** Apply max-w to the **outermost flex child** or **grid column**, not to an inner div.

### Mistake 2 — Capping only the header

Adding max-w to a panel's header bar leaves the body content (calendar grid, chat messages, kanban columns) uncapped. Always cap the **parent container of all content** (header + body + footer together).

### Mistake 3 — Using max-w on a grid item instead of the column

`max-w` on a grid item caps the item's content box, but the grid cell (and thus the adjacent column positions) are unaffected. The contact card column still shifts right because its position depends on the `1fr` grid cell, not on the item inside it.

**Fix:** Use `minmax(0, 1386px)` directly in `grid-template-columns`.

---

## Gradient / Background Preservation

When panels have absolute-positioned gradient backgrounds on an outer `<section>`:

- **Old approach (abandoned):** Cap inner content wrapper only — gradients fill edge-to-edge but panel itself expands.
- **Current approach:** Cap the outer flex child — gradients are contained within 1386px. The panel visually stops at 1386px including its background. This is the intended behaviour.
