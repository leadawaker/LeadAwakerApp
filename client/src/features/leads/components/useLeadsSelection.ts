import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { updateLead, deleteLead } from "../api/leadsApi";
import { getLeadId as getLeadIdFromView, getStatus, getFullName } from "./LeadsCardView";

// Re-use helpers from LeadsCardView to avoid duplication
export { getLeadId, getStatus, getFullName } from "./LeadsCardView";

export type QuickActionType = "status" | "note" | "delete";

export interface UseLeadsSelectionOptions {
  onRefresh?: () => void;
}

export interface UseLeadsSelectionReturn {
  // Quick-action tray state (swipe actions on mobile)
  quickActionLead: Record<string, any> | null;
  quickActionType: QuickActionType | null;
  quickNoteText: string;
  quickStatusPending: string;
  quickActionBusy: boolean;

  setQuickNoteText: (v: string) => void;
  setQuickStatusPending: (v: string) => void;

  openQuickAction: (lead: Record<string, any>, type: QuickActionType) => void;
  closeQuickAction: () => void;
  handleQuickSaveStatus: () => Promise<void>;
  handleQuickSaveNote: () => Promise<void>;
  handleQuickConfirmDelete: () => Promise<void>;
}

export function useLeadsSelection({ onRefresh }: UseLeadsSelectionOptions): UseLeadsSelectionReturn {
  const { toast } = useToast();

  const [quickActionLead, setQuickActionLead] = useState<Record<string, any> | null>(null);
  const [quickActionType, setQuickActionType] = useState<QuickActionType | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [quickStatusPending, setQuickStatusPending] = useState("");
  const [quickActionBusy, setQuickActionBusy] = useState(false);

  const openQuickAction = useCallback((lead: Record<string, any>, type: QuickActionType) => {
    setQuickActionLead(lead);
    setQuickActionType(type);
    if (type === "status") setQuickStatusPending(getStatus(lead));
    if (type === "note")   setQuickNoteText("");
  }, []);

  const closeQuickAction = useCallback(() => {
    setQuickActionLead(null);
    setQuickActionType(null);
    setQuickActionBusy(false);
  }, []);

  const handleQuickSaveStatus = useCallback(async () => {
    if (!quickActionLead || !quickStatusPending) return;
    setQuickActionBusy(true);
    try {
      await updateLead(getLeadIdFromView(quickActionLead), { pipeline_stage: quickStatusPending });
      onRefresh?.();
      toast({ title: "Status updated", description: `Moved to ${quickStatusPending}` });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, quickStatusPending, onRefresh, toast, closeQuickAction]);

  const handleQuickSaveNote = useCallback(async () => {
    if (!quickActionLead || !quickNoteText.trim()) return;
    setQuickActionBusy(true);
    try {
      const existing  = quickActionLead.notes || quickActionLead.Notes || "";
      const dateStamp = new Date().toLocaleDateString();
      const newNotes  = existing
        ? `${existing}\n\n[${dateStamp}] ${quickNoteText.trim()}`
        : `[${dateStamp}] ${quickNoteText.trim()}`;
      await updateLead(getLeadIdFromView(quickActionLead), { notes: newNotes });
      onRefresh?.();
      toast({ title: "Note added" });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, quickNoteText, onRefresh, toast, closeQuickAction]);

  const handleQuickConfirmDelete = useCallback(async () => {
    if (!quickActionLead) return;
    setQuickActionBusy(true);
    try {
      await deleteLead(getLeadIdFromView(quickActionLead));
      onRefresh?.();
      toast({ title: "Lead deleted" });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to delete lead", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, onRefresh, toast, closeQuickAction]);

  return {
    quickActionLead,
    quickActionType,
    quickNoteText,
    quickStatusPending,
    quickActionBusy,
    setQuickNoteText,
    setQuickStatusPending,
    openQuickAction,
    closeQuickAction,
    handleQuickSaveStatus,
    handleQuickSaveNote,
    handleQuickConfirmDelete,
  };
}
