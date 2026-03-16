# Requirements: Follow-ups View Filters (#244)

## What It Does

The Follow-ups view in the Prospects page currently shows a flat list of prospects with upcoming follow-ups (within 7 days) with no filtering, sorting, or grouping. This feature adds toolbar controls matching the table/pipeline views: filter by niche, country, priority, and contact method; sort by date/priority/name; and group by niche, priority, or contact method.

## Why

Without filters, Gabriel has to scan the entire list manually. As the prospect count grows, this becomes unusable. Filtering lets him focus on specific niches (e.g., Solar) or high-priority follow-ups for the day.

## Acceptance Criteria

1. Follow-ups view shows a toolbar (inline with tab bar) when active, matching table/pipeline toolbar pattern
2. **Filter dropdown** with sections:
   - Niche (multi-select, dynamically populated from data)
   - Country (multi-select)
   - Priority (multi-select)
   - Contact method (multi-select: email, phone, whatsapp)
   - "Clear all" option when any filter is active
3. **Sort dropdown** with options:
   - Date (soonest first) — default
   - Date (latest first)
   - Priority (high to low)
   - Name A-Z
4. **Group by dropdown** with options:
   - None — default (flat list)
   - Niche
   - Priority
   - Country
   - Contact method
5. **Search** input for quick text filtering (name, company, niche, contact_name)
6. Group headers show label + count, matching table view group header style
7. Active filter state is visually indicated on toolbar buttons (matching existing `xActive` pattern)
8. Tab badge count reflects filtered results (not total)
9. All toolbar labels use i18n keys in en/nl/pt
10. Mobile: toolbar scrolls horizontally, same as table/pipeline

## Dependencies

- Existing toolbar pill pattern (xBase/xActive/xDefault CSS classes in ProspectsPage.tsx)
- Existing DropdownMenu components from shadcn/ui
- Existing i18n namespace: `prospects`

## Related Features

- Table view toolbar (lines 571-770 in ProspectsPage.tsx) — exact pattern to follow
- Pipeline view toolbar (lines ~870-970) — similar pattern
