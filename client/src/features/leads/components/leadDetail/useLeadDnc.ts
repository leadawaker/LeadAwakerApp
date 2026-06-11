// DNC / opted-out state + mutations for LeadDetailPanel.
// Extracted verbatim from LeadDetailPanel.tsx (Session C).
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";

export function useLeadDnc(
  leadId: number | string | undefined,
  lead: Record<string, any> | null,
) {
  // ── DNC / Opted-out state ──
  const [localOptedOut, setLocalOptedOut] = useState<boolean>(false);
  const [localDncReason, setLocalDncReason] = useState<string>("");
  const [savingDnc, setSavingDnc] = useState(false);
  const [dncSaved, setDncSaved] = useState(false);
  const [showDncReason, setShowDncReason] = useState(false);

  // Sync DNC / opted-out state when lead changes
  useEffect(() => {
    const optedOut = Boolean(lead?.opted_out);
    setLocalOptedOut(optedOut);
    setLocalDncReason(lead?.dnc_reason || "");
    setShowDncReason(optedOut);
    setDncSaved(false);
  }, [lead?.Id, lead?.id, lead?.opted_out, lead?.dnc_reason]);

  const handleDncChange = async (checked: boolean) => {
    if (!leadId || savingDnc) return;
    const prev = localOptedOut;
    setLocalOptedOut(checked);
    setShowDncReason(checked);
    setSavingDnc(true);
    setDncSaved(false);
    try {
      const payload: Record<string, any> = { opted_out: checked };
      if (!checked) payload.dnc_reason = "";
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setLocalOptedOut(prev);
        setShowDncReason(prev);
      } else {
        if (!checked) setLocalDncReason("");
        setDncSaved(true);
        setTimeout(() => setDncSaved(false), 2000);
      }
    } catch {
      setLocalOptedOut(prev);
      setShowDncReason(prev);
    } finally {
      setSavingDnc(false);
    }
  };

  const handleDncReasonSave = async () => {
    if (!leadId || savingDnc) return;
    setSavingDnc(true);
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dnc_reason: localDncReason }),
      });
      setDncSaved(true);
      setTimeout(() => setDncSaved(false), 2000);
    } catch {
      // silently ignore
    } finally {
      setSavingDnc(false);
    }
  };

  return {
    localOptedOut,
    localDncReason,
    setLocalDncReason,
    savingDnc,
    dncSaved,
    showDncReason,
    handleDncChange,
    handleDncReasonSave,
  };
}
