import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Pill, SectionCard } from "@/components/crm/primitives";
import type { SearchResponse, SearchRow } from "@shared/trafficTypes";
import { countryName, num, position, shortDate } from "../format";
import { Block, CardHead, DayBars } from "./parts";

/** Rows of name, clicks, times shown and position. */
function SearchTable({ nameLabel, rows }: { nameLabel: string; rows: (SearchRow & { key: string; name: ReactNode })[] }) {
  const { t, i18n } = useTranslation("traffic");
  const lang = i18n.language;
  return (
    <div className="tf-table">
      <div className="tf-tr head">
        <span>{nameLabel}</span>
        <span className="n">{t("search.col.clicks")}</span>
        <span className="n">{t("search.col.shown")}</span>
        <span className="n">{t("search.col.position")}</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="tf-tr">
          <span className="name">{r.name}</span>
          <span className={`n${r.clicks === 0 ? " zero" : ""}`}>{num(lang, r.clicks)}</span>
          <span className="n">{num(lang, r.impressions)}</span>
          <span className="n">{position(lang, r.position)}</span>
        </div>
      ))}
    </div>
  );
}

/** What Google Search Console says: how often the site was shown, clicked, and for which searches. */
export function SearchCard({ data }: { data: SearchResponse }) {
  const { t, i18n } = useTranslation("traffic");
  const lang = i18n.language;

  if (!data.connected) {
    return (
      <SectionCard padded={false} className="tf-card" data-testid="traffic-search">
        <CardHead icon={Search} title={t("search.title")} />
        <div className="tf-card-body">
          <div className="tf-empty">
            <b style={{ color: "var(--ink)" }}>{t(`search.unavailable.${data.reason}`)}</b>
            {data.reason !== "error" && <><br />{t("search.unavailable.fix")}</>}
          </div>
        </div>
      </SectionCard>
    );
  }

  const range = { start: shortDate(lang, data.range.start), end: shortDate(lang, data.range.end) };
  return (
    <SectionCard padded={false} className="tf-card" data-testid="traffic-search">
      <CardHead icon={Search} title={t("search.title")} caption={t("search.caption", range)} />
      <div className="tf-card-body">
        <Block
          title={t("search.perDay")}
          right={data.totals.position === null ? t("search.positionNone") : t("search.position", { value: position(lang, data.totals.position) })}
        >
          <DayBars
            days={data.daily.map((d) => ({
              date: d.date,
              value: Math.max(d.impressions, d.clicks),
              solid: d.clicks,
              title: t("search.dayTitle", { date: shortDate(lang, d.date), shown: num(lang, d.impressions), clicks: num(lang, d.clicks) }),
            }))}
            startLabel={range.start}
            endLabel={range.end}
          />
          <span className="tf-mono tf-legend">
            <span><i className="soft" />{t("search.legendShown")}</span>
            <span><i />{t("search.legendClicked")}</span>
          </span>
        </Block>

        {data.totals.impressions === 0 ? (
          <div className="tf-empty">{t("search.none")}</div>
        ) : (
          <>
            <Block title={t("search.queries")}>
              {data.queries.length > 0 && (
                <SearchTable nameLabel={t("search.col.query")} rows={data.queries.map((q) => ({ ...q, key: q.query, name: <span className="text" title={q.query}>{q.query}</span> }))} />
              )}
              <div className="tf-empty" style={{ fontSize: 12.5 }}>{t(data.queries.length > 0 ? "search.queriesHidden" : "search.queriesEmpty")}</div>
            </Block>

            <Block title={t("search.pages")}>
              <SearchTable
                nameLabel={t("search.col.page")}
                rows={data.pages.map((p) => ({ ...p, key: p.path, name: <><span className="text" title={p.path}>{p.path}</span><Pill>{p.lang.toUpperCase()}</Pill></> }))}
              />
            </Block>

            {data.countries.length > 0 && (
              <Block title={t("search.countries")}>
                <SearchTable nameLabel={t("search.col.country")} rows={data.countries.map((c) => ({ ...c, key: c.country, name: <span className="text">{countryName(lang, c.country)}</span> }))} />
              </Block>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
