// Pipeline stage / conversion status state + mutation for LeadDetailPanel.
// Also owns localAiSummary, which is populated after a lead is moved to "Booked"
// (the Python engine generates the summary async; we refetch to pick it up).
// Extracted verbatim from LeadDetailPanel.tsx (Session C).
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";

export function useLeadStage(
  leadId: number | string | undefined,
  lead: Record<string, any> | null,
) {
  const [localStatus, setLocalStatus] = useState<string>("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [stageSaved, setStageSaved] = useState(false);
  const [localAiSummary, setLocalAiSummary] = useState<string | null>(null);

  // Sync localStatus when lead changes
  useEffect(() => {
    const status = lead?.conversion_status || lead?.Conversion_Status || "";
    setLocalStatus(status);
    setStageSaved(false);
  }, [lead?.Id, lead?.id, lead?.Conversion_Status, lead?.conversion_status]);

  const handleStageChange = async (newStage: string) => {
    if (!leadId || newStage === localStatus) return;

    const prevStatus = localStatus;
    setLocalStatus(newStage); // optimistic update
    setSavingStatus(true);
    setStageSaved(false);

    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Conversion_Status: newStage }),
      });
      if (!res.ok) {
        setLocalStatus(prevStatus); // revert on error
      } else {
        setStageSaved(true);
        setTimeout(() => setStageSaved(false), 2000);
        // After booking/closing, the Python engine generates an AI summary async.
        // Refetch the lead after ~3.5s to pick it up without requiring a page refresh.
        if (newStage === "Booked") {
          setTimeout(async () => {
            try {
              const r = await apiFetch(`/api/leads/${leadId}`);
              if (r.ok) {
                const updated = await r.json();
                if (updated.ai_summary) setLocalAiSummary(updated.ai_summary);
              }
            } catch { /* silent */ }
          }, 3500);
        }
      }
    } catch {
      setLocalStatus(prevStatus); // revert on error
    } finally {
      setSavingStatus(false);
    }
  };

  return {
    localStatus,
    savingStatus,
    stageSaved,
    localAiSummary,
    handleStageChange,
  };
}
