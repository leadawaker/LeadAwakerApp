// The Demos page's filter, sort and group rules. Pure: no React, no api imports.
import { buildEntityRows } from "@/components/crm/entityList/buildEntityRows";
import { groupByDate, type DateGroup } from "@/features/voiceCalls/dateGroups";
import { linkStatus, type LinkStatus, type ProspectRow } from "./prospectRows";
import { LINK_COLUMNS, type LinkColumn } from "./tableColumns";

export type ActivityFilter = "all" | "opened" | "replied" | "never";

/** "" means any. */
export interface SessionFilters {
  activity: ActivityFilter;
  expired: boolean;
  client: string;
  service: string;
}

export const DEFAULT_FILTERS: SessionFilters = { activity: "all", expired: false, client: "", service: "" };

/** A sortable column: the lead columns, the two dates, and one per link column. */
export type SortKey = "sent" | "prospect" | "company" | "client" | "lastActivity" | LinkColumn["key"];
export type SortDir = "asc" | "desc";
export interface SessionSort {
  key: SortKey;
  dir: SortDir;
}

/** Newest sent first: the order the page opens in, and the one date groups belong to. */
export const DEFAULT_SORT: SessionSort = { key: "sent", dir: "desc" };

/** The keys the topbar Sort menu lists (the link columns sort from their headers only). */
export const MENU_SORT_KEYS: readonly SortKey[] = ["sent", "prospect", "company", "client", "lastActivity"];

export function isFilterActive(f: SessionFilters): boolean {
  return f.activity !== "all" || f.expired || f.client !== "" || f.service !== "";
}

/**
 * Builder decision 14: by default a row whose links are all expired is hidden;
 * the Expired filter shows only those. A row with no links yet always shows
 * (unless the Expired filter is on), and "never opened" means a link was sent
 * and not opened.
 */
export function rowMatches(row: ProspectRow, f: SessionFilters, search: string): boolean {
  if (f.expired ? !row.expired : row.expired) return false;
  if (f.activity === "opened" && !row.opened) return false;
  if (f.activity === "replied" && row.replies === 0) return false;
  if (f.activity === "never" && !(row.hasLinks && !row.opened)) return false;
  if (f.client && row.clientNiche !== f.client) return false;
  if (f.service && !row.byService[f.service]) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [row.firstName, row.companyName, row.clientNiche].some((v) => v.toLowerCase().includes(q));
}

const TEXT_KEYS: readonly SortKey[] = ["prospect", "company", "client"];

/** Where a column starts when first clicked: text A to Z, dates and link progress furthest or newest first. */
function firstDir(key: SortKey): SortDir {
  return TEXT_KEYS.includes(key) ? "asc" : "desc";
}

/** What a header click does: a new column starts in its natural direction, the same column flips. */
export function nextSort(current: SessionSort, key: SortKey): SessionSort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: firstDir(key) };
}

/** Picking a column from the Sort menu: the column that is already sorted keeps its direction, a new one starts in its natural one. */
export function withSortKey(current: SessionSort, key: SortKey): SessionSort {
  return current.key === key ? current : { key, dir: firstDir(key) };
}

export function ariaSort(sort: SessionSort, key: SortKey): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

function time(iso: string | null): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
}

/** How far a link got, so a status column can be sorted: no link, expired, never opened, opened, replied. */
const STATUS_RANK: Record<LinkStatus, number> = { expired: 1, never: 2, opened: 3, replied: 4 };

/** The furthest any link in this column got (DBR / Quote holds two). */
function linkRank(row: ProspectRow, column: LinkColumn): number {
  return column.services.reduce((best, key) => {
    const s = row.byService[key];
    return s ? Math.max(best, STATUS_RANK[linkStatus(s)]) : best;
  }, 0);
}

/** The value a row sorts by in this column; null when it has none (sorted last either way). */
function sortValue(row: ProspectRow, key: SortKey): string | number | null {
  switch (key) {
    case "sent":
      return time(row.createdAt);
    case "lastActivity":
      return time(row.lastActivityAt);
    case "prospect":
      return row.firstName || null;
    case "company":
      return row.companyName || null;
    case "client":
      return row.clientNiche || null;
    default: {
      const column = LINK_COLUMNS.find((c) => c.key === key);
      return column ? linkRank(row, column) : null;
    }
  }
}

function compareValues(a: string | number, b: string | number): number {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}

/** Ties and the Sent column itself: the newest first, so a re-sorted list never jumbles. */
function newestFirst(a: ProspectRow, b: ProspectRow): number {
  return (time(b.createdAt) ?? -Infinity) - (time(a.createdAt) ?? -Infinity) || 0;
}

export function compareRows(sort: SessionSort): (a: ProspectRow, b: ProspectRow) => number {
  const sign = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    // A missing value sorts last whichever way the column runs.
    if (x === null || y === null) return x === y ? newestFirst(a, b) : x === null ? 1 : -1;
    return compareValues(x, y) * sign || newestFirst(a, b);
  };
}

/** The table's rows: filtered and sorted, flat. */
export function visibleRows(rows: ProspectRow[], f: SessionFilters, search: string, sort: SessionSort): ProspectRow[] {
  return buildEntityRows<ProspectRow, ProspectRow>({
    items: rows,
    predicate: (r) => rowMatches(r, f, search),
    comparator: compareRows(sort),
    makeHeader: () => {
      throw new Error("a flat list has no group headers");
    },
    makeItem: (r) => r,
  });
}

/** The table shows date groups only while sorted by Sent; any other column shows a flat list. The cards always group. */
export function groupsByDate(sort: SessionSort): boolean {
  return sort.key === "sent";
}

/**
 * Today, Yesterday, This week, Last week, then months, newest group first (oldest first
 * for Sent oldest first), a row with no date in the last group. `rows` arrive already
 * sorted, and keep that order inside each group.
 */
export function dateSections(
  rows: ProspectRow[],
  sort: SessionSort,
  opts: { now?: Date; timeZone?: string; locale?: string } = {},
): DateGroup<ProspectRow>[] {
  const groups = groupByDate(rows, (r) => r.createdAt ?? "", opts);
  if (sort.key !== "sent" || sort.dir !== "asc") return groups;
  return [...groups.filter((g) => g.key !== "unknown").reverse(), ...groups.filter((g) => g.key === "unknown")];
}
