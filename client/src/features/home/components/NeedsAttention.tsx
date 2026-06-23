import { HomeIcon, type HomeIconName } from "../icons";
import { SectionLabel } from "./atoms";

export interface NeedsRowData {
  id: number;
  sevColor: string;
  icon: HomeIconName;
  svcColor: string;
  svcName: string;
  title: string;
  who: string;
  snippet: string;
  time: string;
}

function Row({ row, last, actionLabel, onOpen }: { row: NeedsRowData; last: boolean; actionLabel: string; onOpen: () => void }) {
  const quoted = row.snippet.startsWith("“") || row.snippet.startsWith('"');
  return (
    <div
      className="home-needs-row row"
      style={{ gap: 12, padding: "13px 8px", borderBottom: last ? "none" : "1px solid var(--line)", borderRadius: "var(--r-surface)", transition: "background 120ms" }}
      data-testid={`home-need-${row.id}`}
    >
      <span
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "var(--r-surface)",
          background: row.sevColor,
          color: "var(--paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--sh-raised-crisp)",
        }}
      >
        <HomeIcon name={row.icon} size={17} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {row.title}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 3, fontSize: 12, color: "var(--mute)", minWidth: 0 }}>
          <span style={{ color: "var(--ink-soft)", fontWeight: 500, flexShrink: 0 }}>{row.who}</span>
          <span style={{ color: "var(--mute-2)" }}>·</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: quoted ? "italic" : "normal" }}>
            {row.snippet}
          </span>
        </div>
      </div>

      <div className="hidden md:flex" style={{ width: 96, flexShrink: 0 }}>
        <span className="home-tag" style={{ color: row.svcColor }}>{row.svcName}</span>
      </div>

      <span
        className="hidden sm:block"
        style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", whiteSpace: "nowrap", width: 48, textAlign: "left", flexShrink: 0 }}
      >
        {row.time}
      </span>

      <button type="button" onClick={onOpen} className="la-btn la-btn--soft" style={{ flexShrink: 0, width: 92, justifyContent: "center" }}>
        {actionLabel}
      </button>
    </div>
  );
}

export function NeedsAttention({
  title,
  count,
  viewAllLabel,
  actionLabel,
  emptyLabel,
  rows,
  onViewAll,
  onOpenRow,
}: {
  title: string;
  count: number;
  viewAllLabel: string;
  actionLabel: string;
  emptyLabel: string;
  rows: NeedsRowData[];
  onViewAll?: () => void;
  onOpenRow: (row: NeedsRowData) => void;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        boxShadow: "var(--sh-raised-medium)",
        borderRadius: "var(--r-card)",
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <SectionLabel
        text={title}
        count={count}
        style={{ padding: "0 8px" }}
        right={
          <button type="button" onClick={onViewAll} className="la-btn la-btn--soft">
            {viewAllLabel}
          </button>
        }
      />

      {rows.length === 0 ? (
        <div style={{ padding: "28px 8px", fontSize: 13, color: "var(--mute)", textAlign: "center" }}>{emptyLabel}</div>
      ) : (
        rows.map((row, i) => (
          <Row key={row.id} row={row} last={i === rows.length - 1} actionLabel={actionLabel} onOpen={() => onOpenRow(row)} />
        ))
      )}
    </div>
  );
}
