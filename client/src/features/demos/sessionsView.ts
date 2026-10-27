// The Demos page's filter, sort and group rules. Pure: no React, no api imports.
import { buildEntityRows, groupItemsToMap } from "@/components/crm/entityList/buildEntityRows";
import type { ProspectRow } from "./prospectRows";

export type ActivityFilter = "all" | "opened" | "replied" | "never";

/** "" means any. */
export interface SessionFilters {
  activity: ActivityFilter;
  expired: boolean;
  client: string;
  service: string;
}

export const DEFAULT_FILTERS: SessionFilters = { activity: "all", expired: false, client: "", service: "" };

export type SessionSort = "newest" | "prospect" | "company" | "activity";

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

function time(iso: string | null): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

/** Newest first; a missing date sorts last. */
function byDateDesc(pick: (r: ProspectRow) => string | null) {
  return (a: ProspectRow, b: ProspectRow): number => {
    const x = time(pick(a));
    const y = time(pick(b));
    return x === y ? 0 : y > x ? 1 : -1;
  };
}

export function compareRows(sort: SessionSort): (a: ProspectRow, b: ProspectRow) => number {
  switch (sort) {
    case "prospect":
      return (a, b) => a.firstName.localeCompare(b.firstName);
    case "company":
      return (a, b) => a.companyName.localeCompare(b.companyName);
    case "activity":
      return byDateDesc((r) => r.lastActivityAt);
    default:
      return byDateDesc((r) => r.createdAt);
  }
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

/** The folder view: the same rows grouped by client, names ascending, the no-client group last. */
export function folderGroups(rows: ProspectRow[], f: SessionFilters, search: string, sort: SessionSort): Map<string, ProspectRow[]> {
  return groupItemsToMap(
    visibleRows(rows, f, search, sort),
    (r) => r.clientNiche,
    "asc",
    (keys) => [...keys.filter((k) => k !== "").sort((a, b) => a.localeCompare(b)), ...keys.filter((k) => k === "")],
  );
}
