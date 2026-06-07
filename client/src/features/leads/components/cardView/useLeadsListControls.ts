// List-view UI controls for the Leads card view: persisted display toggles,
// checkbox selection, bulk stage/delete actions, and peek/bulk UI flags.
// Extracted from LeadsCardViewMain.tsx to keep that component focused.
import { useState, useCallback } from "react";
import { bulkUpdateLeads, bulkDeleteLeads } from "../../api/leadsApi";

export function useLeadsListControls(onRefresh?: () => void) {
  // ── Checkbox selection state ────────────────────────────────────────────
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const toggleLeadSelection = useCallback((id: number) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearLeadSelection = useCallback(() => setSelectedLeadIds(new Set()), []);

  // ── Bulk actions for the list-view selection (Feature B) ────────────────
  const [bulkBusy, setBulkBusy] = useState(false);
  const handleListBulkStageChange = useCallback(async (stage: string) => {
    if (selectedLeadIds.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads(Array.from(selectedLeadIds), { Conversion_Status: stage });
      setSelectedLeadIds(new Set());
      onRefresh?.();
    } catch (err) {
      console.error("List bulk stage change failed", err);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedLeadIds, onRefresh]);

  const handleListBulkDelete = useCallback(async () => {
    if (selectedLeadIds.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkDeleteLeads(Array.from(selectedLeadIds));
      setSelectedLeadIds(new Set());
      onRefresh?.();
    } catch (err) {
      console.error("List bulk delete failed", err);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedLeadIds, onRefresh]);

  const handleListBulkCampaignChange = useCallback(async (campaignId: number) => {
    if (selectedLeadIds.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeads(Array.from(selectedLeadIds), { Campaigns_id: campaignId });
      setSelectedLeadIds(new Set());
      onRefresh?.();
    } catch (err) {
      console.error("List bulk campaign change failed", err);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedLeadIds, onRefresh]);

  // ── Chats peek toggle (Feature A) + bulk UI flags ───────────────────────
  const [peekOn, setPeekOn] = useState(false);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkCampaignOpen, setBulkCampaignOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  return {
    selectedLeadIds, toggleLeadSelection, clearLeadSelection,
    bulkBusy, handleListBulkStageChange, handleListBulkDelete, handleListBulkCampaignChange,
    peekOn, setPeekOn,
    bulkStageOpen, setBulkStageOpen,
    bulkCampaignOpen, setBulkCampaignOpen,
    bulkDeleteConfirm, setBulkDeleteConfirm,
  };
}
