import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageTopbar } from "@/components/crm/primitives";
import { useCadenceQueue } from "../hooks/useCadenceQueue";
import { CadenceDailyProgress } from "../components/CadenceDailyProgress";
import { CadenceQueueRow } from "../components/CadenceQueueRow";

export default function CadencePage() {
  const { t } = useTranslation("cadence");
  const { queue, isLoading, logContact, enterCadence, skipCadence } = useCadenceQueue();

  const todayContactCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return queue.filter((p) => {
      const t = p.last_contacted_at ? new Date(p.last_contacted_at) : null;
      return t && t >= todayStart;
    }).length;
  }, [queue]);

  return (
    <div className="la-page" style={{ background: "var(--bg)" }}>
      <PageTopbar title={t("title")} count={queue.length} />

      <div className="px-4 pt-3 pb-3">
        <CadenceDailyProgress queue={queue} todayContactCount={todayContactCount} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : queue.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          queue.map((prospect) => (
            <CadenceQueueRow
              key={prospect.id}
              prospect={prospect}
              onLogContact={(id, payload) => logContact({ id, payload })}
              onEnterCadence={(id) => enterCadence(id)}
              onSkip={(id) => skipCadence(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
