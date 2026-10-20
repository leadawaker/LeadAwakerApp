import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, MessageCircle } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { HOME_PERIODS, type HomePeriod, type HomeTab } from "@shared/homeTypes";
import { useHomeServices, type HomeScope } from "../api/homeApi";
import { EmptyState } from "../components/EmptyState";
import "../home.css";

const PhoneTab = lazy(() => import("../tabs/PhoneTab"));
const WebsiteTab = lazy(() => import("../tabs/WebsiteTab"));
const WhatsappTab = lazy(() => import("../tabs/WhatsappTab"));

const PERIOD_KEY = "leadawaker_home_period";
const CHANNEL_KEY = "la.chatsStats.channel";
type ChatChannel = "website" | "whatsapp";

function readPeriod(): HomePeriod {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    if ((HOME_PERIODS as readonly string[]).includes(saved ?? "")) return saved as HomePeriod;
  } catch { /* storage unavailable */ }
  return "month";
}

function readChannel(): ChatChannel {
  try {
    return localStorage.getItem(CHANNEL_KEY) === "whatsapp" ? "whatsapp" : "website";
  } catch {
    return "website";
  }
}

/** Remembers which channel Chats › Stats opens on (Home's channel rows set it before navigating). */
export function rememberStatsChannel(c: ChatChannel): void {
  try { localStorage.setItem(CHANNEL_KEY, c); } catch { /* not remembered */ }
}

/**
 * The Stats tab of Calls (phone) and Chats (website / WhatsApp): Home's old
 * channel tabs, moved next to the lists they describe. Shares Home's period.
 * With both chat channels on, a channel switch picks which one to show.
 */
export function StatsPanel({ kind }: { kind: "phone" | "chats" }) {
  const { t } = useTranslation("home");
  const { currentAccountId } = useWorkspace();
  const { data: services, isLoading, isError } = useHomeServices(currentAccountId);
  const [period, setPeriod] = useState<HomePeriod>(readPeriod);
  const [channel, setChannel] = useState<ChatChannel>(readChannel);

  const choosePeriod = (p: HomePeriod) => {
    setPeriod(p);
    try { localStorage.setItem(PERIOD_KEY, p); } catch { /* ignore */ }
  };
  const chooseChannel = (c: ChatChannel) => {
    setChannel(c);
    rememberStatsChannel(c);
  };

  const chatChannels: ChatChannel[] = services ? (["website", "whatsapp"] as const).filter((c) => services[c]) : [];
  const activeChannel: ChatChannel = chatChannels.includes(channel) ? channel : chatChannels[0] ?? "website";
  const scope: HomeScope = { accountId: currentAccountId, period };
  const Panel = kind === "phone" ? PhoneTab : activeChannel === "whatsapp" ? WhatsappTab : WebsiteTab;
  const loading = <div className="eyebrow eyebrow-sm" style={{ padding: 24 }}>{t("loading")}</div>;
  // Stats has no other tabs to jump to from here.
  const noTab = (_tab: HomeTab) => undefined;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid={`stats-panel-${kind}`} style={{ background: "var(--bg)" }}>
      <div className="mr-auto flex max-w-[1386px] flex-col gap-5 px-4 pb-11 pt-4 md:px-9 md:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {kind === "chats" && chatChannels.length > 1 ? (
            <div className="la-seg la-seg--touch" role="tablist" aria-label={t("stats.channel")}>
              {chatChannels.map((c) => {
                const Icon = c === "website" ? Globe : MessageCircle;
                return (
                  <button key={c} role="tab" aria-selected={activeChannel === c} data-testid={`stats-channel-${c}`}
                    className={cn("la-seg-btn", activeChannel === c && "on")} onClick={() => chooseChannel(c)}>
                    <Icon size={14} />
                    {t(`tabs.${c}`)}
                  </button>
                );
              })}
            </div>
          ) : <span />}
          <select value={period} onChange={(e) => choosePeriod(e.target.value as HomePeriod)} aria-label={t("period.label")}
            className="neu-inset-crisp" data-testid="stats-period"
            style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}>
            {HOME_PERIODS.map((p) => <option key={p} value={p}>{t(`period.${p}`)}</option>)}
          </select>
        </div>
        {isError ? (
          <EmptyState title={t("errorTitle")} body={t("error")} />
        ) : isLoading || !services ? loading : kind === "chats" && chatChannels.length === 0 ? (
          <EmptyState title={t("empty.noServicesTitle")} body={t("stats.noChats")} />
        ) : (
          <Suspense fallback={loading}>
            <Panel key={`${currentAccountId}-${activeChannel}`} scope={scope} services={services} onOpenTab={noTab} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
