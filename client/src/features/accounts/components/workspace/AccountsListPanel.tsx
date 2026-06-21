import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useCompactHoverCard, CompactHoverCardPortal } from "@/components/crm/CompactEntityRail";
import {
  getAccountId, STATUS_GROUP_ORDER, STATUS_I18N_KEY, type VirtualListItem,
  ListSkeleton, CompactListSkeleton,
} from "../listWidgets";
import { WorkspaceAccountCard, WorkspaceGroupHeader } from "./WorkspaceAccountCard";
import { CompactAccountCard } from "./CompactAccountCard";
import type { AccountRow } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";

const PAGE_SIZE = 25;

interface Props {
  accounts: AccountRow[];
  loading: boolean;
  selectedAccount: AccountRow | null;
  onSelectAccount: (a: AccountRow) => void;
  listSearch: string;
  filterStatus: string[];
  sortBy: AccountSortBy;
  groupBy: AccountGroupBy;
  groupDirection: "asc" | "desc";
  isListCompact: boolean;
  isListHidden: boolean;
  isNarrow: boolean;
}

export function AccountsListPanel({
  accounts, loading, selectedAccount, onSelectAccount,
  listSearch, filterStatus, sortBy, groupBy, groupDirection,
  isListCompact, isListHidden, isNarrow,
}: Props) {
  const { t } = useTranslation("accounts");
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Campaign names + lead counts per account (hover pills + count badge).
  const [campaignNamesByAccount, setCampaignNamesByAccount] = useState<Map<number, string[]>>(new Map());
  const [leadCountsByAccount, setLeadCountsByAccount] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    apiFetch("/api/campaigns").then((r) => r.json()).then((data: any) => {
      const list: any[] = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      const by = new Map<number, string[]>();
      list.forEach((c) => {
        const aid = c.Accounts_id ?? c.accountsId ?? c.accountId ?? c.account_id;
        const cname = String(c.name || c.Name || "").trim();
        if (aid && cname) { const k = Number(aid); if (!by.has(k)) by.set(k, []); by.get(k)!.push(cname); }
      });
      setCampaignNamesByAccount(by);
    }).catch(() => {});
    apiFetch("/api/leads?page=1&limit=1000").then((r) => r.json()).then((data: any) => {
      const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.list ?? []);
      const by = new Map<number, number>();
      list.forEach((lead) => {
        const aid = lead.Accounts_id ?? lead.accountsId ?? lead.accountId ?? lead.account_id;
        if (aid) { const k = Number(aid); by.set(k, (by.get(k) ?? 0) + 1); }
      });
      setLeadCountsByAccount(by);
    }).catch(() => {});
  }, []);

  const flatItems = useMemo((): VirtualListItem[] => {
    let filtered = accounts;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((a) =>
        String(a.name || "").toLowerCase().includes(q) ||
        String(a.owner_email || "").toLowerCase().includes(q) ||
        String(a.business_niche || "").toLowerCase().includes(q) ||
        String(a.type || "").toLowerCase().includes(q));
    }
    if (filterStatus.length > 0) filtered = filtered.filter((a) => filterStatus.includes(String(a.status || "")));
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc": return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc": return String(b.name || "").localeCompare(String(a.name || ""));
        default: {
          const da = a.updated_at || a.created_at || "";
          const db = b.updated_at || b.created_at || "";
          return db.localeCompare(da);
        }
      }
    });
    if (groupBy === "none") return filtered.map((a) => ({ kind: "account" as const, account: a }));
    const buckets = new Map<string, AccountRow[]>();
    filtered.forEach((a) => {
      const key = groupBy === "status" ? String(a.status || "Unknown") : String(a.type || "Unknown");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(a);
    });
    let keys = groupBy === "status"
      ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)))
      : Array.from(buckets.keys()).sort();
    if (groupDirection === "desc") keys = keys.slice().reverse();
    const result: VirtualListItem[] = [];
    keys.forEach((key) => {
      const group = buckets.get(key);
      if (!group?.length) return;
      const label = groupBy === "status" ? t(STATUS_I18N_KEY[key] ?? key) : key;
      result.push({ kind: "header", label, count: group.length });
      group.forEach((a) => result.push({ kind: "account", account: a }));
    });
    return result;
  }, [accounts, listSearch, filterStatus, sortBy, groupBy, groupDirection, t]);

  const totalAccounts = flatItems.filter((i) => i.kind === "account").length;
  const maxPage = Math.max(0, Math.ceil(totalAccounts / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalAccounts <= PAGE_SIZE) return flatItems;
    let count = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: VirtualListItem[] = [];
    let header: VirtualListItem | null = null;
    let hCount = 0;
    for (const item of flatItems) {
      if (item.kind === "header") { header = item; hCount = 0; continue; }
      if (count >= start && count < end) { if (header && hCount === 0) result.push(header); result.push(item); hCount++; }
      count++;
      if (count >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalAccounts]);

  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, groupBy, groupDirection, sortBy]);

  // Scroll selected card into view.
  useEffect(() => {
    if (!selectedAccount || !scrollRef.current) return;
    const container = scrollRef.current;
    const run = () => {
      const id = getAccountId(selectedAccount);
      const el = container.querySelector(`[data-account-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      let headerHeight = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("data-group-header") === "true") { headerHeight = (sibling as HTMLElement).offsetHeight; break; }
        sibling = sibling.previousElementSibling;
      }
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      // 14px, not 3px: the sticky header (z-index 5, opaque background) paints
      // over anything closer than that, clipping the top of the selected
      // card's raised-crisp shadow (~12px tall). Bumping the header's own
      // padding does nothing here — this gap is recomputed from the header's
      // live height every time, so it always nets out to the same overlap.
      container.scrollTo({ top: cardTop - headerHeight - 14, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedAccount]);

  useFKeyScrollToSelected({
    containerRef: scrollRef,
    selectedId: selectedAccount ? getAccountId(selectedAccount) : null,
    getSelector: (id) => `[data-account-id="${id}"]`,
  });

  // Compact hover card.
  const findEl = useCallback((id: string | number) => scrollRef.current?.querySelector(`[data-account-id="${id}"]`) as HTMLElement | null, []);
  const {
    hovered, rect, onHover, onHoverEnd, cancelHoverEnd, close,
  } = useCompactHoverCard<AccountRow>((a) => getAccountId(a), findEl);

  const widthClass = isListHidden
    ? cn(isNarrow && selectedAccount ? "hidden" : "flex", "lg:hidden")
    : isListCompact
      ? cn("w-[65px] shrink-0", isNarrow && selectedAccount ? "hidden" : "flex")
      : cn("w-full lg:w-[var(--toolbar-w)] lg:shrink-0", isNarrow && selectedAccount ? "hidden" : "flex");

  return (
    <div className={cn("flex-col h-full min-h-0 bg-panel-list-bg overflow-hidden border-r border-[var(--line)]", widthClass)}>
      {isListCompact ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto la-list-area">
          {loading ? (
            <CompactListSkeleton />
          ) : (
            <div className="flex flex-col items-center gap-0">
              {flatItems.map((item) => {
                if (item.kind === "header") return null;
                const aid = getAccountId(item.account);
                const isSel = selectedAccount ? getAccountId(selectedAccount) === aid : false;
                return (
                  <div key={aid} data-account-id={aid}>
                    <CompactAccountCard account={item.account} isActive={isSel} onClick={() => onSelectAccount(item.account)} onHover={onHover as (a: Record<string, any>, r: DOMRect) => void} onHoverEnd={onHoverEnd} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto la-list-area">
            {loading ? (
              <ListSkeleton />
            ) : paginatedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Building2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("page.noAccountsFound")}</p>
                {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">{t("page.tryDifferentSearch")}</p>}
              </div>
            ) : (
              <div className="la-cards">
                {paginatedItems.map((item, idx) => {
                  if (item.kind === "header") {
                    const isFirstHeader = paginatedItems.findIndex((i) => i.kind === "header") === idx;
                    return <WorkspaceGroupHeader key={`h-${item.label}`} label={item.label} count={item.count} isFirst={isFirstHeader} />;
                  }
                  const aid = getAccountId(item.account);
                  const isSel = selectedAccount ? getAccountId(selectedAccount) === aid : false;
                  return (
                    <div key={aid || idx} data-account-id={aid} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                      <WorkspaceAccountCard account={item.account} isActive={isSel} onClick={() => onSelectAccount(item.account)} campaignNames={campaignNamesByAccount.get(aid) ?? []} leadCount={leadCountsByAccount.get(aid) ?? null} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {totalAccounts > PAGE_SIZE && (
            <div className="h-9 md:h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
              <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30">{t("toolbar.previous")}</button>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currentPage * PAGE_SIZE + 1}&ndash;{Math.min((currentPage + 1) * PAGE_SIZE, totalAccounts)} {t("toolbar.of")} {totalAccounts}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))} disabled={currentPage >= maxPage} className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30">{t("toolbar.next")}</button>
            </div>
          )}
        </>
      )}

      {isListCompact && hovered && (
        <CompactHoverCardPortal rect={rect} onMouseEnter={cancelHoverEnd} onMouseLeave={onHoverEnd}>
          <WorkspaceAccountCard account={hovered} isActive={selectedAccount ? getAccountId(selectedAccount) === getAccountId(hovered) : false} onClick={() => { onSelectAccount(hovered); close(); }} campaignNames={campaignNamesByAccount.get(getAccountId(hovered)) ?? []} leadCount={leadCountsByAccount.get(getAccountId(hovered)) ?? null} />
        </CompactHoverCardPortal>
      )}
    </div>
  );
}
