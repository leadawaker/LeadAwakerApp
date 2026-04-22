# CompactEntityRail Extraction & Reuse Spec

## Overview

Extract the compact left-panel rail pattern from Prospects into a standalone, parameterized `CompactEntityRail` component that can be reused across Leads, Chats, Campaigns, and other list pages. This component manages responsive panel collapse (1000px threshold), avatar rail with selection state, hover cards, search/filter overlays, and pagination state.

## Goals

1. Eliminate copy-paste of compact-rail UI logic across pages
2. Standardize responsive behavior (1000px hysteresis, ResizeObserver pattern)
3. Enable server-side pagination across all list pages
4. Maintain Prospects visual polish (ring-2 ring-white selection, fixed 40px avatars, vertical puck tabs)
5. Keep per-page domain logic (filtering, sorting, grouping) out of shared component

## Scope

**IN scope:**
- Responsive panel state management (full/compact/hidden, hysteresis at 1000px/1300px)
- Avatar rail rendering and selection
- Hover card container positioning and visibility
- Search/filter overlay portal positioning
- Vertical puck tab bar (if present)
- Pagination "Load More" button placeholder
- SSE-driven refetch integration

**OUT of scope:**
- Item filtering, sorting, grouping logic (stays in hook or page component)
- Domain-specific avatar rendering (delegated to renderAvatar prop)
- Domain-specific hover card content (delegated to renderHoverCard prop)
- Toolbar state management (search, filters, sort, group—stays in consuming page)
- TanStack Query hook implementation (pages provide useProspectsPaginated, useLeadsPaginated, etc.)

## Component API

### CompactEntityRail Props

```typescript
interface CompactEntityRailProps<T extends { id: string | number }> {
  // Data & loading state
  items: T[]
  total: number
  hasMore: boolean
  isLoading: boolean
  isFetchingNextPage?: boolean

  // Selection & callbacks
  selectedId?: string | number | null
  onSelect: (id: string | number) => void
  onLoadMore: () => void

  // Rendering (domain-specific)
  getItemId: (item: T) => string | number
  renderAvatar: (item: T, isActive: boolean, panelState: PanelState) => ReactNode
  renderHoverCard: (item: T) => ReactNode
  getItemLabel: (item: T) => string // for a11y, shown on hover in compact mode

  // Toolbar & search overlay
  toolbarContent?: ReactNode // search button, filters, sort dropdown, etc.
  searchInputNode?: ReactNode // injected search <input>, portal-positioned
  onSearchOverlayToggle?: (visible: boolean) => void

  // Tabs (optional vertical puck bar)
  tabs?: Array<{
    id: string
    label: string
    count?: number
    icon?: ReactNode
  }>
  activeTabId?: string
  onTabChange?: (id: string) => void

  // Panel state (optional: let component manage internally if not provided)
  panelState?: PanelState
  onPanelStateChange?: (state: PanelState) => void

  // Styling
  className?: string
  railClassName?: string // override rail width/styles if needed
}

type PanelState = 'full' | 'compact' | 'hidden'
```

### Return Value

```typescript
interface CompactEntityRailRef {
  scrollToItem: (id: string | number) => void
  scrollToTop: () => void
}
```

## File Structure

```
client/src/components/crm/
  CompactEntityRail/
    CompactEntityRail.tsx         (main component, ~300 lines)
    useCompactPanelState.ts       (ResizeObserver + hysteresis logic)
    constants.ts                  (1000px, 1300px, 40px avatar size, etc.)
    types.ts                      (PanelState, CompactEntityRailProps)
```

## Key Implementation Details

### Panel State Management (useCompactPanelState)

- ResizeObserver watches closest scrollable parent or root
- On width < 1000px: activate compact mode (if not already)
- On width > 1300px: deactivate compact mode (if not already)
- Prevents feedback loop by using 300px hysteresis gap (exceeds 280px panel swing from 340px→60px)
- Hook returns `[panelState, setPanelState]`

### Avatar Rail Layout

- `w-[65px]` fixed width when compact
- Vertical scroll: `overflow-y-auto`, `min-h-0`
- Each item: flex column, centered, gap-2
- Avatar: 40px fixed (no grow on selection)
- Selection indicator: `ring-2 ring-white` on avatar wrapper
- Vertical puck tab bar: absolute positioned, white pill, animates via `translateY()`

### Hover Card Positioning

- Positioned absolutely, left edge = rail width + 8px margin
- Top = avatar offset + scroll container scroll offset
- Portal-rendered to avoid scroll clipping
- Visibility state managed by component (tracking hovered itemId)

### Search Input Portal

- Consumer provides `<input>` node via `searchInputNode` prop
- Component renders portal with absolute positioning
- Show when panelState='full' or explicitly toggled
- Position: top-aligned to toolbar area, fixed width ~280px

### Pagination Integration

- Consumer provides `onLoadMore()` callback
- Button appears at rail bottom: "Load more (N remaining)" or "N total"
- Disabled when !hasMore or isFetchingNextPage

## Integration Checklist for Consuming Pages

For each page (Leads, Chats, etc.):

1. **Create pagination hook** (useLeadsPaginated, useChatsPaginated)
   - Mirrors useProspectsPaginated
   - Returns {items, total, hasMore, isLoading, isFetchingNextPage, fetchNextPage, refetch}

2. **Extract toolbar to separate component** (LeadsToolbar, ChatsToolbar)
   - Manages searchQuery, filters, sort, group state
   - Returns {searchInputNode, toolbarContent, onSearchOverlayToggle}
   - Keeps own filters/sort UI, consumer still owns logic

3. **Create renderAvatar function**
   - Domain-specific: Lead initials + status ring, Chat identity, etc.
   - Receives (item, isActive, panelState)

4. **Create renderHoverCard function**
   - Domain-specific: Lead details card, Chat preview, etc.
   - Can fetch additional data on demand

5. **Wrap CompactEntityRail in page layout**
   - Pass items, selectedId, onSelect from page state
   - Wire up hooks and callbacks
   - Flex layout: `flex gap-4 overflow-hidden min-h-0`
     - Left: CompactEntityRail (grows/shrinks with panelState)
     - Right: detail panel or content area

6. **SSE integration**
   - Listen to crm-data-changed events
   - Call paginated.refetch() or manual invalidation

## Validation

After extracting to CompactEntityRail:

1. Prospects page still loads, filters, paginates, selects, and reflects panel state changes
2. Compact mode activates/deactivates at 1000px/1300px threshold
3. Avatar selection shows ring-2 ring-white
4. F-shortcut scrolls into view via ref.scrollToItem()
5. Load More button appears and fetches next page
6. Hover cards position correctly and don't clip on scroll

## Deliverables

1. `/client/src/components/crm/CompactEntityRail/CompactEntityRail.tsx` (~300 lines)
2. `/client/src/components/crm/CompactEntityRail/useCompactPanelState.ts` (~50 lines)
3. `/client/src/components/crm/CompactEntityRail/constants.ts` (sizing, thresholds)
4. `/client/src/components/crm/CompactEntityRail/types.ts` (TypeScript interfaces)
5. `/client/src/features/prospects/components/ProspectListView.tsx` (refactored to consume CompactEntityRail)
6. Test: Prospects page still functional after migration

## Notes

- Do NOT refactor Prospects page filtering/sorting/grouping into CompactEntityRail—those stay in ProspectListView and useProspectListFiltering
- Do NOT move toolbar state management into CompactEntityRail—consumer pages manage filters/sort/group, CompactEntityRail only handles panel collapse and selection
- Search input is injected via prop to avoid prop drilling; consumer controls its visibility and value
- Hover cards are injected via renderHoverCard to avoid tight coupling to domain models
