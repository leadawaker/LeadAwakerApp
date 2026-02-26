import { useState, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronUp, ChevronDown } from "lucide-react";
import type { ContractRow } from "../types";
import { CONTRACT_STATUS_COLORS } from "../types";

// ── Deal type colors ────────────────────────────────────────────────────────────

const DEAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  performance:      { bg: "#D1FAE5", text: "#065F46" },
  cost_passthrough: { bg: "#DBEAFE", text: "#1D4ED8" },
  fixed_fee:        { bg: "#EDE9FE", text: "#5B21B6" },
  deposit:          { bg: "#FEF3C7", text: "#92400E" },
  monthly_retainer: { bg: "#F0FDF4", text: "#166534" },
  hybrid:           { bg: "#FFF7ED", text: "#9A3412" },
};

function formatDealType(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Date helper ────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ── Sort types ─────────────────────────────────────────────────────────────────

type SortKey =
  | "title" | "account" | "status" | "dealType"
  | "startDate" | "endDate" | "signedAt"
  | "sentAt" | "viewedAt" | "viewedCount" | "fileName";
type SortDir = "asc" | "desc";

// ── Skeleton ───────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────────

export const CONTRACT_FIELD_DEFS = [
  // ── Default visible ──
  { key: "title",       label: "Title",        visible: true  },
  { key: "account",     label: "Account",      visible: true  },
  { key: "status",      label: "Status",       visible: true  },
  { key: "dealType",    label: "Deal Type",    visible: true  },
  { key: "startDate",   label: "Start Date",   visible: true  },
  { key: "endDate",     label: "End Date",     visible: true  },
  { key: "signedAt",    label: "Signed",       visible: true  },
  // ── Hidden by default ──
  { key: "description", label: "Description",  visible: false },
  { key: "sentAt",      label: "Sent Date",    visible: false },
  { key: "viewedAt",    label: "Viewed Date",  visible: false },
  { key: "viewedCount", label: "Views",        visible: false },
  { key: "fileName",    label: "File Name",    visible: false },
  { key: "fileType",    label: "File Type",    visible: false },
] as const;

/** Columns visible by default */
export const DEFAULT_CONTRACT_COLS = new Set(
  CONTRACT_FIELD_DEFS.filter((c) => c.visible).map((c) => c.key)
);

/** All possible columns */
export const ALL_CONTRACT_COLS = new Set(CONTRACT_FIELD_DEFS.map((c) => c.key));

// ── Props ──────────────────────────────────────────────────────────────────────

interface ContractsInlineTableProps {
  contracts: ContractRow[];
  loading: boolean;
  selectedContract: ContractRow | null;
  onSelectContract: (contract: ContractRow) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  visibleColumns?: Set<string>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ContractsInlineTable({
  contracts,
  loading,
  selectedContract,
  onSelectContract,
  selectedIds,
  onSelectionChange,
  visibleColumns,
}: ContractsInlineTableProps) {
  const show = (col: string) => !visibleColumns || visibleColumns.has(col);
  const [sortKey, setSortKey] = useState<SortKey>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const lastClickedIndexRef = useRef<number>(-1);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleHeaderClick = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sortedContracts = useMemo(() => {
    const arr = [...contracts];
    arr.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortKey) {
        case "title":
          aVal = a.title ?? "";
          bVal = b.title ?? "";
          break;
        case "account":
          aVal = a.account_name ?? "";
          bVal = b.account_name ?? "";
          break;
        case "status":
          aVal = a.status ?? "";
          bVal = b.status ?? "";
          break;
        case "dealType":
          aVal = a.deal_type ?? "";
          bVal = b.deal_type ?? "";
          break;
        case "startDate":
          aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
          bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
          break;
        case "endDate":
          aVal = a.end_date ? new Date(a.end_date).getTime() : 0;
          bVal = b.end_date ? new Date(b.end_date).getTime() : 0;
          break;
        case "signedAt":
          aVal = a.signed_at ? new Date(a.signed_at).getTime() : 0;
          bVal = b.signed_at ? new Date(b.signed_at).getTime() : 0;
          break;
        case "sentAt":
          aVal = a.sent_at ? new Date(a.sent_at).getTime() : 0;
          bVal = b.sent_at ? new Date(b.sent_at).getTime() : 0;
          break;
        case "viewedAt":
          aVal = a.viewed_at ? new Date(a.viewed_at).getTime() : 0;
          bVal = b.viewed_at ? new Date(b.viewed_at).getTime() : 0;
          break;
        case "viewedCount":
          aVal = a.viewed_count ?? 0;
          bVal = b.viewed_count ?? 0;
          break;
        case "fileName":
          aVal = a.file_name ?? "";
          bVal = b.file_name ?? "";
          break;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [contracts, sortKey, sortDir]);

  // ── Row click handler ──────────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (contract: ContractRow, index: number, e: React.MouseEvent) => {
      const id = contract.id;

      if (e.shiftKey && lastClickedIndexRef.current >= 0) {
        const lo = Math.min(lastClickedIndexRef.current, index);
        const hi = Math.max(lastClickedIndexRef.current, index);
        const rangeIds = sortedContracts.slice(lo, hi + 1).map((c) => c.id);
        const next = new Set(selectedIds);
        rangeIds.forEach((rid) => next.add(rid));
        onSelectionChange(next);
        if (next.size === 1) {
          const only = sortedContracts.find((c) => c.id === Array.from(next)[0]);
          if (only) onSelectContract(only);
        }
      } else if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        onSelectionChange(next);
        if (next.size === 1) {
          const only = sortedContracts.find((c) => c.id === Array.from(next)[0]);
          if (only) onSelectContract(only);
        }
        lastClickedIndexRef.current = index;
      } else {
        onSelectionChange(new Set([id]));
        onSelectContract(contract);
        lastClickedIndexRef.current = index;
      }
    },
    [sortedContracts, selectedIds, onSelectionChange, onSelectContract]
  );

  // ── Checkbox toggle ────────────────────────────────────────────────────────
  const handleCheckboxClick = useCallback(
    (contract: ContractRow, e: React.MouseEvent) => {
      e.stopPropagation();
      const id = contract.id;
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
      if (next.size === 1) {
        const only = sortedContracts.find((c) => c.id === Array.from(next)[0]);
        if (only) onSelectContract(only);
      }
    },
    [selectedIds, sortedContracts, onSelectionChange, onSelectContract]
  );

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const total = sortedContracts.length;
    const signedCount = sortedContracts.filter((c) => c.status === "Signed").length;
    const pendingCount = sortedContracts.filter(
      (c) => c.status === "Sent" || c.status === "Viewed"
    ).length;
    const activeCount = sortedContracts.filter(
      (c) => c.status !== "Expired" && c.status !== "Cancelled"
    ).length;
    return { total, signedCount, pendingCount, activeCount };
  }, [sortedContracts]);

  // ── Sort icon helper ───────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline-block ml-0.5 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 inline-block ml-0.5 shrink-0" />
    );
  }

  const thBase =
    "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20 cursor-pointer hover:text-foreground/70";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Summary stats bar (TOP, above headers) ── */}
      {!loading && (
        <div className="h-[44px] shrink-0 px-4 flex items-center gap-6 border-b border-border/20 bg-muted/60">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {summaryStats.total}
            </span>{" "}
            contract{summaryStats.total !== 1 ? "s" : ""}
          </span>

          <span className="text-[11px] text-muted-foreground">
            Signed:{" "}
            <span
              className="font-semibold"
              style={{ color: summaryStats.signedCount > 0 ? "#065F46" : undefined }}
            >
              {summaryStats.signedCount}
            </span>
          </span>

          <span className="text-[11px] text-muted-foreground">
            Pending:{" "}
            <span className="font-semibold text-foreground">
              {summaryStats.pendingCount}
            </span>
          </span>

          <span className="text-[11px] text-muted-foreground">
            Active:{" "}
            <span className="font-semibold text-foreground">
              {summaryStats.activeCount}
            </span>
          </span>
        </div>
      )}

      {/* ── Table or skeleton ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 300 }}>

            {/* Sticky header */}
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Checkbox column — always visible */}
                <th
                  className={cn(thBase, "sticky left-0 z-30 text-center cursor-default")}
                  style={{ width: 40, minWidth: 40 }}
                >
                  {/* no label */}
                </th>

                {show("title") && (
                  <th className={thBase} style={{ width: 200, minWidth: 200 }} onClick={() => handleHeaderClick("title")}>
                    Title <SortIcon col="title" />
                  </th>
                )}
                {show("account") && (
                  <th className={thBase} style={{ width: 160, minWidth: 160 }} onClick={() => handleHeaderClick("account")}>
                    Account <SortIcon col="account" />
                  </th>
                )}
                {show("status") && (
                  <th className={thBase} style={{ width: 120, minWidth: 120 }} onClick={() => handleHeaderClick("status")}>
                    Status <SortIcon col="status" />
                  </th>
                )}
                {show("dealType") && (
                  <th className={thBase} style={{ width: 130, minWidth: 130 }} onClick={() => handleHeaderClick("dealType")}>
                    Deal Type <SortIcon col="dealType" />
                  </th>
                )}
                {show("startDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("startDate")}>
                    Start <SortIcon col="startDate" />
                  </th>
                )}
                {show("endDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("endDate")}>
                    End <SortIcon col="endDate" />
                  </th>
                )}
                {show("signedAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("signedAt")}>
                    Signed <SortIcon col="signedAt" />
                  </th>
                )}
                {show("description") && (
                  <th className={thBase} style={{ width: 220, minWidth: 220 }}>
                    Description
                  </th>
                )}
                {show("sentAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("sentAt")}>
                    Sent <SortIcon col="sentAt" />
                  </th>
                )}
                {show("viewedAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("viewedAt")}>
                    Viewed <SortIcon col="viewedAt" />
                  </th>
                )}
                {show("viewedCount") && (
                  <th className={cn(thBase, "text-center")} style={{ width: 70, minWidth: 70 }} onClick={() => handleHeaderClick("viewedCount")}>
                    Views <SortIcon col="viewedCount" />
                  </th>
                )}
                {show("fileName") && (
                  <th className={thBase} style={{ width: 180, minWidth: 180 }} onClick={() => handleHeaderClick("fileName")}>
                    File Name <SortIcon col="fileName" />
                  </th>
                )}
                {show("fileType") && (
                  <th className={thBase} style={{ width: 100, minWidth: 100 }}>
                    File Type
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {sortedContracts.length === 0 && (
                <tr>
                  <td colSpan={(visibleColumns ? visibleColumns.size : 7) + 1} className="py-12 text-center text-xs text-muted-foreground">
                    No contracts found
                  </td>
                </tr>
              )}

              {sortedContracts.map((contract, index) => {
                const isDetailSelected = selectedContract?.id === contract.id;
                const isMultiSelected = selectedIds.has(contract.id);
                const isHighlighted = isMultiSelected || isDetailSelected;

                const statusColors = CONTRACT_STATUS_COLORS[contract.status ?? ""] ?? {
                  bg: "#F4F4F5",
                  text: "#52525B",
                  dot: "#94A3B8",
                };

                const dealTypeKey = contract.deal_type ?? "";
                const dealTypeColors = DEAL_TYPE_COLORS[dealTypeKey] ?? null;
                const dealTypeLabel = formatDealType(contract.deal_type);

                const rowBg = isHighlighted ? "#FFF1C8" : "#F1F1F1";
                const rowHoverClass = isHighlighted ? "" : "hover:bg-[#F8F8F8]";

                return (
                  <tr
                    key={contract.id}
                    className={cn(
                      "group/row cursor-pointer h-[52px] border-b border-border/15",
                      rowHoverClass,
                    )}
                    style={{ backgroundColor: rowBg }}
                    onClick={(e) => handleRowClick(contract, index, e)}
                  >
                    {/* Checkbox */}
                    <td
                      className="sticky left-0 z-10 px-2.5"
                      style={{
                        width: 40,
                        minWidth: 40,
                        backgroundColor: isHighlighted ? "#FFF1C8" : undefined,
                      }}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                          isMultiSelected
                            ? "border-brand-indigo bg-brand-indigo"
                            : "border-border/40 group-hover/row:border-border/60"
                        )}
                        onClick={(e) => handleCheckboxClick(contract, e)}
                      >
                        {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </td>

                    {show("title") && (
                      <td className="px-3" style={{ width: 200, minWidth: 200 }}>
                        <span className="text-[12px] font-medium text-foreground truncate block">
                          {contract.title ?? <span className="text-muted-foreground/30 font-normal">Untitled</span>}
                        </span>
                      </td>
                    )}
                    {show("account") && (
                      <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {contract.account_name ?? <span className="text-muted-foreground/30">—</span>}
                        </span>
                      </td>
                    )}
                    {show("status") && (
                      <td className="px-3" style={{ width: 120, minWidth: 120 }}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColors.dot }} />
                          <span className="text-[11px] font-medium" style={{ color: statusColors.text }}>
                            {contract.status ?? "—"}
                          </span>
                        </div>
                      </td>
                    )}
                    {show("dealType") && (
                      <td className="px-3" style={{ width: 130, minWidth: 130 }}>
                        {dealTypeLabel ? (
                          dealTypeColors ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                              style={{ backgroundColor: dealTypeColors.bg, color: dealTypeColors.text }}
                            >
                              {dealTypeLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">{dealTypeLabel}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground/30 text-[11px]">—</span>
                        )}
                      </td>
                    )}
                    {show("startDate") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(contract.start_date)}</span>
                      </td>
                    )}
                    {show("endDate") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(contract.end_date)}</span>
                      </td>
                    )}
                    {show("signedAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        {contract.signed_at ? (
                          <span className="text-[11px] font-medium" style={{ color: "#065F46" }}>
                            {fmtDate(contract.signed_at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-[11px]">—</span>
                        )}
                      </td>
                    )}
                    {show("description") && (
                      <td className="px-3" style={{ width: 220, minWidth: 220 }}>
                        <span className="text-[11px] text-muted-foreground truncate block max-w-[208px]">
                          {contract.description ?? <span className="opacity-30">—</span>}
                        </span>
                      </td>
                    )}
                    {show("sentAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(contract.sent_at)}</span>
                      </td>
                    )}
                    {show("viewedAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(contract.viewed_at)}</span>
                      </td>
                    )}
                    {show("viewedCount") && (
                      <td className="px-3 text-center" style={{ width: 70, minWidth: 70 }}>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {contract.viewed_count ?? <span className="opacity-30">0</span>}
                        </span>
                      </td>
                    )}
                    {show("fileName") && (
                      <td className="px-3" style={{ width: 180, minWidth: 180 }}>
                        <span className="text-[11px] text-muted-foreground truncate block max-w-[168px]">
                          {contract.file_name ?? <span className="opacity-30">—</span>}
                        </span>
                      </td>
                    )}
                    {show("fileType") && (
                      <td className="px-3" style={{ width: 100, minWidth: 100 }}>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          {contract.file_type ?? <span className="opacity-30">—</span>}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
