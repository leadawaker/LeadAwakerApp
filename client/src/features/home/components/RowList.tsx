import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const DAY_MS = 86_400_000;

/** Relative time ("3 hours ago") under 7 days, a plain date after that. */
export function timeAgo(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  if (abs >= 7 * DAY_MS) return new Date(then).toLocaleDateString(locale);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60_000) return rtf.format(0, "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY_MS) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / DAY_MS), "day");
}

export interface RowListItem {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
  tag?: ReactNode;
  time: string;
  onClick?: () => void;
  /** Leading icon on a tinted square (the row's channel). */
  icon?: { icon: LucideIcon; tone: string };
  /** Shows a small "x" (on hover, always on touch); double-clicking the icon does the same. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function RowList({ rows, empty }: { rows: RowListItem[]; empty: string }) {
  const { i18n } = useTranslation();
  if (rows.length === 0) {
    return <div style={{ color: "var(--mute)", fontSize: 13.5, padding: "12px 4px" }}>{empty}</div>;
  }
  return (
    <div>
      {rows.map((r) => {
        const Icon = r.icon?.icon;
        const iconEl = Icon && r.icon && (
          <span aria-hidden="true" onDoubleClick={r.onDismiss} title={r.onDismiss ? r.dismissLabel : undefined} style={{
            width: 30, height: 30, flexShrink: 0, borderRadius: "var(--r-button)", display: "flex", alignItems: "center", justifyContent: "center",
            background: `color-mix(in srgb, ${r.icon.tone} 14%, transparent)`, color: `color-mix(in srgb, ${r.icon.tone} 80%, var(--ink))`,
          }}>
            <Icon size={15} />
          </span>
        );
        // Line 1 is name and time, line 2 is meta and tag. Desktop puts the tag under the time on
        // the right; phones put it before the meta so the name keeps the width (home.css).
        const body = (
          <span className="home-row-body">
            <span className="home-row-head">{r.title}</span>
            {r.meta && <span className="home-row-sub">{r.meta}</span>}
            {r.tag && <span className="home-row-tag">{r.tag}</span>}
            <span className="home-row-time">{timeAgo(r.time, i18n.language)}</span>
          </span>
        );
        if (r.onDismiss) {
          // The icon sits outside the row's button, so a double-click on it never opens the row.
          return (
            <div key={r.key} className="home-row home-row--dismissable">
              {iconEl}
              {r.onClick ? (
                <button type="button" className="home-row-main" onClick={r.onClick}>{body}</button>
              ) : <div className="home-row-main">{body}</div>}
              <button type="button" className="home-row-dismiss" onClick={r.onDismiss}
                aria-label={r.dismissLabel} title={r.dismissLabel} data-testid={`attention-dismiss-${r.key}`}>
                <X size={14} />
              </button>
            </div>
          );
        }
        const inner = <>{iconEl}{body}</>;
        return r.onClick ? (
          <button key={r.key} type="button" className="home-row" onClick={r.onClick}>{inner}</button>
        ) : (
          <div key={r.key} className="home-row">{inner}</div>
        );
      })}
    </div>
  );
}
