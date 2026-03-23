# Requirements: Prospects Page UX Polish

## Summary

A collection of UX/UI improvements to the Prospects page list view and detail panel, focused on information density, discoverability, and visual hierarchy. These are incremental enhancements, not a redesign.

## Why

The prospects page has all the right data but some of it is hidden (hover-only contact info), buried (next action in column 3), or missing from the card view (outreach status, follow-up date). These changes make the page more scannable and reduce clicks to reach high-value information.

## Features

### 1. Show contact snippet on cards permanently
Currently website, email, phone, LinkedIn only appear on hover. Show at least one contact detail (email or phone) permanently on the card, with the rest remaining hover-only.

### 2. Reorder detail panel columns
Swap columns 1 (Contact Info) and 3 (Actions & Follow-ups) so "Next Action" and follow-up date are the first column the user sees when selecting a prospect.

### 3. Overdue follow-up indicator on cards
Add a visual cue (red dot or small "overdue" label) on prospect cards when `next_follow_up_date` is in the past. Helps spot stale prospects without switching to the Follow-ups view.

### 4. Priority accent stripe on cards
Add a thin left border to each card colored by priority (blue=Low, amber=Medium, red=High, dark red=Urgent) for faster visual scanning.

### 5. Outreach status on cards
Show a small outreach stage indicator on the card (e.g. a dot or short label) so pipeline progress is visible from the list without clicking.

### 6. Move "Convert to Account" to header
Relocate the Convert to Account button from column 3 to the detail panel header row, next to the status/priority badges.

### 7. Collapse empty enrichment column
When a prospect has no LinkedIn enrichment data, collapse column 2 or show a compact CTA ("Enrich this prospect") instead of a mostly-blank column.

### 8. Inline editing in list view detail panel
Allow inline editing of key fields (status, priority, next_action, notes) directly in the list view's detail panel without navigating to the standalone detail view.

### 9. Mobile detail access
Add a slide-up sheet or full-screen modal for the prospect detail on mobile, since the detail panel is currently hidden on small screens.

## Acceptance Criteria

- Cards show one permanent contact detail + overdue indicator + outreach status
- Detail panel leads with actionable content (Next Action, follow-up date)
- Priority stripe and outreach status are visible without hovering or clicking
- Convert to Account is in the header, not buried in column 3
- Empty enrichment doesn't waste a full column
- Key fields are editable from the list view panel
- Mobile users can view prospect details

## Dependencies

- Existing ProspectListView.tsx card component
- Existing 3-column detail panel layout
- ProspectDetailView.tsx inline editing patterns (to port to list view)
- Existing PRIORITY_HEX, PRIORITY_LEVEL, OUTREACH_HEX constants
