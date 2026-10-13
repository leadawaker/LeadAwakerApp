import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { HOME_PERIODS, type HomePeriod, type HomeServices, type HomeTab } from "@shared/homeTypes";
import { useHomeServices, type HomeScope } from "../api/homeApi";
import { EmptyState } from "../components/EmptyState";
import "../home.css";

const OverviewTab = lazy(() => import("../tabs/OverviewTab"));
const PhoneTab = lazy(() => import("../tabs/PhoneTab"));
const WhatsappTab = lazy(() => import("../tabs/WhatsappTab"));
const WebsiteTab = lazy(() => import("../tabs/WebsiteTab"));
const ReactivationTab = lazy(() => import("../tabs/ReactivationTab"));
const ReputationTab = lazy(() => import("../tabs/ReputationTab"));
const SocialTab = lazy(() => import("../tabs/SocialTab"));

const PANELS = {
  overview: OverviewTab, phone: PhoneTab, whatsapp: WhatsappTab, website: WebsiteTab,
  reactivation: ReactivationTab, reputation: ReputationTab, social: SocialTab,
};
const ORDER: HomeTab[] = ["overview", "phone", "whatsapp", "website", "reactivation", "reputation", "social"];
const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };
const PERIOD_KEY = "leadawaker_home_period";

export function visibleTabs(services: HomeServices | undefined): HomeTab[] {
  if (!services) return ["overview"];
  return ORDER.filter((tab) => tab === "overview" || services[tab]);
}

function readTab(): HomeTab {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return (ORDER as string[]).includes(wanted ?? "") ? (wanted as HomeTab) : "overview";
}

function readPeriod(): HomePeriod {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    if ((HOME_PERIODS as readonly string[]).includes(saved ?? "")) return saved as HomePeriod;
  } catch { /* storage unavailable */ }
  return "month";
}

function HomeDashboard() {
  const { t, i18n } = useTranslation("home");
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const [tab, setTab] = useState<HomeTab>(readTab);
  const [period, setPeriod] = useState<HomePeriod>(readPeriod);
  const { data: services, isLoading, isError } = useHomeServices(currentAccountId);
  const tabs = useMemo(() => visibleTabs(services), [services]);

  // A tab that is not live for this account (deep link, or after switching account) falls back to Overview.
  // While services are still loading, keep the requested tab so a deep link is not lost.
  const active = !services || tabs.includes(tab) ? tab : "overview";

  // Keep the open tab in the URL so a refresh or a shared link reopens it.
  useEffect(() => {
    if (!services) return;
    const params = new URLSearchParams(window.location.search);
    if (active === "overview") params.delete("tab"); else params.set("tab", active);
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [active, services]);

  const choosePeriod = (p: HomePeriod) => {
    setPeriod(p);
    try { localStorage.setItem(PERIOD_KEY, p); } catch { /* ignore */ }
  };

  const { greeting, dateStr } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const key = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const locale = DATE_LOCALE[i18n.language?.split("-")[0] ?? "en"] ?? "en-US";
    return {
      greeting: t(`greeting.${key}`),
      dateStr: now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    };
  }, [i18n.language, t]);

  const firstName = useMemo(() => {
    try { return (localStorage.getItem("leadawaker_user_name") || "").trim().split(/\s+/)[0] || ""; } catch { return ""; }
  }, []);

  const scope: HomeScope = { accountId: currentAccountId, period };
  const Panel = PANELS[active];
  const noServices = !isLoading && services && tabs.length === 1;

  return (
    <div className="la-page" data-testid="page-home">
      {/* One scroll container for the page, so neumorphic shadows are never clipped. */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="mr-auto flex max-w-[1386px] flex-col gap-5 px-4 pb-11 pt-7 md:px-9">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[26px] md:text-[32px]" style={{ margin: 0, fontFamily: "var(--serif)", color: "var(--ink)", lineHeight: 1.1 }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <span className="eyebrow eyebrow-sm">{dateStr}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="la-seg la-seg--fill max-w-full" role="tablist" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
              {tabs.map((k) => (
                <button key={k} role="tab" aria-selected={active === k} data-testid={`home-tab-${k}`}
                  className={cn("la-seg-btn shrink-0", active === k && "on")} onClick={() => setTab(k)}>
                  {t(`tabs.${k}`)}
                </button>
              ))}
            </div>
            <select value={period} onChange={(e) => choosePeriod(e.target.value as HomePeriod)} aria-label={t("period.label")}
              className="neu-inset-crisp" data-testid="home-period"
              style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}>
              {HOME_PERIODS.map((p) => <option key={p} value={p}>{t(`period.${p}`)}</option>)}
            </select>
          </div>

          {isError ? (
            <EmptyState title={t("errorTitle")} body={t("error")} />
          ) : noServices ? (
            <EmptyState title={t("empty.noServicesTitle")} body={t(isAgencyUser ? "empty.noServicesAgency" : "empty.noServicesClient")} />
          ) : (
            <Suspense fallback={<div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>}>
              {services ? <Panel key={currentAccountId} scope={scope} services={services} onOpenTab={setTab} /> : (
                <div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>
              )}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <CrmShell>
      <HomeDashboard />
    </CrmShell>
  );
}
