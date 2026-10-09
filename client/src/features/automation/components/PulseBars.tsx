import type { CSSProperties } from "react";
import type { HourlyPulse } from "@shared/automationTypes";

/**
 * 24 hourly bars, oldest left, the current hour right. Wine = work done,
 * red cap = failures, a small dot = nothing happened that hour.
 */
export function PulseBars({ pulse, mini = false, grow = false, hourTitle }: {
  pulse: HourlyPulse;
  mini?: boolean;
  grow?: boolean;
  hourTitle?: (hoursAgo: number, ok: number, failed: number) => string;
}) {
  const totals = pulse.ok.map((n, i) => n + pulse.failed[i]);
  const max = Math.max(1, ...totals);
  const minPct = mini ? 18 : 8;
  const style = (mini ? { "--am-h": "20px", "--am-gap": "1px" } : undefined) as CSSProperties | undefined;
  return (
    <div className={`am-pulse${mini ? " am-pulse--mini" : ""}${grow ? " am-pulse--grow" : ""}`} style={style} aria-hidden={mini || undefined}>
      {totals.map((total, i) => {
        const failed = pulse.failed[i];
        const pct = total === 0 ? 0 : Math.max(minPct, Math.round((Math.sqrt(total) / Math.sqrt(max)) * 100));
        return (
          <div key={i} className={`am-pulse-col${i === 23 ? " now" : ""}`} title={hourTitle?.(23 - i, total - failed, failed)}>
            {total === 0 ? (
              <span className="am-pulse-empty" />
            ) : (
              <div className="am-pulse-bar" style={{ height: `${pct}%`, "--i": i } as CSSProperties}>
                {failed > 0 && <span className="bad" style={{ height: `${Math.max(2, (failed / total) * 100)}%` }} />}
                {total - failed > 0 && <span className="ok" />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
