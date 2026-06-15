import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import type { KBEntryData, KBScope, KBInject, KBCampaign } from "../types";

// Category order for grouping / display.
export const KB_CATEGORIES = [
  "pricing",
  "services",
  "faq",
  "objections",
  "team",
  "hours",
  "location",
  "policies",
  "testimonials",
] as const;

export type KBFormPayload = {
  category: string;
  title: string;
  content: string;
  scope: KBScope;
  inject: KBInject;
};

// ── API ⇄ model mapping ───────────────────────────────────────────────────────
function scopeFromApi(campaignIds: number[] | null | undefined): KBScope {
  if (campaignIds === null || campaignIds === undefined) return "all";
  if (Array.isArray(campaignIds) && campaignIds.length === 0) return "hidden";
  return campaignIds;
}
function scopeToApi(scope: KBScope): number[] | null {
  if (scope === "all") return null;
  if (scope === "hidden") return [];
  return scope;
}
function injectFromApi(minInboundMessages: number | null | undefined): KBInject {
  return minInboundMessages == null ? "always" : minInboundMessages;
}
function injectToApi(inject: KBInject): number | null {
  return inject === "always" ? null : inject;
}

function adaptEntry(raw: any): KBEntryData {
  return {
    id: raw.id ?? raw.Id,
    category: String(raw.category ?? "faq"),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    scope: scopeFromApi(raw.campaignIds),
    inject: injectFromApi(raw.minInboundMessages),
  };
}

function payloadToApi(p: KBFormPayload) {
  return {
    category: p.category,
    title: p.title,
    content: p.content,
    campaignIds: scopeToApi(p.scope),
    minInboundMessages: injectToApi(p.inject),
  };
}

export function useKnowledgeBase(accountId: number) {
  const [entries, setEntries] = useState<KBEntryData[]>([]);
  const [campaigns, setCampaigns] = useState<KBCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge`);
      if (res.ok) setEntries((await res.json()).map(adaptEntry));
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    apiFetch(`/api/campaigns?accountId=${accountId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => setCampaigns(data.map((c) => ({ id: c.id ?? c.Id, name: String(c.name ?? c.Name ?? "") }))))
      .catch(() => {});
  }, [accountId]);

  const addEntry = useCallback(async (p: KBFormPayload) => {
    const res = await apiFetch(`/api/accounts/${accountId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadToApi(p)),
    });
    if (res.ok) await fetchEntries();
    return res.ok;
  }, [accountId, fetchEntries]);

  const updateEntry = useCallback(async (id: number, p: KBFormPayload) => {
    const res = await apiFetch(`/api/accounts/${accountId}/knowledge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadToApi(p)),
    });
    if (res.ok) await fetchEntries();
    return res.ok;
  }, [accountId, fetchEntries]);

  const deleteEntry = useCallback(async (id: number) => {
    const res = await apiFetch(`/api/accounts/${accountId}/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    return res.ok;
  }, [accountId]);

  // Group by category, ordered.
  const grouped = KB_CATEGORIES.map((cat) => ({
    category: cat,
    entries: entries.filter((e) => e.category === cat),
  }));
  const populated = grouped.filter((g) => g.entries.length > 0);
  const empty = grouped.filter((g) => g.entries.length === 0).map((g) => g.category);

  return { entries, campaigns, loading, grouped, populated, empty, addEntry, updateEntry, deleteEntry };
}
