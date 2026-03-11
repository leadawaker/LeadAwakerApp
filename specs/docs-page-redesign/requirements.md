# Requirements: Documentation Page Redesign

## Summary

Redesign the Documentation page (`Docs.tsx`) to match the layout patterns used by other pages in the app (Settings, Leads, Campaigns). The current page uses a full-width single-column layout with horizontal pill buttons for TOC navigation. It needs to be restructured with a proper left sidebar for section navigation, correct title conventions, and an agency/subaccount tab switcher. Additionally, the documentation content itself should be reviewed and expanded.

## Goals

1. **Side panel navigation** — Replace the horizontal TOC pill bar with a vertical left sidebar matching the Settings page pattern (`w-[340px]`, `bg-muted rounded-lg`, card-style nav items).
2. **Title convention** — Update the page title from `text-lg font-bold tracking-tight` to `text-2xl font-semibold font-heading text-foreground leading-tight`, matching all other pages (Settings, Leads, Campaigns).
3. **Agency/Subaccount tab switcher** — In agency view, show a tab toggle (pill buttons) to switch between "Agency Documentation" and "User Documentation". In subaccount view, only show user documentation (no tabs).
4. **Content improvements** — Expand, optimize, and improve both the Operator Manual and Client Guide with more useful sections, better organization, and additional detail.

## Acceptance Criteria

- [ ] Left sidebar with vertical section list replaces the horizontal TOC bar
- [ ] Clicking a sidebar section scrolls to or shows that section in the right content area
- [ ] Active sidebar item uses `bg-highlight-selected` highlight (matching Settings page)
- [ ] Page title uses `text-2xl font-semibold font-heading text-foreground leading-tight`
- [ ] Agency view shows tab switcher: "Agency Documentation" | "User Documentation"
- [ ] Subaccount view shows only user documentation, no tab switcher visible
- [ ] Tab naming: "Operator Manual" renamed to "Agency Documentation", "Client Guide" renamed to "User Documentation"
- [ ] Sidebar sections update when switching between agency/user docs tabs
- [ ] Search still works across all sections within the active tab
- [ ] "What's New" button remains accessible (operator-only)
- [ ] Mobile fallback: sidebar collapses to horizontal scrollable pills (same pattern as Settings mobile)
- [ ] Dark mode support maintained
- [ ] Documentation content expanded with new sections (see implementation plan for details)
- [ ] All new strings hardcoded in English (locale/translation updates deferred)

## Dependencies

- Existing components: `CrmShell`, shadcn/ui `Sheet`
- Settings page layout pattern (reference implementation)
- `UI_STANDARDS.md` and `UI_PATTERNS.md` conventions
- Locale files: `client/src/locales/{en,pt}/docs.json`

## Related Features

- Settings page (`Settings.tsx`) — reference for sidebar layout pattern
- Leads/Campaigns pages — reference for title conventions
- Agency/subaccount routing (`app.tsx`) — role-based view switching
