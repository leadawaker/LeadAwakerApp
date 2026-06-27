import type { ReactNode } from "react";

/**
 * Uniform column-title row for the top stats panel (Median / Total Leads / Channel Mix).
 * The fixed min-height keeps all three serif titles aligned at the top even when one
 * column carries a right-side action (the range switcher), which is taller than the text.
 */
export function StatHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{ minHeight: 34, marginBottom: 16 }}
    >
      <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", lineHeight: 1.2 }}>
        {title}
      </span>
      {action}
    </div>
  );
}
