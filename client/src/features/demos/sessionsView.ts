// The Demos tab table's sort and group rules. Pure: no React, no api imports.
import { groupByDate, type DateGroup } from "@/features/voiceCalls/dateGroups";
import { linkStatus, type LinkStatus, type ProspectRow } from "./prospectRows";
import { LINK_COLUMNS, type LinkColumn } from "./tableColumns";

/** A sortable column: the lead columns, the two dates, and one per link column. */
export type SortKey = "sent" | "prospect" | "company" | "lastActivity" | LinkColumn["key"];
export type SortDir = "asc" | "desc";
export interface SessionSort {
  key: SortKey;
  dir: SortDir;
}

/** Newest sent first: the order the page opens in, and the one date groups belong to. */
export const DEFAULT_SORT: SessionSort = { key: "sent", dir: "desc" };

const TEXT_KEYS: readonly SortKey[] = ["prospect", "company"];

/** Where a column starts when first clicked: text A to Z, dates and link progress furthest or newest first. */
function firstDir(key: SortKey): SortDir {
  return TEXT_KEYS.includes(key) ? "asc" : "desc";
}

/** What a header click does: a new column starts in its natural direction, the same column flips. */
export function nextSort(current: SessionSort, key: SortKey): SessionSort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: firstDir(key) };
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

/** The table shows date groups only while sorted by Sent; any other column shows a flat list. */
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
