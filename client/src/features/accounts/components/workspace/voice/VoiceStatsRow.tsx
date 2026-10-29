import { useState } from "react";
import { useVoiceT } from "./voiceGender";
import { Phone, CalendarCheck, PhoneForwarded, Clock, Gauge, Coins } from "lucide-react";
import { StatCard } from "@/features/billing/components/workspace/atoms";
import { useWorkspace } from "@/hooks/useWorkspace";
import { currentMonth, recentMonths, useVoiceStats } from "./useVoiceStats";

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function VoiceStatsRow({ accountId }: { accountId: number }) {
  const { t, i18n } = useVoiceT();
  const { isAgencyUser } = useWorkspace();
  const [month, setMonth] = useState(currentMonth);
  const { stats, loading } = useVoiceStats(accountId, month);
  const months = recentMonths(12);
  const empty = !loading && (stats?.calls ?? 0) === 0;
  const dash = (n: number | undefined) => (loading ? "…" : String(n ?? 0));
  // The server sends cost fields to the Owner only; their absence hides the cost cards.
  const showCost = stats?.costPerMinute !== undefined;
  const usd = (n: number, digits: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(n);
  const latency = loading ? "…" : stats?.latencyMs == null ? "–" : t("stats.latencyValue", { ms: stats.latencyMs });

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
      {/* 110px min keeps the four tiles on one row in the narrow settings column, never 3 + 1 orphan. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14 }}>
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
      {(isAgencyUser || showCost) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 14 }}>
        {isAgencyUser && <StatCard flat label={t("stats.latency")} value={latency} sub={t("stats.latencyHelp")} icon={<Gauge size={15} />} />}
        {showCost && (
          <StatCard
            flat
            label={t("stats.costPerMinute")}
            value={loading ? "…" : stats?.costPerMinute == null ? "–" : usd(stats.costPerMinute, 3)}
            sub={t("stats.ownerOnly")}
            icon={<Coins size={15} />}
          />
        )}
        {showCost && (
          <StatCard
            flat
            label={t("stats.cost")}
            value={loading ? "…" : stats?.costUsd == null ? "–" : usd(stats.costUsd, 2)}
            sub={t("stats.ownerOnly")}
            icon={<Coins size={15} />}
          />
        )}
      </div>}
      {empty && <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "10px 0 0" }}>{t("stats.empty")}</p>}
    </div>
  );
}
