import { useMemo } from "react";
import { useCadenceQueue } from "../hooks/useCadenceQueue";
import { CadenceDailyProgress } from "../components/CadenceDailyProgress";
import { CadenceQueueRow } from "../components/CadenceQueueRow";

export default function CadencePage() {
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-foreground">Cadence</h1>
      </div>

      <div className="px-4 pb-3">
        <CadenceDailyProgress queue={queue} todayContactCount={todayContactCount} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : queue.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No contacts due today.
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
