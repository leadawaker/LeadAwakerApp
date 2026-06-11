import { useCallback, useMemo, useState } from "react";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";

/**
 * useEntityList — the shared filter/sort/group/search/selection orchestration
 * that Leads, Prospects, Billing, Prompts and Tags each hand-rolled.
 *
 * Scope (intentionally minimal): the *card-list* state machine only —
 *   search query, multi-select filter state, single-field sort, grouping +
 *   group direction, and a single persisted selection (the detail-panel item).
 *
 * NOT in scope (stays per-feature / in DataTable): table column widths, order,
 * visibility, bulk multi-select, inline-cell editing, view-mode (list/table/
 * kanban) and mobile layout. Those diverge too much to share.
 *
 * Domain logic is injected as pure functions (searchPredicate, filterPredicate,
 * comparator, groupOf) so the hook owns orchestration while each feature keeps
 * its own field semantics. Persistence follows usePersistedSelection.ts.
 */

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/** Multi-select filter state: filterKey -> selected values. */
export type FilterState = Record<string, string[]>;

/** Descriptor a feature returns from groupOf() to place an item in a group. */
export interface GroupDescriptor {
  /** Stable group identity (used as the map key). */
  key: string;
  /** Human label rendered in the GroupHeader. */
  label: string;
  /** Optional tint (e.g. PIPELINE_HEX[stage]). */
  color?: string;
  /** Optional explicit ordering (lower first). Falls back to label sort. */
  order?: number;
}

export type EntityListRow<T> =
  | { kind: "header"; groupKey: string; label: string; count: number; color?: string }
  | { kind: "item"; item: T };

export interface UseEntityListOptions<T> {
  items: T[];
  getItemId: (item: T) => string | number;

  /** Returns true if the item matches the current search query. */
  searchPredicate?: (item: T, query: string) => boolean;
  /** Returns true if the item passes the active filter state. */
  filterPredicate?: (item: T, filters: FilterState) => boolean;
  /** Standard comparator for the active sort (return <0 / 0 / >0). */
  comparator?: (a: T, b: T, sort: SortConfig) => number;
  /** Places an item in a group; return null to skip grouping for this item. */
  groupOf?: (item: T, groupBy: string) => GroupDescriptor | null;

  defaultSort?: SortConfig;
  defaultGroupBy?: string;
  defaultGroupDirection?: "asc" | "desc";
  defaultFilters?: FilterState;

  /**
   * localStorage key for the persisted single selection (the detail item).
   * Omit to keep selection in-memory only.
   */
  selectionKey?: string;
}

export interface UseEntityListResult<T> {
  // search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // filters
  filters: FilterState;
  setFilters: (next: FilterState | ((prev: FilterState) => FilterState)) => void;
  toggleFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  activeFilterCount: number;

  // sort
  sort: SortConfig;
  setSort: (next: SortConfig) => void;
  /** Cycle a column's sort: asc -> desc -> off (matches DataTable behaviour). */
  cycleSort: (key: string) => void;

  // grouping
  groupBy: string;
  setGroupBy: (key: string) => void;
  groupDirection: "asc" | "desc";
  setGroupDirection: (dir: "asc" | "desc") => void;
  toggleGroupDirection: () => void;

  // selection (persisted, single)
  selected: T | null;
  setSelected: (item: T | null | ((prev: T | null) => T | null)) => void;

  // derived
  /** Search+filter+sort applied, flat, no group headers (table-mode friendly). */
  filteredSorted: T[];
  /** Same data, flattened with group headers interleaved (card-mode friendly). */
  rows: EntityListRow<T>[];
}

const EMPTY_FILTERS: FilterState = {};

export function useEntityList<T>(opts: UseEntityListOptions<T>): UseEntityListResult<T> {
  const {
    items,
    getItemId,
    searchPredicate,
    filterPredicate,
    comparator,
    groupOf,
    defaultSort = { key: "", direction: null },
    defaultGroupBy = "none",
    defaultGroupDirection = "asc",
    defaultFilters = EMPTY_FILTERS,
    selectionKey,
  } = opts;

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<SortConfig>(defaultSort);
  const [groupBy, setGroupBy] = useState<string>(defaultGroupBy);
  const [groupDirection, setGroupDirection] = useState<"asc" | "desc">(defaultGroupDirection);

  // Persisted single selection. usePersistedSelection requires a key; when the
  // feature opts out we fall back to a stable in-memory key per mount.
  const fallbackKey = useMemo(
    () => selectionKey ?? `entityList:mem:${Math.random().toString(36).slice(2)}`,
    [selectionKey],
  );
  const [selected, setSelected] = usePersistedSelection<T>(fallbackKey, getItemId, items);

  const setFilters = useCallback(
    (next: FilterState | ((prev: FilterState) => FilterState)) => {
      setFiltersState((prev) => (typeof next === "function" ? (next as any)(prev) : next));
    },
    [],
  );

  const toggleFilter = useCallback((key: string, value: string) => {
    setFiltersState((prev) => {
      const current = prev[key] ?? [];
      const has = current.includes(value);
      const nextVals = has ? current.filter((v) => v !== value) : [...current, value];
      const next = { ...prev };
      if (nextVals.length === 0) delete next[key];
      else next[key] = nextVals;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setFiltersState({}), []);

  const cycleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: "", direction: null };
      return { key, direction: "asc" };
    });
  }, []);

  const toggleGroupDirection = useCallback(
    () => setGroupDirection((d) => (d === "asc" ? "desc" : "asc")),
    [],
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((n, vals) => n + (vals?.length ?? 0), 0),
    [filters],
  );

  // search + filter
  const filtered = useMemo(() => {
    let out = items;
    const q = searchQuery.trim();
    if (q && searchPredicate) out = out.filter((it) => searchPredicate(it, q));
    if (activeFilterCount > 0 && filterPredicate) out = out.filter((it) => filterPredicate(it, filters));
    return out;
  }, [items, searchQuery, searchPredicate, filterPredicate, filters, activeFilterCount]);

  // sort
  const filteredSorted = useMemo(() => {
    if (!comparator || sort.direction === null || !sort.key) return filtered;
    return [...filtered].sort((a, b) => comparator(a, b, sort));
  }, [filtered, comparator, sort]);

  // group + flatten
  const rows = useMemo<EntityListRow<T>[]>(() => {
    if (groupBy === "none" || !groupOf) {
      return filteredSorted.map((item) => ({ kind: "item", item }) as EntityListRow<T>);
    }
    // Preserve sorted order within each group; collect group metadata.
    const order: string[] = [];
    const meta = new Map<string, GroupDescriptor>();
    const buckets = new Map<string, T[]>();
    for (const item of filteredSorted) {
      const g = groupOf(item, groupBy);
      if (!g) continue;
      if (!buckets.has(g.key)) {
        buckets.set(g.key, []);
        meta.set(g.key, g);
        order.push(g.key);
      }
      buckets.get(g.key)!.push(item);
    }
    // Order groups by explicit `order` then label; honour groupDirection.
    order.sort((ka, kb) => {
      const ma = meta.get(ka)!;
      const mb = meta.get(kb)!;
      if (ma.order != null && mb.order != null && ma.order !== mb.order) return ma.order - mb.order;
      return ma.label.localeCompare(mb.label);
    });
    if (groupDirection === "desc") order.reverse();

    const out: EntityListRow<T>[] = [];
    for (const key of order) {
      const m = meta.get(key)!;
      const bucket = buckets.get(key)!;
      out.push({ kind: "header", groupKey: key, label: m.label, count: bucket.length, color: m.color });
      for (const item of bucket) out.push({ kind: "item", item });
    }
    return out;
  }, [filteredSorted, groupBy, groupOf, groupDirection]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    sort,
    setSort,
    cycleSort,
    groupBy,
    setGroupBy,
    groupDirection,
    setGroupDirection,
    toggleGroupDirection,
    selected,
    setSelected,
    filteredSorted,
    rows,
  };
}
