import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, CalendarCheck, Timer } from "lucide-react";
import { useVoiceStats, type VoiceScope } from "../api/voiceCallsApi";
import { formatDuration } from "../format";

interface CardProps {
  icon: ReactNode;
  label: string;
  caption: string;
  value: string;
  loading: boolean;
  testId: string;
}

function StatCard({ icon, label, caption, value, loading, testId }: CardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className="neu-raised flex items-center gap-3 px-3 py-2.5 sm:gap-3.5 sm:px-4 sm:py-3.5"
      style={{ borderRadius: "var(--r-card)", background: "var(--card)", minWidth: 0 }}
    >
      <div className="hidden sm:flex" style={{ width: 40, height: 40, borderRadius: "var(--r-surface)", flexShrink: 0, background: "var(--wine-tint)", color: "var(--wine)", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      {/* Phones: label left, value right on one line. Wider: stacked. */}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:block">
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </div>
        {loading ? (
          <div className="animate-pulse" aria-hidden="true" style={{ height: 28, width: 72, margin: "6px 0 4px", borderRadius: "var(--r-flush)", background: "var(--line)" }} />
        ) : (
          <div className="sm:mt-0.5" style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.15, color: "var(--ink)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
            {value}
          </div>
        )}
        <div className="hidden sm:block" style={{ fontSize: 11, color: "var(--mute-2)", marginTop: 1 }}>{caption}</div>
      </div>
    </div>
  );
}

/** Three headline numbers over the last 7 days, same layout on Live and Demo. */
export function StatsStrip({ scope, accountId }: { scope: VoiceScope; accountId?: number }) {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading } = useVoiceStats(scope, accountId);
  const none = t("stats.noValue");
  const calls = data?.calls ?? 0;
  const caption = t("stats.last7Days");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12, padding: "12px 14px", flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
      <StatCard
        testId="voice-stat-calls"
        icon={<AudioLines size={18} />}
        label={t(scope === "demo" ? "stats.demosWeek" : "stats.callsWeek")}
        caption={caption}
        loading={isLoading}
        value={String(calls)}
      />
      <StatCard
        testId="voice-stat-booked"
        icon={<CalendarCheck size={18} />}
        label={t("stats.bookedRate")}
        caption={caption}
        loading={isLoading}
        value={calls > 0 && data ? `${Math.round(data.bookedRate * 100)}%` : none}
      />
      <StatCard
        testId="voice-stat-length"
        icon={<Timer size={18} />}
        label={t("stats.avgLength")}
        caption={caption}
        loading={isLoading}
        value={data?.avgDurationSeconds != null ? formatDuration(data.avgDurationSeconds) : none}
      />
    </div>
  );
}
