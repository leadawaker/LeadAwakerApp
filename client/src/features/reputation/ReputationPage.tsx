import { useEffect, useMemo, useState } from "react";
import { Inbox, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useLastTab } from "@/hooks/useLastTab";
import { CrmShell } from "@/components/crm/CrmShell";
import { PageTopbar, TopbarTabs, ExpandingSearch } from "@/components/crm/primitives";
import type { AutoRule, InboxSelection } from "./types";
import { REP_DATA } from "./data";
import { RepInbox, RepInboxTopControls, getRepInboxLists, getRepViews } from "./components/inbox";
import { RepAnalytics } from "./components/analytics";
import { RepSettings } from "./components/settings";
import { RepLiveConnection } from "./components/connection";
import { useLiveReputation } from "./live";

const TABS = [
  { key: "inbox", Icon: Inbox },
  { key: "analytics", Icon: BarChart3 },
  { key: "settings", Icon: SettingsIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);
const TAB_KEYS: readonly Tab[] = TABS.map((x) => x.key);

function ReputationContent() {
  const D = REP_DATA;
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("crm");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Deep link + the Google OAuth return: ?tab=settings&reviews=connected&account=1
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const requestedTab = params.get("tab");
  const oauthResult = params.get("reviews");
  const oauthAccountId = Number(params.get("account")) || undefined;

  // A ?tab= link wins; otherwise the page reopens on the tab used last.
  const [tab, setTab] = useLastTab<Tab>("reputation", TAB_KEYS, "inbox", isTab(requestedTab) ? requestedTab : null);
  // Drives the (not yet saved) automation dial in Settings and the sample Analytics.
  const [auto, setAuto] = useState<AutoRule>(D.settings.auto);
  const [selection, setSelection] = useState<InboxSelection | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("needs");
  const [group, setGroup] = useState("recent");
  const [sort, setSort] = useState("lowest");
  const [filter, setFilter] = useState("all");

  const live = useLiveReputation({
    received: t("reviewResponse.timelineReceived"),
    drafted: t("reviewResponse.timelineDrafted"),
    posted: t("reviewResponse.timelinePosted"),
    anonymous: t("reviewResponse.anonymous"),
  });

  // The inbox shows what the server actually did: auto-posted positives arrive
  // as "replied", so the inbox itself always runs in manual mode.
  const inboxAuto = useMemo<AutoRule>(() => ({ ...D.settings.auto, threshold: "never" }), [D]);
  const autoMode = false;

  useEffect(() => {
    if (!oauthResult) return;
    if (oauthResult === "connected") toast({ description: t("reviewResponse.oauthConnected") });
    else toast({ description: t("reviewResponse.oauthError"), variant: "destructive" });
    // Drop the one-shot result from the URL so a refresh does not repeat the toast.
    navigate("/platform/reputation?tab=settings" + (oauthAccountId ? `&account=${oauthAccountId}` : ""), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthResult]);

  const { heldList, heldCount, autoCount } = useMemo(() => getRepInboxLists(live.reviews, inboxAuto, autoMode), [live.reviews, inboxAuto, autoMode]);
  const repliedCount = useMemo(() => live.reviews.filter((r) => r.status === "replied").length, [live.reviews]);
  const views = useMemo(() => getRepViews(autoMode, heldCount, autoCount, repliedCount), [autoMode, heldCount, autoCount, repliedCount]);

  const inboxState = live.loading ? "connected" : live.connectedCount === 0 ? "disconnected" : heldCount === 0 ? "caughtup" : "connected";

  const openQueue = () => {
    setTab("inbox");
    setView("needs");
    if (heldList[0]) setSelection({ kind: "review", id: heldList[0].id });
  };

  const onPost = (reviewId: string, text: string) => {
    live.post(reviewId, text)
      .then(() => toast({ description: t("reviewResponse.posted") }))
      .catch((e: any) => toast({ description: e?.message || t("reviewResponse.actionError"), variant: "destructive" }));
  };
  const onSkip = (reviewId: string) => {
    live.skip(reviewId)
      .then(() => toast({ description: t("reviewResponse.skipped") }))
      .catch((e: any) => toast({ description: e?.message || t("reviewResponse.actionError"), variant: "destructive" }));
  };

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <PageTopbar
        title={tc("sidebar.reputation")}
        left={<>
          <TopbarTabs
            tabs={TABS.map((x) => ({ id: x.key, label: t(`servicePages.tabs.${x.key}`), icon: x.Icon }))}
            value={tab}
            onChange={setTab}
          />
          {tab === "inbox" && inboxState !== "disconnected" && (
            <RepInboxTopControls views={views} view={view} setView={setView} group={group} setGroup={setGroup} sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} />
          )}
        </>}
        right={tab === "inbox" && (
          <ExpandingSearch value={query} onChange={setQuery} placeholder={t("servicePages.searchReviews")} />
        )}
      />

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "inbox" && (
          <RepInbox
            state={inboxState}
            reviews={live.reviews}
            feedback={[]}
            selection={selection}
            setSelection={setSelection}
            autoMode={autoMode}
            auto={inboxAuto}
            busyId={live.busyId}
            onPost={onPost}
            onSkip={onSkip}
            onConnect={() => setTab("settings")}
            query={query}
            view={view}
            group={group}
            sort={sort}
            filter={filter}
          />
        )}
        {tab === "analytics" && (
          <>
            <div style={{ flexShrink: 0, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)", background: "var(--warn-tint)", padding: "9px 20px" }}>{t("reviewResponse.sampleAnalytics")}</div>
            <RepAnalytics autoMode={auto.threshold !== "never"} auto={auto} onOpenQueue={openQueue} />
          </>
        )}
        {tab === "settings" && (
          <RepSettings
            auto={auto}
            setAuto={setAuto}
            previewNote={t("reviewResponse.previewSettings")}
            connection={<RepLiveConnection initialAccountId={oauthAccountId} onChanged={live.reload} />}
          />
        )}
      </div>
    </div>
  );
}

export function ReputationPage() {
  return (
    <CrmShell>
      <ReputationContent />
    </CrmShell>
  );
}
