import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import "../home.css";
import {
  SERVICES,
  TAG_COLOR,
  SEVERITY_COLOR,
  PULSE,
  SAMPLE_NEEDS,
  SAMPLE_ACTIVITY,
  QUICK_ACTIONS,
  UPSELL,
} from "../data";
import { PulseStrip } from "../components/PulseStrip";
import { NorthStarCell } from "../components/NorthStarCell";
import { ExplorePanel } from "../components/ExplorePanel";
import { NeedsAttention } from "../components/NeedsAttention";
import { ActivityFeed, QuickActions } from "../components/ActivitySidebar";

const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };

function HomeHub() {
  const { t, i18n } = useTranslation("home");
  const [, setLocation] = useLocation();

  // Reveal-on-mount: home-stage gains `shown` a tick after paint so the
  // `.home-rise` sections animate in (resting state stays visible w/o JS).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 40);
    return () => clearTimeout(id);
  }, []);

  const firstName = useMemo(() => {
    const raw = localStorage.getItem("leadawaker_user_name") || "";
    return raw.trim().split(/\s+/)[0] || "";
  }, []);

  const { greeting, dateStr } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greetingKey = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const locale = DATE_LOCALE[i18n.language?.split("-")[0] ?? "en"] ?? "en-US";
    const date = now.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
    const weekday = now.toLocaleDateString(locale, { weekday: "long" });
    return { greeting: t(`greeting.${greetingKey}`), dateStr: `${date} · ${weekday}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, t]);

  const pulseItems = PULSE.map((p) => ({ key: p.key, icon: p.icon, value: p.value, label: t(`pulse.${p.key}`) }));

  const needsRows = SAMPLE_NEEDS.map((n) => ({
    id: n.id,
    sevColor: SEVERITY_COLOR[n.sev],
    icon: n.icon,
    svcColor: TAG_COLOR[n.tag],
    svcName: t(`services.${n.tag}.name`),
    title: t(`needs.samples.${n.key}.title`),
    who: n.who,
    snippet: t(`needs.samples.${n.key}.snippet`),
    time: n.time,
  }));

  const activityItems = SAMPLE_ACTIVITY.map((a) => ({
    id: a.id,
    icon: a.icon,
    color: TAG_COLOR[a.tag],
    svcName: t(`services.${a.tag}.name`),
    title: t(`activity.samples.${a.key}.title`),
    meta: [a.name, t(`activity.samples.${a.key}.meta`)].filter(Boolean).join(" · "),
    time: a.time,
  }));

  const quickItems = QUICK_ACTIONS.map((q) => ({
    key: q.key,
    label: t(`quick.${q.key}`),
    icon: q.icon,
    onClick: () => q.href && setLocation(q.href),
  }));

  const exploreItems = UPSELL.map((u) => ({
    key: u.key,
    name: t(`explore.upsell.${u.key}.name`),
    blurb: t(`explore.upsell.${u.key}.blurb`),
  }));

  return (
    <div className={`la-page home-stage ${shown ? "shown" : ""}`} data-testid="page-home">
      {/* Single scroll container — generous horizontal padding so neumorphic
          card shadows never clip against the overflow boundary. */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="mr-auto flex max-w-[1386px] flex-col gap-[22px] px-5 pb-11 pt-[30px] md:px-9">
          {/* Header — greeting + today's pulse */}
          <div className="home-rise flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "capitalize" }}>{dateStr}</div>
              <h1
                className="text-[34px] md:text-[46px]"
                style={{ margin: "10px 0 0", fontFamily: "var(--serif)", lineHeight: 1.02, color: "var(--ink)", letterSpacing: "-0.015em" }}
              >
                {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
              </h1>
              <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--mute)" }}>{t("greetingSub")}</p>
            </div>
            <div className="w-full xl:w-[624px] xl:flex-shrink-0">
              <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginBottom: 8, marginLeft: 4 }}>{t("today")}</div>
              <PulseStrip items={pulseItems} />
            </div>
          </div>

          {/* Service north-star cards + Explore panel */}
          <div className="home-rise grid grid-cols-1 gap-5 md:grid-cols-2 xl:[grid-template-columns:repeat(3,1fr)_0.74fr]">
            {SERVICES.map((s) => (
              <NorthStarCell
                key={s.key}
                name={t(`services.${s.key}.name`)}
                icon={s.icon}
                color={s.color}
                mascot={s.mascot}
                northLabel={t(`services.${s.key}.northLabel`)}
                northValue={s.sample.northValue}
                northSuffix={s.sample.northSuffix}
                northValueIcon={s.sample.northValueIcon}
                deltaText={t(`services.${s.key}.delta`)}
                deltaDir={s.sample.deltaDir}
                support={[
                  { label: t(`services.${s.key}.support1`), value: s.sample.support1Value },
                  { label: t(`services.${s.key}.support2`), value: s.sample.support2Value },
                ]}
                spark={s.sample.spark}
                openLabel={t("services.open")}
                onOpen={s.href ? () => setLocation(s.href!) : undefined}
              />
            ))}
            <ExplorePanel
              title={t("explore.title")}
              blurb={t("explore.blurb")}
              addLabel={t("explore.add")}
              items={exploreItems}
            />
          </div>

          {/* Needs Attention | Recent Activity — equal columns */}
          <div className="home-rise grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
            <NeedsAttention
              title={t("needs.title")}
              count={needsRows.length}
              viewAllLabel={t("needs.viewAll")}
              actionLabel={t("needs.action")}
              emptyLabel={t("needs.empty")}
              rows={needsRows}
              onViewAll={() => setLocation("/platform/contacts")}
              onOpenRow={() => setLocation("/platform/contacts")}
            />
            <ActivityFeed title={t("activity.title")} allServicesLabel={t("activity.allServices")} items={activityItems} />
          </div>

          {/* Quick Actions — bottom row */}
          <div className="home-rise">
            <QuickActions title={t("quick.title")} items={quickItems} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <CrmShell>
      <HomeHub />
    </CrmShell>
  );
}
