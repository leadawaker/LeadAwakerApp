import { useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/crm/primitives";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { LANGS } from "./clientDisplay";

/** What is in the library, in one sentence, plus how many personas each language can demo. */
export function ClientsHero({ clients, categories }: { clients: DemoClientSummary[]; categories: number }) {
  const { t, i18n } = useTranslation("campaigns");

  const stats = useMemo(() => {
    const live = clients.filter((c) => c.isLive).length;
    const wordsOnly = clients.filter((c) => !c.isLive && c.languages.length === 0).length;
    const lastEdit = clients.reduce((max, c) => (c.updatedAt && c.updatedAt > max ? c.updatedAt : max), "");
    return {
      live,
      wordsOnly,
      written: clients.length - live - wordsOnly,
      lastEdit,
      perLang: LANGS.map((l) => ({ lang: l, n: clients.filter((c) => c.languages.includes(l)).length })),
    };
  }, [clients]);

  const lastEdit = stats.lastEdit
    ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date(stats.lastEdit))
    : null;
  const most = Math.max(1, ...stats.perLang.map((p) => p.n));

  const buckets = [
    { key: "written", n: stats.written, color: "var(--wine)", hollow: false },
    { key: "wordsOnly", n: stats.wordsOnly, color: "var(--mute)", hollow: true },
    { key: "live", n: stats.live, color: "var(--good)", hollow: false },
  ];

  return (
    <SectionCard padded={false} className="dp-hero" data-testid="personas-hero">
      <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="am-mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", whiteSpace: "normal" }}>
          <span style={{ color: "var(--ink-soft)" }}>{t("clients.hero.categories", { count: categories })}</span>
          {lastEdit && <span>{t("clients.hero.lastEdit", { date: lastEdit })}</span>}
        </div>
        <h1 className="serif dp-hero-title">{t("clients.hero.title", { count: clients.length })}</h1>
        <p style={{ fontSize: 13.5, color: "var(--mute)", margin: 0, maxWidth: 560, lineHeight: 1.55 }}>{t("clients.hero.blurb")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 2 }}>
          {buckets.map((b) => (
            <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: b.n ? "var(--ink-soft)" : "var(--mute-2)" }}>
              <span className={`dp-dot${b.hollow ? " dp-dot--hollow" : ""}`} style={{ "--dp-dot": b.n ? b.color : "var(--mute-2)" } as CSSProperties} />
              <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.n}</b> {t(`clients.hero.${b.key}`, { count: b.n })}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>{t("clients.hero.coverage")}</span>
        <div className="dp-coverage">
          {stats.perLang.map(({ lang, n }) => (
            <div key={lang} style={{ display: "contents" }}>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t(`clients.langName.${lang}`)}</span>
              <div className="dp-coverage-track" aria-hidden>
                <div className="dp-coverage-fill" style={{ width: `${(n / most) * 100}%` }} />
              </div>
              <span className="am-mono" style={{ color: n ? "var(--ink)" : "var(--mute-2)", fontSize: 12, minWidth: 18, textAlign: "right" }}>{n}</span>
            </div>
          ))}
        </div>
        <span className="am-mono" style={{ fontSize: 10.5, color: "var(--mute-2)", whiteSpace: "normal", lineHeight: 1.5 }}>{t("clients.hero.coverageNote")}</span>
      </div>
    </SectionCard>
  );
}
