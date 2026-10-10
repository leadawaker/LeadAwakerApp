import { useTranslation } from "react-i18next";
import { Footprints } from "lucide-react";
import { Pill, SectionCard } from "@/components/crm/primitives";
import type { TrafficChannel, VisitsResponse } from "@shared/trafficTypes";
import { languageName, num, shortDate, zoneName } from "../format";
import { Block, CardHead, DayBars, RankList, type RankItem } from "./parts";

// Opening the site once with this address stops counting in that browser.
const OPT_OUT_URL = "https://www.leadawaker.com/?notrack=1";

// The AI assistants are the reason this card exists, so they are the one
// channel that gets the accent.
const CHANNEL_COLOR: Partial<Record<TrafficChannel, string>> = { ai: "var(--wine)" };

/** The site's own count of visits: every source, including the ones Google cannot see. */
export function VisitorsCard({ data }: { data: VisitsResponse }) {
  const { t, i18n } = useTranslation("traffic");
  const lang = i18n.language;
  const fmt = (n: number) => num(lang, n);
  const keyed = (rows: { key: string; visits: number }[], label: (key: string) => string): RankItem[] =>
    rows.map((r) => ({ key: r.key || "unknown", name: <span className="text">{r.key ? label(r.key) : t("visitors.unknown")}</span>, value: r.visits }));

  const head = (
    <CardHead
      icon={Footprints}
      title={t("visitors.title")}
      caption={data.since ? t("visitors.caption", { date: shortDate(lang, data.since) }) : t("visitors.captionOff")}
    />
  );

  if (!data.since) {
    return (
      <SectionCard padded={false} className="tf-card" data-testid="traffic-visitors">
        {head}
        <div className="tf-card-body">
          <div className="tf-empty">
            <b style={{ color: "var(--ink)" }}>{t("visitors.empty")}</b><br />
            {t("visitors.emptyHint")}
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard padded={false} className="tf-card" data-testid="traffic-visitors">
      {head}
      <div className="tf-card-body">
        <Block title={t("visitors.perDay")} right={t("visitors.summary", { visits: fmt(data.totals.visits), views: fmt(data.totals.views) })}>
          <DayBars
            days={data.daily.map((d) => ({ date: d.date, value: d.visits, title: t("visitors.dayTitle", { date: shortDate(lang, d.date), visits: fmt(d.visits), views: fmt(d.views) }) }))}
            startLabel={shortDate(lang, data.daily[0]?.date ?? null)}
            endLabel={t("visitors.today")}
          />
        </Block>

        {data.totals.visits === 0 ? (
          <div className="tf-empty">{t("visitors.quiet")}</div>
        ) : (
          <>
            <Block title={t("visitors.sources")}>
              <RankList
                format={fmt}
                items={data.sources.map((s) => ({
                  key: `${s.channel}|${s.label ?? ""}`,
                  value: s.visits,
                  title: s.channel === "direct" ? t("visitors.directHint") : undefined,
                  name: (
                    <>
                      <span className="text">{s.label ?? t("visitors.direct")}</span>
                      {s.channel !== "direct" && <Pill color={CHANNEL_COLOR[s.channel]}>{t(`channel.${s.channel}`)}</Pill>}
                    </>
                  ),
                }))}
              />
            </Block>

            <Block title={t("visitors.pages")}>
              <RankList
                format={fmt}
                items={data.pages.map((p) => ({ key: p.path, value: p.views, name: <span className="text">{p.path}</span> }))}
              />
            </Block>

            <div className="tf-trio">
              <Block title={t("visitors.languages")}><RankList format={fmt} items={keyed(data.languages, (k) => languageName(lang, k))} /></Block>
              <Block title={t("visitors.devices")}><RankList format={fmt} items={keyed(data.devices, (k) => t(`device.${k}`, { defaultValue: k }))} /></Block>
              <Block title={t("visitors.timezones")}><RankList format={fmt} items={keyed(data.timezones, zoneName)} /></Block>
            </div>
          </>
        )}

        <div className="tf-empty" style={{ fontSize: 12.5 }}>
          {t("visitors.ownVisits")}{" "}
          <a className="tf-link" href={OPT_OUT_URL} target="_blank" rel="noreferrer">{OPT_OUT_URL.replace("https://www.", "")}</a>
        </div>
      </div>
    </SectionCard>
  );
}
