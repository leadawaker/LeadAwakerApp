import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { cn } from "@/lib/utils";
import { StatHeader } from "./StatHeader";
import type { SpeedToLeadMetrics, LeadRange } from "../data/mockMetrics";

const RANGES: { id: LeadRange; labelKey: string }[] = [
  { id: "24h", labelKey: "totalLeads.range24h" },
  { id: "1w", labelKey: "totalLeads.range1w" },
  { id: "1m", labelKey: "totalLeads.range1m" },
];

interface TotalLeadsProps {
  m: SpeedToLeadMetrics;
  activeRange?: LeadRange;
  onRangeChange?: (r: LeadRange) => void;
}

function TotalLeadsContent({ m, activeRange = "24h", onRangeChange }: TotalLeadsProps) {
  const { t } = useTranslation("speedToLead");
  const active = m.totalLeads.find((r) => r.range === activeRange) ?? m.totalLeads[0];
  const up = active.deltaPct >= 0;
  const deltaColor = up ? "var(--good)" : "var(--wine)";

  return (
    <div className="flex flex-col">
      <StatHeader
        title={t("totalLeads.title")}
        action={
          onRangeChange && (
            <div className="la-seg" role="tablist" data-testid="range-switcher">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={activeRange === r.id}
                  className={cn("la-seg-btn", activeRange === r.id && "on")}
                  onClick={() => onRangeChange(r.id)}
                  data-testid={`range-${r.id}`}
                >
                  {t(r.labelKey)}
                </button>
              ))}
            </div>
          )
        }
      />

      {/* Metric (left) + inline chart (right) */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <span className="display" style={{ fontSize: 44, lineHeight: 1, color: "var(--ink)" }} data-testid="total-leads-value">
            {active.value.toLocaleString()}
          </span>
          <div className="flex items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: "var(--mute)" }}>
            <span className="flex items-center gap-0.5" style={{ color: deltaColor, fontWeight: 700 }}>
              {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              {Math.abs(active.deltaPct)}%
            </span>
            <span>{t("totalLeads.delta")}</span>
          </div>
        </div>

        <div className="flex-1" style={{ height: 80 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={active.series} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--wine)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--wine)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9.5, fill: "#948A77" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={{ fontSize: 9.5, fill: "#948A77" }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--card)", color: "var(--ink)", fontSize: "11px", padding: "6px 10px" }} />
              <Area type="monotone" dataKey="v" name={t("totalLeads.title")} stroke="var(--wine)" strokeWidth={2} fill="url(#fillLeads)" dot={false} activeDot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** Total inbound leads with a delta + area chart. Owns the global range switcher
 *  (24H/1W/1M) next to its title; the parent shares activeRange with other cards.
 *  Pass bare=true when rendering inside a parent PanelShell (skips own shell). */
export function TotalLeadsCard({ m, bare, activeRange, onRangeChange }: TotalLeadsProps & { bare?: boolean }) {
  if (bare) return <TotalLeadsContent m={m} activeRange={activeRange} onRangeChange={onRangeChange} />;
  return (
    <PanelShell testId="card-total-leads" style={{ minHeight: 220 }}>
      <TotalLeadsContent m={m} activeRange={activeRange} onRangeChange={onRangeChange} />
    </PanelShell>
  );
}
