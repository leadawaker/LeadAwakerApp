import { useTranslation } from "react-i18next";
import { useVoiceStats, type VoiceScope } from "../api/voiceCallsApi";
import { formatDuration } from "../format";

/** The list panel's line under People | All calls (desktop) or at the top of the list (phone). */
const ROW: React.CSSProperties = { flexShrink: 0, padding: "0 16px", whiteSpace: "nowrap", overflow: "hidden", fontSize: 12 };

/** People: how many people the list shows. */
export function PeopleSummary({ count }: { count: number }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div data-testid="voice-people-summary" style={{ ...ROW, color: "var(--mute)" }}>
      {t("callers.peopleCount", { count })}
    </div>
  );
}

/**
 * All calls: the three last-7-days numbers in the list panel, led by their window:
 * "7 days · Calls 37 · Booked 11% · Avg length 1:38".
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
      aria-label={t("stats.last7Days")}
      title={t("stats.last7Days")}
      data-testid="voice-week-summary"
      // Wraps rather than clips when a locale runs long (pt); each "· label value" wraps as one piece.
      style={{ ...ROW, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, rowGap: 2, whiteSpace: "normal" }}
    >
      {/* The window, said up front: these are not the list's totals (the footer counts those). */}
      <span data-testid="voice-stat-window" style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute-2)", whiteSpace: "nowrap" }}>
        {t("stats.window")}
      </span>
      {stats.map((s) => (
        <span key={s.id} data-testid={`voice-stat-${s.id}`} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
          <span aria-hidden="true" style={{ color: "var(--mute-2)" }}>·</span>
          <span style={{ color: "var(--mute)" }}>{s.label}</span>
          {isLoading ? (
            <span className="animate-pulse" aria-hidden="true" style={{ display: "inline-block", height: 10, width: 22, borderRadius: "var(--r-flush)", background: "var(--line)" }} />
          ) : (
            <span style={{ fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}
