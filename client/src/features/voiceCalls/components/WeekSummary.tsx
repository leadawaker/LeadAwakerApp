import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useVoiceStats, type VoiceScope } from "../api/voiceCallsApi";
import { formatDuration } from "../format";

/**
 * The three last-7-days numbers on one line in the topbar:
 * "Calls 37 · Booked 11% · Avg length 1:38". Shared by the Calls and the Callers view.
 */
export function WeekSummary({ scope, accountId }: { scope: VoiceScope; accountId?: number }) {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading } = useVoiceStats(scope, accountId);
  const none = t("stats.noValue");
  const calls = data?.calls ?? 0;
  const stats = [
    { id: "calls", label: t(scope === "demo" ? "stats.demos" : "stats.calls"), value: String(calls) },
    { id: "booked", label: t("stats.booked"), value: calls > 0 && data ? `${Math.round(data.bookedRate * 100)}%` : none },
    { id: "length", label: t("stats.avgLength"), value: data?.avgDurationSeconds != null ? formatDuration(data.avgDurationSeconds) : none },
  ];

  return (
    <div
      role="group"
      aria-label={t("stats.thisWeek")}
      title={t("stats.last7Days")}
      data-testid="voice-week-summary"
      style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0, whiteSpace: "nowrap", fontSize: 12.5 }}
    >
      {stats.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && <span aria-hidden="true" style={{ color: "var(--mute-2)" }}>·</span>}
          <span data-testid={`voice-stat-${s.id}`} style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ color: "var(--mute)" }}>{s.label}</span>
            {isLoading ? (
              <span className="animate-pulse" aria-hidden="true" style={{ display: "inline-block", height: 10, width: 22, borderRadius: "var(--r-flush)", background: "var(--line)" }} />
            ) : (
              <span style={{ fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
            )}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
