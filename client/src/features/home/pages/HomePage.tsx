import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { writeLastTab } from "@/lib/lastTab";
import { rememberStatsChannel } from "../stats/StatsPanel";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { HOME_PERIODS, type HomePeriod, type HomeServices, type HomeTab } from "@shared/homeTypes";
import { useHomeServices, type HomeScope } from "../api/homeApi";
import { WelcomeChecklistCard } from "../onboarding/WelcomeChecklistCard";
import { EmptyState } from "../components/EmptyState";
import "../home.css";

const OverviewTab = lazy(() => import("../tabs/OverviewTab"));
const ReactivationTab = lazy(() => import("../tabs/ReactivationTab"));
const ReputationTab = lazy(() => import("../tabs/ReputationTab"));
const SocialTab = lazy(() => import("../tabs/SocialTab"));

// Phone moved to Calls › Stats, Website and WhatsApp to Chats › Stats: Home is the overview.
// Reactivation, Reputation and Social stay until their pages get a Stats tab of their own.
type HomePanelTab = Exclude<HomeTab, "phone" | "whatsapp" | "website">;
const PANELS: Record<HomePanelTab, typeof OverviewTab> = {
  overview: OverviewTab, reactivation: ReactivationTab, reputation: ReputationTab, social: SocialTab,
};
const ORDER: HomePanelTab[] = ["overview", "reactivation", "reputation", "social"];
const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };
const PERIOD_KEY = "leadawaker_home_period";

export function visibleTabs(services: HomeServices | undefined): HomePanelTab[] {
  if (!services) return ["overview"];
  return ORDER.filter((tab) => tab === "overview" || services[tab]);
}

function readTab(): HomePanelTab {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return (ORDER as string[]).includes(wanted ?? "") ? (wanted as HomePanelTab) : "overview";
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
  const [tab, setTab] = useState<HomePanelTab>(readTab);
  const [, setLocation] = useLocation();
  // The channel figures live on their own pages now: open Calls › Stats or Chats › Stats.
  const openTab = (next: HomeTab) => {
    if (next === "phone") {
      writeLastTab("calls", "stats");
      setLocation("/platform/voice-calls");
    } else if (next === "website" || next === "whatsapp") {
      writeLastTab("chats", "stats");
      rememberStatsChannel(next);
      setLocation("/platform/chat");
    } else {
      setTab(next);
    }
  };
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
  const noServices = !isLoading && services && !Object.values(services).some(Boolean);

  return (
    <div className="la-page" data-testid="page-home" style={{ background: "var(--bg)", overflow: "hidden" }}>
      {/* Fixed header: greeting + tabs never scroll. The tab content scrolls in
          its own container below, so cards (and their shadows) are cut off at
          the header's bottom edge instead of painting over it. */}
      <div className="shrink-0 la-m-chrome" style={{ background: "var(--bg)", position: "relative", zIndex: 1 }}>
        <div className="mr-auto flex max-w-[1386px] flex-col gap-5 px-4 pb-3 pt-7 md:px-9">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[26px] md:text-[32px]" style={{ margin: 0, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <span className="eyebrow eyebrow-sm">{dateStr}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {tabs.length > 1 ? <div className="la-seg la-seg--fill la-seg--touch max-w-full" role="tablist" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
              {tabs.map((k) => (
                <button key={k} role="tab" aria-selected={active === k} data-testid={`home-tab-${k}`}
                  className={cn("la-seg-btn shrink-0", active === k && "on")} onClick={() => setTab(k)}>
                  {t(`tabs.${k}`)}
                </button>
              ))}
            </div> : <span />}
            <select value={period} onChange={(e) => choosePeriod(e.target.value as HomePeriod)} aria-label={t("period.label")}
              className="neu-inset-crisp" data-testid="home-period"
              style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}>
              {HOME_PERIODS.map((p) => <option key={p} value={p}>{t(`period.${p}`)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* The page's one scroll container. Side and top padding live inside it so
          resting card shadows have room and are never clipped. */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="home-scroll">
        <div className="mr-auto flex max-w-[1386px] flex-col gap-5 px-4 pb-11 pt-3 md:px-9">
          {!isAgencyUser && <WelcomeChecklistCard />}
          {isError ? (
            <EmptyState title={t("errorTitle")} body={t("error")} />
          ) : noServices ? (
            <EmptyState title={t("empty.noServicesTitle")} body={t(isAgencyUser ? "empty.noServicesAgency" : "empty.noServicesClient")} />
          ) : (
            <Suspense fallback={<div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>}>
              {services ? <Panel key={currentAccountId} scope={scope} services={services} onOpenTab={openTab} /> : (
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
