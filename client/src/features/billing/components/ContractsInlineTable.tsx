import { useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Check, ChevronUp, ChevronDown } from "lucide-react";
import type { ContractRow } from "../types";
import { CONTRACT_STATUS_COLORS } from "../types";

// ── Deal type colors ────────────────────────────────────────────────────────────

const DEAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  performance:      { bg: "var(--good-tint)", text: "var(--good)" },
  cost_passthrough: { bg: "var(--wine-tint)", text: "var(--wine)" },
  fixed_fee:        { bg: "var(--wine-tint)", text: "var(--wine)" },
  deposit:          { bg: "var(--warn-tint)", text: "var(--warn)" },
  monthly_retainer: { bg: "var(--good-tint)", text: "var(--good)" },
  hybrid:           { bg: "var(--surface)",   text: "var(--mute)" },
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
      <div className="h-8 bg-[var(--bg-2)] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────────

export const CONTRACT_FIELD_DEFS = [
  // ── Default visible ──
  { key: "title",       label: "Title",        tKey: "contracts.table.columns.title",       visible: true  },
  { key: "account",     label: "Account",      tKey: "contracts.table.columns.account",     visible: true  },
  { key: "status",      label: "Status",       tKey: "contracts.table.columns.status",      visible: true  },
  { key: "dealType",    label: "Deal Type",    tKey: "contracts.table.columns.dealType",    visible: true  },
  { key: "startDate",   label: "Start Date",   tKey: "contracts.table.columns.startDate",   visible: true  },
  { key: "endDate",     label: "End Date",     tKey: "contracts.table.columns.endDate",     visible: true  },
  { key: "signedAt",    label: "Signed",       tKey: "contracts.table.columns.signed",      visible: true  },
  // ── Hidden by default ──
  { key: "description", label: "Description",  tKey: "contracts.table.columns.description", visible: false },
  { key: "sentAt",      label: "Sent Date",    tKey: "contracts.table.columns.sentDate",    visible: false },
  { key: "viewedAt",    label: "Viewed Date",  tKey: "contracts.table.columns.viewedDate",  visible: false },
  { key: "viewedCount", label: "Views",        tKey: "contracts.table.columns.views",       visible: false },
  { key: "fileName",    label: "File Name",    tKey: "contracts.table.columns.fileName",    visible: false },
  { key: "fileType",    label: "File Type",    tKey: "contracts.table.columns.fileType",    visible: false },
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
  const { t } = useTranslation("billing");
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
    "px-3 py-2 text-left whitespace-nowrap select-none cursor-pointer"
    + " border-b"
    + " [font-family:var(--mono)] text-[9px] tracking-[0.14em] uppercase font-bold";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Summary stats bar (TOP, above headers) ── */}
      {!loading && (
        <div className="h-[44px] shrink-0 px-4 flex items-center gap-6" style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <span className="text-[11px]" style={{ color: "var(--mute)" }}>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {summaryStats.total}
            </span>{" "}
            {summaryStats.total !== 1
              ? t("contracts.table.summary.contractsPlural")
              : t("contracts.table.summary.contracts")}
          </span>

          <span className="text-[11px]" style={{ color: "var(--mute)" }}>
            {t("contracts.table.summary.signed")}:{" "}
            <span
              className="font-semibold"
              style={{ color: summaryStats.signedCount > 0 ? "var(--good)" : "var(--mute)" }}
            >
              {summaryStats.signedCount}
            </span>
          </span>

          <span className="text-[11px]" style={{ color: "var(--mute)" }}>
            {t("contracts.table.summary.pending")}:{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {summaryStats.pendingCount}
            </span>
          </span>

          <span className="text-[11px]" style={{ color: "var(--mute)" }}>
            {t("contracts.table.summary.active")}:{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {summaryStats.activeCount}
            </span>
          </span>
        </div>
      )}

      {/* ── Table or skeleton ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto" style={{ background: "var(--card)" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 300 }}>

            {/* Sticky header */}
            <thead className="sticky top-0 z-20">
              <tr style={{ background: "var(--bg-2)" }}>
                {/* Checkbox column — always visible */}
                <th
                  className={cn(thBase, "sticky left-0 z-30 text-center cursor-default")}
                  style={{ width: 40, minWidth: 40, background: "var(--bg-2)", borderColor: "var(--line)", color: "var(--mute-2)" }}
                >
                  {/* no label */}
                </th>

                {show("title") && (
                  <th className={thBase} style={{ width: 200, minWidth: 200, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("title")}>
                    {t("contracts.table.columns.title")} <SortIcon col="title" />
                  </th>
                )}
                {show("account") && (
                  <th className={thBase} style={{ width: 160, minWidth: 160, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("account")}>
                    {t("contracts.table.columns.account")} <SortIcon col="account" />
                  </th>
                )}
                {show("status") && (
                  <th className={thBase} style={{ width: 120, minWidth: 120, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("status")}>
                    {t("contracts.table.columns.status")} <SortIcon col="status" />
                  </th>
                )}
                {show("dealType") && (
                  <th className={thBase} style={{ width: 130, minWidth: 130, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("dealType")}>
                    {t("contracts.table.columns.dealType")} <SortIcon col="dealType" />
                  </th>
                )}
                {show("startDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("startDate")}>
                    {t("contracts.table.columns.startDate")} <SortIcon col="startDate" />
                  </th>
                )}
                {show("endDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("endDate")}>
                    {t("contracts.table.columns.endDate")} <SortIcon col="endDate" />
                  </th>
                )}
                {show("signedAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("signedAt")}>
                    {t("contracts.table.columns.signed")} <SortIcon col="signedAt" />
                  </th>
                )}
                {show("description") && (
                  <th className={thBase} style={{ width: 220, minWidth: 220, borderColor: "var(--line)", color: "var(--mute-2)" }}>
                    {t("contracts.table.columns.description")}
                  </th>
                )}
                {show("sentAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("sentAt")}>
                    {t("contracts.table.columns.sentDate")} <SortIcon col="sentAt" />
                  </th>
                )}
                {show("viewedAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("viewedAt")}>
                    {t("contracts.table.columns.viewedDate")} <SortIcon col="viewedAt" />
                  </th>
                )}
                {show("viewedCount") && (
                  <th className={cn(thBase, "text-center")} style={{ width: 70, minWidth: 70 }} onClick={() => handleHeaderClick("viewedCount")}>
                    {t("contracts.table.columns.views")} <SortIcon col="viewedCount" />
                  </th>
                )}
                {show("fileName") && (
                  <th className={thBase} style={{ width: 180, minWidth: 180, borderColor: "var(--line)", color: "var(--mute-2)" }} onClick={() => handleHeaderClick("fileName")}>
                    {t("contracts.table.columns.fileName")} <SortIcon col="fileName" />
                  </th>
                )}
                {show("fileType") && (
                  <th className={thBase} style={{ width: 100, minWidth: 100, borderColor: "var(--line)", color: "var(--mute-2)" }}>
                    {t("contracts.table.columns.fileType")}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {sortedContracts.length === 0 && (
                <tr>
                  <td colSpan={(visibleColumns ? visibleColumns.size : 7) + 1} className="py-12 text-center text-xs text-muted-foreground">
                    {t("contracts.empty.noContractsFound")}
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

                return (
                  <tr
                    key={contract.id}
                    className="group/row cursor-pointer animate-card-enter"
                    style={{
                      height: 62,
                      borderBottom: "1px solid var(--line)",
                      background: isHighlighted ? "var(--surface)" : "transparent",
                      boxShadow: isHighlighted ? "inset 3px 0 0 var(--wine)" : "none",
                      transition: "background 120ms",
                      animationDelay: `${Math.min(index, 15) * 30}ms`,
                    }}
                    onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
                    onMouseLeave={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    onClick={(e) => handleRowClick(contract, index, e)}
                  >
                    {/* Checkbox */}
                    <td
                      className="sticky left-0 z-10 px-2.5"
                      style={{
                        width: 40,
                        minWidth: 40,
                        background: isHighlighted ? "var(--surface)" : "var(--card)",
                      }}
                    >
                      <div
                        className="h-4 w-4 rounded flex items-center justify-center shrink-0 cursor-pointer"
                        style={{
                          border: `1px solid ${isMultiSelected ? "var(--wine)" : "var(--line)"}`,
                          background: isMultiSelected ? "var(--wine)" : "transparent",
                        }}
                        onClick={(e) => handleCheckboxClick(contract, e)}
                      >
                        {isMultiSelected && <Check className="h-2.5 w-2.5" style={{ color: "var(--paper)" }} />}
                      </div>
                    </td>

                    {show("title") && (
                      <td className="px-3" style={{ width: 200, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: "var(--r-button)", flexShrink: 0,
                            background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "var(--mute)",
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13c1-1.4 2.4-1.4 3 0s2 1.4 3 0"/>
                            </svg>
                          </span>
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                            {contract.title ?? <span style={{ color: "var(--mute-2)", fontWeight: 400 }}>{t("contracts.table.untitled")}</span>}
                          </span>
                        </div>
                      </td>
                    )}
                    {show("account") && (
                      <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                        <span className="truncate block" style={{ fontSize: 11, color: "var(--mute)" }}>
                          {contract.account_name ?? <span style={{ color: "var(--mute-2)" }}>{"—"}</span>}
                        </span>
                      </td>
                    )}
                    {show("status") && (
                      <td className="px-3" style={{ width: 120, minWidth: 120 }}>
                        <span
                          className="inline-flex items-center"
                          style={{
                            gap: 5, padding: "3px 9px", borderRadius: "var(--r-pill)",
                            background: statusColors.bg, color: statusColors.text,
                            fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em",
                            textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColors.dot, flexShrink: 0 }} />
                          {contract.status ?? "—"}
                        </span>
                      </td>
                    )}
                    {show("dealType") && (
                      <td className="px-3" style={{ width: 130, minWidth: 130 }}>
                        {dealTypeLabel ? (
                          dealTypeColors ? (
                            <span
                              className="inline-flex items-center whitespace-nowrap"
                              style={{
                                padding: "3px 9px", borderRadius: "var(--r-pill)",
                                background: dealTypeColors.bg, color: dealTypeColors.text,
                                fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em",
                                textTransform: "uppercase", fontWeight: 700,
                              }}
                            >
                              {dealTypeLabel}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--mute)" }}>{dealTypeLabel}</span>
                          )
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{"—"}</span>
                        )}
                      </td>
                    )}
                    {show("startDate") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>{fmtDate(contract.start_date)}</span>
                      </td>
                    )}
                    {show("endDate") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>{fmtDate(contract.end_date)}</span>
                      </td>
                    )}
                    {show("signedAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        {contract.signed_at ? (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--good)" }}>
                            {fmtDate(contract.signed_at)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{"—"}</span>
                        )}
                      </td>
                    )}
                    {show("description") && (
                      <td className="px-3" style={{ width: 220, minWidth: 220 }}>
                        <span className="truncate block max-w-[208px]" style={{ fontSize: 11, color: "var(--mute)" }}>
                          {contract.description ?? <span style={{ color: "var(--mute-2)" }}>{"—"}</span>}
                        </span>
                      </td>
                    )}
                    {show("sentAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>{fmtDate(contract.sent_at)}</span>
                      </td>
                    )}
                    {show("viewedAt") && (
                      <td className="px-3" style={{ width: 110, minWidth: 110 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>{fmtDate(contract.viewed_at)}</span>
                      </td>
                    )}
                    {show("viewedCount") && (
                      <td className="px-3 text-center" style={{ width: 70, minWidth: 70 }}>
                        <span className="tabular-nums" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>
                          {contract.viewed_count ?? <span style={{ color: "var(--mute-2)" }}>0</span>}
                        </span>
                      </td>
                    )}
                    {show("fileName") && (
                      <td className="px-3" style={{ width: 180, minWidth: 180 }}>
                        <span className="truncate block max-w-[168px]" style={{ fontSize: 11, color: "var(--mute)" }}>
                          {contract.file_name ?? <span style={{ color: "var(--mute-2)" }}>{"—"}</span>}
                        </span>
                      </td>
                    )}
                    {show("fileType") && (
                      <td className="px-3" style={{ width: 100, minWidth: 100 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mute)" }}>
                          {contract.file_type ?? <span style={{ color: "var(--mute-2)" }}>{"—"}</span>}
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
