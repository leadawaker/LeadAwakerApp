import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ArrowUpDown,
  Filter,
  Plus,
  Check,
  Layers,
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
import { SearchPill } from "@/components/ui/search-pill";
import { useIsMobile } from "@/hooks/useIsMobile";
import { type AccountRow } from "./AccountDetailsDialog";
import { AccountDetailView, AccountDetailViewEmpty } from "./AccountDetailView";
import { AccountCreatePanel } from "./AccountCreatePanel";
import { ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import type { NewAccountForm } from "./AccountCreateDialog";
import type { AccountViewMode, AccountGroupBy, AccountSortBy } from "../pages/AccountsPage";
import { apiFetch } from "@/lib/apiUtils";
import { SkeletonAccountPanel } from "@/components/ui/skeleton";
import {
  getAccountId,
  GROUP_TKEYS,
  SORT_TKEYS,
  STATUS_I18N_KEY,
  STATUS_GROUP_ORDER,
  STATUS_FILTER_OPTIONS,
  VIEW_TABS_CONFIG,
  type VirtualListItem,
  AccountListCard,
  GroupHeader,
  ListSkeleton,
} from "./listWidgets";

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountListViewProps {
  accounts: AccountRow[];
  loading: boolean;
  selectedAccount: AccountRow | null;
  onSelectAccount: (account: AccountRow | null) => void;
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
  const { t } = useTranslation("accounts");
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(0);

  // Translated view tabs (built inside component where hook is available)
  const viewTabs = useMemo(
    () => VIEW_TABS_CONFIG.map((tab) => ({ ...tab, label: t(tab.tKey) })),
    [t]
  );
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");
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
      .catch((err) => console.error("[AccountListView] campaigns fetch failed:", err));
  }, []);

  // Lead counts per account — fetched once, grouped client-side
  const [leadCountsByAccount, setLeadCountsByAccount] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    apiFetch("/api/leads?page=1&limit=1000")
      .then((r: any) => r.json())
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.list ?? []);
        const byAccount = new Map<number, number>();
        list.forEach((lead) => {
          const aid = lead.Accounts_id ?? lead.accountsId ?? lead.accountId ?? lead.account_id;
          if (aid) {
            const key = Number(aid);
            byAccount.set(key, (byAccount.get(key) ?? 0) + 1);
          }
        });
        setLeadCountsByAccount(byAccount);
      })
      .catch((err) => console.error("[AccountListView] leads fetch failed:", err));
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
      // Translate status group headers; type keys are data values — displayed as-is
      const label = groupBy === "status"
        ? t(STATUS_I18N_KEY[key] ?? key)
        : key;
      result.push({ kind: "header", label, count: group.length });
      group.forEach((a) => result.push({ kind: "account", account: a }));
    });
    return result;
  }, [accounts, listSearch, filterStatus, sortBy, groupBy, t]);

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

  // ── Smooth scroll to selected card (§29) ────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedAccount || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const run = () => {
      const id = getAccountId(selectedAccount);
      const el = container.querySelector(`[data-account-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      let headerHeight = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("data-group-header") === "true") {
          headerHeight = (sibling as HTMLElement).offsetHeight;
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedAccount]);

  // ── Expand-on-hover button constants ────────────────────────────────────────
  const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // ── Toolbar prefix for the right panel ──────────────────────────────────────
  const toolbarPrefix = (
    <>
      {/* +Add */}
      <button
        className={cn(xBase, xDefault, "hover:max-w-[80px]")}
        onClick={() => setPanelMode("create")}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      {/* Search */}
      <SearchPill
        value={listSearch}
        onChange={onListSearchChange}
        open={searchOpen}
        onOpenChange={onSearchOpenChange}
        placeholder={t("page.searchPlaceholder")}
      />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isSortNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_TKEYS) as AccountSortBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
              {t(SORT_TKEYS[opt])}
              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("filter.status")}</DropdownMenuLabel>
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
              <span className="flex-1">{t(STATUS_I18N_KEY[s] ?? s)}</span>
              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-muted-foreground">
                {t("toolbar.clearAllFilters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isGroupNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(GROUP_TKEYS) as AccountGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
              {t(GROUP_TKEYS[opt])}
              {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-full gap-[3px] overflow-y-auto md:overflow-y-hidden" data-testid="account-list-view">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden",
        "w-full md:w-[340px] md:shrink-0 min-h-[300px] md:min-h-0",
        isMobile && selectedAccount ? "hidden" : "flex"
      )}>

        {/* Header: title + 309px wrapper with ViewTabBar */}
        <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 shrink-0 flex items-center">
          <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
            <ViewTabBar
              tabs={viewTabs}
              activeId={viewMode}
              onTabChange={(id) => onViewModeChange(id as AccountViewMode)}
              variant="segment"
            />
          </div>
        </div>

        {/* Account list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-[3px]">
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t("page.noAccountsFound")}</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">{t("page.tryDifferentSearch")}</p>}
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
                  <div key={aid || idx} data-account-id={aid} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                    <AccountListCard
                      account={item.account}
                      isActive={isSelected}
                      onClick={() => onSelectAccount(item.account)}
                      campaignNames={campaignNamesByAccount.get(getAccountId(item.account)) ?? []}
                      leadCount={leadCountsByAccount.get(aid) ?? null}
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
              {t("toolbar.previous")}
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentPage * PAGE_SIZE + 1}&ndash;{Math.min((currentPage + 1) * PAGE_SIZE, totalAccounts)} {t("toolbar.of")} {totalAccounts}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              {t("toolbar.next")}
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex-col overflow-hidden rounded-lg min-h-[400px] md:min-h-0",
        isMobile && !selectedAccount ? "hidden" : "flex mobile-panel-enter"
      )}>
        {panelMode === "create" ? (
          <AccountCreatePanel
            onCreate={async (data) => { await onCreate(data); setPanelMode("view"); }}
            onClose={() => setPanelMode("view")}
          />
        ) : loading && !selectedAccount ? (
          <SkeletonAccountPanel />
        ) : selectedAccount ? (
          <AccountDetailView
            account={selectedAccount}
            onSave={onSave}
            onAddAccount={() => setPanelMode("create")}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
            toolbarPrefix={toolbarPrefix}
            onBack={() => onSelectAccount(null)}
          />
        ) : (
          <AccountDetailViewEmpty toolbarPrefix={toolbarPrefix} />
        )}
      </div>
    </div>
  );
}
