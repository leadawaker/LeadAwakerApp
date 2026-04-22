# CompactEntityRail — Shared Component

## What It Is

Extract the compact-rail pattern that currently lives inside `ProspectListView` into a reusable component so Leads, Chats, and future CRM pages can adopt the same left-panel shrink behavior without duplicating ~400 lines of code.

## Context

The Prospects page has a left panel that transitions between three states driven by right-panel width:
- `full` (>=1300px right panel): normal 340px list
- `compact` (<1000px right panel): 65px avatar-only rail with vertical puck tab bar, hover card, absolute-positioned search portal
- `hidden`: fully collapsed

Hysteresis 1000/1300px prevents oscillation. Selected avatar stays 40px but gets `ring-2 ring-white` outline. The rail includes: vertical tabs (status filters), avatar stack with grouping headers collapsed to dots, a search input that overlays on demand, a `...` menu for sort/group/filters, and a hover card that previews the full row on hover.

## Goals

1. Single component `CompactEntityRail` that Prospects, Leads, and Chats all consume
2. Prospects behavior unchanged after extraction — zero visual regressions
3. Pluggable renderers so each page can swap avatar, hover-card, and tab content without forking the component
4. Pagination/data handling stays in each page's hook; the rail is a pure presentation component

## Non-Goals

- No mobile redesign (compact mode is desktop-only, <1000px right panel)
- No changes to the `full` state list (each page keeps its own full-list component)
- No change to pagination contract — rail receives an already-paginated `items` array

## Acceptance Criteria

- [ ] Prospects page uses `CompactEntityRail` and looks/behaves identically to current
- [ ] Hysteresis and panel-state transitions still work
- [ ] F-shortcut (scroll selected into view) still works
- [ ] Search, sort, group, filters all work through the shared component
- [ ] Hover card and vertical puck tabs animate as before
- [ ] Can be consumed by Leads page with only lead-specific renderers/hooks
