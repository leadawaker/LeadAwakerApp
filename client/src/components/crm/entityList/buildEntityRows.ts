/**
 * Stateless list-pipeline helpers — the filter -> sort -> group -> flatten
 * algorithm that Leads, Prospects, Billing, Prompts and Tags each re-implement
 * by hand inside their own useMemo.
 *
 * These are PURE functions, not a hook: each page keeps its own state (enum
 * sorts, persisted filters, collapsed groups) and threads it to children
 * exactly as before. The page just calls these instead of hand-rolling the
 * grouping/flatten loop, so behaviour and child prop-APIs are untouched.
 *
 * (The state-owning useEntityList hook lives next door for features that want
 * the whole machine; these helpers are for the common case where the page
 * already owns its state.)
 */

/**
 * Group items into an insertion-stable, key-sorted Map. Keys are sorted
 * ascending (localeCompare-free, matching the legacy Array.sort default) and
 * reversed when `direction === "desc"`. Mirrors the grouping useMemos that
 * PromptsPage / TagsPage / the inline tables hand-rolled.
 */
export function groupItemsToMap<T>(
  items: T[],
  groupKeyOf: (item: T) => string,
  direction: "asc" | "desc" = "asc",
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupKeyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const orderedKeys = Array.from(groups.keys()).sort();
  if (direction === "desc") orderedKeys.reverse();
  const ordered = new Map<string, T[]>();
  for (const k of orderedKeys) ordered.set(k, groups.get(k)!);
  return ordered;
}

export interface BuildEntityRowsOptions<T, R> {
  items: T[];
  /** Combined search+filter test. The page closes over its own filter state. */
  predicate?: (item: T) => boolean;
  /** Sort comparator. The page closes over its own (often enum) sort state. */
  comparator?: (a: T, b: T) => number;
  /** Group key for an item; pass null/undefined to skip grouping (flat list). */
  groupKeyOf?: ((item: T) => string) | null;
  groupDirection?: "asc" | "desc";
  /** Group keys present here render only their header (children stay hidden). */
  collapsedGroups?: Set<string>;
  /** Map a group key+count to the page's own header row shape. */
  makeHeader: (key: string, count: number) => R;
  /** Map an item to the page's own item row shape. */
  makeItem: (item: T) => R;
}

/**
 * filter -> sort -> (optional) group+flatten, returning the page's OWN row
 * shape via makeHeader/makeItem so no child component needs to change. When
 * `groupKeyOf` is null/undefined the result is a flat list of mapped items.
 */
export function buildEntityRows<T, R>(opts: BuildEntityRowsOptions<T, R>): R[] {
  const {
    items,
    predicate,
    comparator,
    groupKeyOf,
    groupDirection = "asc",
    collapsedGroups,
    makeHeader,
    makeItem,
  } = opts;

  let work = predicate ? items.filter(predicate) : items.slice();
  if (comparator) work.sort(comparator);

  if (!groupKeyOf) return work.map(makeItem);

  const grouped = groupItemsToMap(work, groupKeyOf, groupDirection);
  const rows: R[] = [];
  grouped.forEach((group, key) => {
    rows.push(makeHeader(key, group.length));
    if (!collapsedGroups || !collapsedGroups.has(key)) {
      for (const item of group) rows.push(makeItem(item));
    }
  });
  return rows;
}
