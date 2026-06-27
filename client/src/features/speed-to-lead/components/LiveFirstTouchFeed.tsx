import { useTranslation } from "react-i18next";
import { MessageCircle, Mail, Radio, ArrowRight } from "lucide-react";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { Pill } from "@/components/crm/primitives/Pill";
import { sourceMeta } from "./sourceMeta";
import type { SpeedToLeadMetrics, FeedRow } from "../data/mockMetrics";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Past-tense proof feed: who got auto-replied, on what channel, how fast. */
export function LiveFirstTouchFeed({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");

  const cols = [
    { key: "lead", w: "minmax(150px, 1.4fr)" },
    { key: "source", w: "minmax(110px, 1fr)" },
    { key: "channel", w: "minmax(120px, 1fr)" },
    { key: "firstTouch", w: "84px" },
    { key: "status", w: "minmax(120px, 1fr)" },
    { key: "time", w: "84px" },
  ];
  const gridCols = cols.map((c) => c.w).join(" ");

  return (
    <PanelShell testId="card-live-feed" className="min-h-0" variant="flat" style={{ padding: "28px 0", borderRadius: 0, overflow: "visible" }}>
      <SectionHead
        title={t("feed.title")}
        titleSize={18}
        marginBottom={14}
        action={
          <span className="flex items-center gap-1.5" style={{ color: "var(--good)", fontSize: 11, fontWeight: 700 }}>
            <Radio size={13} className="la-pulse" />
            {t("feed.live")}
          </span>
        }
      />

      {/* Header row */}
      <div
        className="grid items-center gap-3 px-1 pb-2.5"
        style={{ gridTemplateColumns: gridCols, borderBottom: "1px solid var(--line)" }}
      >
        {cols.map((c) => (
          <span
            key={c.key}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--mute-2)",
              textAlign: c.key === "time" ? "right" : "left",
            }}
          >
            {t(`feed.col.${c.key}`)}
          </span>
        ))}
      </div>

      <div className="flex flex-col">
        {m.feed.map((row, i) => (
          <FeedRowView key={i} row={row} gridCols={gridCols} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <span className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--mute)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--good)" }} />
          {t("feed.allSystems")}
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--wine)", fontWeight: 600, cursor: "pointer" }}>
          {t("feed.viewAll")}
          <ArrowRight size={13} />
        </span>
      </div>
    </PanelShell>
  );
}

function FeedRowView({ row, gridCols }: { row: FeedRow; gridCols: string }) {
  const { t } = useTranslation("speedToLead");
  const { icon: SrcIcon, color: srcColor } = sourceMeta(row.sourceKey);
  const ChannelIcon = row.channelKey === "emailFallback" ? Mail : MessageCircle;
  const channelColor = row.channelKey === "emailFallback" ? "var(--wine)" : "var(--good)";
  const statusColor = row.status === "fallback" ? "var(--warn)" : "var(--good)";

  return (
    <div
      className="grid items-center gap-3 px-1"
      style={{ gridTemplateColumns: gridCols, height: 46, borderBottom: "1px solid var(--line)" }}
    >
      {/* Lead */}
      <span className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--wine-tint)", color: "var(--wine)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700 }}
        >
          {initials(row.name)}
        </span>
        <span className="truncate" style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>{row.name}</span>
      </span>

      {/* Source */}
      <span className="flex items-center gap-2 min-w-0" style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
        <span style={{ color: srcColor, display: "flex" }}><SrcIcon size={14} /></span>
        <span className="truncate">{t(`sources.${row.sourceKey}`)}</span>
      </span>

      {/* Channel */}
      <span className="flex items-center gap-2 min-w-0" style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
        <span style={{ color: channelColor, display: "flex" }}><ChannelIcon size={14} /></span>
        <span className="truncate">{t(`channels.${row.channelKey}`)}</span>
      </span>

      {/* First touch */}
      <Pill color={row.touchTone === "good" ? "var(--good)" : "var(--warn)"} tone="soft" style={{ fontFamily: "var(--mono)", justifySelf: "start" }}>
        {row.touchLabel}
      </Pill>

      {/* Status */}
      <span className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
        <span className="truncate">{t(`feed.status.${row.status}`)}</span>
      </span>

      {/* Time */}
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", textAlign: "right" }}>
        {t("feed.agoMin", { count: row.agoMin })}
      </span>
    </div>
  );
}
