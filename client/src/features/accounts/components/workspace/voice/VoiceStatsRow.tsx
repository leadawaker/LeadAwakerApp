import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone, CalendarCheck, PhoneForwarded, Clock } from "lucide-react";
import { StatCard } from "@/features/billing/components/workspace/atoms";
import { currentMonth, recentMonths, useVoiceStats } from "./useVoiceStats";

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function VoiceStatsRow({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("voiceTab");
  const [month, setMonth] = useState(currentMonth);
  const { stats, loading } = useVoiceStats(accountId, month);
  const months = recentMonths(12);
  const empty = !loading && (stats?.calls ?? 0) === 0;
  const dash = (n: number | undefined) => (loading ? "…" : String(n ?? 0));

  return (
    <div data-testid="voice-stats">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="eyebrow eyebrow-sm">{t("stats.title")}</div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="neu-inset-crisp"
          style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}
          aria-label={t("stats.month")}
        >
          {months.map((m) => <option key={m} value={m}>{monthLabel(m, i18n.language)}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        <StatCard label={t("stats.calls")} value={dash(stats?.calls)} accent="var(--wine)" icon={<Phone size={15} />} />
        <StatCard label={t("stats.bookings")} value={dash(stats?.bookings)} accent="var(--good)" icon={<CalendarCheck size={15} />} />
        <StatCard
          label={t("stats.transfers")}
          value={dash(stats?.transfers)}
          sub={stats && stats.transfersFailed > 0 ? t("stats.transfersFailed", { count: stats.transfersFailed }) : undefined}
          accent="var(--stage-contacted)"
          icon={<PhoneForwarded size={15} />}
        />
        <StatCard label={t("stats.minutes")} value={dash(stats?.minutes)} icon={<Clock size={15} />} />
      </div>
      {empty && <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "10px 0 0" }}>{t("stats.empty")}</p>}
    </div>
  );
}
