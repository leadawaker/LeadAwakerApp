import { useState } from "react";
import { useTranslation } from "react-i18next";
import { List, Plus, RefreshCw } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { useDemoSessions } from "../api/demoSessionsApi";
import { DemoSessionsTable, DemosLoading } from "../components/DemoSessionsTable";
import { NewDemoForm } from "../components/NewDemoForm";

type Tab = "sessions" | "new";

function DemosContent() {
  const { t } = useTranslation("demos");
  const [tab, setTab] = useState<Tab>("sessions");
  const { data: sessions, isLoading, error, refetch, isFetching } = useDemoSessions();

  const tabs: Array<{ key: Tab; Icon: typeof List }> = [
    { key: "sessions", Icon: List },
    { key: "new", Icon: Plus },
  ];

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
        <span
          className="serif"
          style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}
        >
          {t("title")}
        </span>

        <div className="la-seg la-seg--fill shrink-0" role="tablist" style={{ marginLeft: 4 }}>
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              className={cn("la-seg-btn", tab === x.key && "on")}
              style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
              onClick={() => setTab(x.key)}
            >
              <span className="flex items-center">
                <x.Icon size={13} />
              </span>
              {t(`tabs.${x.key}`)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {tab === "sessions" && (
          <button
            type="button"
            onClick={() => refetch()}
            title={t("actions.refresh")}
            aria-label={t("actions.refresh")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            style={{ color: "var(--mute-2)" }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "new" ? (
          <div className="h-full min-h-0 overflow-y-auto" style={{ padding: "22px 24px" }}>
            <div className="max-w-[1386px] mr-auto">
              <NewDemoForm />
            </div>
          </div>
        ) : isLoading ? (
          <DemosLoading />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center" style={{ fontSize: 13, color: "var(--mute)" }}>
            {t("error.load")}
          </div>
        ) : !sessions?.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <span className="serif" style={{ fontSize: 16, color: "var(--ink)" }}>
              {t("empty.title")}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--mute-2)" }}>{t("empty.body")}</span>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-hidden" style={{ padding: "14px 24px 0" }}>
            <div className="mr-auto flex h-full min-h-0 max-w-[1386px] flex-col">
              <DemoSessionsTable sessions={sessions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DemosPage() {
  return (
    <CrmShell>
      <DemosContent />
    </CrmShell>
  );
}
