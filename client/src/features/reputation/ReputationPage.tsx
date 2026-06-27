import { useEffect, useMemo, useState } from "react";
import { Inbox, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import type { AutoRule, InboxSelection } from "./types";
import { REP_DATA } from "./data";
import { IconSearch } from "./components/atoms";
import { RepInbox, RepInboxTopControls, getRepInboxLists, getRepViews } from "./components/inbox";
import { RepAnalytics } from "./components/analytics";
import { RepSettings } from "./components/settings";

const TABS = [
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];

function ReputationContent() {
  const D = REP_DATA;

  const [tab, setTab] = useState<Tab>("inbox");
  const [auto, setAuto] = useState<AutoRule>(D.settings.auto);
  const [selection, setSelection] = useState<InboxSelection | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [group, setGroup] = useState("recent");
  const [sort, setSort] = useState("lowest");
  const [filter, setFilter] = useState("all");

  const autoMode = auto.threshold !== "never";

  // Reset to the full activity feed whenever the operating mode flips.
  useEffect(() => { setView("all"); }, [autoMode]);

  const { heldList, heldCount, autoCount } = useMemo(() => getRepInboxLists(auto, autoMode), [auto, autoMode]);
  const views = useMemo(() => getRepViews(autoMode, heldCount, autoCount), [autoMode, heldCount, autoCount]);

  const openQueue = () => {
    setTab("inbox");
    setView("needs");
    const first = heldList[0] ?? D.reviews.find((r) => r.status === "needs");
    if (first) setSelection({ kind: "review", id: first.id });
  };

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
        <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>Reputation</span>

        <div className="la-seg la-seg--fill shrink-0" role="tablist" style={{ marginLeft: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={cn("la-seg-btn", tab === t.key && "on")}
              style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
              onClick={() => setTab(t.key)}
            >
              <span className="flex items-center"><t.Icon size={13} /></span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "inbox" && (
          <RepInboxTopControls views={views} view={view} setView={setView} group={group} setGroup={setGroup} sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} />
        )}

        <div style={{ flex: 1 }} />

        {tab === "inbox" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", padding: "7px 12px", width: 200, flexShrink: 0 }}>
            <IconSearch size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reviews…" style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", flex: 1, fontFamily: "var(--sans)", minWidth: 0 }} />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "inbox" && (
          <RepInbox
            state="connected"
            selection={selection}
            setSelection={setSelection}
            autoMode={autoMode}
            auto={auto}
            query={query}
            view={view}
            group={group}
            sort={sort}
            filter={filter}
          />
        )}
        {tab === "analytics" && <RepAnalytics autoMode={autoMode} auto={auto} onOpenQueue={openQueue} />}
        {tab === "settings" && <RepSettings auto={auto} setAuto={setAuto} />}
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
