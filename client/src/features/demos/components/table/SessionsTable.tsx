import { useTranslation } from "react-i18next";
import type { ProspectRow } from "../../prospectRows";
import { SERVICES } from "../../services";
import { LINK_COLUMNS } from "../../tableColumns";
import { ProspectTableRow } from "./ProspectTableRow";

// Fixed column widths: with table-layout fixed the header and the body always line up.
const LEAD_COLS = [
  // The homepage thumbnail is an identifier, not content: a row of sites is far faster to scan than a row of names.
  { key: "site", width: 72 },
  { key: "prospect", width: 140 },
  { key: "company", width: 150 },
  { key: "client", width: 140 },
] as const;
const LINK_WIDTH = 128;
const OTHER_WIDTH = 92;
const TAIL_COLS = [
  { key: "lastActivity", width: 100 },
  { key: "sent", width: 84 },
] as const;

// Sticky with an opaque background: with borderSpacing the rows would otherwise show through the gaps as they pass behind it.
const HEAD = "sticky top-0 z-10 select-none whitespace-nowrap border-b border-border/20 bg-muted px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50";

/** The Demos table: one row per prospect, one column per service. Rows arrive filtered and sorted. */
export function SessionsTable({ rows, highlightKey, onOpenRow, onOpenClient }: {
  rows: ProspectRow[];
  highlightKey: string | null;
  onOpenRow: (key: string) => void;
  onOpenClient: (niche: string) => void;
}) {
  const { t } = useTranslation("demos");
  // The column only earns its width when some link has no column of its own.
  const showOther = rows.some((r) => r.extra.length > 0);

  const widths = [
    ...LEAD_COLS.map((c) => c.width),
    ...LINK_COLUMNS.map(() => LINK_WIDTH),
    ...(showOther ? [OTHER_WIDTH] : []),
    ...TAIL_COLS.map((c) => c.width),
  ];
  const minWidth = widths.reduce((n, w) => n + w, 0);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0 3px", minWidth }}>
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w, minWidth: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {LEAD_COLS.map((c) => (
              <th key={c.key} className={HEAD}>
                {t(`table.${c.key}`)}
              </th>
            ))}
            {LINK_COLUMNS.map((c) => {
              const Icon = SERVICES.find((s) => s.key === c.services[0])?.icon;
              return (
                <th key={c.key} className={HEAD}>
                  <span className="flex items-center gap-1">
                    {Icon && <Icon size={11} />}
                    {t(c.labelKey)}
                  </span>
                </th>
              );
            })}
            {showOther && <th className={HEAD}>{t("table.other")}</th>}
            {TAIL_COLS.map((c) => (
              <th key={c.key} className={HEAD}>
                {t(`table.${c.key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ProspectTableRow
              key={row.key}
              row={row}
              highlighted={row.key === highlightKey}
              showOther={showOther}
              onOpenRow={onOpenRow}
              onOpenClient={onOpenClient}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
