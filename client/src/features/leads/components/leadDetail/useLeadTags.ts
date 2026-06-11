// Lead tag state: fetches the lead's current tags + all available tags,
// manages add/remove, and derives the unassigned list.
// Extracted verbatim from LeadDetailPanel.tsx (Session C).
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";
import type { TagData, LeadTagEntry } from "./types";

export function useLeadTags(
  leadId: number | string | undefined,
  open: boolean,
) {
  // ── Tags state ──
  const [leadTags, setLeadTags] = useState<TagData[]>([]);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [removingTagId, setRemovingTagId] = useState<number | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // ── Fetch lead tags when panel opens ──
  useEffect(() => {
    if (!open || !leadId) {
      setLeadTags([]);
      setShowTagDropdown(false);
      return;
    }

    let cancelled = false;
    setLoadingTags(true);

    // Fetch lead's current tags (returns Leads_Tags rows with tagName denormalized)
    apiFetch(`/api/leads/${leadId}/tags`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: LeadTagEntry[]) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        // Convert LeadTagEntry rows to TagData for display
        // The Leads_Tags table has a tagName denormalized field
        const tagList: TagData[] = arr
          .filter((e) => e.tagsId || e.Tags_id)
          .map((e) => ({
            id: e.tagsId ?? e.Tags_id ?? 0,
            name: e.tagName || `Tag #${e.tagsId ?? e.Tags_id}`,
            color: null,
            category: null,
          }));
        setLeadTags(tagList);
      })
      .catch(() => { if (!cancelled) setLeadTags([]); })
      .finally(() => { if (!cancelled) setLoadingTags(false); });

    return () => { cancelled = true; };
  }, [open, leadId]);

  // ── Fetch available tags once ──
  useEffect(() => {
    if (!open) return;
    apiFetch("/api/tags")
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((data: any) => {
        const arr: any[] = Array.isArray(data) ? data : data?.list || data?.data || [];
        setAvailableTags(arr.map((t: any) => ({
          id: t.Id ?? t.id,
          name: t.Name ?? t.name ?? "Tag",
          color: t.Color ?? t.color ?? null,
          category: t.Category ?? t.category ?? null,
          slug: t.Slug ?? t.slug ?? null,
        })));
      })
      .catch(() => {});
  }, [open]);

  const handleAddTag = async (tag: TagData) => {
    if (!leadId) return;
    // Already assigned?
    if (leadTags.some((t) => t.id === tag.id)) {
      setShowTagDropdown(false);
      return;
    }
    setAddingTag(true);
    try {
      const res = await apiFetch(`/api/leads/${leadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });
      if (res.ok) {
        setLeadTags((prev) => [...prev, tag]);
      }
    } catch {
      // silently ignore
    } finally {
      setAddingTag(false);
      setShowTagDropdown(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!leadId) return;
    setRemovingTagId(tagId);
    try {
      const res = await apiFetch(`/api/leads/${leadId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLeadTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    } catch {
      // silently ignore
    } finally {
      setRemovingTagId(null);
    }
  };

  // Derive available tags that aren't yet assigned
  const unassignedTags = availableTags.filter(
    (t) => !leadTags.some((lt) => lt.id === t.id)
  );

  return {
    leadTags,
    availableTags,
    loadingTags,
    addingTag,
    removingTagId,
    showTagDropdown,
    setShowTagDropdown,
    handleAddTag,
    handleRemoveTag,
    unassignedTags,
  };
}
