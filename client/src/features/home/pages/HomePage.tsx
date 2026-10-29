import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { HomePeriod, HomeServices } from "@shared/homeTypes";
import { isHomePeriod } from "@shared/homePeriod";
import { useHomeServices, type HomeScope } from "../api/homeApi";
import { WelcomeChecklistCard } from "../onboarding/WelcomeChecklistCard";
import { EmptyState } from "../components/EmptyState";
import { PeriodMenu } from "../components/PeriodMenu";
import { OverviewGrid } from "../stats/OverviewGrid";
import { SERVICE_ANCHOR, ServiceCards, type ServiceKey } from "../stats/ServiceCards";
import "../home.css";

const DATE_LOCALE: Record<string, string> = { en: "en-US", pt: "pt-BR", nl: "nl-NL" };
const PERIOD_KEY = "leadawaker_home_period";

/** All time unless a period was picked before (a retired one, like "7d", reads as All time). */
function readPeriod(): HomePeriod {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    if (isHomePeriod(saved)) return saved;
  } catch { /* storage unavailable */ }
  return "all";
}

/**
 * Old links still say ?tab=reactivation (Accounts > Services) or ?tab=phone: the page
 * has no tabs any more, so the link scrolls to that service's card instead. Read once.
 */
function linkedAnchor(): string | null {
  const wanted = new URLSearchParams(window.location.search).get("tab") ?? "";
  return Object.hasOwn(SERVICE_ANCHOR, wanted) ? SERVICE_ANCHOR[wanted as ServiceKey] : null;
}

/** The overview grid shows once a conversation channel (or Reactivation, which runs over WhatsApp/SMS) is on. */
const hasConversations = (s: HomeServices) => s.phone || s.whatsapp || s.website || s.sms || s.reactivation;

function StatsDashboard() {
  const { t, i18n } = useTranslation("home");
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const [period, setPeriod] = useState<HomePeriod>(readPeriod);
  const [anchor, setAnchor] = useState<string | null>(linkedAnchor);
  const { data: services, isLoading, isError } = useHomeServices(currentAccountId);

  // Drop the old ?tab= from the URL, then scroll to what it asked for once the sections are there.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tab")) return;
    params.delete("tab");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);
  useEffect(() => {
    if (!services || !anchor) return;
    const timer = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setAnchor(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [services, anchor]);

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
  const noServices = !isLoading && services && !Object.values(services).some(Boolean);
  const loading = <div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>;
  // Cards first (one per service that is on), then the overview grid.

  return (
    <div className="la-page" data-testid="page-home" style={{ background: "var(--bg)", overflow: "hidden" }}>
      {/* Fixed header: the greeting never scrolls. The page scrolls in its own
          container below, so cards (and their shadows) are cut off at the header's
          bottom edge instead of painting over it. */}
      <div className="shrink-0 la-m-chrome" style={{ background: "var(--bg)", position: "relative", zIndex: 1 }}>
        <div className="la-page-center flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pb-3 pt-7 md:px-9">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="eyebrow eyebrow-sm">{t("title")} · {dateStr}</span>
            <h1 className="text-[26px] md:text-[32px]" style={{ margin: 0, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
          </div>
          {/* The period menu lives in By channel; without that panel (no conversation channel) it sits here. */}
          {services && !noServices && !hasConversations(services) && <PeriodMenu value={period} onChange={choosePeriod} />}
        </div>
      </div>

      {/* The page's one scroll container. Side and top padding live inside it so
          resting card shadows have room and are never clipped. */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="home-scroll">
        <div className="la-page-center flex flex-col gap-5 px-4 pb-11 pt-3 md:px-9">
          {!isAgencyUser && <WelcomeChecklistCard />}
          {isError ? (
            <EmptyState title={t("errorTitle")} body={t("error")} />
          ) : noServices ? (
            <EmptyState title={t("empty.noServicesTitle")} body={t(isAgencyUser ? "empty.noServicesAgency" : "empty.noServicesClient")} />
          ) : !services ? loading : (
            <div key={currentAccountId} className="flex flex-col gap-8">
              <ServiceCards scope={scope} services={services} />
              {hasConversations(services) && <OverviewGrid scope={scope} services={services} onPeriod={choosePeriod} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <CrmShell>
      <StatsDashboard />
    </CrmShell>
  );
}
