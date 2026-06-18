// Next panel — booked calls today + later this week, with an UP NEXT tag on the
// imminent one. Mirrors the Claude design's NextCard. White neu-raised card.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Phone, Sparkles } from "lucide-react";
import { SectionHead } from "../panelPrimitives";
import { upcomingCalls, type CallItem } from "./utils";

function ChannelChip({ kind }: { kind: CallItem["kind"] }) {
  const Icon = kind === "AI Handoff" ? Sparkles : Phone;
  return (
    <span className="row" style={{ gap: 6, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute)" }}>
      <Icon className="h-3 w-3" />{kind}
    </span>
  );
}

function TodayRow({ c, imminent }: { c: CallItem; imminent: boolean }) {
  // The imminent (next-up) call is highlighted by a wine-tinted card with a left
  // accent instead of a separate "UP NEXT" pill.
  return (
    <div
      className="row"
      style={{
        gap: 16,
        padding: imminent ? "11px 12px" : "11px 0",
        margin: imminent ? "2px 0" : 0,
        borderBottom: imminent ? "none" : "1px solid var(--line)",
        borderRadius: imminent ? "var(--r-button)" : 0,
        borderLeft: imminent ? "3px solid var(--wine)" : "none",
        background: imminent ? "color-mix(in srgb, var(--wine) 9%, transparent)" : "transparent",
        alignItems: "center",
      }}
    >
      <div className="display" style={{ fontSize: 18, color: imminent ? "var(--wine)" : "var(--ink)", minWidth: 50 }}>{c.time}</div>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
      </div>
      <ChannelChip kind={c.kind} />
    </div>
  );
}

function FutureRow({ c }: { c: CallItem }) {
  return (
    <div className="row" style={{ gap: 14, padding: "7px 0" }}>
      <div style={{ width: 78, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{c.dateLabel}</div>
      <div className="display" style={{ fontSize: 15, color: "var(--ink-soft)", minWidth: 50 }}>{c.time}</div>
      <div style={{ flex: 1, fontSize: 13, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
      <ChannelChip kind={c.kind} />
    </div>
  );
}

export function NextPanel({ leads }: { leads: Record<string, any>[] }) {
  const { t } = useTranslation("campaigns");
  const calls = useMemo(() => upcomingCalls(leads), [leads]);
  const today = calls.filter((c) => c.isToday);
  const future = calls.filter((c) => !c.isToday);

  return (
    <div className="panel-glass-animate" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "20px 18px"
    }} data-testid="campaign-detail-view-agenda">
      <SectionHead
        eyebrow={t("summary.eyebrows.callsHandoffs")}
        title={t("summary.next")}
        titleSize={32}
        marginBottom={20}
        action={
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", letterSpacing: "0.1em" }}>{t("summary.todayCount", { count: today.length })}</span>
        }
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {calls.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--mute)", padding: "8px 0" }}>{t("summary.noCalls")}</div>
        ) : (
          <>
            {today.length > 0 && (
              <>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t("summary.timeframes.today")}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {today.map((c, i) => <TodayRow key={c.id} c={c} imminent={i === 0} />)}
                </div>
              </>
            )}
            {future.length > 0 && (
              <div style={{ marginTop: today.length ? 22 : 0, paddingTop: today.length ? 18 : 0, borderTop: today.length ? "1px solid var(--line)" : "none" }}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>{t("summary.laterThisWeek")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {future.map((c) => <FutureRow key={c.id} c={c} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
