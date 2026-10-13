import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Compared } from "@shared/homeTypes";
import { StatCard } from "@/features/billing/components/workspace/atoms";
import { trendOf } from "../lib/homeFormat";

export interface StatRowItem {
  key: string;
  label: string;
  value: ReactNode;
  compared?: Compared;
  sub?: ReactNode;
  filled?: boolean;
  onClick?: () => void;
}

function TrendSub({ compared }: { compared: Compared }) {
  const trend = trendOf(compared);
  if (!trend) return null;
  const Icon = trend.dir === "down" ? ArrowDown : ArrowUp;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {trend.dir !== "flat" && <Icon size={12} aria-hidden />}
      {trend.pct}%
    </span>
  );
}

export function StatRow({ items }: { items: StatRowItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-[14px] md:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {items.map((it) => {
        const sub = it.compared && trendOf(it.compared) ? <TrendSub compared={it.compared} /> : it.sub;
        const card = <StatCard label={it.label} value={it.value} sub={sub} filled={it.filled} />;
        return it.onClick ? (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick}
            style={{ display: "flex", background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
          >
            {card}
          </button>
        ) : (
          <div key={it.key} style={{ display: "flex" }}>{card}</div>
        );
      })}
    </div>
  );
}
