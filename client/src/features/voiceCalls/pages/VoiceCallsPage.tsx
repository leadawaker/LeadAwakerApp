import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useVoiceCalls } from "../api/voiceCallsApi";
import { VoiceCallsInbox, filterCalls, type VoiceCallView } from "../components/VoiceCallsInbox";

const VIEWS: VoiceCallView[] = ["all", "booked", "notBooked"];

function VoiceCallsContent() {
  const { t } = useTranslation("voiceCalls");
  const { data: calls = [], isLoading, error } = useVoiceCalls();
  const [selection, setSelection] = useState<string | null>(null);
  const [view, setView] = useState<VoiceCallView>("all");
  const [query, setQuery] = useState("");

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px", overflowX: "auto" }}>
        <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>
          {t("title")}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {VIEWS.map((key) => {
            const on = view === key;
            const count = filterCalls(calls, key, "").length;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", padding: "6px 11px", borderRadius: "var(--r-pill)", transition: "all 120ms", fontFamily: "var(--sans)", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? "var(--card)" : "transparent", color: on ? "var(--wine)" : "var(--mute)", boxShadow: on ? "var(--sh-raised-crisp)" : "none", whiteSpace: "nowrap" }}
              >
                {t(`views.${key}`)}
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: "0 5px", borderRadius: "var(--r-pill)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? "var(--wine-tint)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)", color: on ? "var(--wine)" : "var(--mute)" }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div className="hidden md:flex" style={{ alignItems: "center", gap: 6, background: "var(--bg)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", padding: "7px 12px", width: 200, flexShrink: 0 }}>
          <Search size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", flex: 1, fontFamily: "var(--sans)", minWidth: 0 }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <VoiceCallsInbox
          calls={calls}
          isLoading={isLoading}
          error={error}
          view={view}
          query={query}
          selection={selection}
          setSelection={setSelection}
        />
      </div>
    </div>
  );
}

export function VoiceCallsPage() {
  return (
    <CrmShell>
      <VoiceCallsContent />
    </CrmShell>
  );
}
