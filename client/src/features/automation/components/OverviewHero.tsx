import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/crm/primitives";
import type { OverviewResponse } from "@shared/automationTypes";
import { BUCKETS, BUCKET_COLOR, bucketOf, sumPulses, type Bucket } from "../status";
import { timeAgo } from "../labels";
import { PulseBars } from "./PulseBars";

/** The answer to "is anything broken?" in one sentence, plus the last 24 hours as a rhythm. */
export function OverviewHero({ data }: { data: OverviewResponse }) {
  const { t } = useTranslation("automation");
  const counts: Record<Bucket, number> = { fine: 0, attention: 0, broken: 0, waiting: 0 };
  for (const r of data.rows) counts[bucketOf(r.health)] += 1;
  const pulse = sumPulses(data.rows);
  const ok = pulse.ok.reduce((a, b) => a + b, 0);
  const failed = pulse.failed.reduce((a, b) => a + b, 0);

  const headline = !data.engineReachable
    ? t("hero.down")
    : counts.broken > 0
      ? t("hero.broken", { count: counts.broken })
      : counts.attention > 0
        ? t("hero.attention", { count: counts.attention })
        : t("hero.allGood");
  const engineColor = data.engineReachable ? "var(--good)" : "hsl(var(--destructive))";

  return (
    <SectionCard padded={false} style={{ padding: "22px 24px", display: "flex", gap: 28, flexWrap: "wrap" }} data-testid="automation-hero">
      <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="am-mono" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`am-dot${data.engineReachable ? "" : " am-dot--alert"}`} style={{ "--am-dot": engineColor, width: 8, height: 8 } as CSSProperties} />
          <span style={{ color: "var(--ink-soft)" }}>{data.engineReachable ? t("hero.engineOn") : t("hero.engineOff")}</span>
          {data.engineStartedAt && <span>{t("hero.restarted", { ago: timeAgo(t, data.engineStartedAt) })}</span>}
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(26px, 3.2vw, 36px)", lineHeight: 1.1, color: "var(--ink)", margin: 0 }}>{headline}</h1>
        {!data.engineReachable && <p style={{ fontSize: 13.5, color: "var(--mute)", margin: 0, maxWidth: 520 }}>{t("hero.downHint")}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
          {BUCKETS.map((b) => (
            <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: counts[b] ? "var(--ink-soft)" : "var(--mute-2)" }}>
              <span className={`am-dot${b === "waiting" ? " am-dot--hollow" : ""}`} style={{ "--am-dot": counts[b] ? BUCKET_COLOR[b] : "var(--mute-2)", width: 8, height: 8, boxShadow: b === "waiting" ? undefined : "none" } as CSSProperties} />
              <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{counts[b]}</b> {t(`bucket.${b}`, { count: counts[b] })}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: "1 1 360px", minWidth: 0, maxWidth: 560, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>{t("hero.pulseLabel")}</span>
          <span className="am-mono">
            {ok + failed === 0 ? t("hero.noActions") : t("hero.actions", { count: ok + failed })}
            {failed > 0 && <span style={{ color: "hsl(var(--destructive))" }}> · {t("hero.failed", { count: failed })}</span>}
          </span>
        </div>
        <PulseBars pulse={pulse} grow hourTitle={(h, o, f) => t("hero.hourTitle", { ago: h === 0 ? t("hero.thisHour") : t("ago.hours", { n: h }), ok: o, failed: f })} />
        <div className="am-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--mute-2)" }}>
          <span>{t("hero.pulseStart")}</span>
          <span>{t("hero.pulseMid")}</span>
          <span style={{ color: "var(--wine)" }}>{t("hero.pulseNow")}</span>
        </div>
      </div>
    </SectionCard>
  );
}
