import type { ReactNode } from "react";
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
}

export function RowList({ rows, empty }: { rows: RowListItem[]; empty: string }) {
  const { i18n } = useTranslation();
  if (rows.length === 0) {
    return <div style={{ color: "var(--mute)", fontSize: 13.5, padding: "12px 4px" }}>{empty}</div>;
  }
  return (
    <div>
      {rows.map((r) => {
        const inner = (
          <>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              {r.meta && <span style={{ fontSize: 12, color: "var(--mute)" }}>{r.meta}</span>}
            </span>
            {r.tag}
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--mute)", whiteSpace: "nowrap" }}>
              {timeAgo(r.time, i18n.language)}
            </span>
          </>
        );
        return r.onClick ? (
          <button key={r.key} type="button" className="home-row" onClick={r.onClick}>{inner}</button>
        ) : (
          <div key={r.key} className="home-row">{inner}</div>
        );
      })}
    </div>
  );
}
