import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import type { Tag } from "@/features/tags/types";

/* ════════════════════════════════════════════════════════════════════════════
   useCampaignTags — campaign-scoped tags data + CRUD
   Lightweight alternative to useTagsData: only 2 API calls (tags + leads)
   ════════════════════════════════════════════════════════════════════════════ */

export function useCampaignTags(campaignId: number, campaignName: string) {
  /* ── Raw data state (unfiltered) ──────────────────────────────────────── */
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { toast } = useToast();

  /* ── Fetch tags + leads in parallel ───────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagsRes, leadsRes] = await Promise.all([
        apiFetch("/api/tags"),
        apiFetch("/api/leads"),
      ]);
      if (!tagsRes.ok) throw new Error(`${tagsRes.status}: Failed to fetch tags`);
      const tagsData = await tagsRes.json();
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      setAllTags(Array.isArray(tagsData) ? tagsData.filter((t: Tag) => t.name) : []);
      setAllLeads(Array.isArray(leadsData) ? leadsData : []);
    } catch (err) {
      console.error("Failed to fetch campaign tags data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Filtered views (campaign-scoped) ─────────────────────────────────── */
  const tags = useMemo(
    () => allTags.filter((t) => t.campaign_id === campaignId),
    [allTags, campaignId],
  );

  const leads = useMemo(
    () =>
      allLeads.filter((l: any) => {
        const cid = l.campaign_id ?? l.Campaign_id ?? l.campaigns_id ?? l.Campaigns_id;
        return cid === campaignId;
      }),
    [allLeads, campaignId],
  );

  /* ── Derived: tag lead-counts (Map<tagName, count>) ───────────────────── */
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      if (Array.isArray(rawTags)) {
        rawTags.forEach((t: string) => {
          if (t) map.set(t, (map.get(t) ?? 0) + 1);
        });
      }
    });
    return map;
  }, [leads]);

  /* ════════════════════════════════════════════════════════════════════════
     CRUD operations
     ════════════════════════════════════════════════════════════════════════ */

  /* ── Create (auto-injects campaign_id + campaign_name) ────────────────── */
  const handleCreate = useCallback(
    async (payload: { name: string; color?: string; category?: string; description?: string }) => {
      const body: Record<string, any> = {
        name: payload.name.trim(),
        color: payload.color ?? "blue",
        campaign_id: campaignId,
        campaign_name: campaignName,
      };
      if (payload.category?.trim()) body.category = payload.category.trim();
      if (payload.description?.trim()) body.description = payload.description.trim();

      const res = await apiFetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status}: ${t}`);
      }
      const newTag = await res.json();
      setAllTags((prev) => [...prev, newTag]);
      toast({ title: "Tag created", description: `"${newTag.name ?? payload.name}" added.` });
      return newTag as Tag;
    },
    [campaignId, campaignName, toast],
  );

  /* ── Update single tag field ──────────────────────────────────────────── */
  const handleUpdate = useCallback(
    async (tagId: number, field: string, value: string | number | null, extra?: Record<string, any>) => {
      const payload: Record<string, any> = { [field]: value, ...extra };
      try {
        const res = await apiFetch(`/api/tags/${tagId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const updated = await res.json();
        setAllTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, ...updated } : t)));
        return updated as Tag;
      } catch (err) {
        console.error(`Failed to update tag ${tagId}:`, err);
        toast({ title: "Error", description: "Failed to update field", variant: "destructive" });
        throw err;
      }
    },
    [toast],
  );

  /* ── Bulk update (same field/value on many tags) ──────────────────────── */
  const handleBulkUpdate = useCallback(
    async (tagIds: number[], field: string, value: string | number | null, extra?: Record<string, any>) => {
      const payload: Record<string, any> = { [field]: value, ...extra };
      const results = await Promise.allSettled(
        tagIds.map(async (id) => {
          const res = await apiFetch(`/api/tags/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const updated = await res.json();
            setAllTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
          }
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      toast({ title: "Batch updated", description: `Updated ${succeeded} tag(s)` });
    },
    [toast],
  );

  /* ── Delete (single) ──────────────────────────────────────────────────── */
  const handleDelete = useCallback(
    async (tagId: number) => {
      const tag = allTags.find((t) => t.id === tagId);
      const res = await apiFetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      setAllTags((prev) => prev.filter((t) => t.id !== tagId));
      toast({ title: "Tag deleted", description: `"${tag?.name ?? tagId}" deleted.` });
    },
    [allTags, toast],
  );

  /* ── Bulk delete ──────────────────────────────────────────────────────── */
  const handleBulkDelete = useCallback(
    async (tagIds: number[]) => {
      const results = await Promise.allSettled(
        tagIds.map((id) => apiFetch(`/api/tags/${id}`, { method: "DELETE" })),
      );
      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && (r.value as Response).ok,
      ).length;
      const deletedSet = new Set(tagIds);
      setAllTags((prev) => prev.filter((t) => !deletedSet.has(t.id)));
      toast({ title: "Tags deleted", description: `${succeeded} tag(s) deleted.` });
    },
    [toast],
  );

  /* ── Duplicate (auto-injects campaign_id + campaign_name) ─────────────── */
  const handleDuplicate = useCallback(
    async (tagIds: number[]) => {
      const toDuplicate = allTags.filter((t) => tagIds.includes(t.id));
      if (toDuplicate.length === 0) return [];

      const newIds: number[] = [];
      for (const tag of toDuplicate) {
        try {
          const payload: Record<string, any> = {
            name: tag.name,
            color: tag.color,
            category: tag.category,
            description: tag.description,
            campaign_id: campaignId,
            campaign_name: campaignName,
          };
          if (tag.Accounts_id) payload.Accounts_id = tag.Accounts_id;

          const res = await apiFetch("/api/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const newTag = await res.json();
            setAllTags((prev) => [...prev, newTag]);
            newIds.push(newTag.id);
          }
        } catch {
          /* skip failed duplicates */
        }
      }
      toast({ title: "Duplicated", description: `${newIds.length} tag(s) duplicated.` });
      return newIds;
    },
    [allTags, campaignId, campaignName, toast],
  );

  /* ── Return ──────────────────────────────────────────────────────────── */
  return {
    tags,
    leads,
    tagCounts,
    loading,
    error,
    fetchData,
    handleCreate,
    handleUpdate,
    handleBulkUpdate,
    handleDelete,
    handleBulkDelete,
    handleDuplicate,
  };
}
