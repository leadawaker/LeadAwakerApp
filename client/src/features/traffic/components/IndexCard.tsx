import type { CSSProperties } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ExternalLink, ListChecks } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { IndexResponse, SearchData, SitemapStatus } from "@shared/trafficTypes";
import { num, shortDate } from "../format";
import { CardHead } from "./parts";

function sitemapLine(t: TFunction, lang: string, sitemap: SitemapStatus | null): string {
  if (!sitemap) return t("index.sitemapMissing");
  const parts = [t("index.sitemapSubmitted", { date: shortDate(lang, sitemap.lastSubmitted) })];
  parts.push(sitemap.lastDownloaded && !sitemap.pending ? t("index.sitemapRead", { date: shortDate(lang, sitemap.lastDownloaded) }) : t("index.sitemapPending"));
  if (sitemap.errors + sitemap.warnings > 0) parts.push(t("index.sitemapProblems", { errors: sitemap.errors, warnings: sitemap.warnings }));
  return `${t("index.sitemap")}: ${parts.join(", ")}`;
}

/**
 * Whether Google has each page of the sitemap, and which addresses it is showing
 * that are not the public site (the app and the API, which should stay out).
 */
export function IndexCard({ data, isLoading, failed, otherHosts }: { data?: IndexResponse; isLoading: boolean; failed: boolean; otherHosts: SearchData["otherHosts"] }) {
  const { t, i18n } = useTranslation("traffic");
  const lang = i18n.language;
  const rows = data?.connected ? data.rows : [];
  const indexed = rows.filter((r) => r.indexed).length;

  return (
    <SectionCard padded={false} className="tf-card" data-testid="traffic-index">
      <CardHead
        icon={ListChecks}
        title={t("index.title")}
        caption={data?.connected ? sitemapLine(t, lang, data.sitemap) : t("index.caption")}
        right={data?.connected && rows.length > 0 ? <span className="tf-mono" style={{ whiteSpace: "nowrap" }}>{t("index.summary", { indexed, total: rows.length })}</span> : undefined}
      />

      {isLoading && (
        <div className="tf-card-body">
          <div className="tf-empty">{t("index.loading")}</div>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-primary/10 rounded-md animate-pulse" />)}
        </div>
      )}

      {!isLoading && (failed || (data && !data.connected)) && (
        <div className="tf-card-body"><div className="tf-empty">{t(`search.unavailable.${data && !data.connected ? data.reason : "error"}`)}</div></div>
      )}

      {rows.length > 0 && (
        <div style={{ paddingBottom: 6 }}>
          {rows.map((r) => (
            <div key={r.url} className="tf-index-row">
              <span className={`tf-dot${r.indexed ? "" : " hollow"}`} style={{ "--tf-dot": r.indexed ? "var(--good)" : r.reason === "unknown" || r.reason === "discovered" ? "var(--mute-2)" : "var(--warn)" } as CSSProperties} />
              <span className="tf-index-path" title={r.url}>{r.path}</span>
              <span className="tf-index-state">{r.reason === "other" && r.coverage ? r.coverage : t(`index.reason.${r.reason}`)}</span>
              <span className="tf-mono tf-index-crawl" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {r.lastCrawl ? t("index.lastCrawl", { date: shortDate(lang, r.lastCrawl) }) : t("index.neverCrawled")}
              </span>
              {r.link ? (
                <a className="icon-circle-lg icon-circle-base tf-index-open" href={r.link} target="_blank" rel="noreferrer" title={t("index.open")} aria-label={t("index.open")}>
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : <span />}
            </div>
          ))}
        </div>
      )}

      {otherHosts.length > 0 && (
        <div className="tf-note">
          <b style={{ color: "var(--ink)" }}>{t("index.otherHosts")}</b>{" "}
          {otherHosts.map((h) => `${h.host} (${t("index.shown", { count: h.impressions, n: num(lang, h.impressions) })})`).join(", ")}.
          <br />
          {t("index.otherHostsHint")}
        </div>
      )}
    </SectionCard>
  );
}
