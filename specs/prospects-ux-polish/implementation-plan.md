# Implementation Plan: Prospects Page UX Polish

## Overview

Nine incremental UX improvements to the Prospects page list view, detail panel, and mobile experience. Each phase is independent and can ship on its own.

## Phase 1: Card Enhancements (visual scanning) ✓
Make prospect cards more informative at a glance without clicking or hovering.

### Tasks
- [x] Add permanent contact snippet to cards: show first available of email or phone below the status row in `ProspectListCard` (line ~270-400 in ProspectListView.tsx). Keep the hover-reveal section for the full set.
- [x] Add priority accent stripe: add a 3px left border to the card `<div>` colored by `PRIORITY_HEX[priority]`, falling back to transparent for no priority.
- [x] Add outreach status indicator on cards: show a small colored dot + short label (from `OUTREACH_HEX`/`OUTREACH_LABELS`) below or next to the status row. Only show if `outreach_status` is not "new".
- [x] Add overdue follow-up indicator: if `next_follow_up_date` is in the past, render a small red "Overdue" badge or red dot on the card. Requires comparing `next_follow_up_date` against `new Date()`.

### Technical Details
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Component: `ProspectListCard` (~line 226-400)
- Constants already exist: `PRIORITY_HEX`, `PRIORITY_LEVEL`, `OUTREACH_HEX`, `OUTREACH_LABELS`
- `ProspectRow` type has: `email`, `phone`, `outreach_status`, `next_follow_up_date`, `priority`
- Keep card height reasonable: use `text-[10px]` for new metadata, single line only

## Phase 2: Detail Panel Reorder ✓
Put actionable content first in the 3-column detail panel.

### Tasks
- [x] Swap column 1 (Contact Info) and column 3 (Actions & Follow-ups) in the detail panel JSX (~line 1150-1400 in ProspectListView.tsx). Column order becomes: Actions | Enrichment | Contact.
- [x] Move "Convert to Account" button from column 3 to the header badges row (~line 1117-1146). Place it after the priority badge. Remove it from the column body.

### Technical Details
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- The 3 columns are siblings inside a flex container at ~line 1153
- Column 1 (Contact): `w-full md:w-1/3 md:shrink-0` (~line 1155)
- Column 2 (Enrichment): `hidden md:flex w-1/3` (~line 1264)
- Column 3 (Actions): `hidden md:flex w-1/3` (~line 1332)
- Convert to Account button is at ~line 1335-1365
- Header badges row is at ~line 1118

## Phase 3: Collapse Empty Enrichment
Save space when LinkedIn enrichment data is absent.

### Tasks
- [ ] Detect if enrichment data exists: check if any of `headline`, `connection_count`, `follower_count`, `ai_summary`, `top_post`, `conversation_starters` are non-empty on the selected prospect.
- [ ] When no enrichment data: collapse column 2 to a narrow CTA strip ("Enrich this prospect" with Sparkles icon). Remaining columns expand to fill space (`md:w-1/2` each instead of `md:w-1/3`).
- [ ] When enrichment data exists: keep current 3-column layout unchanged.

### Technical Details
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Enrichment fields on `ProspectRow`: `headline`, `connection_count`, `follower_count`, `ai_summary`, `top_post`, `conversation_starters`, `enriched_at`, `enrichment_status`
- Column 2 is at ~line 1264
- Use conditional classes: `md:w-1/3` vs collapsed `md:w-[60px]` with rotate text or icon-only
- Alternative: hide column 2 entirely and make columns 1+3 each `md:w-1/2`

## Phase 4: Inline Editing in List View Panel [complex]
Port inline editing from ProspectDetailView to the list view's detail panel.

### Tasks
- [ ] Add edit mode state to the detail panel section of ProspectListView
- [ ] Make these fields editable inline: status (dropdown), priority (dropdown), next_action (text input), notes (textarea)
  - [ ] Status: click the status badge to toggle a dropdown
  - [ ] Priority: click the priority badge to toggle a dropdown
  - [ ] Next Action: click to convert to text input, blur to save
  - [ ] Notes: click to convert to textarea, blur to save
- [ ] Wire save logic: PATCH to `/api/prospects/:id` on blur/change, optimistic update in local state
- [ ] Add i18n keys for any new labels in en/nl/pt locale files

### Technical Details
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Reference implementation: `ProspectDetailView.tsx` lines 370-420 (draft state), 680-790 (editable fields)
- API: `PUT /api/prospects/:id` with partial body (server/routes.ts ~line for prospects)
- Use `apiFetch` from `@/lib/apiUtils`
- Optimistic update: modify `selectedProspect` in parent state, revert on error
- Status options: New, Contacted, In Progress, Converted, Archived
- Priority options: Low, Medium, High, Urgent

## Phase 5: Mobile Detail Access
Give mobile users a way to view prospect details.

### Tasks
- [ ] Create a slide-up sheet component (or reuse existing Dialog/Sheet from shadcn) that renders the detail panel content on mobile
- [ ] On mobile, when a prospect card is tapped, open the sheet instead of trying to show the hidden right panel
- [ ] Include key sections: header (name, badges), contact info, next action, notes
- [ ] Add a close/back button at the top of the sheet

### Technical Details
- File: `client/src/features/prospects/components/ProspectListView.tsx`
- Mobile detection: `useIsMobile()` hook already imported and used (~line 40, 543)
- Current mobile behavior: `isMobile && selectedProspect` shows a back button but detail panel is `hidden md:flex`
- shadcn Sheet component: `@/components/ui/sheet` (check if it exists, otherwise use Dialog with `side="bottom"`)
- Keep the sheet lightweight: no 3-column layout, single scrollable column
- Reuse the same data (selectedProspect) and handlers
