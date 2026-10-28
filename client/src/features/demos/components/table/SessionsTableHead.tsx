import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ariaSort, type SessionSort, type SortKey } from "../../sessionsView";
import { SERVICES } from "../../services";
import { LINK_COLUMNS } from "../../tableColumns";

// Fixed column widths: with table-layout fixed the header and the body always line up.
const LEAD_COLS = [
  // The homepage thumbnail is an identifier, not content: a row of sites is far faster to scan than a row of names.
  { key: "site", width: 72, sortKey: null },
  { key: "prospect", width: 140, sortKey: "prospect" },
  { key: "company", width: 150, sortKey: "company" },
] as const;
const LINK_WIDTH = 128;
// Two pills stacked, and the longest header ("DBR / Quote") with its icon and sort arrow.
const DBR_QUOTE_WIDTH = 136;
const OTHER_WIDTH = 92;
const TAIL_COLS = [
  { key: "lastActivity", width: 128, sortKey: "lastActivity" },
  { key: "sent", width: 92, sortKey: "sent" },
] as const;

/** Every column's width, in order; `showOther` adds the Other column before the two dates. */
export function columnWidths(showOther: boolean): number[] {
  return [
    ...LEAD_COLS.map((c) => c.width),
    ...LINK_COLUMNS.map((c) => (c.key === "dbrQuote" ? DBR_QUOTE_WIDTH : LINK_WIDTH)),
    ...(showOther ? [OTHER_WIDTH] : []),
    ...TAIL_COLS.map((c) => c.width),
  ];
}

// Sticky with an opaque background: with borderSpacing the rows would otherwise show through the gaps as they pass behind it.
const HEAD = "sticky top-0 z-10 select-none whitespace-nowrap border-b border-border/20 bg-muted px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50";

/** A column header that sorts: a click sorts by it, a second click flips the direction, an arrow shows which. */
function SortTh({ sortKey, sort, onSort, children }: {
  sortKey: SortKey;
  sort: SessionSort;
  onSort: (key: SortKey) => void;
  children: ReactNode;
}) {
  const dir = ariaSort(sort, sortKey);
  const Arrow = dir === "descending" ? ArrowDown : ArrowUp;
  return (
    <th aria-sort={dir === "none" ? undefined : dir} className={HEAD}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="group flex w-full min-w-0 items-center gap-1 text-left uppercase hover:text-[var(--wine)] max-md:min-h-11"
        style={{ transition: "color 120ms" }}
      >
        <span className="flex min-w-0 items-center gap-1 truncate">{children}</span>
        <Arrow
          size={11}
          aria-hidden
          className={cn("shrink-0", dir === "none" ? "opacity-0 group-hover:opacity-40" : "text-[var(--wine)]")}
          style={{ transition: "opacity 120ms" }}
        />
      </button>
    </th>
  );
}

/** The table's header row: every column but Site and Other sorts. */
export function SessionsTableHead({ showOther, sort, onSort }: { showOther: boolean; sort: SessionSort; onSort: (key: SortKey) => void }) {
  const { t } = useTranslation("demos");
  const cell = (c: { key: string; sortKey: SortKey | null }) =>
    c.sortKey ? (
      <SortTh key={c.key} sortKey={c.sortKey} sort={sort} onSort={onSort}>
        {t(`table.${c.key}`)}
      </SortTh>
    ) : (
      <th key={c.key} className={HEAD}>
        {t(`table.${c.key}`)}
      </th>
    );
  return (
    <thead>
      <tr>
        {LEAD_COLS.map(cell)}
        {LINK_COLUMNS.map((c) => {
          const Icon = SERVICES.find((s) => s.key === c.services[0])?.icon;
          return (
            <SortTh key={c.key} sortKey={c.key} sort={sort} onSort={onSort}>
              {Icon && <Icon size={11} className="shrink-0" />}
              <span className="truncate">{t(c.labelKey)}</span>
            </SortTh>
          );
        })}
        {showOther && <th className={HEAD}>{t("table.other")}</th>}
        {TAIL_COLS.map(cell)}
      </tr>
    </thead>
  );
}
