// Live panels of the Home Reactivation tab: upcoming bookings, just happened,
// bumps today. Ported from the Campaigns dashboard; the data now comes from
// /api/home/reactivation/live instead of full lead lists in the browser.
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { todayIn } from "@shared/homePeriod";
import type { HomeReactivationLive } from "@shared/homeTypes";
import type { HomeScope } from "../api/homeApi";
import { useHomeReactivationLive } from "../api/homeApi";
import { BarList } from "./BarList";
import { RowList } from "./RowList";

const muted = { color: "var(--mute)", fontSize: 13.5, padding: "12px 4px" } as const;
const clockStyle = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", minWidth: 46 } as const;

/** "Today 14:30", "Tomorrow 09:00", "Fri 17 10:15", in the account's timezone. */
function useWhen(tz: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const day = (d: Date) => todayIn(tz, d);
  const today = todayIn(tz);
  const tomorrow = todayIn(tz, new Date(Date.now() + 86_400_000));
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const clock = new Intl.DateTimeFormat(lang, { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(lang, { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (iso: string) => {
    const d = new Date(iso);
    const key = day(d);
    const label = key === today ? cap(rtf.format(0, "day")) : key === tomorrow ? cap(rtf.format(1, "day")) : date.format(d);
    return { label, time: clock.format(d), isToday: key === today };
  };
}

function Clock({ label, time }: { label: string; time: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 74 }}>
      <span style={clockStyle}>{time}</span>
      <span className="eyebrow eyebrow-sm">{label}</span>
    </span>
  );
}

function UpcomingPanel({ data, open }: { data: HomeReactivationLive; open: (leadId: number) => void }) {
  const { t } = useTranslation("home");
  const when = useWhen(data.tz);
  const todayCount = data.upcoming.filter((u) => when(u.at).isToday).length;
  return (
    <PanelShell testId="home-reactivation-upcoming">
      <SectionHead
        title={t("reactivation.live.upcoming")}
        action={<span className="eyebrow eyebrow-sm">{t("reactivation.live.todayCount", { count: todayCount })}</span>}
      />
      {data.upcoming.length === 0 ? <div style={muted}>{t("reactivation.live.upcomingEmpty")}</div> : data.upcoming.map((u, i) => {
        const w = when(u.at);
        return (
          <button key={`${u.leadId}-${u.at}`} type="button" className="home-row" onClick={() => open(u.leadId)}
            style={i === 0 ? { borderLeft: "3px solid var(--wine)", paddingLeft: 10, background: "var(--wine-tint)" } : undefined}>
            <Clock label={w.label} time={w.time} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.name ?? t("unknownContact")}
              </span>
              {u.campaign && <span style={{ fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.campaign}</span>}
            </span>
            {u.handoff && <Pill>{t("reactivation.live.handoff")}</Pill>}
          </button>
        );
      })}
    </PanelShell>
  );
}

function ActivityPanel({ data, open }: { data: HomeReactivationLive; open: (leadId: number) => void }) {
  const { t } = useTranslation("home");
  const rows = data.activity.map((a) => {
    const inbound = a.direction === "in";
    const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
    return {
      key: String(a.id),
      title: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon size={13} aria-hidden style={{ color: inbound ? "var(--good)" : "var(--wine)", flexShrink: 0 }} />
          {a.name ?? t("unknownContact")}
        </span>
      ),
      meta: <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.preview}</span>,
      tag: <Pill>{t(inbound ? "reactivation.live.replied" : "reactivation.live.sent")}</Pill>,
      time: a.at,
      onClick: a.leadId ? () => open(a.leadId) : undefined,
    };
  });
  return (
    <PanelShell testId="home-reactivation-activity">
      <SectionHead
        title={t("reactivation.live.activity")}
        action={
          <span className="eyebrow eyebrow-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="la-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />
            {t("reactivation.live.live")}
          </span>
        }
      />
      <RowList rows={rows} empty={t("reactivation.live.activityEmpty")} />
    </PanelShell>
  );
}

function BumpsPanel({ data, open }: { data: HomeReactivationLive; open: (leadId: number) => void }) {
  const { t } = useTranslation("home");
  const when = useWhen(data.tz);
  const { bumps } = data;
  const stageLabel = (stage: number) => (stage === 0 ? t("reactivation.live.firstMessage") : t("reactivation.live.bump", { n: stage }));
  const stages = [0, 1, 2, 3, 4].map((stage) => ({
    key: String(stage), label: stageLabel(stage), value: bumps.sentByStage.find((s) => s.stage === stage)?.count ?? 0,
  }));
  const big = { fontFamily: "var(--mono)", fontSize: 26, color: "var(--ink)", lineHeight: 1.1 } as const;
  return (
    <PanelShell testId="home-reactivation-bumps">
      <SectionHead title={t("reactivation.live.bumps")} />
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
        <div><div style={big}>{bumps.sentToday}</div><div className="eyebrow eyebrow-sm">{t("reactivation.live.sentToday")}</div></div>
        <div><div style={big}>{bumps.dueToday}</div><div className="eyebrow eyebrow-sm">{t("reactivation.live.dueToday")}</div></div>
      </div>
      {bumps.sentToday > 0 && <BarList rows={stages} />}
      <div className="eyebrow eyebrow-sm" style={{ marginTop: 14, marginBottom: 2 }}>{t("reactivation.live.nextUp")}</div>
      {bumps.next.length === 0 ? <div style={muted}>{t("reactivation.live.nextEmpty")}</div> : bumps.next.map((b) => {
        const w = when(b.at);
        const overdue = new Date(b.at).getTime() < Date.now();
        return (
          <button key={b.leadId} type="button" className="home-row" onClick={() => open(b.leadId)}>
            <Clock label={overdue ? t("reactivation.live.due") : w.label} time={w.time} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.name ?? t("unknownContact")}
            </span>
            <Pill>{stageLabel(b.stage)}</Pill>
          </button>
        );
      })}
    </PanelShell>
  );
}

export function ReactivationLivePanels({ scope }: { scope: HomeScope }) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isError } = useHomeReactivationLive(scope);
  const open = (leadId: number) => setLocation(`/platform/contacts/${leadId}`);

  if (isError) return <PanelShell><div style={muted}>{t("error")}</div></PanelShell>;
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-3">
      <UpcomingPanel data={data} open={open} />
      <ActivityPanel data={data} open={open} />
      <BumpsPanel data={data} open={open} />
    </div>
  );
}
