import type { AccountRow } from "../AccountDetailsDialog";
import type { AccountViewMode, AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";
import { List, Table2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getAccountId(a: AccountRow): number {
  return a.Id ?? a.id ?? 0;
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

// ── Group / Sort metadata ─────────────────────────────────────────────────────

// tKey pattern: module-level constants store i18n keys (hooks can't be called at module level)
export const GROUP_TKEYS: Record<AccountGroupBy, string> = {
  status: "group.status",
  type:   "group.type",
  none:   "group.none",
};

export const SORT_TKEYS: Record<AccountSortBy, string> = {
  recent:    "sort.mostRecent",
  name_asc:  "sort.nameAZ",
  name_desc: "sort.nameZA",
};

// Status values from DB → i18n keys
export const STATUS_I18N_KEY: Record<string, string> = {
  Active:    "status.active",
  Trial:     "status.trial",
  Inactive:  "status.inactive",
  Suspended: "status.suspended",
  Unknown:   "status.unknown",
};

export const STATUS_GROUP_ORDER = ["Active", "Trial", "Inactive", "Suspended"];
export const STATUS_FILTER_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];

// ── View tab definitions ──────────────────────────────────────────────────────

// tKey pattern: translated inside component where hook is available
export const VIEW_TABS_CONFIG: { id: AccountViewMode; tKey: string; icon: typeof List }[] = [
  { id: "list",  tKey: "views.list",  icon: List   },
  { id: "table", tKey: "views.table", icon: Table2 },
];

// ── Virtual list item types ───────────────────────────────────────────────────

export type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "account"; account: AccountRow };
