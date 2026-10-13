import type { ReactNode } from "react";
import { barWidths } from "../lib/homeFormat";

function Row({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return onClick
    ? <button type="button" className="home-row" onClick={onClick}>{children}</button>
    : <div className="home-row">{children}</div>;
}

export function BarList({ rows, columns }: {
  rows: { key: string; label: string; icon?: ReactNode; value: number; extra?: ReactNode; sub?: string; onClick?: () => void }[];
  columns?: [string, string];
}) {
  const widths = barWidths(rows.map((r) => r.value));
  const numStyle = { fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--ink)" } as const;
  return (
    <div>
      {columns && (
        <div className="eyebrow eyebrow-sm" style={{ display: "flex", justifyContent: "flex-end", gap: 16, paddingBottom: 6 }}>
          <span>{columns[0]}</span>
          <span>{columns[1]}</span>
        </div>
      )}
      {rows.map((r, i) => (
        <Row key={r.key} onClick={r.onClick}>
          {r.icon && <span style={{ display: "flex", color: "var(--mute)" }}>{r.icon}</span>}
          <span style={{ flex: "0 0 30%", minWidth: 0, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.label}
            {r.sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--mute)", whiteSpace: "normal" }}>{r.sub}</span>}
          </span>
          <div className="home-bar" style={{ flex: 1 }}><span style={{ width: `${widths[i]}%` }} /></div>
          <span style={{ ...numStyle, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <span>{r.value.toLocaleString()}</span>
            {r.extra !== undefined && <span style={{ color: "var(--mute)" }}>{r.extra}</span>}
          </span>
        </Row>
      ))}
    </div>
  );
}
