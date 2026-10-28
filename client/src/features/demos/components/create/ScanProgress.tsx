import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { scanStepAt } from "../../scanSteps";

/**
 * The two steps of a website scan. It is one request, so the steps follow the clock
 * (scanStepAt): the active step spins, the finished one shows a check, the next one waits.
 */
export function ScanProgress({ startedAt }: { startedAt: number }) {
  const { t } = useTranslation("demos");
  // Re-render every second so the step can change while the request is still out.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const step = scanStepAt(Date.now() - startedAt);
  const rows = [
    { id: "reading", label: t("create.stepReading"), state: step === "reading" ? "active" : "done" },
    { id: "building", label: t("create.stepBuilding"), state: step === "building" ? "active" : "waiting" },
  ] as const;

  return (
    <ol role="status" aria-live="polite" className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2" style={{ fontSize: 12.5, color: r.state === "waiting" ? "var(--mute-2)" : "var(--ink)" }}>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {r.state === "active" ? (
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--wine)" }} />
            ) : r.state === "done" ? (
              <Check size={14} style={{ color: "var(--good)" }} />
            ) : (
              <span aria-hidden="true" className="dot" style={{ background: "var(--mute-2)" }} />
            )}
          </span>
          {r.label}
        </li>
      ))}
    </ol>
  );
}
