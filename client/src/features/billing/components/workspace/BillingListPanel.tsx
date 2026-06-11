import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useCompactHoverCard, CompactHoverCardPortal } from "@/components/crm/CompactEntityRail";
import { getInitials } from "@/lib/avatarUtils";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../../types";
import { INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../../types";
import { InvoiceListCard } from "./InvoiceListCard";
import { ContractListCard } from "./ContractListCard";
import { ExpenseListCard } from "./ExpenseListCard";
import { CompactBillingCard } from "./CompactBillingCard";
import { GroupBar } from "./atoms";
import {
  getDateGroupKey, DATE_GROUP_I18N_KEYS, DATE_GROUP_ORDER,
  INVOICE_STATUS_ORDER, CONTRACT_STATUS_ORDER,
  effectiveInvoiceStatus, expenseYear, expenseQuarterNum,
} from "./adapters";

type Tab = "invoices" | "contracts" | "expenses";
type BillingItem = InvoiceRow | ContractRow | ExpenseRow;
export type BillingGroupBy = "none" | "status" | "date" | "year_quarter";

const PAGE_SIZE = 25;

type FlatItem =
  | { kind: "header"; label: string; count: number; accent?: string }
  | { kind: "item"; item: BillingItem };

interface Props {
  tab: Tab;
  items: BillingItem[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (item: BillingItem) => void;
  groupBy: BillingGroupBy;
  groupDirection: "asc" | "desc";
  isListCompact: boolean;
  isListHidden: boolean;
  isNarrow: boolean;
}

export function BillingListPanel({
  tab, items, loading, selectedId, onSelect,
  groupBy, groupDirection, isListCompact, isListHidden, isNarrow,
}: Props) {
  const { t } = useTranslation("billing");
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo((): FlatItem[] => {
    if (groupBy === "none") return items.map((item) => ({ kind: "item" as const, item }));

    // Bucket the items by a per-tab group key, then order the buckets.
    const buckets = new Map<string, BillingItem[]>();
    const keyOf = (item: BillingItem): string => {
      if (tab === "expenses") {
        const e = item as ExpenseRow;
        return `${expenseYear(e) ?? "?"} · Q${expenseQuarterNum(e) ?? "?"}`;
      }
      if (groupBy === "status") {
        return tab === "invoices" ? effectiveInvoiceStatus(item as InvoiceRow) : String((item as ContractRow).status || "Draft");
      }
      const dateField = tab === "invoices"
        ? ((item as InvoiceRow).issued_date || (item as InvoiceRow).created_at)
        : ((item as ContractRow).start_date || (item as ContractRow).created_at);
      return getDateGroupKey(dateField);
    };
    items.forEach((item) => {
      const k = keyOf(item);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(item);
    });

    let keys: string[];
    if (tab === "expenses") {
      keys = Array.from(buckets.keys()).sort((a, b) => b.localeCompare(a));
      if (groupDirection === "asc") keys.reverse();
    } else if (groupBy === "status") {
      const order = tab === "invoices" ? INVOICE_STATUS_ORDER : CONTRACT_STATUS_ORDER;
      keys = order.filter((k) => buckets.has(k)).concat(Array.from(buckets.keys()).filter((k) => !order.includes(k)));
      if (groupDirection === "desc") keys.reverse();
    } else {
      keys = DATE_GROUP_ORDER.filter((k) => buckets.has(k));
      if (groupDirection === "asc") keys.reverse();
    }

    const labelOf = (key: string): string => {
      if (tab === "expenses") return key;
      if (groupBy === "status") {
        return tab === "invoices" ? t(`invoices.statusLabels.${key}`, key) : t(`contracts.statusLabels.${key}`, key);
      }
      return t(DATE_GROUP_I18N_KEYS[key] ?? key, key);
    };

    const result: FlatItem[] = [];
    keys.forEach((key) => {
      const group = buckets.get(key);
      if (!group?.length) return;
      result.push({ kind: "header", label: labelOf(key), count: group.length });
      group.forEach((item) => result.push({ kind: "item", item }));
    });
    return result;
  }, [items, tab, groupBy, groupDirection, t]);

  const totalItems = flatItems.filter((i) => i.kind === "item").length;
  const maxPage = Math.max(0, Math.ceil(totalItems / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalItems <= PAGE_SIZE) return flatItems;
    let count = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: FlatItem[] = [];
    let header: FlatItem | null = null;
    let hCount = 0;
    for (const it of flatItems) {
      if (it.kind === "header") { header = it; hCount = 0; continue; }
      if (count >= start && count < end) { if (header && hCount === 0) result.push(header); result.push(it); hCount++; }
      count++;
      if (count >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalItems]);

  useEffect(() => { setCurrentPage(0); }, [tab, groupBy, groupDirection, items.length]);

  // Scroll selected card into view.
  useEffect(() => {
    if (selectedId == null || !scrollRef.current) return;
    const container = scrollRef.current;
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector(`[data-billing-id="${selectedId}"]`) as HTMLElement | null;
      if (!el) return;
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - 40, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, tab]);

  useFKeyScrollToSelected({
    containerRef: scrollRef,
    selectedId,
    getSelector: (id) => `[data-billing-id="${id}"]`,
  });

  const idOf = (item: BillingItem) => (item as any).id as number;

  const findEl = useCallback((id: string | number) => scrollRef.current?.querySelector(`[data-billing-id="${id}"]`) as HTMLElement | null, []);
  const { hovered, rect, onHover, onHoverEnd, cancelHoverEnd, close } = useCompactHoverCard<BillingItem>(idOf, findEl);

  const renderCard = (item: BillingItem, selected: boolean, onClick: () => void) => {
    if (tab === "invoices") return <InvoiceListCard invoice={item as InvoiceRow} isSelected={selected} onClick={onClick} />;
    if (tab === "contracts") return <ContractListCard contract={item as ContractRow} isSelected={selected} onClick={onClick} />;
    return <ExpenseListCard expense={item as ExpenseRow} isSelected={selected} onClick={onClick} />;
  };

  const compactDot = (item: BillingItem): string => {
    if (tab === "invoices") return (INVOICE_STATUS_COLORS[effectiveInvoiceStatus(item as InvoiceRow)] || INVOICE_STATUS_COLORS.Draft).dot;
    if (tab === "contracts") return (CONTRACT_STATUS_COLORS[String((item as ContractRow).status || "Draft")] || CONTRACT_STATUS_COLORS.Draft).dot;
    return (item as ExpenseRow).nlBtwDeductible ? "var(--good)" : "var(--mute-2)";
  };
  const compactTile = (item: BillingItem) => {
    if (tab === "invoices") return { init: getInitials((item as InvoiceRow).account_name || (item as InvoiceRow).title || "?") };
    if (tab === "contracts") return { icon: <FileText className="h-[18px] w-[18px]" /> };
    return { icon: <Wallet className="h-[18px] w-[18px]" /> };
  };

  const EmptyIcon = tab === "invoices" ? Receipt : tab === "contracts" ? FileText : Wallet;

  const widthClass = isListHidden
    ? cn(isNarrow && selectedId != null ? "hidden" : "flex", "lg:hidden")
    : isListCompact
      ? cn("w-[65px] shrink-0", isNarrow && selectedId != null ? "hidden" : "flex")
      : cn("w-full lg:w-[var(--toolbar-w)] lg:shrink-0", isNarrow && selectedId != null ? "hidden" : "flex");

  return (
    <div className={cn("flex-col bg-panel-list-bg overflow-hidden border-r border-[var(--line)]", widthClass)}>
      {isListCompact ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto la-list-area">
          {loading ? (
            <div className="flex items-center justify-center py-6"><div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" /></div>
          ) : (
            <div className="flex flex-col items-center gap-0">
              {flatItems.map((it) => {
                if (it.kind === "header") return null;
                const id = idOf(it.item);
                const tile = compactTile(it.item);
                return (
                  <div key={id} data-billing-id={id}>
                    <CompactBillingCard
                      init={tile.init} icon={tile.icon} dotColor={compactDot(it.item)}
                      isActive={selectedId === id}
                      onClick={() => onSelect(it.item)}
                      onHover={(r) => onHover(it.item, r)}
                      onHoverEnd={onHoverEnd}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto la-list-area px-2 pt-1.5 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-10"><div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" /></div>
            ) : paginatedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <EmptyIcon className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {tab === "invoices" ? t("invoices.empty.noInvoicesYet") : tab === "contracts" ? t("contracts.empty.noContractsYet") : t("expenses.empty.noExpensesFound")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[6px] pb-2">
                {paginatedItems.map((it, idx) => {
                  if (it.kind === "header") return <GroupBar key={`h-${it.label}-${idx}`} label={it.label} count={it.count} accent={it.accent} sticky />;
                  const id = idOf(it.item);
                  return (
                    <div key={id || idx} data-billing-id={id} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                      {renderCard(it.item, selectedId === id, () => onSelect(it.item))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {totalItems > PAGE_SIZE && (
            <div className="h-9 md:h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
              <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30">{t("toolbar.previous")}</button>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currentPage * PAGE_SIZE + 1}&ndash;{Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} {t("toolbar.of", "of")} {totalItems}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))} disabled={currentPage >= maxPage} className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30">{t("toolbar.next")}</button>
            </div>
          )}
        </>
      )}

      {isListCompact && hovered && (
        <CompactHoverCardPortal rect={rect} onMouseEnter={cancelHoverEnd} onMouseLeave={onHoverEnd}>
          {renderCard(hovered, selectedId === idOf(hovered), () => { onSelect(hovered); close(); })}
        </CompactHoverCardPortal>
      )}
    </div>
  );
}
