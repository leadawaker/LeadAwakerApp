import { useTranslation } from "react-i18next";
import { MonoLabel } from "@/features/voice/components/atoms";
import { useVoiceStats, type VoiceScope } from "../api/voiceCallsApi";
import { formatDuration } from "../format";

function Row({ label, value, loading, testId }: { label: string; value: string; loading: boolean; testId: string }) {
  return (
    <div data-testid={testId} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
      <span style={{ fontSize: 12, lineHeight: 1.4, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {loading ? (
        <span className="animate-pulse" aria-hidden="true" style={{ height: 11, width: 32, borderRadius: "var(--r-flush)", background: "var(--line)", alignSelf: "center" }} />
      ) : (
        <span style={{ fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.2, color: "var(--ink)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{value}</span>
      )}
    </div>
  );
}

/**
 * The three last-7-days numbers, as a small card at the top of the list
 * column. Shared by the Calls and the Callers list; it sits above the
 * scrolling list so it stays put.
 */
export function WeekSummaryCard({ scope, accountId }: { scope: VoiceScope; accountId?: number }) {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading } = useVoiceStats(scope, accountId);
  const none = t("stats.noValue");
  const calls = data?.calls ?? 0;

  return (
    <div style={{ flexShrink: 0, padding: "10px 10px 4px" }}>
      <div
        role="group"
        aria-label={t("stats.thisWeek")}
        title={t("stats.last7Days")}
        data-testid="voice-week-summary"
        className="neu-raised-crisp"
        style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "9px 12px 10px", display: "flex", flexDirection: "column", gap: 3 }}
      >
        <div style={{ marginBottom: 3 }}>
          <MonoLabel>{t("stats.thisWeek")}</MonoLabel>
        </div>
        <Row
          testId="voice-stat-calls"
          label={t(scope === "demo" ? "stats.demos" : "stats.calls")}
          loading={isLoading}
          value={String(calls)}
        />
        <Row
          testId="voice-stat-booked"
          label={t("stats.booked")}
          loading={isLoading}
          value={calls > 0 && data ? `${Math.round(data.bookedRate * 100)}%` : none}
        />
        <Row
          testId="voice-stat-length"
          label={t("stats.avgLength")}
          loading={isLoading}
          value={data?.avgDurationSeconds != null ? formatDuration(data.avgDurationSeconds) : none}
        />
      </div>
    </div>
  );
}
