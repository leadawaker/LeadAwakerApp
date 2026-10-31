// The menu down the left of an account tab that is split into sections
// (Phone, Alerts): one tile per section with a state dot and the one fact that
// matters. A tile opens its section. On desktop the tiles stand in a column
// that stays in place below the account header; on a phone they sit in a
// grid above the open section. The open tile looks like a selected list card.
import type { ReactNode } from "react";

export type SectionState = "on" | "pending" | "off";

const DOT: Record<SectionState, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

/** A tile at a corner of the menu takes the menu's radius, so the selected outline follows the rounded edge. */
function tileRadius(i: number, count: number, cols: number): string {
  const firstRow = i < cols;
  const lastRow = i >= count - (count % cols || cols);
  const left = i % cols === 0;
  const right = i % cols === cols - 1 || i === count - 1;
  const r = (on: boolean) => (on ? "var(--r-card)" : "0");
  return `${r(firstRow && left)} ${r(firstRow && right)} ${r(lastRow && right)} ${r(lastRow && left)}`;
}

export interface SectionRailItem<K extends string> {
  key: K;
  icon: ReactNode;
  label: string;
  detail: string;
  /** No state: no dot (a section that is an action, not a setting). */
  state?: SectionState;
  /** Open problems in this section (e.g. failed runs): a red count in place of the dot. */
  alerts?: number;
  /** Read out for the red count ("3 open failures"). */
  alertsLabel?: string;
  /** Id of the panel this tile opens (aria-controls). */
  controls?: string;
}

export function SectionRail<K extends string>({ items, active, onSelect, layout, testId, ariaLabel }: {
  items: SectionRailItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  layout: "rail" | "grid";
  testId: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className="neu-raised"
      // The 1px gap over a line-coloured ground draws the dividers, so they stay right when the tiles wrap.
      style={{
        borderRadius: "var(--r-card)", background: "var(--line-strong)", display: "grid", gap: 1, overflow: "hidden",
        gridTemplateColumns: layout === "rail" ? "1fr" : "1fr 1fr",
      }}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={layout === "rail" ? "vertical" : "horizontal"}
      data-testid={testId}
    >
      {items.map((item, i) => {
        const on = item.key === active;
        // An odd count leaves the last tile alone on its row in the grid: let it span.
        const span = layout === "grid" && items.length % 2 === 1 && i === items.length - 1;
        const cols = layout === "grid" ? 2 : 1;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={item.controls}
            onClick={() => onSelect(item.key)}
            data-testid={`${testId}-${item.key}`}
            style={{
              display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
              padding: layout === "grid" ? "13px 14px" : "15px 18px", border: 0, minWidth: 0,
              background: on ? "var(--list-selected)" : "var(--card)",
              boxShadow: on ? "inset 0 0 0 1px var(--wine-soft)" : undefined,
              borderRadius: tileRadius(i, items.length, cols),
              gridColumn: span ? "1 / -1" : undefined,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: on ? "var(--wine)" : "var(--mute)", width: "100%" }}>
              {item.icon}
              <span style={{ fontSize: 14, fontWeight: 700, color: on ? "var(--wine)" : "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.alerts ? (
                <span
                  title={item.alertsLabel}
                  aria-label={item.alertsLabel}
                  style={{
                    minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    background: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))",
                  }}
                >
                  {item.alerts > 99 ? "99+" : item.alerts}
                </span>
              ) : item.state && <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[item.state], flexShrink: 0 }} />}
            </span>
            <span style={{ fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {item.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A section's numbered heading with one line on what it is for. */
export function SectionHeader({ index, title, help }: { index: number; title: string; help: string }) {
  return (
    <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", padding: "0 4px 10px", borderBottom: "1px solid var(--line)" }}>
      <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>{String(index).padStart(2, "0")}</span>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{title}</h3>
      <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{help}</span>
    </header>
  );
}

/** Rail and open section side by side on desktop, stacked on a phone. */
export function SectionLayout({ stacked, rail, children, testId }: {
  stacked: boolean; rail: (layout: "rail" | "grid") => ReactNode; children: ReactNode; testId?: string;
}) {
  if (stacked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }} data-testid={testId}>
        {rail("grid")}
        {children}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 28, alignItems: "start" }} data-testid={testId}>
      {/* --ws-sticky-top is the account header's height (AccountsWorkspace). The 32px is the gap the
          workspace puts under the header, so the menu sticks exactly where it starts and never shifts. */}
      <div style={{ position: "sticky", top: "calc(var(--ws-sticky-top, 0px) + 32px)" }}>{rail("rail")}</div>
      {children}
    </div>
  );
}
