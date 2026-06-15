import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { FACT_DEFS, QA_CATEGORY, type FactValues, type QARow } from "./profileConstants";

// Onboarding facts are written to the existing Knowledge Base.
// - Fixed facts (FACT_DEFS) map to one KB entry each, matched by (category, title).
// - Q&A grids (objections, FAQ) are KB entries in their own category, by id.
interface KBEntry { id: number; category: string; title: string; content: string }
export type QAGrids = Record<string, QARow[]>; // keyed by step key (objections | faq)

function matchEntry(entries: KBEntry[], category: string, title: string) {
  return entries.find((e) => e.category === category && e.title === title);
}

export function useOnboardingFacts(accountId: number) {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge`);
      if (res.ok) {
        const rows = await res.json();
        setEntries(rows.map((r: any) => ({ id: r.id ?? r.Id, category: String(r.category ?? ""), title: String(r.title ?? ""), content: String(r.content ?? "") })));
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Fixed-fact answers keyed by fact id.
  const values: FactValues = {};
  for (const id of Object.keys(FACT_DEFS)) {
    const def = FACT_DEFS[id];
    values[id] = matchEntry(entries, def.category, def.title)?.content ?? "";
  }

  // Q&A grid rows per step key.
  const grids: QAGrids = {};
  for (const stepKey of Object.keys(QA_CATEGORY)) {
    grids[stepKey] = entries
      .filter((e) => e.category === QA_CATEGORY[stepKey])
      .map((e) => ({ id: e.id, question: e.title, answer: e.content }));
  }

  const post = (body: any) => apiFetch(`/api/accounts/${accountId}/knowledge`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, campaignIds: null, minInboundMessages: null }),
  });
  const patch = (id: number, body: any) => apiFetch(`/api/accounts/${accountId}/knowledge/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const del = (id: number) => apiFetch(`/api/accounts/${accountId}/knowledge/${id}`, { method: "DELETE" });

  const saveAll = useCallback(async (factValues: FactValues, qaGrids: QAGrids) => {
    // Fixed facts.
    for (const id of Object.keys(FACT_DEFS)) {
      const def = FACT_DEFS[id];
      const content = (factValues[id] ?? "").trim();
      const existing = matchEntry(entries, def.category, def.title);
      if (!content) { if (existing) await del(existing.id); continue; }
      if (existing) { if (existing.content !== content) await patch(existing.id, { category: def.category, title: def.title, content }); }
      else await post({ category: def.category, title: def.title, content });
    }
    // Q&A grids.
    for (const stepKey of Object.keys(QA_CATEGORY)) {
      const category = QA_CATEGORY[stepKey];
      const rows = (qaGrids[stepKey] ?? []).filter((r) => r.question.trim() && r.answer.trim());
      const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
      for (const e of entries.filter((e) => e.category === category)) {
        if (!keptIds.has(e.id)) await del(e.id);
      }
      for (const r of rows) {
        const body = { category, title: r.question.trim(), content: r.answer.trim() };
        if (r.id) await patch(r.id, body);
        else await post(body);
      }
    }
    await fetchEntries();
  }, [accountId, entries, fetchEntries]);

  return { values, grids, loading, saveAll };
}
