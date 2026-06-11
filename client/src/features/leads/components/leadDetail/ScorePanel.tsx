// Score arc + segmented score-contribution bar for the Lead detail panel.
// Extracted verbatim from LeadDetailPanel.tsx (structural split).
import { TIER_ARC_COLOR } from "@/hooks/useScoreBreakdown";
import { cn } from "@/lib/utils";

export function ScoreArcPanel({ score, tier }: { score: number; tier?: string }) {
  const fillColor = (tier && TIER_ARC_COLOR[tier]) || "#4F46E5";
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const cx = 100, cy = 85, r = 58, sw = 14;
  const arcLen = Math.PI * r;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-[170px] shrink-0">
      <path d={arcPath} fill="none" stroke="currentColor" className="text-muted" strokeWidth={sw} strokeLinecap="round" />
      {pct > 0 && (
        <path
          d={arcPath}
          fill="none"
          stroke={fillColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${arcLen}`}
          strokeDashoffset={`${arcLen * (1 - pct)}`}
        />
      )}
      <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="central"
        className="fill-gray-900 dark:fill-gray-100"
        style={{ fontSize: 34, fontWeight: 900, letterSpacing: -2 }}>
        {score}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="central"
        className="fill-muted-foreground"
        style={{ fontSize: 11, fontWeight: 500 }}>
        out of 100
      </text>
    </svg>
  );
}

export function ScoreDetailBar({ label, rawScore, weight, maxRaw, context }: {
  label: string; rawScore: number; weight: number; maxRaw: number; context?: string
}) {
  const contribution = Math.round(weight * Math.max(0, Math.min(maxRaw, rawScore)));
  const maxContrib = Math.round(weight * maxRaw);
  const pct = maxContrib > 0 ? (contribution / maxContrib) * 100 : 0;
  const textColor = pct >= 70 ? "text-emerald-600 dark:text-emerald-400" : pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";

  // Segmented bar: one segment per 6 contribution points (5 segments for /30, 6 for /36)
  const CHUNK = 6;
  const numChunks = Math.round(maxContrib / CHUNK);
  const filledChunks = maxContrib > 0 ? (contribution / maxContrib) * numChunks : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        <span className={cn("text-[13px] font-bold tabular-nums", textColor)}>
          {contribution}
          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/{maxContrib}</span>
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: numChunks }).map((_, i) => {
          const fill = Math.min(1, Math.max(0, filledChunks - i));
          const segColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-brand-indigo/70";
          return (
            <div key={i} className="relative flex-1 h-2 rounded-sm bg-muted overflow-hidden">
              {fill > 0 && (
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500", segColor)}
                  style={{ width: `${fill * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      {context && (
        <span className="text-[11px] text-muted-foreground leading-snug">{context}</span>
      )}
    </div>
  );
}
