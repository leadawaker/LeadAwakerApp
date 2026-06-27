import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { PREFERRED_WORD_GROUPS, type PreferredWordGroup } from "./profileConstants";

type Groups = Record<PreferredWordGroup, string[]>;

const DEFAULT_GROUPS: Groups = {
  projectTerm: [...PREFERRED_WORD_GROUPS.projectTerm],
  proposalTerm: [...PREFERRED_WORD_GROUPS.proposalTerm],
  decisionTerm: [...PREFERRED_WORD_GROUPS.decisionTerm],
};

export function useNicheWords(niche: string | null | undefined) {
  const [groups, setGroups] = useState<Groups>(DEFAULT_GROUPS);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!niche) { setGroups(DEFAULT_GROUPS); return; }
    apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Groups | null) => { if (data) setGroups(data); })
      .catch(() => {});
  }, [niche]);

  const addWord = useCallback(async (group: PreferredWordGroup, word: string) => {
    const trimmed = word.trim();
    if (!niche || !trimmed) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, word: trimmed }),
      });
      if (res.ok) {
        // The words endpoint now returns { nl, en }; this view edits the Dutch set.
        const data = await res.json();
        if (data.nl) setGroups(data.nl);
      }
    } catch { /* non-fatal */ }
    setAdding(false);
  }, [niche]);

  return { groups, addWord, adding };
}
