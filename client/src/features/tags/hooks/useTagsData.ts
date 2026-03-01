import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import type { Tag } from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   useTagsData — data fetching, derived lookups, and CRUD for the Tags feature
   ════════════════════════════════════════════════════════════════════════════ */

export function useTagsData() {
  /* ── Raw data state ─────────────────────────────────────────────────────── */
  const [tags, setTags] = useState<Tag[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { toast } = useToast();

  /* ── Fetch all data in parallel ─────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagsRes, leadsRes, campaignsRes, accountsRes] = await Promise.all([
        apiFetch("/api/tags"),
        apiFetch("/api/leads"),
        apiFetch("/api/campaigns"),
        apiFetch("/api/accounts"),
      ]);
      if (!tagsRes.ok) throw new Error(`${tagsRes.status}: Failed to fetch tags`);
      const tagsData = await tagsRes.json();
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];
      setTags(Array.isArray(tagsData) ? tagsData.filter((t: Tag) => t.name) : []);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (err) {
      console.error("Failed to fetch tags data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived: tag lead-counts (Map<tagName, count>) ─────────────────────── */
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

  /* ── Derived: unique category options ───────────────────────────────────── */
  const categoryOptions = useMemo((): string[] => {
    const cats = new Set<string>();
    tags.forEach((tag) => {
      cats.add(tag.category ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1) : "Uncategorized");
    });
    return Array.from(cats).sort();
  }, [tags]);

  /* ── Derived: account name map ──────────────────────────────────────────── */
  const accountNameMap = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a: any) => m.set(String(a.id), a.name ?? `Account ${a.id}`));
    return m;
  }, [accounts]);

  /* ── Derived: campaign name map ─────────────────────────────────────────── */
  const campaignNameMap = useMemo(() => {
    const m = new Map<string, string>();
    campaigns.forEach((c: any) => m.set(String(c.id ?? c.Id), c.name ?? `Campaign ${c.id}`));
    return m;
  }, [campaigns]);

  /* ════════════════════════════════════════════════════════════════════════
     CRUD operations
     ════════════════════════════════════════════════════════════════════════ */

  /* ── Create ─────────────────────────────────────────────────────────────── */
  const handleCreate = useCallback(
    async (payload: { name: string; color?: string; category?: string; description?: string; campaign_id?: number; campaign_name?: string }) => {
      const body: Record<string, any> = { name: payload.name.trim(), color: payload.color ?? "blue" };
      if (payload.category?.trim()) body.category = payload.category.trim();
      if (payload.description?.trim()) body.description = payload.description.trim();
      if (payload.campaign_id) body.campaign_id = payload.campaign_id;
      if (payload.campaign_name) body.campaign_name = payload.campaign_name;

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
      setTags((prev) => [...prev, newTag]);
      toast({ title: "Tag created", description: `"${newTag.name ?? payload.name}" added.` });
      return newTag as Tag;
    },
    [toast],
  );

  /* ── Update single tag field ────────────────────────────────────────────── */
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
        setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, ...updated } : t)));
        return updated as Tag;
      } catch (err) {
        console.error(`Failed to update tag ${tagId}:`, err);
        toast({ title: "Error", description: "Failed to update field", variant: "destructive" });
        throw err;
      }
    },
    [toast],
  );

  /* ── Bulk update (same field/value on many tags) ────────────────────────── */
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
            setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
          }
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      toast({ title: "Batch updated", description: `Updated ${succeeded} tag(s)` });
    },
    [toast],
  );

  /* ── Delete (single) ────────────────────────────────────────────────────── */
  const handleDelete = useCallback(
    async (tagId: number) => {
      const tag = tags.find((t) => t.id === tagId);
      const res = await apiFetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast({ title: "Tag deleted", description: `"${tag?.name ?? tagId}" deleted.` });
    },
    [tags, toast],
  );

  /* ── Bulk delete ────────────────────────────────────────────────────────── */
  const handleBulkDelete = useCallback(
    async (tagIds: number[]) => {
      const results = await Promise.allSettled(
        tagIds.map((id) => apiFetch(`/api/tags/${id}`, { method: "DELETE" })),
      );
      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && (r.value as Response).ok,
      ).length;
      const deletedSet = new Set(tagIds);
      setTags((prev) => prev.filter((t) => !deletedSet.has(t.id)));
      toast({ title: "Tags deleted", description: `${succeeded} tag(s) deleted.` });
    },
    [toast],
  );

  /* ── Duplicate selected tags ────────────────────────────────────────────── */
  const handleDuplicate = useCallback(
    async (tagIds: number[]) => {
      const toDuplicate = tags.filter((t) => tagIds.includes(t.id));
      if (toDuplicate.length === 0) return [];

      const newIds: number[] = [];
      for (const tag of toDuplicate) {
        try {
          const payload: Record<string, any> = {
            name: tag.name,
            color: tag.color,
            category: tag.category,
            description: tag.description,
          };
          if (tag.Accounts_id) payload.Accounts_id = tag.Accounts_id;
          if (tag.campaign_id) payload.campaign_id = tag.campaign_id;
          if (tag.campaign_name) payload.campaign_name = tag.campaign_name;

          const res = await apiFetch("/api/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const newTag = await res.json();
            setTags((prev) => [...prev, newTag]);
            newIds.push(newTag.id);
          }
        } catch {
          /* skip failed duplicates */
        }
      }
      toast({ title: "Duplicated", description: `${newIds.length} tag(s) duplicated.` });
      return newIds;
    },
    [tags, toast],
  );

  /* ── Return ─────────────────────────────────────────────────────────────── */
  return {
    tags,
    leads,
    campaigns,
    accounts,
    tagCounts,
    categoryOptions,
    accountNameMap,
    campaignNameMap,
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
