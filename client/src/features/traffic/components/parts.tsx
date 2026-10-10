import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Card header: icon tile, title, one line saying where the numbers come from. */
export function CardHead({ icon: Icon, title, caption, right }: { icon: LucideIcon; title: string; caption?: ReactNode; right?: ReactNode }) {
  return (
    <div className="tf-card-head">
      <span className="tf-icon-tile"><Icon className="w-4 h-4" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tf-card-title">{title}</div>
        {caption && <div className="tf-card-caption">{caption}</div>}
      </div>
      {right}
    </div>
  );
}

/** A titled group inside a card. */
export function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="tf-block">
      <div className="tf-block-head">
        <span className="tf-block-title">{title}</span>
        {right && <span className="tf-mono">{right}</span>}
      </div>
      {children}
    </div>
  );
}

export interface DayBar {
  date: string;
  /** Height of the bar. */
  value: number;
  /** The solid part of the bar (defaults to all of it). */
  solid?: number;
  title: string;
}

/** One bar per day, oldest left. A dot marks a day with nothing. */
export function DayBars({ days, startLabel, endLabel }: { days: DayBar[]; startLabel: string; endLabel: string }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div>
      <div className="tf-bars" style={{ "--tf-gap": days.length > 40 ? "1px" : "3px" } as CSSProperties}>
        {days.map((d, i) => (
          <div key={d.date} className="tf-bar-col" title={d.title}>
            {d.value === 0 ? (
              <span className="tf-bar-empty" />
            ) : (
              <div className="tf-bar" style={{ height: `${Math.max(8, Math.round((d.value / max) * 100))}%`, animationDelay: `${Math.min(i, 40) * 12}ms` }}>
                <i style={{ height: `${Math.round(((d.solid ?? d.value) / d.value) * 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="tf-mono tf-bars-axis" style={{ marginTop: 6 }}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

export interface RankItem {
  key: string;
  name: ReactNode;
  value: number;
  /** Shown small after the number. */
  note?: string;
  title?: string;
}

/** Rows ordered by size, each with a bar behind it as wide as its share of the largest. */
export function RankList({ items, format }: { items: RankItem[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="tf-rank">
      {items.map((item) => (
        <div key={item.key} className="tf-rank-row" style={{ "--tf-pct": `${Math.round((item.value / max) * 100)}%` } as CSSProperties} title={item.title}>
          <div className="tf-rank-name">{item.name}</div>
          <div className="tf-rank-num">{format(item.value)}{item.note && <small>{item.note}</small>}</div>
        </div>
      ))}
    </div>
  );
}
