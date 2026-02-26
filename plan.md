# Calendar Page Redesign Plan

## Goal
Restyle the Calendar page to match the leads page design system — same stone-gray depth layers, 34px icon circles, card styling, spacing, typography, and color language.

---

## Current State (Problems)

1. **Left sidebar ("Upcoming Appointments")** uses generic `bg-card` + `border border-border` with `divide-y` rows — looks like a basic list, not cards
2. **Filters (Account/Campaign)** sit inside the calendar header toolbar — should move to the left panel
3. **Tab title** says "Upcoming Appointments" — should say **"My Calendar"**
4. **View mode tabs** (Yearly/Monthly/Weekly/Daily) use `bg-brand-blue text-white` active style — should use the `bg-[#FFF375]` pill style (34px height) from leads
5. **Nav/prev/next buttons** use `h-6 w-6 rounded-lg` — should be 34px icon circles with `border-border/65`
6. **Today button** uses rounded-xl with border — should match toolbar pill style
7. **Icons** throughout don't follow the 34px circle standard
8. **Appointment list items** are flat `p-4` divs with `divide-y` — should be discrete cards like `LeadsCardView` lead cards (`mx-[3px] my-0.5 rounded-xl bg-[#F1F1F1]`)
9. **Popover** uses `w-7 h-7 rounded-lg` icon containers — should be 34px circles
10. **Calendar main panel** has `border border-border` — stone-gray system uses depth-via-color, no visible borders between panels
11. **Gap between panels** should be `gap-[3px]` (reveals stone-gray background) not `gap-4`

---

## Changes — Step by Step

### Step 1: Outer Layout & Panel Structure
- Change outer flex container to `gap-[3px]` (from `gap-4`) to match leads split-pane
- Remove `border border-border shadow-sm` from both panels — use depth-via-color instead
- Left panel: `bg-muted rounded-lg` (like leads left list panel)
- Right calendar panel: `bg-card rounded-lg` (like leads right detail panel)
- Set left panel width to `w-[340px]` (slightly narrower than current 380px, closer to leads' 300px but accounting for calendar list needing more room)

### Step 2: Left Panel Header — "My Calendar"
- Replace "Upcoming Appointments" / "Appointments for {date}" with **"My Calendar"** as the main title
- Style: `text-2xl font-semibold font-heading text-foreground` (matching leads' "My Leads")
- Add appointment count badge: `h-8 w-8 rounded-full border border-border/50` circle (like leads count)
- Subtitle: `text-[10px] text-muted-foreground uppercase tracking-widest` for "Timeline overview" or selected date
- Padding: `px-3.5 pt-7 pb-1` (matches leads header exactly)

### Step 3: Move Filters to Left Panel
- Move **All Accounts** and **All Campaigns** dropdowns from the calendar toolbar into the left panel
- Place them in a controls row below the header: `px-3 pt-1.5 pb-3` (same as leads controls row)
- Style filter buttons as small capsule pills: `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium border border-border/30 bg-transparent`
- Active filter: `border-brand-blue/40 text-brand-blue` (like leads filter active state)
- Icons inside: `h-3.5 w-3.5` (standard)

### Step 4: Appointment List — Card Style
- Replace `divide-y divide-border` flat rows with discrete cards
- Each appointment card: `mx-[3px] my-0.5 rounded-xl bg-[#F1F1F1] hover:bg-[#FAFAFA]` (same as lead cards)
- Selected card (when date clicked): `bg-[#FFF6C8]` (same yellow highlight as selected lead)
- Card inner padding: `px-2.5 pt-3 pb-2`
- Avatar circle (top-left): `h-8 w-8 rounded-full` with status-based color (blue for normal, red for no-show)
  - Initials from lead name
- Lead name: `text-[15px] font-semibold font-heading leading-tight truncate`
- Campaign name: `text-[11px] text-muted-foreground`
- Time badge: same small pill style
- Date: `text-[10px] text-muted-foreground/70 tabular-nums`
- No-show badge: keep existing red pill
- Rescheduled badge: keep existing amber pill
- Remove "VIEW CAL" link button from each card (keep it in the popover only)

### Step 5: Group Headers in Appointment List
- Group appointments by date (Today, Tomorrow, This Week, Later)
- Use leads-style group header: sticky, `bg-muted`, centered label with divider lines on both sides
- Label: `text-[10px] font-bold text-foreground/55 uppercase tracking-widest`
- Count: `text-[9px] text-muted-foreground/45`

### Step 6: Calendar Toolbar (Right Panel)
- Remove account/campaign filters from toolbar (moved to left panel)
- **View mode tabs**: Change from rectangular buttons to pill-style tabs matching leads
  - Active: `h-[34px] px-3 rounded-full bg-[#FFF375] text-foreground text-[12px] font-semibold`
  - Inactive: `h-[34px] w-[34px] rounded-full border border-border/65 flex items-center justify-center` (icon-only circles)
  - Show label text only on active tab, icon-only on inactive (like leads tab pattern)
  - Icons: Calendar for Year, Grid for Month, Columns for Week, CalendarDays for Day
- **Navigation prev/next**: 34px icon circles with `border border-border/65`
- **Date label**: `text-[12px] font-semibold` (not bold text-sm)
- **Today button**: `h-[34px] px-3 rounded-full border border-border/65 text-[12px] font-medium` capsule
- Toolbar padding: `px-3.5 pt-3 pb-2.5` (matching leads toolbar spacing)
- Remove `border-b border-border` from toolbar — use subtle spacing instead

### Step 7: Month View Grid Refinement
- Day cells: keep functional layout, soften borders to `border-border/30`
- Today indicator: `bg-brand-blue/10` circle around day number (not primary)
- Selected day: `bg-[#FFF6C8]` (yellow highlight, matching card selection)
- Booking cards in cells: keep existing `border-l-2` accent style, refine text sizes
- Weekend cells: `bg-muted/5`

### Step 8: Week/Day Time Grid Refinement
- Sticky header: use `bg-muted` (not `bg-background/95 backdrop-blur`)
- Day name: `text-[10px] font-bold text-muted-foreground uppercase tracking-widest` (matches leads group headers)
- Day number: `text-lg font-black` (slightly smaller than current)
- Time labels: keep existing style (already good)
- Gridlines: `border-border/20` (softer)
- Appointment cards in grid: add `rounded-xl` (from rounded-lg), keep border-l accent

### Step 9: Year View Refinement
- Summary stat cards: `bg-[#F1F1F1] rounded-xl` (card color, no border)
- Remove `border border-border/30` from stat cards — depth via color
- Heatmap container: `bg-muted rounded-xl` with no border

### Step 10: Booking Detail Popover
- Icon containers: change from `w-7 h-7 rounded-lg` to `h-[34px] w-[34px] rounded-full border border-border/65` (standard icon circles)
- Close button: 34px icon circle
- Header tint: keep existing color logic
- Body spacing: consistent with leads detail panel

### Step 11: Drag Overlay & Toast
- Ghost card: `rounded-xl` (from rounded-lg)
- Toast: keep existing styling (already modern)

---

## Files to Modify

1. **`client/src/pages/Calendar.tsx`** — All changes are in this single file (the entire calendar UI is here)

No new files needed. No new dependencies.

---

## Design Reference Summary

| Element | Current | Target |
|---------|---------|--------|
| Panel gap | `gap-4` | `gap-[3px]` |
| Panel borders | `border border-border` | None (depth via color) |
| Left panel bg | `bg-card` | `bg-muted` |
| Title | "Upcoming Appointments" | "My Calendar" |
| Title style | `font-semibold text-sm` | `text-2xl font-semibold font-heading` |
| Filters location | Calendar toolbar | Left panel controls row |
| Appointment items | Flat `divide-y` rows | Discrete `rounded-xl` cards |
| Selected item | N/A | `bg-[#FFF6C8]` |
| Active tab | `bg-brand-blue text-white` | `bg-[#FFF375]` pill |
| Inactive tab | `bg-muted/10` rectangle | 34px icon circle |
| Nav buttons | `h-6 w-6 rounded-lg` | 34px icon circle |
| Icon sizes | Mixed | `h-3.5 w-3.5` standard |
