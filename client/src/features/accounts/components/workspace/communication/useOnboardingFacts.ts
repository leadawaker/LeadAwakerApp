import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { FACT_STEPS, type FactValues } from "./profileConstants";

// Phase 2 of onboarding writes "key facts" to the existing Knowledge Base.
// Each fact maps to one KB entry, matched by (category, title) so re-running the
// wizard upserts rather than duplicates.
interface KBEntry { id: number; category: string; title: string; content: string }

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

  // Current fact answers keyed by fact id, derived from matching KB entries.
  const values: FactValues = {};
  for (const f of FACT_STEPS) {
    values[f.id] = matchEntry(entries, f.category, f.title)?.content ?? "";
  }

  const saveFacts = useCallback(async (next: FactValues) => {
    for (const f of FACT_STEPS) {
      const content = (next[f.id] ?? "").trim();
      const existing = matchEntry(entries, f.category, f.title);
      if (!content) continue; // leave empty answers alone (don't create blanks)
      if (existing) {
        if (existing.content === content) continue;
        await apiFetch(`/api/accounts/${accountId}/knowledge/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: f.category, title: f.title, content }),
        });
      } else {
        await apiFetch(`/api/accounts/${accountId}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: f.category, title: f.title, content, campaignIds: null, minInboundMessages: null }),
        });
      }
    }
    await fetchEntries();
  }, [accountId, entries, fetchEntries]);

  return { values, loading, saveFacts };
}
