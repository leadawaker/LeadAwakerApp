import { Fragment } from "react";
import type { ProspectRow } from "../../prospectRows";
import type { SessionSort, SortKey } from "../../sessionsView";
import type { LabelledGroup } from "../sessions/useDateGroups";
import { DateGroupRow } from "./DateGroupRow";
import { ProspectTableRow } from "./ProspectTableRow";
import { columnWidths, SessionsTableHead } from "./SessionsTableHead";

/**
 * The Demos table: one row per prospect, one column per service. Rows arrive filtered and sorted;
 * `groups` (when sorted by Sent) lays them under date headings, else the list is flat.
 */
export function SessionsTable({ rows, groups, sort, onSort, highlightKey, onOpenRow, onOpenClient }: {
  rows: ProspectRow[];
  groups: LabelledGroup[] | null;
  sort: SessionSort;
  onSort: (key: SortKey) => void;
  highlightKey: string | null;
  onOpenRow: (key: string) => void;
  onOpenClient: (niche: string) => void;
}) {
  // The column only earns its width when some link has no column of its own.
  const showOther = rows.some((r) => r.extra.length > 0);
  const widths = columnWidths(showOther);
  const minWidth = widths.reduce((n, w) => n + w, 0);

  const renderRow = (row: ProspectRow) => (
    <ProspectTableRow
      key={row.key}
      row={row}
      highlighted={row.key === highlightKey}
      showOther={showOther}
      onOpenRow={onOpenRow}
      onOpenClient={onOpenClient}
    />
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0 3px", minWidth }}>
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w, minWidth: w }} />
          ))}
        </colgroup>
        <SessionsTableHead showOther={showOther} sort={sort} onSort={onSort} />
        <tbody>
          {groups
            ? groups.map((g) => (
                <Fragment key={g.key}>
                  <DateGroupRow label={g.label} count={g.rows.length} span={widths.length} />
                  {g.rows.map(renderRow)}
                </Fragment>
              ))
            : rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
