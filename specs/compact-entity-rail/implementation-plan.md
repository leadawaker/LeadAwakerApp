# CompactEntityRail — Implementation Plan

## Phase 1: Component Extraction

**Target location:** `client/src/components/crm/CompactEntityRail/`

```
CompactEntityRail/
├── index.tsx                     # Main component
├── CompactRailTabs.tsx           # Vertical puck tab bar
├── CompactRailSearch.tsx         # Absolute-positioned search portal
├── CompactRailHoverCard.tsx      # Hover preview card (generic wrapper)
├── CompactRailToolbar.tsx        # ... menu (sort/group/filter)
├── useCompactRailHysteresis.ts   # ResizeObserver + state transitions
└── types.ts                      # Shared types
```

## Phase 2: Component Interface

```ts
interface CompactEntityRailProps<TItem, TTabId extends string> {
  items: TItem[];                             // server-paginated slice
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;

  getItemId: (item: TItem) => string | number;
  selectedId: string | number | null;
  onSelect: (item: TItem) => void;

  renderAvatar: (item: TItem, isSelected: boolean) => React.ReactNode;
  renderHoverCard: (item: TItem) => React.ReactNode;

  tabs: Array<{ id: TTabId; label: string; count?: number; icon?: React.ReactNode }>;
  activeTab: TTabId;
  onTabChange: (id: TTabId) => void;

  toolbar?: {
    sortOptions?: Array<{ id: string; label: string }>;
    activeSort?: string;
    onSortChange?: (id: string) => void;
    groupOptions?: Array<{ id: string; label: string }>;
    activeGroup?: string;
    onGroupChange?: (id: string) => void;
    filterSlot?: React.ReactNode;          // page-specific filter dropdowns
  };

  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };

  groupHeaders?: Array<{                    // interleaved "section dots"
    afterItemId: string | number;
    label: string;
  }>;

  scrollToIdRef?: React.MutableRefObject<((id: string | number) => void) | null>;
  ensureItemLoadedRef?: React.MutableRefObject<((id: string | number) => Promise<void>) | null>;
}
```

## Phase 3: Extraction Steps

**Files to edit:**
- [client/src/features/prospects/components/ProspectListView.tsx](client/src/features/prospects/components/ProspectListView.tsx) — strip compact-rail JSX; consume new component
- [client/src/features/prospects/components/ProspectListCards.tsx](client/src/features/prospects/components/ProspectListCards.tsx) — keep `CompactProspectCard` avatar as `renderAvatar` adapter
- NEW: `client/src/components/crm/CompactEntityRail/*`

Steps:
1. Copy compact-rail JSX + hysteresis hook verbatim from `ProspectListView` into new files
2. Replace prospect-specific fields with props (item → generic TItem)
3. Wire `ProspectListView` back up passing prospect-specific renderers
4. Manual QA: every compact behavior (puck, hover, search, F-shortcut, load-more)

## Phase 4: Validation

- Boot app, navigate Prospects, narrow right panel, verify pixel parity
- Verify F-shortcut still calls `ensureProspectLoaded` through the ref
- Verify SSE refresh still repaints rail
- `pm2 logs` clean

## Risks

- Ref-based imperative API (`scrollToIdRef`, `ensureItemLoadedRef`) is awkward but avoids lifting huge state. Acceptable if documented.
- Puck animation uses absolute positioning with `translateY` tied to tab index — generic tabs array must preserve order stability.
