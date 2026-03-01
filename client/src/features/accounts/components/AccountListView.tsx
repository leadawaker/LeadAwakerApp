import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Building2,
  List,
  Table2,
  Layers,
  ArrowUpDown,
  Filter,
  X,
  Mail,
  Phone,
  Plus,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { type AccountRow } from "./AccountDetailsDialog";
import { AccountDetailView, AccountDetailViewEmpty } from "./AccountDetailView";
import { AccountCreatePanel } from "./AccountCreatePanel";
import { getInitials, getAccountAvatarColor, ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { NewAccountForm } from "./AccountCreateDialog";
import type { AccountViewMode, AccountGroupBy, AccountSortBy } from "../pages/AccountsPage";
import { apiFetch } from "@/lib/apiUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccountId(a: AccountRow): number {
  return a.Id ?? a.id ?? 0;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
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

const GROUP_LABELS: Record<AccountGroupBy, string> = {
  status: "Status",
  type:   "Type",
  none:   "None",
};

const SORT_LABELS: Record<AccountSortBy, string> = {
  recent:    "Most Recent",
  name_asc:  "Name A → Z",
  name_desc: "Name Z → A",
};

const STATUS_GROUP_ORDER = ["Active", "Trial", "Inactive", "Suspended"];
const STATUS_FILTER_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];

// ── View tab definitions ──────────────────────────────────────────────────────

const VIEW_TABS: { id: AccountViewMode; label: string; icon: typeof List }[] = [
  { id: "list",  label: "List",  icon: List   },
  { id: "table", label: "Table", icon: Table2 },
];

// ── Virtual list item types ───────────────────────────────────────────────────

type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "account"; account: AccountRow };

// ── Account card ─────────────────────────────────────────────────────────────

function AccountListCard({
  account,
  isActive,
  onClick,
  campaignNames,
}: {
  account: AccountRow;
  isActive: boolean;
  onClick: () => void;
  campaignNames: string[];
}) {
  const name = String(account.name || "Unnamed Account");
  const initials = getInitials(name);
  const status = String(account.status || "");
  const avatarColor = getAccountAvatarColor(status);
  const statusHex = ACCOUNT_STATUS_HEX[status] || "#94A3B8";
  const lastUpdated = account.updated_at || account.created_at;
  const email = String(account.owner_email || "");
  const phone = String((account as any).phone || "");
  const niche = String(account.business_niche || "");
  const timezone = String(account.timezone || "");
  const type = String(account.type || "");

  const hasHoverContent = !!(email || phone || niche || timezone || campaignNames.length > 0);

  // Campaign pills: max 3 visible, then "+N more"
  const visibleCampaigns = campaignNames.slice(0, 3);
  const extraCount = campaignNames.length - visibleCampaigns.length;

  return (
    <div
      className={cn(
        "group rounded-xl cursor-pointer",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Top row: Avatar + Name + Type badge */}
        <div className="flex items-start gap-2.5">
          <EntityAvatar
            name={name}
            photoUrl={account.logo_url}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
          />
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              {type && (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.07] text-foreground/40 mt-0.5 whitespace-nowrap">
                  {type}
                </span>
              )}
            </div>
            {/* Status dot + label + last updated — one compact line */}
            <div className="flex items-center justify-between gap-1 mt-[3px]">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusHex }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{status || "Unknown"}</span>
              </div>
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground/45 shrink-0 tabular-nums">
                  {formatRelativeTime(lastUpdated)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover-reveal: niche + timezone + email + phone + campaign pills */}
        {hasHoverContent && (
          <div className="overflow-hidden max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-[max-height,opacity] duration-200 ease-out">
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-black/[0.06]">
              {/* Niche + timezone */}
              {(niche || timezone) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {niche && (
                    <span className="text-[10px] text-foreground/40 truncate">{niche}</span>
                  )}
                  {niche && timezone && (
                    <span className="text-[10px] text-foreground/25 shrink-0">&middot;</span>
                  )}
                  {timezone && (
                    <span className="text-[10px] text-foreground/40 truncate">{timezone}</span>
                  )}
                </div>
              )}
              {/* Email + phone row */}
              {(email || phone) && (
                <div className="flex items-center gap-3 min-w-0">
                  {email && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{email}</span>
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      {phone}
                    </span>
                  )}
                </div>
              )}
              {/* Campaign name pills */}
              {visibleCampaigns.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {visibleCampaigns.map((cname, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-medium bg-black/[0.06] text-foreground/50 rounded px-1.5 py-0.5 truncate max-w-[100px]"
                    >
                      {cname}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="text-[9px] font-medium bg-black/[0.06] text-foreground/50 rounded px-1.5 py-0.5">
                      +{extraCount} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">–</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountListViewProps {
  accounts: AccountRow[];
  loading: boolean;
  selectedAccount: AccountRow | null;
  onSelectAccount: (account: AccountRow) => void;
  onAddAccount: () => void;
  onCreate: (data: NewAccountForm) => Promise<void>;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  onToggleStatus: (account: AccountRow) => void;
  // Lifted controls
  viewMode: AccountViewMode;
  onViewModeChange: (v: AccountViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: AccountGroupBy;
  onGroupByChange: (v: AccountGroupBy) => void;
  sortBy: AccountSortBy;
  onSortByChange: (v: AccountSortBy) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AccountListView({
  accounts,
  loading,
  selectedAccount,
  onSelectAccount,
  onAddAccount,
  onCreate,
  onSave,
  onDelete,
  onToggleStatus,
  viewMode,
  onViewModeChange,
  listSearch,
  onListSearchChange,
  searchOpen,
  onSearchOpenChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  filterStatus,
  onToggleFilterStatus,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
}: AccountListViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");
  const [_editDialogAccount, _setEditDialogAccount] = useState<AccountRow | null>(null);
  const PAGE_SIZE = 25;

  // Campaign names per account — fetched once, used for card hover pills
  const [campaignNamesByAccount, setCampaignNamesByAccount] = useState<Map<number, string[]>>(new Map());
  useEffect(() => {
    apiFetch("/api/campaigns")
      .then((r: any) => r.json())
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        const byAccount = new Map<number, string[]>();
        list.forEach((c) => {
          const aid = c.Accounts_id ?? c.accountsId ?? c.accountId ?? c.account_id;
          const cname = String(c.name || c.Name || "").trim();
          if (aid && cname) {
            const key = Number(aid);
            if (!byAccount.has(key)) byAccount.set(key, []);
            byAccount.get(key)!.push(cname);
          }
        });
        setCampaignNamesByAccount(byAccount);
      })
      .catch(() => {});
  }, []);

  // Build flat grouped list
  const flatItems = useMemo((): VirtualListItem[] => {
    let filtered = accounts;

    // Text search
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((a) =>
        String(a.name || "").toLowerCase().includes(q) ||
        String(a.owner_email || "").toLowerCase().includes(q) ||
        String(a.business_niche || "").toLowerCase().includes(q) ||
        String(a.type || "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((a) => filterStatus.includes(String(a.status || "")));
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc": return String(b.name || "").localeCompare(String(a.name || ""));
        default: { // recent
          const da = a.updated_at || a.created_at || "";
          const db = b.updated_at || b.created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // No grouping
    if (groupBy === "none") {
      return filtered.map((a) => ({ kind: "account" as const, account: a }));
    }

    // Group
    const buckets = new Map<string, AccountRow[]>();
    filtered.forEach((a) => {
      let key: string;
      if (groupBy === "status") {
        key = String(a.status || "Unknown");
      } else {
        key = String(a.type || "Unknown");
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(a);
    });

    const orderedKeys =
      groupBy === "status"
        ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k))
            .concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)))
        : Array.from(buckets.keys()).sort();

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((a) => result.push({ kind: "account", account: a }));
    });
    return result;
  }, [accounts, listSearch, filterStatus, sortBy, groupBy]);

  const totalAccounts = flatItems.filter((i) => i.kind === "account").length;
  const maxPage = Math.max(0, Math.ceil(totalAccounts / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalAccounts <= PAGE_SIZE) return flatItems;
    let accountCount = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: VirtualListItem[] = [];
    let currentHeader: VirtualListItem | null = null;
    let headerCount = 0;
    for (const item of flatItems) {
      if (item.kind === "header") {
        currentHeader = item;
        headerCount = 0;
        continue;
      }
      if (accountCount >= start && accountCount < end) {
        if (currentHeader && headerCount === 0) result.push(currentHeader);
        result.push(item);
        headerCount++;
      }
      accountCount++;
      if (accountCount >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalAccounts]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, groupBy, sortBy]);

  // Auto-select first account
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) {
      const first = flatItems.find((i) => i.kind === "account") as { kind: "account"; account: AccountRow } | undefined;
      if (first) onSelectAccount(first.account);
    }
  }, [flatItems, selectedAccount, accounts.length, onSelectAccount]);

  const isFilterActive = filterStatus.length > 0;

  // ── Toolbar prefix for the right panel ──────────────────────────────────────
  const toolbarPrefix = (
    <>
      {/* +Add */}
      <ToolbarPill icon={Plus} label="Add" onClick={() => setPanelMode("create")} />

      {/* Search — toggle between pill and inline input */}
      {searchOpen ? (
        <div className="h-10 flex items-center gap-1.5 px-3 rounded-full border border-brand-indigo/50 bg-brand-indigo/5">
          <Search className="h-4 w-4 text-brand-indigo shrink-0" />
          <input
            value={listSearch}
            onChange={(e) => onListSearchChange(e.target.value)}
            placeholder="Search..."
            autoFocus
            onBlur={() => { if (!listSearch) onSearchOpenChange(false); }}
            onKeyDown={(e) => { if (e.key === "Escape") { onListSearchChange(""); onSearchOpenChange(false); } }}
            className="bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60 w-[120px]"
          />
          <button onClick={() => { onListSearchChange(""); onSearchOpenChange(false); }} className="text-muted-foreground/60 hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <ToolbarPill icon={Search} label="Search" active={!!listSearch} onClick={() => onSearchOpenChange(true)} />
      )}

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={ArrowUpDown}
            label="Sort"
            active={isSortNonDefault}
            activeValue={isSortNonDefault ? SORT_LABELS[sortBy].split(" ")[0] : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_LABELS) as AccountSortBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
              {SORT_LABELS[opt]}
              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Filter}
            label="Filter"
            active={isFilterActive}
            activeValue={isFilterActive ? filterStatus.length : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_FILTER_OPTIONS.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }}
              className="flex items-center gap-2 text-[12px]"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: ACCOUNT_STATUS_HEX[s] || "#94A3B8" }}
              />
              <span className="flex-1">{s}</span>
              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-muted-foreground">
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Layers}
            label="Group"
            active={isGroupNonDefault}
            activeValue={isGroupNonDefault ? GROUP_LABELS[groupBy] : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(GROUP_LABELS) as AccountGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
              {GROUP_LABELS[opt]}
              {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="flex h-full gap-[3px]" data-testid="account-list-view">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">

        {/* Header: title + 309px wrapper with ViewTabBar */}
        <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center">
          <div className="flex items-center justify-between w-[309px] shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Accounts</h2>
            <ViewTabBar
              tabs={VIEW_TABS}
              activeId={viewMode}
              onTabChange={(id) => onViewModeChange(id as AccountViewMode)}
            />
          </div>
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto p-[3px]">
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No accounts found</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-[3px]">
              {paginatedItems.map((item, idx) => {
                if (item.kind === "header") {
                  return (
                    <div key={`h-${item.label}`}>
                      <GroupHeader label={item.label} count={item.count} />
                    </div>
                  );
                }
                const aid = getAccountId(item.account);
                const isSelected = selectedAccount ? getAccountId(selectedAccount) === aid : false;
                return (
                  <div key={aid || idx} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                    <AccountListCard
                      account={item.account}
                      isActive={isSelected}
                      onClick={() => onSelectAccount(item.account)}
                      campaignNames={campaignNamesByAccount.get(getAccountId(item.account)) ?? []}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalAccounts > PAGE_SIZE && (
          <div className="h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentPage * PAGE_SIZE + 1}&ndash;{Math.min((currentPage + 1) * PAGE_SIZE, totalAccounts)} of {totalAccounts}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-lg">
        {panelMode === "create" ? (
          <AccountCreatePanel
            onCreate={async (data) => { await onCreate(data); setPanelMode("view"); }}
            onClose={() => setPanelMode("view")}
          />
        ) : selectedAccount ? (
          <AccountDetailView
            account={selectedAccount}
            onSave={onSave}
            onAddAccount={onAddAccount}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
            toolbarPrefix={toolbarPrefix}
          />
        ) : (
          <AccountDetailViewEmpty toolbarPrefix={toolbarPrefix} />
        )}
      </div>
    </div>
  );
}
