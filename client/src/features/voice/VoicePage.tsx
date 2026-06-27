import { useMemo, useState } from "react";
import { Inbox, BarChart3, Settings as SettingsIcon, Search, CalendarDays, ChevronDown } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { getVoiceViews, VoiceInbox, VoiceInboxTopControls } from "./components/inbox";
import { VoiceDashboard } from "./components/dashboard";
import { VoiceSettings } from "./components/settings";
import { VOICE_DASH } from "./data";

const TABS = [
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];

function VoiceContent() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [selection, setSelection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const views = useMemo(() => getVoiceViews(), []);

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
        <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>Missed Calls</span>

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

        {tab === "inbox" && <VoiceInboxTopControls views={views} view={view} setView={setView} />}

        <div style={{ flex: 1 }} />

        {tab === "inbox" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", padding: "7px 12px", width: 200, flexShrink: 0 }}>
            <Search size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", flex: 1, fontFamily: "var(--sans)", minWidth: 0 }}
            />
          </div>
        )}

        {tab === "dashboard" && (
          <button className="la-btn la-btn--inset" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <CalendarDays size={13} style={{ color: "var(--mute)" }} />
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{VOICE_DASH.range}</span>
            <ChevronDown size={12} style={{ color: "var(--mute-2)" }} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "inbox" && <VoiceInbox selection={selection} setSelection={setSelection} query={query} view={view} />}
        {tab === "dashboard" && <VoiceDashboard />}
        {tab === "settings" && <VoiceSettings />}
      </div>
    </div>
  );
}

export function VoicePage() {
  return (
    <CrmShell>
      <VoiceContent />
    </CrmShell>
  );
}
