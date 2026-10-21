// The studio, agency layout: Ideas (quick thoughts, one per line) and Scripts (working drafts) as two
// different panels, and the selected script in a right panel. On a phone they stack and a script opens
// full width; on a wide screen Ideas (narrower) and Scripts sit side by side. Gabriel stays in control of
// scripts; the client only answers the ones sent to him.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SocialApiError } from "../../api/socialApi";
import { fetchScripts, fetchTopics, socialScriptsKey, socialTopicsKey } from "../../api/studioApi";
import { studioErrorKey } from "../../lib/studio";
import { IdeasPanel } from "./IdeasPanel";
import { ScriptPanel } from "./ScriptPanel";
import { ScriptsPanel } from "./ScriptsPanel";

const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 };

export function StudioSection({ accountId, timeZone }: { accountId: number; timeZone: string }) {
  const { t } = useTranslation("social");
  const stacked = useIsMobile(1024);
  const narrow = useIsMobile(1360);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const topics = useQuery({ queryKey: socialTopicsKey(accountId), queryFn: () => fetchTopics(accountId), staleTime: 15_000 });
  const scripts = useQuery({ queryKey: socialScriptsKey(accountId), queryFn: () => fetchScripts(accountId), staleTime: 15_000 });
  const selected = scripts.data?.find((s) => s.id === selectedId) ?? null;
  const loadError = topics.error ?? scripts.error;

  const ideas = <IdeasPanel accountId={accountId} onScript={setSelectedId} />;
  const scriptList = <ScriptsPanel accountId={accountId} selectedId={selectedId} onSelect={setSelectedId} />;
  const panel = selected ? (
    <ScriptPanel key={selected.id} accountId={accountId} timeZone={timeZone} script={selected} onClose={() => setSelectedId(null)} />
  ) : (
    <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("scripts.pickOne")}</p>
    </div>
  );

  return (
    <div data-testid="studio-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loadError && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(loadError instanceof SocialApiError ? loadError.reason : "failed"))}</p>}
      {stacked ? (
        selected ? panel : <div style={stack}>{ideas}{scriptList}</div>
      ) : narrow ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <div style={stack}>{ideas}{scriptList}</div>
          {panel}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) minmax(280px, 360px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          {ideas}
          {scriptList}
          {panel}
        </div>
      )}
    </div>
  );
}
